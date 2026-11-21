// Noyau PUR des moyens de paiement manuels sans passerelle :
// Skrill, Neteller, Airtm, D17, Volet (AdvCash), WebMoney, Kashy (TND),
// Binance Pay, OKX Pay, Bybit Pay, RedotPay et USDT direct (BEP20, TRC20, TON, Polygon, Solana).
//
// Principe identique aux cartes de recharge téléphonique : le client envoie
// l'argent LUI-MÊME sur le compte de l'agence, puis déclare sa preuve
// (titulaire + compte expéditeur + identifiant de transaction). Aucun
// déblocage n'est automatique : un administrateur vérifie la réception et
// libère la commande. Aucune API, aucune clé, aucune dépendance serveur ici.
//
// Toutes les fonctions de ce module sont pures : elles sont utilisées par le
// navigateur (affichage du devis), par le serveur (recalcul autoritaire avant
// enregistrement) et par les tests.

export const MANUAL_PAYMENT_METHODS = [
  "skrill",
  "neteller",
  "airtm",
  "d17",
  "advcash",
  "webmoney",
  "kashy",
  "binance_pay",
  "okx_pay",
  "bybit_pay",
  "redotpay",
  "usdt_bep20",
  "usdt_trc20",
  "usdt_ton",
  "usdt_polygon",
  "usdt_sol",
] as const;
export type ManualPaymentMethod = (typeof MANUAL_PAYMENT_METHODS)[number];

const FIAT_MANUAL_PAYMENT_CURRENCIES = ["USD", "LYD", "EUR", "TND"] as const;
/** Devises dans lesquelles le client peut régler, selon le réglage admin. */
export const MANUAL_PAYMENT_CURRENCIES = [...FIAT_MANUAL_PAYMENT_CURRENCIES, "WMZ", "USDT"] as const;
export type ManualPaymentCurrency = (typeof MANUAL_PAYMENT_CURRENCIES)[number];

/** Devises indexées 1:1 sur le dollar (aucun taux de conversion à saisir). */
export function isDollarPeggedManualCurrency(currency: ManualPaymentCurrency): boolean {
  return currency === "USD" || currency === "USDT";
}

/** Devises réellement autorisées pour chaque moyen (configuration manuelle). */
export const MANUAL_PAYMENT_METHOD_CURRENCIES: Record<
  ManualPaymentMethod,
  readonly ManualPaymentCurrency[]
> = {
  skrill: FIAT_MANUAL_PAYMENT_CURRENCIES,
  neteller: FIAT_MANUAL_PAYMENT_CURRENCIES,
  airtm: FIAT_MANUAL_PAYMENT_CURRENCIES,
  d17: FIAT_MANUAL_PAYMENT_CURRENCIES,
  advcash: ["USD"],
  // WebMoney use “WMZ”, which tracks the US dollar in practice but is not
  // the same currency. The rate is therefore always required.
  webmoney: ["WMZ", "LYD", "EUR", "TND"],
  kashy: ["TND"],
  binance_pay: ["USDT", "USD"],
  okx_pay: ["USDT", "USD"],
  bybit_pay: ["USDT", "USD"],
  redotpay: ["USDT", "USD"],
  usdt_bep20: ["USDT"],
  usdt_trc20: ["USDT"],
  usdt_ton: ["USDT"],
  usdt_polygon: ["USDT"],
  usdt_sol: ["USDT"],
};

export const MANUAL_PAYMENT_METHOD_DEFAULT_CURRENCY: Record<ManualPaymentMethod, ManualPaymentCurrency> = {
  skrill: "USD",
  neteller: "USD",
  airtm: "USD",
  d17: "USD",
  advcash: "USD",
  webmoney: "WMZ",
  kashy: "TND",
  binance_pay: "USDT",
  okx_pay: "USDT",
  bybit_pay: "USDT",
  redotpay: "USDT",
  usdt_bep20: "USDT",
  usdt_trc20: "USDT",
  usdt_ton: "USDT",
  usdt_polygon: "USDT",
  usdt_sol: "USDT",
};

export const MANUAL_PAYMENT_REVIEW_STATUSES = ["pending", "approved", "rejected"] as const;
export type ManualPaymentReviewStatus = (typeof MANUAL_PAYMENT_REVIEW_STATUSES)[number];

