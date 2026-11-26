import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildMiniAppBrands,
  buildMiniAppCategories,
  buildMiniAppProducts,
  buildMiniAppRegionChips,
  filterMiniAppProducts,
  formatMiniAppUsd,
  isTelegramMiniAppPath,
  MINI_APP_CATEGORY_IMAGES,
  miniAppBrandHeading,
  miniAppBrandLabel,
  miniAppInitials,
  miniAppOpensExternally,
  miniAppProductHref,
  miniAppRegionLabel,
  miniAppRegionNote,
  resolveMiniAppLocale,
  telegramMiniAppCsp,
  topMiniAppBrands,
} from "../src/lib/telegram-mini-app-core.ts";
import {
  mainMenuKeyboard,
  telegramMenuButton,
  telegramMiniAppUrl,
  withMiniAppLocale,
} from "../src/lib/telegram-core.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(join(root, path), "utf8");

const product = (overrides = {}) => ({
  slug: "steam-wallet-global",
  kind: "gift_card",
  status: "available",
  platform: "Steam",
  color: "#1b2838",
  titleAr: "محفظة ستيم",
  titleEn: "Steam Wallet (Global)",
  regions: ["GLOBAL"],
  denominations: [
    { available: true, priceUsd: 11.5 },
    { available: true, priceUsd: 6.31 },
    { available: false, priceUsd: 1 },
  ],
  ...overrides,
});

const CATEGORIES = [
  { kind: "gift_card", ar: "بطاقات هدايا", en: "Gift cards" },
  { kind: "game_topup", ar: "شحن الألعاب", en: "Game top-ups" },
  { kind: "software_key", ar: "مفاتيح البرامج", en: "Software keys" },
  { kind: "subscription_code", ar: "أكواد الاشتراك", en: "Subscriptions" },
];

const visual = () => ({ src: "/game-covers/x.jpg", fit: "cover" });

/* ------------------------------ Catalogue ------------------------------ */

test("seuls les produits disponibles avec un montant vendable sont affichés", () => {
  const items = buildMiniAppProducts(
    [
      product(),
      product({ slug: "soon", status: "coming_soon" }),
      product({ slug: "empty", denominations: [] }),
      product({ slug: "sold-out", denominations: [{ available: false, priceUsd: 5 }] }),
      product({ slug: "free", denominations: [{ available: true, priceUsd: 0 }] }),
    ],
    visual,
  );
  assert.deepEqual(items.map((item) => item.slug), ["steam-wallet-global"]);
  // Prix « à partir de » = plus petit montant DISPONIBLE (1 $ indisponible ignoré).
  assert.equal(items[0].fromUsd, 6.31);
});

test("la charge utile ne transporte que les champs affichés", () => {
  const [item] = buildMiniAppProducts(
    [product({ descriptionEn: "long text", supplier: "fazercards", regions: ["US", "CA", "MX"] })],
    visual,
  );
  assert.deepEqual(Object.keys(item).sort(), [
    "color",
    "fit",
    "fromUsd",
    "image",
    "kind",
    "platform",
    "regions",
    "slug",
    "titleAr",
    "titleEn",
  ]);
  assert.deepEqual(item.regions, ["US", "CA", "MX"]);
});

test("couleur invalide → couleur de repli ; pas de visuel → fit cover", () => {
  const [item] = buildMiniAppProducts([product({ color: "red; background:url(x)" })], () => ({
    src: null,
    fit: "contain",
  }));
  assert.equal(item.color, "#6d5ae6");
  assert.equal(item.image, null);
  assert.equal(item.fit, "cover");
});

test("chaque famille a sa photo et une famille vide est masquée", () => {
  const items = buildMiniAppProducts(
    [product(), product({ slug: "pubg", kind: "game_topup", platform: "PUBG Mobile" })],
    visual,
  );
  const categories = buildMiniAppCategories(CATEGORIES, items);
  assert.deepEqual(categories.map((c) => c.kind), ["gift_card", "game_topup"]);
  assert.deepEqual(categories.map((c) => c.count), [1, 1]);
  for (const kind of CATEGORIES.map((c) => c.kind)) {
    const image = MINI_APP_CATEGORY_IMAGES[kind];
    assert.ok(image, `photo manquante pour ${kind}`);
    assert.ok(existsSync(join(root, "public", image)), `${image} absent de public/`);
  }
});

