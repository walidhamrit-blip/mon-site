// Tests du noyau PUR de la file de livraison (webhooks → fournisseurs).
//
// Ce que l'on vérifie ici, ce sont les DÉCISIONS : quand réessayer, quand
// escalader à un humain, quand considérer un événement comme un doublon.
// Aucune base, aucun réseau, aucun secret n'est impliqué — c'est justement
// pour cela que ces règles sont isolées dans un module pur.
import test from "node:test";
import assert from "node:assert/strict";
import {
  DELIVERY_MAX_ATTEMPTS,
  DELIVERY_RETRY_BASE_MS,
  DELIVERY_RETRY_CAP_MS,
  FULFILLMENT_STATUSES,
  classifyDeliveryError,
  deliveryIdempotencyKey,
  deliveryOutcomeSignal,
  deliveryRetryDelayMs,
  fulfillmentStatusFromLegacy,
  isDeliveryJobDue,
  legacyStatusFromFulfillment,
  nextDeliveryRetryAt,
  nextFulfillmentStatus,
  normalizeFulfillmentStatus,
  shouldRetryDelivery,
  supplierFromOrder,
  webhookEventKey,
} from "../src/lib/delivery-queue-core.ts";

/* ----------------------------- Statuts granulaires ---------------------- */

test("les quatre statuts granulaires demandés existent", () => {
  assert.deepEqual([...FULFILLMENT_STATUSES], [
    "pending_payment",
    "paid_fulfilling",
    "delivered",
    "manual_review",
  ]);
});

test("un statut inconnu retombe sur pending_payment (jamais sur delivered)", () => {
  assert.equal(normalizeFulfillmentStatus("weird"), "pending_payment");
  assert.equal(normalizeFulfillmentStatus(null), "pending_payment");
  assert.equal(normalizeFulfillmentStatus(undefined), "pending_payment");
});

test("les statuts historiques sont traduits sans perte", () => {
  assert.equal(fulfillmentStatusFromLegacy("pending"), "pending_payment");
  assert.equal(fulfillmentStatusFromLegacy("paid"), "paid_fulfilling");
  assert.equal(fulfillmentStatusFromLegacy("delivered"), "delivered");
  assert.equal(fulfillmentStatusFromLegacy("manual"), "manual_review");
  // Un échec fournisseur est une revue manuelle, pas un état terminal muet.
  assert.equal(fulfillmentStatusFromLegacy("failed"), "manual_review");
});

test("la traduction inverse reste cohérente avec l'ancien code", () => {
  for (const legacy of ["pending", "paid", "delivered", "manual", "failed"]) {
    const granular = fulfillmentStatusFromLegacy(legacy);
    const back = legacyStatusFromFulfillment(granular);
    assert.equal(fulfillmentStatusFromLegacy(back), granular);
  }
});

test("delivered est terminal : aucun événement ne le fait reculer", () => {
  for (const event of [
    "payment_confirmed",
    "delivery_started",
    "delivery_failed_transient",
    "delivery_failed_permanent",
    "delivery_awaiting",
  ]) {
    assert.equal(nextFulfillmentStatus("delivered", event), "delivered");
  }
});

test("paiement confirmé → paid_fulfilling, échec permanent → manual_review", () => {
  assert.equal(nextFulfillmentStatus("pending_payment", "payment_confirmed"), "paid_fulfilling");
  assert.equal(
    nextFulfillmentStatus("paid_fulfilling", "delivery_failed_permanent"),
    "manual_review",
  );
  // Un échec transitoire ne fait PAS sortir de la livraison en cours.
  assert.equal(
    nextFulfillmentStatus("paid_fulfilling", "delivery_failed_transient"),
    "paid_fulfilling",
  );
});

/* --------------------------------- Backoff ------------------------------ */

test("le backoff est exponentiel puis plafonné", () => {
  // random = 0.5 → jitter neutre.
  assert.equal(deliveryRetryDelayMs(1, 0.5), DELIVERY_RETRY_BASE_MS);
  assert.equal(deliveryRetryDelayMs(2, 0.5), DELIVERY_RETRY_BASE_MS * 2);
  assert.equal(deliveryRetryDelayMs(3, 0.5), DELIVERY_RETRY_BASE_MS * 4);
  assert.equal(deliveryRetryDelayMs(20, 0.5), DELIVERY_RETRY_CAP_MS);
});

