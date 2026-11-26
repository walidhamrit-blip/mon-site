"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Clock, CreditCard, ExternalLink, Loader2, XCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { formatUsd } from "@/lib/installments";
import {
  EMPTY_MANUAL_PAYMENT_DRAFT,
  ManualPaymentForm,
  manualQuoteForOption,
  type ManualPaymentDraft,
} from "@/components/manual-payment-form";
import type { PublicManualPaymentOption } from "@/lib/manual-payment-public";

interface OrderStatus {
  ref: string;
  kind?: "plan" | "reservation" | "flex";
  planName: string;
  amountLyd: string;
  amountUsd: string;
  currency: string;
  installments?: number;
  installmentIndex?: number;
  /** E-mail déjà masqué par le serveur (`w***@example.com`). */
  emailMasked: string | null;
  payCurrency: string | null;
  payAmount: string | null;
  paymentMethod?: string | null;
  status: "pending" | "paid" | "failed" | "expired";
  ipnStatus: string | null;
  createdAt: string;
}

interface Tranche {
  ref: string;
  installmentIndex: number;
  installments: number;
  amountUsd: string;
  amountLyd: string;
  status: "pending" | "paid" | "failed" | "expired";
  paymentUrl: string | null;
}

/**
 * Interroge le statut d'une commande (IPN à jour en base).
 * S'arrête dès que le paiement est confirmé — ou après
 * 10 minutes d'attente.
 *
 * ⚠️ La prop s'appelle `orderRef` (et non `ref`) : React 19 réserve
 * `ref` comme prop spéciale — la passer depuis un Server Component
 * fait planter la page avec « Refs cannot be used in Server
 * Components, nor passed to Client Components ».
 */
