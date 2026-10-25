/**
 * Devises du site — affichage multi-devises pour une clientèle mondiale.
 *
 * Principe : la devise de FACTURATION reste le dollar (c'est ce que la
 * passerelle NOWPayments encaisse). L'affichage, lui, se fait dans la
 * devise choisie par le visiteur, convertie à partir du taux configurable
 * dans `siteConfig.currency.rates`.
 *
 * Le taux est stocké dans l'admin (et non hardcodé dans les composants)
 * pour rester maîtrisable : un taux de change bouge, il ne doit pas
 * nécessiter un redéploiement.
 */

/** Description d'une devise affichable. */
export interface CurrencyDefinition {
  /** Symbole affiché devant le montant (« $ », « € », « ر.س »…). */
  symbol: string;
  /** Libellé long en arabe. */
  labelAr: string;
  /** Libellé long en anglais. */
  labelEn: string;
  /** Abréviation affichée dans le sélecteur compact. */
  shortAr: string;
  /** Abréviation affichée dans le sélecteur compact. */
  shortEn: string;
  /** Nombre de décimales affichées. */
  decimals: number;
  /**
   * Unité écrite APRÈS le montant (« 59.50 USDT ») au lieu d'un symbole
   * devant. Utilisé par les stablecoins, dont l'usage s'écrit ainsi.
   */
  suffix?: string;
}

/** Catalogue des devises supportées par le sélecteur. */
export const CURRENCY_CATALOG = {
  /**
   * Tether — l'unité dans laquelle le client paie réellement.
   *
   * Taux FIXE de 1 : ce n'est pas une conversion mais la même valeur, le
   * dollar étant la devise de facturation de NOWPayments. Aucun taux de
   * marché à suivre, donc aucun risque d'afficher un prix faux : c'est
   * l'unité la plus honnête pour un visiteur hors zone dollar, qui n'a
   * aucune raison de connaître le taux du dinar ou de la livre turque.
   */
  USDT: {
    symbol: "",
    suffix: " USDT",
    labelAr: "تيثر (USDT)",
    labelEn: "Tether (USDT)",
    shortAr: "USDT",
    shortEn: "USDT",
    decimals: 2,
  },
  USD: {
    symbol: "$",
    labelAr: "دولار أمريكي",
    labelEn: "US Dollar",
    shortAr: "د.أ",
    shortEn: "USD",
    decimals: 2,
  },
  EUR: {
    symbol: "€",
    labelAr: "يورو",
    labelEn: "Euro",
    shortAr: "€",
    shortEn: "EUR",
    decimals: 2,
  },
  SAR: {
    symbol: "ر.س",
    labelAr: "ريال سعودي",
    labelEn: "Saudi Riyal",
    shortAr: "ر.س",
    shortEn: "SAR",
    decimals: 2,
  },
  AED: {
    symbol: "د.إ",
    labelAr: "درهم إماراتي",
    labelEn: "UAE Dirham",
    shortAr: "د.إ",
    shortEn: "AED",
    decimals: 2,
  },
  EGP: {
    symbol: "ج.م",
    labelAr: "جنيه مصري",
    labelEn: "Egyptian Pound",
    shortAr: "ج.م",
    shortEn: "EGP",
    decimals: 2,
  },
  LYD: {
    symbol: "د.ل",
    labelAr: "دينار\libي",
    labelEn: "Libyan Dinar",
    shortAr: "د.ل",
    shortEn: "LYD",
    decimals: 2,
  },
} as const;

export type CurrencyCode = keyof typeof CURRENCY_CATALOG;

/** Devise de référence (celle de facturation et des prix stockés). */
export const BASE_CURRENCY: CurrencyCode = "USD";

/** Devises proposées par défaut dans le sélecteur. */
export const DEFAULT_ENABLED_CURRENCIES: CurrencyCode[] = [
  "USDT",
  "USD",
  "EUR",
  "SAR",
  "AED",
  "EGP",
  "LYD",
];

/**
 * Devise d'AFFICHAGE par défaut : USDT.
 *
 * Le client paie en USDT ; afficher la même unité que celle débitée évite
 * toute question de change. Le dollar reste la devise de FACTURATION.
 */
export const DEFAULT_DISPLAY_CURRENCY: CurrencyCode = "USDT";

/** Taux par défaut (1 USD = X). Valeurs indicatives, ajustables dans l'admin. */
export const DEFAULT_RATES: Record<CurrencyCode, number> = {
  USDT: 1,
  USD: 1,
  EUR: 0.92,
  SAR: 3.75,
  AED: 3.6725,
  EGP: 48.5,
  LYD: 4.83,
};

