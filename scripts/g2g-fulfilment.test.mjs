#!/usr/bin/env node
/**
 * Garde-fous du moteur de décision de livraison G2G (phase 2).
 *
 * Ce module décide si un `order.api_delivery` doit déclencher un ACHAT
 * réel chez le fournisseur. Une décision trop permissive coûte de
 * l'argent de façon irréversible ; une décision trop stricte coûte un
 * traitement manuel. Les tests ci-dessous verrouillent le sens du
 * doute : `fail-closed`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  g2gAutoDeliveryEnabled,
  g2gFeePercent,
  planG2gFulfilment,
} from "../src/lib/g2g-fulfilment-core.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(`${root}/${path}`, "utf8");

/** Situation saine : tout est réuni pour acheter. */
const OK = {
  mappingEnabled: true,
  autoDeliveryEnabled: true,
  feePercent: 9.5,
  offerUnitPrice: 4.2,
  offerCurrency: "USD",
  offerDeliveryType: ["api"],
  offerCodeLabel: "Code",
  supplierCostUsd: 1.99,
  saleCurrency: "USD",
  minMarginPercent: 12,
  maxCostUsd: 25,
  requestedQty: 1,
};

test("une offre saine déclenche l'achat, avec la marge calculée", () => {
  const plan = planG2gFulfilment(OK);
  assert.equal(plan.decision, "proceed");
  assert.equal(plan.shouldPurchase, true);
  assert.equal(plan.requestedQty, 1);
  assert.ok(plan.netRevenueUsd > 0, "le revenu net doit être calculé");
  assert.ok(plan.netMarginPercent > 12, "la marge doit dépasser le seuil");
  assert.match(plan.summary, /achat autorisé/);
});

test("seul « proceed » autorise un achat", () => {
  const blocking = [
    ["mapping_disabled", { mappingEnabled: false }],
    ["kill_switch_off", { autoDeliveryEnabled: false }],
    ["fee_not_configured", { feePercent: null }],
    ["missing_price", { offerUnitPrice: 0 }],
    ["code_label_missing", { offerCodeLabel: "" }],
    ["topup_forbidden", { offerDeliveryType: ["top_up"] }],
    ["currency_mismatch", { offerCurrency: "EUR" }],
    ["quantity_invalid", { requestedQty: 0 }],
    ["cap_exceeded", { maxCostUsd: 1 }],
    ["margin_too_low", { minMarginPercent: 95 }],
  ];
  for (const [expected, patch] of blocking) {
    const plan = planG2gFulfilment({ ...OK, ...patch });
    assert.equal(plan.decision, expected, `attendu ${expected}`);
    assert.equal(plan.shouldPurchase, false, `${expected} ne doit pas acheter`);
  }
});

test("le coupe-circuit coupe vraiment, même avec une offre parfaite", () => {
  // C'est l'interrupteur d'urgence : il doit primer sur tout le reste.
  const plan = planG2gFulfilment({ ...OK, autoDeliveryEnabled: false });
  assert.equal(plan.decision, "kill_switch_off");
  assert.equal(plan.shouldPurchase, false);
});

test("aucune commission déclarée ⇒ aucun achat, sans défaut optimiste", () => {
  for (const raw of [undefined, null, "", "   ", "abc", "-1", "100"]) {
    assert.equal(g2gFeePercent(raw), null, `« ${raw} » doit être refusé`);
  }
  const plan = planG2gFulfilment({ ...OK, feePercent: g2gFeePercent("") });
  assert.equal(plan.decision, "fee_not_configured");
  assert.equal(plan.shouldPurchase, false);
});

test("une commission réaliste est acceptée", () => {
  assert.equal(g2gFeePercent("9.5"), 9.5);
  assert.equal(g2gFeePercent("0"), 0);
  assert.equal(g2gFeePercent("12.75"), 12.75);
});

test("le coupe-circuit exige un « 1 » explicite", () => {
  for (const raw of [undefined, null, "", "0", "true", "yes", "on", " 1 "]) {
    assert.equal(g2gAutoDeliveryEnabled(raw), true === false ? true : (raw ?? "").trim() === "1");
  }
  assert.equal(g2gAutoDeliveryEnabled("1"), true);
  assert.equal(g2gAutoDeliveryEnabled("true"), false, "pas d'approximation : « 1 » uniquement");
  assert.equal(g2gAutoDeliveryEnabled(""), false);
});

