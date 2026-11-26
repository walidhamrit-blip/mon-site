/**
 * Filtres de la boutique `/codes` — source unique pour l'adresse de la page.
 *
 * Les six filtres (famille, plateforme, région, prix, tri, recherche) vivent
 * dans l'URL (`?kind=&platform=&region=&price=&sort=&q=`) : un lien partagé
 * ouvre la vitrine déjà filtrée, et le bouton retour du navigateur restaure
 * l'état précédent. Ce module est le seul endroit qui connaît les noms de
 * paramètres, leurs valeurs par défaut et leur validation — le serveur
 * (`page.tsx`) et le client (`digital-store-view.tsx`) partagent donc
 * exactement la même lecture de l'adresse.
 *
 * Les valeurs par défaut n'apparaissent PAS dans l'URL : `/codes` nu reste
 * l'adresse canonique, et les autres paramètres (`lang`, …) sont préservés
 * tels quels quand on réécrit l'adresse.
 */

import { DIGITAL_KINDS, type DigitalKind, type DigitalProduct } from "@/lib/digital-types";

/** Tranches de prix (en USD, devise de facturation). */
export const PRICE_RANGES = [
  { id: "all", min: 0, max: Infinity, ar: "كل الأسعار", en: "Any price" },
  { id: "u10", min: 0, max: 10, ar: "أقل من 10 $", en: "Under $10" },
  { id: "10-30", min: 10, max: 30, ar: "10 – 30 $", en: "$10 – $30" },
  { id: "30-100", min: 30, max: 100, ar: "30 – 100 $", en: "$30 – $100" },
  { id: "100+", min: 100, max: Infinity, ar: "أكثر من 100 $", en: "$100 & up" },
] as const;

export type PriceRangeId = (typeof PRICE_RANGES)[number]["id"];

/**
 * `popular` = ordre commercial (voir `@/lib/digital-priority`) : les recharges
 * des jeux qui tournent dans la région et les cartes des grandes boutiques
 * d'abord, à zone équivalente les zones payables en USDT avant les autres.
 * C'est l'ordre par défaut — celui du fournisseur n'a aucun sens commercial.
 */
export const SORT_IDS = ["popular", "price-asc", "price-desc", "name"] as const;

export type SortId = (typeof SORT_IDS)[number];

/** État complet des filtres de la vitrine — une seule source de vérité. */
export interface CatalogFilters {
  /** Famille de produits (`all` = toutes). */
  kind: DigitalKind | "all";
  /** Plateforme exacte du catalogue (`all` = toutes). */
  platform: string;
  /** Code de région en majuscules (`all` = toutes). */
  region: string;
  /** Tranche de prix. */
  price: PriceRangeId;
  /** Ordre d'affichage. */
  sort: SortId;
  /** Recherche libre (texte saisi, sans espaces de bord). */
  q: string;
}

/** Filtres par défaut : ceux de `/codes` sans aucun paramètre. */
export const DEFAULT_CATALOG_FILTERS: CatalogFilters = {
  kind: "all",
  platform: "all",
  region: "all",
  price: "all",
  sort: "popular",
  q: "",
};

/** Longueur maximale de la recherche dans l'adresse (évite les URL géantes). */
export const MAX_QUERY_LENGTH = 200;

/** Valeurs valides pour les facettes dynamiques (plateforme, région). */
export interface CatalogFilterValidValues {
  platforms?: ReadonlySet<string>;
  regions?: ReadonlySet<string>;
}

/** Plateformes présentes dans le catalogue (validation des liens partagés). */
export function validPlatformsFromProducts(products: DigitalProduct[]): Set<string> {
  const values = new Set<string>();
  for (const product of products) {
    const value = (product.platform ?? "").trim();
    if (value) values.add(value);
  }
  return values;
}

/** Régions présentes dans le catalogue, en majuscules (comme dans les fiches). */
export function validRegionsFromProducts(products: DigitalProduct[]): Set<string> {
  const values = new Set<string>();
  for (const product of products) {
    for (const region of [...product.regions, ...product.denominations.map((item) => item.region)]) {
      const value = (region ?? "").trim().toUpperCase();
      if (value) values.add(value);
    }
  }
  return values;
}

/** Premier élément d'un paramètre Next.js (un paramètre peut être répété). */
function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function getParam(params: URLSearchParams | Record<string, string | string[] | undefined>, key: string): string {
  if (params instanceof URLSearchParams) return params.get(key) ?? "";
  return firstParam(params[key]);
}

/**
 * Lit les filtres depuis les paramètres de l'adresse (serveur ou `popstate`).
 *
 * Toute valeur inconnue retombe sur le défaut : un lien partagé avec
 * `?platform=Foo` ou `?price=99` ouvre la vitrine non filtrée plutôt qu'une
 * grille vide incompréhensible. La plateforme est retrouvée sans tenir compte
 * de la casse (`?platform=steam` → `Steam`) et la région est normalisée en
 * majuscules, comme dans les fiches.
 */
export function parseCatalogFilters(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
  valid?: CatalogFilterValidValues,
): CatalogFilters {
  const kindValue = getParam(params, "kind");
  const kind: DigitalKind | "all" =
    kindValue === "all" || kindValue === "" ? "all" : (DIGITAL_KINDS as readonly string[]).includes(kindValue) ? (kindValue as DigitalKind) : "all";

  const platformValue = getParam(params, "platform").trim();
  let platform = "all";
  if (platformValue && platformValue !== "all") {
    if (valid?.platforms) {
      const canonical = [...valid.platforms].find((item) => item.toLowerCase() === platformValue.toLowerCase());
      platform = canonical ?? "all";
    } else {
      platform = platformValue;
    }
  }

  const regionValue = getParam(params, "region").trim().toUpperCase();
  let region = "all";
  if (regionValue && regionValue !== "ALL") {
    region = valid?.regions ? (valid.regions.has(regionValue) ? regionValue : "all") : regionValue;
  }

  const priceValue = getParam(params, "price");
  const price: PriceRangeId = (PRICE_RANGES as readonly { id: string }[]).some((item) => item.id === priceValue)
    ? (priceValue as PriceRangeId)
    : "all";

  const sortValue = getParam(params, "sort");
  const sort: SortId = (SORT_IDS as readonly string[]).includes(sortValue) ? (sortValue as SortId) : "popular";

  const q = getParam(params, "q").trim().slice(0, MAX_QUERY_LENGTH);

  return { kind, platform, region, price, sort, q };
}

/**
 * Réécrit l'adresse avec les filtres donnés, en préservant les autres
 * paramètres (`lang`, …). Les valeurs par défaut sont retirées : l'adresse
 * reste courte et `/codes` nu demeure canonique.
 */
export function applyCatalogFiltersToUrl(current: URL, filters: CatalogFilters): URL {
  const url = new URL(current.href);
  const setOrDelete = (key: string, value: string, isDefault: boolean) => {
    if (isDefault) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  };
  setOrDelete("kind", filters.kind, filters.kind === "all");
  setOrDelete("platform", filters.platform, filters.platform === "all");
  setOrDelete("region", filters.region, filters.region === "all");
  setOrDelete("price", filters.price, filters.price === "all");
  setOrDelete("sort", filters.sort, filters.sort === "popular");
  const q = filters.q.trim().slice(0, MAX_QUERY_LENGTH);
  setOrDelete("q", q, q === "");
  return url;
}
