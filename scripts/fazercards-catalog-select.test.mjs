#!/usr/bin/env node
/**
 * Tests comportementaux de la sélection des catégories FazerCards —
 * `node --test scripts/fazercards-catalog-select.test.mjs`
 *
 * Le module testé est PUR (aucun import) : Node ≥ 22.18 lit directement le
 * TypeScript à syntaxe effaçable, donc on teste le VRAI code exécuté.
 *
 * Pannes couvertes :
 *   - 03/11/2026 : « GooglePlay » (sans espace) n'était pas reconnue comme
 *     marque prioritaire « google play » → jamais synchronisée ;
 *   - 03/11/2026 : le plafond tronquait les marques prioritaires → non
 *     seulement les marques tardives, mais aussi les variantes régionales
 *     classées en dernier dans une marque (ex. « Google Play (US) » en ordre
 *     alphabétique) n'étaient jamais synchronisées.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  brandPriority,
  normalizeBrandText,
  PRIORITY_BRANDS,
  selectCategories,
} from "../src/lib/fazercards-catalog-select.ts";

const GOOGLE_PLAY = PRIORITY_BRANDS.indexOf("google play");
const NOT_PRIORITY = PRIORITY_BRANDS.length;

test("normalizeBrandText : casse, accents et séparateurs supprimés", () => {
  assert.equal(normalizeBrandText("Google Play (US)"), "googleplayus");
  assert.equal(normalizeBrandText("GooglePlay"), "googleplay");
  assert.equal(normalizeBrandText("google-play"), "googleplay");
  assert.equal(normalizeBrandText("  ÉPIC   Games "), "epicgames");
  assert.equal(normalizeBrandText(""), "");
});

test("brandPriority reconnaît les variantes de nommage de Google Play", () => {
  assert.equal(brandPriority("Google Play (US)"), GOOGLE_PLAY);
  assert.equal(brandPriority("GooglePlay"), GOOGLE_PLAY);
  assert.equal(brandPriority("GOOGLE-PLAY GIFT CARD"), GOOGLE_PLAY);
  assert.equal(brandPriority("google play saudi arabia"), GOOGLE_PLAY);
  assert.ok(brandPriority("PlayStation (SA)") < GOOGLE_PLAY, "PlayStation avant Google Play");
  assert.equal(brandPriority("Steam Wallet (EU)"), PRIORITY_BRANDS.indexOf("steam"));
});

test("brandPriority : une catégorie inconnue n'est pas prioritaire", () => {
  assert.equal(brandPriority("Apex Legends Mobile"), NOT_PRIORITY);
  assert.equal(brandPriority(""), NOT_PRIORITY);
  assert.equal(brandPriority("Some Random Brand"), NOT_PRIORITY);
});

test("selectCategories : TOUTES les variantes prioritaires sont retenues, même au-delà du plafond", () => {
  // 50 PlayStation + 5 GooglePlay (US en dernier, ordre alphabétique API) + 100 autres.
  const items = [
    ...Array.from({ length: 50 }, (_, i) => `PlayStation (R${i})`),
    ...["GooglePlay (AE)", "GooglePlay (EG)", "GooglePlay (SA)", "GooglePlay (TR)", "GooglePlay (US)"],
    ...Array.from({ length: 100 }, (_, i) => `Marque diverse ${i}`),
  ];
  const { selected, nextOffset } = selectCategories(items, (x) => x, 20, 0);
  const google = selected.filter((x) => brandPriority(x) === GOOGLE_PLAY);
  // Avant le correctif, le plafond de 20 ne retenait que des PlayStation :
  // Google Play (US) n'avait aucun slot.
  assert.equal(google.length, 5, `les 5 variantes Google Play doivent être retenues, reçu ${google.length}`);
  assert.ok(selected.includes("GooglePlay (US)"), "la variante US (classée en dernier) est retenue");
  assert.equal(selected.length, 55, "toutes les prioritaires passent avant le plafond");
  assert.equal(nextOffset, 0, "aucun slot restant pour le reste : rotation inchangée");
});

test("selectCategories : le plafond ne s'applique qu'à la fenêtre glissante sur le reste", () => {
  const items = [
    "Steam (EU)",
    "Google Play (US)",
    ...Array.from({ length: 25 }, (_, i) => `Autre ${i}`),
  ];
  const first = selectCategories(items, (x) => x, 10, 0);
  assert.equal(first.selected.length, 10, "2 prioritaires + 8 du reste");
  assert.deepEqual(first.selected.slice(0, 2).sort(), ["Google Play (US)", "Steam (EU)"]);
  assert.deepEqual(first.selected.slice(2), Array.from({ length: 8 }, (_, i) => `Autre ${i}`));
  assert.equal(first.nextOffset, 8);

  const second = selectCategories(items, (x) => x, 10, first.nextOffset);
  assert.deepEqual(second.selected.slice(2), Array.from({ length: 8 }, (_, i) => `Autre ${8 + i}`));
  assert.equal(second.nextOffset, 16);

  // Bouclage de la rotation : offset 24 → Autre 24 puis enveloppe 0..6.
  const third = selectCategories(items, (x) => x, 10, 24);
  assert.deepEqual(third.selected.slice(2), [
    "Autre 24",
    ...Array.from({ length: 7 }, (_, i) => `Autre ${i}`),
  ]);
  assert.equal(third.nextOffset, 7);
});

test("selectCategories : sans reste, nextOffset vaut 0", () => {
  const items = ["Google Play (US)", "Steam (EU)"];
  const { selected, nextOffset } = selectCategories(items, (x) => x, 80, 0);
  assert.equal(selected.length, 2);
  assert.equal(nextOffset, 0);
});

test("selectCategories : plafond supérieur au nombre d'items retourne tout", () => {
  const items = ["Google Play (US)", "PlayStation (SA)", "Autre chose"];
  const { selected } = selectCategories(items, (x) => x, 80, 0);
  assert.equal(selected.length, 3);
});

test("selectCategories : les prioritaires restent prioritaires même avec un plafond de 1", () => {
  const items = ["Google Play (US)", "PlayStation (SA)", "Autre 1", "Autre 2"];
  const { selected } = selectCategories(items, (x) => x, 1, 0);
  assert.ok(selected.includes("Google Play (US)"));
  assert.ok(selected.includes("PlayStation (SA)"));
  assert.equal(selected.length, 2, "le reste n'entre pas tant que des prioritaires existent");
});