/** Longueurs maximales partagées entre le formulaire et la validation serveur. */
export const MANUAL_PAYMENT_LIMITS = {
  senderName: 120,
  senderAccount: 120,
  transactionRef: 120,
  note: 300,
  account: 160,
  beneficiary: 120,
} as const;

export const MANUAL_PAYMENT_METHOD_LABELS: Record<ManualPaymentMethod, string> = {
  skrill: "Skrill",
  neteller: "Neteller",
  airtm: "Airtm",
  d17: "D17 — Poste Tunisienne",
  advcash: "Volet (AdvCash)",
  webmoney: "WebMoney (WMZ)",
  kashy: "Kashy (TND)",
  binance_pay: "Binance Pay (ID)",
  okx_pay: "OKX Pay (UID)",
  bybit_pay: "Bybit Pay (UID)",
  redotpay: "RedotPay (ID)",
  usdt_bep20: "USDT Direct · BEP20",
  usdt_trc20: "USDT Direct · TRC20",
  usdt_ton: "USDT Direct · TON",
  usdt_polygon: "USDT Direct · Polygon",
  usdt_sol: "USDT Direct · Solana",
};

/**
 * Texte d'aide : ce que le client doit saisir comme « compte à créditer ».
 * Le libellé change parce que la cible n'est pas la même partout (e-mail,
 * portefeuille, numéro de téléphone).
 */
export const MANUAL_PAYMENT_METHOD_KIND: Record<
  ManualPaymentMethod,
  "email" | "wallet" | "phone" | "id"
> = {
  skrill: "email",
  neteller: "email",
  airtm: "wallet",
  d17: "phone",
  advcash: "id",
  webmoney: "id",
  kashy: "phone",
  binance_pay: "id",
  okx_pay: "id",
  bybit_pay: "id",
  redotpay: "id",
  usdt_bep20: "wallet",
  usdt_trc20: "wallet",
  usdt_ton: "wallet",
  usdt_polygon: "wallet",
  usdt_sol: "wallet",
};

export const MANUAL_PAYMENT_CURRENCY_LABELS: Record<ManualPaymentCurrency, string> = {
  USD: "USD $",
  LYD: "LYD د.ل",
  EUR: "EUR €",
  TND: "TND د.ت",
  WMZ: "WMZ — WebMoney",
  USDT: "USDT ₮",
};

export interface ManualPaymentMethodSettings {
  /** Activer cette méthode dans les tunnels de paiement. */
  enabled: boolean;
  /** Compte ou identifiant à créditer, affiché au client (e-mail, wallet, n° D17, WebMoney, Kashy…). */
  account: string;
  /** Bénéficiaire affiché au client (nom du compte). */
  beneficiary: string;
  /** Devise que le client doit envoyer. */
  currency: ManualPaymentCurrency;
  /** 1 USD = X devise. Ignoré quand la devise est USD ; null = non configuré. */
  rate: number | null;
  /** Majoration appliquée au montant envoyé (frais, perte de change). */
  feePercent: number;
  /** Consigne libre affichée au client avant son transfert. */
  instructions: string;
}

export type ManualPaymentsConfig = Record<ManualPaymentMethod, ManualPaymentMethodSettings>;

export const DEFAULT_MANUAL_PAYMENT_SETTINGS: ManualPaymentMethodSettings = {
  enabled: false,
  account: "",
  beneficiary: "",
  currency: "USD",
  rate: null,
  feePercent: 0,
  instructions: "",
};

export function defaultManualPaymentsConfig(): ManualPaymentsConfig {
  return Object.fromEntries(
    MANUAL_PAYMENT_METHODS.map((method) => [
      method,
      {
        ...DEFAULT_MANUAL_PAYMENT_SETTINGS,
        currency: MANUAL_PAYMENT_METHOD_DEFAULT_CURRENCY[method],
      },
    ]),
  ) as ManualPaymentsConfig;
}

/**
 * Normalise le bloc `manualPayments` d'une configuration enregistrée.
 *
 * Deux garde-fous volontaires :
 *  - une valeur absente ou corrompue NE PEUT PAS ouvrir une méthode (tout
 *    retombe à « désactivé ») ;
 *  - une méthode sans compte à créditer reste fermée, même cochée : sans
 *    destination, le client n'a aucun moyen de payer et se retrouverait
 *    bloqué après avoir choisi l'option.
 */
