#!/usr/bin/env node
/**
 * Boutique inline du bot Telegram — garde-fous du noyau PUR
 * (`src/lib/telegram-shop-core.ts`), sans réseau ni base.
 *
 * Ce que ces tests protègent :
 *   1. les callback_data tiennent dans les 64 octets de Telegram et se
 *      décodent à l'identique (aller-retour) ;
 *   2. la navigation rend des claviers cohérents : catégories → produits
 *      (avec prix) → montants → détails & paiement, avec pagination ;
 *   3. le clavier ne transporte JAMAIS de slug complet (les index courts
 *      sont résolus dans l'état serveur) ;
 *   4. le HTML dynamique est échappé (titres produits / libellés hostiles) ;
 *   5. un produit à champs acheteur (identifiant joueur) ne propose PAS de
 *      bouton « Acheter » en chat, seulement la fiche web ;
 *   6. la vue paiement expose le lien facture + le consentement « recevoir
 *      le code ici » et efface la caisse en attente ;
 *   7. l'e-mail de livraison est validé (la caisse du site l'exige) ;
 *   8. les deux langues (ar / en) exposent exactement les mêmes clés.
 */

import { after, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("..", import.meta.url));
const srcRoot = join(root, "src");
const outDir = mkdtempSync(join(tmpdir(), "telegram-shop-"));
after(() => rmSync(outDir, { recursive: true, force: true }));

const aliasPlugin = {
  name: "alias-at-src",
  setup(builder) {
    builder.onResolve({ filter: /^@\// }, (args) => {
      const base = join(srcRoot, args.path.slice(2));
      const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")];
      const found = candidates.find(
        (candidate) => existsSync(candidate) && statSync(candidate).isFile(),
      );
      return { path: found ?? base };
    });
  },
};

async function compile(entry, name) {
  const outfile = join(outDir, `${name}.mjs`);
  await build({
    entryPoints: [join(srcRoot, entry)],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22",
    plugins: [aliasPlugin],
    logLevel: "silent",
  });
  return import(`${pathToFileURL(outfile).href}?t=${Date.now()}`);
}

const shop = await compile("lib/telegram-shop-core.ts", "telegram-shop-core");
const {
  classifyShopCheckoutError,
  EMPTY_SHOP_STATE,
  fillShopTemplate,
  formatShopCheckoutFailureAlert,
  formatShopUsd,
  isCancelShopInput,
  isPlausibleEmail,
  maskShopEmail,
  pageCountOf,
  pageSlice,
  parseShopCallback,
  shopCallback,
  shopCallbackFits,
  shopCategoriesView,
  shopCategoryView,
  shopCheckoutErrorView,
  shopBelowMinimumView,
  shopBrandRegionsView,
  shopBrandsOfKind,
  shopBrandsView,
  shopProductsOfBrand,
  shopRegionsOfBrand,
  shopCopy,
  shopDenominationView,
  shopEmailPromptView,
  shopInitialQuantity,
  shopPaymentView,
  shopProductView,
  shopProductsOfKind,
  shopCardSwitchUrl,
  shopFromPrice,
  shopWhatsappUrl,
  SHOP_CALLBACK_PREFIX,
} = shop;

const LINKS = {
  site: "https://nokhba.net.ly",
  store: "https://nokhba.net.ly/codes",
  whatsapp: "https://wa.me/218913442640",
};

/** Fiche de test, structurellement identique à `DigitalProduct`. */
function fakeProduct(overrides = {}) {
  return {
    slug: "playstation-store-us",
    kind: "gift_card",
    status: "available",
    platform: "PlayStation",
    regions: ["US"],
    supplier: "fazercards",
    titleAr: "بطاقة بلايستيشن أمريكية",
    titleEn: "PlayStation Store (US)",
    descriptionAr: "شحن محفظة بلايستيشن الأمريكية فوراً.",
    descriptionEn: "Top up your US PlayStation wallet instantly.",
    deliveryNoteAr: "الكود يصل بالبريد خلال دقائق.",
    deliveryNoteEn: "Code by email within minutes.",
    denominations: [
      { id: "psn-10", label: "$10", faceValue: "10 USD", priceUsd: 11.5, available: true },
      { id: "psn-25", label: "$25", faceValue: "25 USD", priceUsd: 27.9, available: true },
      { id: "psn-50", label: "$50", faceValue: "50 USD", priceUsd: 0, available: true }, // prix non configuré
      { id: "psn-100", label: "$100", faceValue: "100 USD", priceUsd: 109, available: false }, // épuisé
    ],
    ...overrides,
  };
}

/* ------------------------------ Callback data ----------------------------- */

