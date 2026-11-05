// Noyau pur du paiement par carte de recharge téléphonique.
// Aucune base, aucun secret et aucun code chiffré dans ce module.

export const PHONE_CARD_OPERATORS = ["libyana", "al_madar"] as const;
export type PhoneCardOperator = (typeof PHONE_CARD_OPERATORS)[number];
export const PHONE_CARD_REVIEW_STATUSES = ["pending", "approved", "rejected"] as const;
export type PhoneCardReviewStatus = (typeof PHONE_CARD_REVIEW_STATUSES)[number];

export const PHONE_CARD_OPERATOR_LABELS: Record<PhoneCardOperator, string> = {
  libyana: "Libyana",
  al_madar: "Al Madar",
};

export interface PhoneCardInput {
  operator?: unknown;
  code?: unknown;
  valueLyd?: unknown;
}

export interface ValidPhoneCardInput {
  operator: PhoneCardOperator;
  code: string;
  valueLyd: string;
}

/** Normalise uniquement la présentation (espaces et tirets), jamais les chiffres. */
export function normalizePhoneCardCode(value: unknown): string {
  return typeof value === "string" ? value.replace(/[\s-]/g, "") : "";
}

export function normalizePhoneCardReviewStatus(value: unknown): PhoneCardReviewStatus {
  return (PHONE_CARD_REVIEW_STATUSES as readonly string[]).includes(String(value))
    ? (value as PhoneCardReviewStatus)
    : "pending";
}

/** Validation serveur de secours, même si la route utilise aussi Zod. */
export function validatePhoneCardInput(
  input: PhoneCardInput | null | undefined,
): { ok: true; value: ValidPhoneCardInput } | { ok: false; error: string } {
  if (!input || !(PHONE_CARD_OPERATORS as readonly string[]).includes(String(input.operator))) {
    return { ok: false, error: "Choisissez l’opérateur de la carte téléphonique." };
  }
  const code = normalizePhoneCardCode(input.code);
  if (!/^\d{6,32}$/.test(code)) {
    return { ok: false, error: "Le code doit contenir entre 6 et 32 chiffres." };
  }
  const rawValue = String(input.valueLyd ?? "").trim().replace(",", ".");
  const amount = Number(rawValue);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000) {
    return { ok: false, error: "Indiquez une valeur de carte valide en LYD." };
  }
  return {
    ok: true,
    value: {
      operator: input.operator as PhoneCardOperator,
      code,
      valueLyd: amount.toFixed(2),
    },
  };
}

/** Seule une carte explicitement acceptée peut débloquer une livraison manuelle. */
export function phoneCardDeliveryAllowed(status: unknown): boolean {
  return normalizePhoneCardReviewStatus(status) === "approved";
}

/** Texte du suivi public : ne contient jamais le code de recharge. */
export function phoneCardPublicNotice(
  status: PhoneCardReviewStatus,
  locale: "ar" | "en",
): string {
  const ar = locale === "ar";
  if (status === "approved") {
    return ar
      ? "تم قبول بطاقة الهاتف بعد التحقق. طلبك الآن قيد التحضير اليدوي، وستصلك بطاقة الهدية بالبريد الإلكتروني وعلى هذه الصفحة."
      : "Your phone card has been verified and accepted. Your gift card is now being prepared manually and will appear here and be emailed to you.";
  }
  if (status === "rejected") {
    return ar
      ? "تعذر قبول بطاقة الهاتف بعد التحقق. لم يتم تسليم أي كود. تواصل معنا مع ذكر مرجع الطلب للمساعدة أو استبدال وسيلة الدفع."
      : "The phone card could not be accepted after verification. No code has been delivered. Contact us with your order reference for help or to use another payment method.";
  }
  return ar
    ? "تم استلام رمز بطاقة الهاتف بشكل آمن. سنتحقق منه يدوياً أولاً؛ لا ترسل الرمز مرة أخرى. بعد القبول، سنحضّر بطاقة الهدية يدوياً ونرسلها إلى بريدك الإلكتروني ونعرضها هنا."
    : "Your phone card code was received securely. We will verify it manually first; do not submit it again. Once accepted, we will prepare your gift card manually, email it to you and display it here.";
}