test("le jitter reste dans ±20 %", () => {
  assert.equal(deliveryRetryDelayMs(1, 0), Math.round(DELIVERY_RETRY_BASE_MS * 0.8));
  assert.equal(deliveryRetryDelayMs(1, 1), Math.round(DELIVERY_RETRY_BASE_MS * 1.2));
});

test("une tentative invalide ne produit jamais NaN", () => {
  assert.equal(deliveryRetryDelayMs(0, 0.5), DELIVERY_RETRY_BASE_MS);
  assert.equal(deliveryRetryDelayMs(Number.NaN, 0.5), DELIVERY_RETRY_BASE_MS);
  assert.ok(!Number.isNaN(deliveryRetryDelayMs(-3, 0.5)));
});

test("nextDeliveryRetryAt ajoute le délai à l'instant courant", () => {
  const now = Date.UTC(2026, 10, 13, 10, 0, 0);
  const at = nextDeliveryRetryAt(2, now, 0.5);
  assert.equal(at.getTime(), now + DELIVERY_RETRY_BASE_MS * 2);
});

test("les retries s'arrêtent à la limite configurée", () => {
  assert.equal(shouldRetryDelivery(0), true);
  assert.equal(shouldRetryDelivery(DELIVERY_MAX_ATTEMPTS - 1), true);
  assert.equal(shouldRetryDelivery(DELIVERY_MAX_ATTEMPTS), false);
  assert.equal(shouldRetryDelivery(99), false);
  // Une limite absurde ne boucle pas à l'infini.
  assert.equal(shouldRetryDelivery(1, 0), false);
});

/* ----------------------- Classification des erreurs --------------------- */

test("un timeout réseau est transitoire", () => {
  assert.equal(classifyDeliveryError({ status: null, message: "fetch failed" }), "transient");
});

test("429 et 5xx sont transitoires", () => {
  assert.equal(classifyDeliveryError({ status: 429 }), "transient");
  assert.equal(classifyDeliveryError({ status: 503 }), "transient");
  assert.equal(classifyDeliveryError({ status: 500 }), "transient");
});

test("un refus métier 4xx est permanent", () => {
  assert.equal(classifyDeliveryError({ status: 400 }), "permanent");
  assert.equal(classifyDeliveryError({ status: 404 }), "permanent");
  assert.equal(classifyDeliveryError({ status: 422 }), "permanent");
});

test("un code métier explicite rend l'erreur permanente", () => {
  assert.equal(classifyDeliveryError({ status: 200, code: "OUT_OF_STOCK" }), "permanent");
  assert.equal(classifyDeliveryError({ status: 200, code: "INSUFFICIENT_BALANCE" }), "permanent");
});

test("rupture de stock et solde insuffisant → revue manuelle", () => {
  assert.equal(classifyDeliveryError({ status: null, message: "out of stock" }), "permanent");
  assert.equal(
    classifyDeliveryError({ status: null, message: "insufficient balance" }),
    "permanent",
  );
  assert.equal(
    classifyDeliveryError({ message: "WRONG_PRODUCT_PRICE" }),
    "permanent",
  );
});

test("« processing » est une attente, pas une erreur", () => {
  assert.equal(classifyDeliveryError({ message: "order processing" }), "awaiting");
  assert.equal(classifyDeliveryError({ message: "en attente chez le fournisseur" }), "awaiting");
});

/* ------------------------------ Décision -------------------------------- */

test("une commande livrée ne déclenche plus rien", () => {
  const signal = deliveryOutcomeSignal({ status: "delivered", deliveredAt: new Date() });
  assert.equal(signal.kind, "done");
});

test("une commande non payée ne déclenche AUCUN achat", () => {
  const signal = deliveryOutcomeSignal({ status: "pending", productSlug: "fzr-giftcard-steam" });
  assert.equal(signal.kind, "done");
  assert.equal(signal.reason, "Paiement non confirmé — aucun achat.");
});

test("une commande payée sans tentative est à retenter", () => {
  const signal = deliveryOutcomeSignal({
    status: "paid",
    productSlug: "fzr-giftcard-steam",
    attempts: 0,
  });
  assert.equal(signal.kind, "retry");
  assert.equal(signal.supplier, "fazercards");
});

