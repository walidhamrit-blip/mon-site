"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Info } from "lucide-react";
import {
  MANUAL_PAYMENT_METHOD_KIND,
  MANUAL_PAYMENT_METHOD_LABELS,
  calculateManualPaymentQuote,
  formatManualPaymentAmount,
  isCryptoManualPaymentMethod,
  isDollarPeggedManualCurrency,
  type ManualPaymentCurrency,
  type ManualPaymentMethod,
  type ManualPaymentQuote,
} from "@/lib/manual-payment-core";
import type { PublicManualPaymentOption } from "@/lib/manual-payment-public";
import { CryptoQrCode } from "@/components/crypto-qr-code";

/**
 * Champs de preuve de paiement pour un virement manuel
 * (Binance Pay, OKX, Bybit, RedotPay, USDT direct, Skrill, Neteller, Airtm, D17, Volet, WebMoney et Kashy).
 *
 * Rendu partagé par les trois tunnels (boutique de codes, création de sites,
 * abonnements) : la consigne, le montant exact et les trois champs sont donc
 * identiques partout. Le composant est purement présentationnel — aucun
 * calcul n'y fait autorité, le serveur recalcule le devis et valide l'entrée.
 */
export interface ManualPaymentDraft {
  method: ManualPaymentMethod;
  senderName: string;
  senderAccount: string;
  transactionRef: string;
  note: string;
}

export const EMPTY_MANUAL_PAYMENT_DRAFT: ManualPaymentDraft = {
  method: "skrill",
  senderName: "",
  senderAccount: "",
  transactionRef: "",
  note: "",
};

export function manualQuoteForOption(
  option: PublicManualPaymentOption,
  amountUsd: number,
): ManualPaymentQuote | null {
  return calculateManualPaymentQuote(amountUsd, option.method, {
    account: option.account,
    beneficiary: option.beneficiary,
    currency: option.currency,
    rate: option.rate,
    feePercent: option.feePercent,
  });
}

const INPUT_CLS =
  "h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--accent)]";
const LABEL_CLS =
  "mb-1 block text-[11px] font-bold uppercase tracking-wide text-[var(--muted-foreground)]";

