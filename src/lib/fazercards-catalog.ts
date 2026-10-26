// Adaptateur catalogue FazerCards → DigitalProduct.
//
// FazerCards expose des catégories avec des offres (offers / cards / keys) :
//   GET /topups          → catégories (category_id)
//   GET /topups/offers   → offres (offer_id, price_usd, fields dynamiques)
//   GET /giftcards       → catégories (category_id)
//   GET /giftcards/cards → offres (card_id, price_usd, stock, qty min/max)
//   GET /gamekeys        → catégories (game_id)
//   GET /gamekeys/keys   → offres (key_id, price_usd, stock)
//
// Cet adaptateur récupère le catalogue FazerCards et le transforme en
// DigitalProduct / DigitalDenomination pour affichage sur `/codes`, puis
// permet de passer commande chez FazerCards via fazercards.ts.
//
// Aucun appel réseau côté client : tout passe par ce module serveur.

import {
  fazercardsGameKeys,
  fazercardsGameKeyKeys,
  fazercardsGiftCardCards,
  fazercardsGiftCards,
  fazercardsTopups,
  fazercardsTopupOffers,
  type FazercardsGameKeyCategory,
  type FazercardsGameKeySku,
  type FazercardsGiftCardCategory,
  type FazercardsGiftCardOffer,
  type FazercardsTopupCategory,
  type FazercardsTopupOffer,
} from "@/lib/fazercards";
import { after } from "next/server";
import {
  readStoredFazercardsCatalog,
  writeStoredFazercardsCatalog,
} from "@/lib/fazercards-catalog-store";
import {
  DIGITAL_KINDS,
  type DigitalDenomination,
  type DigitalProduct,
} from "@/lib/digital-types";

/* --------------------------------- Types --------------------------------- */

/** Produit FazerCards plat, prêt à l'affichage et à la commande. */
export interface FazercardsProduct {
  id: string; // identifiant stable (slug-friendly)
  slug: string;
  kind: (typeof DIGITAL_KINDS)[number];
  platform: string;
  categoryId: string; // category_id / game_id FazerCards
  countryCode: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  image: string;
  regions: string[];
  denominations: FazercardsDenomination[];
  /** Mode de livraison effectif (toujours « auto » chez FazerCards si la clé est configurée). */
  fulfillment: "auto" | "manual";
  marginPercent: number | null;
  supplierFeePercent: number | null;
  supplierDiscountPercent: number | null;
}

/** Dénomination FazerCards (une offre / carte / clé). */
export interface FazercardsDenomination {
  id: string; // offer_id / card_id / key_id
  label: string;
  faceValue: string; // ex. « 10 USD », « 60 UC », « 500 TRY »
  region: string;
  priceUsd: number; // prix de vente calculé (coût + marge)
  available: boolean;
  stock: number | null;
  minOrderQuantity: number;
  maxOrderQuantity: number;
  /** Identifiant fournisseur à transmettre à l'achat (offer_id / card_id / key_id). */
  supplierOfferId: string;
  /** Prix fournisseur brut (price_usd de FazerCards, en USD). */
  supplierCostUsd: number | null;
  /** Champs acheteur dynamiques (top-ups : player_id, …). */
  fields: { key: string; label: string; type: string }[];
}

/** Résultat de synchronisation. */
export interface FazercardsSyncResult {
  products: FazercardsProduct[];
  total: number;
  errors: string[];
}

/* ------------------------------ Helpers ------------------------------ */

const DEFAULT_MARGIN = 8; // % net visé par défaut
// Aucun visuel fourni par FazerCards : la carte affiche ses initiales
// plutôt qu'une image cassée (le composant gère `image` vide).
const DEFAULT_IMAGE = "";

/**
 * Préfixes de slug des produits servis par FazerCards. Ils constituent le
 * marqueur fiable d'appartenance à ce fournisseur : le checkout FazerCards
 * enregistre le slug du produit dans `digitalOrders.productSlug`, et c'est
 * ce préfixe qui permet à la livraison (IPN, admin) de router la commande
 * vers le bon fournisseur sans modifier le schéma de la base.
 */
export const FAZERCARDS_SLUG_PREFIXES = [
  "fzr-topup-",
  "fzr-giftcard-",
  "fzr-gamekey-",
] as const;

