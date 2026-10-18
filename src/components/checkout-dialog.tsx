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

interface CreatePaymentResponse {
  ok: boolean;
  error?: string;
  orderRef?: string;
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
                <span className="text-sm opacity-70">
                  {plan.price.toLocaleString("en-LY")} {ar ? siteConfig.pricing.currency : siteConfig.pricing.currencyEn}
                </span>
              </div>
              <div className="mt-1 text-xs opacity-60">
                ≈ ${plan.priceUsd} {ar ? "— تُحوَّل تلقائياً للعملة الرقمية" : "— auto-converted to crypto"}
              </div>
            </div>

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
