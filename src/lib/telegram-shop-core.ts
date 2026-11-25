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
  | { view: "product"; index: number }
  | { view: "productPage"; page: number }
  | { view: "denomination"; index: number }
  | { view: "quantity"; delta: -1 | 1 }
  | { view: "buy" }
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
  from: string;
  chooseAmount: string;
  back: string;
  pageOf: (page: number, total: number) => string;
  region: string;
  quantity: string;
  total: string;
  buy: string;
  buyNeedsFields: string;
  payNow: string;
  payCard: string;
  payOther: string;
  receiveHere: string;
  emailPrompt: string;
  cancel: string;
  orderCreated: string;
  changedMind: string;
  payAgain: string;
  noOrderYet: string;
  invalidEmail: string;
  belowMinimum: string;
  belowMinimumRetry: string;
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
    from: "ابتداءً من",
    chooseAmount: "اختر المبلغ:",
    back: "⬅️ رجوع",
    pageOf: (page: number, total: number) => `${page}/${total}`,
    region: "المنطقة",
    quantity: "الكمية",
    total: "المجموع",
    buy: "شراء",
    buyNeedsFields: "افتح صفحة المنتج (بيانات مطلوبة)",
    payNow: "💳 ادفع الآن (عملات رقمية)",
    payCard: "💳 الدفع بالبطاقة (فيزا / ماستركارد)",
    payOther: "🏦 طرق أخرى (Skrill، بطاقة هاتف)",
    receiveHere: "📩 استلم الكود في هذه المحادثة",
    emailPrompt:
      "إلى أي بريد إلكتروني نرسل الكود؟\n\nأرسله هنا (مثال <code>name@example.com</code>)، أو ألغِ.",
    cancel: "إلغاء",
    orderCreated:
      "✅ تم إنشاء الطلب — {ref}\n\n📦 {title} — {label}\n🔢 ×{qty}\n💵 {total} دولار\n✉️ سيصل الكود إلى {email}\n\nادفع من الزر أدناه؛ سأؤكد لك هنا فور استلام الدفع.",
    changedMind: "تم إلغاء الطلب. المتجر مفتوح 👇",
    payAgain: "رابط الدفع لطلبك الأخير:",
    noOrderYet: "لا يوجد طلب حديث: افتح المتجر واختر منتجاً.",
    invalidEmail:
      "هذا العنوان لا يبدو بريداً إلكترونياً صالحاً. حاول مرة أخرى (مثال name@example.com)، أو ألغِ.",
    belowMinimum:
      "💵 الحد الأدنى للفاتورة هو {min}.\n\nاختر كمية أكبر — مثلاً {qty} × {label} (المجموع {total}) — ثم اضغط «شراء».",
    belowMinimumRetry:
      "💵 الحد الأدنى للفاتورة هو {min} — اختر كمية أكبر أو مبلغاً أعلى ثم أعد المحاولة.",
    alreadyWatching:
      "✅ الإشعارات مفعّلة بالفعل لهذا الطلب — سيصل الكود هنا فور جاهزيته (وأيضاً إلى بريدك الإلكتروني). يمكنك الدفع في أي وقت من الرسالة أعلاه.",
    cooldown:
      "أنشأنا فاتورة قبل قليل: انتظر دقيقة قبل إنشاء أخرى (أو أكمل دفع الفاتورة الحالية).",
    sellable: (count: number) => `${count} منتج`,
    unavailable: "البيع متوقف مؤقتاً لهذا المنتج. راسلنا على واتساب وسنوفره لك يدوياً.",
    notFound: "لم أجد المنتج: ربما تغيّر الكتالوج، أعد فتح المتجر.",
    codeByEmail:
      "يُرسل الكود إلى بريدك فور تأكيد الدفع — وأيضاً هنا في المحادثة إن ضغطت «استلم الكود».",
    emptyCategory: "لا توجد منتجات للبيع في هذه العائلة حالياً.",
  },
  en: {
    title: "🛒 Shop",
    chooseCategory: "Choose a category:",
    from: "from",
    chooseAmount: "Choose your amount:",
    back: "⬅️ Back",
    pageOf: (page: number, total: number) => `${page}/${total}`,
    region: "Region",
    quantity: "Quantity",
    total: "Total",
    buy: "Buy",
    buyNeedsFields: "Open product page (details required)",
    payNow: "💳 Pay now (crypto)",
    payCard: "💳 Pay by card (Visa / Mastercard)",
    payOther: "🏦 Other methods (Skrill, phone card)",
    receiveHere: "📩 Receive the code in this chat",
    emailPrompt:
      "Which email address should we send the code to?\n\nSend it here (e.g. <code>name@example.com</code>), or cancel.",
    cancel: "Cancel",
    orderCreated:
      "✅ Order created — {ref}\n\n📦 {title} — {label}\n🔢 ×{qty}\n💵 {total} USD\n✉️ Code will be sent to {email}\n\nPay below; I'll confirm right here once received.",
    changedMind: "Order cancelled. The shop is still open 👇",
    payAgain: "Payment link for your last order:",
    noOrderYet: "No recent order: open the shop and pick a product.",
    invalidEmail:
      "That doesn't look like a valid email. Try again (e.g. name@example.com), or cancel.",
    belowMinimum:
      "💵 The minimum invoice is {min}.\n\nIncrease the quantity — e.g. {qty} × {label} (total {total}) — then tap Buy.",
    belowMinimumRetry:
      "💵 The minimum invoice is {min} — pick a bigger quantity or amount and try again.",
    alreadyWatching:
      "✅ Notifications are already enabled for this order — the code will arrive right here as soon as it is ready (and to your email too). You can pay anytime from the message above.",
    cooldown:
      "An invoice was just created: please wait a minute before creating another (or finish paying for the current one).",
    sellable: (count: number) => `${count} product(s)`,
    unavailable: "Product temporarily unavailable.",
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
  links: ShopLinks,
): ShopView {
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
  return { text: lines.join("\n"), keyboard };
}

