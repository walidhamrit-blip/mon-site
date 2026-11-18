#!/usr/bin/env node
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Tests structurels du suivi des livraisons G2G (brique 5).
 *
 * `node --test` ne peut pas importer `@/db`, donc ces tests lisent le
 * fichier source et vérifient que les protections critiques sont présentes
 * dans le texte.
 */

function read(p) {
  return readFileSync(p, "utf-8");
}

const ENDPOINT = read("src/app/api/admin/g2g/deliveries/route.ts");
const PANEL = read("src/app/admin/(panel)/digital/g2g-panel.tsx");

test("l'endpoint de livraisons est protégé par isAdminAuthenticated", () => {
  assert.match(ENDPOINT, /isAdminAuthenticated\(\)/);
  assert.match(ENDPOINT, /unauthorized.*401/);
});

test("l'endpoint filtre les livraisons par status", () => {
  assert.match(ENDPOINT, /searchParams\.get\("status"\)/);
  assert.match(ENDPOINT, /eq\(g2gDeliveries\.status,/);
});

test("l'endpoint limite le nombre de résultats retournés", () => {
  assert.match(ENDPOINT, /\.limit\(limit\)/);
  assert.match(ENDPOINT, /Math\.min\(100,/);
});

test("l'endpoint retourne les stats de livraison", () => {
  assert.match(ENDPOINT, /g2gDeliveryStats\(\)/);
  assert.match(ENDPOINT, /stats/);
});

test("l'endpoint ne retourne aucun code ni secret", () => {
  // Seuls les montants, statuts et références sont exposés.
  assert.doesNotMatch(ENDPOINT, /codes_cipher/);
  assert.doesNotMatch(ENDPOINT, /supplier_order_ref.*log/);
  assert.match(ENDPOINT, /supplierOrderRef/);
});

test("le panneau affiche une section de suivi des livraisons", () => {
  assert.match(PANEL, /Suivi des livraisons G2G/);
  assert.match(PANEL, /g2g\/deliveries/);
});

test("le panneau affiche les stats de livraison (achetés, livrés, échoués)", () => {
  assert.match(PANEL, /achetés/);
  assert.match(PANEL, /livrés/);
  assert.match(PANEL, /échoués/);
});

test("le panneau affiche un tableau des livraisons avec statut coloré", () => {
  assert.match(PANEL, /bg-emerald-100 text-emerald-700/); // delivered
  assert.match(PANEL, /bg-amber-100 text-amber-700/); // purchased
  assert.match(PANEL, /bg-red-100 text-red-700/); // failed
});

test("le panneau indique les reprises programmées", () => {
  assert.match(PANEL, /nextAttemptAt/);
  assert.match(PANEL, /Reprise/);
});

test("chaque fichier de test figure dans un script nommé (ci-plumbing)", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf-8"));
  const named = Object.entries(pkg.scripts)
    .filter(([name]) => name !== "test")
    .map(([, command]) => command)
    .join(" ");
  assert.ok(
    named.includes("g2g-deliveries.test.mjs"),
    "ajouter g2g-deliveries.test.mjs à un script test:* dans package.json",
  );
});
