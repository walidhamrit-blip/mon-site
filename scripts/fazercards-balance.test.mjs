#!/usr/bin/env node
/**
 * Garde-fou de SOLDE fournisseur.
 *
 * Contexte : la caisse encaisse le client PUIS achète chez FazerCards. Le
 * solde est débité du COÛT fournisseur, pas du prix de vente ; un plafond de
 * vente haut avec un solde bas fait donc encaisser des commandes impossibles
 * à honorer (livraison manuelle + remboursement).
 *
 * Ces tests couvrent la logique pure (aucun réseau, aucune base) et le
 * câblage (cron protégé, panneau admin, aucune fuite publique).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  BALANCE_MIN_USD,
  BALANCE_TOPUP_ROUNDING_USD,
  assessFazercardsBalance,
  balanceGate,
  shouldSendBalanceAlert,
  supplierCostForSalePrice,
} from "../src/lib/fazercards-balance-core.ts";
import { retailPriceForCost } from "../src/lib/fazercards-pricing.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(`${root}/${path}`, "utf8");

/* ------------------------- Inversion du barème ------------------------- */

test("le coût fournisseur d'un prix de vente ne dépasse jamais ce prix", () => {
  for (const price of [1.5, 2.38, 5, 25, 100, 300]) {
    const cost = supplierCostForSalePrice(price);
    assert.ok(cost <= price, `coût ${cost} > prix ${price}`);
    // Le coût trouvé est bien vendable au prix demandé…
    assert.ok(
      retailPriceForCost(cost).priceUsd <= price + 0.001,
      `coût ${cost} vendu ${retailPriceForCost(cost).priceUsd} > ${price}`,
    );
    // …et il est maxiMAL (un centime de plus dépasse le prix).
    if (cost > 0 && cost < price) {
      assert.ok(
        retailPriceForCost(cost + 1).priceUsd > price,
        `le coût ${cost} n'est pas le maximum pour ${price}`,
      );
    }
  }
});

test("le coût du plafond de 300 $ tient compte de la marge (≈ 270 $)", () => {
  const cost = supplierCostForSalePrice(300);
  assert.ok(cost > 250 && cost < 290, `coût inattendu : ${cost}`);
});

/* --------------------------- Évaluation --------------------------- */

test("un solde bas face à un plafond haut est CRITIQUE", () => {
  const assessment = assessFazercardsBalance({ balanceUsd: 26.38, maxOrderUsd: 300 });
  assert.equal(assessment.level, "critical");
  assert.ok(assessment.coveredSaleUsd > 0 && assessment.coveredSaleUsd < 40);
  assert.ok(assessment.recommendedTopUpUsd > 0);
  assert.equal(assessment.recommendedTopUpUsd % BALANCE_TOPUP_ROUNDING_USD, 0);
  assert.match(assessment.summary, /INSUFFISANT/);
});

test("un plafond cohérent avec le solde est OK", () => {
  const assessment = assessFazercardsBalance({ balanceUsd: 26.38, maxOrderUsd: 25 });
  assert.equal(assessment.level, "ok");
  assert.equal(assessment.recommendedTopUpUsd, 0);
  assert.ok(assessment.coverageRatio >= 1);
});

test("entre les deux, le niveau LOW couvre une vente partielle", () => {
  // Solde 26 $ face à un plafond de 60 $ : couvre ~30 $, pas 60 $.
  const assessment = assessFazercardsBalance({ balanceUsd: 26.38, maxOrderUsd: 60 });
  assert.equal(assessment.level, "low");
  assert.ok(assessment.coverageRatio > 0 && assessment.coverageRatio < 1);
  assert.match(assessment.summary, /avant paiement/i);
});

test("un solde sous le plancher est critique même avec un petit plafond", () => {
  const assessment = assessFazercardsBalance({
    balanceUsd: BALANCE_MIN_USD - 1,
    maxOrderUsd: 3,
  });
  assert.equal(assessment.level, "critical");
});

test("un solde illisible est UNKNOWN, jamais OK", () => {
  for (const balanceUsd of [null, Number.NaN, -1]) {
    const assessment = assessFazercardsBalance({ balanceUsd, maxOrderUsd: 300 });
    assert.equal(assessment.level, "unknown");
    assert.equal(assessment.balanceUsd, null);
    assert.ok(assessment.recommendedTopUpUsd > 0);
  }
});

/* ----------------------------- Alertes ----------------------------- */

const now = Date.parse("2026-10-29T06:00:00Z");

test("première détection : alerte immédiate", () => {
  assert.equal(shouldSendBalanceAlert({ level: "critical", previous: null, now }), "alert");
});

test("même niveau : pas de rappel avant le délai", () => {
  const previous = { level: "critical", sentAt: now - 60 * 60 * 1000, balanceUsd: 26 };
  assert.equal(
    shouldSendBalanceAlert({ level: "critical", previous, now, resendHours: 24 }),
    "silent",
  );
  const old = { level: "critical", sentAt: now - 25 * 60 * 60 * 1000, balanceUsd: 26 };
  assert.equal(shouldSendBalanceAlert({ level: "critical", previous: old, now }), "alert");
});

test("changement de niveau : alerte même dans le délai", () => {
  const previous = { level: "low", sentAt: now - 60 * 1000, balanceUsd: 40 };
  assert.equal(shouldSendBalanceAlert({ level: "critical", previous, now }), "alert");
});

test("retour à OK : un seul e-mail de rétablissement", () => {
  const previous = { level: "critical", sentAt: now - 60 * 1000, balanceUsd: 26 };
  assert.equal(shouldSendBalanceAlert({ level: "ok", previous, now }), "recovery");
  const healthy = { level: "ok", sentAt: now - 60 * 1000, balanceUsd: 300 };
  assert.equal(shouldSendBalanceAlert({ level: "ok", previous: healthy, now }), "silent");
  assert.equal(shouldSendBalanceAlert({ level: "ok", previous: null, now }), "silent");
});

