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
  canEnableFazercardsSku,
  checkFazercardsGiftCardSku,
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

/* ------------------------------------------------------------------ *
 * Garde-fou d'activation d'une correspondance G2G ↔ FazerCards.
 *
 * Un `card_id` est COLLÉ À LA MAIN dans le formulaire. Une faute de
 * frappe passerait inaperçue jusqu'à la phase 2, où elle livrerait le
 * mauvais produit à un client qui a déjà payé. Tant que le SKU n'est
 * pas prouvé présent chez FazerCards, l'activation doit être refusée.
 * ------------------------------------------------------------------ */

const CATALOG = [
  { card_id: "it_tr_100", name: "iTunes Turkey 100 TRY", price_usd: "3.42", stock: 12, min_order_quantity: 1, max_order_quantity: 50 },
  { card_id: "it_tr_250", name: "iTunes Turkey 250 TRY", price_usd: "8.10", stock: 0, min_order_quantity: 1, max_order_quantity: 50 },
];

test("un card_id présent est résolu avec son nom et son prix", () => {
  const check = checkFazercardsGiftCardSku({ offers: CATALOG, cardId: "it_tr_100" });
  assert.equal(check.status, "verified");
  assert.equal(check.name, "iTunes Turkey 100 TRY");
  assert.equal(check.priceUsd, "3.42");
  assert.equal(check.stock, 12);
  assert.equal(canEnableFazercardsSku(check), true);
});

test("un card_id absent n'est jamais activable, même de justesse", () => {
  // La faute de frappe typique : un montant voisin qui existe, lui.
  const typo = checkFazercardsGiftCardSku({ offers: CATALOG, cardId: "it_tr_1000" });
  assert.equal(typo.status, "not_found");
  assert.equal(canEnableFazercardsSku(typo), false);

  const other = checkFazercardsGiftCardSku({ offers: CATALOG, cardId: "it_tr_250" });
  assert.equal(other.status, "verified", "un montant voisin existant reste valide");
});

test("FazerCards injoignable n'est JAMAIS une preuve d'absence", () => {
  // `offers: null` = l'appel a échoué. Confondre les deux ferait croire
  // qu'un SKU valide n'existe pas, ou qu'un SKU invalide est acceptable.
  const down = checkFazercardsGiftCardSku({ offers: null, cardId: "it_tr_100" });
  assert.equal(down.status, "unavailable");
  assert.equal(down.name, "", "aucun nom ne doit être inventé");
  assert.equal(canEnableFazercardsSku(down), false, "fail-closed même en panne");

  // Une liste vide, elle, EST une preuve d'absence.
  const empty = checkFazercardsGiftCardSku({ offers: [], cardId: "it_tr_100" });
  assert.equal(empty.status, "not_found");
});

test("sans card_id il n'y a rien à vérifier", () => {
  for (const cardId of ["", "   "]) {
    const check = checkFazercardsGiftCardSku({ offers: CATALOG, cardId });
    assert.equal(check.status, "missing_ids");
    assert.equal(canEnableFazercardsSku(check), false);
  }
});

test("l'activation exige une preuve de résolution côté route et côté base", () => {
  const route = read("src/app/api/admin/g2g/route.ts");
  assert.match(route, /canEnableFazercardsSku\(skuCheck\)/);
  assert.match(route, /checkFazercardsGiftCardSku/);
  // Faute de preuve : on n'active pas.
  assert.match(route, /enabled && !canEnableFazercardsSku\(skuCheck\)/);
  // La résolution n'est mémorisée que si elle a réussi.
  assert.match(route, /verified \? skuCheck\.name/);
  assert.match(route, /lastCheckedAt: verified \? new Date\(\) : null/);
  // Lecture seule : aucune commande passée pour vérifier un SKU.
  assert.doesNotMatch(route, /fazercardsGiftCardOrder|fazercardsTopupOrder/);

  // Les colonnes de preuve existent dans le schéma et le DDL.
  const schema = read("src/db/schema.ts");
  assert.match(schema, /supplierSkuName: text\("supplier_sku_name"\)/);
  assert.match(schema, /supplierPriceUsd: text\("supplier_price_usd"\)/);
  const ddl = read("src/db/index.ts");
  assert.match(ddl, /ALTER TABLE g2g_offer_mappings ADD COLUMN IF NOT EXISTS supplier_sku_name/);
  assert.match(ddl, /ALTER TABLE g2g_offer_mappings ADD COLUMN IF NOT EXISTS supplier_price_usd/);
});
