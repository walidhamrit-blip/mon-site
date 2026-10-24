#!/usr/bin/env node
/** Tests du calcul modèle + personnalisation + total en USD (devise unique, = USDT). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, statSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("..", import.meta.url));
const srcRoot = join(root, "src");
const outDir = mkdtempSync(join(tmpdir(), "pricing-breakdown-"));

const aliasPlugin = {
  name: "alias-at-src",
  setup(builder) {
    builder.onResolve({ filter: /^@\// }, (args) => {
      const base = join(srcRoot, args.path.slice(2));
      const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")];
      const found = candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
      return { path: found ?? base };
    });
  },
};

async function compileModule() {
  const outfile = join(outDir, "classification.mjs");
  await build({
    entryPoints: [join(srcRoot, "lib/classification.ts")],
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

const { resolveDemoClassification, resolvePlanPriceBreakdown } = await compileModule();

test.after(() => {
  rmSync(outDir, { recursive: true, force: true });
});

test("total USD = prix du modèle + frais de personnalisation (aucun champ LYD)", () => {
  const plan = {
    id: "vitrine",
    name: "الواجهة",
    nameEn: "Vitrine",
    priceUsd: 300,
    customizationPercent: 25,
  };
  assert.deepEqual(resolvePlanPriceBreakdown(plan), {
    modelPriceUsd: 300,
    customizationPercent: 25,
    customizationUsd: 75,
    totalPriceUsd: 375,
  });
});

test("applique 20 % aux trois formules", () => {
  const plans = [
    { id: "vitrine", priceUsd: 300 },
    { id: "vitrine-plus", priceUsd: 510 },
    { id: "boutique", priceUsd: 880 },
  ].map((plan) => ({
    ...plan,
    name: plan.id,
    nameEn: plan.id,
    customizationPercent: 20,
  }));
  assert.deepEqual(
    plans.map((plan) => {
      const { customizationPercent, customizationUsd, totalPriceUsd } = resolvePlanPriceBreakdown(plan);
      return { customizationPercent, customizationUsd, totalPriceUsd };
    }),
    [
      { customizationPercent: 20, customizationUsd: 60, totalPriceUsd: 360 },
      { customizationPercent: 20, customizationUsd: 102, totalPriceUsd: 612 },
      { customizationPercent: 20, customizationUsd: 176, totalPriceUsd: 1056 },
    ],
  );
});

test("prix de personnalisation absent = devis, jamais un total trompeur", () => {
  const plan = {
    id: "vitrine",
    name: "الواجهة",
    nameEn: "Vitrine",
    priceUsd: 300,
    customizationPercent: null,
  };
  const breakdown = resolvePlanPriceBreakdown(plan);
  assert.equal(breakdown.modelPriceUsd, 300);
  assert.equal(breakdown.customizationUsd, null);
  assert.equal(breakdown.totalPriceUsd, null);
});

test("un tarif de personnalisation explicitement nul reste un total payable sans supplément", () => {
  const plan = {
    id: "vitrine",
    name: "الواجهة",
    nameEn: "Vitrine",
    priceUsd: 300,
    customizationPercent: 0,
  };
  const breakdown = resolvePlanPriceBreakdown(plan);
  assert.equal(breakdown.customizationPercent, 0);
  assert.equal(breakdown.customizationUsd, 0);
  assert.equal(breakdown.totalPriceUsd, 300);
});

test("un tarif propre à une démo modifie le modèle, puis ajoute le frais de sa catégorie", () => {
  const plans = [{
    id: "boutique",
    name: "المتجر",
    nameEn: "Shop",
    priceUsd: 880,
    customizationPercent: 20,
  }];
  const result = resolveDemoClassification(
    { planId: "boutique", categoryTier: 1, priceUsd: 1000 },
    plans,
  );
  assert.equal(result?.priceUsd, 1000);
  assert.equal(result?.customizationPercent, 20);
  assert.equal(result?.customizationUsd, 200);
  assert.equal(result?.totalPriceUsd, 1200);
});