export function PaymentStatus({
  orderRef,
  trackingToken,
}: {
  orderRef: string;
  trackingToken?: string;
}) {
  const { locale, t } = useI18n();
  const ar = locale === "ar";
  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [tranches, setTranches] = useState<Tranche[]>([]);
  const router = useRouter();
  const [notFound, setNotFound] = useState(false);
  const [paying, setPaying] = useState<string | null>(null);
  const [payError, setPayError] = useState("");

  // Paiement manuel (Skrill / Neteller / Airtm / D17 / Volet / WebMoney / Kashy) pour les tranches
  // restantes : la configuration vient du serveur, jamais de la page.
  const [manualOptions, setManualOptions] = useState<PublicManualPaymentOption[]>([]);
  const [manualDraft, setManualDraft] = useState<ManualPaymentDraft>(EMPTY_MANUAL_PAYMENT_DRAFT);
  const [manualAccepted, setManualAccepted] = useState(false);
  const [manualMode, setManualMode] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/manual-payments/options", { cache: "no-store" });
        const payload = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          options?: PublicManualPaymentOption[];
        };
        if (cancelled) return;
        const list = response.ok && Array.isArray(payload.options) ? payload.options : [];
        setManualOptions(list);
        if (list.length > 0) {
          setManualDraft((current) =>
            list.some((item) => item.method === current.method)
              ? current
              : { ...current, method: list[0].method },
          );
        }
      } catch {
        if (!cancelled) setManualOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!orderRef) return;
    let stopped = false;
    const deadline = Date.now() + 10 * 60 * 1000;

    const poll = async () => {
      try {
        const res = await fetch(`/api/payments/order/${encodeURIComponent(orderRef)}`, {
          headers: trackingToken
            ? { "x-order-tracking-token": trackingToken }
            : undefined,
        });
        if (!res.ok) {
          // Seul un vrai 404 est définitif ; une erreur transitoire
          // (500, réseau) laisse le polling réessayer.
          if (res.status === 404 && !stopped) setNotFound(true);
          return;
        }
        const data = await res.json();
        if (stopped) return;
        setNotFound(false);
        setOrder(data.order);
        setTranches(Array.isArray(data.tranches) ? data.tranches : []);
        if (data.order.status !== "pending" || Date.now() > deadline) {
          clearInterval(timer);
        }
      } catch {
        /* on réessaie au prochain tick */
      }
    };

    poll();
    const timer = setInterval(poll, 3000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [orderRef, trackingToken]);

  const status = order?.status ?? "pending";

  /**
   * Ouvre le paiement d'une tranche planifiée : page NOWPayments, ou
   * enregistrement d'un virement manuel quand le client a choisi ce moyen.
   */
  const payTranche = async (tranche: string) => {
    setPayError("");
    if (manualMode) {
      const option = manualOptions.find((item) => item.method === manualDraft.method);
      const target = tranches.find((item) => item.ref === tranche);
      if (!option || !target) {
        setPayError(ar ? "طريقة الدفع اليدوي غير متاحة." : "The manual payment method is unavailable.");
        return;
      }
      if (
        manualDraft.senderName.trim().length < 2 ||
        manualDraft.senderAccount.trim().length < 3 ||
        manualDraft.transactionRef.trim().length < 3
      ) {
        setPayError(
          ar
            ? "أدخل اسم صاحب الحساب وحساب المُرسِل ومعرّف العملية."
            : "Enter the sender name, sender account and transaction ID.",
        );
        return;
      }
      if (!manualAccepted) {
        setPayError(
          ar
            ? "أكّد أنك حوّلت المبلغ المطلوب."
            : "Confirm that you sent the stated amount.",
        );
        return;
      }
    }
    setPaying(tranche);
    try {
      const res = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderRef: tranche,
          trackingToken: trackingToken || undefined,
          ...(manualMode
            ? {
                manualPayment: {
                  ...manualDraft,
                  senderName: manualDraft.senderName.trim(),
                  senderAccount: manualDraft.senderAccount.trim(),
                  transactionRef: manualDraft.transactionRef.trim(),
                  note: manualDraft.note.trim() || undefined,
                  quoteAccepted: manualAccepted,
                  quote: (() => {
                    const option = manualOptions.find(
                      (item) => item.method === manualDraft.method,
                    );
                    const target = tranches.find((item) => item.ref === tranche);
                    return option && target
                      ? manualQuoteForOption(
                          option,
                          Math.round(Number(target.amountUsd) * 100) / 100,
                        )
                      : undefined;
                  })(),
                },
              }
            : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok || !data.paymentUrl) {
        // Cause exacte : code serveur + détail (statut/message NOWPayments).
        const code: string = data.error ?? `http_${res.status}`;
        const detail: { status?: number | null; message?: string } =
          data.detail ?? {};
        const hint =
          code === "save_failed"
            ? ar
              ? t.checkout.hintDbAr
              : t.checkout.hintDbEn
            : code === "gateway_not_configured"
              ? ar
                ? t.checkout.hintKeyAr
                : t.checkout.hintKeyEn
              : ar
                ? t.pay.trancheErrorAr
                : t.pay.trancheErrorEn;
        const statusPart =
          detail.status != null ? ` · HTTP ${detail.status}` : "";
        const messagePart = detail.message
          ? ` — ${String(detail.message).slice(0, 200)}`
          : "";
        setPayError(`${hint} [${code}${statusPart}]${messagePart}`);
        setPaying(null);
        return;
      }
      if (data.manualPayment) {
        // Virement déclaré : rien à ouvrir, la commande reste en attente de
        // vérification humaine. On relit l'état pour l'afficher.
        setPaying(null);
        setManualAccepted(false);
        router.refresh();
        return;
      }
      window.location.assign(data.paymentUrl);
    } catch {
      setPayError(ar ? t.pay.trancheErrorAr : t.pay.trancheErrorEn);
      setPaying(null);
    }
  };

  /** Prochaine tranche non réglée : cible du virement manuel. */
  const nextTranche = tranches.find((tranche) => tranche.status !== "paid") ?? null;

  const unpaidUsd = tranches
    .filter((tranche) => tranche.status !== "paid")
    .reduce((sum, tranche) => sum + (Number(tranche.amountUsd) || 0), 0);
  const allPaid =
    tranches.length > 1 && tranches.every((tranche) => tranche.status === "paid");

  if (notFound) {
    return (
      <div className="rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-8 text-center">
        <XCircle className="mx-auto h-10 w-10 text-red-400" aria-hidden="true" />
        <h2 className="mt-4 text-xl font-black">
          {ar ? t.pay.notFoundAr : t.pay.notFoundEn}
        </h2>
      </div>
    );
  }

  return (
    <div className="rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-8 max-w-lg mx-auto text-center">
      {status === "paid" && (
        <>
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-500/15">
            <BadgeCheck className="h-8 w-8 text-emerald-400" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-2xl font-black text-emerald-400">
            {ar ? t.pay.paidTitleAr : t.pay.paidTitleEn}
          </h2>
          <p className="mt-2 text-sm opacity-70 leading-relaxed">
            {ar ? t.pay.paidNoteAr : t.pay.paidNoteEn}
          </p>
        </>
      )}

      {status === "pending" && (
        <>
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[var(--accent)]/15">
            {order ? (
              <Clock className="h-8 w-8 text-[var(--accent)]" aria-hidden="true" />
            ) : (
              <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" aria-hidden="true" />
            )}
          </span>
          <h2 className="mt-4 text-2xl font-black">
            {ar ? t.pay.pendingTitleAr : t.pay.pendingTitleEn}
          </h2>
          <p className="mt-2 text-sm opacity-70 leading-relaxed">
            {ar ? t.pay.pendingNoteAr : t.pay.pendingNoteEn}
          </p>
          <span className="mt-4 inline-flex items-center gap-1.5 text-xs opacity-60">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            {ar ? t.pay.liveAr : t.pay.liveEn}
          </span>
        </>
      )}

      {(status === "failed" || status === "expired") && (
        <>
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-red-500/15">
            <XCircle className="h-8 w-8 text-red-400" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-2xl font-black">
            {ar
              ? status === "expired"
                ? t.pay.expiredTitleAr
                : t.pay.failedTitleAr
              : status === "expired"
                ? t.pay.expiredTitleEn
                : t.pay.failedTitleEn}
          </h2>
          <p className="mt-2 text-sm opacity-70 leading-relaxed">
            {ar ? t.pay.failedNoteAr : t.pay.failedNoteEn}
          </p>
        </>
      )}

      {order && (
        <dl className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--secondary)]/40 p-4 text-sm text-start space-y-2">
          <div className="flex justify-between gap-4">
            <dt className="opacity-60">{ar ? t.pay.orderAr : t.pay.orderEn}</dt>
            <dd className="font-bold" dir="ltr">{order.ref}</dd>
          </div>
          {order.kind === "reservation" && (
            <div className="flex justify-between gap-4">
              <dt className="opacity-60">
                {ar ? "نوع الطلب" : "Order type"}
              </dt>
              <dd className="font-bold text-emerald-400">
                {ar ? "حجز أولوية — عربون" : "Priority reservation — deposit"}
              </dd>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <dt className="opacity-60">{ar ? t.pay.planAr : t.pay.planEn}</dt>
            <dd className="font-bold">{order.planName}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="opacity-60">{ar ? t.pay.amountAr : t.pay.amountEn}</dt>
            <dd className="font-bold" dir="ltr">
              ${order.amountUsd}{" "}
              <span className="opacity-50 font-normal">USD · = USDT</span>
            </dd>
          </div>
          {order.payCurrency && (
            <div className="flex justify-between gap-4">
              <dt className="opacity-60">{ar ? t.pay.cryptoAr : t.pay.cryptoEn}</dt>
              <dd className="font-bold" dir="ltr">
                {order.payAmount} {order.payCurrency.toUpperCase()}
              </dd>
            </div>
          )}
          {order.emailMasked && (
            <div className="flex justify-between gap-4">
              <dt className="opacity-60">{ar ? t.pay.emailAr : t.pay.emailEn}</dt>
              <dd className="font-bold" dir="ltr">{order.emailMasked}</dd>
            </div>
          )}
        </dl>
      )}

      {tranches.length === 1 &&
        status === "pending" &&
        order?.paymentMethod === "paygate" &&
        tranches[0]?.paymentUrl && (
          <div className="mt-4 rounded-2xl border border-[var(--accent)]/40 bg-[var(--accent)]/5 p-4 text-start">
            <p className="text-xs leading-5 opacity-80">
              {ar
                ? "صفحة الدفع الآمنة بالبطاقة جاهزة. بعد إتمام الدفع، ستتحدّث هذه الصفحة تلقائياً."
                : "Your secure card checkout is ready. Once paid, this page updates automatically."}
            </p>
            <a
              href={tranches[0].paymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-4 text-xs font-black text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)]"
            >
              <CreditCard className="h-4 w-4" aria-hidden="true" />
              {ar ? "فتح صفحة الدفع بالبطاقة" : "Open secure card checkout"}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>
        )}

      {tranches.length > 1 && (
        <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--secondary)]/40 p-4 text-start">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-black">
              {ar ? t.pay.tranchesTitleAr : t.pay.tranchesTitleEn}
            </h3>
            {!allPaid && (
              <span className="text-xs opacity-60">
                {ar ? t.pay.remainingAr : t.pay.remainingEn}:{" "}
                <strong className="text-[var(--accent)]" dir="ltr">
                  ${formatUsd(unpaidUsd)}
                </strong>
              </span>
            )}
          </div>

          {allPaid ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-400">
              <BadgeCheck className="h-4 w-4" aria-hidden="true" />
              {ar ? t.pay.allTranchesPaidAr : t.pay.allTranchesPaidEn}
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {tranches.map((tranche) => (
                <li
                  key={tranche.ref}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-bold">
                      {ar ? t.pay.trancheAr : t.pay.trancheEn}{" "}
                      {tranche.installmentIndex}/{tranche.installments}
                    </div>
                    <div className="text-xs opacity-60" dir="ltr">
                      ${formatUsd(Number(tranche.amountUsd) || 0)}
                    </div>
                  </div>

                  {tranche.status === "paid" ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400">
                      <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      {ar ? t.pay.tranchePaidAr : t.pay.tranchePaidEn}
                    </span>
                  ) : tranche.status === "pending" && tranche.paymentUrl ? (
                    <a
                      href={tranche.paymentUrl}
                      className="h-8 px-3 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] text-xs font-bold inline-flex items-center hover:bg-[var(--accent-hover)] transition-colors"
                    >
                      {ar ? t.pay.trancheOpenAr : t.pay.trancheOpenEn}
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => payTranche(tranche.ref)}
                      disabled={paying !== null}
                      className="h-8 px-3 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-60 hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
                    >
                      {paying === tranche.ref && (
                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                      )}
                      {manualMode
                        ? ar
                          ? "إرسال بيانات التحويل"
                          : "Submit transfer details"
                        : ar
                          ? t.pay.payTrancheAr
                          : t.pay.payTrancheEn}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Virement manuel pour la prochaine tranche : même garde-fou que
              la crypto — rien n'est encaissé sans vérification humaine. */}
          {manualOptions.length > 0 && unpaidUsd > 0 && (
            <div className="mt-3 space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  aria-pressed={!manualMode}
                  onClick={() => {
                    setManualMode(false);
                    setPayError("");
                  }}
                  className={`min-h-10 rounded-lg border px-2 text-[11.5px] font-black ${
                    !manualMode
                      ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                      : "border-[var(--border)] hover:border-[var(--accent)]/60"
                  }`}
                >
                  {ar ? "عملات رقمية" : "Crypto"}
                </button>
                <button
                  type="button"
                  aria-pressed={manualMode}
                  onClick={() => {
                    setManualMode(true);
                    setPayError("");
                  }}
                  className={`min-h-10 rounded-lg border px-2 text-[11.5px] font-black ${
                    manualMode
                      ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                      : "border-[var(--border)] hover:border-[var(--accent)]/60"
                  }`}
                >
                  {ar ? "تحويل يدوي" : "Manual transfer"}
                </button>
              </div>
              {manualMode && (
                <ManualPaymentForm
                  options={manualOptions}
                  amountUsd={
                    Math.round(Number(nextTranche?.amountUsd ?? unpaidUsd) * 100) / 100
                  }
                  draft={manualDraft}
                  onDraftChange={setManualDraft}
                  quoteAccepted={manualAccepted}
                  onQuoteAcceptedChange={setManualAccepted}
                  locale={ar ? "ar" : "en"}
                />
              )}
            </div>
          )}

          {payError && (
            <p className="mt-3 text-xs font-semibold text-red-400">{payError}</p>
          )}
        </div>
      )}
    </div>
  );
}