test("les callbacks boutique tiennent dans 64 octets et bouclent", () => {
  const cases = [
    { view: "root" },
    { view: "category", kind: "subscription_code", page: 12 },
    { view: "product", index: 7 },
    { view: "productPage", page: 3 },
    { view: "denomination", index: 9 },
    { view: "quantity", delta: 1 },
    { view: "quantity", delta: -1 },
    { view: "buy" },
    { view: "email" },
    { view: "cancel" },
    { view: "pay" },
    { view: "watch", ref: "DGC-1A2B3C4D5E6F" },
  ];
  for (const callback of cases) {
    const data = shopCallback(callback);
    assert.ok(data.length <= 64, `callback trop longue : ${data}`);
    assert.ok(shopCallbackFits(callback), `shopCallbackFits : ${data}`);
    const decoded = parseShopCallback(data);
    assert.deepEqual(decoded, callback, data);
  }
  assert.equal(shopCallback({ view: "root" }), SHOP_CALLBACK_PREFIX);
});

test("les callbacks inconnues ou mal formées sont rejetées", () => {
  assert.equal(parseShopCallback(""), null);
  assert.equal(parseShopCallback(null), null);
  assert.equal(parseShopCallback("menu:home"), null);
  assert.equal(parseShopCallback("shop:unknown:1"), null);
  assert.equal(parseShopCallback("shop:p:-3"), null);
  assert.equal(parseShopCallback("shop:w:"), null);
  assert.equal(parseShopCallback("shop:c:"), null);
  // Le préfixe boutique n'engloutit pas les autres modules du bot.
  assert.equal(parseShopCallback("shopkeeper"), null);
});

/* ------------------------------- Navigation ------------------------------- */

const CATALOG = [
  fakeProduct(),
  fakeProduct({ slug: "steam-wallet", kind: "game_topup", titleEn: "Steam Wallet", titleAr: "محفظة ستيم" }),
  fakeProduct({ slug: "not-for-sale", status: "coming_soon" }),
  fakeProduct({ slug: "no-denoms", denominations: [] }),
  // Fiche de l'ANCIEN fournisseur (retiré) : jamais vendable, jamais listée —
  // la caisse la refuserait (LEGACY_SUPPLIER_RETIRED), le bot ne doit donc
  // pas la proposer.
  fakeProduct({ slug: "legacy-psn", supplier: "reloadly" }),
];

test("les catégories affichent le nombre de produits vendables", () => {
  for (const locale of ["ar", "en"]) {
    const view = shopCategoriesView(CATALOG, locale, LINKS);
    assert.match(view.text, /🛒/);
    // 4 familles du site + retour menu.
    const callbacks = view.keyboard.flat().map((b) => b.callback_data);
    assert.equal(callbacks.filter((data) => data?.startsWith("shop:c:")).length, 4);
    assert.ok(callbacks.includes("shop:c:gift_card:1"));
    assert.ok(callbacks.includes("shop:c:subscription_code:1"));
    assert.ok(callbacks.includes("menu:home"));
    // Le compteur n'expose ni les fiches hors vente (coming_soon, sans
    // montants) ni celles de l'ancien fournisseur retiré.
    const giftCardRow = view.keyboard.flat().find((b) => b.callback_data === "shop:c:gift_card:1");
    assert.match(giftCardRow.text, /\(1\)/);
  }
});

test("l'ancien fournisseur retiré n'est jamais proposé dans la boutique", () => {
  const products = shopProductsOfKind(CATALOG, "gift_card");
  assert.deepEqual(
    products.map((p) => p.slug),
    ["playstation-store-us"],
  );
});

test("la page produits liste des prix et ne transporte que des index", () => {
  const view = shopCategoryView(CATALOG, "gift_card", 1, "en", LINKS);
  assert.match(view.text, /1 product\(s\)/);
  const buttons = view.keyboard.flat().filter((b) => b.callback_data?.startsWith("shop:p:"));
  assert.equal(buttons.length, 1);
  assert.equal(buttons[0].callback_data, "shop:p:0");
  assert.match(buttons[0].text, /PlayStation Store \(US\)/);
  // « Produits (avec prix) » : le prix minimum figure sur le bouton.
  assert.match(buttons[0].text, /from \$11\.50/);
  // État : la page résout l'index → slug côté serveur uniquement.
  assert.deepEqual(view.state.products, ["playstation-store-us"]);
  assert.equal(view.state.kind, "gift_card");
  assert.equal(view.state.page, 1);
});

