#!/usr/bin/env node
/**
 * A05 (audit SEO/GEO 2026-11-01) — repli de la page fiche quand le slug est
 * absent du catalogue servi : panne déclarée → page temporaire 200 + noindex
 * (jamais de 404, qui ferait désindexer une fiche encore existante) ;
 * aucune panne → 404 classique.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const { productPageFallback } = await import("../src/lib/digital-fallback.ts");

test("panne déclarée → « unavailable » (page temporaire, pas de 404)", () => {
  assert.equal(productPageFallback(true), "unavailable");
});

test("aucune panne → « not_found » (404 classique)", () => {
  assert.equal(productPageFallback(false), "not_found");
});
