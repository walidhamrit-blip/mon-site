/**
 * Boutique inline du bot Telegram — fonctions PURES (aucune base, aucun
 * réseau), sur le modèle de `telegram-core.ts`.
 *
 * Navigation demandée : Catégories → Produits (avec prix) → Détails &
 * Paiement, rendue en mettant à jour le MÊME message (`editMessageText`).
 *
 * Pourquoi un état côté serveur : les `callback_data` Telegram sont plafonnées
 * à 64 octets et les slugs produits peuvent en faire davantage (les fiches
 * fournisseur sont longues, ex. `fzr-gamekey-<nom>`). Le clavier n' transporte
 * donc que des index courts (`shop:p:3`), résolus dans `TelegramShopState`
 * (colonne jsonb de `telegram_subscribers`) — voir `telegram-shop.ts`.
 *
 * Paiement : la caisse réutilise EXACTEMENT celle du site
 * (`createDigitalCheckout` → facture hébergée NOWPayments). Les produits qui
 * exigent des champs acheteur (identifiant joueur…) ne peuvent pas être
 * vendus « à l'aveugle » dans le chat : le bot renvoie alors vers la fiche
 * web, où le formulaire complet (et les autres moyens de paiement : carte,
 * Skrill, carte de recharge) est déjà branché.
 */

// Module PUR : aucun appel réseau, aucune base. Les imports pointent vers
// des modules eux-mêmes purs — les tests l'empaquetent avec le plugin
// d'alias `@/` (même pattern que `digital-codes-keyring.test.mjs`).
import { digitalCategories } from "@/lib/digital-categories";
import { denominationLabel } from "@/lib/digital-types";
import type { DigitalKind } from "@/lib/digital-types";

/**
 * Plafond de quantité par commande, identique à `MAX_DIGITAL_QUANTITY`
 * (`digital-order-core.ts`). Redéclaré ici à dessein : ce module est PUR et
 * importé tel quel par les tests Node, qui ne résolvent pas les alias `@/`.
 */
export const SHOP_MAX_QUANTITY = 10;

/** Le bot est bilingue (ar / en) ; « fr » retombe sur l'anglais ici. */
export type ShopLocale = "ar" | "en";

export function shopLocale(lang: string | null | undefined): ShopLocale {
  return lang === "ar" ? "ar" : "en";
}

/* ------------------------------ État du chat ------------------------------ */

/**
 * État éphémère de navigation, stocké par chat (jsonb `shop_state`).
 * Une seule vue à la fois : le dernier clavier affiché « possède » l'état.
 */
export interface TelegramShopState {
  /** Clés libres (jsonb) : l'état voyage avec des clés ajoutées au fil des évolutions. */
  [key: string]: unknown;
  /** Slugs affichés dans la page produits courante (index `shop:p:<i>`). */
  products?: string[];
  /** Catégorie + page courants (bouton retour fidèle). */
  kind?: string | null;
  page?: number;
  /** Page de la catégorie (conservée quand on parcourt les montants d'un produit). */
  categoryPage?: number;
  /** Slug du produit affiché. */
  slug?: string | null;
  /** Identifiants de montants affichés (index `shop:d:<i>`). */
  denoms?: string[];
  /** Montant choisi + quantité. */
  denomId?: string | null;
  qty?: number;
  /** Caisse en attente d'un e-mail de livraison. */
  pending?: {
    slug: string;
    denomId: string;
    qty: number;
    title: string;
    label: string;
    totalUsd: string;
    /** Message d'invitation envoyé au client (pour nettoyer le bouton ✖️ après saisie). */
    promptMessageId?: number | null;
  } | null;
  /** Dernière commande créée depuis le bot (re-envoi du lien de paiement). */
  lastOrder?: {
    ref: string;
    paymentUrl: string;
    trackingToken: string;
    slug: string;
    title: string;
    label: string;
    totalUsd: string;
    email: string;
    qty: number;
  } | null;
  /** Horodatage ISO de la dernière facture créée (garde-fou anti-spam). */
  lastCheckoutAt?: string | null;
}

export const EMPTY_SHOP_STATE: TelegramShopState = {};

/* ---------------------------- Callback data ------------------------------- */

export type ShopCallback =
  | { view: "root" }
  | { view: "category"; kind: string; page: number }
  | { view: "brands"; kind: string; page: number }
  | { view: "brand"; index: number }
  | { view: "regionPage"; page: number }
  | { view: "region"; index: number }
  | { view: "regionAll" }
  | { view: "brandProductsPage"; page: number }
  | { view: "product"; index: number }
  | { view: "productPage"; page: number }
  | { view: "denomination"; index: number }
  | { view: "quantity"; delta: -1 | 1 }
  | { view: "buy" }
  | { view: "buyMin"; qty: number }
  | { view: "email" }
  | { view: "cancel" }
  | { view: "pay" }
  | { view: "watch"; ref: string };

/** Préfixe commun des callbacks de la boutique. */
export const SHOP_CALLBACK_PREFIX = "shop";

/** Le clavier n' transporte que des index courts : `shop:p:3`. */
export function shopCallback(cb: ShopCallback): string {
  switch (cb.view) {
    case "root":
      return SHOP_CALLBACK_PREFIX;
    case "category":
      return `${SHOP_CALLBACK_PREFIX}:c:${cb.kind}:${Math.max(1, cb.page)}`;
    case "brands":
      return `${SHOP_CALLBACK_PREFIX}:b:${cb.kind}:${Math.max(1, cb.page)}`;
    case "brand":
      return `${SHOP_CALLBACK_PREFIX}:bn:${cb.index}`;
    case "regionPage":
      return `${SHOP_CALLBACK_PREFIX}:rgp:${Math.max(1, cb.page)}`;
    case "region":
      return `${SHOP_CALLBACK_PREFIX}:rg:${cb.index}`;
    case "regionAll":
      return `${SHOP_CALLBACK_PREFIX}:rga`;
    case "brandProductsPage":
      return `${SHOP_CALLBACK_PREFIX}:bp:${Math.max(1, cb.page)}`;
    case "product":
      return `${SHOP_CALLBACK_PREFIX}:p:${cb.index}`;
    case "productPage":
      return `${SHOP_CALLBACK_PREFIX}:pd:${Math.max(1, cb.page)}`;
    case "denomination":
      return `${SHOP_CALLBACK_PREFIX}:d:${cb.index}`;
    case "quantity":
      return `${SHOP_CALLBACK_PREFIX}:q:${cb.delta > 0 ? "+" : "-"}`;
    case "buy":
      return `${SHOP_CALLBACK_PREFIX}:buy`;
    case "buyMin":
      return `${SHOP_CALLBACK_PREFIX}:bm:${Math.min(Math.max(1, cb.qty), SHOP_MAX_QUANTITY)}`;
    case "email":
      return `${SHOP_CALLBACK_PREFIX}:email`;
    case "cancel":
      return `${SHOP_CALLBACK_PREFIX}:cancel`;
    case "pay":
      return `${SHOP_CALLBACK_PREFIX}:pay`;
    case "watch":
      return `${SHOP_CALLBACK_PREFIX}:w:${cb.ref}`;
  }
}