test("la pagination des produits borne les pages et découpe par 8", () => {
  assert.equal(pageCountOf(8, 8), 1);
  assert.equal(pageCountOf(9, 8), 2);
  assert.equal(pageCountOf(0, 8), 1);
  const many = Array.from({ length: 18 }, (_, i) =>
    fakeProduct({ slug: `product-${i}`, kind: "software_key" }),
  );
  assert.equal(shopProductsOfKind(many, "software_key").length, 18);
  const page2 = shopCategoryView(many, "software_key", 9, "en", LINKS);
  // Page hors bornes → dernière page réelle.
  assert.deepEqual(page2.state.products.length, 2);
  assert.equal(page2.state.page, 3);
  const nav = page2.keyboard.flat().map((b) => b.callback_data);
  assert.ok(nav.includes("shop:c:software_key:2")); // ◀️
  assert.ok(nav.includes("shop:c:software_key:3")); // position courante
  const first = shopCategoryView(many, "software_key", 1, "en", LINKS);
  assert.ok(
    first.keyboard.flat().some((b) => b.callback_data === "shop:c:software_key:2"),
  );
});

test("une famille vide reste utilisable (message + retour)", () => {
  const view = shopCategoryView(CATALOG, "subscription_code", 1, "en", LINKS);
  assert.match(view.text, /Nothing on sale/);
  assert.ok(
    view.keyboard.flat().some((b) => b.callback_data === "shop"),
  );
});

/* --------------------------- Produit & montants --------------------------- */

test("la fiche produit échappe le HTML hostile et liste les montants vendus", () => {
  const hostile = fakeProduct({
    titleEn: '<script>alert("x")</script>',
    descriptionEn: "Prix <b>gros</b> & taxes",
  });
  const view = shopProductView(hostile, 1, "en", LINKS);
  assert.doesNotMatch(view.text, /<script>/);
  assert.match(view.text, /&lt;script&gt;/);
  assert.match(view.text, /&lt;b&gt;/);
  // Seuls les montants disponibles avec un prix sont cliquables.
  const denoms = view.keyboard.flat().filter((b) => b.callback_data?.startsWith("shop:d:"));
  assert.deepEqual(denoms.map((b) => b.callback_data), ["shop:d:0", "shop:d:1"]);
  assert.match(denoms[0].text, /\$10 · \$11\.50/);
  // L'état enregistre les identifiants de montants affichés.
  assert.deepEqual(view.state.denoms, ["psn-10", "psn-25"]);
});

test("les détails calculent le total et bornent la quantité", () => {
  const product = fakeProduct({
    denominations: [
      { id: "psn-10", label: "$10", faceValue: "10 USD", priceUsd: 11.5, available: true, maxQuantity: 3 },
    ],
  });
  const view = shopDenominationView(product, product.denominations[0], 5, 1, "en", LINKS);
  assert.match(view.text, /Quantity: <b>3<\/b>/);
  assert.match(view.text, /Total: <b>\$34\.50<\/b>/);
  const plus = view.keyboard.flat().filter((b) => b.callback_data === "shop:q:+");
  assert.equal(plus.length, 2); // ➕ et le compteur
  assert.ok(view.state.qty === 3);
  const below = shopDenominationView(product, product.denominations[0], 0, 1, "en", LINKS);
  assert.match(below.text, /Quantity: <b>1<\/b>/);
});

test("un produit à champs acheteur n'offre pas d'achat en chat", () => {
  const withFields = fakeProduct({
    kind: "game_topup",
    slug: "roblox-robux",
    denominations: [
      {
        id: "rbx-800",
        label: "800 Robux",
        faceValue: "800 Robux",
        priceUsd: 12.4,
        available: true,
        fields: [{ key: "user_id", label: "Roblox user ID", type: "text" }],
      },
    ],
  });
  const view = shopDenominationView(withFields, withFields.denominations[0], 1, 1, "en", LINKS);
  const callbacks = view.keyboard.flat().map((b) => b.callback_data ?? "");
  assert.ok(!callbacks.includes("shop:buy"));
  const webUrl = view.keyboard.flat().find((b) => b.url?.includes("/codes/roblox-robux"));
  assert.ok(webUrl, "le bouton renvoie vers la fiche web");
});

/* --------------------------- Plancher de facture --------------------------- */

