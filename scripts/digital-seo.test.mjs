#!/usr/bin/env node
/**
 * SEO des fiches produits — audit SEO/GEO 2026-11-01, point A01 (P1).
 *
 * Deux variantes d'un même jeu verrouillées sur des régions différentes
 * (ex. Free Fire MENA vs Free Fire EU) doivent avoir des title, H1 et nom
 * structuré DISTINCTS : la région fait partie de l'identité du produit.
 * Le nom d'affichage du catalogue (`productDisplayName`) ne change pas :
 * la région y est déjà dans un champ dédié.
 *
 * `src/lib/digital-seo.ts` utilise l'alias `@/` : on le bundle avec esbuild
 * (comme digital-audit.test.mjs) avant de l'importer.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
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

const outfile = join(outDir, "digital-seo.mjs");
await build({
  entryPoints: [join(srcRoot, "lib/digital-seo.ts")],
  outfile,
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node22",
  plugins: [aliasPlugin],
  logLevel: "silent",
});
const seo = await import(pathToFileURL(outfile).href);

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
