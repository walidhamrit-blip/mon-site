"use client";

import { useMemo } from "react";
import { Copy, Info } from "lucide-react";
import {
  MANUAL_PAYMENT_METHOD_LABELS,
  calculateManualPaymentQuote,
  formatManualPaymentAmount,
  type ManualPaymentCurrency,
  type ManualPaymentMethod,
  type ManualPaymentQuote,
} from "@/lib/manual-payment-core";
import type { PublicManualPaymentOption } from "@/lib/manual-payment-public";

/**
 * Champs de preuve de paiement pour un virement manuel
 * (Skrill, Neteller, Airtm, D17, Volet, WebMoney et Kashy).
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
  const option = useMemo(
    () => options.find((item) => item.method === draft.method) ?? options[0] ?? null,
    [options, draft.method],
  );
  const quote = option ? manualQuoteForOption(option, amountUsd) : null;

  if (!option) return null;

  const set = (patch: Partial<ManualPaymentDraft>) => onDraftChange({ ...draft, ...patch });
  const quoteKey = quote
    ? `${quote.method}:${quote.amountUsd.toFixed(2)}:${quote.payAmount.toFixed(2)}:${quote.payRate}:${quote.feePercent}`
    : "";

  const copyTarget = async () => {
    try {
      await navigator.clipboard.writeText(option.account);
    } catch {
      // Presse-papiers indisponible : le compte reste lisible à l'écran.
    }
  };

  return (
    <div className="space-y-3">
      {options.length > 1 && (
        <div>
          <span className={LABEL_CLS}>{ar ? "اختر وسيلة الدفع" : "Choose a method"}</span>
          <div className="grid grid-cols-2 gap-2">
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
          <p className="mt-1 text-[12.5px] font-bold text-amber-700">
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
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[var(--border)] bg-[var(--background)] hover:border-[var(--accent)]"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
        {quote && (quote.payCurrency !== "USD" || quote.feePercent > 0) && (
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
            {ar ? "حساب المُرسِل *" : "Sender account *"}
          </span>
          <input
            value={draft.senderAccount}
            onChange={(event) => set({ senderAccount: event.target.value })}
            maxLength={120}
            dir="ltr"
            placeholder={ar ? "بريد أو محفظة أو هاتف" : "E-mail, wallet or phone"}
            className={INPUT_CLS}
          />
        </label>
      </div>

      <label className="block">
        <span className={LABEL_CLS}>
          {ar ? "معرّف العملية (المرجع) *" : "Transaction ID / reference *"}
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
        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-[var(--border)] px-2.5 py-2 text-[11.5px] font-bold leading-5">
          <input
            type="checkbox"
            checked={quoteAccepted}
            onChange={(event) => onQuoteAcceptedChange(event.target.checked)}
            className="mt-1 h-3.5 w-3.5 shrink-0 accent-[var(--accent)]"
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
