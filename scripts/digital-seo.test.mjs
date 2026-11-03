#!/usr/bin/env node
/**
 * SEO des fiches produits — audit SEO/GEO 2026-11-01, points A01 et A10.
 *
 * A01 : deux variantes d'un même jeu verrouillées sur des régions différentes
 * (ex. Free Fire MENA vs Free Fire EU) doivent avoir des title, H1 et nom
 * structuré DISTINCTS : la région fait partie de l'identité du produit.
 * Le nom d'affichage du catalogue (`productDisplayName`) ne change pas :
 * la région y est déjà dans un champ dédié.
 *
 * A10 : les montants sont des variantes d'un même vendeur, pas un agrégat
 * d'offres concurrentes. Le JSON-LD publie les offres réelles au prix de la
 * caisse ; une fiche en attente n'annonce pas de précommande.
 *
 * Les modules TypeScript utilisent l'alias `@/` : on les bundle avec esbuild
 * (comme digital-audit.test.mjs) avant de les importer.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("..", import.meta.url));
const srcRoot = join(root, "src");
const outDir = mkdtempSync(join(tmpdir(), "digital-seo-"));

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

async function compileModule(relPath, outName) {
  const outfile = join(outDir, outName);
  await build({
    entryPoints: [join(srcRoot, relPath)],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22",
    plugins: [aliasPlugin],
    logLevel: "silent",
  });
  return import(pathToFileURL(outfile).href);
}

const seo = await compileModule("lib/digital-seo.ts", "digital-seo.mjs");
const { digitalProductJsonLd } = await compileModule("lib/seo.ts", "seo.mjs");
const { quoteDigitalOrder } = await compileModule("lib/digital-order-core.ts", "digital-order-core.mjs");

test.after(() => rmSync(outDir, { recursive: true, force: true }));

/** Fiche minimale, du même genre que ce que renvoie l'adaptateur fournisseur. */
const product = (overrides = {}) => ({
  slug: "fzr-topup-free-fire-mena",
  kind: "game_topup",
  status: "available",
  platform: "Free Fire (MENA)",
  titleEn: "Game Top-Up — Free Fire (MENA)",
  titleAr: "شحن لعبة — Free Fire (MENA)",
  regions: ["MENA"],
  denominations: [
    { id: "d1", label: "110 Diamonds", faceValue: "1 USD", region: "MENA", priceUsd: 1.5, available: true },
  ],
  ...overrides,
});

const mena = product();
const eu = product({
  slug: "fzr-topup-free-fire-eu",
  platform: "Free Fire (EU)",
  titleEn: "Game Top-Up — Free Fire (EU)",
  titleAr: "شحن لعبة — Free Fire (EU)",
  regions: ["EU"],
});

test("A01 : variantes régionales d'un même jeu → title SEO distincts (ar et en)", () => {
  const titleMenaAr = seo.productSeoTitle(mena, "ar");
  const titleEuAr = seo.productSeoTitle(eu, "ar");
  assert.notEqual(titleMenaAr, titleEuAr, "les deux variantes ne doivent pas partager le même title AR");
  assert.ok(titleMenaAr.includes("MENA"), `title AR MENA doit contenir la région : ${titleMenaAr}`);
  assert.ok(titleEuAr.includes("أوروبا"), `title AR EU doit contenir la région : ${titleEuAr}`);

  const titleMenaEn = seo.productSeoTitle(mena, "en");
  const titleEuEn = seo.productSeoTitle(eu, "en");
  assert.notEqual(titleMenaEn, titleEuEn, "les deux variantes ne doivent pas partager le même title EN");
  assert.ok(titleMenaEn.includes("MENA"), `title EN MENA doit contenir la région : ${titleMenaEn}`);
  assert.ok(titleEuEn.includes("Europe"), `title EN EU doit contenir la région : ${titleEuEn}`);
});

test("A01 : productSeoName conserve la région ; productDisplayName reste le nom UI", () => {
  assert.equal(seo.productSeoName(mena, "en"), "Free Fire (MENA)");
  assert.equal(seo.productSeoName(eu, "en"), "Free Fire (Europe)");
  assert.equal(seo.productSeoName(mena, "ar"), "Free Fire (MENA)");
  // Le nom d'affichage du catalogue ne change pas (région dans un champ dédié).
  assert.equal(seo.productDisplayName(mena, "en"), "Free Fire");
});