export function shopCategoryView(
  catalog: ShopCatalogInput,
  kind: string,
  page: number,
  locale: ShopLocale,
  links: ShopLinks,
): ShopView {
  const copy = shopCopy(locale);
  const products = shopProductsOfKind(catalog, kind);
  const totalPages = pageCountOf(products.length, SHOP_PRODUCTS_PER_PAGE);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const slice = pageSlice(products, safePage, SHOP_PRODUCTS_PER_PAGE);

  if (products.length === 0) {
    return {
      text: `${copy.title}\n\n${copy.emptyCategory}`,
      keyboard: [
        [{ text: copy.back, callback_data: shopCallback({ view: "root" }) }],
        [{ text: locale === "ar" ? "🌐 المتجر" : "🌐 Web store", url: categoryUrl(links, kind) }],
      ],
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
        ? { text: "◀️", callback_data: shopCallback({ view: "category", kind, page: safePage - 1 }) }
        : { text: "·", callback_data: shopCallback({ view: "category", kind, page: safePage }) },
      { text: copy.pageOf(safePage, totalPages), callback_data: shopCallback({ view: "category", kind, page: safePage }) },
      safePage < totalPages
        ? { text: "▶️", callback_data: shopCallback({ view: "category", kind, page: safePage + 1 }) }
        : { text: "·", callback_data: shopCallback({ view: "category", kind, page: safePage }) },
    ]);
  }

  rows.push([
    { text: copy.back, callback_data: shopCallback({ view: "root" }) },
    { text: locale === "ar" ? "🌐 المتجر" : "🌐 Web store", url: categoryUrl(links, kind) },
  ]);

  const text = [
    `${copy.title} — ${shopCategoryLabel(kind, locale)}`,
    "",
    copy.sellable(products.length),
    "",
    copy.chooseAmount,
  ].join("\n");
  return {
    text,
    keyboard: rows,
    state: { products: stateProducts, kind, page: safePage },
  };
}

export function shopProductView(
  product: ShopProduct,
  page: number,
  locale: ShopLocale,
  links: ShopLinks,
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
    { text: copy.back, callback_data: shopCallback({ view: "category", kind: product.kind, page: 1 }) },
    { text: locale === "ar" ? "🌐 Fiche web" : "🌐 Web page", url: productUrl(links, product.slug) },
  ]);

  return {
    text: lines.join("\n"),
    keyboard: rows,
    state: { slug: product.slug, denoms: stateDenoms, products: undefined },
  };
}