test("un top-up par ID joueur n'est jamais livré avec un code", () => {
  // L'erreur la plus coûteuse du métier : l'acheteur reçoit un code
  // inutilisable et la commande finit en litige.
  for (const deliveryType of [["top_up"], ["TOP_UP"], ["api", "top_up"], ["topup"]]) {
    const plan = planG2gFulfilment({ ...OK, offerDeliveryType: deliveryType });
    assert.equal(plan.decision, "topup_forbidden", `${deliveryType} doit être refusé`);
    assert.equal(plan.shouldPurchase, false);
  }
});

test("la quantité demandée est bornée comme à l'achat", () => {
  for (const qty of [0, -1, 101, 1.5]) {
    const plan = planG2gFulfilment({ ...OK, requestedQty: qty });
    assert.equal(plan.decision, "quantity_invalid", `qté ${qty}`);
    assert.equal(plan.shouldPurchase, false, `qté ${qty} ne doit pas acheter`);
  }
  // 100 est une quantité VALIDE (borne haute) mais dépasse ici le plafond
  // d'achat : le refus doit donc invoquer le plafond, pas la quantité.
  assert.equal(planG2gFulfilment({ ...OK, requestedQty: 100 }).decision, "cap_exceeded");
  assert.equal(planG2gFulfilment({ ...OK, requestedQty: 2 }).decision, "proceed");
});

test("un coût fournisseur inconnu n'est jamais remplacé par zéro", () => {
  // Un SKU jamais vérifié n'a pas de prix : l'assimiler à 0 donnerait une
  // marge de 100 % et déclencherait l'achat. Refus explicite.
  for (const cost of [0, -1, NaN, null, undefined]) {
    const plan = planG2gFulfilment({ ...OK, supplierCostUsd: cost });
    assert.equal(plan.decision, "cost_unknown", `coût ${cost}`);
    assert.equal(plan.shouldPurchase, false);
  }
});

test("l'ordre des refus dit la vraie raison", () => {
  // Une offre à la fois désactivée ET hors marge doit annoncer la cause
  // structurelle : chercher une marge à corriger serait perdre du temps.
  const plan = planG2gFulfilment({
    ...OK,
    mappingEnabled: false,
    minMarginPercent: 99,
  });
  assert.equal(plan.decision, "mapping_disabled");
});

test("le webhook consigne la décision sans jamais acheter", () => {
  const route = read("src/app/api/webhooks/g2g/route.ts");
  // Le moteur est appelé…
  assert.match(route, /planG2gFulfilment\(/);
  // …la décision est journalisée et tracée en base…
  assert.match(route, /g2gDeliveries/);
  assert.match(route, /onConflictDoNothing\(\{ target: g2gDeliveries\.deliveryId \}\)/);
  // …et AUCUN achat n'est déclenché à ce stade.
  assert.doesNotMatch(route, /fazercardsGiftCardOrder|fazercardsTopupOrder/);
  assert.doesNotMatch(route, /g2gDeliverCodes\(/);
  // La réponse reste explicitement en « dry run ».
  assert.match(route, /dry_run: true/);
  assert.match(route, /auto_delivery: false/);
});

test("le schéma et le DDL créent la table des livraisons", () => {
  const schema = read("src/db/schema.ts");
  assert.match(schema, /g2gDeliveries = pgTable\("g2g_deliveries"/);
  assert.match(schema, /deliveryId: text\("delivery_id"\)\.notNull\(\)\.unique\(\)/);
  const ddl = read("src/db/index.ts");
  assert.match(ddl, /CREATE TABLE IF NOT EXISTS g2g_deliveries/);
  assert.match(ddl, /delivery_id text NOT NULL UNIQUE/);
  assert.match(ddl, /status text NOT NULL DEFAULT 'planned'/);
});

test("les variables de phase 2 sont documentées et vides par défaut", () => {
  const env = read(".env.example");
  assert.match(env, /^G2G_AUTO_DELIVERY=$/m);
  assert.match(env, /^G2G_FEE_PERCENT=$/m);
  // Le coupe-circuit doit être explicitement expliqué.
  assert.match(env, /Ne PAS activer avant/);
});