test("la vue montant minimum suggère la quantité exacte", () => {
  // Amazon (AE) 1 AED à 1,18 $ : sous le plancher de 1,50 $.
  const cheap = fakeProduct({
    slug: "amazon-ae",
    titleEn: "Amazon (AE) · Instant use",
    denominations: [{ id: "aed-1", label: "1 AED", faceValue: "1 AED", priceUsd: 1.18, available: true }],
  });
  const view = shopBelowMinimumView(cheap, cheap.denominations[0], 1.5, "en", LINKS, 2);
  assert.match(view.text, /minimum invoice is \$1\.50/);
  assert.match(view.text, /2 × 1 AED/);
  assert.match(view.text, /\$2\.36/);
  assert.match(view.text, /Amazon \(AE\)/);
  // Retour vers la page produit (page courante préservée) + fiche web.
  const callbacks = view.keyboard.flat().map((b) => b.callback_data);
  assert.ok(callbacks.includes("shop:pd:2"));
  assert.ok(view.keyboard.flat().some((b) => b.url?.includes("/codes/amazon-ae")));
});

test("la vue montant minimum reste juste aux bornes de quantité", () => {
  const cheap = fakeProduct({
    denominations: [
      { id: "tiny", label: "$0.20", faceValue: "0.20 USD", priceUsd: 0.2, available: true, maxQuantity: 3 },
    ],
  });
  const view = shopBelowMinimumView(cheap, cheap.denominations[0], 1.5, "en", LINKS, 1);
  // 1.50 / 0.20 = 7.5 → plafonné à maxQuantity 3 → reste sous le plancher.
  assert.match(view.text, /3 × \$0\.20/);
  assert.match(view.text, /below the minimum even at maximum/);
});

/* --------------------------------- Paiement -------------------------------- */

test("la vue paiement expose facture, carte, autres moyens et consentement", () => {
  const view = shopPaymentView({
    ref: "DGC-1A2B3C4D5E6F",
    title: "PlayStation Store (US)",
    label: "$25",
    qty: 2,
    totalUsd: "$55.80",
    paymentUrl: "https://nowpayments.io/invoice/abc",
    trackingToken: "tok_abc123",
    cardUrl: "https://nokhba.net.ly/api/payments/paygate/switch?ref=DGC-1A2B3C4D5E6F&t=tok_abc123",
    slug: "playstation-store-us",
    email: "client@example.com",
    locale: "en",
    links: LINKS,
  });
  assert.match(view.text, /DGC-1A2B3C4D5E6F/);
  assert.match(view.text, /client@example\.com/);
  assert.match(view.text, /\$55\.80/);
  const flat = view.keyboard.flat();
  assert.deepEqual(
    flat.filter((b) => b.callback_data?.startsWith("shop:w:")).map((b) => b.callback_data),
    ["shop:w:DGC-1A2B3C4D5E6F"],
  );
  const pay = flat.find((b) => b.text.includes("Pay now"));
  assert.equal(pay.url, "https://nowpayments.io/invoice/abc");
  // Carte : continue la MÊME commande via la route de bascule (ref + jeton).
  const card = flat.find((b) => b.text.includes("Pay by card"));
  assert.equal(
    card.url,
    "https://nokhba.net.ly/api/payments/paygate/switch?ref=DGC-1A2B3C4D5E6F&t=tok_abc123",
  );
  // Autres méthodes (Skrill, recharge) : preuve à déclarer → fiche web du produit.
  const other = flat.find((b) => b.text.includes("Other methods"));
  assert.equal(other.url, "https://nokhba.net.ly/codes/playstation-store-us");
  // La caisse en attente est effacée, la dernière commande conservée (avec jeton).
  assert.equal(view.state.pending, null);
  assert.equal(view.state.lastOrder.ref, "DGC-1A2B3C4D5E6F");
  assert.equal(view.state.lastOrder.paymentUrl, "https://nowpayments.io/invoice/abc");
  assert.equal(view.state.lastOrder.trackingToken, "tok_abc123");
  assert.equal(view.state.lastOrder.qty, 2);
});

test("cartes cadeaux : marques (types de carte) triées avec compteurs", () => {
  const catalog = [
    fakeProduct({ slug: "steam-us", platform: "Steam", regions: ["US"] }),
    fakeProduct({ slug: "steam-tr", platform: "Steam", regions: ["TR"] }),
    fakeProduct({ slug: "google-play-us", platform: "Google Play", regions: ["US"] }),
    fakeProduct({ slug: "itunes-ae", platform: "iTunes", regions: ["AE"] }),
  ];
  const brands = shopBrandsOfKind(catalog, "gift_card");
  assert.deepEqual(
    brands.map((b) => `${b.name}:${b.count}`),
    ["Google Play:1", "iTunes:1", "Steam:2"],
  );
});

