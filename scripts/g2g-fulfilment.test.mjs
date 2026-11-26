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
  applyKillSwitch,
  g2gAutoDeliveryEnabled,
  g2gFeePercent,
  g2gIdempotencyKey,
  planG2gFulfilment,
  shouldPurchaseNow,
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

test("le coupe-circuit retient l'achat sans masquer les autres motifs", () => {
  // C'est tout l'intérêt de la répétition générale : si le coupe-circuit
  // écrasait tout, chaque événement dirait « kill_switch_off » et on
  // n'apprendrait jamais rien sur les marges, plafonds ni formats de code.
  assert.equal(applyKillSwitch("proceed", false), "kill_switch_off");
  // Un refus économique reste nommé : c'est la vraie raison, et elle le
  // restera après activation.
  for (const d of ["margin_too_low", "cap_exceeded", "cost_unknown", "topup_forbidden"]) {
    assert.equal(applyKillSwitch(d, false), d, `${d} ne doit pas être masqué`);
  }
  // Coupe-circuit activé : la décision passe telle quelle.
  assert.equal(applyKillSwitch("proceed", true), "proceed");
  assert.equal(applyKillSwitch("margin_too_low", true), "margin_too_low");
});

test("la répétition générale révèle la marge même coupe-circuit baissé", () => {
  // Le calcul se fait « comme si » l'automation était activée, puis le
  // coupe-circuit retient. Sinon la répétition n'aurait aucun intérêt.
  const hypothetical = planG2gFulfilment({ ...OK, autoDeliveryEnabled: true });
  assert.equal(hypothetical.decision, "proceed");
  assert.equal(applyKillSwitch(hypothetical.decision, false), "kill_switch_off");
  // …et une offre non rentable se voit comme telle dès maintenant.
  const losing = planG2gFulfilment({ ...OK, autoDeliveryEnabled: true, minMarginPercent: 95 });
  assert.equal(losing.decision, "margin_too_low");
  assert.equal(applyKillSwitch(losing.decision, false), "margin_too_low");
});

test("une offre illisible ne se déguise pas en coupe-circuit", () => {
  // Le défaut qu'on corrige : `decision` restait sur « kill_switch_off »
  // quand la lecture de l'offre échouait, envoyant chercher la panne au
  // mauvais endroit. La vraie raison doit rester visible.
  const route = read("src/app/api/webhooks/g2g/route.ts");
  assert.match(route, /mappingFound \? "offer_unreadable" : "mapping_disabled"/);
  // …et le motif est reflété dans le journal comme dans l'alerte.
  assert.match(route, /Offre G2G illisible/);
  assert.match(route, /offer_illisible=1/);
});

test("un refus de marge reste relisible : les chiffres sont conservés", () => {
  // Un `margin_too_low` sans les montants qui l'expliquent obligerait à
  // rouvrir les logs. Le verdict doit se suffire à lui-même.
  const plan = planG2gFulfilment({ ...OK, minMarginPercent: 95 });
  assert.equal(plan.decision, "margin_too_low");
  assert.equal(plan.feePercent, OK.feePercent);
  assert.equal(plan.unitPrice, OK.offerUnitPrice);
  assert.equal(plan.supplierCostUsd, OK.supplierCostUsd);
  assert.ok(plan.netRevenueUsd > 0, "le revenu net doit être calculé");
  assert.ok(plan.netMarginPercent > 0, "la marge doit être calculée");
});

