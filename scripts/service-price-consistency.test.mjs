#!/usr/bin/env node
/**
 * Garde-fou : le prix d'un service a UNE seule source de vérité.
 *
 * Le 18/11/2026, la page /services/fix-optimize affichait 90 USDT dans sa
 * carte tarifaire (prix vivant, lu dans /admin) et 15 $ dans son paragraphe
 * (texte figé). Ce test échoue si le problème réapparaît :
 *
 *   1. le tarif de repli de Fix & Optimize vaut bien 90 USD ;
 *   2. le contenu éditorial résolu contient le prix vivant, jamais `{price}` ;
 *   3. un changement de prix dans /admin se propage sans éditer le texte ;
 *   4. aucun fichier de contenu public ne réintroduit « $15 » / « 15 دولار ».
 *
 * Il ne teste pas le rendu React : il teste la donnée qui alimente la page,
 * le JSON-LD et les assistants IA — c'est-à-dire la source du litige.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  readFileSync,
  statSync,
  mkdtempSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("..", import.meta.url));
const srcRoot = join(root, "src");
const outDir = mkdtempSync(join(tmpdir(), "service-price-"));

const aliasPlugin = {
  name: "alias-at-src",
  setup(builder) {
    builder.onResolve({ filter: /^@\// }, (args) => {
      const base = join(srcRoot, args.path.slice(2));
      const candidates = [
        base,
        `${base}.ts`,
        `${base}.tsx`,
        join(base, "index.ts"),
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
const { resolveServiceLanding, serviceJsonLd, findService } = await compileModule(
  "lib/services.ts",
  "services.mjs",
);

test.after(() => {
  rmSync(outDir, { recursive: true, force: true });
});

test("le tarif de repli de Fix & Optimize est 90 USD (décision du 18/11/2026)", () => {
  const service = findService(siteConfig.standaloneServices, "fix-optimize");
  assert.ok(service, "service fix-optimize introuvable");
  assert.equal(service.priceFromUsd, 90);
});

test("le contenu éditorial affiche le prix vivant et aucun jeton", () => {
  const service = findService(siteConfig.standaloneServices, "fix-optimize");
  const landing = resolveServiceLanding(service);

  assert.match(landing.descriptionAr, /90/);
  assert.match(landing.descriptionEn, /\$90/);
  assert.match(landing.answerAr, /90/);
  assert.match(landing.answerEn, /\$90/);

  for (const text of [
    landing.descriptionAr,
    landing.descriptionEn,
    landing.answerAr,
    landing.answerEn,
  ]) {
    assert.doesNotMatch(text, /\{price\}/, "jeton {price} non résolu");
    assert.doesNotMatch(text, /\$15\b|15\s*دولار/, "ancien prix 15 encore présent");
  }

  const schema = serviceJsonLd(siteConfig, service, landing);
  assert.equal(schema.offers.price, "90");
  assert.doesNotMatch(schema.description, /\{price\}/);
});

test("un prix modifié dans /admin se propage pour chaque service", () => {
  for (const current of siteConfig.standaloneServices) {
    const nextPrice = current.priceFromUsd + 1;
    const updated = { ...current, priceFromUsd: nextPrice };
    const landing = resolveServiceLanding(updated);
    const rendered = [landing.titleAr, landing.titleEn, landing.descriptionAr, landing.descriptionEn, landing.answerAr, landing.answerEn];

    for (const text of rendered) {
      assert.doesNotMatch(text, /\{price\}/, `${current.id}: jeton non résolu`);
    }
    assert.ok(
      rendered.some((text) => text.includes(`$${nextPrice}`)),
      `${current.id}: le prix ${nextPrice} n'apparaît pas dans le texte`,
    );
  }
});

test("services.ts ne contient aucun montant en dollars en dur", () => {
  const text = readFileSync(join(root, "src/lib/services.ts"), "utf8");
  assert.doesNotMatch(text, /\$\d+/, "services.ts : montant en dollars figé");
  assert.doesNotMatch(text, /\d+\s*دولار/, "services.ts : montant en dinars/dollars figé");
});

test("aucun contenu public ne fige un prix de service à 15", () => {
  const files = [
    "src/lib/services.ts",
    "src/components/services-hub-view.tsx",
    "src/lib/i18n.tsx",
    "src/lib/comparisons.ts",
    "src/lib/blog-articles.ts",
    "src/lib/llms-txt.ts",
  ];

  for (const file of files) {
    const text = readFileSync(join(root, file), "utf8");
    assert.doesNotMatch(text, /\$15\b/, `${file} : montant « $15 » figé`);
    assert.doesNotMatch(text, /15\s*دولار/, `${file} : montant « 15 دولار » figé`);
  }
});