test("cartes cadeaux : régions d'une marque = union fiches + montants, normalisées", () => {
  const catalog = [
    fakeProduct({
      slug: "steam-multi",
      platform: "Steam",
      regions: ["us", "eu"],
      denominations: [
        { id: "s-10", label: "$10", faceValue: "10 USD", priceUsd: 11.5, available: true, region: "tr" },
        { id: "s-20", label: "$20", faceValue: "20 USD", priceUsd: 22.5, available: true, region: "EU" },
        { id: "s-30", label: "$30", faceValue: "30 USD", priceUsd: 33, available: false, region: "AE" }, // épuisé : ignoré
      ],
    }),
  ];
  assert.deepEqual(shopRegionsOfBrand(catalog, "gift_card", "Steam"), ["EU", "TR", "US"]);
});

test("cartes cadeaux : filtre marque + région via fiches ET montants", () => {
  const catalog = [
    fakeProduct({ slug: "steam-us", platform: "Steam", regions: ["US"] }),
    fakeProduct({
      slug: "steam-tr",
      platform: "Steam",
      regions: [],
      denominations: [
        { id: "s-tr-50", label: "50 TRY", faceValue: "50 TRY", priceUsd: 3.2, available: true, region: "TR" },
      ],
    }),
    fakeProduct({ slug: "google-play-us", platform: "Google Play", regions: ["US"] }),
  ];
  assert.deepEqual(
    shopProductsOfBrand(catalog, "gift_card", "Steam").map((p) => p.slug),
    ["steam-tr", "steam-us"],
  );
  assert.deepEqual(
    shopProductsOfBrand(catalog, "gift_card", "Steam", "tr").map((p) => p.slug),
    ["steam-tr"],
  );
  assert.deepEqual(
    shopProductsOfBrand(catalog, "gift_card", "Steam", "US").map((p) => p.slug),
    ["steam-us"],
  );
  // Région non couverte : aucun produit (défense en profondeur).
  assert.deepEqual(shopProductsOfBrand(catalog, "gift_card", "Steam", "JP"), []);
});

test("vue marques : boutons type de carte + retour boutique + état des marques", () => {
  const catalog = [
    fakeProduct({ slug: "steam-us", platform: "Steam", regions: ["US"] }),
    fakeProduct({ slug: "steam-tr", platform: "Steam", regions: ["TR"] }),
    fakeProduct({ slug: "google-play-us", platform: "Google Play", regions: ["US"] }),
  ];
  const view = shopBrandsView(catalog, "gift_card", 1, "en", LINKS);
  assert.match(view.text, /Choose a card type:/);
  const flat = view.keyboard.flat();
  const labels = flat.filter((b) => b.callback_data?.startsWith("shop:bn:")).map((b) => b.text);
  assert.deepEqual(labels, ["Google Play (1)", "Steam (2)"]);
  assert.deepEqual(
    flat.filter((b) => b.callback_data?.startsWith("shop:bn:")).map((b) => b.callback_data),
    ["shop:bn:0", "shop:bn:1"],
  );
  assert.ok(flat.some((b) => b.callback_data === "shop"), "retour vers la boutique");
  assert.deepEqual(view.state.brands, ["Google Play", "Steam"]);
  assert.equal(view.state.brand, null);
});

test("vue régions : boutons région + toutes les régions + retour marques", () => {
  const catalog = [
    fakeProduct({ slug: "steam-us", platform: "Steam", regions: ["US"] }),
    fakeProduct({
      slug: "steam-tr",
      platform: "Steam",
      regions: [],
      denominations: [
        { id: "s-tr-50", label: "50 TRY", faceValue: "50 TRY", priceUsd: 3.2, available: true, region: "TR" },
      ],
    }),
  ];
  const view = shopBrandRegionsView(catalog, "gift_card", "Steam", 1, "en", LINKS);
  assert.match(view.text, /Choose a region:/);
  const flat = view.keyboard.flat();
  const regions = flat.filter((b) => b.callback_data?.startsWith("shop:rg:")).map((b) => b.text);
  assert.deepEqual(regions, ["TR (1)", "US (1)"]);
  assert.ok(flat.some((b) => b.callback_data === "shop:rga"), "bouton toutes les régions");
  assert.ok(flat.some((b) => b.callback_data === "shop:b:gift_card:1"), "retour vers les marques");
  assert.deepEqual(view.state.regions, ["TR", "US"]);
  assert.equal(view.state.brand, "Steam");
});

