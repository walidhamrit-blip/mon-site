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
  fazercardsErrorMessage,
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
import { marginTierFor, retailPriceForCost } from "@/lib/fazercards-pricing";
import { revalidatePath } from "next/cache";
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
  /** Dernière synchronisation réussie de cette fiche (ms) — sert à la fusion. */
  refreshedAt?: number;
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

/* ------------------------------ Helpers ------------------------------ */

/**
 * Politique de prix : marge dégressive par tranche de coût + plancher de
 * gain (voir `fazercards-pricing.ts`). À elle seule, une marge unique ne
 * couvrait pas les frais FIXES (réseau, retrait) sur les petits articles :
 * ceux-ci se vendaient à perte.
 */
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

/**
 * Marge « de référence » d'une fiche : celle de sa tranche la plus basse.
 * Les montants d'une même fiche peuvent relever de tranches différentes —
 * ce champ n'est donc qu'un repère d'affichage, jamais un calcul de facture.
 */
function productMarginPercent(
  denominations: { supplierCostUsd: number | null }[],
): number {
  const costs = denominations
    .map((item) => item.supplierCostUsd)
    .filter((cost): cost is number => cost != null && Number.isFinite(cost) && cost > 0);
  if (costs.length === 0) return marginTierFor(0).marginPercent;
  return marginTierFor(Math.min(...costs)).marginPercent;
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
      priceUsd: retailPriceForCost(cost).priceUsd,
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
    marginPercent: productMarginPercent(denominations),
    supplierFeePercent: null,
    supplierDiscountPercent: null,
  };
}