/** Vrai si le slug / identifiant de produit provient de FazerCards. */
export function isFazercardsProductSlug(value: string | null | undefined): boolean {
  const slug = (value ?? "").trim().toLowerCase();
  if (!slug) return false;
  return FAZERCARDS_SLUG_PREFIXES.some((prefix) => slug.startsWith(prefix));
}

/** Vrai si l'une des valeurs fournies (slug, id) désigne un produit FazerCards. */
export function isFazercardsProductRef(
  ...values: (string | null | undefined)[]
): boolean {
  return values.some((value) => isFazercardsProductSlug(value));
}

function toSlug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function toPriceUsd(value: string | null | undefined): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Titre public d'une fiche : « Game Top-Up — 8 Ball Pool ».
 *
 * ⚠️ Les clés sont les valeurs de `DIGITAL_KINDS` (`game_topup`,
 * `gift_card`, `software_key`) — pas celles du fournisseur (`topup`,
 * `game_key`). Une clé inconnue retombait sur « Digital Product », ce qui
 * affichait un titre générique sur les 120 fiches du catalogue réel.
 */
function titleFor(kind: string, name: string, locale: "ar" | "en"): string {
  const labels: Record<string, { ar: string; en: string }> = {
    game_topup: { ar: "شحن لعبة", en: "Game Top-Up" },
    gift_card: { ar: "بطاقة هدايا", en: "Gift Card" },
    software_key: { ar: "مفتاح لعبة", en: "Game Key" },
    subscription_code: { ar: "كود اشتراك", en: "Subscription Code" },
  };
  const base = labels[kind] ?? { ar: "منتج رقمي", en: "Digital Product" };
  return `${base[locale]} — ${name}`;
}

/* ------------------------------ Mappers ------------------------------ */

/** Transforme une catégorie + offres top-up en FazercardsProduct. */
function mapTopupCategory(
  cat: FazercardsTopupCategory,
  offers: FazercardsTopupOffer[],
  fields: { key: string; label: string; type: string }[],
): FazercardsProduct {
  const denominations: FazercardsDenomination[] = offers.map((offer) => {
    const cost = toPriceUsd(offer.price_usd);
    return {
      id: offer.offer_id,
      label: offer.name,
      faceValue: `${offer.name}`,
      region: "GLOBAL",
      priceUsd: cost != null ? Math.round((cost / (1 - DEFAULT_MARGIN / 100)) * 100) / 100 : 0,
      available: true,
      stock: null,
      minOrderQuantity: 1,
      maxOrderQuantity: 10,
      supplierOfferId: offer.offer_id,
      supplierCostUsd: cost,
      fields,
    };
  });

  return {
    id: `fzr-topup-${cat.category_id}`,
    slug: `fzr-topup-${toSlug(cat.name)}`,
    kind: "game_topup",
    platform: cat.name,
    categoryId: cat.category_id,
    countryCode: "GLOBAL",
    titleAr: titleFor("game_topup", cat.name, "ar"),
    titleEn: titleFor("game_topup", cat.name, "en"),
    descriptionAr: `شحن رصيد لعبة ${cat.name} — تسليم فوري إلى بريدك الإلكتروني بعد تأكيد الدفع.`,
    descriptionEn: `Top-up for ${cat.name} — instant delivery to your e-mail after payment.`,
    image: DEFAULT_IMAGE,
    regions: ["GLOBAL"],
    denominations,
    fulfillment: "auto",
    marginPercent: DEFAULT_MARGIN,
    supplierFeePercent: null,
    supplierDiscountPercent: null,
  };
}

