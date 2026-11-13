"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LocalizedLink as Link } from "@/components/localized-link";
import {
  BadgeCheck,
  Check,
  Clock,
  Copy,
  ExternalLink,
  Loader2,
  Search,
  ShieldCheck,
  TriangleAlert,
  Wallet,
  XCircle,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { regionLabel } from "@/lib/digital-types";

interface DigitalCode {
  cardNumber: string;
  pinCode: string | null;
  redemptionUrl: string | null;
}

interface PublicDigitalOrder {
  ref: string;
  status: "pending" | "paid" | "manual" | "delivered" | "failed";
  /**
   * Statut granulaire de livraison. `paid_fulfilling` = l'achat fournisseur
   * est en cours (y compris retries programmés) ; `manual_review` = notre
   * équipe prend le relais. Optionnel : un onglet ouvert avant le
   * déploiement continue de fonctionner avec `status` seul.
   */
  fulfillmentStatus?:
    | "pending_payment"
    | "paid_fulfilling"
    | "delivered"
    | "manual_review";
  productTitle: string;
  platform: string;
  denominationLabel: string;
  region: string;
  quantity: number;
  totalUsd: string;
  recipientEmailMasked: string;
  createdAt: string;
  deliveredAt: string | null;
  reloadlyStatus: string | null;
  codes: DigitalCode[];
  paymentMethod: "nowpayments" | "phone_card";
  phoneCardStatus: "pending" | "approved" | "rejected" | null;
  notice: string | null;
}

/** Solde dû au client, tel que son propre suivi peut le voir. */
interface ClientCreditView {
  balanceLyd: string;
  request: {
    status: "pending" | "approved" | "rejected";
    amountLyd: string;
    createdAt: string;
    reviewedAt: string | null;
    adminNote: string | null;
  } | null;
  canRequest: boolean;
  blocked: "none" | "no_balance" | "already_pending" | "already_used" | "order_closed" | "no_identity";
}

const LAST_ORDER_KEY = "nukhba:digital-order";

/** `12.04` → `12,04 LYD` (affichage, jamais un calcul). */
function lydLabel(value: string): string {
  const amount = Number(value);
  return `${(Number.isFinite(amount) ? amount : 0).toFixed(2).replace(".", ",")} LYD`;
}

/**
 * Suivi d'une commande de code.
 *
 * - reçoit la référence et le jeton depuis l'URL de retour NOWPayments ;
 * - à défaut, reprend la dernière commande enregistrée sur l'appareil ;
 * - interroge le serveur toutes les 15 s jusqu'à la livraison.
 */
export function DigitalOrderStatus({
  initialRef,
  initialToken,
}: {
  initialRef: string;
  initialToken: string;
}) {
  const { locale } = useI18n();
  const ar = locale === "ar";

  const [ref, setRef] = useState(initialRef);
  const [token, setToken] = useState(initialToken);
  const [formRef, setFormRef] = useState(initialRef);
  const [formToken, setFormToken] = useState(initialToken);
  const [order, setOrder] = useState<PublicDigitalOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [credit, setCredit] = useState<ClientCreditView | null>(null);
  const [creditBusy, setCreditBusy] = useState(false);
  const [creditNote, setCreditNote] = useState("");
  const [creditMessage, setCreditMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reprise de la dernière commande locale si l'URL ne porte rien.
  // Lecture de `localStorage` côté navigateur uniquement : l'état est donc
  // rempli après montage (même exception assumée que `theme-provider`).
  useEffect(() => {
    if (initialRef && initialToken) return;
    let parsed: { ref?: string; token?: string } | null = null;
    try {
      const raw = window.localStorage.getItem(LAST_ORDER_KEY);
      parsed = raw ? (JSON.parse(raw) as { ref?: string; token?: string }) : null;
    } catch {
      parsed = null;
    }
    if (!parsed?.ref || !parsed.token) return;

    applyCredentials(parsed.ref, parsed.token);
  }, [initialRef, initialToken]);

  /** Préremplit la référence et le jeton (reprise locale ou saisie). */
  function applyCredentials(nextRef: string, nextToken: string) {
    setRef(nextRef);
    setToken(nextToken);
    setFormRef(nextRef);
    setFormToken(nextToken);
  }

  const fetchOrder = useCallback(async () => {
    if (!ref.trim() || !token.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/digital/orders/${encodeURIComponent(ref.trim())}`, {
        headers: { "x-order-tracking-token": token.trim() },
        cache: "no-store",
      });
      if (res.status === 404) {
        setNotFound(true);
        setOrder(null);
        setError("");
        return;
      }
      if (!res.ok) {
        setError(ar ? "الخدمة غير متاحة مؤقتاً." : "Service temporarily unavailable.");
        return;
      }
      const data = (await res.json()) as { ok?: boolean; order?: PublicDigitalOrder };
      if (data.ok && data.order) {
        setOrder(data.order);
        setNotFound(false);
        setError("");
      }
    } catch {
      setError(ar ? "تعذر الاتصال بالخادم." : "Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }, [ref, token, ar]);

  useEffect(() => {
    if (!ref.trim() || !token.trim()) return;
    // `fetchOrder` met à jour l'état de chargement : c'est le cycle de
    // sondage voulu (même exception que les autres providers du site).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchOrder();
    if (order?.status === "delivered" || order?.status === "failed") return;
    timer.current = setTimeout(() => void fetchOrder(), 15000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [ref, token, order?.status, fetchOrder]);

  /**
   * Solde visible depuis le lien privé de la commande (référence + jeton).
   * Le montant vient du serveur, jamais du navigateur.
   */
  const fetchCredit = useCallback(async () => {
    if (!ref.trim() || !token.trim()) return;
    try {
      const res = await fetch(`/api/digital/orders/${encodeURIComponent(ref.trim())}/credit`, {
        headers: { "x-order-tracking-token": token.trim() },
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { ok?: boolean; credit?: ClientCreditView };
      if (data.ok && data.credit) setCredit(data.credit);
    } catch {
      // Silencieux : le suivi de commande reste l'information principale.
    }
  }, [ref, token]);

  useEffect(() => {
    if (!order) return;
    // Dépendances ciblées : le sondage remplace l'objet `order` toutes les
    // 15 s, on ne relit le solde que si la commande change de statut.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchCredit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.ref, order?.status, fetchCredit]);

  const requestCredit = async () => {
    setCreditBusy(true);
    setCreditMessage(null);
    try {
      const res = await fetch(`/api/digital/orders/${encodeURIComponent(ref.trim())}/credit`, {
        method: "POST",
        headers: {
          "x-order-tracking-token": token.trim(),
          "content-type": "application/json",
        },
        body: JSON.stringify({ note: creditNote.trim() || undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        error?: string;
        credit?: ClientCreditView;
      };
      if (data.ok) {
        if (data.credit) setCredit(data.credit);
        setCreditNote("");
        setCreditMessage({
          ok: true,
          text: data.message || (ar ? "تم إرسال الطلب." : "Request sent."),
        });
      } else {
        setCreditMessage({
          ok: false,
          text:
            data.message ||
            (ar ? "تعذر إرسال الطلب." : "Could not send the request."),
        });
      }
    } catch {
      setCreditMessage({
        ok: false,
        text: ar ? "تعذر الاتصال بالخادم." : "Could not reach the server.",
      });
    } finally {
      setCreditBusy(false);
    }
  };

  const copy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      window.prompt(ar ? "انسخ الرمز:" : "Copy this code:", value);
    }
  };

  const statusMeta = useMemo(() => {
    switch (order?.status) {
      case "delivered":
        return {
          icon: BadgeCheck,
          tone: "text-emerald-600",
          chip: "border-emerald-200 bg-emerald-50 text-emerald-800",
          label: ar ? "تم التسليم" : "Delivered",
        };
      case "failed":
        return {
          icon: XCircle,
          tone: "text-red-600",
          chip: "border-red-200 bg-red-50 text-red-800",
          label:
            order?.paymentMethod === "phone_card"
              ? ar ? "بطاقة الهاتف مرفوضة" : "Phone card rejected"
              : ar ? "تعذر الإصدار" : "Not issued",
        };
      case "manual":
        return {
          icon: TriangleAlert,
          tone: "text-orange-600",
          chip: "border-orange-200 bg-orange-50 text-orange-800",
          label: ar ? "قيد التحضير" : "Being prepared",
        };
      case "paid":
        // Deux nuances utiles côté client : « en cours d'émission » (achat
        // fournisseur en route, retries automatiques) et « pris en charge
        // par l'équipe » (revue manuelle) — l'attente n'a pas la même
        // durée, et le client ne doit pas croire à une panne.
        return order?.fulfillmentStatus === "manual_review"
          ? {
              icon: TriangleAlert,
              tone: "text-orange-600",
              chip: "border-orange-200 bg-orange-50 text-orange-800",
              label: ar
                ? "تم الدفع — فريقنا يتولى الأمر"
                : "Paid — our team is handling it",
            }
          : {
              icon: Loader2,
              tone: "text-sky-600",
              chip: "border-sky-200 bg-sky-50 text-sky-800",
              label: ar ? "تم الدفع — جارٍ الإصدار" : "Paid — issuing",
            };
      default:
        return {
          icon: Clock,
          tone: "text-amber-600",
          chip: "border-amber-200 bg-amber-50 text-amber-800",
          label:
            order?.paymentMethod === "phone_card"
              ? ar ? "التحقق من بطاقة الهاتف" : "Verifying phone card"
              : ar ? "بانتظار الدفع" : "Awaiting payment",
        };
    }
  }, [order?.status, order?.fulfillmentStatus, order?.paymentMethod, ar]);

  const StatusIcon = statusMeta.icon;

  return (
    <div className="space-y-5">
      {/* Recherche / reprise */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setOrder(null);
          setNotFound(false);
          applyCredentials(formRef.trim(), formToken.trim());
        }}
        className="card-surface p-5"
      >
        <h2 className="text-[15px] font-black">
          {ar ? "تتبّع طلبك" : "Track your order"}
        </h2>
        <p className="mt-1 text-[12.5px] leading-6 text-[var(--muted-foreground)]">
          {ar
            ? "أدخل رقم الطلب والرمز المرفق مع رابط الدفع أو بريد التسليم."
            : "Enter the order reference and the tracking token from the payment page or the delivery e-mail."}
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input
            value={formRef}
            onChange={(event) => setFormRef(event.target.value)}
            placeholder="DGC-XXXXXXXX"
            dir="ltr"
            className="h-11 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 font-mono text-[13px] outline-none focus:border-[var(--accent)]"
          />
          <input
            value={formToken}
            onChange={(event) => setFormToken(event.target.value)}
            placeholder={ar ? "رمز التتبّع" : "Tracking token"}
            dir="ltr"
            className="h-11 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 font-mono text-[12px] outline-none focus:border-[var(--accent)]"
          />
          <button
            type="submit"
            disabled={loading || !formRef.trim() || !formToken.trim()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 text-[13px] font-black text-[var(--accent-foreground)] disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {ar ? "عرض" : "View"}
          </button>
        </div>
      </form>

      {notFound && (
        <div className="rounded-xl border border-amber-300/70 bg-amber-50 p-4 text-[13px] leading-6 text-amber-900">
          {ar
            ? "لم يتم العثور على طلب بهذه البيانات. تحقق من الرقم والرمز (كلاهما حسّاس لحالة الأحرف)."
            : "No order matches these details. Check the reference and token (both are case-sensitive)."}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-300/70 bg-red-50 p-4 text-[13px] text-red-800">
          {error}
        </div>
      )}

      {order && (
        <section className="card-surface overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] p-5">
            <div className="min-w-0">
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                {order.ref}
              </div>
              <h2 className="mt-1 text-[18px] font-black leading-tight" dir="auto">
                {order.productTitle}
              </h2>
              <p className="mt-1 text-[12.5px] text-[var(--muted-foreground)]">
                {order.denominationLabel} × {order.quantity} ·{" "}
                {regionLabel(order.region, locale)} · ${order.totalUsd}
              </p>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-bold ${statusMeta.chip}`}
            >
              <StatusIcon
                className={`h-3.5 w-3.5 ${order.status === "paid" || loading ? "animate-spin" : ""}`}
              />
              {statusMeta.label}
            </span>
          </div>

          <div className="space-y-4 p-5">
            {order.notice && (
              <p className="rounded-lg border border-[var(--border)] bg-[var(--secondary)]/40 px-3.5 py-3 text-[12.5px] leading-6 text-[var(--muted-foreground)]">
                {order.notice}
              </p>
            )}

            {credit && (credit.request || credit.canRequest || credit.blocked === "order_closed") && (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--secondary)]/40 p-4">
                <div className="flex items-center gap-2 text-[10.5px] font-black uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                  <Wallet className="h-3.5 w-3.5" />
                  {ar ? "رصيدك لدينا" : "Your balance with us"}
                </div>
                <p className="mt-1.5 text-[16px] font-black" dir="ltr">
                  {lydLabel(credit.balanceLyd)}
                  <span className="ms-1.5 text-[11.5px] font-bold text-[var(--muted-foreground)]">
                    {ar ? "متاح" : "available"}
                  </span>
                </p>

                {credit.request?.status === "pending" && (
                  <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] leading-6 text-amber-900">
                    {ar
                      ? `طلب استخدام ${lydLabel(credit.request.amountLyd)} من رصيدك على هذا الطلب — بانتظار موافقة الفريق. لا يُخصم أي مبلغ قبل الموافقة.`
                      : `Request to use ${lydLabel(credit.request.amountLyd)} of your balance on this order — waiting for the team. Nothing is deducted before approval.`}
                  </p>
                )}
                {credit.request?.status === "approved" && (
                  <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12.5px] leading-6 text-emerald-900">
                    {ar
                      ? `تمت الموافقة: استُخدم ${lydLabel(credit.request.amountLyd)} من رصيدك على هذا الطلب.`
                      : `Approved: ${lydLabel(credit.request.amountLyd)} of your balance was used on this order.`}
                  </p>
                )}
                {credit.request?.status === "rejected" && (
                  <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] leading-6 text-red-800">
                    {ar
                      ? "لم يُقبل طلب استخدام الرصيد. رصيدك ما زال محفوظاً لدى الفريق."
                      : "The balance request was declined. Your balance stays with us, untouched."}
                  </p>
                )}

                {credit.canRequest && (
                  <div className="mt-3 space-y-2">
                    <p className="text-[12px] leading-6 text-[var(--muted-foreground)]">
                      {ar
                        ? "يمكنك طلب استخدام رصيدك على هذا الطلب. يوافق الفريق أولاً ثم يُخصم المبلغ — لا خصم تلقائي."
                        : "You can ask to use your balance on this order. The team approves first, then the amount is deducted — never automatically."}
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <label className="flex-1">
                        <span className="sr-only">{ar ? "رسالة اختيارية" : "Optional message"}</span>
                        <input
                          value={creditNote}
                          onChange={(event) => setCreditNote(event.target.value)}
                          maxLength={300}
                          placeholder={ar ? "رسالة (اختياري)" : "Message (optional)"}
                          className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-[12.5px] outline-none focus:border-[var(--accent)]"
                        />
                      </label>
                      <button
                        type="button"
                        disabled={creditBusy}
                        onClick={() => void requestCredit()}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 text-[12.5px] font-black text-[var(--accent-foreground)] disabled:opacity-50"
                      >
                        {creditBusy ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Wallet className="h-4 w-4" />
                        )}
                        {ar
                          ? `استخدام رصيدي (${lydLabel(credit.balanceLyd)})`
                          : `Use my balance (${lydLabel(credit.balanceLyd)})`}
                      </button>
                    </div>
                  </div>
                )}

                {credit.blocked === "order_closed" && !credit.request && (
                  <p className="mt-2 text-[12px] leading-6 text-[var(--muted-foreground)]">
                    {ar
                      ? "هذا الطلب مكتمل. للاستفادة من رصيدك، تواصل معنا مع ذكر رقم الطلب."
                      : "This order is closed. To use your balance, contact us with the order reference."}
                  </p>
                )}

                {creditMessage && (
                  <p
                    className={`mt-2 rounded-lg border px-3 py-2 text-[12px] font-bold ${
                      creditMessage.ok
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-red-200 bg-red-50 text-red-800"
                    }`}
                  >
                    {creditMessage.text}
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-[12px] text-[var(--muted-foreground)]">
              <span>
                {ar ? "البريد" : "E-mail"} : <strong dir="ltr">{order.recipientEmailMasked}</strong>
              </span>
              <span>
                {ar ? "تاريخ الطلب" : "Ordered"} :{" "}
                {new Date(order.createdAt).toLocaleString(ar ? "ar-LY" : "en-GB")}
              </span>
              {order.deliveredAt && (
                <span>
                  {ar ? "تاريخ التسليم" : "Delivered"} :{" "}
                  {new Date(order.deliveredAt).toLocaleString(ar ? "ar-LY" : "en-GB")}
                </span>
              )}
            </div>

            {order.status === "delivered" ? (
              <div className="space-y-3">
                {order.codes.map((code, index) => (
                  <div
                    key={`${code.cardNumber}-${index}`}
                    className="rounded-xl border border-[var(--border)] bg-[var(--secondary)]/35 p-4"
                  >
                    {order.codes.length > 1 && (
                      <div className="mb-1 text-[10.5px] font-black uppercase tracking-[0.14em] text-[var(--accent)]">
                        {ar ? `الرمز ${index + 1}` : `Code ${index + 1}`}
                      </div>
                    )}
                    <div className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--muted-foreground)]">
                      {ar ? "رقم البطاقة" : "Card number"}
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <code className="break-all font-mono text-[15px] font-bold" dir="ltr">
                        {code.cardNumber}
                      </code>
                      <button
                        type="button"
                        onClick={() => copy(code.cardNumber, `card-${index}`)}
                        aria-label={ar ? "نسخ" : "Copy"}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[var(--border)] hover:border-[var(--accent)]"
                      >
                        {copied === `card-${index}` ? (
                          <Check className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>

                    {code.pinCode && (
                      <>
                        <div className="mt-3 text-[10.5px] font-bold uppercase tracking-wide text-[var(--muted-foreground)]">
                          PIN
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <code className="font-mono text-[15px] font-bold" dir="ltr">
                            {code.pinCode}
                          </code>
                          <button
                            type="button"
                            onClick={() => copy(code.pinCode ?? "", `pin-${index}`)}
                            aria-label={ar ? "نسخ" : "Copy"}
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[var(--border)] hover:border-[var(--accent)]"
                          >
                            {copied === `pin-${index}` ? (
                              <Check className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </>
                    )}

                    {code.redemptionUrl && (
                      <a
                        href={code.redemptionUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-bold text-[var(--accent)] hover:underline"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        {ar ? "تفعيل الرمز" : "Redeem this code"}
                      </a>
                    )}
                  </div>
                ))}

                <p className="flex items-start gap-2 text-[11.5px] leading-6 text-[var(--muted-foreground)]">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
                  {order.region.toLowerCase() === "global"
                    ? ar
                      ? "هذا الرمز صالح عالمياً."
                      : "This code is valid worldwide."
                    : ar
                      ? "هذا الرمز صالح فقط في المنطقة المذكورة — لا تستخدمه بحساب من منطقة أخرى."
                      : "This code only works in the region shown — do not use it on an account from another region."}
                </p>
              </div>
            ) : order.status === "failed" ? (
              <div className="flex items-center gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-[12.5px] text-red-800">
                <XCircle className="h-4 w-4 shrink-0" />
                {order.paymentMethod === "phone_card"
                  ? ar
                    ? "توقف الطلب بعد التحقق من بطاقة الهاتف. تواصل معنا مع ذكر مرجع الطلب؛ لا ترسل بطاقة أخرى قبل الاتفاق معنا."
                    : "The order stopped after phone card verification. Contact us with your order reference; do not submit another card before speaking with us."
                  : ar
                    ? "تعذر إصدار الكود. تواصل معنا مع ذكر مرجع الطلب."
                    : "The code could not be issued. Contact us with your order reference."}
              </div>
            ) : (
              <div className="flex items-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/30 px-3.5 py-3 text-[12.5px] text-[var(--muted-foreground)]">
                <Loader2 className="h-4 w-4 animate-spin text-[var(--accent)]" />
                {ar
                  ? "يتم تحديث الحالة تلقائياً كل 15 ثانية. يمكنك ترك الصفحة — سيصلك الرمز بالبريد الإلكتروني."
                  : "Status refreshes automatically every 15 s. You can leave this page — the code will be e-mailed to you."}
              </div>
            )}
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3 text-[12.5px] font-bold">
        <Link href="/codes" className="text-[var(--accent)] hover:underline">
          {ar ? "كل الأكواد والبطاقات" : "All codes & cards"}
        </Link>
        <Link href="/contact" className="text-[var(--muted-foreground)] hover:text-[var(--accent)]">
          {ar ? "بحاجة لمساعدة؟" : "Need help?"}
        </Link>
      </div>
    </div>
  );
}