/** Transforme une catégorie + offres carte cadeau en FazercardsProduct. */
function mapGiftCardCategory(
  cat: FazercardsGiftCardCategory,
  cards: FazercardsGiftCardOffer[],
): FazercardsProduct {
  // ⚠️ La région est portée par le NOM de la catégorie (« PlayStation (US) »).
  // Elle était forcée à « GLOBAL » : une carte Airbnb australienne ou une
  // carte PlayStation US s'affichaient donc comme « mondiales », alors
  // qu'elles ne s'activent que dans leur pays — premier motif de litige.
  const region = regionFromCategoryName(cat.name) ?? "GLOBAL";
  const denominations: FazercardsDenomination[] = cards.map((card) => {
    const cost = toPriceUsd(card.price_usd);
    return {
      id: card.card_id,
      label: card.name,
      faceValue: card.name,
      region,
      priceUsd: retailPriceForCost(cost).priceUsd,
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
    countryCode: region,
    titleAr: titleFor("gift_card", cat.name, "ar"),
    titleEn: titleFor("gift_card", cat.name, "en"),
    descriptionAr: `بطاقة هدايا ${cat.name} — تسليم فوري إلى بريدك الإلكتروني بعد تأكيد الدفع.`,
    descriptionEn: `${cat.name} gift card — instant delivery to your e-mail after payment.`,
    image: DEFAULT_IMAGE,
    regions: [region],
    denominations,
    fulfillment: "auto",
    marginPercent: productMarginPercent(denominations),
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
      priceUsd: retailPriceForCost(cost).priceUsd,
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
    marginPercent: productMarginPercent(denominations),
    supplierFeePercent: null,
    supplierDiscountPercent: null,
  };
}

/* ---------------------- Couverture du catalogue ---------------------- */

/**
 * Marques mises en tête de synchro, dans cet ordre.
 *
 * ⚠️ Pourquoi : l'API renvoie ses catégories par ordre alphabétique et la
 * synchro ne détaillait que les N premières. Résultat constaté en production
 * le 28/10/2026 : les cartes cadeaux s'arrêtaient à « Apex Legends Mobile » —
 * ni PlayStation, ni Steam, ni Xbox, ni Roblox, ni Google Play n'existaient
 * dans la boutique, alors que le fournisseur les propose.
 *
 * Ces marques sont donc TOUJOURS synchronisées en premier, quel que soit le
 * plafond de catégories : ce sont celles que les clients cherchent.
 */
export const PRIORITY_BRANDS = [
  "playstation",
  "steam",
  "xbox",
  "roblox",
  "google play",
  "itunes",
  "apple",
  "nintendo",
  "amazon",
  "netflix",
  "spotify",
  "epic games",
  "fortnite",
  "free fire",
  "pubg",
  "mobile legends",
  "razer gold",
  "battlenet",
  "blizzard",
  "riot",
  "valorant",
  "minecraft",
  "discord",
  "paysafecard",
  "binance",
  "uber",
] as const;

/** Rang de priorité d'une catégorie (0 = à synchroniser en premier). */
export function brandPriority(name: string): number {
  const haystack = name.toLowerCase();
  for (let index = 0; index < PRIORITY_BRANDS.length; index += 1) {
    if (haystack.includes(PRIORITY_BRANDS[index])) return index;
  }
  return PRIORITY_BRANDS.length;
}

/** Nombre de catégories traitées simultanément (borne la charge fournisseur). */
function catalogConcurrency(): number {
  const raw = Number(process.env.FAZERCARDS_CATALOG_CONCURRENCY);
  return Number.isFinite(raw) && raw >= 1 && raw <= 12 ? Math.floor(raw) : 6;
}

/**
 * Plafond de catégories DÉTAILLÉES par famille et par synchronisation.
 *
 * Une synchro coûte UN appel HTTP par catégorie (les listes, elles, sont
 * paginées et peu coûteuses). Ce plafond borne le temps d'exécution d'une
 * fonction serverless. Les catégories non détaillées ne sont pas perdues :
 * elles sont prises au passage suivant (rotation) et le catalogue déjà
 * synchronisé est conservé et fusionné.
 */
function catalogMaxCategories(): number {
  const raw = Number(process.env.FAZERCARDS_CATALOG_MAX_CATEGORIES);
  return Number.isFinite(raw) && raw >= 1 && raw <= 400 ? Math.floor(raw) : 80;
}

/** Taille d'une page de liste (l'API plafonne à 100). */
function catalogPageSize(): number {
  const raw = Number(process.env.FAZERCARDS_CATALOG_PAGE_SIZE);
  return Number.isFinite(raw) && raw >= 1 && raw <= 100 ? Math.floor(raw) : 100;
}

/** Nombre maximal de pages de liste lues par famille (100 par page). */
function catalogMaxPages(): number {
  const raw = Number(process.env.FAZERCARDS_CATALOG_MAX_PAGES);
  return Number.isFinite(raw) && raw >= 1 && raw <= 50 ? Math.floor(raw) : 10;
}

/** Budget de temps d'une synchro (les détails s'arrêtent au-delà). */
function catalogTimeBudgetMs(): number {
  const raw = Number(process.env.FAZERCARDS_CATALOG_TIME_BUDGET_MS);
  return Number.isFinite(raw) && raw >= 3000 ? Math.floor(raw) : 25_000;
}

/** Âge maximal d'un produit conservé par fusion (jours). */
function catalogMaxProductAgeDays(): number {
  const raw = Number(process.env.FAZERCARDS_CATALOG_MAX_PRODUCT_AGE_DAYS);
  return Number.isFinite(raw) && raw >= 0 ? raw : 7;
}

/** Taille maximale du catalogue fusionné (garde-fou mémoire / base). */
function catalogMaxProducts(): number {
  const raw = Number(process.env.FAZERCARDS_CATALOG_MAX_PRODUCTS);
  return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 2000;
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

/** Page de liste : ce que renvoie l'API pour une famille. */
interface CategoryPage<T> {
  items: T[];
  meta?: { total?: number; limit?: number; next_cursor?: string | null; has_more?: boolean };
}

/**
 * Lit TOUTES les pages d'une liste (bornées par `FAZERCARDS_CATALOG_MAX_PAGES`).
 *
 * Le curseur (`meta.next_cursor`) n'était jamais suivi : la boutique ne
 * voyait que la première page de chaque famille, d'où un catalogue tronqué
 * à l'alphabet. Les éléments sont dédupliqués par identifiant.
 */
async function collectCategories<T>(
  fetchPage: (limit: number, cursor: string | null) => Promise<CategoryPage<T>>,
  idOf: (item: T) => string,
): Promise<{ items: T[]; pages: number; truncated: boolean }> {
  const pageSize = catalogPageSize();
  const maxPages = catalogMaxPages();
  const seen = new Set<string>();
  const items: T[] = [];
  let cursor: string | null = null;
  let pages = 0;
  let truncated = false;

  for (let page = 0; page < maxPages; page += 1) {
    const response = await fetchPage(pageSize, cursor);
    pages += 1;
    for (const item of response.items ?? []) {
      const key = idOf(item);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }
    const next = response.meta?.next_cursor ?? null;
    if (!response.meta?.has_more || !next) return { items, pages, truncated: false };
    cursor = next;
    if (page === maxPages - 1) truncated = true;
  }

  return { items, pages, truncated };
}

/**
 * Choisit les catégories à détailler : d'abord les marques prioritaires,
 * puis une FENÊTRE GLISSANTE sur le reste (rotation), pour couvrir
 * progressivement tout le catalogue sans dépasser le budget d'appels.
 *
 * @param offset position de départ dans le reste (reprise au passage suivant)
 * @returns les catégories retenues et la position suivante
 */
function selectCategories<T>(
  items: T[],
  nameOf: (item: T) => string,
  cap: number,
  offset: number,
): { selected: T[]; nextOffset: number } {
  const ordered = [...items].sort(
    (a, b) => brandPriority(nameOf(a)) - brandPriority(nameOf(b)),
  );
  const priority = ordered.filter((item) => brandPriority(nameOf(item)) < PRIORITY_BRANDS.length);
  const rest = ordered.filter((item) => brandPriority(nameOf(item)) >= PRIORITY_BRANDS.length);

  const prioritySlots = Math.min(priority.length, cap);
  const selected = priority.slice(0, prioritySlots);
  const remaining = cap - selected.length;

  if (rest.length === 0 || remaining <= 0) {
    return { selected, nextOffset: 0 };
  }

  const start = rest.length > 0 ? Math.max(0, Math.floor(offset)) % rest.length : 0;
  const taken: T[] = [];
  for (let index = 0; index < Math.min(remaining, rest.length); index += 1) {
    taken.push(rest[(start + index) % rest.length]);
  }

  return {
    selected: [...selected, ...taken],
    nextOffset: rest.length > 0 ? (start + taken.length) % rest.length : 0,
  };
}

/** Extrait la région d'un libellé de catégorie : « PlayStation (US) » → US. */
export function regionFromCategoryName(name: string): string | null {
  const match = /\(([A-Za-z]{2,4})\)\s*$/.exec(name.trim());
  if (match) return match[1].toUpperCase();
  if (/\bGLOBAL\b/i.test(name)) return "GLOBAL";
  return null;
}

/**
 * Rend les slugs uniques.
 *
 * Deux catégories distinctes peuvent produire le même slug (« fzr-gamekey-
 * arc-raiders » existe en GLOBAL et en ROW) : la seconde fiche était alors
 * inaccessible et sa commande échouait (`denomination_not_found`) APRÈS
 * paiement. On suffixe donc la région, puis un compteur en dernier recours.
 */
export function dedupeProductSlugs(products: FazercardsProduct[]): void {
  const seen = new Map<string, number>();
  for (const product of products) {
    const base = product.slug;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    if (count === 0) continue;
    const regionSuffix = toSlug(product.countryCode || product.regions[0] || "intl");
    let candidate = `${base}-${regionSuffix}`;
    let attempt = 1;
    while (seen.has(candidate)) {
      attempt += 1;
      candidate = `${base}-${regionSuffix}-${attempt}`;
    }
    seen.set(candidate, 1);
    product.slug = candidate;
  }
}

/** Rotation de synchro : position de la fenêtre glissante par famille. */
export interface FazercardsRotation {
  topups: number;
  giftcards: number;
  gamekeys: number;
}

/** Résultat de synchronisation. */
export interface FazercardsSyncResult {
  products: FazercardsProduct[];
  total: number;
  errors: string[];
  /** Position de rotation à reprendre à la prochaine synchro. */
  rotation?: FazercardsRotation;
  /** Nombre de catégories listées (avant plafond) par famille. */
  categories?: FazercardsRotation;
}

export interface FazercardsSyncOptions {
  /** Rotation de départ (celle du catalogue persisté). */
  rotation?: FazercardsRotation;
  /** Budget de temps (ms) : au-delà, les détails restants sont reportés. */
  timeBudgetMs?: number;
}

/**
 * Récupère le catalogue FazerCards (top-ups, cartes cadeaux, clés jeux)
 * et le convertit en produits FazercardsProduct prêts à l'affichage.
 *
 * Trois garanties :
 *  1. les LISTES sont lues page par page (curseur) — plus de troncature à
 *     la première page ;
 *  2. les marques prioritaires passent en premier, puis une fenêtre
 *     glissante couvre le reste au fil des synchros ;
 *  3. un budget de temps borne la durée totale, pour ne jamais dépasser le
 *     temps d'exécution d'une fonction serverless.
 *
 * Cette fonction ne touche pas à la base de données : l'appelant fusionne
 * avec le catalogue précédent (voir `mergeFazercardsCatalog`).
 */
export async function syncFazercardsCatalog(
  options: FazercardsSyncOptions = {},
): Promise<FazercardsSyncResult> {
  const products: FazercardsProduct[] = [];
  const errors: string[] = [];
  const cap = catalogMaxCategories();
  const concurrency = catalogConcurrency();
  const deadline = Date.now() + (options.timeBudgetMs ?? catalogTimeBudgetMs());
  const rotation: FazercardsRotation = {
    topups: Math.max(0, Math.floor(options.rotation?.topups ?? 0)),
    giftcards: Math.max(0, Math.floor(options.rotation?.giftcards ?? 0)),
    gamekeys: Math.max(0, Math.floor(options.rotation?.gamekeys ?? 0)),
  };
  const categories: FazercardsRotation = { topups: 0, giftcards: 0, gamekeys: 0 };

  /** Détaille les catégories retenues, sans dépasser le budget de temps. */
  async function detail<T>(items: T[], worker: (item: T) => Promise<void>): Promise<void> {
    let skipped = 0;
    await mapWithConcurrency(items, concurrency, async (item) => {
      if (Date.now() > deadline) {
        skipped += 1;
        return;
      }
      await worker(item);
    });
    if (skipped > 0) {
      errors.push(`${skipped} catégorie(s) reportée(s) : budget de temps atteint`);
    }
  }

  // ---------- Top-ups (recharges de jeux) ----------
  try {
    const page = await collectCategories(
      (limit, cursor) => fazercardsTopups(limit, cursor),
      (cat) => cat.category_id,
    );
    categories.topups = page.items.length;
    if (page.truncated) {
      errors.push(`topups : liste tronquée à ${page.items.length} catégories (pages max)`);
    }
    const picked = selectCategories(page.items, (cat) => cat.name, cap, rotation.topups);
    rotation.topups = picked.nextOffset;
    await detail(picked.selected, async (cat) => {
      try {
        const offers = await fazercardsTopupOffers(cat.category_id);
        const fields = (offers.fields ?? []).map((field) => ({
          key: field.key,
          label: field.label,
          type: field.type,
        }));
        products.push(mapTopupCategory(cat, offers.offers ?? [], fields));
      } catch (error) {
        errors.push(`topup ${cat.category_id}: ${fazercardsErrorMessage(error)}`);
      }
    });
  } catch (error) {
    errors.push(`topups list: ${fazercardsErrorMessage(error)}`);
  }

  // ---------- Cartes cadeaux ----------
  try {
    const page = await collectCategories(
      (limit, cursor) => fazercardsGiftCards(limit, cursor),
      (cat) => cat.category_id,
    );
    categories.giftcards = page.items.length;
    if (page.truncated) {
      errors.push(`giftcards : liste tronquée à ${page.items.length} catégories (pages max)`);
    }
    const picked = selectCategories(page.items, (cat) => cat.name, cap, rotation.giftcards);
    rotation.giftcards = picked.nextOffset;
    await detail(picked.selected, async (cat) => {
      try {
        const cards = await fazercardsGiftCardCards(cat.category_id);
        products.push(mapGiftCardCategory(cat, cards.offers ?? []));
      } catch (error) {
        errors.push(`giftcard ${cat.category_id}: ${fazercardsErrorMessage(error)}`);
      }
    });
  } catch (error) {
    errors.push(`giftcards list: ${fazercardsErrorMessage(error)}`);
  }

  // ---------- Clés de jeux ----------
  try {
    const page = await collectCategories(
      (limit, cursor) => fazercardsGameKeys(limit, cursor),
      (cat) => cat.game_id,
    );
    categories.gamekeys = page.items.length;
    if (page.truncated) {
      errors.push(`gamekeys : liste tronquée à ${page.items.length} catégories (pages max)`);
    }
    const picked = selectCategories(page.items, (cat) => cat.name, cap, rotation.gamekeys);
    rotation.gamekeys = picked.nextOffset;
    await detail(picked.selected, async (cat) => {
      try {
        const skus = await fazercardsGameKeyKeys(cat.game_id);
        products.push(mapGameKeyCategory(cat, skus.keys ?? []));
      } catch (error) {
        errors.push(`gamekey ${cat.game_id}: ${fazercardsErrorMessage(error)}`);
      }
    });
  } catch (error) {
    errors.push(`gamekeys list: ${fazercardsErrorMessage(error)}`);
  }

  dedupeProductSlugs(products);

  return {
    products,
    total: products.length,
    errors,
    rotation,
    categories,
  };
}

/**
 * Fusionne la synchro du jour avec le catalogue déjà persisté.
 *
 * Sans fusion, la rotation PERDRAIT des fiches à chaque passage : une
 * catégorie sortie de la fenêtre disparaîtrait de la boutique. Ici, une fiche
 * synchronisée reste en ligne (dernier prix connu) jusqu'à ce qu'elle soit
 * rafraîchie à son tour, et les fiches trop anciennes sont écartées pour ne
 * jamais vendre un prix périmé indéfiniment.
 */
export function mergeFazercardsCatalog(
  previous: FazercardsProduct[],
  fresh: FazercardsProduct[],
  options: { previousFetchedAt?: number; now?: number; maxAgeMs?: number; maxProducts?: number } = {},
): FazercardsProduct[] {
  const now = options.now ?? Date.now();
  const previousFetchedAt = options.previousFetchedAt ?? now;
  const maxAgeMs =
    options.maxAgeMs ?? Math.round(catalogMaxProductAgeDays() * 24 * 60 * 60 * 1000);
  const maxProducts = options.maxProducts ?? catalogMaxProducts();

  const merged = new Map<string, FazercardsProduct>();

  for (const product of previous) {
    const refreshedAt = product.refreshedAt ?? previousFetchedAt;
    if (maxAgeMs > 0 && now - refreshedAt > maxAgeMs) continue;
    merged.set(product.slug, { ...product, refreshedAt });
  }
  for (const product of fresh) {
    merged.set(product.slug, { ...product, refreshedAt: now });
  }

  const all = [...merged.values()].sort((a, b) => (b.refreshedAt ?? 0) - (a.refreshedAt ?? 0));
  // Un slug peut avoir été suffixé entre-temps (clé en plusieurs régions) :
  // on re-déduplique APRÈS fusion pour qu'aucune fiche ne devienne injoignable.
  dedupeProductSlugs(all);
  return all.slice(0, maxProducts);
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

/**
 * Même état, mais HYDRATÉ depuis la copie partagée (base) avant lecture.
 *
 * ⚠️ Pourquoi : `fazercardsCatalogCacheStatus()` ne décrit que le cache
 * MÉMOIRE de l'instance courante. Sur Vercel, chaque instance neuve n'a pas
 * de cache et annonçait donc `products: 0` sur `/api/health` alors que la
 * boutique servait des centaines de fiches — un diagnostic qui ment est pire
 * que pas de diagnostic. C'est la version à utiliser pour `/api/health`.
 *
 * Ne synchronise JAMAIS avec le fournisseur : lit uniquement la base.
 */
export async function fazercardsCatalogStatusLive(): Promise<
  ReturnType<typeof fazercardsCatalogCacheStatus>
> {
  if (!catalogCache) {
    try {
      const stored = await readStoredFazercardsCatalog();
      if (stored) {
        catalogCache = { result: stored.result, fetchedAt: stored.fetchedAt };
      }
    } catch (error) {
      console.warn(
        "[fazercards][catalogue] hydratation du statut impossible :",
        error instanceof Error ? error.message : error,
      );
    }
  }
  return fazercardsCatalogCacheStatus();
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
  /** Catégories LISTÉES par le fournisseur, par famille (avant plafond). */
  categories: FazercardsRotation | null;
  /** Position de la fenêtre glissante (reprise à la prochaine synchro). */
  rotation: FazercardsRotation | null;
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
    categories: catalogCache?.result.categories ?? null,
    rotation: catalogCache?.result.rotation ?? null,
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

  catalogInflight = (async () => {
    // 1. Reprendre le catalogue persisté : il porte la rotation de synchro
    //    (fenêtre glissante) et les fiches déjà connues.
    const stored = await readStoredFazercardsCatalog();

    // 2. Synchroniser la tranche du jour (marques prioritaires d'abord).
    const fresh = await syncFazercardsCatalog({ rotation: stored?.rotation });

    // 3. Fusionner : une fiche sortie de la fenêtre reste en ligne avec son
    //    dernier prix connu, et les fiches trop anciennes sont écartées.
    const merged = mergeFazercardsCatalog(stored?.result.products ?? [], fresh.products, {
      previousFetchedAt: stored?.fetchedAt,
    });

    const result: FazercardsSyncResult = {
      ...fresh,
      products: merged,
      total: merged.length,
    };

    if (result.products.length > 0) {
      const fetchedAt = Date.now();
      catalogCache = { result, fetchedAt };
      // Copie partagée : les autres instances (et les rendus suivants)
      // lisent cette version en une requête, sans re-synchroniser.
      await writeStoredFazercardsCatalog(result, fetchedAt, result.rotation);
      revalidateCatalogPages();
    }
    return result;
  })().finally(() => {
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

/**
 * Purge le cache des pages qui affichent le catalogue.
 *
 * Sans cela, `/codes` reste servi depuis le cache ISR (pré-généré au build
 * avec le catalogue de repli) : une synchronisation réussie ne changeait
 * donc RIEN pour le visiteur. La revalidation est appelée après chaque
 * synchro (cron, `?refresh=1`, rafraîchissement d'arrière-plan).
 *
 * Best effort : hors contexte de requête Next (script, test), l'appel lève
 * et on l'ignore.
 */
function revalidateCatalogPages(): void {
  try {
    revalidatePath("/codes", "layout");
  } catch (error) {
    console.warn(
      "[fazercards][catalogue] revalidation impossible :",
      error instanceof Error ? error.message : error,
    );
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
