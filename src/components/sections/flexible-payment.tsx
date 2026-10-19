"use client";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Bitcoin, PencilLine, ShieldCheck, SlidersHorizontal, TriangleAlert } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSiteConfig } from "@/components/site-provider";
import { CheckoutDialog } from "@/components/checkout-dialog";
import { PaymentGuarantee } from "@/components/payment-guarantee";
import { formatUsd } from "@/lib/installments";

/**
 * Paiement flexible « 1 $ ou plus ».
 *
 * Le client choisit lui-même le montant (à partir de 1 $) — utile pour
 * un acompte, un solde, un soutien… et surtout pour contourner les
 * limites minimales imposées par certaines plateformes de crypto :
 * si une pièce refuse un montant trop bas, il suffit d'augmenter le
 * montant et de réessayer.
 */
export function FlexiblePayment() {
  const siteConfig = useSiteConfig();
  const { locale, t } = useI18n();
  const ar = locale === "ar";

  const flex = siteConfig.flexiblePayment;
  const minUsd = flex.minUsd ?? 1;
  const maxUsd = flex.maxUsd ?? 5000;
  const suggested = useMemo(
    () => [...flex.suggested].sort((a, b) => a - b),
    [flex.suggested],
  );

  const [amount, setAmount] = useState<number>(suggested[0] ?? minUsd);
  const [purpose, setPurpose] = useState("");
  const [error, setError] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const applyAmount = (value: number) => {
    setAmount(value);
    setError("");
  };

  const onCustomChange = (raw: string) => {
    const cleaned = raw.replace(/[^\d.]/g, "");
    const value = Number(cleaned);
    if (cleaned === "" || !Number.isFinite(value)) {
      setAmount(0);
      setError("");
      return;
    }
    setAmount(value);
    setError("");
  };

  const startPayment = () => {
    if (!Number.isFinite(amount) || amount < minUsd) {
      setError(ar ? t.flexPay.minErrAr : t.flexPay.minErrEn);
      return;
    }
    if (amount > maxUsd) {
      setError(ar ? t.flexPay.maxErrAr : t.flexPay.maxErrEn);
      return;
    }
    setError("");
    setCheckoutOpen(true);
  };

  if (!flex.enabled) return null;

  return (
    <section id="flex-pay" className="py-16 lg:py-24">
      <div className="site-container px-4 sm:px-6 lg:px-8">
        <div className="max-w-[760px] mx-auto text-center">
          <div className="inline-flex items-center gap-2 text-sm font-semibold tracking-[0.12em] text-[var(--accent)]">
            <span className="h-px w-8 bg-[var(--accent)]" />
            {ar ? "دفع حر" : "FLEXIBLE PAYMENT"}
            <span className="h-px w-8 bg-[var(--accent)]" />
          </div>
          <h2 className="mt-3 text-[30px] lg:text-[42px] font-black tracking-tight leading-none">
            {ar ? t.flexPay.titleAr : t.flexPay.titleEn}
          </h2>
          <p className="mt-3 opacity-60">
            {ar ? t.flexPay.subtitleAr : t.flexPay.subtitleEn}
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mt-10 max-w-[640px] mx-auto rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-6 lg:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.08)]"
        >
          {/* Montant rapide */}
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider opacity-50">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {ar ? t.flexPay.quickAr : t.flexPay.quickEn}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {suggested.map((value) => {
              const active = amount === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => applyAmount(value)}
                  aria-pressed={active}
                  className={`h-10 px-4 rounded-full text-sm font-black transition-colors cursor-pointer border ${
                    active
                      ? "bg-[var(--accent)] text-[var(--accent-foreground)] border-[var(--accent)]"
                      : "bg-[var(--secondary)]/60 border-[var(--border)] hover:border-[var(--accent)]/60"
                  }`}
                  dir="ltr"
                >
                  ${formatUsd(value)}
                </button>
              );
            })}
          </div>

          {/* Montant personnalisé */}
          <div className="mt-5">
            <label
              htmlFor="flex-amount"
              className="block text-[11px] font-bold uppercase tracking-wider opacity-50 mb-1.5"
            >
              {ar ? t.flexPay.customAr : t.flexPay.customEn}
            </label>
            <div
              className={`flex items-center gap-2 h-12 rounded-xl border bg-[var(--secondary)]/40 px-4 transition-colors ${
                error
                  ? "border-red-400/70"
                  : "border-[var(--border)] focus-within:border-[var(--accent)]"
              }`}
            >
              <span className="text-lg font-black opacity-40" dir="ltr">
                $
              </span>
              <input
                id="flex-amount"
                type="text"
                inputMode="decimal"
                value={amount > 0 ? String(amount) : ""}
                onChange={(e) => onCustomChange(e.target.value)}
                onBlur={() => {
                  if (amount && (amount < minUsd || amount > maxUsd)) {
                    setError(
                      amount < minUsd
                        ? ar
                          ? t.flexPay.minErrAr
                          : t.flexPay.minErrEn
                        : ar
                          ? t.flexPay.maxErrAr
                          : t.flexPay.maxErrEn,
                    );
                  }
                }}
                placeholder={formatUsd(minUsd)}
                className="w-full bg-transparent text-xl font-black outline-none"
                dir="ltr"
              />
              <span className="text-xs opacity-50 whitespace-nowrap">
                USD
              </span>
            </div>
            {error && (
              <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1.5">
                <TriangleAlert className="h-3.5 w-3.5" />
                {error}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="mt-4">
            <label
              htmlFor="flex-purpose"
              className="block text-[11px] font-bold uppercase tracking-wider opacity-50 mb-1.5"
            >
              {ar ? t.flexPay.purposeAr : t.flexPay.purposeEn}
            </label>
            <div className="flex items-center gap-2 h-12 rounded-xl border border-[var(--border)] bg-[var(--secondary)]/40 px-4 focus-within:border-[var(--accent)] transition-colors">
              <PencilLine className="h-4 w-4 opacity-40 flex-shrink-0" />
              <input
                id="flex-purpose"
                type="text"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                maxLength={120}
                placeholder={ar ? t.flexPay.purposeHintAr : t.flexPay.purposeHintEn}
                className="w-full bg-transparent text-sm outline-none"
                dir={ar ? "rtl" : "ltr"}
              />
            </div>
          </div>

          {/* Note limites crypto */}
          <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-4">
            <TriangleAlert className="h-4 w-4 text-[var(--accent)] flex-shrink-0 mt-0.5" />
            <p className="text-xs leading-6 opacity-70">
              {ar ? flex.noteAr : flex.noteEn}
            </p>
          </div>

          {/* CTA */}
          <button
            type="button"
            onClick={startPayment}
            className="mt-5 h-13 w-full rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] font-black text-[15px] inline-flex items-center justify-center gap-2 hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
          >
            <Bitcoin className="h-4.5 w-4.5" />
            {ar ? t.flexPay.payAr : t.flexPay.payEn}
            {amount > 0 && (
              <span dir="ltr">— ${formatUsd(amount)}</span>
            )}
          </button>

          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] opacity-50">
            <ShieldCheck className="h-3.5 w-3.5" />
            {ar ? t.flexPay.secureAr : t.flexPay.secureEn}
          </p>

          {/* Garantie du service — rassure avant le paiement via la passerelle */}
          <PaymentGuarantee variant="compact" className="mt-4" />
        </motion.div>
      </div>

      {checkoutOpen && (
        <CheckoutDialog
          flex={{ amountUsd: amount, purpose: purpose.trim() || undefined }}
          onClose={() => setCheckoutOpen(false)}
        />
      )}
    </section>
  );
}
