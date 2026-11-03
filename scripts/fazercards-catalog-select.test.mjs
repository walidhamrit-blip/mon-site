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
 *   - 03/11/2026 : avec un plafond rempli par les variantes régionales de
 *     PlayStation/Steam/Xbox/Roblox, « google play » n'avait plus de slot.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  brandPriority,
  MIN_SLOTS_PER_BRAND,
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

test("selectCategories : chaque marque prioritaire a son minimum garanti même avec un petit plafond", () => {
  // 50 PlayStation + 50 Steam + 5 GooglePlay + 100 autres, plafond = 20.
  const items = [
    ...Array.from({ length: 50 }, (_, i) => `PlayStation (R${i})`),
    ...Array.from({ length: 50 }, (_, i) => `Steam (R${i})`),
    ...Array.from({ length: 5 }, (_, i) => `GooglePlay (R${i})`),
    ...Array.from({ length: 100 }, (_, i) => `Marque diverse ${i}`),
  ];
  const { selected, nextOffset } = selectCategories(items, (x) => x, 20, 0);
  const google = selected.filter((x) => brandPriority(x) === GOOGLE_PLAY);
  // Avant le correctif, les 20 slots étaient pris par PlayStation/Steam et
  // Google Play en avait 0.
  assert.ok(
    google.length >= MIN_SLOTS_PER_BRAND,
    `google play doit avoir au moins ${MIN_SLOTS_PER_BRAND} slots, reçu ${google.length}`,
  );
  assert.equal(google.length, 5, "les 5 variantes Google Play tiennent dans le plafond");
  assert.equal(selected.length, 20, "le plafond est rempli");
  assert.equal(nextOffset, 0, "aucun reste consommé tant que des prioritaires restent");
});

test("selectCategories : le plafond très petit répartit quand même entre les marques", () => {
  const items = [
    ...Array.from({ length: 10 }, (_, i) => `PlayStation (R${i})`),
    ...Array.from({ length: 10 }, (_, i) => `GooglePlay (R${i})`),
  ];
  const { selected } = selectCategories(items, (x) => x, 4, 0);
  assert.equal(selected.length, 4);
  assert.ok(selected.some((x) => brandPriority(x) === GOOGLE_PLAY), "Google Play servi malgré le petit plafond");
  assert.ok(selected.some((x) => brandPriority(x) === 0), "PlayStation servi aussi");
});

test("selectCategories : fenêtre glissante sur le reste, avec rotation reprise au passage suivant", () => {
  const rest = Array.from({ length: 25 }, (_, i) => `Autre ${i}`);
  const first = selectCategories(rest, (x) => x, 10, 0);
  assert.equal(first.selected.length, 10);
  assert.deepEqual(first.selected.map((x) => x), rest.slice(0, 10));
  assert.equal(first.nextOffset, 10);

  const second = selectCategories(rest, (x) => x, 10, first.nextOffset);
  assert.deepEqual(second.selected.map((x) => x), rest.slice(10, 20));
  assert.equal(second.nextOffset, 20);

  // La fenêtre prend `min(cap, reste)` éléments en bouclant : 20..24 puis 0..4.
  const third = selectCategories(rest, (x) => x, 10, second.nextOffset);
  assert.deepEqual(third.selected.map((x) => x), [...rest.slice(20, 25), ...rest.slice(0, 5)]);
  assert.equal(third.nextOffset, 5, "la rotation boucle en enveloppant");
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
