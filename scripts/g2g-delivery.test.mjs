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

test("aucun code produit ne sort dans les logs", () => {
  // L'extracteur scanne le payload mais ne journalise que les chemins de clés.
  assert.match(SRC, /clés du payload scannées/);
  // La fonction extractCodesFromPayload ne journalise jamais les valeurs
  // de code : seuls les chemins de clés (keyLog) passent dans console.info.
  const consoleInfo = SRC.indexOf("clés du payload scannées");
  const block = SRC.slice(consoleInfo - 200, consoleInfo + 100);
  assert.doesNotMatch(block, /content:/);
  assert.doesNotMatch(block, /codes\.push/);
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

test("le webhook tente la livraison synchrone après achat", () => {
  assert.match(WEBHOOK, /deliveredSync/);
  assert.match(WEBHOOK, /attemptG2gDelivery\(delivery\)/);
  assert.match(WEBHOOK, /setTimeout\(resolve, 2000\)/);
  assert.match(WEBHOOK, /status: "delivered"/);
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
