"use client";

import { useEffect, useState } from "react";
import {
  BadgeCheck,
  Bitcoin,
  Copy,
  Loader2,
  X,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { siteConfig, type PricingPlan } from "@/lib/config";
import {
  formatUsd,
  INSTALLMENT_COUNTS,
  splitAmount,
  type InstallmentCount,
} from "@/lib/installments";

interface CreatePaymentResponse {
  ok: boolean;
  error?: string;
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

type Step = "form" | "creating" | "ready" | "error";

/**
 * Dialogue de paiement crypto (NOWPayments).
 * S'ouvre depuis les cartes tarifaires : le client laisse
 * son e-mail, puis est redirigé vers la page de paiement
 * hébergée par NOWPayments.
 */
export function CheckoutDialog({
  plan,
  onClose,
}: {
  plan: PricingPlan | null;
  onClose: () => void;
}) {
  const { locale, t } = useI18n();
  const ar = locale === "ar";
  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [installments, setInstallments] = useState<InstallmentCount>(1);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(3);
  const [payment, setPayment] = useState<CreatePaymentResponse | null>(null);
  const [copied, setCopied] = useState<"address" | "amount" | null>(null);

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
    if (!plan) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [plan, onClose]);

  if (!plan || !plan.priceUsd) return null;

  const totalUsd = plan.priceUsd;
  const trancheAmounts = splitAmount(totalUsd, installments);
  const dueNow = trancheAmounts[0] ?? totalUsd;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) {
      setError(ar ? "البريد الإلكتروني مطلوب" : "Email required");
      return;
    }
    setStep("creating");
    setError("");
    try {
      const res = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.id,
          installments,
          name: name.trim() || undefined,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          locale,
        }),
      });
      const data: CreatePaymentResponse = await res.json();
      if (!res.ok || !data.ok || !data.paymentUrl) {
        setStep("error");
        return;
      }
      setPayment(data);
      setCountdown(3);
      setStep("ready");
    } catch {
      setStep("error");
    }
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
                  {ar ? plan.name : plan.nameEn}
                </span>
                <span className="text-xs opacity-60">
                  {plan.price.toLocaleString("en-LY")} {ar ? siteConfig.pricing.currency : siteConfig.pricing.currencyEn}
                </span>
              </div>
              <div className="mt-1.5 flex items-baseline justify-between gap-2">
                <span className="text-2xl font-black text-[var(--accent)]" dir="ltr">
                  ${formatUsd(totalUsd)}
                </span>
                <span className="text-[11px] opacity-50">
                  {ar ? t.checkout.totalUsdAr : t.checkout.totalUsdEn}
                </span>
              </div>
            </div>

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
