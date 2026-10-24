"use client";

import { useEffect, useState } from "react";
import {
  BadgeCheck,
  Bitcoin,
  BookOpen,
  Copy,
  Loader2,
  X,
} from "lucide-react";
import Link from "next/link";
import { CRYPTO_GUIDE_PATH } from "@/lib/blog";
import { useI18n } from "@/lib/i18n";
import { useSiteConfig } from "@/components/site-provider";
import {
  resolveDemoClassification,
  resolvePlanPriceBreakdown,
  type ClassificationPlan,
} from "@/lib/classification";
import { Price } from "@/components/price";
import { useCurrency } from "@/components/currency-provider";
import type { Demo } from "@/lib/site-types";
import {
  formatMainPrice,
  formatUsd,
  INSTALLMENT_COUNTS,
  splitAmount,
  type InstallmentCount,
} from "@/lib/installments";
import { PaymentGuarantee } from "@/components/payment-guarantee";

interface CreatePaymentResponse {
  ok: boolean;
  error?: string;
  /** Cause exacte remontée par le serveur (diagnostic). */
  detail?: {
    source?: string;
    status?: number | null;
    message?: string;
  };
  orderRef?: string;
  installments?: number;
  installmentIndex?: number;
  trancheAmountUsd?: number;
  paymentUrl?: string;
  payAddress?: string;
  payCurrency?: string;
  payAmount?: number;
  priceAmount?: number;
  priceCurrency?: string;
}

/** Échec de création, avec la cause exacte pour l'afficher au client. */
interface Failure {
  code: string;
  status: number | null;
  message: string;
}

type Step = "form" | "creating" | "ready" | "error";

/** Paiement flexible « 1 $ ou plus » : montant choisi par le client. */
export interface FlexPaymentIntent {
  /** Montant en USD (1 $ minimum — borné serveur). */
  amountUsd: number;
  /** Description libre (acompte, solde, soutien…). */
  purpose?: string;
}

/**
 * Dialogue de paiement crypto (NOWPayments).
 * S'ouvre depuis les cartes tarifaires (mode formule) ou depuis la
 * section « paiement flexible » (mode montant libre) : le client laisse
 * son e-mail, puis est redirigé vers la page de paiement
 * hébergée par NOWPayments.
 */