/* ----------------------------- Câblage ----------------------------- */

test("le cron solde est protégé par CRON_SECRET et ne fait aucun achat", () => {
  const route = read("src/app/api/cron/fazercards-balance/route.ts");
  assert.match(route, /cron_not_configured/);
  assert.match(route, /status: 401/);
  assert.match(route, /status: 503/);
  assert.match(route, /checkFazercardsBalance\(\{ dryRun, fresh: true \}\)/);
  // Lecture seule : aucun achat, aucun virement.
  assert.doesNotMatch(route, /fazercardsGiftCardOrder|fazercardsTopupOrder|fazercardsGameKeyOrder/);
  assert.doesNotMatch(route, /payments\/create|fazercardsPaymentCreate/);
});

test("le cron est déclaré dans vercel.json (une fois par jour)", () => {
  const vercel = JSON.parse(read("vercel.json"));
  const entry = vercel.crons.find((cron) => cron.path === "/api/cron/fazercards-balance");
  assert.ok(entry, "cron solde absent de vercel.json");
  // Plan Hobby : jamais plus d'une exécution par jour (sinon déploiement refusé).
  assert.match(entry.schedule, /^\d+ \d+ \* \* \*$/);
});

test("l'administration affiche la couverture du solde", () => {
  const page = read("src/app/admin/(panel)/digital/page.tsx");
  assert.match(page, /getFazercardsBalanceStatus\(\)/);
  assert.match(page, /<FazercardsBalancePanel status=\{balance\} \/>/);
});

test("le solde reste absent de la route publique /api/health", () => {
  const health = read("src/app/api/health/route.ts");
  assert.doesNotMatch(health, /balanceUsd|fazercards\.balance\.balance|"balance"/);
});

test("l'alerte n'est mémorisée que si l'e-mail est parti", () => {
  const runtime = read("src/lib/fazercards-balance.ts");
  assert.match(runtime, /if \(result\.ok\) \{\s*await writeAlertState\(/);
  // Un échec d'envoi ne doit pas faire taire l'alerte 24 h.
  assert.match(runtime, /alerte non envoyée/);
});

/* ------------------- Porte de la caisse (avant paiement) ------------------- */

test("la porte laisse passer une commande que le solde couvre", () => {
  const gate = balanceGate({ balanceUsd: 19.39, orderCostUsd: 19.39 });
  assert.equal(gate.decision, "allow");
  assert.equal(gate.reason, "covered");
  const below = balanceGate({ balanceUsd: 19.39, orderCostUsd: 12.5 });
  assert.equal(below.decision, "allow");
});

test("la porte bloque une commande au-dessus du solde, au centime près", () => {
  const gate = balanceGate({ balanceUsd: 19.39, orderCostUsd: 19.4 });
  assert.equal(gate.decision, "block");
  assert.equal(gate.balanceUsd, 19.39);
  assert.equal(gate.orderCostUsd, 19.4);
  // Bruit binaire : 0.1 × 3 ne doit ni bloquer à tort ni laisser passer.
  const floaty = balanceGate({ balanceUsd: 0.3, orderCostUsd: 0.1 * 3 });
  assert.equal(floaty.decision, "allow");
});

test("coût inconnu ou solde illisible : la vente reste possible (filet manuel)", () => {
  assert.equal(balanceGate({ balanceUsd: 1, orderCostUsd: null }).reason, "cost_unknown");
  assert.equal(balanceGate({ balanceUsd: null, orderCostUsd: 50 }).reason, "balance_unknown");
  assert.equal(balanceGate({ balanceUsd: null, orderCostUsd: null }).reason, "cost_unknown");
  // Un coût négatif ou nul est une donnée absente, pas un achat gratuit.
  assert.equal(balanceGate({ balanceUsd: 1, orderCostUsd: 0 }).reason, "cost_unknown");
  assert.equal(balanceGate({ balanceUsd: 1, orderCostUsd: -5 }).reason, "cost_unknown");
});

test("la caisse refuse AVANT la facture une vente que le solde ne couvre pas", () => {
  const orders = read("src/lib/fazercards-orders.ts");
  const checkout = orders.slice(orders.indexOf("export async function createFazercardsCheckout"));
  const gateAt = checkout.indexOf("balanceGate({");
  const refAt = checkout.indexOf('newOrderReference("DGC")');
  assert.ok(gateAt > 0, "porte de solde absente de la caisse");
  assert.ok(refAt > 0, "création de commande introuvable");
  assert.ok(gateAt < refAt, "la porte doit précéder la création de la facture");
  assert.match(checkout, /getFazercardsBalanceStatus\(\)/);
  assert.match(checkout, /supplier_balance_insufficient/);
  assert.match(checkout, /aucun montant n'a été débité/);
  // Coût = coût unitaire × quantité (une quantité ne doit pas contourner la porte).
  assert.match(checkout, /denomination\.supplierCostUsd \* quantity/);
});

test("le refus ne divulgue aucun montant interne au client", () => {
  const orders = read("src/lib/fazercards-orders.ts");
  const checkout = orders.slice(orders.indexOf("export async function createFazercardsCheckout"));
  const block = checkout.slice(checkout.indexOf('if (balanceDecision.decision === "block")'));
  const message = block.slice(0, block.indexOf(");"));
  // Ni solde, ni coût fournisseur, ni interpolation de montant dans le message.
  assert.doesNotMatch(message, /\$\{/);
  assert.doesNotMatch(message, /balanceDecision\.(balanceUsd|orderCostUsd)/);
});