test("liste produits marque : pagination dédiée et retour régions/marques", () => {
  const catalog = [
    fakeProduct({ slug: "steam-us", platform: "Steam", regions: ["US"] }),
    fakeProduct({ slug: "steam-tr", platform: "Steam", regions: ["TR"] }),
  ];
  // Marque multi-régions : le retour remonte aux régions, pagination dédiée.
  const withRegions = shopCategoryView(catalog, "gift_card", 1, "en", LINKS, {
    brand: "Steam",
    region: "US",
    regionStep: true,
  });
  let flat = withRegions.keyboard.flat();
  assert.match(withRegions.text, /Steam · US/);
  assert.ok(
    flat.every((b) => !b.callback_data?.startsWith("shop:c:")),
    "aucun callback de catégorie plate",
  );
  assert.ok(flat.some((b) => b.callback_data === "shop:rgp:1"), "retour régions");
  assert.deepEqual(withRegions.state.products, ["steam-us"]);
  assert.equal(withRegions.state.brand, "Steam");
  assert.equal(withRegions.state.region, "US");

  // Marque mono-région : retour direct vers les marques.
  const single = shopCategoryView(
    [fakeProduct({ slug: "google-play-us", platform: "Google Play", regions: ["US"] })],
    "gift_card",
    1,
    "en",
    LINKS,
    { brand: "Google Play", region: null, regionStep: false },
  );
  flat = single.keyboard.flat();
  assert.ok(flat.some((b) => b.callback_data === "shop:b:gift_card:1"), "retour marques");
});

test("callbacks marque/région : aller-retour codec", () => {
  assert.equal(shopCallback({ view: "brands", kind: "gift_card", page: 2 }), "shop:b:gift_card:2");
  assert.deepEqual(parseShopCallback("shop:b:gift_card:2"), {
    view: "brands",
    kind: "gift_card",
    page: 2,
  });
  assert.deepEqual(parseShopCallback("shop:bn:3"), { view: "brand", index: 3 });
  assert.deepEqual(parseShopCallback("shop:rgp:1"), { view: "regionPage", page: 1 });
  assert.deepEqual(parseShopCallback("shop:rg:5"), { view: "region", index: 5 });
  assert.deepEqual(parseShopCallback("shop:rga"), { view: "regionAll" });
  assert.deepEqual(parseShopCallback("shop:bp:4"), { view: "brandProductsPage", page: 4 });
});

test("sans URL de bascule (sous minimum carte), pas de bouton carte", () => {
  const view = shopPaymentView({
    ref: "DGC-1A2B3C4D5E6F",
    title: "Amazon (AE)",
    label: "1 AED",
    qty: 2,
    totalUsd: "$2.36",
    paymentUrl: "https://nowpayments.io/invoice/def",
    trackingToken: "tok_abc123",
    cardUrl: null,
    slug: "amazon-ae",
    email: "client@example.com",
    locale: "en",
    links: LINKS,
  });
  const flat = view.keyboard.flat();
  assert.ok(!flat.some((b) => b.text.includes("Pay by card")), "bouton carte masqué");
  assert.ok(flat.some((b) => b.text.includes("Pay now")), "facture crypto toujours là");
  assert.equal(view.state.lastOrder.trackingToken, "tok_abc123");
});

test("l'URL de bascule carte reste correcte pour refs et jetons exotiques", () => {
  assert.equal(
    shopCardSwitchUrl(LINKS, "dgc-1a2b3c4d5e6f", "tok+/=&x"),
    "https://nokhba.net.ly/api/payments/paygate/switch?ref=dgc-1a2b3c4d5e6f&t=tok%2B%2F%3D%26x",
  );
});

test("la demande d'e-mail montre la commande et une sortie", () => {
  const view = shopEmailPromptView(
    { title: "PlayStation Store (US)", label: "$25", totalUsd: "27.90" },
    "en",
  );
  assert.match(view.text, /Which email address/);
  assert.match(view.text, /name@example\.com/);
  assert.match(view.text, /\$27\.90/);
  assert.ok(view.keyboard.flat().some((b) => b.callback_data === "shop:cancel"));
});

/* --------------------------------- E-mail --------------------------------- */

test("l'e-mail de livraison est validé avant la caisse", () => {
  assert.equal(isPlausibleEmail("name@example.com"), true);
  assert.equal(isPlausibleEmail("NAME+tag@sub.example.co"), true);
  assert.equal(isPlausibleEmail("  spaced@example.com  "), true);
  assert.equal(isPlausibleEmail("not-an-email"), false);
  assert.equal(isPlausibleEmail("a@b"), false);
  assert.equal(isPlausibleEmail("@example.com"), false);
  assert.equal(isPlausibleEmail("name@"), false);
  assert.equal(isPlausibleEmail(""), false);
  assert.equal(isPlausibleEmail(null), false);
  assert.equal(isPlausibleEmail("name@example.com.<script>"), false);
});

/* --------------------------------- Textes --------------------------------- */

