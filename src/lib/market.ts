/**
 * Marché de référence du site — cadrage « portée mondiale ».
 *
 * Le site ne doit plus être codé en dur sur Tripoli / Libye : la ville, le
 * pays, le fuseau, la devise locale, l'indicatif téléphonique et le rayon
 * de service local forment UN profil de marché, stocké dans
 * `siteConfig.market` et modifiable depuis /admin → Réglages.
 *
 * Deux leviers de portée mondiale cohabitent :
 *  - le marché par défaut (identité + SEO local, ex. Tripoli) ;
 *  - le positionnement international (`globalReach`), qui ouvre le SEO aux
 *    clients hors du pays d'origine (areaServed « World », slogan
 *    international, devise de facturation en USD).
 *
 * Ce module ne dépend d'aucun hook React : il est utilisable côté serveur
 * (SEO, API) comme côté client (barre de navigation, pied de page).
 */

/** Profil géographique & linguistique complet d'un marché. */
export interface MarketProfile {
  /** Identifiant technique du marché (ex. « ly », « ae », « global »). */
  id: string;
  /** Code pays ISO 3166-1 alpha-2 (« LY », « AE », « WW » pour le monde). */
  countryCode: string;
  /** Pays en arabe (jamais utilisé dans une balise hreflang). */
  countryAr: string;
  /** Pays en anglais. */
  countryEn: string;
  /** Ville principale en arabe. */
  cityAr: string;
  /** Ville principale en anglais. */
  cityEn: string;
  /** Fuseau IANA (ex. « Africa/Tripoli »). */
  timezone: string;
  /** Étiquette de langue BCP-47 du marché (ex. « ar-LY »). */
  locale: string;
  /** Devise locale du marché (ex. « LYD »). */
  currency: string;
  /** Symbole de la devise locale en arabe (ex. « د.ل »). */
  currencyAr: string;
  /** Symbole de la devise locale en anglais (ex. « LYD »). */
  currencyEn: string;
  /** Indicatif téléphonique international (ex. « +218 »). */
  phonePrefix: string;
  /** Latitude du point d'ancrage local. */
  lat: number;
  /** Longitude du point d'ancrage local. */
  lng: number;
  /**
   * Rayon de la zone de service locale, en kilomètres.
   * 0 = pas de zone locale (marché « monde »).
   */
  localRadiusKm: number;
}

/** Marché par défaut : Tripoli / Libye. */
export const DEFAULT_MARKET: MarketProfile = {
  id: "ly",
  countryCode: "LY",
  countryAr: "ليبيا",
  countryEn: "Libya",
  cityAr: "طرابلس",
  cityEn: "Tripoli",
  timezone: "Africa/Tripoli",
  locale: "ar-LY",
  currency: "LYD",
  currencyAr: "د.ل",
  currencyEn: "LYD",
  phonePrefix: "+218",
  lat: 32.8872,
  lng: 13.1913,
  localRadiusKm: 60,
};

/**
 * Marchés proposés dans /admin → Réglages. Un seul est actif à la fois ;
 * la liste sert de raccourci (pas de champ libre) pour éviter les fautes
 * de frappe dans un code pays ou un fuseau.
 */
export const MARKET_PRESETS: readonly MarketProfile[] = [
  DEFAULT_MARKET,
  {
    id: "ae",
    countryCode: "AE",
    countryAr: "الإمارات",
    countryEn: "United Arab Emirates",
    cityAr: "دبي",
    cityEn: "Dubai",
    timezone: "Asia/Dubai",
    locale: "ar-AE",
    currency: "AED",
    currencyAr: "د.إ",
    currencyEn: "AED",
    phonePrefix: "+971",
    lat: 25.2048,
    lng: 55.2708,
    localRadiusKm: 80,
  },
  {
    id: "sa",
    countryCode: "SA",
    countryAr: "السعودية",
    countryEn: "Saudi Arabia",
    cityAr: "الرياض",
    cityEn: "Riyadh",
    timezone: "Asia/Riyadh",
    locale: "ar-SA",
    currency: "SAR",
    currencyAr: "ر.س",
    currencyEn: "SAR",
    phonePrefix: "+966",
    lat: 24.7136,
    lng: 46.6753,
    localRadiusKm: 80,
  },
  {
    id: "eg",
    countryCode: "EG",
    countryAr: "مصر",
    countryEn: "Egypt",
    cityAr: "القاهرة",
    cityEn: "Cairo",
    timezone: "Africa/Cairo",
    locale: "ar-EG",
    currency: "EGP",
    currencyAr: "ج.م",
    currencyEn: "EGP",
    phonePrefix: "+20",
    lat: 30.0444,
    lng: 31.2357,
    localRadiusKm: 80,
  },
  {
    id: "ma",
    countryCode: "MA",
    countryAr: "المغرب",
    countryEn: "Morocco",
    cityAr: "الدار البيضاء",
    cityEn: "Casablanca",
    timezone: "Africa/Casablanca",
    locale: "ar-MA",
    currency: "MAD",
    currencyAr: "د.م.",
    currencyEn: "MAD",
    phonePrefix: "+212",
    lat: 33.5731,
    lng: -7.5898,
    localRadiusKm: 80,
  },
  {
    id: "tn",
    countryCode: "TN",
    countryAr: "تونس",
    countryEn: "Tunisia",
    cityAr: "تونس",
    cityEn: "Tunis",
    timezone: "Africa/Tunis",
    locale: "ar-TN",
    currency: "TND",
    currencyAr: "د.ت",
    currencyEn: "TND",
    phonePrefix: "+216",
    lat: 36.8065,
    lng: 10.1815,
    localRadiusKm: 80,
  },
  {
    id: "global",
    countryCode: "WW",
    countryAr: "العالم",
    countryEn: "Worldwide",
    cityAr: "عالمي",
    cityEn: "Worldwide",
    timezone: "UTC",
    locale: "ar",
    currency: "USD",
    currencyAr: "$",
    currencyEn: "$",
    phonePrefix: "",
    lat: 0,
    lng: 0,
    localRadiusKm: 0,
  },
];

