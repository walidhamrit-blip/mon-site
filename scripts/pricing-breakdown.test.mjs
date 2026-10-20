#!/usr/bin/env node
/** Tests du calcul modèle + personnalisation + total, source des affichages et du checkout. */
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

test("total = prix du modèle + frais de personnalisation", () => {
  const plan = {
    id: "vitrine",
    name: "الواجهة",
    nameEn: "Vitrine",
    price: 1490,
    priceUsd: 300,
    customizationPercent: 25,
  };
  assert.deepEqual(resolvePlanPriceBreakdown(plan), {
    modelPriceUsd: 300,
    modelPriceLyd: 1490,
    customizationPercent: 25,
    customizationUsd: 75,
    customizationLyd: 373,
    totalPriceUsd: 375,
    totalPriceLyd: 1863,
  });
});

test("applique 20 % aux trois formules et ignore les anciens montants fixes", () => {
  const plans = [
    { id: "vitrine", price: 1490, priceUsd: 300 },
    { id: "vitrine-plus", price: 2490, priceUsd: 510 },
    { id: "boutique", price: 4290, priceUsd: 880 },
  ].map((plan) => ({
    ...plan,
    name: plan.id,
    nameEn: plan.id,
    customizationPercent: 20,
    customizationUsd: 75,
  }));
  assert.deepEqual(
    plans.map((plan) => {
      const { customizationPercent, customizationUsd, customizationLyd, totalPriceUsd, totalPriceLyd } = resolvePlanPriceBreakdown(plan);
      return { customizationPercent, customizationUsd, customizationLyd, totalPriceUsd, totalPriceLyd };
    }),
    [
      { customizationPercent: 20, customizationUsd: 60, customizationLyd: 298, totalPriceUsd: 360, totalPriceLyd: 1788 },
      { customizationPercent: 20, customizationUsd: 102, customizationLyd: 498, totalPriceUsd: 612, totalPriceLyd: 2988 },
      { customizationPercent: 20, customizationUsd: 176, customizationLyd: 858, totalPriceUsd: 1056, totalPriceLyd: 5148 },
    ],
  );
});

test("prix de personnalisation absent = devis, jamais un total trompeur", () => {
  const plan = {
    id: "vitrine",
    name: "الواجهة",
    nameEn: "Vitrine",
    price: 1490,
    priceUsd: 300,
    customizationPercent: null,
  };
  const breakdown = resolvePlanPriceBreakdown(plan);
  assert.equal(breakdown.modelPriceUsd, 300);
  assert.equal(breakdown.customizationUsd, null);
  assert.equal(breakdown.totalPriceUsd, null);
  assert.equal(breakdown.totalPriceLyd, null);
});

test("un tarif de personnalisation explicitement nul reste un total payable sans supplément", () => {
  const plan = {
    id: "vitrine",
    name: "الواجهة",
    nameEn: "Vitrine",
    price: 1490,
    priceUsd: 300,
    customizationPercent: 0,
  };
  const breakdown = resolvePlanPriceBreakdown(plan);
  assert.equal(breakdown.customizationPercent, 0);
  assert.equal(breakdown.customizationUsd, 0);
  assert.equal(breakdown.totalPriceUsd, 300);
  assert.equal(breakdown.totalPriceLyd, 1490);
});

test("un tarif propre à une démo modifie le modèle, puis ajoute le frais de sa catégorie", () => {
  const plans = [{
    id: "boutique",
    name: "المتجر",
    nameEn: "Shop",
    price: 4290,
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
  assert.equal(result?.customizationLyd, 975);
  assert.equal(result?.totalPriceUsd, 1200);
  assert.equal(result?.totalPriceLyd, 5850);
});
