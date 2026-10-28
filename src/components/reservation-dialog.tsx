"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  BadgeCheck,
  CalendarCheck,
  Loader2,
  MessageCircle,
  ShieldCheck,
  X,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSiteConfig } from "@/components/site-provider";
import { Price } from "@/components/price";
import { resolveDemoClassification } from "@/lib/classification";
import { formatMainPrice, formatUsd } from "@/lib/installments";
import { PaymentGuarantee } from "@/components/payment-guarantee";
import { ModelPriceBreakdown } from "@/components/model-price-breakdown";
import type { Demo } from "@/lib/site-types";

interface ReserveResponse {
  ok: boolean;
  error?: string;
  detail?: {
    source?: string;
    status?: number | null;
    message?: string;
  };
  orderRef?: string;
  paymentUrl?: string;
  depositUsd?: number;
}

interface Failure {
  code: string;
  status: number | null;
  message: string;
}

type Step = "form" | "creating" | "ready" | "error";

/**
 * Dialogue de réservation prioritaire (acompte, 1 $ par défaut).
 * Le montant est fixé par le serveur depuis la configuration admin ;
 * le client ne fait que choisir le site et laisser ses coordonnées.
 */
export function ReservationDialog({
  demo,
  onClose,
}: {
  demo: Demo;
  onClose: () => void;
}) {
  const config = useSiteConfig();
  const { locale } = useI18n();
  const ar = locale === "ar";

  const classification = resolveDemoClassification(demo, config.pricing.plans);
  const depositUsd = config.reservation?.depositUsd ?? 1;

  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [failure, setFailure] = useState<Failure | null>(null);
  const [payment, setPayment] = useState<ReserveResponse | null>(null);
  const [countdown, setCountdown] = useState(5);

  const title = ar ? demo.title : demo.titleEn;

  // Le dialogue n'est monté qu'après un clic (côté client) : aucune
  // désynchronisation d'hydratation possible.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Redirection automatique vers la page de paiement hébergée.
  useEffect(() => {
    if (step !== "ready" || !payment?.paymentUrl) return;
    if (countdown <= 0) {
      window.location.href = payment.paymentUrl;
      return;
    }
    const timer = setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [step, countdown, payment]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.includes("@")) return;
    setStep("creating");
    setFailure(null);
    try {
      const res = await fetch("/api/payments/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          demoSlug: demo.slug,
          name: name.trim() || undefined,
          email: email.trim(),
          phone: phone.trim() || undefined,
          locale,
          utm:
            typeof window !== "undefined"
              ? window.location.search.slice(0, 500) || undefined
              : undefined,
        }),
      });
      const data: ReserveResponse = await res
        .json()
        .catch(() => ({ ok: false }) as ReserveResponse);
      if (!res.ok || !data.ok || !data.paymentUrl) {
        setFailure({
          code: data.error ?? `http_${res.status}`,
          status: data.detail?.status ?? res.status,
          message: data.detail?.message ?? "",
        });
        setStep("error");
        return;
      }
      setPayment(data);
      setCountdown(5);
      setStep("ready");
    } catch (error) {
      setFailure({
        code: "network_error",
        status: null,
        message: error instanceof Error ? error.message : String(error),
      });
      setStep("error");
    }
  };

  const whatsappNumber = config.whatsapp.replace(/\D/g, "");
  const whatsappText = ar
    ? `أريد حجز أولوية لموقع « ${demo.title} » — الفئة ${classification?.tier ?? "؟"}. العربون ${formatUsd(depositUsd)} $ (= ${formatUsd(depositUsd)} USDT).`
    : `I'd like to reserve a priority slot for "${demo.titleEn}" — category ${classification?.tier ?? "?"}. Deposit $${formatUsd(depositUsd)} (= ${formatUsd(depositUsd)} USDT).`;
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappText)}`;

  const failureHint = (): string => {
    const code = failure?.code ?? "";
    if (code === "gateway_not_configured")
      return ar
        ? "بوابة الدفع غير مهيأة حالياً على الخادم. يمكنك حجز مكانك الآن مباشرة عبر واتساب."
        : "The payment gateway is not configured on the server right now. You can reserve your slot directly on WhatsApp.";
    if (code === "gateway_error")
      return ar
        ? "رفضت بوابة الدفع إنشاء فاتورة العربون. أعد المحاولة أو احجز عبر واتساب."
        : "The payment gateway refused to create the deposit invoice. Retry or reserve via WhatsApp.";
    if (code === "reservation_disabled")
      return ar
        ? "عرض الحجز المسبق معطّل مؤقتاً — راسلنا على واتساب لحجز مكانك."
        : "Priority booking is temporarily disabled — message us on WhatsApp to reserve a slot.";
    if (code === "demo_not_found")
      return ar
        ? "هذا الموقع لم يعد متوفراً في المعرض — راسلنا على واتساب."
        : "This showcase is no longer available — message us on WhatsApp.";
    if (code === "rate_limited")
      return ar
        ? "محاولات كثيرة في وقت قصير — انتظر قليلاً أو راسلنا على واتساب."
        : "Too many attempts in a short time — wait a moment or message us on WhatsApp.";
    if (code === "save_failed" || code === "invalid_deposit")
      return ar
        ? "تعذر تسجيل الحجز في قاعدة البيانات. أعد المحاولة أو احجز عبر واتساب."
        : "The reservation could not be saved. Retry or reserve via WhatsApp.";
    if (code === "network_error")
      return ar
        ? "تعذر الوصول إلى الخادم (شبكة) — أعد المحاولة."
        : "Could not reach the server (network) — please retry.";
    return ar
      ? "تعذر إنشاء الحجز — أعد المحاولة أو راسلنا على واتساب."
      : "Booking could not be created — retry or message us on WhatsApp.";
  };

  const inputCls =
    "w-full h-11 px-4 rounded-xl border border-[var(--border)] bg-black/30 text-sm outline-none focus:border-[var(--accent)] transition-colors";

  const content = (
    <div
      className="fixed inset-0 z-[10000] grid place-items-center bg-black/75 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      dir={ar ? "rtl" : "ltr"}
    >
      <div
        className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        {/* En-tête */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--accent)] text-[var(--accent-foreground)]">
              <CalendarCheck className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-black">
                {ar ? "احجز مكانك مسبقاً" : "Reserve your place in advance"}
              </h2>
              <p className="text-xs opacity-60">
                {ar
                  ? "عربون بسيط يضمن لك أولوية في جدول العمل"
                  : "A small deposit secures priority in our schedule"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full opacity-60 hover:opacity-100 cursor-pointer"
            aria-label={ar ? "إغلاق" : "Close"}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {step === "form" && (
          <form onSubmit={submit} className="mt-5 space-y-3">
            {/* Projet + classification */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--secondary)]/40 p-4">
              <div className="text-sm font-bold">{title}</div>
              {classification && (
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-2 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] font-black">
                    {ar ? "الفئة" : "Category"} {classification.tier}
                  </span>
                  <span className="opacity-70">
                    {ar ? classification.name : classification.nameEn}
                  </span>
                </div>
              )}

              {classification && (
                <div className="mt-3 rounded-xl bg-[var(--card)]/60 p-3">
                  <ModelPriceBreakdown
                    breakdown={classification}
                    compact
                  />
                </div>
              )}

              <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/30 px-3 py-2">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wide opacity-70">
                    {ar ? "عربون الحجز" : "Reservation deposit"}
                  </div>
                  <div className="text-[10px] opacity-60">
                    {ar
                      ? "يُخصم من الإجمالي النهائي بعد اعتماد عرض التخصيص"
                      : "Deducted from the approved final total after the customization quote"}
                  </div>
                </div>
                <div className="text-end">
                  <div className="text-lg font-black text-[var(--accent)]">
                    <Price usd={depositUsd} />
                    {" · = "}
                    {formatUsd(depositUsd)} USDT
                  </div>
                  <div className="text-[10px] opacity-60">
                    <Price usd={depositUsd} />
                  </div>
                </div>
              </div>
            </div>

            <input
              className={inputCls}
              placeholder={ar ? "الاسم (اختياري)" : "Your name (optional)"}
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
              dir={ar ? "rtl" : "ltr"}
            />
            <input
              className={inputCls}
              type="email"
              required
              placeholder={ar ? "البريد الإلكتروني" : "Email address"}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              maxLength={254}
              dir="ltr"
            />
            <input
              className={inputCls}
              placeholder={ar ? "الهاتف (اختياري)" : "Phone (optional)"}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              maxLength={40}
              dir="ltr"
            />

            {/* Garantie du service — rassure avant le paiement via la passerelle */}
            <PaymentGuarantee variant="compact" />
            <button
              type="submit"
              className="h-12 w-full rounded-full bg-[var(--accent)] font-black text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] transition-colors cursor-pointer inline-flex items-center justify-center gap-2"
            >
              <CalendarCheck className="h-4 w-4" />
              {`${ar ? "احجز مكاني الآن" : "Reserve my slot now"} — $${formatUsd(
                depositUsd,
              )}`}
            </button>
            <p className="flex items-center justify-center gap-1.5 text-center text-[11px] opacity-50">
              <ShieldCheck className="h-3.5 w-3.5" />
              {ar
                ? "دفع آمن عبر NOWPayments — لن نخزن أي بيانات دفع"
                : "Secure payment via NOWPayments — we never store payment data"}
            </p>
          </form>
        )}

        {step === "creating" && (
          <div className="mt-8 flex flex-col items-center gap-3 py-6">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
            <p className="text-sm opacity-70">
              {ar ? "جارٍ إنشاء حجزك…" : "Creating your reservation…"}
            </p>
          </div>
        )}

        {step === "ready" && payment && (
          <div className="mt-5 space-y-4">
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <BadgeCheck className="mt-0.5 h-5 w-5 text-emerald-400 flex-shrink-0" />
              <p className="text-sm font-semibold text-emerald-300">
                {ar
                  ? "تم إنشاء عربون الحجز. إعادة التوجيه خلال"
                  : "Reservation deposit created. Redirecting in"}{" "}
                <strong>{countdown}</strong>
              </p>
            </div>

            {payment.orderRef && (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] px-4 py-3 text-sm">
                <span className="opacity-60">
                  {ar ? "مرجع الحجز" : "Reservation reference"}
                </span>
                <strong dir="ltr">{payment.orderRef}</strong>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                if (payment.paymentUrl) window.location.href = payment.paymentUrl;
              }}
              className="h-12 w-full rounded-full bg-[var(--accent)] font-black text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
            >
              {ar ? "فتح صفحة الدفع الآن" : "Open payment page now"}
            </button>

            <p className="text-[11px] opacity-50 leading-relaxed">
              {ar
                ? "بعد تأكيد الدفع، تُحجز لك أولوية في جدولنا ويُخصم العربون من سعر المشروع. سنتواصل معك خلال ساعتين."
                : "Once the payment is confirmed, your priority slot is reserved and the deposit is deducted from the project price. We'll contact you within 2 hours."}
            </p>
          </div>
        )}

        {step === "error" && (
          <div className="mt-6 space-y-4 text-center">
            <p className="text-sm font-semibold text-red-300">
              {ar ? "تعذر إنشاء الحجز" : "Reservation could not be created"}
            </p>
            <p className="text-xs opacity-80 leading-relaxed">{failureHint()}</p>

            {failure && (failure.status != null || failure.message) && (
              <div
                dir="ltr"
                className="rounded-xl border border-red-400/30 bg-black/40 p-3 text-left"
              >
                <p className="text-[10px] uppercase tracking-wider opacity-60">
                  {ar ? "تفاصيل تقنية" : "Technical details"}
                </p>
                <p className="mt-1 font-mono text-[11px] text-red-200 break-all">
                  {failure.code}
                  {failure.status != null ? ` · HTTP ${failure.status}` : ""}
                </p>
                {failure.message && (
                  <p className="mt-1 font-mono text-[10px] opacity-70 break-all">
                    {failure.message}
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="h-11 rounded-full bg-[#25D366] text-white font-bold text-sm inline-flex items-center justify-center gap-2"
              >
                <MessageCircle className="h-4 w-4" />
                {ar ? "احجز عبر واتساب" : "Reserve via WhatsApp"}
              </a>
              <div className="flex gap-2 justify-center">
                <button
                  type="button"
                  onClick={() => setStep("form")}
                  className="h-11 px-6 rounded-full bg-[var(--accent)] font-bold text-sm text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
                >
                  {ar ? "إعادة المحاولة" : "Retry"}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="h-11 px-6 rounded-full border border-[var(--border)] font-bold text-sm opacity-70 hover:opacity-100 transition cursor-pointer"
                >
                  {ar ? "إغلاق" : "Close"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}

/**
 * Bouton d'ouverture du dialogue de réservation, avec la classification
 * et le prix du site. Utilisé sur les cartes de la galerie, la fiche
 * d'un site et la visionneuse plein écran.
 */
export function ReservationButton({
  demo,
  className,
  label,
  hideWhenDisabled = true,
}: {
  demo: Demo;
  className?: string;
  label?: string;
  hideWhenDisabled?: boolean;
}) {
  const config = useSiteConfig();
  const { locale } = useI18n();
  const ar = locale === "ar";
  const [open, setOpen] = useState(false);

  if (hideWhenDisabled && !config.reservation?.enabled) return null;

  const depositUsd = config.reservation?.depositUsd ?? 1;
  const text =
    label ??
    (ar
      ? `احجز مكانك — ${formatUsd(depositUsd)} $`
      : `Reserve your slot — $${formatUsd(depositUsd)}`);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "h-10 px-4 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] text-xs font-black inline-flex items-center justify-center gap-1.5 hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
        }
      >
        <CalendarCheck className="h-3.5 w-3.5" />
        {text}
      </button>
      {open && <ReservationDialog demo={demo} onClose={() => setOpen(false)} />}
    </>
  );
}