test("une erreur transitoire connue est retentée", () => {
  const signal = deliveryOutcomeSignal({
    status: "paid",
    productSlug: "fzr-topup-roblox",
    attempts: 2,
    lastError: "Achat FazerCards échoué : ETIMEDOUT",
  });
  assert.equal(signal.kind, "retry");
});

test("un échec permanent connu part en revue manuelle immédiate", () => {
  const signal = deliveryOutcomeSignal({
    status: "paid",
    attempts: 1,
    lastError: "Achat FazerCards échoué : product out of stock",
  });
  assert.equal(signal.kind, "manual");
});

test("retries épuisés → revue manuelle avec motif explicite", () => {
  const signal = deliveryOutcomeSignal({ status: "paid", attempts: DELIVERY_MAX_ATTEMPTS });
  assert.equal(signal.kind, "manual");
  assert.match(signal.reason, /tentatives/i);
});

test("une commande déjà en manual n'est pas rachetée par la file", () => {
  const signal = deliveryOutcomeSignal({ status: "manual", lastError: "Rupture de stock." });
  assert.equal(signal.kind, "manual");
  assert.equal(signal.reason, "Rupture de stock.");
});

test("un fournisseur « processing » est une attente, pas un échec", () => {
  const signal = deliveryOutcomeSignal({
    status: "paid",
    reloadlyStatus: "processing",
    attempts: 1,
  });
  assert.equal(signal.kind, "awaiting");
});

test("le fournisseur se déduit du slug produits live", () => {
  assert.equal(supplierFromOrder({ productSlug: "fzr-giftcard-steam-50" }), "fazercards");
  assert.equal(supplierFromOrder({ productId: "fzr-topup-freefire" }), "fazercards");
  assert.equal(supplierFromOrder({ productSlug: "steam-50-usd" }), "reloadly");
  assert.equal(supplierFromOrder({}), "reloadly");
});

/* ----------------------------- Idempotence ------------------------------ */

test("la clé d'idempotence d'une commande est sa référence normalisée", () => {
  assert.equal(deliveryIdempotencyKey(" dgc-abc123 "), "DGC-ABC123");
  assert.equal(deliveryIdempotencyKey(""), "");
});

test("le même événement webhook produit la même clé (doublon détectable)", () => {
  const first = webhookEventKey("NOWPayments", "123456", "finished");
  const second = webhookEventKey("nowpayments", " 123456 ", "FINISHED");
  assert.equal(first, second);
});

test("un changement de statut est un événement différent", () => {
  assert.notEqual(
    webhookEventKey("nowpayments", "123456", "waiting"),
    webhookEventKey("nowpayments", "123456", "finished"),
  );
});

test("la clé d'événement est bornée et sans caractère exotique", () => {
  const key = webhookEventKey("nowpayments", "a".repeat(500), "finished é");
  assert.ok(key.length <= 200);
  assert.match(key, /^[a-z0-9._:-]+$/);
});

/* -------------------------------- Jobs --------------------------------- */

test("un job en file sans date est dû immédiatement", () => {
  assert.equal(isDeliveryJobDue({ status: "queued", nextRetryAt: null }), true);
});

test("un job programmé dans le futur n'est pas dû", () => {
  const now = Date.now();
  assert.equal(
    isDeliveryJobDue({ status: "queued", nextRetryAt: new Date(now + 60_000) }, now),
    false,
  );
  assert.equal(
    isDeliveryJobDue({ status: "queued", nextRetryAt: new Date(now - 1_000) }, now),
    true,
  );
});

test("un job « processing » au bail expiré est réclamable", () => {
  const now = Date.now();
  assert.equal(
    isDeliveryJobDue({ status: "processing", claimedAt: new Date(now - 10 * 60_000) }, now),
    true,
  );
  assert.equal(
    isDeliveryJobDue({ status: "processing", claimedAt: new Date(now - 1_000) }, now),
    false,
  );
});

test("un job terminé n'est jamais rejoué", () => {
  for (const status of ["done", "failed", "dead_letter"]) {
    assert.equal(isDeliveryJobDue({ status }), false);
  }
});