export function shopDenominationView(
  product: ShopProduct,
  denomination: ShopDenomination,
  quantity: number,
  productPage: number,
  locale: ShopLocale,
  links: ShopLinks,
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

  const lines = [
    `📦 <b>${escapeShopHtml(title)}</b>`,
    `💳 ${escapeShopHtml(label)} · ${formatShopUsd(denomination.priceUsd)}`,
    "",
    `🔢 ${copy.quantity}: <b>${qty}</b>`,
    `💵 ${copy.total}: <b>${formatShopUsd(total)}</b>`,
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
  }
  rows.push([
    { text: copy.back, callback_data: shopCallback({ view: "productPage", page: Math.max(1, productPage) }) },
    { text: locale === "ar" ? "🌐 Fiche web" : "🌐 Web page", url: productUrl(links, product.slug) },
  ]);

  return {
    text: lines.join("\n"),
    keyboard: rows,
    state: { slug: product.slug, denomId: denomination.id, qty },
  };
}

export function shopEmailPromptView(pending: { title: string; label: string; totalUsd: string }, locale: ShopLocale): ShopView {
  const copy = shopCopy(locale);
  return {
    text: [
      copy.emailPrompt,
      "",
      `📦 ${escapeShopHtml(pending.title)} — ${escapeShopHtml(pending.label)}`,
      `💵 ${formatShopUsd(Number(pending.totalUsd))}`,
    ].join("\n"),
    keyboard: [[{ text: `✖️ ${copy.cancel}`, callback_data: shopCallback({ view: "cancel" }) }]],
  };
}

/**
 * Vue « facture trop petite » : la passerelle crypto refuse les factures
 * sous un plancher (`FAZERCARDS_MIN_ORDER_USD`, ex. 1,50 $). On l'annonce
 * AVANT la caisse, avec l'action à faire (quantité exacte suggérée).
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
    `📦 <b>${escapeShopHtml(title)}</b> — ${escapeShopHtml(label)}`,
    "",
    fillShopTemplate(copy.belowMinimum, {
      min: formatShopUsd(minUsd),
      qty: String(suggestedQty),
      label: escapeShopHtml(label),
      total: formatShopUsd(suggestedTotal),
    }),
    ...(sellableAgain
      ? []
      : ["", locale === "ar" ? "Ce montant reste insuffisant même en quantité maximale : ouvrez la fiche web." : "This amount stays below the minimum even at maximum quantity: open the web page instead."]),
  ].join("\n");

  return {
    text,
    keyboard: [
      [{ text: copy.back, callback_data: shopCallback({ view: "productPage", page: productPage }) }],
      [{ text: locale === "ar" ? "🌐 Fiche web" : "🌐 Web page", url: `${links.site}/codes/${encodeURIComponent(product.slug)}` }],
    ],
  };
}

export interface ShopPaymentInfo {
  ref: string;
  title: string;
  label: string;
  qty: number;
  totalUsd: string;
  paymentUrl: string;
  /** Jeton de suivi : autorise la bascule vers la carte sur la commande EXISTANTE. */
  trackingToken: string;
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
  return {
    text,
    keyboard: [
      [{ text: copy.payNow, url: info.paymentUrl }],
      // Continue la MÊME commande par carte (bascule serveur, jeton de suivi).
      [{ text: copy.payCard, url: shopCardSwitchUrl(info.links, info.ref, info.trackingToken) }],
      // Skrill / carte de recharge : preuves à déclarer → fiche web du produit.
      [{ text: copy.payOther, url: productUrl(info.links, info.slug) }],
      [{ text: copy.receiveHere, callback_data: shopCallback({ view: "watch", ref: info.ref }) }],
      [{ text: localeMenu(info.locale), callback_data: "menu:home" }],
    ],
    state: {
      pending: null,
      lastOrder: {
        ref: info.ref,
        paymentUrl: info.paymentUrl,
        trackingToken: info.trackingToken,
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
