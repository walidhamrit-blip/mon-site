// Noyau pur du paiement par carte de recharge téléphonique.
// Aucune base, aucun secret et aucun code chiffré dans ce module.

export const PHONE_CARD_OPERATORS = ["libyana", "al_madar"] as const;
export const PHONE_CARD_DISABLED_ERROR = "phone_card_disabled";

/** Absent = activé (anciennes configurations) ; une valeur corrompue ferme le flux. */
export function normalizePhoneCardPaymentsEnabled(value: unknown): boolean {
  return value === undefined ? true : value === true;
}

/** Message client commun à la caisse et au suivi d'une demande refusée. */
export function phoneCardUnavailableNotice(locale: "ar" | "en"): string {
  return locale === "ar"
    ? "الدفع ببطاقة أو رصيد الهاتف متوقف مؤقتاً لأن التحقق اليدوي غير متاح. لا ترسل رمز البطاقة؛ يمكنك اختيار الدفع بالعملات الرقمية. الطلبات السابقة تبقى قابلة للمعالجة."
    : "Phone card / mobile balance payments are temporarily paused because manual verification is unavailable. Do not submit a recharge code; crypto payment remains available. Existing orders can still be processed.";
}
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

/**
 * Décide ce que la livraison doit faire d'une commande payée par carte
 * téléphonique — la règle est ici, pure, pour que les deux chemins qui
 * peuvent acheter un code (Reloadly historique et FazerCards) appliquent
 * exactement la même garde.
 *
 * - `"supplier"` : achat fournisseur autorisé (carte acceptée **et** demande
 *   explicite d'un administrateur, ou commande qui n'est pas payée par carte) ;
 * - `"manual"` : carte acceptée, mais seule la saisie humaine est autorisée ;
 * - `"blocked"` : carte non vérifiée → aucun achat, jamais.
 *
 * `autoDeliver` ne doit venir **que** d'une action admin authentifiée : ni le
 * cron de reprise, ni l'IPN, ni le suivi client ne peuvent acheter un code.
 */
export function phoneCardDeliveryRoute(input: {
  isPhoneCard: boolean;
  status: unknown;
  autoDeliver?: boolean;
}): "supplier" | "manual" | "blocked" {
  if (!input.isPhoneCard) return "supplier";
  if (!phoneCardDeliveryAllowed(input.status)) return "blocked";
  return input.autoDeliver === true ? "supplier" : "manual";
}

export type PhoneCardAutoDeliveryOutcome =
  | "delivered"
  | "already_delivered"
  | "awaiting_codes"
  | "manual"
  | "failed"
  | "not_paid"
  | "not_found";

/**
 * Message admin après une acceptation qui tente la livraison automatique.
 * Toujours actionnable : si le site n'a pas pu acheter le code, le gérant
 * lit quoi faire (saisir le code, relancer, client prévenu).
 */
export function phoneCardAutoDeliveryMessage(
  outcome: PhoneCardAutoDeliveryOutcome,
  ref: string,
  detail?: string,
): string {
  const motif = (detail ?? "").trim();
  switch (outcome) {
    case "delivered":
      return `Carte acceptée et code livré automatiquement : le client a reçu son code par e-mail (commande ${ref}).`;
    case "already_delivered":
      return `Carte acceptée. La commande ${ref} était déjà livrée : aucun second achat effectué.`;
    case "awaiting_codes":
      return `Carte acceptée. Le fournisseur prépare le code : le client est prévenu par e-mail, relancez la livraison dans quelques minutes.${
        motif ? ` (${motif})` : ""
      }`;
    case "failed":
      return `Carte acceptée, mais le fournisseur a refusé l’achat : ${motif || "motif inconnu"}. Livrez le code à la main ou remboursez.`;
    case "not_paid":
      return `Carte acceptée, mais la livraison automatique a été bloquée : ${
        motif || "paiement non confirmé"
      }.`;
    case "not_found":
      return `Aucune commande trouvée pour ${ref}.`;
    case "manual":
    default:
      return `Carte acceptée, mais livraison manuelle requise : ${
        motif || "aucun achat fournisseur n’a été déclenché"
      } Saisissez le code cadeau ci-dessous.`;
  }
}

/** Texte du suivi public : ne contient jamais le code de recharge. */
export function phoneCardPublicNotice(
  status: PhoneCardReviewStatus,
  locale: "ar" | "en",
): string {
  const ar = locale === "ar";
  if (status === "approved") {
    // Depuis l'automatisation : le code peut être acheté et envoyé sans autre
    // geste. Le texte ne promet donc plus une préparation « manuelle ».
    return ar
      ? "تم قبول بطاقة الهاتف بعد التحقق. بطاقة الهدية في طريقها إليك، وستصلك بالبريد الإلكتروني وعلى هذه الصفحة."
      : "Your phone card has been verified and accepted. Your gift card is on its way and will appear here and be emailed to you.";
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