/** Forme de la section `currency` de la configuration du site. */
export interface CurrencyConfig {
  /** Devise de facturation (toujours USD en pratique). */
  base: string;
  /** Taux de conversion depuis la devise de base. */
  rates: Record<string, number>;
  /** Devises proposées dans le sélecteur. */
  enabled: string[];
}

/** Devise sûre : retombe sur USD si le code est inconnu. */
export function normalizeCurrency(code: string | null | undefined): CurrencyCode {
  if (!code) return BASE_CURRENCY;
  const upper = String(code).trim().toUpperCase();
  if (upper in CURRENCY_CATALOG) return upper as CurrencyCode;
  return BASE_CURRENCY;
}

/**
 * Devises effectivement proposées : celles listées dans la configuration,
 * normalisées, dédupliquées, dans l'ordre du catalogue.
 */
export function enabledCurrencies(config?: Partial<CurrencyConfig> | null): CurrencyCode[] {
  const raw = Array.isArray(config?.enabled) ? config.enabled : DEFAULT_ENABLED_CURRENCIES;
  const wanted = new Set(raw.map((c) => normalizeCurrency(c)));
  const list = (Object.keys(CURRENCY_CATALOG) as CurrencyCode[]).filter((code) =>
    wanted.has(code),
  );
  return list.length > 0 ? list : [BASE_CURRENCY];
}

/**
 * Taux effectif d'une devise. Un taux absent ou invalide vaut 1 (la devise
 * de base) : mieux vaut afficher un prix en USD que d'afficher un prix faux.
 */
export function currencyRate(
  code: string | null | undefined,
  rates?: Record<string, number> | null,
): number {
  const normalized = normalizeCurrency(code);
  if (normalized === BASE_CURRENCY) return 1;
  const rate = rates?.[normalized];
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) return 1;
  return rate;
}

/** Convertit un montant exprimé dans la devise de base vers la devise cible. */
export function convertFromBase(
  amountBase: number,
  code: string | null | undefined,
  rates?: Record<string, number> | null,
): number {
  if (!Number.isFinite(amountBase)) return 0;
  return amountBase * currencyRate(code, rates);
}

/**
 * Formate un montant dans la devise demandée.
 *
 * Le formatage utilise toujours les chiffres latins (`latn`) même en arabe :
 * le reste du site affiche les montants en chiffres latins, et mélanger les
 * deux systèmes dans un même prix serait incohérent.
 */
export function formatMoney(
  amount: number,
  code: string | null | undefined,
  locale: "ar" | "en" = "en",
): string {
  const normalized = normalizeCurrency(code);
  const definition: CurrencyDefinition = CURRENCY_CATALOG[normalized];
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const formatter = new Intl.NumberFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-US", {
    minimumFractionDigits: definition.decimals,
    maximumFractionDigits: definition.decimals,
  });
  return `${definition.symbol}${formatter.format(safeAmount)}${definition.suffix ?? ""}`;
}

/**
 * Formatage « compact » d'un prix pour les cartes et listes de catalogue :
 * arrondi à l'unité pour les grands montants, deux décimales en dessous.
 */
export function formatMoneyCompact(
  amount: number,
  code: string | null | undefined,
  locale: "ar" | "en" = "en",
): string {
  const normalized = normalizeCurrency(code);
  const definition: CurrencyDefinition = CURRENCY_CATALOG[normalized];
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const useWhole = Math.abs(safeAmount) >= 100;
  const formatter = new Intl.NumberFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-US", {
    minimumFractionDigits: useWhole ? 0 : definition.decimals,
    maximumFractionDigits: useWhole ? 0 : definition.decimals,
  });
  return `${definition.symbol}${formatter.format(safeAmount)}${definition.suffix ?? ""}`;
}

/** Libellé court d'une devise pour le sélecteur (ex. « USD », « ر.س »). */
export function currencyShortLabel(code: string | null | undefined, locale: "ar" | "en"): string {
  const normalized = normalizeCurrency(code);
  const definition = CURRENCY_CATALOG[normalized];
  return locale === "ar" ? definition.shortAr : definition.shortEn;
}

/** Libellé long d'une devise (ex. « Dollar américain »). */
export function currencyLongLabel(code: string | null | undefined, locale: "ar" | "en"): string {
  const normalized = normalizeCurrency(code);
  const definition = CURRENCY_CATALOG[normalized];
  return locale === "ar" ? definition.labelAr : definition.labelEn;
}
