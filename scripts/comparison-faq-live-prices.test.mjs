#!/usr/bin/env node
/**
 * Correctif N°2 — prix vivants des FAQ des comparaisons Google Ads et
 * Facebook Ads (`node:test`).
 *
 * Les deux réponses historiquement codées en dur (section à19 $, landing à
 * 59 $) portent désormais des jetons `{price:<id>}` résolus avec
 * `config.standaloneServices` — la configuration modifiable dans /admin.
 * Vérifie que :
 *   1. changer le prix d'« add-section » change la FAQ Google Ads ;
 *   2. changer le prix de « landing » change la FAQ Facebook Ads ;
 *   3. arabe et anglais affichent le même montant ;
 *   4. le schéma FAQPage reflète exactement le texte visible ;
 *   5. les autres comparaisons et les prix concurrents ne bougent pas ;
 *   6. aucun prix fixe19 $ / 59 $ ne subsiste dans les deux réponses.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, statSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("..", import.meta.url));
const srcRoot = join(root, "src");
const outDir = mkdtempSync(join(tmpdir(), "comparison-faq-prices-"));

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
    target: "node22",
    plugins: [aliasPlugin],
    logLevel: "silent",
  });
  return import(pathToFileURL(outfile).href);
}

const { siteConfig } = await compileModule("lib/config.ts", "config.mjs");
const {
  comparisonIds,
  comparisons,
  comparisonFaqJsonLd,
  getComparison,
  resolveComparisonTokens,
} = await compileModule("lib/comparisons.ts", "comparisons.mjs");

const google = getComparison("google-ads");
const facebook = getComparison("facebook-ads");
assert.ok(google, "comparaison google-ads introuvable");
assert.ok(facebook, "comparaison facebook-ads introuvable");

const GOOGLE_Q = "ماذا لو كان عندي موقع قديم";
const FACEBOOK_Q = "هل يغني الإعلان";

/** FAQ ciblée par un fragment de question (AR). */
const faqOf = (comparison, needle) => {
  const faq = comparison.faqs.find((entry) => entry.qAr.includes(needle));
  assert.ok(faq, `FAQ « ${needle} » introuvable dans ${comparison.id}`);
  return faq;
};

/** Liste de services avec un prix modifié — équivalent d'une édition /admin. */
const servicesWith = (id, priceFromUsd) =>
  siteConfig.standaloneServices.map((service) =>
    service.id === id ? { ...service, priceFromUsd } : service,
  );

const addSection = siteConfig.standaloneServices.find((s) => s.id === "add-section");
const landing = siteConfig.standaloneServices.find((s) => s.id === "landing");
assert.ok(addSection, "service add-section absent de la configuration");
assert.ok(landing, "service landing absent de la configuration");

test("1. le prix d'add-section pilote la FAQ Google Ads", () => {
  const base = resolveComparisonTokens(google);
  const baseFaq = faqOf(base, GOOGLE_Q);
  assert.ok(
    baseFaq.aAr.includes(`من ${addSection.priceFromUsd} دولاراً`),
    "FAQ AR par défaut = prix de la configuration",
  );
  assert.ok(
    baseFaq.aEn.includes(`from $${addSection.priceFromUsd}`),
    "FAQ EN par défaut = prix de la configuration",
  );

  // Édition type /admin : le prix passe à42.
  const changed = resolveComparisonTokens(google, undefined, servicesWith("add-section", 42));
  const changedFaq = faqOf(changed, GOOGLE_Q);
  assert.ok(changedFaq.aAr.includes("من 42 دولاراً"), changedFaq.aAr);
  assert.ok(changedFaq.aEn.includes("from $42"), changedFaq.aEn);
  assert.ok(!changedFaq.aEn.includes(`$${addSection.priceFromUsd}`), "ancien prix disparu");
});

test("2. le prix de landing pilote la FAQ Facebook Ads", () => {
  const base = resolveComparisonTokens(facebook);
  const baseFaq = faqOf(base, FACEBOOK_Q);
  assert.ok(baseFaq.aAr.includes(`من ${landing.priceFromUsd} دولاراً`), baseFaq.aAr);
  assert.ok(baseFaq.aEn.includes(`$${landing.priceFromUsd}`), baseFaq.aEn);

  const changed = resolveComparisonTokens(facebook, undefined, servicesWith("landing", 77));
  const changedFaq = faqOf(changed, FACEBOOK_Q);
  assert.ok(changedFaq.aAr.includes("من 77 دولاراً"), changedFaq.aAr);
  assert.ok(changedFaq.aEn.includes("at $77"), changedFaq.aEn);
  assert.ok(!changedFaq.aEn.includes(`$${landing.priceFromUsd}`), "ancien prix disparu");
});

test("3. arabe et anglais affichent le même montant", () => {
  const cases = [
    [google, GOOGLE_Q, "add-section", 42],
    [facebook, FACEBOOK_Q, "landing", 77],
  ];
  for (const [comparison, needle, id, price] of cases) {
    const resolved = resolveComparisonTokens(comparison, undefined, servicesWith(id, price));
    const faq = faqOf(resolved, needle);
    const arAmount = faq.aAr.match(/(\d+) دولاراً/)?.[1];
    const enAmount = faq.aEn.match(/\$(\d+)/)?.[1];
    assert.equal(arAmount, String(price), `${comparison.id}: montant AR`);
    assert.equal(enAmount, String(price), `${comparison.id}: montant EN`);
    assert.equal(arAmount, enAmount, `${comparison.id}: AR/EN incohérents`);
    // Le montant rendu suit le format de dollars du projet.
    assert.ok(faq.aEn.includes(`$${price}`), `${comparison.id}: format $ manquant`);
  }
});