test("les deux langues exposent exactement les mêmes clés boutique", () => {
  const reference = Object.keys(shopCopy("en")).sort();
  assert.deepEqual(Object.keys(shopCopy("ar")).sort(), reference);
  for (const key of reference) {
    const value = shopCopy("ar")[key];
    if (typeof value === "string") assert.ok(value.length > 0, `ar : ${key} vide`);
  }
  assert.match(shopCopy("ar").emailPrompt, /اختر|البريد|أرسل/);
});

test("le format monétaire reste lisible et stable", () => {
  assert.equal(formatShopUsd(11.5), "$11.50");
  assert.equal(formatShopUsd(12), "$12");
  assert.equal(formatShopUsd(12.001), "$12");
  assert.equal(fillShopTemplate("{ref} — {total}", { ref: "DGC-1", total: "$5" }), "DGC-1 — $5");
  assert.equal(fillShopTemplate("{inconnu}", { ref: "x" }), "{inconnu}");
});

test("l'état vide est un objet sans surprise", () => {
  assert.deepEqual(EMPTY_SHOP_STATE, {});
});

/* ----------- Améliorations UX, BiDi, minimum auto & diagnostic ------------ */

test("la callback d'achat à quantité minimale boucle dans les bornes", () => {
  const encoded = shopCallback({ view: "buyMin", qty: 2 });
  assert.equal(encoded, "shop:bm:2");
  assert.ok(shopCallbackFits({ view: "buyMin", qty: 2 }));
  assert.deepEqual(parseShopCallback(encoded), { view: "buyMin", qty: 2 });
  assert.equal(parseShopCallback("shop:bm:0"), null);
  assert.equal(parseShopCallback("shop:bm:99"), null);
});

test("la quantité initiale se cale sur le plancher crypto quand c'est atteignable", () => {
  // Cas exact de la capture : Amazon (AE) 1 AED à 1,18 $ avec plancher 1,50 $.
  assert.deepEqual(shopInitialQuantity({ priceUsd: 1.18 }, 1.5), {
    qty: 2,
    autoAdjusted: true,
    minQty: 2,
  });
  // Montant déjà au-dessus du plancher : reste à 1 sans note.
  assert.deepEqual(shopInitialQuantity({ priceUsd: 11.5 }, 1.5), {
    qty: 1,
    autoAdjusted: false,
    minQty: 1,
  });
  // Plafond maxQuantity trop bas pour atteindre le plancher : reste à 1.
  assert.deepEqual(shopInitialQuantity({ priceUsd: 0.2, maxQuantity: 3 }, 1.5), {
    qty: 1,
    autoAdjusted: false,
    minQty: 8,
  });
});

test("la vue montant affiche l'e-mail mémorisé, le bouton changer et la note plancher", () => {
  const cheap = fakeProduct({
    slug: "amazon-ae",
    titleAr: "بطاقة هدايا — Amazon (AE)",
    titleEn: "Amazon (AE)",
    denominations: [{ id: "aed-1", label: "Instant use — 1 AED", faceValue: "1 AED", priceUsd: 1.18, available: true }],
  });
  const view = shopDenominationView(
    cheap,
    cheap.denominations[0],
    2,
    1,
    "ar",
    LINKS,
    {
      checkoutEmail: "walidhamrit@gmail.com",
      minOrderUsd: 1.5,
      autoAdjustedMin: true,
    },
  );
  assert.match(view.text, /<code>walidhamrit@gmail\.com<\/code>/);
  assert.match(view.text, /\$1\.50/);
  assert.match(view.text, /×2/);
  const callbacks = view.keyboard.flat().map((b) => b.callback_data);
  assert.ok(callbacks.includes("shop:email"), "bouton changer d'e-mail présent");
  assert.equal(view.state.pending, null);
});

test("aucune fuite de français dans les vues arabes et séparation BiDi propre", () => {
  const cheap = fakeProduct({
    slug: "amazon-ae",
    titleAr: "بطاقة هدايا — Amazon (AE)",
    denominations: [{ id: "aed-1", label: "Instant use — 1 AED", faceValue: "1 AED", priceUsd: 1.18, available: true }],
  });
  const prodAr = shopProductView(cheap, 1, "ar", LINKS, 3);
  const denomAr = shopDenominationView(cheap, cheap.denominations[0], 2, 1, "ar", LINKS);
  const minAr = shopBelowMinimumView(cheap, cheap.denominations[0], 1.5, "ar", LINKS, 1);
  for (const view of [prodAr, denomAr, minAr]) {
    assert.doesNotMatch(view.text, /Fiche web|Ce montant/i);
    for (const btn of view.keyboard.flat()) {
      assert.doesNotMatch(btn.text, /Fiche web/i);
    }
  }
  // Retour fidèle vers la page 3 de la catégorie.
  assert.ok(prodAr.keyboard.flat().some((b) => b.callback_data === "shop:c:gift_card:3"));
  // Bouton 1-clic d'achat ×2 directement sur la vue plancher.
  assert.ok(minAr.keyboard.flat().some((b) => b.callback_data === "shop:bm:2"));

  // L'invite d'e-mail sépare le titre arabe+latin du libellé anglais sur deux lignes.
  const promptAr = shopEmailPromptView(
    { title: "بطاقة هدايا — Amazon (AE)", label: "Instant use — 1 AED", totalUsd: "2.36", qty: 2 },
    "ar",
  );
  assert.match(promptAr.text, /📦 <b>بطاقة هدايا — Amazon \(AE\)<\/b>\n💳 Instant use — 1 AED · ×2/);
});