test("les marques les plus représentées passent en premier", () => {
  const items = buildMiniAppProducts(
    [
      product({ slug: "a", platform: "Steam" }),
      product({ slug: "b", platform: "Steam" }),
      product({ slug: "c", platform: "Amazon" }),
      product({ slug: "d", platform: "" }),
    ],
    visual,
  );
  assert.deepEqual(topMiniAppBrands(items), ["Steam", "Amazon"]);
  assert.deepEqual(topMiniAppBrands(items, 1), ["Steam"]);
});

/* ------------------- Navigation catégorie → marque → région ------------------- */

test("navigation : les marques d'une famille, avec le visuel du produit le plus demandé", () => {
  const items = buildMiniAppProducts(
    [
      product({ slug: "psn-sa", platform: "PlayStation", titleEn: "PlayStation (SA)", regions: ["SA"] }),
      product({ slug: "psn-jp", platform: "PlayStation", titleEn: "PlayStation (JP)", regions: ["JP"] }),
      product({ slug: "psn-us", platform: "PlayStation", titleEn: "PlayStation (US)", regions: ["US"] }),
      product({ slug: "steam", platform: "Steam", regions: ["GLOBAL"] }),
      product({ slug: "no-brand", platform: "" }),
    ],
    ({ slug }) => ({ src: `/covers/${slug}.jpg`, fit: "cover" }),
  );
  const brands = buildMiniAppBrands(items);
  assert.deepEqual(
    brands.map((b) => [b.name, b.count, b.image]),
    [
      ["PlayStation", 3, "/covers/psn-sa.jpg"],
      ["Steam", 1, "/covers/steam.jpg"],
    ],
  );
});

test("libellés de marques : arabe reconnaissable, anglais d'origine", () => {
  assert.equal(miniAppBrandLabel("PlayStation", "ar"), "بلايستيشن");
  assert.equal(miniAppBrandLabel("Steam Wallet", "ar"), "Steam Wallet");
  assert.equal(miniAppBrandLabel("PlayStation", "en"), "PlayStation");
  assert.equal(miniAppBrandHeading("PlayStation", "ar"), "بلايستيشن (PlayStation)");
  assert.equal(miniAppBrandHeading("PlayStation", "en"), "PlayStation");
});

test("régions : noms complets bilingues, code inconnu affiché tel quel", () => {
  assert.equal(miniAppRegionLabel("sa", "ar"), "السعودية");
  assert.equal(miniAppRegionLabel("SA", "en"), "Saudi Arabia");
  assert.equal(miniAppRegionLabel("jp", "ar"), "اليابان");
  assert.equal(miniAppRegionLabel("jp", "en"), "Japan");
  assert.match(miniAppRegionLabel("mena", "en"), /MENA — Middle East & North Africa/);
  assert.match(miniAppRegionLabel("MENA", "ar"), /الشرق الأوسط وشمال إفريقيا/);
  assert.equal(miniAppRegionLabel("xx", "en"), "XX");
  assert.equal(miniAppRegionLabel("", "en"), "");
});

test("MENA et les codes non-pays listent l'ensemble des pays couverts", () => {
  const menaAr = miniAppRegionNote("MENA", "ar");
  const menaEn = miniAppRegionNote("mena", "en");
  for (const country of ["السعودية", "الإمارات", "قطر", "الكويت", "عُمان", "البحرين", "العراق", "مصر", "الأردن", "لبنان", "المغرب", "الجزائر", "تونس", "ليبيا"]) {
    assert.ok(menaAr.includes(country), `MENA (ar) manque ${country}`);
  }
  for (const country of ["Saudi Arabia", "UAE", "Qatar", "Kuwait", "Oman", "Bahrain", "Iraq", "Yemen", "Egypt", "Jordan", "Lebanon", "Morocco", "Algeria", "Tunisia", "Libya", "Mauritania"]) {
    assert.ok(menaEn.includes(country), `MENA (en) manque ${country}`);
  }
  assert.match(miniAppRegionNote("GLOBAL", "en"), /any country/);
  assert.match(miniAppRegionNote("EU", "ar"), /دولة أوروبية/);
  assert.equal(miniAppRegionNote("SA", "en"), null, "un pays simple n'a pas de légende");
});

