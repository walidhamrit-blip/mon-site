/**
 * Noyau PUR de recherche des `card_id` FazerCards (cartes cadeaux).
 *
 * Pourquoi : pour relier une offre G2G à FazerCards, il faut le `card_id`
 * exact du montant (ex. « 210 + 21 Diamonds »), pas seulement le
 * `category_id` de la famille. L'administration peut accepter un lien du
 * panneau revendeur ou un identifiant brut, puis filtrer les résultats.
 *
 * Ce module ne fait AUCUN réseau, AUCUN achat et ne manipule aucune clé API.
 */

export interface FazercardsGiftCardCategoryLite {
  category_id: string;
  name: string;
}

export interface FazercardsGiftCardOfferLite {
  card_id: string;
  name: string;
  price_usd: string;
  stock: number;
  min_order_quantity: number;
  max_order_quantity: number;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CATEGORY_SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,127}$/i;
const RAW_CATEGORY_SLUG_PATTERN = /^(?=.*[-_])[a-z0-9][a-z0-9_-]{0,127}$/i;

/**
 * Extrait un `category_id` depuis :
 *   - un UUID brut ou contenu dans un texte ;
 *   - un slug brut (ex. `playstation_sa`) ;
 *   - un lien du panneau revendeur, ex. `/panel/giftcard/<category_id>`.
 *
 * Renvoie `null` si aucun identifiant exploitable n'est trouvé. Les recherches
 * par nom avec des espaces restent des recherches, pas des identifiants.
 */
export function extractFazercardsGiftCardCategoryId(input: string): string | null {
  const trimmed = (input ?? "").trim();
  if (!trimmed) return null;

  if (UUID_PATTERN.test(trimmed)) return trimmed.toLowerCase();
  if (RAW_CATEGORY_SLUG_PATTERN.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    const segments = url.pathname.split("/").filter(Boolean);
    // Le panneau place l'identifiant après /panel/giftcard/.
    const giftCardIndex = segments.lastIndexOf("giftcard");
    const linkedId = giftCardIndex >= 0 ? segments[giftCardIndex + 1] : undefined;
    if (linkedId && CATEGORY_SLUG_PATTERN.test(linkedId)) {
      return UUID_PATTERN.test(linkedId) ? linkedId.toLowerCase() : linkedId;
    }
    // Compatibilité avec tout texte ou lien contenant un UUID.
    for (let i = segments.length - 1; i >= 0; i -= 1) {
      const segment = segments[i];
      if (UUID_PATTERN.test(segment)) return segment.toLowerCase();
    }
  } catch {
    // Pas une URL : on tente une extraction texte ci-dessous.
  }

  const match = trimmed.match(UUID_PATTERN);
  return match ? match[0].toLowerCase() : null;
}

/** Normalise une recherche : accents, casse, séparateurs. */
export function normalizeFazercardsLookupText(value: string): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matchesQuery(haystack: string, query: string): boolean {
  const normalized = normalizeFazercardsLookupText(query);
  if (!normalized) return true;
  const target = normalizeFazercardsLookupText(haystack);
  return normalized.split(" ").every((term) => target.includes(term));
}

/** Filtre des catégories par nom (tous les termes doivent être présents). */
export function filterFazercardsGiftCardCategories<T extends FazercardsGiftCardCategoryLite>(
  items: readonly T[],
  query: string,
): T[] {
  return items.filter((item) => matchesQuery(item.name, query));
}

/** Filtre des montants par nom ou `card_id`. */
export function filterFazercardsGiftCardOffers<T extends FazercardsGiftCardOfferLite>(
  items: readonly T[],
  query: string,
): T[] {
  return items.filter(
    (item) => matchesQuery(item.name, query) || matchesQuery(item.card_id, query),
  );
}

/** Formate un prix USD fournisseur pour l'affichage admin. */
export function formatFazercardsUsd(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string" && value.trim() === "") return "—";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return `${amount.toFixed(2)} $`;
}

/* ------------------ Vérification d'un SKU avant activation ------------------ */

/**
 * Résultat de la vérification d'un `card_id` / `key_id` avant enregistrement.
 *
 * Pourquoi c'est nécessaire : une correspondance G2G ↔ FazerCards repose sur
 * un identifiant COLLÉ À LA MAIN. Une faute de frappe passerait totalement
 * inaperçue jusqu'à la phase 2, où elle livrerait le mauvais produit à un
 * client réel qui a déjà payé. Tant qu'on n'a pas prouvé que le SKU existe,
 * on ne doit pas pouvoir activer la correspondance.
 *
 * `unavailable` est distingué de `not_found` à dessein : « FazerCards est
 * injoignable » et « ce card_id n'existe pas » n'appellent pas du tout la
 * même action, même si les deux empêchent l'activation.
 */
export type FazercardsSkuCheck =
  /** Le SKU existe chez FazerCards : nom et prix résolus. */
  | "verified"
  /** La catégorie a été listée, mais ce SKU n'y figure pas. */
  | "not_found"
  /** FazerCards injoignable ou non configuré : rien ne peut être prouvé. */
  | "unavailable"
  /** Identifiants incomplets : il n'y a rien à vérifier. */
  | "missing_ids";

export interface FazercardsSkuCheckResult {
  status: FazercardsSkuCheck;
  /** Nom canonique résolu chez FazerCards (preuve affichable). */
  name: string;
  /** Prix fournisseur au moment de la vérification. */
  priceUsd: string;
  stock: number | null;
}

const EMPTY_CHECK: FazercardsSkuCheckResult = {
  status: "missing_ids",
  name: "",
  priceUsd: "",
  stock: null,
};

/**
 * Vérifie qu'un `card_id` figure bien dans les offres d'une catégorie.
 *
 * @param offers liste renvoyée par FazerCards, ou `null` si l'appel a échoué
 *               (injoignable, non configuré, erreur renvoyée).
 */
export function checkFazercardsGiftCardSku(input: {
  offers: readonly FazercardsGiftCardOfferLite[] | null;
  cardId: string;
}): FazercardsSkuCheckResult {
  const cardId = (input.cardId ?? "").trim();
  if (!cardId) return EMPTY_CHECK;

  // `null` = l'appel n'a pas abouti. Ce n'est PAS une preuve d'absence.
  if (input.offers === null) {
    return { status: "unavailable", name: "", priceUsd: "", stock: null };
  }

  const exact = input.offers.find((offer) => offer.card_id === cardId);
  const resolved = exact ?? input.offers.find(
    (offer) => (offer.card_id ?? "").trim().toLowerCase() === cardId.toLowerCase(),
  );
  if (!resolved) {
    return { status: "not_found", name: "", priceUsd: "", stock: null };
  }

  return {
    status: "verified",
    name: resolved.name ?? "",
    priceUsd: resolved.price_usd ?? "",
    stock: Number.isFinite(Number(resolved.stock)) ? Number(resolved.stock) : null,
  };
}

/**
 * Règle d'activation : une correspondance ne peut être activée que si le SKU
 * a été prouvé présent chez FazerCards. Fail-closed, sans exception — y
 * compris quand FazerCards est injoignable (l'activation se retentera).
 */
export function canEnableFazercardsSku(check: FazercardsSkuCheckResult): boolean {
  return check.status === "verified";
}