/** Transforme une catégorie + offres carte cadeau en FazercardsProduct. */
function mapGiftCardCategory(
  cat: FazercardsGiftCardCategory,
  cards: FazercardsGiftCardOffer[],
): FazercardsProduct {
  const denominations: FazercardsDenomination[] = cards.map((card) => {
    const cost = toPriceUsd(card.price_usd);
    return {
      id: card.card_id,
      label: card.name,
      faceValue: card.name,
      region: "GLOBAL",
      priceUsd: cost != null ? Math.round((cost / (1 - DEFAULT_MARGIN / 100)) * 100) / 100 : 0,
      available: card.stock > 0,
      stock: card.stock ?? null,
      minOrderQuantity: card.min_order_quantity,
      maxOrderQuantity: card.max_order_quantity,
      supplierOfferId: card.card_id,
      supplierCostUsd: cost,
      fields: [],
    };
  });

  return {
    id: `fzr-giftcard-${cat.category_id}`,
    slug: `fzr-giftcard-${toSlug(cat.name)}`,
    kind: "gift_card",
    platform: cat.name,
    categoryId: cat.category_id,
    countryCode: "GLOBAL",
    titleAr: titleFor("gift_card", cat.name, "ar"),
    titleEn: titleFor("gift_card", cat.name, "en"),
    descriptionAr: `بطاقة هدايا ${cat.name} — تسليم فوري إلى بريدك الإلكتروني بعد تأكيد الدفع.`,
    descriptionEn: `${cat.name} gift card — instant delivery to your e-mail after payment.`,
    image: DEFAULT_IMAGE,
    regions: ["GLOBAL"],
    denominations,
    fulfillment: "auto",
    marginPercent: DEFAULT_MARGIN,
    supplierFeePercent: null,
    supplierDiscountPercent: null,
  };
}

/** Transforme une catégorie + clés de jeu en FazercardsProduct. */
function mapGameKeyCategory(
  cat: FazercardsGameKeyCategory,
  skus: FazercardsGameKeySku[],
): FazercardsProduct {
  const denominations: FazercardsDenomination[] = skus.map((sku) => {
    const cost = toPriceUsd(sku.price_usd);
    return {
      id: sku.key_id,
      label: sku.name,
      faceValue: sku.name,
      region: cat.region,
      priceUsd: cost != null ? Math.round((cost / (1 - DEFAULT_MARGIN / 100)) * 100) / 100 : 0,
      available: sku.stock > 0,
      stock: sku.stock ?? null,
      minOrderQuantity: sku.min_order_quantity,
      maxOrderQuantity: sku.max_order_quantity,
      supplierOfferId: sku.key_id,
      supplierCostUsd: cost,
      fields: [],
    };
  });

  return {
    id: `fzr-gamekey-${cat.game_id}`,
    slug: `fzr-gamekey-${toSlug(cat.name)}`,
    kind: "software_key",
    platform: cat.platform,
    categoryId: cat.game_id,
    countryCode: cat.region,
    titleAr: titleFor("software_key", cat.name, "ar"),
    titleEn: titleFor("software_key", cat.name, "en"),
    descriptionAr: `مفتاح تفعيل ${cat.name} (${cat.region}) — تسليم فوري إلى بريدك الإلكتروني.`,
    descriptionEn: `Activation key for ${cat.name} (${cat.region}) — instant delivery to your e-mail.`,
    image: DEFAULT_IMAGE,
    regions: [cat.region],
    denominations,
    fulfillment: "auto",
    marginPercent: DEFAULT_MARGIN,
    supplierFeePercent: null,
    supplierDiscountPercent: null,
  };
}

/* ------------------------------ Synchronisation ------------------------------ */

/**
 * Récupère le catalogue FazerCards (top-ups, cartes cadeaux, clés jeux)
 * et le convertit en produits FazercardsProduct prêts à l'affichage.
 *
 * Cette fonction ne touche pas à la base de données : elle sert de source
 * de vérité pour l'affichage et la commande chez FazerCards.
 */
/** Nombre de catégories traitées simultanément (borne la charge fournisseur). */
function catalogConcurrency(): number {
  const raw = Number(process.env.FAZERCARDS_CATALOG_CONCURRENCY);
  return Number.isFinite(raw) && raw >= 1 && raw <= 12 ? Math.floor(raw) : 6;
}

/**
 * Plafond de catégories par famille (top-ups, cartes, clés).
 *
 * Une synchronisation coûte UN appel HTTP par catégorie : sans plafond, la
 * première ouverture de `/codes` après un déploiement pouvait enchaîner des
 * centaines de requêtes (plusieurs minutes) avant d'afficher quoi que ce
 * soit. Les catégories sont celles que renvoie l'API, dans son ordre :
 * plafonner ne « perd » donc que la queue du catalogue.
 */
