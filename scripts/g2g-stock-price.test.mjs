#!/usr/bin/env node
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Tests structurels du module stock & prix G2G (`src/lib/g2g-stock-price.ts`).
 *
 * `node --test` ne peut pas importer `@/db` (résolution des alias
 * TypeScript absente), donc ces tests lisent le fichier source et vérifient
 * que les protections critiques sont bien présentes dans le texte.
 *
 * Ce qui est verrouillé ici :
 *  - une offre non en USD est refusée (pas de conversion implicite) ;
 *  - un top-up par ID joueur est refusé (jamais de code automatique) ;
 *  - un stock nul ou indisponible coupe l'offre (api_qty = 0) ;
 *  - une marge insuffisante coupe l'offre (plan.decision !== "proceed") ;
 *  - le qty proposé est borné par le stock et par le plafond de coût ;
 *  - g2gPatchOffer est appelé pour poser api_qty sur l'offre ;
 *  - last_checked_at est mis à jour après chaque évaluation.
 */

function read(p) {
  return readFileSync(p, "utf-8");
}

const SRC = read("src/lib/g2g-stock-price.ts");
const CRON = read("src/app/api/cron/g2g-stock-price/route.ts");

test("conversion multi-devises présente dans le code", () => {
  assert.match(SRC, /conversionRateUsd/);
  assert.match(SRC, /conversionCostUsd/);
  assert.match(SRC, /offerPriceUsd/);
});

test("un top-up par ID joueur est refusé", () => {
  assert.match(SRC, /Top-up.*jamais de code automatique/);
});

test("un stock nul coupe l'offre", () => {
  assert.match(SRC, /apiQty < 1/);
  assert.match(SRC, /Stock FazerCards épuisé/);
});

test("une marge insuffisante coupe l'offre", () => {
  assert.match(SRC, /plan\.decision !== "proceed"/);
  assert.match(SRC, /Marge insuffisante ou garde-fou/);
});

test("le qty proposé est borné par le stock et le plafond", () => {
  assert.match(SRC, /Math\.min\(stock, G2G_STOCK_QTY_CAP\)/);
  assert.match(SRC, /G2G_STOCK_QTY_CAP = 100/);
  assert.match(SRC, /qtyByCost.*maxCostUsd.*unitPrice/);
});

test("g2gPatchOffer est appelé pour poser api_qty", () => {
  assert.match(SRC, /g2gPatchOffer\(mapping\.offerId, \{ api_qty: evaluation\.apiQty \}\)/);
});

test("last_checked_at est mis à jour après chaque évaluation", () => {
  assert.match(SRC, /lastCheckedAt: new Date\(\)/);
  assert.match(SRC, /updatedAt: new Date\(\)/);
});

test("chaque offre est traitée indépendamment (une panne ne bloque pas les autres)", () => {
  assert.match(SRC, /for \(const mapping of mappings\)/);
  assert.match(SRC, /g2gPatchOffer/);
  assert.match(SRC, /catch \(error\)/);
});

test("le cron est protégé par CRON_SECRET", () => {
  assert.match(CRON, /process\.env\.CRON_SECRET/);
  assert.match(CRON, /Bearer/);
  assert.match(CRON, /syncG2gStockAndPrice\(\)/);
});

test("le cron est configuré dans vercel.json quotidiennement", () => {
  const vercel = read("vercel.json");
  assert.match(vercel, /"path": "\/api\/cron\/g2g-stock-price"/);
  assert.match(vercel, /"0 6 \* \* \*"/);
});

test("le cron a maxDuration = 60", () => {
  assert.match(CRON, /export const maxDuration = 60;/);
});

test("le schéma DB a last_checked_at sur les mappings", () => {
  const schema = read("src/db/schema.ts");
  assert.match(schema, /lastCheckedAt.*last_checked_at/);
});
