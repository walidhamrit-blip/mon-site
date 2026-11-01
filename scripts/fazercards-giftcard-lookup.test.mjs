#!/usr/bin/env node
/**
 * Garde-fous de la recherche admin des `card_id` FazerCards.
 *
 * Objectif : retrouver le montant exact à relier à G2G sans achat, sans
 * clé API exposée, et sans route publique. Les tests couvrent le noyau pur
 * (extraction d'UUID, filtres) et le câblage admin (auth, lecture seule).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  extractFazercardsGiftCardCategoryId,
  filterFazercardsGiftCardCategories,
  filterFazercardsGiftCardOffers,
  formatFazercardsUsd,
  normalizeFazercardsLookupText,
} from "../src/lib/fazercards-giftcard-lookup-core.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(`${root}/${path}`, "utf8");

test("extrait un UUID ou un slug depuis un category_id et un lien revendeur", () => {
  const id = "5189abcf-0bd0-4dac-b239-cf8106ac0e8c";
  assert.equal(
    extractFazercardsGiftCardCategoryId(
      `https://reseller.fazercards.com/panel/giftcard/${id}`,
    ),
    id,
  );
  assert.equal(
    extractFazercardsGiftCardCategoryId(
      "https://reseller.fazercards.com/panel/giftcard/playstation_sa",
    ),
    "playstation_sa",
  );
  assert.equal(extractFazercardsGiftCardCategoryId("playstation_sa"), "playstation_sa");
  assert.equal(extractFazercardsGiftCardCategoryId(id.toUpperCase()), id);
  assert.equal(extractFazercardsGiftCardCategoryId(`  ${id}  `), id);
});

test("refuse les recherches par nom ou saisies sans identifiant exploitable", () => {
  for (const input of ["", "Free Fire", "playstation sa", "https://reseller.fazercards.com/panel/giftcard"]) {
    assert.equal(extractFazercardsGiftCardCategoryId(input), null);
  }
});

test("normalise accents, casse et séparateurs pour la recherche", () => {
  assert.equal(normalizeFazercardsLookupText("  Free-Fire  Global  "), "free fire global");
  assert.equal(normalizeFazercardsLookupText("Émirats"), "emirats");
});

test("filtre les catégories et les montants sans confondre ID et recharge", () => {
  const categories = [
    { category_id: "a", name: "Free Fire Gift Card" },
    { category_id: "b", name: "Garena Free Fire (ID)" },
  ];
  assert.deepEqual(
    filterFazercardsGiftCardCategories(categories, "free fire gift").map((item) => item.category_id),
    ["a"],
  );

  const offers = [
    {
      card_id: "card-210",
      name: "210 + 21 Diamonds",
      price_usd: "1.83",
      stock: 5,
      min_order_quantity: 1,
      max_order_quantity: 10,
    },
    {
      card_id: "card-530",
      name: "530 + 53 Diamonds",
      price_usd: "4.58",
      stock: 0,
      min_order_quantity: 1,
      max_order_quantity: 10,
    },
  ];
  assert.equal(filterFazercardsGiftCardOffers(offers, "210 21")[0].card_id, "card-210");
  assert.equal(filterFazercardsGiftCardOffers(offers, "card-530")[0].name, "530 + 53 Diamonds");
});

test("formate les prix fournisseur lisiblement", () => {
  assert.equal(formatFazercardsUsd("1.83"), "1.83 $");
  assert.equal(formatFazercardsUsd(null), "—");
});

test("la route de recherche est réservée à l'admin et en lecture seule", () => {
  const route = read("src/app/api/admin/fazercards/giftcards/route.ts");
  assert.match(route, /isAdminAuthenticated\(\)/);
  assert.match(route, /error: "unauthorized"/);
  assert.match(route, /noStoreJson\(\{ ok: false, error: "unauthorized" \}, 401\)/);
  assert.match(route, /fazercardsConfigured\(\)/);
  assert.match(route, /Cache-Control": "no-store"/);
  assert.match(route, /fazercardsGiftCardCards\(categoryId\)/);
  assert.match(route, /fazercardsGiftCards\(CATEGORY_PAGE_LIMIT, cursor\)/);
  // Aucun achat, aucune création de commande, aucune donnée de compte.
  assert.doesNotMatch(route, /fazercardsGiftCardOrder|fazercardsTopupOrder|fazercardsGameKeyOrder/);
  assert.doesNotMatch(route, /fazercardsBalance|fazercardsMe|fazercardsApiKey\(\)/);
});

test("l'administration affiche le chercheur de card_id", () => {
  const page = read("src/app/admin/(panel)/digital/page.tsx");
  assert.match(page, /FazercardsCardIdFinder/);
  assert.match(page, /<FazercardsCardIdFinder \/>/);
  const component = read("src/app/admin/(panel)/digital/fazercards-card-id-finder.tsx");
  assert.match(component, /Lecture seule · aucun achat/);
  assert.match(component, /card_id/);
  assert.match(component, /navigator\.clipboard\.writeText\(cardId\)/);
});