/** Analyse une callback ; `null` si ce n'est pas un callback boutique. */
export function parseShopCallback(data: string | null | undefined): ShopCallback | null {
  const raw = (data ?? "").trim();
  if (raw === SHOP_CALLBACK_PREFIX) return { view: "root" };
  if (!raw.startsWith(`${SHOP_CALLBACK_PREFIX}:`)) return null;
  const [, action, ...rest] = raw.split(":");
  switch (action) {
    case "c": {
      const [kind, page] = rest;
      if (!kind) return null;
      const parsed = Number.parseInt(page ?? "1", 10);
      return { view: "category", kind, page: Number.isFinite(parsed) ? Math.max(1, parsed) : 1 };
    }
    case "b": {
      const [kind, page] = rest;
      if (!kind) return null;
      const parsed = Number.parseInt(page ?? "1", 10);
      return { view: "brands", kind, page: Number.isFinite(parsed) ? Math.max(1, parsed) : 1 };
    }
    case "bn": {
      const index = Number.parseInt(rest[0] ?? "", 10);
      return Number.isInteger(index) && index >= 0 ? { view: "brand", index } : null;
    }
    case "rgp": {
      const parsed = Number.parseInt(rest[0] ?? "1", 10);
      return { view: "regionPage", page: Number.isFinite(parsed) ? Math.max(1, parsed) : 1 };
    }
    case "rg": {
      const index = Number.parseInt(rest[0] ?? "", 10);
      return Number.isInteger(index) && index >= 0 ? { view: "region", index } : null;
    }
    case "rga":
      return { view: "regionAll" };
    case "bp": {
      const parsed = Number.parseInt(rest[0] ?? "1", 10);
      return { view: "brandProductsPage", page: Number.isFinite(parsed) ? Math.max(1, parsed) : 1 };
    }
    case "p": {
      const index = Number.parseInt(rest[0] ?? "", 10);
      return Number.isInteger(index) && index >= 0 ? { view: "product", index } : null;
    }
    case "pd": {
      const page = Number.parseInt(rest[0] ?? "", 10);
      return Number.isFinite(page) ? { view: "productPage", page: Math.max(1, page) } : null;
    }
    case "d": {
      const index = Number.parseInt(rest[0] ?? "", 10);
      return Number.isInteger(index) && index >= 0 ? { view: "denomination", index } : null;
    }
    case "q": {
      const delta = rest[0] === "+" ? 1 : rest[0] === "-" ? -1 : 0;
      return delta === 0 ? null : { view: "quantity", delta: delta as -1 | 1 };
    }
    case "buy":
      return { view: "buy" };
    case "bm": {
      const qty = Number.parseInt(rest[0] ?? "", 10);
      return Number.isInteger(qty) && qty >= 1 && qty <= SHOP_MAX_QUANTITY
        ? { view: "buyMin", qty }
        : null;
    }
    case "email":
      return { view: "email" };
    case "cancel":
      return { view: "cancel" };
    case "pay":
      return { view: "pay" };
    case "w": {
      const ref = rest.join(":").trim().toUpperCase();
      return ref ? { view: "watch", ref } : null;
    }
    default:
      return null;
  }
}

/* ------------------------------- Catalogue -------------------------------- */

/**
 * Vue minimale d'une fiche produit pour le bot : structurellement compatible
 * avec `DigitalProduct` (le catalogue public passe tel quel).
 */
export interface ShopProduct {
  slug: string;
  kind: DigitalKind;
  status: string;
  platform: string;
  regions?: string[];
  /** Fournisseur qui livre la fiche (comme `DigitalProduct.supplier`). */
  supplier?: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  deliveryNoteAr: string;
  deliveryNoteEn: string;
  denominations: ShopDenomination[];
}

/**
 * Seul fournisseur vendable aujourd'hui : l'ancien fournisseur a été retiré
 * définitivement (`LEGACY_SUPPLIER_RETIRED`), le site web route déjà toutes
 * ses ventes vers FazerCards — le bot applique la MÊME règle pour ne jamais
 * proposer un produit que la caisse refuserait.
 */
export const SHOP_SELLABLE_SUPPLIER = "fazercards";

export interface ShopDenomination {
  id: string;
  label: string;
  faceValue: string;
  priceUsd: number;
  available: boolean;
  /** Région de cette offre (présente dans le catalogue ; sert au tri par région). */
  region?: string;
  /** Champs acheteur exigés (identifiant joueur…) : pas de vente en chat. */
  fields?: { key: string; label: string; type: string }[];
  maxQuantity?: number | null;
}

/** Les familles du site, dans l'ordre du catalogue. */
export const SHOP_KINDS = digitalCategories.map((category) => category.kind);

export function shopCategoryLabel(kind: string, locale: ShopLocale): string {
  const category = digitalCategories.find((item) => item.kind === kind);
  if (!category) return kind;
  return locale === "ar" ? category.ar : category.en;
}

/** Fiches vendables d'une famille, triées comme sur le site. */
export function shopProductsOfKind(products: ShopCatalogInput, kind: string): ShopProduct[] {
  const matching = products.filter(
    (product) =>
      product.kind === kind &&
      product.status === "available" &&
      product.supplier === SHOP_SELLABLE_SUPPLIER,
  );
  return matching
    .filter((product) => product.denominations.some((item) => item.available && item.priceUsd > 0))
    .sort((a, b) => minPrice(a) - minPrice(b));
}

function minPrice(product: ShopProduct): number {
  const prices = product.denominations
    .filter((item) => item.available && item.priceUsd > 0)
    .map((item) => item.priceUsd);
  return prices.length ? Math.min(...prices) : Number.POSITIVE_INFINITY;
}

/* ------------------------- Marques & régions ------------------------- */

/**
 * Hierarchie des cartes cadeaux : la PREMIÈRE navigation est le TYPE de carte
 * (Steam, PlayStation, Google Play…) puis la RÉGION sous chaque marque. Les
 * autres familles gardent la liste plate.
 *
 * ⚠️ Le fournisseur nomme ses catégories avec la région incluse —
 * « Amazon (US) », « Amazon (FR) », « PlayStation (TR) », « Netflix GLOBAL » :
 * sans dérivation, chaque variante apparaîtrait comme une marque distincte et
 * le premier niveau serait une longue liste de doublons. La marque est donc
 * le nom SANS le suffixe de région ; la région devient une étape dédiée.
 */

const BRAND_REGION_SUFFIX = /\s*\(([A-Za-z]{2,4})\)\s*$/;

/** Marque + variante dérivées du produit (région explicite ou suffixe du nom). */
export function shopBrandKeyOf(product: ShopProduct): { brand: string; region: string | null } {
  const name = product.platform?.trim() ?? "";
  if (!name) return { brand: "", region: null };
  const paren = BRAND_REGION_SUFFIX.exec(name);
  if (paren) {
    const brand = name.slice(0, paren.index).trim().replace(/[\s\-–—]+$/, "");
    if (brand) return { brand, region: paren[1].toUpperCase() };
  }
  if (/\bGLOBAL\b/i.test(name)) {
    const stripped = name.replace(/\bGLOBAL\b/gi, "").replace(/[\s\-–—]+$/, "").trim();
    if (stripped) return { brand: stripped, region: "GLOBAL" };
  }
  return { brand: name, region: null };
}

export interface ShopBrandEntry {
  name: string;
  count: number;
}