test("toutes les vues de navigation réinitialisent pending à null", () => {
  const p = fakeProduct();
  assert.equal(shopCategoriesView(CATALOG, "ar", LINKS).state.pending, null);
  assert.equal(shopCategoryView(CATALOG, "gift_card", 1, "ar", LINKS).state.pending, null);
  assert.equal(shopProductView(p, 1, "ar", LINKS).state.pending, null);
  assert.equal(shopDenominationView(p, p.denominations[0], 1, 1, "ar", LINKS).state.pending, null);
});

test("classification des erreurs de caisse et vue d'erreur avec bouton WhatsApp", () => {
  assert.deepEqual(classifyShopCheckoutError({ errorCode: "below_minimum" }), {
    reason: "below_minimum",
    alertAdmin: false,
  });
  assert.deepEqual(classifyShopCheckoutError({ errorCode: "above_limit" }), {
    reason: "above_limit",
    alertAdmin: false,
  });
  assert.deepEqual(classifyShopCheckoutError({ errorCode: "product_not_found" }), {
    reason: "not_found",
    alertAdmin: false,
  });
  assert.deepEqual(classifyShopCheckoutError({ errorCode: "supplier_balance_insufficient" }), {
    reason: "supplier_balance_insufficient",
    alertAdmin: true,
  });
  assert.deepEqual(classifyShopCheckoutError({ isNowPayments: true }), {
    reason: "payment_gateway_error",
    alertAdmin: true,
  });

  const errView = shopCheckoutErrorView({
    reason: "supplier_balance_insufficient",
    locale: "ar",
    links: LINKS,
    pending: {
      slug: "amazon-ae",
      title: "بطاقة هدايا — Amazon (AE)",
      label: "Instant use — 1 AED",
      qty: 2,
      totalUsd: "2.36",
    },
  });
  assert.equal(errView.state.pending, null);
  const waBtn = errView.keyboard.flat().find((b) => b.url?.startsWith("https://wa.me/218913442640?text="));
  assert.ok(waBtn, "bouton WhatsApp pré-rempli présent");
  assert.match(decodeURIComponent(waBtn.url), /Amazon \(AE\)/);
  assert.ok(errView.keyboard.flat().some((b) => b.url?.includes("/codes/amazon-ae")));

  const alertHtml = formatShopCheckoutFailureAlert({
    siteName: "Nukhba",
    reason: "supplier_balance_insufficient",
    title: "Amazon <AE>",
    label: "1 AED",
    qty: 2,
    totalUsd: "2.36",
    actorLabel: "Walid · @walid",
    maskedEmail: maskShopEmail("walidhamrit@gmail.com"),
    detail: "Solde < coût",
  });
  assert.match(alertHtml, /Solde fournisseur insuffisant/);
  assert.match(alertHtml, /wa\*\*\*@gmail\.com/);
  assert.doesNotMatch(alertHtml, /walidhamrit@gmail\.com/);
  assert.doesNotMatch(alertHtml, /<AE>/);
});

test("annulation texte, masquage d'e-mail et normalisation WhatsApp", () => {
  assert.equal(isCancelShopInput("إلغاء"), true);
  assert.equal(isCancelShopInput("الغاء"), true);
  assert.equal(isCancelShopInput("  Cancel "), true);
  assert.equal(isCancelShopInput("annuler"), true);
  assert.equal(isCancelShopInput("walid@gmail.com"), false);
  assert.equal(maskShopEmail("walidhamrit@gmail.com"), "wa***@gmail.com");
  assert.equal(maskShopEmail(""), "—");
  assert.equal(
    shopWhatsappUrl("+218 91-344-2640", "Bonjour"),
    "https://wa.me/218913442640?text=Bonjour",
  );
  assert.equal(shopWhatsappUrl(""), null);
});