test("le coût fournisseur ne quitte jamais le serveur", () => {
  // La réponse du webhook revient à G2G sur un vrai événement : notre prix
  // d'achat est un avantage concurrentiel, il ne doit pas y figurer.
  const route = read("src/app/api/webhooks/g2g/route.ts");
  assert.match(route, /unit_price_usd: plan\?\.unitPrice/);
  assert.match(route, /fee_percent: plan\?\.feePercent/);
  // On isole le bloc de réponse final, seul endroit qui quitte le serveur :
  // la table de journalisation, elle, a parfaitement le droit de stocker
  // le coût.
  const start = route.lastIndexOf("return noStoreJson({");
  assert.ok(start > 0, "bloc de réponse introuvable");
  const responseBlock = route.slice(start);
  assert.doesNotMatch(responseBlock, /supplier|conversionCost/i);
  // …en revanche il doit rester visible pour l'admin (logs + Telegram).
  assert.match(route, /cout=\$\{plan\.supplierCostUsd\}/);
  assert.match(route, /coût \$\{plan\.supplierCostUsd\}/);
  // …et le webhook passe bien le taux et le coût de conversion du mapping au moteur.
  assert.match(route, /conversionRateUsd: Number\(mapping\.conversionRateUsd/);
  assert.match(route, /conversionCostUsd: Number\(mapping\.conversionCostUsd/);
});

test("la clé d'idempotence est déterministe et bornée", () => {
  // Un événement rejoué doit produire la MÊME clé, sinon le fournisseur
  // prélèverait deux fois.
  assert.equal(g2gIdempotencyKey("TESTD123"), g2gIdempotencyKey("TESTD123"));
  assert.equal(g2gIdempotencyKey("TESTD123"), "g2g-TESTD123");
  // Caractères douteux neutralisés, longueur maîtrisée.
  assert.equal(g2gIdempotencyKey("ab cd/ef"), "g2g-ab-cd-ef");
  assert.ok(g2gIdempotencyKey("x".repeat(500)).length <= 64);
  // Sans identifiant exploitable : pas de clé, donc pas d'achat.
  for (const bad of ["", "   ", "///", null, undefined]) {
    assert.equal(g2gIdempotencyKey(bad), null, `« ${bad} » doit être refusé`);
  }
});

test("le coupe-circuit empêche RÉELLEMENT la dépense", () => {
  // C'est le test le plus important du fichier : tout le reste peut
  // faillir, celui-ci protège le compte en banque.
  const wouldBuy = planG2gFulfilment({ ...OK, autoDeliveryEnabled: true });
  assert.equal(wouldBuy.decision, "proceed");
  assert.equal(shouldPurchaseNow(wouldBuy, true), true, "activé : on achète");
  assert.equal(shouldPurchaseNow(wouldBuy, false), false, "BAissé : on n'achète PAS");
  // Un plan calculé « comme si » ne doit jamais suffire à lui seul :
  // c'est la décision réelle, coupe-circuit appliqué, qui compte.
  assert.equal(applyKillSwitch(wouldBuy.decision, false), "kill_switch_off");
  assert.equal(shouldPurchaseNow(planG2gFulfilment({ ...OK, autoDeliveryEnabled: false }), true), false);
});

test("aucun autre motif ne déclenche une dépense", () => {
  for (const patch of [
    { minMarginPercent: 95 }, // marge insuffisante
    { maxCostUsd: 1 }, // plafond dépassé
    { offerDeliveryType: ["top_up"] }, // top-up interdit
    { supplierCostUsd: 0 }, // coût inconnu
    { offerCurrency: "EUR" }, // devise non gérée
    { requestedQty: 0 }, // quantité invalide
  ]) {
    const plan = planG2gFulfilment({ ...OK, ...patch, autoDeliveryEnabled: true });
    assert.notEqual(plan.decision, "proceed");
    assert.equal(shouldPurchaseNow(plan, true), false, `${plan.decision} ne doit pas acheter`);
  }
  // Pas de plan du tout (offre illisible) : pas d'achat non plus.
  assert.equal(shouldPurchaseNow(null, true), false);
});

test("l'achat est verrouillé derrière trois portes avant tout appel réseau", () => {
  const src = read("src/lib/g2g-purchase.ts");
  // 1. la porte de décision, 2. les identifiants SKU, 3. la clé d'idempotence
  // — toutes avant le premier appel au fournisseur.
  const firstCall = src.indexOf("fazercardsGiftCardOrder(");
  assert.ok(firstCall > 0, "appel fournisseur introuvable");
  for (const gate of ["shouldPurchaseNow(", "missing_sku"]) {
    const at = src.indexOf(gate);
    assert.ok(at > 0 && at < firstCall, `${gate} doit précéder l'appel`);
  }
  // La clé et le corps sont persistés avant le POST et réutilisés tels quels.
  assert.match(src, /supplierIdempotencyKey: idempotencyKey/);
  assert.match(src, /supplierPurchasePayload: purchasePayload/);
  assert.ok(src.indexOf("supplierIdempotencyKey: idempotencyKey") < firstCall);
  assert.match(src.slice(firstCall), /idempotencyKey,/);
});

test("le solde est vérifié avant de dépenser, sans condamner la ligne", () => {
  const src = read("src/lib/g2g-purchase.ts");
  const balanceCall = src.indexOf("fazercardsBalance(");
  const claim = src.indexOf('status: "purchasing"');
  const orderCall = src.indexOf("fazercardsGiftCardOrder(");
  assert.ok(balanceCall > 0, "vérification de solde absente");
  assert.ok(balanceCall < claim, "le solde doit précéder la prise de possession");
  assert.ok(balanceCall < orderCall, "le solde doit précéder l'achat");
  // Un solde insuffisant laisse la ligne « planned » : c'est transitoire,
  // on veut pouvoir reprendre après rechargement.
  const start = src.indexOf("if (balanceUsd < neededUsd)");
  // À partir de `start` : sinon on retombe sur la déclaration du type,
  // qui figure en haut de fichier.
  const insuff = src.indexOf('outcome: "insufficient_balance"', start);
  assert.ok(start > 0, "bloc « solde insuffisant » introuvable");
  const block = src.slice(start, insuff);
  assert.match(block, /nextAttemptAt/, "une reprise doit être programmée");
  assert.doesNotMatch(block, /"purchasing"/, "ne doit pas prendre possession");
  // Solde illisible ⇒ on ne commande pas à l'aveugle.
  assert.match(src, /outcome: "balance_unknown"/);
});

test("la prise de possession est atomique et écrite avant l'appel", () => {
  const src = read("src/lib/g2g-purchase.ts");
  // Un UPDATE conditionnel : seul un traitement peut réclamer la ligne.
  assert.match(src, /inArray\(g2gDeliveries\.status, \["planned"\]\)/);
  // Le statut « purchasing » est posé AVANT l'appel réseau : si le
  // processus meurt, on sait que de l'argent a pu partir.
  const purchasing = src.indexOf('status: "purchasing"');
  assert.ok(purchasing > 0 && purchasing < src.indexOf("fazercardsGiftCardOrder("));
  // Un rejeu ne repart pas dépenser.
  assert.match(src, /already_handled/);
});

test("le webhook n'achète que sur décision « proceed », jamais en amont", () => {
  const route = read("src/app/api/webhooks/g2g/route.ts");
  // L'appel est conditionné, et placé APRÈS la journalisation.
  assert.match(route, /if \(decision === "proceed" && !isSyntheticTest && automaticDeliveryVerified\(\)\)/);
  const guard = route.indexOf('if (decision === "proceed" && !isSyntheticTest && automaticDeliveryVerified())');
  const journal = route.indexOf("tx.insert(g2gDeliveries)");
  const purchase = route.indexOf("purchaseG2gDelivery({");
  assert.ok(journal > 0 && purchase > 0, "ordre journal/achat introuvable");
  assert.ok(journal < guard, "le journal doit précéder l'achat");
  assert.ok(guard < purchase, "l'achat doit être conditionné");
  // Une panne d'achat ne doit jamais transformer la réception en échec,
  // sinon G2G rejouerait l'événement sans fin.
  assert.match(route, /\[g2g\]\[webhook\] achat impossible/);
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

test("la répétition générale calcule « comme si », puis retient", () => {
  const route = read("src/app/api/webhooks/g2g/route.ts");
  // Le plan est calculé avec l'automation considérée activée, sinon le
  // coupe-circuit masquerait marge et plafond derrière un motif unique.
  assert.match(route, /autoDeliveryEnabled: true/);
  // …puis le coupe-circuit réel retient la décision.
  assert.match(route, /applyKillSwitch\(plan\.decision, autoDeliveryEnabled\)/);
  // L'écart entre les deux est rendu visible.
  assert.match(route, /hypothetical_decision/);
  assert.match(route, /Si l'automation était activée/);
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