/** Marques (types de carte) triées, compteurs = fiches vendables de la marque. */
export function shopBrandsOfKind(catalog: ShopCatalogInput, kind: string): ShopBrandEntry[] {
  const counts = new Map<string, number>();
  for (const product of shopProductsOfKind(catalog, kind)) {
    const { brand } = shopBrandKeyOf(product);
    if (!brand) continue;
    counts.set(brand, (counts.get(brand) ?? 0) + 1);
  }
  return Array.from(counts, ([name, count]) => ({ name, count })).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

/** Régions couvertes par une marque : variantes du nom, fiches et montants vendables. */
export function shopRegionsOfBrand(
  catalog: ShopCatalogInput,
  kind: string,
  brand: string,
): string[] {
  const regions = new Set<string>();
  for (const product of shopProductsOfBrand(catalog, kind, brand)) {
    const { region: variant } = shopBrandKeyOf(product);
    if (variant) regions.add(variant);
    for (const region of product.regions ?? []) {
      const normalized = region.trim().toUpperCase();
      if (normalized) regions.add(normalized);
    }
    for (const denomination of product.denominations) {
      if (!denomination.available) continue;
      const normalized = denomination.region?.trim().toUpperCase();
      if (normalized) regions.add(normalized);
    }
  }
  return Array.from(regions).sort((a, b) => a.localeCompare(b));
}

/** Produits d'une marque, éventuellement restreints à une région (toutes si `null`). */
export function shopProductsOfBrand(
  catalog: ShopCatalogInput,
  kind: string,
  brand: string,
  region?: string | null,
): ShopProduct[] {
  const products = shopProductsOfKind(catalog, kind).filter(
    (product) => shopBrandKeyOf(product).brand === brand,
  );
  if (!region?.trim()) return products;
  return products.filter((product) => shopProductCoversRegion(product, region));
}

function shopProductCoversRegion(product: ShopProduct, region: string): boolean {
  const target = region.trim().toUpperCase();
  if (!target) return true;
  if (shopBrandKeyOf(product).region === target) return true;
  if ((product.regions ?? []).some((item) => item.trim().toUpperCase() === target)) return true;
  return product.denominations.some(
    (item) => item.available && item.region?.trim().toUpperCase() === target,
  );
}

/* --------------------- Intitulés arabes & légende --------------------- */

/**
 * Noms arabes des marques courantes — le catalogue fournisseur est en
 * anglais : le public arabophone voit l'intitulé arabe à côté du nom
 * d'origine (reconnaissance garantie). Marque inconnue → nom d'origine.
 */
const BRAND_LABELS_AR: Record<string, string> = {
  amazon: "أمازون",
  steam: "ستيم",
  playstation: "بلايستيشن",
  "playstation store": "متجر بلايستيشن",
  "google play": "جوجل بلاي",
  google: "جوجل",
  itunes: "آيتونز",
  "app store": "آيتونز",
  apple: "آبل",
  netflix: "نتفليكس",
  xbox: "إكس بوكس",
  nintendo: "نينتندو",
  spotify: "سبوتيفاي",
  "razer gold": "ريزر جولد",
  pubg: "ببجي",
  "google tv": "جوجل تي في",
  shein: "شين",
  "playstation plus": "بلايستيشن بلس",
  Hulu: "هولو",
  "amazon prime": "أمازون برايم",
  "google one": "جوجل ون",
  cashbill: "كاش بيل",
  "mygoods": "ماي جودز",
};

/** Noms arabes des régions/pays — affichés sur les boutons de la vue région. */
const REGION_LABELS_AR: Record<string, string> = {
  us: "أمريكا",
  fr: "فرنسا",
  de: "ألمانيا",
  gb: "بريطانيا",
  uk: "بريطانيا",
  ae: "الإمارات",
  sa: "السعودية",
  qa: "قطر",
  kw: "الكويت",
  bh: "البحرين",
  om: "عُمان",
  jo: "الأردن",
  lb: "لبنان",
  eg: "مصر",
  ma: "المغرب",
  dz: "الجزائر",
  tn: "تونس",
  ly: "ليبيا",
  sd: "السودان",
  tr: "تركيا",
  eu: "أوروبا",
  global: "عالمية",
  mena: "الشرق الأوسط وشمال إفريقيا",
  row: "باقي العالم",
  na: "أمريكا الشمالية",
  latam: "أمريكا اللاتينية",
  apac: "آسيا والمحيط الهادي",
  asia: "آسيا",
  africa: "إفريقيا",
  ca: "كندا",
  au: "أستراليا",
  nz: "نيوزيلندا",
  it: "إيطاليا",
  es: "إسبانيا",
  nl: "هولندا",
  be: "بلجيكا",
  at: "النمسا",
  ch: "سويسرا",
  pt: "البرتغال",
  gr: "اليونان",
  ie: "إيرلندا",
  pl: "بولندا",
  se: "السويد",
  no: "النرويج",
  dk: "الدنمارك",
  fi: "فنلندا",
  ro: "رومانيا",
  cz: "التشيك",
  hu: "هنغاريا",
  ru: "روسيا",
  ua: "أوكرانيا",
  br: "البرازيل",
  mx: "المكسيك",
  ar: "الأرجنتين",
  cl: "تشيلي",
  co: "كولومبيا",
  jp: "اليابان",
  kr: "كوريا",
  in: "الهند",
  pk: "باكستان",
  ph: "الفلبين",
  id: "إندونيسيا",
  my: "ماليزيا",
  ng: "نيجيريا",
};

/** Explication (deux langues) des codes de région qui ne sont pas un pays. */
const REGION_EXPLANATIONS: Record<string, { ar: string; en: string }> = {
  MENA: {
    ar: "الشرق الأوسط وشمال إفريقيا — الخليج (السعودية، الإمارات، قطر، الكويت، عُمان، البحرين)، مصر، الأردن، لبنان، المغرب العربي",
    en: "Middle East & North Africa — Gulf (Saudi Arabia, UAE, Qatar, Kuwait, Oman, Bahrain), Egypt, Jordan, Lebanon, Maghreb",
  },
  GLOBAL: {
    ar: "عالمية — تعمل في جميع الدول دون قيود إقليمية",
    en: "Worldwide — works in any country, no regional restriction",
  },
  EU: {
    ar: "أوروبا — الحساب يجب أن يكون مسجلاً في دولة أوروبية",
    en: "Europe — the account must be registered in a European country",
  },
  ROW: {
    ar: "باقي دول العالم — خارج أوروبا وأمريكا الشمالية غالباً",
    en: "Rest of World — usually outside Europe and North America",
  },
  LATAM: {
    ar: "أمريكا اللاتينية — المكسيك، البرازيل، الأرجنتين، تشيلي…",
    en: "Latin America — Mexico, Brazil, Argentina, Chile…",
  },
  APAC: {
    ar: "آسيا والمحيط الهادي — اليابان، كوريا، الهند، أستراليا…",
    en: "Asia-Pacific — Japan, Korea, India, Australia…",
  },
  NA: {
    ar: "أمريكا الشمالية — الولايات المتحدة وكندا",
    en: "North America — United States & Canada",
  },
  ASIA: { ar: "قارة آسيا", en: "Asia continent" },
  AFRICA: { ar: "قارة إفريقيا", en: "Africa continent" },
};

/** Intitulé arabe de la marque (retombe sur le nom d'origine si inconnue). */
export function shopBrandLabel(brand: string, locale: ShopLocale): string {
  if (locale !== "ar") return brand;
  return BRAND_LABELS_AR[brand.trim().toLowerCase()] ?? brand;
}

/** Titre de section : « ستيم (Steam) » en arabe, nom d'origine en anglais. */
export function shopBrandHeading(brand: string, locale: ShopLocale): string {
  if (locale !== "ar") return brand;
  const ar = BRAND_LABELS_AR[brand.trim().toLowerCase()];
  return ar ? `${ar} (${brand})` : brand;
}

/** Libellé de région seul : « تركيا » en arabe, code d'origine en anglais. */
export function shopRegionLabel(region: string, locale: ShopLocale): string {
  if (locale !== "ar") return region;
  return REGION_LABELS_AR[region.trim().toLowerCase()] ?? region;
}

/** Libellé de bouton région : « أمازون أمريكا » en arabe, « Amazon US » en anglais. */
export function shopRegionButtonLabel(
  brand: string,
  region: string,
  locale: ShopLocale,
): string {
  return `${shopBrandLabel(brand, locale)} ${shopRegionLabel(region, locale)}`;
}

/**
 * Légende sous la liste des régions : explique les codes qui ne sont pas
 * un pays (MENA = quels pays, GLOBAL, EU…). Une ligne par code spécial
 * présent dans la liste, dans l'ordre alphabétique.
 */
export function shopRegionLegend(regions: readonly string[], locale: ShopLocale): string[] {
  const lines: string[] = [];
  for (const region of regions) {
    const explanation = REGION_EXPLANATIONS[region.trim().toUpperCase()];
    if (!explanation) continue;
    lines.push(locale === "ar" ? `🗺️ ${region} = ${explanation.ar}` : `🗺️ ${region} = ${explanation.en}`);
  }
  return lines;
}

export function shopFromPrice(product: ShopProduct): number | null {
  const price = minPrice(product);
  return Number.isFinite(price) ? price : null;
}

/* ------------------------------- Pagination ------------------------------- */

export const SHOP_PRODUCTS_PER_PAGE = 8;
export const SHOP_DENOMS_PER_PAGE = 10;

export function pageCountOf(total: number, perPage: number): number {
  return Math.max(1, Math.ceil(total / Math.max(1, perPage)));
}

export function pageSlice<T>(items: T[], page: number, perPage: number): T[] {
  const safe = Math.min(Math.max(1, page), pageCountOf(items.length, perPage));
  return items.slice((safe - 1) * perPage, safe * perPage);
}

/* --------------------------------- Textes --------------------------------- */

/** Libellés boutique — mêmes clés dans les deux langues. */
export interface ShopCopyStrings {
  title: string;
  chooseCategory: string;
  chooseProduct: string;
  from: string;
  chooseBrand: string;
  chooseRegion: string;
  allRegions: string;
  chooseAmount: string;
  back: string;
  webPage: string;
  webStore: string;
  pageOf: (page: number, total: number) => string;
  region: string;
  quantity: string;
  total: string;
  buy: string;
  buySuggested: string;
  buyNeedsFields: string;
  payNow: string;
  payCard: string;
  payOther: string;
  receiveHere: string;
  emailPrompt: string;
  deliveryEmail: string;
  changeEmail: string;
  cancel: string;
  orderCreated: string;
  changedMind: string;
  payAgain: string;
  noOrderYet: string;
  invalidEmail: string;
  belowMinimum: string;
  belowMinimumRetry: string;
  belowMinimumUnreachable: string;
  minQtyAutoNote: string;
  aboveLimit: string;
  gatewayUnavailable: string;
  whatsappOrder: string;
  whatsappPrefill: string;
  alreadyWatching: string;
  cooldown: string;
  sellable: (count: number) => string;
  unavailable: string;
  notFound: string;
  codeByEmail: string;
  emptyCategory: string;
}

const SHOP_COPY: Record<ShopLocale, ShopCopyStrings> = {
  ar: {
    title: "🛒 المتجر",
    chooseCategory: "اختر عائلة المنتجات:",
    chooseProduct: "اختر المنتج:",
    from: "ابتداءً من",
    chooseBrand: "اختر نوع البطاقة:",
    chooseRegion: "اختر المنطقة:",
    allRegions: "كل المناطق",
    chooseAmount: "اختر المبلغ:",
    back: "⬅️ رجوع",
    webPage: "🌐 صفحة المنتج",
    webStore: "🌐 المتجر",
    pageOf: (page: number, total: number) => `${page}/${total}`,
    region: "المنطقة",
    quantity: "الكمية",
    total: "المجموع",
    buy: "شراء",
    buySuggested: "✅ شراء ×{qty} — {total}",
    buyNeedsFields: "افتح صفحة المنتج (بيانات مطلوبة)",
    payNow: "💳 ادفع الآن (عملات رقمية)",
    payCard: "💳 الدفع بالبطاقة (فيزا / ماستركارد)",
    payOther: "🏦 طرق أخرى (Skrill، بطاقة هاتف)",
    receiveHere: "📩 استلم الكود في هذه المحادثة",
    emailPrompt:
      "إلى أي بريد إلكتروني نرسل الكود؟\n\nأرسل عنوان بريدك هنا — مثال:\n<code>name@example.com</code>",
    deliveryEmail: "البريد المستلم",
    changeEmail: "✉️ تغيير البريد",
    cancel: "إلغاء",
    orderCreated:
      "✅ تم إنشاء الطلب — <code>{ref}</code>\n\n📦 <b>{title}</b>\n💳 {label} · ×{qty}\n💵 {total} دولار\n✉️ سيصل الكود إلى <code>{email}</code>\n\nادفع من الزر أدناه؛ سأؤكد لك هنا فور استلام الدفع.",
    changedMind: "تم إلغاء الطلب. المتجر مفتوح 👇",
    payAgain: "رابط الدفع لطلبك الأخير:",
    noOrderYet: "لا يوجد طلب حديث: افتح المتجر واختر منتجاً.",
    invalidEmail:
      "هذا العنوان لا يبدو بريداً إلكترونياً صالحاً.\nأعد الإرسال على الشكل:\n<code>name@example.com</code>\nأو اضغط «إلغاء».",
    belowMinimum:
      "💵 الحد الأدنى للفاتورة هو {min}.\n\nاختر كمية أكبر — مثلاً {qty} × {label} (المجموع {total}) — أو اضغط الزر أدناه للشراء مباشرة.",
    belowMinimumRetry:
      "💵 الحد الأدنى للفاتورة هو {min} — اختر كمية أكبر أو مبلغاً أعلى ثم أعد المحاولة.",
    belowMinimumUnreachable:
      "هذا المبلغ أقل من الحد الأدنى حتى بأقصى كمية — افتح صفحة المنتج للدفع بوسيلة أخرى.",
    minQtyAutoNote:
      "ℹ️ الحد الأدنى للفاتورة بالعملات الرقمية هو {min} — ضُبطت الكمية تلقائياً على ×{qty} (لشراء ×1 افتح صفحة المنتج).",
    aboveLimit:
      "💵 الحد الأقصى للطلب الفوري هو {max} — قلّل الكمية (حتى ×{maxQty}) أو اطلب الكمية عبر واتساب.",
    gatewayUnavailable:
      "⚠️ تعذّر إنشاء فاتورة الدفع بالعملات الرقمية مؤقتاً (لم يُخصم أي مبلغ). يمكنك الدفع بوسيلة أخرى من صفحة المنتج أو مراسلتنا على واتساب.",
    whatsappOrder: "💬 اطلب عبر واتساب",
    whatsappPrefill: "مرحباً، أرغب في شراء هذا المنتج يدوياً:\n{title} — {label} (×{qty}) — {total}",
    alreadyWatching:
      "✅ الإشعارات مفعّلة بالفعل لهذا الطلب — سيصل الكود هنا فور جاهزيته (وأيضاً إلى بريدك الإلكتروني). يمكنك الدفع في أي وقت من الرسالة أعلاه.",
    cooldown:
      "أنشأنا فاتورة قبل قليل: انتظر دقيقة قبل إنشاء أخرى (أو أكمل دفع الفاتورة الحالية).",
    sellable: (count: number) => `${count} منتج`,
    unavailable:
      "⏸️ الشراء التلقائي متوقف مؤقتاً لهذا الطلب (لم يُخصم أي مبلغ). اضغط زر واتساب أدناه وسنوفّره لك يدوياً فوراً، أو افتح صفحة المنتج.",
    notFound: "لم أجد المنتج: ربما تغيّر الكتالوج، أعد فتح المتجر.",
    codeByEmail:
      "يُرسل الكود إلى بريدك فور تأكيد الدفع — وأيضاً هنا في المحادثة إن ضغطت «استلم الكود».",
    emptyCategory: "لا توجد منتجات للبيع في هذه العائلة حالياً.",
  },
  en: {
    title: "🛒 Shop",
    chooseCategory: "Choose a category:",
    chooseProduct: "Choose a product:",
    from: "from",
    chooseBrand: "Choose a card type:",
    chooseRegion: "Choose a region:",
    allRegions: "All regions",
    chooseAmount: "Choose your amount:",
    back: "⬅️ Back",
    webPage: "🌐 Product page",
    webStore: "🌐 Web store",
    pageOf: (page: number, total: number) => `${page}/${total}`,
    region: "Region",
    quantity: "Quantity",
    total: "Total",
    buy: "Buy",
    buySuggested: "✅ Buy ×{qty} — {total}",
    buyNeedsFields: "Open product page (details required)",
    payNow: "💳 Pay now (crypto)",
    payCard: "💳 Pay by card (Visa / Mastercard)",
    payOther: "🏦 Other methods (Skrill, phone card)",
    receiveHere: "📩 Receive the code in this chat",
    emailPrompt:
      "Which email address should we send the code to?\n\nSend it here — e.g.:\n<code>name@example.com</code>",
    deliveryEmail: "Delivery email",
    changeEmail: "✉️ Change email",
    cancel: "Cancel",
    orderCreated:
      "✅ Order created — <code>{ref}</code>\n\n📦 <b>{title}</b>\n💳 {label} · ×{qty}\n💵 {total} USD\n✉️ Code will be sent to <code>{email}</code>\n\nPay below; I'll confirm right here once received.",
    changedMind: "Order cancelled. The shop is still open 👇",
    payAgain: "Payment link for your last order:",
    noOrderYet: "No recent order: open the shop and pick a product.",
    invalidEmail:
      "That doesn't look like a valid email.\nTry again (e.g. <code>name@example.com</code>), or tap Cancel.",
    belowMinimum:
      "💵 The minimum invoice is {min}.\n\nIncrease the quantity — e.g. {qty} × {label} (total {total}) — or tap below to buy right away.",
    belowMinimumRetry:
      "💵 The minimum invoice is {min} — pick a bigger quantity or amount and try again.",
    belowMinimumUnreachable:
      "This amount stays below the minimum even at maximum quantity: open the product page to pay with another method.",
    minQtyAutoNote:
      "ℹ️ Minimum crypto invoice is {min} — quantity set to ×{qty} automatically (open the product page to buy ×1).",
    aboveLimit:
      "💵 Maximum instant order is {max} — reduce the quantity (up to ×{maxQty}) or order via WhatsApp.",
    gatewayUnavailable:
      "⚠️ Could not create the crypto invoice right now (nothing was charged). Try another payment method on the product page or message us on WhatsApp.",
    whatsappOrder: "💬 Order via WhatsApp",
    whatsappPrefill: "Hi, I'd like to order this item manually:\n{title} — {label} (×{qty}) — {total}",
    alreadyWatching:
      "✅ Notifications are already enabled for this order — the code will arrive right here as soon as it is ready (and to your email too). You can pay anytime from the message above.",
    cooldown:
      "An invoice was just created: please wait a minute before creating another (or finish paying for the current one).",
    sellable: (count: number) => `${count} product(s)`,
    unavailable:
      "⏸️ Instant checkout is temporarily paused for this order (nothing was charged). Tap WhatsApp below so we can fulfill it manually, or open the product page.",
    notFound: "Product not found: the catalogue may have changed, reopen the shop.",
    codeByEmail:
      "The code goes to your email as soon as payment is confirmed — and to this chat too if you tap “Receive the code”.",
    emptyCategory: "Nothing on sale in this category right now.",
  },
};

export function shopCopy(locale: ShopLocale): ShopCopyStrings {
  return SHOP_COPY[locale];
}

export function formatShopUsd(amount: number): string {
  return `$${amount.toFixed(2).replace(/\.00$/, "")}`;
}

export function fillShopTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in values ? values[key] : whole));
}

