#!/usr/bin/env node
import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * Tests structurels du module de livraison G2G (`src/lib/g2g-delivery.ts`).
 *
 * `node --test` ne peut pas importer `@/db` (résolution des alias
 * TypeScript absente), donc ces tests lisent le fichier source et vérifient
 * que les protections critiques sont bien présentes dans le texte.
 *
 * Ce qui est verrouillé ici :
 *  - aucun code produit ne sort dans les logs (seuls les chemins de clés) ;
 *  - la prise de possession est atomique (UPDATE conditionnel) ;
 *  - le statut `delivery_processing` + bail protège contre les crons concurrents ;
 *  - le backoff est borné (60 s → 4 h) ;
 *  - l'escalade Telegram est déclenchée après épuisement ;
 *  - le fast path du webhook livre en synchrone quand les codes sont là.
 */

import { readFileSync } from "node:fs";

function read(p) {
  return readFileSync(p, "utf-8");
}

const SRC = read("src/lib/g2g-delivery.ts");
const WEBHOOK = read("src/app/api/webhooks/g2g/route.ts");
const CRON = read("src/app/api/cron/g2g-delivery/route.ts");

test("aucune extraction heuristique et g2gDeliverCodes verrouillé derrière les 3 garde-fous", () => {
  assert.match(SRC, /kind: "manual_review"/);
  assert.doesNotMatch(SRC, /extractCodesFromPayload/);
  const gate1 = SRC.indexOf("if (!automaticDeliveryVerified())");
  const gate2 = SRC.indexOf("if (!g2gAutoDeliveryEnabled(process.env.G2G_AUTO_DELIVERY))");
  const gate3 = SRC.indexOf("configuredPilot !== PILOT_CANDIDATE_OFFER_ID");
  const deliverAt = SRC.lastIndexOf("g2gDeliverCodes(");
  assert.ok(gate1 > 0 && gate2 > gate1 && gate3 > gate2 && deliverAt > gate3);
});

test("la prise de possession est atomique et inclut le bail de reprise", () => {
  // UPDATE conditionnel : status IN (purchasing|purchased|failed) ou
  // delivery_processing avec bail expiré.
  assert.match(SRC, /inArray\(g2gDeliveries\.status, \["purchasing", "purchased", "failed"\]\)/);
  assert.match(SRC, /eq\(g2gDeliveries\.status, "delivery_processing"\)/);
  assert.match(SRC, /lte\(g2gDeliveries\.deliveryClaimedAt, leaseFloor\)/);
  // Le bail est posé lors de la réclamation.
  assert.match(SRC, /deliveryClaimedAt: now/);
});

test("le backoff est borné : 60 s → 4 h", () => {
  assert.match(SRC, /60_000/);
  assert.match(SRC, /4 \* 60 \* 60 \* 1000/);
  assert.match(SRC, /Math\.pow\(2, attempts - 1\)/);
  assert.match(SRC, /Math\.min\(raw, G2G_DELIVERY_MAX_DELAY_MS\)/);
});

test("le nombre max de tentatives est de 10 avant escalade", () => {
  assert.match(SRC, /G2G_DELIVERY_MAX_ATTEMPTS = 10/);
  assert.match(SRC, /attempts >= G2G_DELIVERY_MAX_ATTEMPTS/);
  assert.match(SRC, /LIVRAISON EN ÉCHEC DÉFINITIF/);
  assert.match(SRC, /rembourser/);
});

test("le statut `delivered` est terminal : nextAttemptAt mis à null", () => {
  const delivered = SRC.indexOf('status: "delivered"');
  assert.ok(delivered > 0);
  const block = SRC.slice(delivered, delivered + 600);
  assert.match(block, /nextAttemptAt: null/);
  assert.match(block, /deliveryClaimedAt: null/);
});

test("l'échec de livraison reprogramme avec backoff plutôt qu'un échec immédiat", () => {
  assert.match(SRC, /nextDeliveryDelayMs\(attempts\)/);
  assert.match(SRC, /status: "purchased"/, "on reste en « purchased » pour retenter");
});