test("puces de région d'une sélection : triées par nombre de produits", () => {
  const items = buildMiniAppProducts(
    [
      product({ slug: "a", regions: ["GLOBAL"] }),
      product({ slug: "b", regions: ["SA"] }),
      product({ slug: "c", regions: ["SA", "AE"] }),
      product({ slug: "d", regions: ["MENA"] }),
      product({ slug: "e", regions: ["SA"] }),
    ],
    visual,
  );
  assert.deepEqual(buildMiniAppRegionChips(items), ["SA", "AE", "GLOBAL", "MENA"]);
});

test("filtre par région et recherche par nom de région en clair (AR et EN)", () => {
  const items = buildMiniAppProducts(
    [
      product({ slug: "psn-sa", platform: "PlayStation", regions: ["SA"] }),
      product({ slug: "psn-jp", platform: "PlayStation", regions: ["JP"] }),
      product({ slug: "psn-mena", platform: "PlayStation", regions: ["MENA"] }),
    ],
    visual,
  );
  const slugs = (filter) =>
    filterMiniAppProducts(items, { kind: null, brand: null, region: null, query: "", ...filter }).map((p) => p.slug);
  assert.deepEqual(slugs({ brand: "PlayStation", region: "SA" }), ["psn-sa"]);
  assert.deepEqual(slugs({ region: "JP" }), ["psn-jp"]);
  assert.deepEqual(slugs({ query: "اليابان" }), ["psn-jp"]);
  assert.deepEqual(slugs({ query: "japan" }), ["psn-jp"]);
  assert.deepEqual(slugs({ query: "saudi arabia" }), ["psn-sa"]);
});

test("recherche AR/EN insensible aux accents, combinée famille + marque", () => {
  const items = buildMiniAppProducts(
    [
      product(),
      product({ slug: "psn-sa", platform: "PlayStation", titleEn: "PlayStation (SA)", titleAr: "بلايستيشن السعودية", regions: ["SA"] }),
      product({ slug: "pubg", kind: "game_topup", platform: "PUBG Mobile", titleEn: "PUBG Mobile UC", titleAr: "شدات ببجي" }),
    ],
    visual,
  );
  const slugs = (filter) => filterMiniAppProducts(items, { kind: null, brand: null, query: "", ...filter }).map((p) => p.slug);
  assert.deepEqual(slugs({ query: "STÉAM" }), ["steam-wallet-global"]);
  assert.deepEqual(slugs({ query: "ببجي" }), ["pubg"]);
  assert.deepEqual(slugs({ query: "playstation sa" }), ["psn-sa"]);
  assert.deepEqual(slugs({ kind: "gift_card" }), ["steam-wallet-global", "psn-sa"]);
  assert.deepEqual(slugs({ kind: "gift_card", brand: "PlayStation" }), ["psn-sa"]);
  assert.deepEqual(slugs({ kind: "game_topup", query: "steam" }), []);
});

/* ------------------------------ Affichage ------------------------------ */

test("langue : ?lang explicite > langue Telegram > langue du site", () => {
  assert.equal(resolveMiniAppLocale("en", "ar", "ar"), "en");
  assert.equal(resolveMiniAppLocale(null, "ar-LY", "en"), "ar");
  assert.equal(resolveMiniAppLocale(null, "fr", "ar"), "en");
  assert.equal(resolveMiniAppLocale(null, null, "ar"), "ar");
  assert.equal(resolveMiniAppLocale("xx", undefined, "en"), "en");
});

test("prix, initiales et lien produit", () => {
  assert.equal(formatMiniAppUsd(6.306, "en"), "$6.31");
  assert.equal(formatMiniAppUsd(15, "ar"), "15.00 $");
  assert.equal(miniAppInitials("Steam Wallet"), "SW");
  assert.equal(miniAppInitials("roblox"), "R");
  assert.equal(miniAppInitials(""), "?");
  assert.equal(
    miniAppProductHref("steam wallet", "ar", "ar"),
    "/codes/steam%20wallet?utm_source=telegram&utm_medium=mini_app",
  );
  assert.equal(
    miniAppProductHref("psn", "en", "ar"),
    "/codes/psn?utm_source=telegram&utm_medium=mini_app&lang=en",
  );
});