test("fiche globale : aucun suffixe de région ajouté au nom SEO", () => {
  const global = product({
    slug: "fzr-topup-free-fire-global",
    platform: "Free Fire",
    titleEn: "Game Top-Up — Free Fire (Global)",
    titleAr: "شحن لعبة — Free Fire (عالمي)",
    regions: ["GLOBAL"],
  });
  assert.equal(seo.productSeoName(global, "en"), "Free Fire");
  assert.equal(seo.productSeoName(global, "ar"), "Free Fire");
  assert.ok(!seo.productSeoTitle(global, "en").includes("("));
});

test("le prix d'entrée reste présent dans le title quand il existe", () => {
  assert.ok(seo.productSeoTitle(mena, "en").includes("$1.50"));
  assert.ok(seo.productSeoTitle(mena, "ar").includes("1.50"));
});

test("A02 : un top-up ne promet PAS de code par e-mail — livraison = Player ID", () => {
  const descAr = seo.productSeoDescription(mena, "ar");
  const descEn = seo.productSeoDescription(mena, "en");
  assert.ok(descAr.includes("معرّف اللاعب"), `desc AR top-up : ${descAr}`);
  assert.ok(!descAr.includes("بريدك"), `desc AR top-up ne doit pas promettre l'e-mail : ${descAr}`);
  assert.ok(descEn.includes("player ID"), `desc EN top-up : ${descEn}`);
  assert.ok(!descEn.includes("to your email"), `desc EN top-up ne doit pas promettre l'e-mail : ${descEn}`);

  const faqAr = seo.productFaqs(mena, "ar").find((f) => f.q.includes("بعد الدفع"));
  assert.ok(faqAr.a.includes("معرّف اللاعب"), `FAQ AR top-up : ${faqAr.a}`);
  assert.ok(!faqAr.a.includes("بريدك"), `FAQ AR top-up ne doit pas promettre l'e-mail : ${faqAr.a}`);
  const faqEn = seo.productFaqs(mena, "en").find((f) => /after payment/i.test(f.q));
  assert.ok(faqEn.a.includes("player ID"), `FAQ EN top-up : ${faqEn.a}`);
});

test("A02 : une carte cadeau se livre bien par e-mail (code)", () => {
  const card = product({
    kind: "gift_card",
    slug: "fzr-giftcard-steam-eu",
    platform: "Steam",
    titleEn: "Gift Card — Steam Wallet (EU)",
    titleAr: "بطاقة هدايا — محفظة Steam (EU)",
    regions: ["EU"],
  });
  assert.ok(/emailed/i.test(seo.productSeoDescription(card, "en")));
  assert.ok(seo.productSeoDescription(card, "ar").includes("بريدك الإلكتروني"));
  const faqEn = seo.productFaqs(card, "en").find((f) => /after payment/i.test(f.q));
  assert.ok(/email/i.test(faqEn.a), `FAQ EN carte : ${faqEn.a}`);
});

test("A02 : deliveryText couvre les kinds — jamais d'e-mail pour un top-up", () => {
  assert.ok(seo.deliveryText(mena, "en").includes("player ID"));
  assert.ok(seo.deliveryText(mena, "ar").includes("معرّف اللاعب"));
  const card = product({ kind: "gift_card" });
  assert.ok(/emailed/i.test(seo.deliveryText(card, "en")));
  const key = product({ kind: "software_key" });
  assert.ok(/emailed/i.test(seo.deliveryText(key, "en")));
  const sub = product({ kind: "subscription_code" });
  assert.ok(/emailed/i.test(seo.deliveryText(sub, "en")));
});

/* --------------------- A10 : offres et variantes --------------------- */
const config = { url: "https://store.example.com", market: null };
const structuredProduct = (overrides = {}) => ({
  ...mena,
  id: "fzr-topup-free-fire-mena",
  descriptionAr: "شحن مباشر على معرّف اللاعب.",
  descriptionEn: "Direct top-up to the player ID.",
  image: "/digital-products/free-fire.jpg",
  denominations: [
    { id: "d1", label: "110 Diamonds", faceValue: "110 Diamonds", region: "MENA", priceUsd: 1.5, available: true },
    { id: "d2", label: "341 Diamonds", faceValue: "341 Diamonds", region: "MENA", priceUsd: 4.75, available: true },
    { id: "d3", label: "572 Diamonds", faceValue: "572 Diamonds", region: "MENA", priceUsd: 7.9, available: true },
    { id: "disabled", label: "2398 Diamonds", faceValue: "2398 Diamonds", region: "MENA", priceUsd: 31.5, available: false },
  ],
  ...overrides,
});

