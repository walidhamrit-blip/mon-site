#!/usr/bin/env node
/**
 * Tests « portée mondiale » + socle du catalogue digital.
 *
 * Trois volets :
 *  1. le marché (`src/lib/market.ts`) n'est plus codé en dur sur Tripoli ;
 *  2. les devises (`src/lib/currency.ts`) convertissent correctement et ne
 *     renvoient jamais un prix faux ;
 *  3. le catalogue digital (`src/lib/digital-types.ts`) expose un domaine
 *     cohérent (régions, prix, slugs) ;
 *
 * Plus un contrôle statique : plus aucun « Tripoli » / « Africa/Tripoli »
 * figé dans le SEO, le contact ou les abonnements.
 *
 * Aucun appel réseau, aucun accès base : les modules testés sont purs.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("..", import.meta.url));
const srcRoot = join(root, "src");
const outDir = mkdtempSync(join(tmpdir(), "global-"));

const aliasPlugin = {
  name: "alias-at-src",
  setup(builder) {
    builder.onResolve({ filter: /^@\// }, (args) => {
      const base = join(srcRoot, args.path.slice(2));
      const candidates = [
        base,
        `${base}.ts`,
        `${base}.tsx`,
        `${base}.js`,
        join(base, "index.ts"),
        join(base, "index.tsx"),
      ];
      const found = candidates.find(
        (candidate) => existsSync(candidate) && statSync(candidate).isFile(),
      );
      return { path: found ?? base };
    });
  },
};

async function compileModule(relPath, outName) {
  const outfile = join(outDir, outName);
  await build({
    entryPoints: [join(srcRoot, relPath)],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    plugins: [aliasPlugin],
    logLevel: "silent",
  });
  return import(pathToFileURL(outfile).href);
}

const market = await compileModule("lib/market.ts", "market.mjs");
const currency = await compileModule("lib/currency.ts", "currency.mjs");
const digital = await compileModule("lib/digital-types.ts", "digital-types.mjs");

/* ---------------- Marché ---------------- */

test("resolveMarket repli sur Tripoli quand le marché est absent ou incomplet", () => {
  assert.equal(market.resolveMarket(null).cityEn, "Tripoli");
  assert.equal(market.resolveMarket(undefined).countryCode, "LY");
  assert.equal(market.resolveMarket({}).timezone, "Africa/Tripoli");
  assert.equal(market.resolveMarket({ cityEn: "Dubai" }).cityEn, "Dubai");
  assert.equal(
    market.resolveMarket({ cityEn: "Dubai" }).cityAr,
    "طرابلس",
    "un champ absent doit retomber sur la valeur par défaut, pas rester vide",
  );
});

test("resolveMarket ignore les valeurs invalides", () => {
  const resolved = market.resolveMarket({ lat: Number.NaN, lng: "abc" });
  assert.equal(resolved.lat, market.DEFAULT_MARKET.lat);
  assert.equal(resolved.lng, market.DEFAULT_MARKET.lng);
});

test("les presets couvrent Tripoli et plusieurs marchés internationaux", () => {
  const ids = market.MARKET_PRESETS.map((preset) => preset.id);
  assert.ok(ids.includes("ly"));
  assert.ok(ids.includes("ae"));
  assert.ok(ids.includes("sa"));
  assert.ok(ids.includes("global"));
  for (const preset of market.MARKET_PRESETS) {
    assert.ok(preset.countryCode.length >= 2, `${preset.id} : code pays manquant`);
    assert.ok(preset.timezone.length > 0, `${preset.id} : fuseau manquant`);
    assert.ok(preset.locale.length > 0, `${preset.id} : locale manquante`);
  }
});

test("marketLabels compose le lieu localisé", () => {
  const profile = market.resolveMarket({ id: "ae", cityEn: "Dubai", cityAr: "دبي", countryEn: "United Arab Emirates", countryAr: "الإمارات" });
  const en = market.marketLabels(profile, "en");
  const ar = market.marketLabels(profile, "ar");
  assert.equal(en.city, "Dubai");
  assert.equal(en.place, "Dubai, United Arab Emirates");
  assert.equal(ar.city, "دبي");
});