test("4. le schéma FAQPage reflète le texte visible", () => {
  for (const [comparison, needle, id, price] of [
    [google, GOOGLE_Q, "add-section", 42],
    [facebook, FACEBOOK_Q, "landing", 77],
  ]) {
    const resolved = resolveComparisonTokens(comparison, undefined, servicesWith(id, price));
    const faq = faqOf(resolved, needle);

    const schemaAr = comparisonFaqJsonLd(resolved, "ar");
    const entityAr = schemaAr.mainEntity.find((entry) => entry.name.includes(needle.slice(0, 15)));
    assert.ok(entityAr, `${comparison.id}: question absente du schéma AR`);
    assert.equal(entityAr.acceptedAnswer.text, faq.aAr, `${comparison.id}: schéma AR ≠ texte visible`);

    const schemaEn = comparisonFaqJsonLd(resolved, "en");
    const rawEn = faqOf(comparison, needle).qEn;
    const entityEn = schemaEn.mainEntity.find((entry) => entry.name === rawEn);
    assert.ok(entityEn, `${comparison.id}: question absente du schéma EN`);
    assert.equal(entityEn.acceptedAnswer.text, faq.aEn, `${comparison.id}: schéma EN ≠ texte visible`);

    assert.ok(entityAr.acceptedAnswer.text.includes(`من ${price} دولاراً`));
    assert.ok(entityEn.acceptedAnswer.text.includes(`$${price}`));
    // Jamais de jeton brut publié dans les schémas.
    assert.ok(!JSON.stringify(schemaAr).includes("{price:"), "jeton brut dans le schéma AR");
    assert.ok(!JSON.stringify(schemaEn).includes("{price:"), "jeton brut dans le schéma EN");
  }
});

test("5. les autres comparaisons et les prix concurrents sont inchangés", () => {
  const mutatedA = servicesWith("add-section", 42);
  const mutatedB = servicesWith("landing", 77);

  // Les prix concurrents (them*) ne dépendent jamais de notre configuration.
  for (const id of ["google-ads", "facebook-ads"]) {
    const a = resolveComparisonTokens(comparisons[id], undefined, mutatedA);
    const b = resolveComparisonTokens(comparisons[id], undefined, mutatedB);
    assert.equal(a.themPriceLabel, b.themPriceLabel, `${id}: prix concurrent bougé`);
    assert.equal(a.themPriceEn, b.themPriceEn, `${id}: prix concurrent EN bougé`);
    assert.deepEqual(a.themPoints, b.themPoints, `${id}: points concurrents bougés`);
    assert.equal(a.usPriceLabelEn, b.usPriceLabelEn, `${id}: libellé Nukhba bougé`);
  }

  // Les autres comparaisons sont indépendantes de ces deux prix et ne
  // contiennent aucun jeton {price:…}.
  for (const id of comparisonIds) {
    if (id === "google-ads" || id === "facebook-ads") continue;
    const x = resolveComparisonTokens(comparisons[id], undefined, mutatedA);
    const y = resolveComparisonTokens(comparisons[id], undefined, mutatedB);
    assert.deepEqual(x, y, `${id}: ne doit pas dépendre des prix add-section/landing`);
    for (const faq of comparisons[id].faqs) {
      assert.ok(!faq.aAr.includes("{price:"), `${id}: jeton {price} inattendu (AR)`);
      assert.ok(!faq.aEn.includes("{price:"), `${id}: jeton {price} inattendu (EN)`);
    }
  }
});

test("6. aucun prix fixe19 $ ou59 $ ne subsiste dans les deux réponses", () => {
  const googleRaw = faqOf(google, GOOGLE_Q);
  assert.ok(!googleRaw.aAr.includes("19 دولاراً"), "prix AR codé en dur dans Google Ads");
  assert.ok(!googleRaw.aEn.includes("$19"), "prix EN codé en dur dans Google Ads");
  assert.match(googleRaw.aAr, /\{price:add-section\}/, "jeton AR attendu");
  assert.match(googleRaw.aEn, /\{price:add-section\}/, "jeton EN attendu");

  const facebookRaw = faqOf(facebook, FACEBOOK_Q);
  assert.ok(!facebookRaw.aAr.includes("59 دولاراً"), "prix AR codé en dur dans Facebook Ads");
  assert.ok(!facebookRaw.aEn.includes("$59"), "prix EN codé en dur dans Facebook Ads");
  assert.match(facebookRaw.aAr, /\{price:landing\}/, "jeton AR attendu");
  assert.match(facebookRaw.aEn, /\{price:landing\}/, "jeton EN attendu");

  // Après résolution avec la configuration par défaut, aucun jeton ne fuit.
  for (const comparison of [google, facebook]) {
    const resolved = resolveComparisonTokens(comparison);
    const text = JSON.stringify(resolved);
    assert.ok(!text.includes("{price:"), `${comparison.id}: jeton non résolu`);
  }
});

process.on("exit", () => rmSync(outDir, { recursive: true, force: true }));