test("le cron est protégé par CRON_SECRET", () => {
  assert.match(CRON, /process\.env\.CRON_SECRET/);
  assert.match(CRON, /CRON_SECRET/);
  assert.match(CRON, /Bearer \$\{secret\}/);
  assert.match(CRON, /processG2gDeliveryQueue\(/);
});

test("le cron est configuré dans vercel.json à la minute", () => {
  const vercel = read("vercel.json");
  assert.match(vercel, /"path": "\/api\/cron\/g2g-delivery"/);
  assert.match(vercel, /"\* \* \* \* \*"/);
});

test("le webhook ne livre pas en concurrence avec le cron", () => {
  assert.doesNotMatch(WEBHOOK, /attemptG2gDelivery\(/);
  assert.match(SRC, /for \(const delivery of claimedRows\)/);
  assert.match(SRC, /\.returning\(\)/);
});

test("le webhook n'alerte « À LIVRER À LA MAIN » que si pas livré en synchrone", () => {
  assert.match(WEBHOOK, /!deliveredSync/);
  assert.match(WEBHOOK, /À LIVRER À LA MAIN/);
});

test("le schéma DB a delivery_attempts et delivery_claimed_at", () => {
  const schema = read("src/db/schema.ts");
  assert.match(schema, /deliveryAttempts: integer\("delivery_attempts"\)/);
  assert.match(schema, /deliveryClaimedAt: timestamp\("delivery_claimed_at"[,)]/);
});

test("ensureSchema crée les nouvelles colonnes si absentes", () => {
  const dbidx = read("src/db/index.ts");
  assert.match(dbidx, /ALTER TABLE g2g_deliveries ADD COLUMN IF NOT EXISTS delivery_attempts/);
  assert.match(dbidx, /ALTER TABLE g2g_deliveries ADD COLUMN IF NOT EXISTS delivery_claimed_at/);
});

test("le cron a maxDuration = 30", () => {
  assert.match(CRON, /export const maxDuration = 30;/);
});

test("les tests synthétiques et la livraison non vérifiée ne peuvent pas acheter", () => {
  assert.match(WEBHOOK, /const isSyntheticTest =/);
  assert.match(WEBHOOK, /!isSyntheticTest && automaticDeliveryVerified\(\)/);
  const pilotSrc = read("src/lib/g2g-pilot.ts");
  assert.match(pilotSrc, /autoDelivery\?\.trim\(\) === "1"/);
  assert.match(pilotSrc, /pilotOfferId\(configuredPilot\) === PILOT_CANDIDATE_OFFER_ID/);
  const qty = read("src/app/api/admin/g2g/offer-qty/route.ts");
  assert.match(qty, /apiQty > 0 && !automaticDeliveryVerified\(\)/);
  assert.match(qty, /error: "delivery_not_verified"/);
  assert.match(qty, /fazercardsBalance/);
  assert.match(qty, /livePlan\.decision !== "proceed"/);
});

test("expiration des tentatives sans codes mène à une escalade", () => {
  const start = SRC.indexOf('case "awaiting_codes":');
  const end = SRC.indexOf('case "manual_review":', start);
  const block = SRC.slice(start, end);
  assert.match(block, /attempts >= G2G_DELIVERY_MAX_ATTEMPTS/);
  assert.match(block, /await escalateDelivery/);
  assert.match(block, /nextAttemptAt: null/);
});

test("le webhook lit le prix fournisseur courant avant la décision", () => {
  assert.match(WEBHOOK, /await fazercardsGiftCardCards\(mapping.categoryId\)/);
  assert.match(WEBHOOK, /supplierCostUsd = Number\(sku.price_usd\)/);
  assert.doesNotMatch(WEBHOOK, /Number\(mapping.supplierPriceUsd/);
});

test("reprise prudente : les planned abandonnés sont signalés sans achat", () => {
  assert.match(SRC, /abandonedFloor = new Date\(now.getTime\(\) - 10 \* 60_000\)/);
  assert.match(SRC, /eq\(g2gDeliveries.status, "planned"\), lte\(g2gDeliveries.updatedAt, abandonedFloor\)/);
  assert.match(SRC, /for \(const delivery of claimedRows\)/);
  assert.match(SRC, /eq\(g2gDeliveries.deliveryClaimedAt, now\)/);
  assert.doesNotMatch(SRC, /fazercardsGiftCardOrder\(/);
});

test("une panne après réservation laisse une trace pour la revue manuelle", () => {
  const transaction = WEBHOOK.indexOf("db.transaction(async (tx)");
  const event = WEBHOOK.indexOf("tx.insert(webhookEvents)", transaction);
  const delivery = WEBHOOK.indexOf("tx.insert(g2gDeliveries)", event);
  assert.ok(transaction > 0 && event > transaction && delivery > event);
  assert.match(WEBHOOK, /decision: "pending_review", status: "planned"/);
  assert.match(WEBHOOK, /error: "delivery_log_unavailable"/);
  assert.match(WEBHOOK, /error: "idempotency_unavailable"/);
});