test("marketLanguages annonce toujours l'anglais + la langue du marché", () => {
  const languages = market.marketLanguages(market.resolveMarket({ locale: "ar-LY" }));
  assert.ok(languages.includes("en"));
  assert.ok(languages.includes("ar-LY"));
});

test("globalReach ouvre la zone desservie au monde entier", () => {
  const profile = market.resolveMarket(null);
  const local = market.marketAreaServed(profile, false);
  const global = market.marketAreaServed(profile, true);
  assert.ok(local.some((entry) => entry.name === "Tripoli"));
  assert.ok(global.some((entry) => entry.name === "Worldwide"));
});

/* ---------------- Devises ---------------- */

test("normalizeCurrency retombe sur USD pour un code inconnu", () => {
  assert.equal(currency.normalizeCurrency("eur"), "EUR");
  assert.equal(currency.normalizeCurrency("ZZZ"), "USD");
  assert.equal(currency.normalizeCurrency(null), "USD");
  assert.equal(currency.normalizeCurrency(""), "USD");
});

test("enabledCurrencies respecte l'ordre du catalogue et déduplique", () => {
  const list = currency.enabledCurrencies({ enabled: ["LYD", "USD", "LYD", "EUR"] });
  assert.deepEqual(list, ["USD", "EUR", "LYD"]);
  assert.deepEqual(currency.enabledCurrencies({ enabled: [] }), ["USD"]);
});

test("currencyRate : 1 pour USD, le taux configuré sinon, 1 si le taux est invalide", () => {
  assert.equal(currency.currencyRate("USD", { USD: 1 }), 1);
  assert.equal(currency.currencyRate("EUR", { EUR: 0.9 }), 0.9);
  assert.equal(currency.currencyRate("EUR", {}), 1, "taux absent → 1 (prix en USD)");
  assert.equal(currency.currencyRate("EUR", { EUR: 0 }), 1, "taux nul → 1");
  assert.equal(currency.currencyRate("EUR", { EUR: -2 }), 1, "taux négatif → 1");
});

test("convertFromBase convertit puis retombe sur le montant d'origine", () => {
  assert.equal(currency.convertFromBase(100, "EUR", { EUR: 0.5 }), 50);
  assert.equal(currency.convertFromBase(100, "EUR", {}), 100);
  assert.equal(currency.convertFromBase(Number.NaN, "EUR", { EUR: 2 }), 0);
});

test("formatMoney affiche le symbole de la devise et deux décimales", () => {
  assert.equal(currency.formatMoney(300, "USD", "en"), "$300.00");
  assert.equal(currency.formatMoney(300, "EUR", "en"), "€300.00");
  assert.equal(currency.formatMoney(49.5, "LYD", "en"), "د.ل49.50");
  assert.ok(currency.formatMoney(1000, "EUR", "ar").includes("€"));
});

test("formatMoneyCompact arrondit les grands montants", () => {
  assert.equal(currency.formatMoneyCompact(1234.56, "USD", "en"), "$1,235");
  assert.equal(currency.formatMoneyCompact(10.5, "USD", "en"), "$10.50");
});

/* ---------------- Catalogue digital ---------------- */

test("le domaine digital couvre les codes, cartes cadeaux et recharges", () => {
  assert.ok(digital.DIGITAL_KINDS.includes("software_key"));
  assert.ok(digital.DIGITAL_KINDS.includes("gift_card"));
  assert.ok(digital.DIGITAL_KINDS.includes("game_topup"));
  assert.ok(digital.DIGITAL_KINDS.includes("subscription_code"));
  assert.ok(digital.DIGITAL_REGIONS.includes("global"));
  assert.ok(digital.DIGITAL_REGIONS.includes("US"));
});