export function ManualPaymentForm({
  options,
  amountUsd,
  draft,
  onDraftChange,
  quoteAccepted,
  onQuoteAcceptedChange,
  locale,
}: {
  options: PublicManualPaymentOption[];
  amountUsd: number;
  draft: ManualPaymentDraft;
  onDraftChange: (next: ManualPaymentDraft) => void;
  quoteAccepted: boolean;
  onQuoteAcceptedChange: (accepted: boolean) => void;
  locale: "ar" | "en";
}) {
  const ar = locale === "ar";
  const [copied, setCopied] = useState(false);
  const option = useMemo(
    () => options.find((item) => item.method === draft.method) ?? options[0] ?? null,
    [options, draft.method],
  );
  const quote = option ? manualQuoteForOption(option, amountUsd) : null;

  if (!option) return null;

  const isCrypto = isCryptoManualPaymentMethod(option.method);
  const isCryptoDirect = option.method.startsWith("usdt_");
  const isCryptoPayId =
    option.method === "binance_pay" ||
    option.method === "okx_pay" ||
    option.method === "bybit_pay" ||
    option.method === "redotpay";
  const methodKind = MANUAL_PAYMENT_METHOD_KIND[option.method];

  const senderAccountLabel = isCryptoDirect
    ? ar
      ? "عنوان المحفظة المُرسِلة *"
      : "Sender wallet address *"
    : isCryptoPayId
      ? ar
        ? "معرّف حساب المُرسِل (UID / Pay ID / البريد) *"
        : "Sender ID (UID / Pay ID / Email) *"
      : ar
        ? "حساب المُرسِل *"
        : "Sender account *";

  const senderAccountPlaceholder = isCryptoDirect
    ? "0x... / T... / UQ..."
    : isCryptoPayId
      ? ar
        ? "UID أو Pay ID أو البريد"
        : "UID, Pay ID or email"
      : methodKind === "phone"
        ? ar
          ? "رقم الهاتف"
          : "Phone number"
        : ar
          ? "بريد أو محفظة أو هاتف"
          : "E-mail, wallet or phone";

  const txRefLabel = isCryptoDirect
    ? ar
      ? "هاش المعاملة (TxHash / TxID) *"
      : "Transaction hash (TxHash) *"
    : isCryptoPayId
      ? ar
        ? "معرّف العملية (Order ID / TxID) *"
        : "Order ID / Transaction reference *"
      : ar
        ? "معرّف العملية (المرجع) *"
        : "Transaction ID / reference *";

  const set = (patch: Partial<ManualPaymentDraft>) => onDraftChange({ ...draft, ...patch });
  const quoteKey = quote
    ? `${quote.method}:${quote.amountUsd.toFixed(2)}:${quote.payAmount.toFixed(2)}:${quote.payRate}:${quote.feePercent}`
    : "";

  const copyTarget = async () => {
    try {
      await navigator.clipboard.writeText(option.account);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Presse-papiers indisponible : le compte reste lisible à l'écran.
    }
  };

  return (
    <div className="space-y-3">
      {options.length > 1 && (
        <div>
          <span className={LABEL_CLS}>{ar ? "اختر وسيلة الدفع" : "Choose a method"}</span>
          <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
            {options.map((item) => {
              const active = item.method === option.method;
              return (
                <button
                  key={item.method}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    set({ method: item.method });
                    // Le devis change avec la méthode : l'accord porte sur un
                    // montant précis, il doit donc être redonné.
                    onQuoteAcceptedChange(false);
                  }}
                  className={`min-h-11 rounded-xl border px-3 py-2 text-[12px] font-black transition-colors ${
                    active
                      ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                      : "border-[var(--border)] hover:border-[var(--accent)]/60"
                  }`}
                >
                  {MANUAL_PAYMENT_METHOD_LABELS[item.method]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Destination + montant exact : le client doit pouvoir copier le compte
          sans risquer une faute de frappe. */}
      <div className="rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/5 p-3">
        <div className="text-[10.5px] font-black uppercase tracking-wide text-[var(--muted-foreground)]">
          {ar ? "حوّل بالضبط" : "Send exactly"}
        </div>
        {quote ? (
          <p className="mt-1 text-[16px] font-black text-[var(--foreground)]" dir="ltr">
            {formatManualPaymentAmount(quote.payAmount, quote.payCurrency)}
          </p>
        ) : (
          <p className="mt-1 text-[12.5px] font-bold text-amber-700 dark:text-amber-300">
            {ar
              ? "تعذر حساب المبلغ. تواصل معنا أو اختر الدفع بالعملات الرقمية."
              : "The amount could not be calculated. Contact us or choose crypto."}
          </p>
        )}
        <div className="mt-2 flex items-start justify-between gap-2 border-t border-[var(--accent)]/20 pt-2">
          <div className="min-w-0">
            <div className="text-[10.5px] font-black uppercase tracking-wide text-[var(--muted-foreground)]">
              {ar ? "إلى الحساب" : "To account"}
            </div>
            <p className="mt-0.5 break-all font-mono text-[12.5px] font-bold" dir="ltr">
              {option.account}
            </p>
            {option.beneficiary && (
              <p className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">
                {ar ? "باسم" : "Holder"}: {option.beneficiary}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={copyTarget}
            aria-label={ar ? "نسخ الحساب" : "Copy the account"}
            className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-lg border border-[var(--border)] bg-[var(--background)] hover:border-[var(--accent)]"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
        {isCrypto && (
          <CryptoQrCode
            method={option.method}
            value={option.account}
            customImageUrl={option.qrImage}
            locale={locale}
          />
        )}
        {quote && (!isDollarPeggedManualCurrency(quote.payCurrency) || quote.feePercent > 0) && (
          <p className="mt-2 border-t border-[var(--accent)]/20 pt-2 text-[11px] leading-5 text-[var(--muted-foreground)]" dir="ltr">
            {quote.amountUsd.toFixed(2)} USD × {quote.payRate}{" "}
            {quote.payCurrency as ManualPaymentCurrency}
            {quote.feePercent > 0 ? ` × ${100 + quote.feePercent}%` : ""} ={" "}
            {quote.payAmount.toFixed(2)} {quote.payCurrency}
          </p>
        )}
        {option.instructions && (
          <p className="mt-2 text-[11px] leading-5 text-[var(--muted-foreground)]">
            {option.instructions}
          </p>
        )}
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        <label className="block">
          <span className={LABEL_CLS}>
            {ar ? "اسم صاحب الحساب المُرسِل *" : "Sender account holder *"}
          </span>
          <input
            value={draft.senderName}
            onChange={(event) => set({ senderName: event.target.value })}
            maxLength={120}
            autoComplete="name"
            className={INPUT_CLS}
          />
        </label>
        <label className="block">
          <span className={LABEL_CLS}>
            {senderAccountLabel}
          </span>
          <input
            value={draft.senderAccount}
            onChange={(event) => set({ senderAccount: event.target.value })}
            maxLength={120}
            dir="ltr"
            placeholder={senderAccountPlaceholder}
            className={INPUT_CLS}
          />
        </label>
      </div>

      <label className="block">
        <span className={LABEL_CLS}>
          {txRefLabel}
        </span>
        <input
          value={draft.transactionRef}
          onChange={(event) => set({ transactionRef: event.target.value })}
          maxLength={120}
          dir="ltr"
          className={`${INPUT_CLS} font-mono`}
        />
      </label>

      <label className="block">
        <span className={LABEL_CLS}>{ar ? "ملاحظة (اختياري)" : "Note (optional)"}</span>
        <input
          value={draft.note}
          onChange={(event) => set({ note: event.target.value })}
          maxLength={300}
          className={INPUT_CLS}
        />
      </label>

      {quote && (
        <label className="flex min-h-11 cursor-pointer items-start gap-2.5 rounded-lg border border-[var(--border)] px-3 py-2.5 text-[11.5px] font-bold leading-5">
          <input
            type="checkbox"
            checked={quoteAccepted}
            onChange={(event) => onQuoteAcceptedChange(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
          />
          <span>
            {ar
              ? `أقرّ بأنني حوّلت ${formatManualPaymentAmount(quote.payAmount, quote.payCurrency)} إلى الحساب المذكور، وأن تسليم الطلب يبقى رهناً بالتحقق اليدوي من وصول المبلغ.`
              : `I confirm I sent ${formatManualPaymentAmount(quote.payAmount, quote.payCurrency)} to the account above, and that delivery stays subject to a manual verification of receipt.`}
          </span>
        </label>
      )}

      <p className="flex items-start gap-2 text-[11px] leading-5 text-[var(--muted-foreground)]">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
        {ar
          ? "لم يُقبل الدفع بعد: نتحقق يدوياً من وصول المبلغ، وقد يبقى الطلب معلّقاً حتى ذلك الحين. لا تُعد الإرسال."
          : "The payment is not accepted yet: we verify the money actually arrived by hand, and the order stays pending until then. Do not send it twice."}
      </p>
      {/* Clé de devis : elle invalide l'accord client si le montant change. */}
      <input type="hidden" value={quoteKey} readOnly aria-hidden="true" tabIndex={-1} />
    </div>
  );
}