export function normalizeManualPaymentsConfig(input: unknown): ManualPaymentsConfig {
  const source =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const result = {} as ManualPaymentsConfig;
  for (const method of MANUAL_PAYMENT_METHODS) {
    const raw =
      source[method] && typeof source[method] === "object" && !Array.isArray(source[method])
        ? (source[method] as Record<string, unknown>)
        : {};
    const account = String(raw.account ?? "").trim().slice(0, MANUAL_PAYMENT_LIMITS.account);
    const beneficiary = String(raw.beneficiary ?? "")
      .trim()
      .slice(0, MANUAL_PAYMENT_LIMITS.beneficiary);
    const instructions = String(raw.instructions ?? "")
      .replace(/[\r\n]+/g, " ")
      .trim()
      .slice(0, MANUAL_PAYMENT_LIMITS.note);
    const allowedCurrencies = MANUAL_PAYMENT_METHOD_CURRENCIES[method];
    const defaultCurrency = MANUAL_PAYMENT_METHOD_DEFAULT_CURRENCY[method];
    const normalizedCurrency = normalizeManualPaymentCurrency(raw.currency, defaultCurrency);
    const currency = allowedCurrencies.includes(normalizedCurrency)
      ? normalizedCurrency
      : defaultCurrency;
    const rate = normalizeManualPaymentRate(raw.rate);
    result[method] = {
      // Une seule notion d'ouverture : cochée, compte présent, et taux
      // disponible hors USD/USDT. Aucun appelant ne peut ainsi proposer un
      // moyen dont le montant ne serait pas calculable.
      enabled:
        raw.enabled === true &&
        account.length > 0 &&
        (isDollarPeggedManualCurrency(currency) || rate != null),
      account,
      beneficiary,
      currency,
      rate,
      feePercent: normalizeManualPaymentFee(raw.feePercent),
      instructions,
    };
  }
  return result;
}

/** Méthodes réellement proposables au client, dans l'ordre du catalogue. */
export function availableManualPaymentMethods(
  config: unknown,
): ManualPaymentMethod[] {
  const normalized = normalizeManualPaymentsConfig(config);
  return MANUAL_PAYMENT_METHODS.filter(
    (method) => normalized[method].enabled && manualPaymentMethodReady(normalized[method]),
  );
}

/* ------------------------------ Normalisation ----------------------------- */

export function isManualPaymentMethod(value: unknown): value is ManualPaymentMethod {
  return (MANUAL_PAYMENT_METHODS as readonly string[]).includes(String(value));
}

export function normalizeManualPaymentMethod(value: unknown): ManualPaymentMethod | null {
  const raw = String(value ?? "").trim().toLowerCase();
  return isManualPaymentMethod(raw) ? raw : null;
}

export function normalizeManualPaymentCurrency(
  value: unknown,
  fallback: ManualPaymentCurrency = "USD",
): ManualPaymentCurrency {
  const raw = String(value ?? "").trim().toUpperCase();
  return (MANUAL_PAYMENT_CURRENCIES as readonly string[]).includes(raw)
    ? (raw as ManualPaymentCurrency)
    : fallback;
}