/* --------------------------------- Liens ---------------------------------- */

export interface ShopLinks {
  site: string;
  store: string;
  /** Numéro ou URL WhatsApp de l'agence (optionnel). */
  whatsapp?: string;
}

/**
 * Construit un lien `https://wa.me/<chiffres>?text=…` propre à partir d'un
 * numéro ou d'une URL `wa.me` configurée dans l'admin. `null` si absent.
 */
export function shopWhatsappUrl(
  whatsapp: string | null | undefined,
  message?: string,
): string | null {
  const raw = (whatsapp ?? "").trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

function productUrl(links: ShopLinks, slug: string): string {
  return `${links.site}/codes/${encodeURIComponent(slug)}`;
}

function categoryUrl(links: ShopLinks, kind: string): string {
  return `${links.site}/codes/category/${encodeURIComponent(kind)}`;
}

/* ------------------------------- Claviers --------------------------------- */

export interface ShopButton {
  text: string;
  url?: string;
  callback_data?: string;
}

export type ShopKeyboard = ShopButton[][];

export interface ShopView {
  text: string;
  keyboard: ShopKeyboard;
  /** État à écrire avant d'éditer le message (index résolus côté serveur). */
  state?: TelegramShopState;
}

export type ShopCatalogInput = readonly ShopProduct[];

export function shopCategoriesView(
  catalog: ShopCatalogInput,
  locale: ShopLocale,
  _links: ShopLinks,
): ShopView {
  void _links;
  const copy = shopCopy(locale);
  const keyboard: ShopKeyboard = [];
  const rows: ShopButton[] = [];
  for (const category of digitalCategories) {
    const count = shopProductsOfKind(catalog, category.kind).length;
    rows.push({
      text: `${locale === "ar" ? category.ar : category.en} (${count})`,
      callback_data: shopCallback({ view: "category", kind: category.kind, page: 1 }),
    });
    if (rows.length === 2) {
      keyboard.push(rows.splice(0, 2));
    }
  }
  if (rows.length) keyboard.push(rows);
  keyboard.push([{ text: copy.back, callback_data: "menu:home" }]);
  const lines = [
    copy.title,
    "",
    copy.chooseCategory,
    "",
    locale === "ar" ? "💵 الأسعار بالدولار الأمريكي — التسليم فور تأكيد الدفع." : "💵 Prices in USD — delivered as soon as payment is confirmed.",
  ];
  return { text: lines.join("\n"), keyboard, state: { pending: null } };
}

/** Contexte marque/région quand la liste est atteinte via la hiérarchie cartes cadeaux. */
export interface ShopCategoryContext {
  /** Marque (plateforme) sélectionnée — filtre la liste. */
  brand: string;
  /** Région choisie — `null` = toutes les régions de la marque. */
  region: string | null;
  /** `true` si la marque expose plusieurs régions (le retour remonte aux régions). */
  regionStep: boolean;
}

export function shopCategoryView(
  catalog: ShopCatalogInput,
  kind: string,
  page: number,
  locale: ShopLocale,
  links: ShopLinks,
  context?: ShopCategoryContext,
): ShopView {
  const copy = shopCopy(locale);
  const products = context
    ? shopProductsOfBrand(catalog, kind, context.brand, context.region)
    : shopProductsOfKind(catalog, kind);
  const totalPages = pageCountOf(products.length, SHOP_PRODUCTS_PER_PAGE);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const slice = pageSlice(products, safePage, SHOP_PRODUCTS_PER_PAGE);

  // Paginer/revenir : sans contexte → callbacks de catégorie ; avec contexte
  // marque/région → callbacks dédiés (l'état porte la marque et la région).
  const pageCallback = context
    ? (target: number) => shopCallback({ view: "brandProductsPage", page: target })
    : (target: number) => shopCallback({ view: "category", kind, page: target });
  const backData = context
    ? shopCallback(
        context.regionStep
          ? { view: "regionPage", page: 1 }
          : { view: "brands", kind, page: 1 },
      )
    : shopCallback({ view: "root" });

  if (products.length === 0) {
    return {
      text: `${copy.title}\n\n${copy.emptyCategory}`,
      keyboard: [
        [{ text: copy.back, callback_data: backData }],
        [{ text: copy.webStore, url: categoryUrl(links, kind) }],
      ],
      state: {
        pending: null,
        kind,
        brand: context?.brand ?? null,
        region: context?.region ?? null,
      },
    };
  }

  const rows: ShopKeyboard = [];
  let row: ShopButton[] = [];
  const stateProducts: string[] = [];
  slice.forEach((product, index) => {
    stateProducts.push(product.slug);
    const from = shopFromPrice(product);
    const title = locale === "ar" ? product.titleAr : product.titleEn;
    const price = from != null ? ` — ${copy.from} ${formatShopUsd(from)}` : "";
    row.push({
      text: `${title}${price}`.slice(0, 60),
      callback_data: shopCallback({ view: "product", index }),
    });
    if (row.length === 2) {
      rows.push(row.splice(0, 2));
    }
  });
  if (row.length) rows.push(row);

  if (totalPages > 1) {
    rows.push([
      safePage > 1
        ? { text: "◀️", callback_data: pageCallback(safePage - 1) }
        : { text: "·", callback_data: pageCallback(safePage) },
      { text: copy.pageOf(safePage, totalPages), callback_data: pageCallback(safePage) },
      safePage < totalPages
        ? { text: "▶️", callback_data: pageCallback(safePage + 1) }
        : { text: "·", callback_data: pageCallback(safePage) },
    ]);
  }

  rows.push([
    { text: copy.back, callback_data: backData },
    { text: copy.webStore, url: categoryUrl(links, kind) },
  ]);

  const heading = context
    ? `${copy.title} — ${shopBrandHeading(context.brand, locale)}${
        context.region ? ` · ${shopRegionLabel(context.region, locale)}` : ""
      }`
    : `${copy.title} — ${shopCategoryLabel(kind, locale)}`;
  const text = [
    heading,
    "",
    copy.sellable(products.length),
    "",
    copy.chooseProduct,
  ].join("\n");
  return {
    text,
    keyboard: rows,
    state: {
      products: stateProducts,
      kind,
      page: safePage,
      categoryPage: safePage,
      pending: null,
      brand: context?.brand ?? null,
      region: context?.region ?? null,
    },
  };
}

/**
 * Niveau 1 des cartes cadeaux : les TYPES de carte (Steam, PlayStation,
 * Google Play…) — la plateforme du catalogue, triée alphabétiquement.
 */
export function shopBrandsView(
  catalog: ShopCatalogInput,
  kind: string,
  page: number,
  locale: ShopLocale,
  links: ShopLinks,
): ShopView {
  const copy = shopCopy(locale);
  const brands = shopBrandsOfKind(catalog, kind);
  const productCount = shopProductsOfKind(catalog, kind).length;

  if (brands.length === 0) {
    return {
      text: `${copy.title}\n\n${copy.emptyCategory}`,
      keyboard: [
        [{ text: copy.back, callback_data: shopCallback({ view: "root" }) }],
        [{ text: copy.webStore, url: categoryUrl(links, kind) }],
      ],
      state: { pending: null, kind, brand: null, region: null },
    };
  }

  const totalPages = pageCountOf(brands.length, SHOP_PRODUCTS_PER_PAGE);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const slice = pageSlice(brands, safePage, SHOP_PRODUCTS_PER_PAGE);

  const rows: ShopKeyboard = [];
  let row: ShopButton[] = [];
  const stateBrands: string[] = [];
  slice.forEach((entry, index) => {
    stateBrands.push(entry.name);
    const label = shopBrandLabel(entry.name, locale);
    const text = label === entry.name ? entry.name : `${label} · ${entry.name}`;
    row.push({
      text: `${text} (${entry.count})`.slice(0, 60),
      callback_data: shopCallback({ view: "brand", index }),
    });
    if (row.length === 2) {
      rows.push(row.splice(0, 2));
    }
  });
  if (row.length) rows.push(row);

  if (totalPages > 1) {
    rows.push([
      safePage > 1
        ? { text: "◀️", callback_data: shopCallback({ view: "brands", kind, page: safePage - 1 }) }
        : { text: "·", callback_data: shopCallback({ view: "brands", kind, page: safePage }) },
      { text: copy.pageOf(safePage, totalPages), callback_data: shopCallback({ view: "brands", kind, page: safePage }) },
      safePage < totalPages
        ? { text: "▶️", callback_data: shopCallback({ view: "brands", kind, page: safePage + 1 }) }
        : { text: "·", callback_data: shopCallback({ view: "brands", kind, page: safePage }) },
    ]);
  }

  rows.push([
    { text: copy.back, callback_data: shopCallback({ view: "root" }) },
    { text: copy.webStore, url: categoryUrl(links, kind) },
  ]);

  const text = [
    `${copy.title} — ${shopCategoryLabel(kind, locale)}`,
    "",
    copy.sellable(productCount),
    "",
    copy.chooseBrand,
  ].join("\n");
  return {
    text,
    keyboard: rows,
    state: {
      pending: null,
      kind,
      page: safePage,
      categoryPage: safePage,
      brands: stateBrands,
      brand: null,
      region: null,
    },
  };
}

/**
 * Niveau 2 sous une marque : les RÉGIONS couvertes (fiches + montants),
 * plus « Toutes les régions » toujours accessible sous la pagination.
 */
export function shopBrandRegionsView(
  catalog: ShopCatalogInput,
  kind: string,
  brand: string,
  page: number,
  locale: ShopLocale,
  links: ShopLinks,
): ShopView {
  const copy = shopCopy(locale);
  const regions = shopRegionsOfBrand(catalog, kind, brand);

  if (regions.length === 0) {
    // Aucune région exploitable : liste plate de la marque (toutes régions).
    return shopCategoryView(catalog, kind, page, locale, links, {
      brand,
      region: null,
      regionStep: false,
    });
  }

  // Légende sous la liste : explique les codes non-pays (MENA, GLOBAL…).
  const legend = shopRegionLegend(regions, locale);

  const totalPages = pageCountOf(regions.length, SHOP_PRODUCTS_PER_PAGE);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const slice = pageSlice(regions, safePage, SHOP_PRODUCTS_PER_PAGE);

  const rows: ShopKeyboard = [];
  let row: ShopButton[] = [];
  const stateRegions: string[] = [];
  slice.forEach((region, index) => {
    stateRegions.push(region);
    const count = shopProductsOfBrand(catalog, kind, brand, region).length;
    row.push({
      text: `${shopRegionButtonLabel(brand, region, locale)} (${count})`.slice(0, 60),
      callback_data: shopCallback({ view: "region", index }),
    });
    if (row.length === 2) {
      rows.push(row.splice(0, 2));
    }
  });
  if (row.length) rows.push(row);

  if (totalPages > 1) {
    rows.push([
      safePage > 1
        ? { text: "◀️", callback_data: shopCallback({ view: "regionPage", page: safePage - 1 }) }
        : { text: "·", callback_data: shopCallback({ view: "regionPage", page: safePage }) },
      { text: copy.pageOf(safePage, totalPages), callback_data: shopCallback({ view: "regionPage", page: safePage }) },
      safePage < totalPages
        ? { text: "▶️", callback_data: shopCallback({ view: "regionPage", page: safePage + 1 }) }
        : { text: "·", callback_data: shopCallback({ view: "regionPage", page: safePage }) },
    ]);
  }

  rows.push([{ text: copy.allRegions, callback_data: shopCallback({ view: "regionAll" }) }]);
  rows.push([
    { text: copy.back, callback_data: shopCallback({ view: "brands", kind, page: 1 }) },
    { text: copy.webStore, url: categoryUrl(links, kind) },
  ]);

  const text = [
    `${copy.title} — ${shopBrandHeading(brand, locale)}`,
    "",
    copy.chooseRegion,
    ...(legend.length ? ["", ...legend] : []),
  ].join("\n");
  return {
    text,
    keyboard: rows,
    state: {
      pending: null,
      kind,
      brand,
      page: safePage,
      regions: stateRegions,
      region: null,
    },
  };
}

export function shopProductView(
  product: ShopProduct,
  page: number,
  locale: ShopLocale,
  links: ShopLinks,
  categoryPage = 1,
  /** Retour personnalisé : hiérarchie marque/région des cartes cadeaux. */
  backData?: string,
): ShopView {
  const copy = shopCopy(locale);
  const sellable = product.denominations.filter((item) => item.available && item.priceUsd > 0);
  const totalPages = pageCountOf(sellable.length, SHOP_DENOMS_PER_PAGE);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const slice = pageSlice(sellable, safePage, SHOP_DENOMS_PER_PAGE);

  const title = locale === "ar" ? product.titleAr : product.titleEn;
  const description = locale === "ar" ? product.descriptionAr : product.descriptionEn;
  const deliveryNote = locale === "ar" ? product.deliveryNoteAr : product.deliveryNoteEn;
  const from = shopFromPrice(product);

  const lines = [
    `📦 <b>${escapeShopHtml(title)}</b>`,
    product.platform ? `🏷️ ${escapeShopHtml(product.platform)}` : null,
    product.regions?.length ? `🌍 ${copy.region}: ${escapeShopHtml(product.regions.join(", "))}` : null,
    from != null ? `💵 ${copy.from} <b>${formatShopUsd(from)}</b>` : null,
    "",
    description ? escapeShopHtml(clip(description, 320)) : null,
    deliveryNote ? `\n🚚 ${escapeShopHtml(clip(deliveryNote, 160))}` : null,
    "",
    copy.chooseAmount,
  ].filter((line): line is string => line !== null);

  const rows: ShopKeyboard = [];
  let row: ShopButton[] = [];
  const stateDenoms: string[] = [];
  slice.forEach((denomination, index) => {
    stateDenoms.push(denomination.id);
    const label = denominationLabel(denomination, locale);
    row.push({
      text: `${label} · ${formatShopUsd(denomination.priceUsd)}`.slice(0, 60),
      callback_data: shopCallback({ view: "denomination", index }),
    });
    if (row.length === 2) {
      rows.push(row.splice(0, 2));
    }
  });
  if (row.length) rows.push(row);

  if (totalPages > 1) {
    rows.push([
      safePage > 1
        ? { text: "◀️", callback_data: shopCallback({ view: "productPage", page: safePage - 1 }) }
        : { text: "·", callback_data: shopCallback({ view: "productPage", page: safePage }) },
      { text: copy.pageOf(safePage, totalPages), callback_data: shopCallback({ view: "productPage", page: safePage }) },
      safePage < totalPages
        ? { text: "▶️", callback_data: shopCallback({ view: "productPage", page: safePage + 1 }) }
        : { text: "·", callback_data: shopCallback({ view: "productPage", page: safePage }) },
    ]);
  }

  rows.push([
    {
      text: copy.back,
      callback_data:
        backData ??
        shopCallback({ view: "category", kind: product.kind, page: Math.max(1, categoryPage) }),
    },
    { text: copy.webPage, url: productUrl(links, product.slug) },
  ]);

  return {
    text: lines.join("\n"),
    keyboard: rows,
    state: {
      slug: product.slug,
      page: safePage,
      denoms: stateDenoms,
      products: undefined,
      pending: null,
    },
  };
}

/**
 * Calcule la quantité initiale d'un montant : si le prix unitaire est sous le
 * plancher de facture crypto (`minUsd`, ex. 1,50 $), pré-sélectionne la plus
 * petite quantité atteignant ce plancher — exactement comme la caisse web
 * (`digital-buy-dialog.tsx`), afin d'éviter un clic « Acheter » voué à l'échec.
 */
export function shopInitialQuantity(
  denomination: Pick<ShopDenomination, "priceUsd" | "maxQuantity">,
  minUsd = 0,
): { qty: number; autoAdjusted: boolean; minQty: number } {
  const maxQty = Math.max(
    1,
    Math.min(denomination.maxQuantity ?? SHOP_MAX_QUANTITY, SHOP_MAX_QUANTITY),
  );
  const minQty =
    minUsd > 0 && denomination.priceUsd > 0
      ? Math.max(1, Math.ceil(minUsd / denomination.priceUsd))
      : 1;
  if (minQty > 1 && minQty <= maxQty) {
    return { qty: minQty, autoAdjusted: true, minQty };
  }
  return { qty: 1, autoAdjusted: false, minQty };
}

export interface ShopDenominationViewOptions {
  /** E-mail déjà mémorisé sur ce chat (affiché + modifiable en un clic). */
  checkoutEmail?: string | null;
  /** Plancher de facture crypto (ex. 1,50 $) : affiche une note si pré-ajusté. */
  minOrderUsd?: number;
  /** La quantité vient-elle d'être relevée automatiquement au plancher ? */
  autoAdjustedMin?: boolean;
}

export function shopDenominationView(
  product: ShopProduct,
  denomination: ShopDenomination,
  quantity: number,
  productPage: number,
  locale: ShopLocale,
  links: ShopLinks,
  options: ShopDenominationViewOptions = {},
): ShopView {
  const copy = shopCopy(locale);
  const maxQty = Math.max(
    1,
    Math.min(denomination.maxQuantity ?? SHOP_MAX_QUANTITY, SHOP_MAX_QUANTITY),
  );
  const qty = Math.min(Math.max(1, quantity), maxQty);
  const title = locale === "ar" ? product.titleAr : product.titleEn;
  const label = denominationLabel(denomination, locale);
  const total = Math.round(denomination.priceUsd * qty * 100) / 100;
  const needsFields = (denomination.fields?.length ?? 0) > 0;
  const savedEmail = isPlausibleEmail(options.checkoutEmail)
    ? options.checkoutEmail!.trim()
    : null;
  const minUsd = options.minOrderUsd ?? 0;
  const showAutoNote =
    !needsFields &&
    options.autoAdjustedMin === true &&
    minUsd > 0 &&
    denomination.priceUsd < minUsd &&
    total + 1e-6 >= minUsd;

  const lines = [
    `📦 <b>${escapeShopHtml(title)}</b>`,
    `💳 ${escapeShopHtml(label)} · ${formatShopUsd(denomination.priceUsd)}`,
    "",
    `🔢 ${copy.quantity}: <b>${qty}</b>`,
    `💵 ${copy.total}: <b>${formatShopUsd(total)}</b>`,
    ...(savedEmail && !needsFields
      ? [`✉️ ${copy.deliveryEmail}: <code>${escapeShopHtml(savedEmail)}</code>`]
      : []),
    ...(showAutoNote
      ? [
          "",
          fillShopTemplate(copy.minQtyAutoNote, {
            min: formatShopUsd(minUsd),
            qty: String(qty),
          }),
        ]
      : []),
    "",
    copy.codeByEmail,
  ];

  const qtyRow: ShopButton[] = [
    { text: "➖", callback_data: shopCallback({ view: "quantity", delta: -1 }) },
    { text: `${qty}`, callback_data: shopCallback({ view: "quantity", delta: 1 }) },
    { text: "➕", callback_data: shopCallback({ view: "quantity", delta: 1 }) },
  ];

  const rows: ShopKeyboard = [qtyRow];
  if (needsFields) {
    // Identifiant joueur, serveur… : le formulaire web complet est obligatoire.
    rows.push([
      {
        text: `🛒 ${copy.buyNeedsFields}`,
        url: productUrl(links, product.slug),
      },
    ]);
  } else {
    rows.push([
      {
        text: `✅ ${copy.buy} — ${formatShopUsd(total)}`,
        callback_data: shopCallback({ view: "buy" }),
      },
    ]);
    if (savedEmail) {
      rows.push([
        {
          text: copy.changeEmail,
          callback_data: shopCallback({ view: "email" }),
        },
      ]);
    }
  }
  rows.push([
    { text: copy.back, callback_data: shopCallback({ view: "productPage", page: Math.max(1, productPage) }) },
    { text: copy.webPage, url: productUrl(links, product.slug) },
  ]);

  return {
    text: lines.join("\n"),
    keyboard: rows,
    state: { slug: product.slug, denomId: denomination.id, qty, pending: null },
  };
}

export function shopEmailPromptView(
  pending: { title: string; label: string; totalUsd: string; qty?: number },
  locale: ShopLocale,
): ShopView {
  const copy = shopCopy(locale);
  const qtySuffix = pending.qty && pending.qty > 1 ? ` · ×${pending.qty}` : "";
  // Chaque champ vit sur sa propre ligne : en arabe (RTL), concaténer un
  // titre arabe+latin (« بطاقة هدايا — Amazon (AE) ») et un libellé anglais
  // (« Instant use — 1 AED ») sur une même ligne inverse visuellement l'ordre.
  return {
    text: [
      copy.emailPrompt,
      "",
      `📦 <b>${escapeShopHtml(pending.title)}</b>`,
      `💳 ${escapeShopHtml(pending.label)}${qtySuffix}`,
      `💵 ${formatShopUsd(Number(pending.totalUsd))}`,
    ].join("\n"),
    keyboard: [[{ text: `✖️ ${copy.cancel}`, callback_data: shopCallback({ view: "cancel" }) }]],
  };
}

/**
 * Vue « facture trop petite » : la passerelle crypto refuse les factures
 * sous un plancher (`FAZERCARDS_MIN_ORDER_USD`, ex. 1,50 $). On l'annonce
 * AVANT la caisse, avec un bouton d'achat direct à la quantité minimale.
 */
export function shopBelowMinimumView(
  product: ShopProduct,
  denomination: ShopDenomination,
  minUsd: number,
  locale: ShopLocale,
  links: ShopLinks,
  productPage = 1,
): ShopView {
  const copy = shopCopy(locale);
  const maxQty = Math.max(
    1,
    Math.min(denomination.maxQuantity ?? SHOP_MAX_QUANTITY, SHOP_MAX_QUANTITY),
  );
  const suggestedQty = Math.min(Math.max(1, Math.ceil(minUsd / denomination.priceUsd)), maxQty);
  const suggestedTotal = Math.round(denomination.priceUsd * suggestedQty * 100) / 100;
  const title = locale === "ar" ? product.titleAr : product.titleEn;
  const label = denominationLabel(denomination, locale);
  const sellableAgain = suggestedTotal + 1e-6 >= minUsd;

  const text = [
    `📦 <b>${escapeShopHtml(title)}</b>`,
    `💳 ${escapeShopHtml(label)}`,
    "",
    fillShopTemplate(copy.belowMinimum, {
      min: formatShopUsd(minUsd),
      qty: String(suggestedQty),
      label: escapeShopHtml(label),
      total: formatShopUsd(suggestedTotal),
    }),
    ...(sellableAgain ? [] : ["", copy.belowMinimumUnreachable]),
  ].join("\n");

  const keyboard: ShopKeyboard = [];
  if (sellableAgain) {
    keyboard.push([
      {
        text: fillShopTemplate(copy.buySuggested, {
          qty: String(suggestedQty),
          total: formatShopUsd(suggestedTotal),
        }),
        callback_data: shopCallback({ view: "buyMin", qty: suggestedQty }),
      },
    ]);
  }
  keyboard.push([
    { text: copy.back, callback_data: shopCallback({ view: "productPage", page: Math.max(1, productPage) }) },
    { text: copy.webPage, url: productUrl(links, product.slug) },
  ]);

  return {
    text,
    keyboard,
    state: { pending: null },
  };
}

/* --------------------- Diagnostic & erreurs de caisse --------------------- */

/**
 * Cause structurée d'un refus à la caisse du bot — enregistrée dans le
 * journal admin (`/admin/telegram`) afin de ne jamais deviner à partir d'une
 * capture d'écran client.
 */
export type ShopCheckoutFailureReason =
  | "below_minimum"
  | "above_limit"
  | "not_found"
  | "supplier_balance_insufficient"
  | "supplier_not_configured"
  | "payment_gateway_error"
  | "unexpected_error";

export const SHOP_FAILURE_REASON_LABELS: Record<ShopCheckoutFailureReason, string> = {
  below_minimum: "Sous le minimum crypto",
  above_limit: "Au-dessus du plafond auto",
  not_found: "Produit / montant indisponible",
  supplier_balance_insufficient: "Solde fournisseur insuffisant",
  supplier_not_configured: "Fournisseur non configuré",
  payment_gateway_error: "Passerelle crypto (NOWPayments)",
  unexpected_error: "Erreur serveur inattendue",
};

/**
 * Classe une erreur de caisse : distingue les bornes normales côté client
 * (`below_minimum`, `above_limit`, `not_found`) des incidents d'exploitation
 * (`alertAdmin: true`) qui doivent prévenir l'équipe immédiatement.
 */
export function classifyShopCheckoutError(input: {
  errorCode?: string | null;
  isNowPayments?: boolean;
}): { reason: ShopCheckoutFailureReason; alertAdmin: boolean } {
  switch (input.errorCode) {
    case "product_not_found":
    case "denomination_not_found":
    case "denomination_not_sellable":
    case "invalid_quantity":
    case "invalid_price":
      return { reason: "not_found", alertAdmin: false };
    case "below_minimum":
      return { reason: "below_minimum", alertAdmin: false };
    case "above_limit":
      return { reason: "above_limit", alertAdmin: false };
    case "supplier_balance_insufficient":
      return { reason: "supplier_balance_insufficient", alertAdmin: true };
    case "supplier_not_configured":
      return { reason: "supplier_not_configured", alertAdmin: true };
    default:
      if (input.isNowPayments) {
        return { reason: "payment_gateway_error", alertAdmin: true };
      }
      return { reason: "unexpected_error", alertAdmin: true };
  }
}

export interface ShopCheckoutErrorViewInput {
  reason: ShopCheckoutFailureReason;
  locale: ShopLocale;
  links: ShopLinks;
  pending: {
    slug: string;
    title: string;
    label: string;
    qty: number;
    totalUsd: string;
  };
  minOrderUsd?: number;
  maxOrderUsd?: number;
}

/**
 * Vue d'échec de caisse : message honnête selon la cause réelle + boutons
 * d'action immédiats (WhatsApp pré-rempli quand un humain peut dépanner,
 * fiche web pour les autres moyens de paiement, boutique & menu) + nettoyage
 * de `pending` pour ne jamais bloquer le chat en mode « saisie d'e-mail ».
 */
export function shopCheckoutErrorView(input: ShopCheckoutErrorViewInput): ShopView {
  const { reason, locale, links, pending } = input;
  const copy = shopCopy(locale);
  const unitUsd =
    pending.qty > 0 ? Number(pending.totalUsd) / pending.qty : Number(pending.totalUsd);
  const maxUsd = input.maxOrderUsd && input.maxOrderUsd > 0 ? input.maxOrderUsd : 25;
  const maxQty =
    unitUsd > 0 ? Math.max(1, Math.floor(maxUsd / unitUsd)) : 1;

  let text: string;
  switch (reason) {
    case "not_found":
      text = copy.notFound;
      break;
    case "below_minimum":
      text = fillShopTemplate(copy.belowMinimumRetry, {
        min: formatShopUsd(input.minOrderUsd ?? 1.5),
      });
      break;
    case "above_limit":
      text = fillShopTemplate(copy.aboveLimit, {
        max: formatShopUsd(maxUsd),
        maxQty: String(maxQty),
      });
      break;
    case "payment_gateway_error":
      text = copy.gatewayUnavailable;
      break;
    case "supplier_balance_insufficient":
    case "supplier_not_configured":
    case "unexpected_error":
      text = copy.unavailable;
      break;
  }

  const keyboard: ShopKeyboard = [];
  const needsWhatsapp =
    reason === "supplier_balance_insufficient" ||
    reason === "supplier_not_configured" ||
    reason === "payment_gateway_error" ||
    reason === "unexpected_error" ||
    reason === "above_limit";

  if (needsWhatsapp) {
    const waMessage = fillShopTemplate(copy.whatsappPrefill, {
      title: pending.title,
      label: pending.label,
      qty: String(pending.qty),
      total: formatShopUsd(Number(pending.totalUsd)),
    });
    const waUrl = shopWhatsappUrl(links.whatsapp, waMessage);
    if (waUrl) {
      keyboard.push([{ text: copy.whatsappOrder, url: waUrl }]);
    }
  }

  if (pending.slug && reason !== "not_found") {
    keyboard.push([{ text: copy.webPage, url: productUrl(links, pending.slug) }]);
  }

  keyboard.push([
    { text: copy.title, callback_data: shopCallback({ view: "root" }) },
    { text: localeMenu(locale), callback_data: "menu:home" },
  ]);

  return {
    text,
    keyboard,
    state: { pending: null },
  };
}

/** Alerte HTML envoyée au chat d'administration lorsqu'une vente bot bloque. */
export function formatShopCheckoutFailureAlert(input: {
  siteName: string;
  reason: ShopCheckoutFailureReason;
  title: string;
  label: string;
  qty: number;
  totalUsd: string;
  actorLabel: string;
  maskedEmail: string;
  detail: string;
}): string {
  const reasonLabel = SHOP_FAILURE_REASON_LABELS[input.reason];
  return [
    `⚠️ <b>Échec caisse Telegram</b> — ${escapeShopHtml(input.siteName)}`,
    "",
    `🔎 <b>Cause</b> : ${escapeShopHtml(reasonLabel)}`,
    `📦 ${escapeShopHtml(input.title)} — ${escapeShopHtml(input.label)} (×${input.qty} · ${escapeShopHtml(formatShopUsd(Number(input.totalUsd)))})`,
    `👤 ${escapeShopHtml(input.actorLabel)} · ✉️ <code>${escapeShopHtml(input.maskedEmail)}</code>`,
    input.detail ? `🧾 <code>${escapeShopHtml(clip(input.detail, 220))}</code>` : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

export interface ShopPaymentInfo {
  ref: string;
  title: string;
  label: string;
  qty: number;
  totalUsd: string;
  paymentUrl: string;
  /**
   * URL de bascule carte sur la commande existante — fournie par le module
   * serveur UNIQUEMENT si la passerelle carte est prête et que le montant
   * atteint son minimum (sinon `null` : pas de bouton qui rebondit).
   */
  cardUrl?: string | null;
  /** Jeton de suivi : mémorisé dans l'état pour rejouer la bascule plus tard. */
  trackingToken?: string | null;
  slug: string;
  email: string;
  locale: ShopLocale;
  links: ShopLinks;
}

/** URL de bascule « payer cette commande par carte » (aucune nouvelle caisse). */
export function shopCardSwitchUrl(links: ShopLinks, ref: string, token: string): string {
  return `${links.site}/api/payments/paygate/switch?ref=${encodeURIComponent(ref)}&t=${encodeURIComponent(token)}`;
}

/** Message « commande créée » : le lien de paiement EST le livrable. */
export function shopPaymentView(info: ShopPaymentInfo): ShopView {
  const copy = shopCopy(info.locale);
  const text = fillShopTemplate(copy.orderCreated, {
    ref: escapeShopHtml(info.ref),
    title: escapeShopHtml(info.title),
    label: escapeShopHtml(info.label),
    qty: String(info.qty),
    total: escapeShopHtml(info.totalUsd),
    email: escapeShopHtml(info.email),
  });
  const keyboard = [
    [{ text: copy.payNow, url: info.paymentUrl }],
    // Continue la MÊME commande par carte (bascule serveur, jeton de suivi).
    ...(info.cardUrl ? [[{ text: copy.payCard, url: info.cardUrl }]] : []),
    // Skrill / carte de recharge : preuves à déclarer → fiche web du produit.
    [{ text: copy.payOther, url: productUrl(info.links, info.slug) }],
    [{ text: copy.receiveHere, callback_data: shopCallback({ view: "watch", ref: info.ref }) }],
    [{ text: localeMenu(info.locale), callback_data: "menu:home" }],
  ];

  return {
    text,
    keyboard,
    state: {
      pending: null,
      lastOrder: {
        ref: info.ref,
        paymentUrl: info.paymentUrl,
        trackingToken: info.trackingToken ?? "",
        slug: info.slug,
        title: info.title,
        label: info.label,
        totalUsd: info.totalUsd,
        email: info.email,
        qty: info.qty,
      },
    },
  };
}

function localeMenu(locale: ShopLocale): string {
  return locale === "ar" ? "⬅️ القائمة" : "⬅️ Menu";
}

/** E-mail plausible — la caisse du site exige un e-mail réel de livraison. */
const EMAIL_PATTERN =
  /^[^\s@,;:<>"]{1,64}@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,24}$/;

export function isPlausibleEmail(value: string | null | undefined): boolean {
  const email = (value ?? "").trim();
  return email.length >= 6 && email.length <= 254 && EMAIL_PATTERN.test(email);
}

/** Détecte un mot d'annulation tapé au clavier pendant la demande d'e-mail. */
const CANCEL_INPUT_PATTERN = /^(?:cancel|annuler|stop|إلغاء|الغاء|رجوع)$/i;

export function isCancelShopInput(value: string | null | undefined): boolean {
  return CANCEL_INPUT_PATTERN.test((value ?? "").trim());
}

/** Masque un e-mail pour les journaux/alertes internes (`wa***@gmail.com`). */
export function maskShopEmail(email: string | null | undefined): string {
  const clean = (email ?? "").trim();
  const at = clean.indexOf("@");
  if (at <= 0) return "—";
  const local = clean.slice(0, at);
  const domain = clean.slice(at + 1);
  if (!domain) return "—";
  const prefix = local.slice(0, Math.min(2, local.length));
  return `${prefix}***@${domain}`;
}

/* ------------------------------- Utilitaires ------------------------------ */

function clip(value: string, max: number): string {
  const clean = value.trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}

/** Texte sûr pour `parse_mode: "HTML"` (même règle que `telegram-core`). */
export function escapeShopHtml(input: string): string {
  return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Garde-fou Telegram : une callback_data ne dépasse jamais 64 octets. */
export function shopCallbackFits(cb: ShopCallback): boolean {
  return Buffer.byteLength(shopCallback(cb), "utf8") <= 64;
}
