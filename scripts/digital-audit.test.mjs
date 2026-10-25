#!/usr/bin/env node
/**
 * Audit du catalogue et recalcul global.
 *
 * Aucun appel réseau : on vérifie le câblage (le recalcul est bien fait côté
 * serveur, jamais repris du navigateur), la présence de l'arrondi et les
 * garde-fous demandés (fiches sans marge ignorées, prix non recalculables
 * laissés intacts).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(`${root}/${path}`, "utf8");
const flat = (source) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^[ \t]*\/\/.*$/gm, " ")
    .replace(/\s+/g, " ");

const audit = flat(read("src/lib/digital-audit.ts"));
const core = flat(read("src/lib/digital-order-core.ts"));
const actions = flat(read("src/app/admin/actions.ts"));
const ui = flat(read("src/app/admin/(panel)/digital/catalog-audit.tsx"));

test("l'arrondi au demi-dollar supérieur est appliqué au prix calculé", () => {
  assert.match(core, /export const PRICE_ROUND_STEP = 0\.5/);
  assert.match(core, /export function roundPriceUp/);
  assert.match(core, /const price = roundPriceUp\(cost \/ divisor\)/);
  // Jamais d'arrondi vers le bas (Math.floor interdit sur le prix).
  assert.equal(/price\s*=\s*Math\.floor/.test(core), false);
});

test("le recalcul est refait côté serveur, pas dans le navigateur", () => {
  assert.match(actions, /applyCatalogRecalcAction/);
  assert.match(actions, /await applyCatalogRecalc\(safeFee, ficheIds\)/);
  // Le client n'envoie que des identifiants et le taux de frais.
  assert.match(ui, /applyCatalogRecalcAction\(paymentFeePercent, Array\.from\(selected\)\)/);
  assert.equal(/applyCatalogRecalcAction\([^)]*newPrice/.test(ui), false);
  // L'API d'analyse refuse l'accès non authentifié.
  const route = flat(read("src/app/api/admin/digital/recalc/route.ts"));
  assert.match(route, /isAdminAuthenticated/);
  assert.match(route, /status: 401/);
});

test("audit : anomalies signalées, fiches sans marge ignorées", () => {
  assert.match(audit, /Prix actuel sous le coût réel \(vente à perte\)/);
  assert.match(audit, /Prix actuel non arrondi \(pas de 0,50\)/);
  assert.match(audit, /Refusé par Reloadly/);
  assert.match(audit, /Aucune marge nette définie sur la fiche/);
  assert.match(audit, /Aucun produit Reloadly relié/);
  assert.match(audit, /Livraison manuelle : aucun coût fournisseur à appliquer/);
});

test("recalcul : montants incalculables laissés intacts, produit mis en cache", () => {
  // Un prix `null` (valeur Reloadly absente) n'est jamais appliqué.
  assert.match(audit, /if \(!wanted\.has\(row\.ficheId\) \|\| row\.newPrice == null\) continue/);
  // Une seule lecture par produit Reloadly, quel que soit le nombre de fiches.
  assert.match(audit, /if \(products\.has\(productId\)\) return products\.get\(productId\)/);
  // Une fiche sans prix à changer n'est pas réécrite.
  assert.match(audit, /Math\.abs\(row\.newPrice! - row\.oldPrice\) > 0\.004/);
});

test("l'interface expose l'audit et le recalcul", () => {
  assert.match(ui, /Audit &amp; recalcul des prix|Audit & recalcul des prix/);
  assert.match(ui, /Analyser le catalogue/);
  assert.match(ui, /Appliquer la sélection/);
  const page = flat(read("src/app/admin/(panel)/digital/page.tsx"));
  assert.match(page, /CatalogAudit/);
});