function catalogMaxCategories(): number {
  const raw = Number(process.env.FAZERCARDS_CATALOG_MAX_CATEGORIES);
  return Number.isFinite(raw) && raw >= 1 && raw <= 100 ? Math.floor(raw) : 40;
}

/** Applique `worker` sur `items` avec une concurrence bornée. */
async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index]);
    }
  });
  await Promise.all(runners);
}

export async function syncFazercardsCatalog(): Promise<FazercardsSyncResult> {
  const products: FazercardsProduct[] = [];
  const errors: string[] = [];
  const limit = catalogMaxCategories();
  const concurrency = catalogConcurrency();

  // ---------- Top-ups (recharges de jeux) ----------
  try {
    const topups = await fazercardsTopups(limit);
    const mapped: FazercardsProduct[] = [];
    await mapWithConcurrency(topups.items.slice(0, limit), concurrency, async (cat) => {
      try {
        const offers = await fazercardsTopupOffers(cat.category_id);
        // Les champs acheteurs (player_id…) viennent de la catégorie.
        const fields: { key: string; label: string; type: string }[] = offers.fields.map((f) => ({
          key: f.key,
          label: f.label,
          type: f.type,
        }));
        mapped.push(mapTopupCategory(cat, offers.offers, fields));
      } catch (error) {
        errors.push(`topup ${cat.category_id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
    products.push(...mapped);
  } catch (error) {
    errors.push(`topups list: ${error instanceof Error ? error.message : String(error)}`);
  }

  // ---------- Cartes cadeaux ----------
  try {
    const giftcards = await fazercardsGiftCards(limit);
    const mapped: FazercardsProduct[] = [];
    await mapWithConcurrency(giftcards.items.slice(0, limit), concurrency, async (cat) => {
      try {
        const cards = await fazercardsGiftCardCards(cat.category_id);
        mapped.push(mapGiftCardCategory(cat, cards.offers));
      } catch (error) {
        errors.push(`giftcard ${cat.category_id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
    products.push(...mapped);
  } catch (error) {
    errors.push(`giftcards list: ${error instanceof Error ? error.message : String(error)}`);
  }

  // ---------- Clés de jeux ----------
  try {
    const gamekeys = await fazercardsGameKeys(limit);
    const mapped: FazercardsProduct[] = [];
    await mapWithConcurrency(gamekeys.items.slice(0, limit), concurrency, async (cat) => {
      try {
        const skus = await fazercardsGameKeyKeys(cat.game_id);
        mapped.push(mapGameKeyCategory(cat, skus.keys));
      } catch (error) {
        errors.push(`gamekey ${cat.game_id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
    products.push(...mapped);
  } catch (error) {
    errors.push(`gamekeys list: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    products,
    total: products.length,
    errors,
  };
}

/** Recherche un produit FazerCards par slug (après synchronisation). */
export function findFazercardsProduct(
  products: FazercardsProduct[],
  slug: string,
): FazercardsProduct | null {
  return products.find((p) => p.slug === slug) ?? null;
}

/** Recherche une dénomination FazerCards par identifiant d'offre. */
export function findFazercardsDenomination(
  product: FazercardsProduct,
  denominationId: string,
): FazercardsDenomination | null {
  return product.denominations.find((d) => d.id === denominationId) ?? null;
}

/* ------------------------------ Devis serveur ------------------------------ */

/**
 * Calcule un devis serveur pour une commande FazerCards.
 * Le navigateur ne transmet que l'identifiant de produit et la quantité ;
 * le prix vient du catalogue FazerCards (coût fournisseur + marge).
 */
export interface FazercardsQuote {
  denominationId: string;
  label: string;
  faceValue: string;
  region: string;
  quantity: number;
  unitPriceUsd: number;
  totalUsd: number;
  supplierCostUsd: number | null;
  supplierOfferId: string;
  fields: { key: string; label: string; type: string }[];
  categoryId: string;
}

export type FazercardsQuoteResult =
  | { ok: true; quote: FazercardsQuote }
  | { ok: false; error: string; message: string };

export function quoteFazercardsOrder(
  product: FazercardsProduct | null,
  denominationId: string,
  quantityInput: unknown,
): FazercardsQuoteResult {
  if (!product) {
    return { ok: false, error: "product_not_found", message: "Produit introuvable." };
  }
  if (product.fulfillment !== "auto" && product.fulfillment !== "manual") {
    return {
      ok: false,
      error: "product_not_sellable",
      message: "Ce produit n'est pas encore en vente.",
    };
  }

  const denomination = product.denominations.find((item) => item.id === String(denominationId));
  if (!denomination) {
    return { ok: false, error: "denomination_not_found", message: "Montant introuvable pour ce produit." };
  }
  if (!denomination.available) {
    return { ok: false, error: "denomination_not_sellable", message: "Ce montant n'est plus disponible." };
  }

  const quantity = Number(quantityInput ?? 1);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > denomination.maxOrderQuantity) {
    return {
      ok: false,
      error: "invalid_quantity",
      message: `Quantité invalide (1 à ${denomination.maxOrderQuantity}).`,
    };
  }

  const unitPriceUsd = Math.round(denomination.priceUsd * 100) / 100;
  if (!Number.isFinite(unitPriceUsd) || unitPriceUsd <= 0) {
    return { ok: false, error: "invalid_price", message: "Prix du produit non configuré." };
  }

  return {
    ok: true,
    quote: {
      denominationId: denomination.id,
      label: denomination.label,
      faceValue: denomination.faceValue,
      region: denomination.region,
      quantity,
      unitPriceUsd,
      totalUsd: Math.round(unitPriceUsd * quantity * 100) / 100,
      supplierCostUsd: denomination.supplierCostUsd,
      supplierOfferId: denomination.supplierOfferId,
      fields: denomination.fields,
      categoryId: product.categoryId,
    },
  };
}

/* ------------------------------ Cache catalogue --------------------------- */

/**
 * Le catalogue FazerCards coûte UN appel par catégorie (top-ups, cartes,
 * clés) : plusieurs dizaines de requêtes HTTP. Le refaire à chaque
 * consultation de `/codes` ou à chaque checkout serait lent (plusieurs
 * secondes), fragile (un 429 sur une catégorie suffit à dégrader la vente)
 * et inutile — les prix et le stock ne bougent pas à la seconde.
 *
 * Ce cache mémoire (par instance du serveur) :
 *   • sert un catalogue frais sans aucun appel réseau tant qu'il a moins de
 *     `FAZERCARDS_CATALOG_TTL_SECONDS` (600 s / 10 min par défaut) ;
 *   • ne lance JAMAIS deux synchronisations en parallèle : les requêtes
 *     concurrentes (plusieurs visiteurs, IPN) partagent la même promesse ;
 *   • continue de servir le dernier catalogue connu si le rafraîchissement
 *     échoue (panne fournisseur, 429), jusqu'à `FAZERCARDS_CATALOG_MAX_STALE_MINUTES`
 *     (60 min par défaut) — mieux vaut vendre au prix d'il y a 20 minutes
 *     que refuser la vente ;
 *   • n'écrase jamais un catalogue valide par une synchronisation vide
 *     (clé API absente, panne totale).
 */

const DEFAULT_CATALOG_TTL_SECONDS = 600;
const DEFAULT_CATALOG_MAX_STALE_MINUTES = 60;

/** Durée de fraîcheur du catalogue, en millisecondes. */
export function fazercardsCatalogTtlMs(): number {
  const raw = Number(process.env.FAZERCARDS_CATALOG_TTL_SECONDS);
  const seconds =
    Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_CATALOG_TTL_SECONDS;
  return Math.round(seconds * 1000);
}

/** Âge maximal d'un catalogue périmé encore utilisable en cas de panne. */
export function fazercardsCatalogMaxStaleMs(): number {
  const raw = Number(process.env.FAZERCARDS_CATALOG_MAX_STALE_MINUTES);
  const minutes =
    Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_CATALOG_MAX_STALE_MINUTES;
  return Math.round(minutes * 60_000);
}

/** Catalogue FazerCards + métadonnées de cache. */
export interface FazercardsCatalogSnapshot extends FazercardsSyncResult {
  /** Date de la synchronisation réellement utilisée (ISO). */
  fetchedAt: string;
  /** Âge du catalogue au moment de la réponse, en millisecondes. */
  ageMs: number;
  /** true = servi depuis le cache sans appel réseau. */
  cached: boolean;
  /** true = périmé mais conservé faute de rafraîchissement réussi. */
  stale: boolean;
}

interface CatalogCacheEntry {
  result: FazercardsSyncResult;
  fetchedAt: number;
}

let catalogCache: CatalogCacheEntry | null = null;
let catalogInflight: Promise<FazercardsSyncResult> | null = null;
/** Horodatage de la dernière tentative de rafraîchissement d'arrière-plan. */
let lastRefreshAttempt = 0;

/** Vide le cache (après un changement de clé API ou une synchro admin). */
export function invalidateFazercardsCatalogCache(): void {
  catalogCache = null;
}

/** État du cache — diagnostic admin, sans aucun secret. */
export function fazercardsCatalogCacheStatus(): {
  cached: boolean;
  products: number;
  ageMs: number | null;
  fetchedAt: string | null;
  refreshing: boolean;
  ttlMs: number;
  maxStaleMs: number;
} {
  const ttlMs = fazercardsCatalogTtlMs();
  return {
    cached: catalogCache !== null,
    products: catalogCache?.result.products.length ?? 0,
    ageMs: catalogCache ? Date.now() - catalogCache.fetchedAt : null,
    fetchedAt: catalogCache
      ? new Date(catalogCache.fetchedAt).toISOString()
      : null,
    refreshing: catalogInflight !== null,
    ttlMs,
    maxStaleMs: fazercardsCatalogMaxStaleMs(),
  };
}

/**
 * Synchronisation à vol unique : si une synchro est déjà en cours, tous les
 * appelants attendent la même promesse au lieu d'en lancer une nouvelle.
 * Un résultat vide (aucun produit) n'est jamais mis en cache : il ne doit
 * pas effacer un catalogue valide.
 */
function refreshFazercardsCatalog(): Promise<FazercardsSyncResult> {
  if (catalogInflight) return catalogInflight;

  catalogInflight = syncFazercardsCatalog()
    .then(async (result) => {
      if (result.products.length > 0) {
        const fetchedAt = Date.now();
        catalogCache = { result, fetchedAt };
        // Copie partagée : les autres instances (et les rendus suivants)
        // lisent cette version en une requête, sans re-synchroniser.
        await writeStoredFazercardsCatalog(result, fetchedAt);
      }
      return result;
    })
    .finally(() => {
      catalogInflight = null;
    });

  return catalogInflight;
}

/**
 * Planifie une synchronisation APRÈS la réponse HTTP.
 *
 * Le plan Vercel Hobby n'autorise qu'un cron par jour : sans cela, les prix
 * et le stock resteraient figés jusqu'au lendemain. `after()` exécute la
 * tâche dans la même invocation, une fois la réponse envoyée — l'utilisateur
 * n'attend jamais la synchronisation.
 *
 * Best effort : hors contexte de requête Next (script, test), `after` lève —
 * on ignore simplement.
 */
function scheduleBackgroundRefresh(ttlMs: number): void {
  // Ne pas relancer une synchro déjà en cours, ni insister à chaque requête
  // (une page très visitée ne doit pas déclencher une synchro par visite) :
  // au plus une tentative toutes les demi-périodes de cache.
  if (catalogInflight) return;
  if (Date.now() - lastRefreshAttempt < ttlMs / 2) return;
  lastRefreshAttempt = Date.now();
  try {
    after(async () => {
      try {
        await refreshFazercardsCatalog();
      } catch (error) {
        console.warn(
          "[fazercards][catalogue] rafraîchissement d'arrière-plan impossible :",
          error instanceof Error ? error.message : error,
        );
      }
    });
  } catch {
    // Hors requête Next : le cron quotidien prendra le relais.
  }
}

function snapshot(
  entry: CatalogCacheEntry,
  meta: { cached: boolean; stale: boolean },
): FazercardsCatalogSnapshot {
  return {
    ...entry.result,
    fetchedAt: new Date(entry.fetchedAt).toISOString(),
    ageMs: Date.now() - entry.fetchedAt,
    cached: meta.cached,
    stale: meta.stale,
  };
}

/**
 * Catalogue FazerCards, servi depuis le cache quand il est frais.
 *
 * @param options.maxAgeMs  âge maximal accepté sans appel réseau (défaut :
 *                          `FAZERCARDS_CATALOG_TTL_SECONDS`).
 * @param options.force     force une resynchronisation (cron / admin).
 * @param options.noSync    **ne jamais synchroniser** : sert la copie
 *                          mémoire ou en base, même périmée, et échoue s'il
 *                          n'y en a aucune. C'est le mode du RENDU des
 *                          pages : une synchronisation complète (~123
 *                          appels HTTP) dépasse le temps d'exécution d'une
 *                          fonction serverless, ce qui faisait expirer les
 *                          pages (repli silencieux sur le catalogue
 *                          historique, ou erreur 500 sur les fiches).
 */
export async function getFazercardsCatalog(
  options: { maxAgeMs?: number; force?: boolean; noSync?: boolean } = {},
): Promise<FazercardsCatalogSnapshot> {
  const ttlMs = options.maxAgeMs ?? fazercardsCatalogTtlMs();
  let cache = catalogCache;

  // Rien en mémoire (instance neuve) : on lit la copie partagée en base
  // AVANT d'envisager une synchronisation complète. C'est ce qui rend le
  // rendu des pages rapide et fiable — une synchro (~123 appels HTTP)
  // dépasserait le temps d'exécution d'une fonction serverless.
  if (!cache) {
    const stored = await readStoredFazercardsCatalog();
    if (stored) {
      catalogCache = { result: stored.result, fetchedAt: stored.fetchedAt };
      cache = catalogCache;
    }
  }

  if (!options.force && cache) {
    const ageMs = Date.now() - cache.fetchedAt;
    if (ageMs < ttlMs) {
      return snapshot(cache, { cached: true, stale: false });
    }

    // Rendu de page : on sert TOUT DE SUITE la copie existante, puis on
    // planifie le rafraîchissement APRÈS l'envoi de la réponse (`after`).
    // Synchroniser ici ferait expirer la requête ; ne rien planifier
    // figerait le catalogue entre deux crons (une fois par jour sur Hobby).
    if (options.noSync) {
      scheduleBackgroundRefresh(ttlMs);
      return snapshot(cache, { cached: true, stale: true });
    }

    try {
      const refreshed = await refreshFazercardsCatalog();
      const entry = catalogCache ?? { result: refreshed, fetchedAt: Date.now() };
      return snapshot(entry, { cached: false, stale: false });
    } catch (error) {
      const maxStaleMs = Math.max(ttlMs, fazercardsCatalogMaxStaleMs());
      const usableStale = ageMs <= maxStaleMs && cache.result.products.length > 0;
      console.warn(
        `[fazercards][catalogue] rafraîchissement impossible (${
          error instanceof Error ? error.message : String(error)
        })${usableStale ? ` — catalogue de ${Math.round(ageMs / 60000)} min servi` : ""}`,
      );
      if (usableStale) return snapshot(cache, { cached: true, stale: true });
      throw error;
    }
  }

  // Aucune copie disponible : sans synchronisation autorisée, l'appelant
  // doit se rabattre sur le catalogue historique.
  if (options.noSync) {
    throw new Error("Catalogue FazerCards indisponible (aucune copie en cache).");
  }

  const result = await refreshFazercardsCatalog();
  const entry = catalogCache ?? { result, fetchedAt: Date.now() };
  return snapshot(entry, {
    cached: entry.result !== result,
    stale: false,
  });
}

/* ------------------- Adaptateur vers le domaine public ------------------- */

/**
 * Couleurs de repli, purement décoratives (la pastille de la carte). Elles
 * sont choisies de façon déterministe à partir du slug : une même fiche
 * garde la même couleur d'un déploiement à l'autre.
 */
const FALLBACK_COLORS = [
  "#1B2838", // bleu nuit (Steam)
  "#003791", // bleu (PlayStation)
  "#107C10", // vert (Xbox)
  "#E2231A", // rouge
  "#01875F", // vert profond (Google Play)
  "#6B21A8", // violet
  "#B45309", // ambre
  "#0F766E", // sarcelle
];

function fallbackColor(slug: string): string {
  let hash = 0;
  for (let index = 0; index < slug.length; index += 1) {
    hash = (hash * 31 + slug.charCodeAt(index)) % 100000;
  }
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}

/**
 * Convertit une fiche FazerCards au format du domaine (`DigitalProduct`),
 * celui qu'attendent la vitrine `/codes`, la fiche produit et le dialogue
 * d'achat. Aucun composant d'affichage n'est modifié : seule la SOURCE du
 * catalogue change.
 *
 * Points volontaires :
 *  - `supplier: "fazercards"` : le navigateur sait ainsi à quelle caisse
 *    s'adresser, sans deviner un préfixe de slug ;
 *  - `status: "available"` : une fiche n'apparaît que si le fournisseur la
 *    liste encore ; une offre sans montant vendable est filtrée plus bas ;
 *  - les champs acheteur (`fields`) voyagent avec la dénomination : la
 *    caisse les demande avant de créer la facture.
 */
export function fazercardsProductToDigital(
  product: FazercardsProduct,
  index: number,
): DigitalProduct {
  const regions = Array.from(
    new Set(
      product.denominations
        .map((denomination) => denomination.region.toUpperCase())
        .concat(product.regions.map((region) => region.toUpperCase()))
        .filter((region) => region !== ""),
    ),
  );

  const denominations: DigitalDenomination[] = product.denominations
    .filter((denomination) => Number.isFinite(denomination.priceUsd) && denomination.priceUsd > 0)
    .map((denomination) => ({
      id: denomination.id,
      label: denomination.label,
      faceValue: denomination.faceValue,
      region: denomination.region.toUpperCase() || "GLOBAL",
      priceUsd: denomination.priceUsd,
      available: denomination.available,
      supplierCostUsd: denomination.supplierCostUsd,
      fields: denomination.fields,
      maxQuantity: denomination.maxOrderQuantity,
    }));

  return {
    id: product.id,
    slug: product.slug,
    kind: product.kind,
    status: "available",
    platform: product.platform,
    color: fallbackColor(product.slug),
    titleAr: product.titleAr,
    titleEn: product.titleEn,
    descriptionAr: product.descriptionAr,
    descriptionEn: product.descriptionEn,
    image: product.image,
    regions: regions.length > 0 ? regions : ["GLOBAL"],
    featuresAr: [
      "تسليم فوري إلى بريدك الإلكتروني",
      "دفع بالعملات الرقمية (USDT وغيرها)",
      "كود أصلي من الموزّع الرسمي",
    ],
    featuresEn: [
      "Instant delivery to your e-mail",
      "Crypto payment (USDT and others)",
      "Genuine code from the official distributor",
    ],
    deliveryNoteAr: "يُسلَّم الكود بعد تأكيد الدفع — عادةً في أقل من 5 دقائق.",
    deliveryNoteEn: "Code delivered after payment confirmation — usually under 5 minutes.",
    denominations,
    sortOrder: index,
    fulfillment: "auto",
    supplier: "fazercards",
  };
}

/** Vrai si la fiche a au moins un montant réellement vendable. */
function hasSellableDenomination(product: DigitalProduct): boolean {
  return product.denominations.some(
    (denomination) =>
      denomination.available &&
      Number.isFinite(denomination.priceUsd) &&
      denomination.priceUsd > 0,
  );
}

/**
 * Catalogue du fournisseur, converti pour la vitrine.
 * Les fiches sans montant vendable sont écartées : afficher une fiche sur
 * laquelle on ne peut pas acheter ne génère que des messages WhatsApp.
 */
export async function getFazercardsDigitalCatalog(
  options: { maxAgeMs?: number; force?: boolean; noSync?: boolean } = {},
): Promise<{
  products: DigitalProduct[];
  cached: boolean;
  stale: boolean;
  fetchedAt: string;
  errors: string[];
}> {
  const catalog = await getFazercardsCatalog(options);
  const products = catalog.products
    .map((product, index) => fazercardsProductToDigital(product, index))
    .filter(hasSellableDenomination);
  return {
    products,
    cached: catalog.cached,
    stale: catalog.stale,
    fetchedAt: catalog.fetchedAt,
    errors: catalog.errors,
  };
}

/** Fiche du fournisseur par slug (même source que la vitrine). */
export async function getFazercardsDigitalProduct(
  slug: string,
): Promise<DigitalProduct | null> {
  const { products } = await getFazercardsDigitalCatalog();
  return products.find((product) => product.slug === slug) ?? null;
}