export function normalizeManualPaymentReviewStatus(value: unknown): ManualPaymentReviewStatus {
  return (MANUAL_PAYMENT_REVIEW_STATUSES as readonly string[]).includes(String(value))
    ? (value as ManualPaymentReviewStatus)
    : "pending";
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** Taux accepté : strictement positif et plausible. */
export function normalizeManualPaymentRate(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const rate = Number(value);
  if (!Number.isFinite(rate) || rate <= 0 || rate > 100_000) return null;
  return round(rate, 6);
}

/** Majoration bornée : 0 % à 100 %. Une valeur corrompue retombe à 0. */
export function normalizeManualPaymentFee(value: unknown): number {
  const fee = Number(value);
  if (!Number.isFinite(fee) || fee < 0) return 0;
  return round(Math.min(fee, 100), 2);
}

/**
 * Interrupteur opérationnel : SEULES les valeurs explicitement `true`
 * ouvrent une méthode. Absent, corrompu ou partiel → aucune méthode active
 * (contrairement aux cartes téléphoniques, ces moyens sont nouveaux : on ne
 * suppose jamais qu'ils sont configurés).
 */
export function normalizeManualPaymentsEnabled(
  value: unknown,
): Record<ManualPaymentMethod, boolean> {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const result = {} as Record<ManualPaymentMethod, boolean>;
  for (const method of MANUAL_PAYMENT_METHODS) {
    result[method] = source[method] === true;
  }
  return result;
}

/* --------------------------------- Devis ---------------------------------- */

export interface ManualPaymentQuote {
  method: ManualPaymentMethod;
  /** Total dû de la commande, en USD (toujours recalculé côté serveur). */
  amountUsd: number;
  /** Devise réellement envoyée par le client. */
  payCurrency: ManualPaymentCurrency;
  /** Taux appliqué (1 USD = X devise) ; 1 pour USD. */
  payRate: number;
  /** Majoration appliquée, en pourcentage. */
  feePercent: number;
  /** Montant exact à envoyer, dans `payCurrency`. */
  payAmount: number;
}

/**
 * Une méthode est proposée au client seulement si elle est ACTIVÉE par
 * l'interrupteur, qu'un compte à créditer est renseigné et que le taux est
 * présent quand la devise n'est pas l'USD. Un réglage incomplet ferme la
 * méthode au lieu d'inventer un montant.
 */
export function manualPaymentMethodReady(
  settings: Partial<ManualPaymentMethodSettings> | null | undefined,
): boolean {
  if (!settings) return false;
  const account = String(settings.account ?? "").trim();
  if (!account) return false;
  const currency = normalizeManualPaymentCurrency(settings.currency);
  if (isDollarPeggedManualCurrency(currency)) return true;
  return normalizeManualPaymentRate(settings.rate) != null;
}

/** Devise finale et taux utilisés pour un réglage donné. */
export function manualPaymentCurrencyAndRate(
  settings: Partial<ManualPaymentMethodSettings> | null | undefined,
): { currency: ManualPaymentCurrency; rate: number } | null {
  const currency = normalizeManualPaymentCurrency(settings?.currency);
  if (isDollarPeggedManualCurrency(currency)) return { currency, rate: 1 };
  const rate = normalizeManualPaymentRate(settings?.rate);
  return rate == null ? null : { currency, rate };
}

/**
 * Montant à envoyer = total USD × taux de la devise × (1 + majoration).
 * `null` si le montant ou le réglage ne permet pas un calcul sûr.
 */
export function calculateManualPaymentQuote(
  amountUsdInput: unknown,
  method: ManualPaymentMethod,
  settings: Partial<ManualPaymentMethodSettings> | null | undefined,
): ManualPaymentQuote | null {
  // Un moyen explicitement fermé n'a aucun devis : on ne calcule jamais un
  // montant à envoyer sur un compte que le client ne peut pas payer.
  if (settings && settings.enabled === false) return null;
  const amount = Number(amountUsdInput);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) return null;
  const currencyAndRate = manualPaymentCurrencyAndRate(settings);
  if (!currencyAndRate) return null;
  const feePercent = normalizeManualPaymentFee(settings?.feePercent);
  const amountUsd = round(amount, 2);
  const payAmount = round(
    amountUsd * currencyAndRate.rate * (1 + feePercent / 100),
    2,
  );
  if (!Number.isFinite(payAmount) || payAmount <= 0) return null;
  return {
    method,
    amountUsd,
    payCurrency: currencyAndRate.currency,
    payRate: currencyAndRate.rate,
    feePercent,
    payAmount,
  };
}

/**
 * Vérifie que le client a accepté EXACTEMENT le devis que le serveur vient de
 * recalculer. Le montant envoyé par le navigateur sert uniquement de garde-fou
 * anti-dérive : le devis enregistré est toujours celui du serveur.
 */
export function manualPaymentQuoteMatches(
  candidate: unknown,
  expected: ManualPaymentQuote,
): boolean {
  if (!candidate || typeof candidate !== "object") return false;
  const value = candidate as Record<string, unknown>;
  const sameMoney = (input: unknown, target: number, decimals: number) => {
    const parsed = Number(input);
    return Number.isFinite(parsed) && parsed.toFixed(decimals) === target.toFixed(decimals);
  };
  return (
    normalizeManualPaymentMethod(value.method) === expected.method &&
    sameMoney(value.amountUsd, expected.amountUsd, 2) &&
    sameMoney(value.payAmount, expected.payAmount, 2) &&
    sameMoney(value.payRate, expected.payRate, 6) &&
    normalizeManualPaymentCurrency(value.payCurrency) === expected.payCurrency &&
    sameMoney(value.feePercent, expected.feePercent, 2)
  );
}