test("A10 : chaque montant achetable a son Offer, au prix exact de la caisse", () => {
  const product = structuredProduct();
  const schema = digitalProductJsonLd(config, product, "en");
  const sellable = product.denominations.filter((denomination) => denomination.available);
  assert.equal(schema.offers.length, sellable.length);
  assert.deepEqual(schema.offers.map((offer) => offer["@id"]), sellable.map((denomination) => `${schema.url}#offer-${denomination.id}`));
  for (const [index, denomination] of sellable.entries()) {
    const quote = quoteDigitalOrder(product, denomination.id, 1);
    assert.equal(quote.ok, true);
    assert.equal(Number(schema.offers[index].price), quote.quote.unitPriceUsd);
    assert.equal(schema.offers[index].priceCurrency, "USD");
    assert.equal(schema.offers[index]["@type"], "Offer");
    assert.match(schema.offers[index].name, /Diamonds/);
  }
  const prices = schema.offers.map((offer) => Number(offer.price));
  assert.equal(Math.min(...prices), 1.5);
  assert.equal(Math.max(...prices), 7.9);
  assert.equal(schema.offers.length, 3, "le montant désactivé est exclu du comptage comme des prix");
});

test("A10 : l'arrondi JSON-LD suit le devis serveur, sans offre à prix nul", () => {
  const product = structuredProduct({
    denominations: [
      { id: "fraction", label: "Fraction", faceValue: "Fraction", region: "MENA", priceUsd: 9.999, available: true },
      { id: "tiny", label: "Tiny", faceValue: "Tiny", region: "MENA", priceUsd: 0.004, available: true },
      { id: "zero", label: "Zero", faceValue: "Zero", region: "MENA", priceUsd: 0, available: true },
    ],
  });
  const schema = digitalProductJsonLd(config, product, "en");
  assert.equal(schema.offers.length, 1);
  const quote = quoteDigitalOrder(product, "fraction", 1);
  assert.equal(quote.ok, true);
  assert.equal(schema.offers[0].price, quote.quote.unitPriceUsd.toFixed(2));
  assert.equal(quoteDigitalOrder(product, "tiny", 1).ok, false);
  assert.equal(quoteDigitalOrder(product, "zero", 1).ok, false);
});

test("A10 : liste d'attente et montants indisponibles ne créent aucune offre", () => {
  for (const product of [
    structuredProduct({ status: "coming_soon" }),
    structuredProduct({ denominations: [] }),
    structuredProduct({ denominations: [{ id: "off", label: "110 Diamonds", faceValue: "110 Diamonds", region: "MENA", priceUsd: 1.5, available: false }] }),
  ]) {
    const schema = digitalProductJsonLd(config, product, "ar");
    assert.equal(schema.offers, undefined);
    assert.equal(schema["@type"], "Product");
    assert.ok(!JSON.stringify(schema).includes("PreOrder"));
    assert.equal(quoteDigitalOrder(product, product.denominations[0]?.id ?? "missing", 1).ok, false);
  }
});

test("A10 : un vendeur unique et identifié pour toutes les variantes", () => {
  const schema = digitalProductJsonLd(config, structuredProduct(), "ar");
  assert.deepEqual(new Set(schema.offers.map((offer) => offer.seller["@id"])), new Set(["https://store.example.com/#organization"]));
  assert.equal(schema.offers[0].availability, "https://schema.org/InStock");
  assert.equal(schema.hasMerchantReturnPolicy.returnPolicyCategory, "https://schema.org/MerchantReturnNotPermitted");
  assert.ok(!JSON.stringify(schema).includes("AggregateOffer"));
});

test("A10 : la fiche utilise le générateur centralisé et l'audit n'exige plus lowPrice", () => {
  const page = readFileSync(join(root, "src/app/(site)/codes/[slug]/page.tsx"), "utf8");
  assert.match(page, /digitalProductJsonLd\(config, product, locale\)/);
  assert.match(page, /productSchema/);
  assert.ok(!page.includes('"@type": "AggregateOffer"'));
  const audit = readFileSync(join(root, "scripts/catalog-audit.mjs"), "utf8");
  assert.ok(!audit.includes('JSON-LD sans prix (lowPrice)'));
  assert.match(audit, /Offer/);
});