/** Forme partielle tolérée dans la configuration (tous les champs optionnels). */
export type MarketConfig = Partial<MarketProfile>;

/**
 * Complète un profil de marché incomplet avec les valeurs par défaut.
 * Utilisé pour que la configuration enregistrée en base (ou une version
 * ancienne de `siteConfig`) reste toujours exploitable.
 */
export function resolveMarket(market?: MarketConfig | null): MarketProfile {
  if (!market || typeof market !== "object") return { ...DEFAULT_MARKET };
  const merged: MarketProfile = { ...DEFAULT_MARKET };
  const target = merged as unknown as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_MARKET) as (keyof MarketProfile)[]) {
    const value = market[key];
    if (value === undefined || value === null || value === "") continue;
    if (typeof DEFAULT_MARKET[key] === "number") {
      const numeric = typeof value === "number" ? value : Number(value);
      if (Number.isFinite(numeric)) {
        target[key] = numeric;
      }
      continue;
    }
    target[key] = String(value);
  }
  return merged;
}

/**
 * Libellés localisés du marché, prêts à l'emploi dans le contenu.
 * `city` = « Tripoli », `country` = « Libya », `place` = « Tripoli, Libya ».
 */
export function marketLabels(
  market: MarketProfile,
  locale: "ar" | "en",
): {
  city: string;
  country: string;
  place: string;
  currency: string;
  phonePrefix: string;
} {
  const ar = locale === "ar";
  const city = ar ? market.cityAr : market.cityEn;
  const country = ar ? market.countryAr : market.countryEn;
  return {
    city,
    country,
    place: `${city}, ${country}`,
    currency: ar ? market.currencyAr : market.currencyEn,
    phonePrefix: market.phonePrefix,
  };
}

/**
 * Étiquettes de langue du site telles qu'elles doivent apparaître dans les
 * données structurées : la langue du marché (ex. « ar-LY ») et l'anglais.
 * L'anglais est toujours présent — c'est la langue de la clientèle
 * internationale, celle que les moteurs IA et les visiteurs hors pays lisent.
 */
export function marketLanguages(market: MarketProfile): string[] {
  const languages = new Set<string>(["en"]);
  if (market.locale) languages.add(market.locale);
  return Array.from(languages);
}

/**
 * Liste `areaServed` du JSON-LD LocalBusiness.
 *
 * - `globalReach` (ou un marché « monde ») : la zone déclarée est le monde
 *   entier, ce qui débloque le référencement hors du pays d'origine ;
 * - sinon : la ville + le pays + le rayon local autour du point d'ancrage.
 */
export function marketAreaServed(
  market: MarketProfile,
  globalReach: boolean,
): Array<Record<string, unknown>> {
  if (globalReach || market.id === "global" || market.localRadiusKm <= 0) {
    return [
      { "@type": "Country", name: market.countryEn },
      { "@type": "Place", name: "Worldwide" },
    ];
  }
  return [
    { "@type": "City", name: market.cityEn },
    { "@type": "Country", name: market.countryEn },
  ];
}

/**
 * Mots-clés de localisation injectés dans le SEO d'une page.
 * Ils restent identiques quel que soit le marché : le site parle au monde,
 * le marché par défaut n'est qu'un point d'ancrage local.
 */
export function marketSeoTerms(
  market: MarketProfile,
  globalReach: boolean,
): string[] {
  const terms = [
    market.cityAr,
    market.cityEn,
    market.countryAr,
    market.countryEn,
    `web design ${market.cityEn}`,
    `web agency ${market.cityEn}`,
    `digital marketing ${market.cityEn}`,
    `تصميم مواقع ${market.cityAr}`,
    `وكالة ويب ${market.cityAr}`,
  ];
  if (globalReach) {
    terms.push("web design worldwide", "web agency international", "تصميم مواقع عالمي");
  }
  return terms;
}