test("Telegram Web ouvre la fiche dans un onglet, les apps natives dans la même vue", () => {
  for (const platform of ["weba", "webk", "web"]) assert.equal(miniAppOpensExternally(platform), true);
  for (const platform of ["android", "ios", "tdesktop", "macos", null]) {
    assert.equal(miniAppOpensExternally(platform), false);
  }
});

/* ------------------------------ Sécurité ------------------------------- */

test("CSP de /tg : SDK Telegram + Telegram Web, le reste inchangé", () => {
  const base = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "frame-ancestors 'self'",
    "object-src 'none'",
  ];
  const csp = telegramMiniAppCsp(base);
  assert.match(csp, /script-src 'self' 'unsafe-inline' https:\/\/telegram\.org/);
  assert.match(csp, /frame-ancestors 'self' https:\/\/web\.telegram\.org https:\/\/\*\.telegram\.org/);
  assert.match(csp, /object-src 'none'/);
  assert.doesNotMatch(csp, /frame-ancestors[^;]*https: /, "jamais de joker https: global");
  assert.equal(isTelegramMiniAppPath("/tg"), true);
  assert.equal(isTelegramMiniAppPath("/tg/x"), true);
  assert.equal(isTelegramMiniAppPath("/tgx"), false);
  assert.equal(isTelegramMiniAppPath("/codes"), false);
});

test("next.config et proxy n'assouplissent l'embarquement QUE pour /tg", () => {
  const nextConfig = read("next.config.ts");
  assert.match(nextConfig, /source:\s*TELEGRAM_MINI_APP_PATH/);
  assert.match(nextConfig, /"frame-ancestors 'self'"/, "la règle globale reste 'self' en production");
  const proxy = read("src/proxy.ts");
  assert.match(proxy, /!isTelegramMiniAppPath\(pathname\)/);
  assert.match(proxy, /"X-Frame-Options", "SAMEORIGIN"/);
});

/* --------------------------------- Bot --------------------------------- */

test("le menu du bot ouvre la Mini App dans la langue du chat", () => {
  const links = {
    site: "https://nokhba.net.ly",
    store: "https://nokhba.net.ly/codes",
    whatsapp: "https://wa.me/218913442640",
    miniApp: telegramMiniAppUrl("https://nokhba.net.ly/"),
  };
  assert.equal(links.miniApp, "https://nokhba.net.ly/tg");
  for (const [lang, expected] of [["ar", "ar"], ["en", "en"], ["fr", "ar"]]) {
    const keyboard = mainMenuKeyboard(lang, links);
    assert.deepEqual(keyboard[0], [
      { text: keyboard[0][0].text, web_app: { url: `https://nokhba.net.ly/tg?lang=${expected}` } },
    ]);
    assert.match(keyboard[0][0].text, /🛍️/);
    // La boutique inline et le catalogue restent juste en dessous.
    assert.equal(keyboard[1][0].callback_data, "shop");
    assert.equal(keyboard[1][1].url, links.store);
  }
  assert.equal(withMiniAppLocale("https://x.ly/tg?a=1", "en"), "https://x.ly/tg?a=1&lang=en");
});

test("sans HTTPS, ni bouton Mini App ni bouton menu (Telegram refuserait)", () => {
  assert.equal(telegramMiniAppUrl("http://localhost:3000"), null);
  assert.equal(telegramMenuButton("http://localhost:3000"), null);
  const keyboard = mainMenuKeyboard("ar", {
    site: "http://localhost:3000",
    store: "http://localhost:3000/codes",
    whatsapp: "https://wa.me/1",
    miniApp: "http://localhost:3000/tg",
  });
  assert.equal(keyboard[0][0].callback_data, "shop");
  assert.ok(keyboard.flat().every((button) => !button.web_app));
  assert.deepEqual(telegramMenuButton("https://nokhba.net.ly"), {
    type: "web_app",
    text: "🛍️ المتجر · Store",
    web_app: { url: "https://nokhba.net.ly/tg" },
  });
});

// Le raccourci « parcourir avec photos » de /shop est testé dans
// telegram-shop.test.mjs (le noyau boutique s'importe via esbuild + alias @/).