test("lowestPriceUsd ignore les montants indisponibles ou invalides", () => {
  const product = {
    denominations: [
      { id: "a", priceUsd: 10, available: false },
      { id: "b", priceUsd: 25, available: true },
      { id: "c", priceUsd: 5, available: true },
      { id: "d", priceUsd: 0, available: true },
    ],
  };
  assert.equal(digital.lowestPriceUsd(product), 5);
  assert.equal(digital.highestPriceUsd(product), 25);
  assert.equal(digital.lowestPriceUsd({ denominations: [] }), null);
});

test("availableRegions croise les régions de la fiche et celles des montants", () => {
  const product = {
    regions: ["global"],
    denominations: [
      { id: "a", region: "us", available: true },
      { id: "b", region: "EU", available: false },
    ],
  };
  const regions = digital.availableRegions(product);
  assert.ok(regions.includes("GLOBAL"));
  assert.ok(regions.includes("US"));
  assert.ok(!regions.includes("EU"), "un montant indisponible ne doit pas exposer sa région");
});

test("slugify normalise les titres en slugs d'URL", () => {
  assert.equal(digital.slugify("Steam Wallet"), "steam-wallet");
  assert.equal(digital.slugify("  PlayStation  Store! "), "playstation-store");
  assert.equal(digital.slugify("Café Crème"), "cafe-creme");
  assert.equal(digital.slugify("---"), "");
});

/* ---------------- Contrôles statiques ---------------- */

const seoSrc = readFileSync(join(srcRoot, "lib/seo.ts"), "utf8");
const contactSrc = readFileSync(join(srcRoot, "app/(site)/contact/contact-client.tsx"), "utf8");
const suiviSrc = readFileSync(join(srcRoot, "app/(site)/abonnements/suivi/page.tsx"), "utf8");
const cancelSrc = readFileSync(
  join(srcRoot, "app/(site)/abonnements/suivi/cancel-renewal.tsx"),
  "utf8",
);
const schemaSrc = readFileSync(join(srcRoot, "db/schema.ts"), "utf8");
const dbSrc = readFileSync(join(srcRoot, "db/index.ts"), "utf8");

test("le SEO ne fige plus Tripoli/Libye ni la locale ar-LY", () => {
  assert.doesNotMatch(
    seoSrc,
    /addressLocality:\s*"Tripoli"/,
    "l'adresse doit venir du marché configuré, pas d'une valeur figée",
  );
  assert.doesNotMatch(
    seoSrc,
    /inLanguage:\s*\["ar-LY",\s*"en"\]/,
    "inLanguage doit être dérivé du marché (donc variable)",
  );
  assert.doesNotMatch(
    seoSrc,
    /locale:\s*"ar_LY"/,
    "la locale Open Graph doit venir du marché",
  );
  assert.match(seoSrc, /marketLanguages/, "le SEO doit s'appuyer sur marketLanguages");
  assert.match(seoSrc, /resolveMarket/, "le SEO doit résoudre le marché configuré");
});

test("le contact et les abonnements ne figent plus la géographie", () => {
  assert.doesNotMatch(
    contactSrc,
    /Al Jumhouriya Street, Tripoli, Libya/,
    "la recherche Google Maps doit utiliser l'adresse configurée",
  );
  assert.doesNotMatch(
    suiviSrc,
    /timeZone:\s*"Africa\/Tripoli"/,
    "les dates d'échéance doivent suivre le fuseau du marché",
  );
  assert.doesNotMatch(
    cancelSrc,
    /timeZone:\s*"Africa\/Tripoli"/,
    "l'annulation de renouvellement doit suivre le fuseau du marché",
  );
});

test("le schéma SQL du catalogue digital est créé automatiquement", () => {
  assert.match(schemaSrc, /digitalProducts/);
  assert.match(schemaSrc, /digitalDenominations/);
  assert.match(dbSrc, /CREATE TABLE IF NOT EXISTS digital_products/);
  assert.match(dbSrc, /CREATE TABLE IF NOT EXISTS digital_denominations/);
});

test.after(() => {
  rmSync(outDir, { recursive: true, force: true });
});