export function CheckoutDialog({
  plan,
  demo,
  flex,
  onClose,
}: {
  plan?: ClassificationPlan | null;
  demo?: Demo | null;
  flex?: FlexPaymentIntent | null;
  onClose: () => void;
}) {
  const config = useSiteConfig();
  const { locale, t } = useI18n();
  const { currency, format } = useCurrency();
  const ar = locale === "ar";
  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [installments, setInstallments] = useState<InstallmentCount>(1);
  const [error, setError] = useState("");
  const [failure, setFailure] = useState<Failure | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [payment, setPayment] = useState<CreatePaymentResponse | null>(null);
  const [copied, setCopied] = useState<"address" | "amount" | null>(null);
  // Source unique : le montant choisi dans la section, jamais modifiable ici.
  const flexAmount = Math.round((Number(flex?.amountUsd) || 0) * 100) / 100;

  // Compte à rebours avant redirection vers NOWPayments.
  useEffect(() => {
    if (step !== "ready" || !payment?.paymentUrl) return;
    if (countdown <= 0) {
      window.location.href = payment.paymentUrl;
      return;
    }
    const timer = setTimeout(() => setCountdown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [step, countdown, payment]);

  // Échap pour fermer.
  useEffect(() => {
    if (!plan && !flex) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [plan, flex, onClose]);

  const flexMode = Boolean(flex && !plan);
  const demoClassification = demo
    ? resolveDemoClassification(demo, config.pricing.plans)
    : null;
  const planBreakdown = plan
    ? resolvePlanPriceBreakdown(
        plan,
        demoClassification?.priceUsd ?? plan.priceUsd,
      )
    : null;

  if (flexMode) {
    if (!Number.isFinite(flexAmount) || flexAmount <= 0) return null;
  } else if (!plan || planBreakdown?.totalPriceUsd == null) return null;

  // Total en USD — devise unique du site, payable au même montant en
  // USDT (1 USD = 1 USDT). Le serveur recalcule toujours le prix final.
  const totalUsd = flexMode ? flexAmount : planBreakdown!.totalPriceUsd!;
  const planPriceUsd: number | null = plan ? totalUsd : null;
  // En mode montant libre : paiement unique (les micro-tranches
  // tomberaient sous les minimums imposés par les réseaux crypto).
  const trancheAmounts = flexMode
    ? [totalUsd]
    : splitAmount(totalUsd, installments);
  const dueNow = trancheAmounts[0] ?? totalUsd;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) {
      setError(ar ? "البريد الإلكتروني مطلوب" : "Email required");
      return;
    }
    setStep("creating");
    setError("");
    setFailure(null);
    try {
      const res = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          flexMode
            ? {
                kind: "flex",
                amountUsd: flexAmount,
                description: flex?.purpose?.trim() || undefined,
                name: name.trim() || undefined,
                email: email.trim() || undefined,
                phone: phone.trim() || undefined,
                locale,
              }
            : {
                planId: plan!.id,
                demoSlug: demo?.slug,
                installments,
                name: name.trim() || undefined,
                email: email.trim() || undefined,
                phone: phone.trim() || undefined,
                locale,
              },
        ),
      });
      const data: CreatePaymentResponse = await res
        .json()
        .catch(() => ({ ok: false }) as CreatePaymentResponse);
      if (!res.ok || !data.ok || !data.paymentUrl) {
        // Cause exacte : code serveur + détail (statut/message NOWPayments).
        setFailure({
          code: data.error ?? `http_${res.status}`,
          status: data.detail?.status ?? res.status,
          message: data.detail?.message ?? "",
        });
        setStep("error");
        return;
      }
      setPayment(data);
      setCountdown(3);
      setStep("ready");
    } catch (err) {
      setFailure({
        code: "network_error",
        status: null,
        message: err instanceof Error ? err.message : String(err),
      });
      setStep("error");
    }
  };

  /** Conseil bilingue selon la cause exacte de l'échec. */
  const failureHint = (): string => {
    const code = failure?.code ?? "";
    const status = failure?.status ?? null;
    if (code === "gateway_not_configured")
      return ar ? t.checkout.hintKeyAr : t.checkout.hintKeyEn;
    if (code === "gateway_error" && (status === 401 || status === 403))
      return ar ? t.checkout.hintKeyRejectedAr : t.checkout.hintKeyRejectedEn;
    if (code === "gateway_error")
      return status === null
        ? ar
          ? t.checkout.hintNetworkAr
          : t.checkout.hintNetworkEn
        : ar
          ? t.checkout.hintGatewayAr
          : t.checkout.hintGatewayEn;
    if (code === "save_failed") return ar ? t.checkout.hintDbAr : t.checkout.hintDbEn;
    if (code === "network_error")
      return ar ? t.checkout.hintNetworkAr : t.checkout.hintNetworkEn;
    if (code === "order_not_found" || code === "order_already_paid")
      return ar ? t.checkout.hintOrderAr : t.checkout.hintOrderEn;
    if (code === "plan_not_payable" || code === "customization_quote_required")
      return ar ? t.checkout.hintPlanAr : t.checkout.hintPlanEn;
    return ar ? t.checkout.hintGenericAr : t.checkout.hintGenericEn;
  };

  const copy = async (value: string, key: "address" | "amount") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      /* presse-papiers indisponible — sélection manuelle */
    }
  };

  const inputCls =
    "w-full h-11 px-4 rounded-xl border border-[var(--border)] bg-black/30 text-sm outline-none focus:border-[var(--accent)] transition-colors";

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/75 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      dir={ar ? "rtl" : "ltr"}
    >
      <div
        className="w-full max-w-md rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--accent)] text-[var(--accent-foreground)]">
              <Bitcoin className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-black">
                {ar
                  ? t.checkout.titleAr
                  : t.checkout.titleEn}
              </h2>
              <p className="text-xs opacity-60">
                {ar
                  ? t.checkout.subtitleAr
                  : t.checkout.subtitleEn}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full opacity-60 hover:opacity-100 cursor-pointer"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {step === "form" && (
          <form onSubmit={submit} className="mt-5 space-y-3">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--secondary)]/40 p-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-bold text-sm">
                  {flexMode
                    ? flex?.purpose?.trim() ||
                      (ar ? "دفع حر" : "Flexible payment")
                    : demo
                      ? (ar ? demo.title : demo.titleEn)
                      : ar
                        ? plan!.name
                        : plan!.nameEn}
                </span>
                {flexMode && (
              <p className="text-xs opacity-70">
                {ar
                  ? "المبلغ المختار ثابت في هذا الدفع. لتغييره، أغلق هذه النافذة وارجع لاختيار المبلغ."
                  : "Your selected amount is locked for this checkout. To change it, close this window and return to amount selection."}
              </p>
            )}

            {!flexMode && planPriceUsd != null && (
                  <span className="text-xs opacity-60">
                    <Price usd={planPriceUsd} />
                    {" · = "}
                    {ar ? "يُدفع بـ USDT" : "payable in USDT"}
                  </span>
                )}
              </div>
              {!flexMode && planBreakdown && (
                <div className="mt-2 border-t border-[var(--border)]/70 pt-2 space-y-1 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <span className="opacity-60">{ar ? "سعر النموذج" : "Website model"}</span>
                    <strong>
                      <Price usd={planBreakdown.modelPriceUsd ?? 0} />
                    </strong>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="opacity-60">
                      {planBreakdown.customizationPercent == null
                        ? (ar ? "تكلفة التخصيص" : "Customization")
                        : ar
                          ? `التخصيص (${planBreakdown.customizationPercent}٪)`
                          : `Customization (${planBreakdown.customizationPercent}%)`}
                    </span>
                    <strong>
                      <Price usd={planBreakdown.customizationUsd ?? 0} />
                    </strong>
                  </div>
                </div>
              )}
              <div className="mt-1.5 flex items-baseline justify-between gap-2">
                <span className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-[var(--accent)]" dir="ltr">
                    ${formatUsd(totalUsd)}
                  </span>
                </span>
                <span className="text-[11px] opacity-50">
                  {ar ? t.checkout.totalUsdAr : t.checkout.totalUsdEn}
                </span>
              </div>
              {currency !== "USD" && (
                <div className="mt-0.5 text-end text-[11px] opacity-55" dir="ltr">
                  ≈ {format(totalUsd)}
                </div>
              )}
            </div>

            {!flexMode && (
            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider opacity-50">
                {ar ? t.checkout.modeAr : t.checkout.modeEn}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {INSTALLMENT_COUNTS.map((count) => {
                  const per = splitAmount(totalUsd, count)[0] ?? totalUsd;
                  const active = installments === count;
                  return (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setInstallments(count)}
                      aria-pressed={active}
                      className={`rounded-xl border px-2 py-2.5 text-center transition-colors cursor-pointer ${
                        active
                          ? "border-[var(--accent)] bg-[var(--accent)]/15"
                          : "border-[var(--border)] hover:border-[var(--accent)]/60"
                      }`}
                    >
                      <span
                        className={`block text-sm font-black ${active ? "text-[var(--accent)]" : ""}`}
                        dir="ltr"
                      >
                        {count === 1
                          ? `$${formatUsd(totalUsd)}`
                          : `${count} × $${formatUsd(per)}`}
                      </span>
                      <span className="mt-0.5 block text-[10px] opacity-60">
                        {count === 1
                          ? ar
                            ? t.checkout.fullAr
                            : t.checkout.fullEn
                          : ar
                            ? t.checkout.tranchesAr
                            : t.checkout.tranchesEn}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            )}

            <div className="flex items-center justify-between rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/30 px-3 py-2 text-sm">
              <span className="opacity-70">
                {ar ? t.checkout.dueTodayAr : t.checkout.dueTodayEn}
              </span>
              <strong className="text-[var(--accent)]" dir="ltr">
                ${formatUsd(dueNow)}
              </strong>
            </div>
            {installments > 1 && (
              <p className="text-[11px] opacity-50 -mt-1 leading-relaxed">
                {ar ? t.checkout.trancheNoteAr : t.checkout.trancheNoteEn}
              </p>
            )}

            <input
              className={inputCls}
              placeholder={ar ? t.checkout.nameAr : t.checkout.nameEn}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              dir={ar ? "rtl" : "ltr"}
            />
            <input
              className={inputCls}
              type="email"
              required
              placeholder={ar ? t.checkout.emailAr : t.checkout.emailEn}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={254}
              dir="ltr"
            />
            <p className="text-[11px] opacity-50 -mt-1.5">
              {ar ? t.checkout.emailHintAr : t.checkout.emailHintEn}
            </p>
            <input
              className={inputCls}
              placeholder={ar ? t.checkout.phoneAr : t.checkout.phoneEn}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={40}
              dir="ltr"
            />

            {error && (
              <p className="text-xs font-semibold text-red-400">{error}</p>
            )}

            {/* Garantie du service — rassure avant le paiement via la passerelle */}
            <PaymentGuarantee />

            <button
              type="submit"
              className="h-12 w-full rounded-full bg-[var(--accent)] font-black text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] transition-colors cursor-pointer inline-flex items-center justify-center gap-2"
            >
              <Bitcoin className="h-4 w-4" />
              {ar ? t.checkout.continueAr : t.checkout.continueEn}
              {" — "}${formatUsd(dueNow)}
            </button>
            <p className="text-center text-[11px] opacity-50">
              {ar ? t.checkout.secureAr : t.checkout.secureEn}
            </p>
            <p className="text-center">
              <Link
                href={CRYPTO_GUIDE_PATH}
                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[var(--accent)] underline-offset-4 hover:underline"
              >
                <BookOpen className="h-3.5 w-3.5" />
                {ar
                  ? "أول مرة تدفع بالكريبتو؟ دليل USDT المصوّر خطوة بخطوة"
                  : "First crypto payment? Read the step-by-step USDT photo guide"}
              </Link>
            </p>
          </form>
        )}

        {step === "creating" && (
          <div className="mt-8 flex flex-col items-center gap-3 py-6">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
            <p className="text-sm opacity-70">
              {ar ? t.checkout.creatingAr : t.checkout.creatingEn}
            </p>
          </div>
        )}

        {step === "ready" && payment && (
          <div className="mt-5 space-y-4">
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <BadgeCheck className="mt-0.5 h-5 w-5 text-emerald-400 flex-shrink-0" />
              <p className="text-sm font-semibold text-emerald-300">
                {ar ? t.checkout.readyAr : t.checkout.readyEn}{" "}
                <strong>{countdown}</strong>
              </p>
            </div>

            {payment.installments != null && payment.installments > 1 && (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] px-4 py-3 text-sm">
                <span className="opacity-60">
                  {ar ? t.checkout.trancheAr : t.checkout.trancheEn}
                </span>
                <strong dir="ltr">
                  {payment.installmentIndex ?? 1}/{payment.installments}
                  {" — "}${formatUsd(payment.trancheAmountUsd ?? dueNow)}
                </strong>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                if (payment.paymentUrl) window.location.href = payment.paymentUrl;
              }}
              className="h-12 w-full rounded-full bg-[var(--accent)] font-black text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
            >
              {ar ? t.checkout.openAr : t.checkout.openEn}
            </button>

            {payment.payAddress && (
              <div className="rounded-2xl border border-[var(--border)] p-4 space-y-3 text-sm">
                <p className="text-xs opacity-50">
                  {ar ? t.checkout.manualAr : t.checkout.manualEn}
                </p>
                <div>
                  <div className="text-[11px] opacity-50 mb-1">
                    {ar ? t.checkout.amountDueAr : t.checkout.amountDueEn}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-sm font-bold" dir="ltr">
                      {payment.payAmount} {payment.payCurrency?.toUpperCase()}
                    </code>
                    <button
                      type="button"
                      onClick={() =>
                        payment.payAmount &&
                        copy(String(payment.payAmount), "amount")
                      }
                      className="text-xs opacity-70 hover:opacity-100 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="h-3 w-3" />
                      {copied === "amount"
                        ? ar
                          ? t.checkout.copiedAr
                          : t.checkout.copiedEn
                        : ar
                          ? t.checkout.copyAr
                          : t.checkout.copyEn}
                    </button>
                  </div>
                </div>
                <div>
                  <div className="text-[11px] opacity-50 mb-1">
                    {ar ? t.checkout.payToAr : t.checkout.payToEn}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-xs break-all opacity-80" dir="ltr">
                      {payment.payAddress}
                    </code>
                    <button
                      type="button"
                      onClick={() => copy(payment.payAddress ?? "", "address")}
                      className="text-xs opacity-70 hover:opacity-100 inline-flex items-center gap-1 flex-shrink-0 cursor-pointer"
                    >
                      <Copy className="h-3 w-3" />
                      {copied === "address"
                        ? ar
                          ? t.checkout.copiedAr
                          : t.checkout.copiedEn
                        : ar
                          ? t.checkout.copyAr
                          : t.checkout.copyEn}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <p className="text-[11px] opacity-50 leading-relaxed">
              {ar ? t.checkout.waitNoteAr : t.checkout.waitNoteEn}
            </p>
          </div>
        )}

        {step === "error" && (
          <div className="mt-6 space-y-4 text-center">
            <p className="text-sm text-red-300 font-semibold">
              {ar ? t.checkout.errorAr : t.checkout.errorEn}
            </p>
            <p className="text-xs opacity-80 leading-relaxed">{failureHint()}</p>

            {flexMode && (
              <div className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-4 space-y-3">
                <p className="text-xs font-bold" dir="ltr">
                  ${formatUsd(flexAmount)} USD
                </p>
                <p className="text-[11px] opacity-70">
                  {ar
                    ? "المبلغ المختار ثابت. إذا كانت العملة تتطلب حداً أدنى أعلى، ارجع لاختيار مبلغ جديد قبل إعادة الدفع. لا ترسل مبلغاً مختلفاً عن الفاتورة."
                    : "Your selected amount is locked. If a coin requires a higher minimum, go back and select a new amount before paying again. Do not send a different amount from the invoice."}
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="h-9 px-4 rounded-full border border-[var(--accent)]/50 text-xs font-bold hover:bg-[var(--accent)]/10 cursor-pointer"
                >
                  {ar ? "العودة لاختيار المبلغ" : "Back to amount selection"}
                </button>
              </div>
            )}

            {failure && (
              <div
                dir="ltr"
                className="rounded-xl border border-red-400/30 bg-black/40 p-3 text-left"
              >
                <p className="text-[10px] uppercase tracking-wider opacity-60">
                  {ar ? t.checkout.diagTitleAr : t.checkout.diagTitleEn}
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

            <a
              href="/api/health"
              target="_blank"
              rel="noreferrer"
              className="inline-block text-xs font-semibold underline opacity-80 hover:opacity-100"
            >
              {ar ? t.checkout.healthLinkAr : t.checkout.healthLinkEn}
            </a>

            <div className="flex gap-2 justify-center">
              <button
                type="button"
                onClick={() => setStep("form")}
                className="h-11 px-6 rounded-full bg-[var(--accent)] font-bold text-sm text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
              >
                {ar ? t.checkout.retryAr : t.checkout.retryEn}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="h-11 px-6 rounded-full border border-[var(--border)] font-bold text-sm opacity-70 hover:opacity-100 transition cursor-pointer"
              >
                {ar ? t.checkout.closeAr : t.checkout.closeEn}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