/** Montant affichable, sans dépendre d'Intl côté serveur. */
export function formatManualPaymentAmount(amount: number, currency: ManualPaymentCurrency): string {
  const value = Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
  return `${value} ${currency}`;
}

/* -------------------------------- Validation ------------------------------- */

export interface ManualPaymentInput {
  method?: unknown;
  senderName?: unknown;
  senderAccount?: unknown;
  transactionRef?: unknown;
  note?: unknown;
  quoteAccepted?: unknown;
  quote?: unknown;
}

export interface ValidManualPaymentInput {
  method: ManualPaymentMethod;
  senderName: string;
  senderAccount: string;
  transactionRef: string;
  note: string | null;
}

/** Nettoie sans jamais inventer : contrôle des caractères de contrôle + taille. */
function cleanText(value: unknown, max: number): string {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/**
 * Validation serveur de secours (la route utilise aussi Zod) : elle protège
 * même un appel direct au module.
 */
export function validateManualPaymentInput(
  input: ManualPaymentInput | null | undefined,
): { ok: true; value: ValidManualPaymentInput } | { ok: false; error: string } {
  const method = normalizeManualPaymentMethod(input?.method);
  if (!method) {
    return { ok: false, error: "Choisissez un moyen de paiement manuel valide." };
  }
  const senderName = cleanText(input?.senderName, MANUAL_PAYMENT_LIMITS.senderName);
  if (senderName.length < 2) {
    return {
      ok: false,
      error: "Indiquez le nom du titulaire du compte depuis lequel vous avez payé.",
    };
  }
  const senderAccount = cleanText(input?.senderAccount, MANUAL_PAYMENT_LIMITS.senderAccount);
  if (senderAccount.length < 3) {
    return {
      ok: false,
      error: "Indiquez le compte expéditeur (e-mail, identifiant, portefeuille ou numéro de téléphone).",
    };
  }
  const transactionRef = cleanText(input?.transactionRef, MANUAL_PAYMENT_LIMITS.transactionRef);
  if (transactionRef.length < 3) {
    return {
      ok: false,
      error: "Indiquez l’identifiant de la transaction (numéro de référence du transfert).",
    };
  }
  const note = cleanText(input?.note, MANUAL_PAYMENT_LIMITS.note);
  return {
    ok: true,
    value: { method, senderName, senderAccount, transactionRef, note: note || null },
  };
}

/* ------------------------------ Messages client --------------------------- */

export function manualPaymentUnavailableNotice(locale: "ar" | "en"): string {
  return locale === "ar"
    ? "الدفع اليدوي (Binance Pay / OKX / Bybit / RedotPay / USDT المباشر / Skrill / Neteller / Airtm / D17 / Volet / WebMoney / Kashy) متوقف مؤقتاً لأن التحقق اليدوي غير متاح. لا تُحوّل أي مبلغ؛ يمكنك اختيار الدفع الآلي بالعملات الرقمية. الطلبات السابقة تبقى قابلة للمعالجة."
    : "Manual payment (Binance Pay / OKX / Bybit / RedotPay / Direct USDT / Skrill / Neteller / Airtm / D17 / Volet / WebMoney / Kashy) is temporarily paused because manual verification is unavailable. Do not transfer any money; automated crypto payment remains available. Existing orders can still be processed.";
}

export function manualPaymentUnavailableShort(locale: "ar" | "en"): string {
  return locale === "ar"
    ? "الدفع اليدوي متوقف مؤقتاً."
    : "Manual payment is temporarily paused.";
}

/**
 * Consigne affichée au client AVANT son transfert : destination, montant
 * exact, et rappel que le déblocage est humain.
 */
export function manualPaymentInstructions(
  quote: ManualPaymentQuote,
  settings: Partial<ManualPaymentMethodSettings>,
  locale: "ar" | "en",
): string {
  const ar = locale === "ar";
  const amount = formatManualPaymentAmount(quote.payAmount, quote.payCurrency);
  const account = String(settings.account ?? "").trim();
  const beneficiary = String(settings.beneficiary ?? "").trim();
  const target = beneficiary
    ? ar
      ? `${account} (باسم ${beneficiary})`
      : `${account} (holder: ${beneficiary})`
    : account;
  return ar
    ? `حوّل بالضبط ${amount} إلى ${target}. بعد التحويل، أدخل بياناتك أدناه. لن يُسلَّم الكود إلا بعد التحقق اليدوي من وصول المبلغ.`
    : `Send exactly ${amount} to ${target}. Then submit your details below. Nothing is delivered until a person has verified that the money arrived.`;
}

/** Texte du suivi public : ne contient jamais l'identifiant de transaction. */
export function manualPaymentPublicNotice(
  status: ManualPaymentReviewStatus,
  locale: "ar" | "en",
): string {
  const ar = locale === "ar";
  if (status === "approved") {
    return ar
      ? "تم التحقق من الدفع اليدوي وقبوله. طلبك قيد التنفيذ، وسيتم تسليم الكود أو تأكيد الخدمة بالطريقة المعتادة."
      : "Your manual payment has been verified and accepted. Your order is being processed and the code or confirmation will follow as usual.";
  }
  if (status === "rejected") {
    return ar
      ? "تعذر قبول الدفع اليدوي بعد التحقق: لم يصل المبلغ أو أن المرجع غير مطابق. لم يتم تسليم أي كود. تواصل معنا مع ذكر مرجع الطلب."
      : "The manual payment could not be accepted after verification: the money was not received or the reference does not match. No code has been delivered. Contact us with your order reference.";
  }
  return ar
    ? "تم استلام بيانات الدفع اليدوي بأمان. نتحقق الآن من وصول المبلغ يدوياً. لا تُعد الإرسال؛ قد يبقى هذا الطلب معلّقاً حتى التحقق من وصول المبلغ كاملاً."
    : "Your manual payment details were received securely. We are now verifying by hand that the money arrived. Do not submit it again; this order stays pending until the exact amount is confirmed.";
}

/* --------------------------- Garde-fous de livraison ---------------------- */

/** Seul un paiement explicitement accepté débloque la livraison. */
export function manualPaymentDeliveryAllowed(status: unknown): boolean {
  return normalizeManualPaymentReviewStatus(status) === "approved";
}

/**
 * Décide ce que la livraison doit faire d'une commande payée par un moyen
 * manuel : `blocked` tant que rien n'est vérifié, `manual` après acceptation,
 * et `supplier` uniquement sur demande explicite d'un administrateur.
 */
export function manualPaymentDeliveryRoute(input: {
  isManual: boolean;
  status: unknown;
  autoDeliver?: boolean;
}): "supplier" | "manual" | "blocked" {
  if (!input.isManual) return "supplier";
  if (!manualPaymentDeliveryAllowed(input.status)) return "blocked";
  return input.autoDeliver === true ? "supplier" : "manual";
}

export type ManualPaymentAutoDeliveryOutcome =
  | "delivered"
  | "already_delivered"
  | "awaiting_codes"
  | "manual"
  | "failed"
  | "not_paid"
  | "not_found";

export function manualPaymentAutoDeliveryMessage(
  outcome: ManualPaymentAutoDeliveryOutcome,
  ref: string,
  detail?: string,
): string {
  const motif = (detail ?? "").trim();
  switch (outcome) {
    case "delivered":
      return `Paiement accepté et code livré automatiquement : le client a reçu son code par e-mail (commande ${ref}).`;
    case "already_delivered":
      return `Paiement accepté. La commande ${ref} était déjà livrée : aucun second achat effectué.`;
    case "awaiting_codes":
      return `Paiement accepté. Le fournisseur prépare le code : le client est prévenu par e-mail, relancez la livraison dans quelques minutes.${
        motif ? ` (${motif})` : ""
      }`;
    case "failed":
      return `Paiement accepté, mais le fournisseur a refusé l’achat : ${motif || "motif inconnu"}. Livrez le code à la main ou remboursez.`;
    case "not_paid":
      return `Paiement accepté, mais la livraison automatique a été bloquée : ${
        motif || "paiement non confirmé"
      }.`;
    case "not_found":
      return `Aucune commande trouvée pour ${ref}.`;
    case "manual":
    default:
      return `Paiement accepté, mais livraison manuelle requise : ${
        motif || "aucun achat fournisseur n’a été déclenché"
      } Saisissez le code cadeau ci-dessous.`;
  }
}

/**
 * Une commande dont le paiement manuel n'est pas accepté ne doit jamais
 * apparaître comme « payée » : ce libellé unique évite d'oublier un moyen
 * lors d'un futur ajout.
 */
export function isManualPaymentChannel(paymentMethod: unknown): boolean {
  return isManualPaymentMethod(String(paymentMethod ?? "").trim().toLowerCase());
}
