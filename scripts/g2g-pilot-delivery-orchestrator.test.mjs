import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import {
  buildStableDispatchReferenceId,
  readDispatchIntent,
  reserveDispatchIntentCommitted,
  transitionDispatchIntentState,
} from "../src/lib/g2g-dispatch-intent.ts";
import { PILOT_CANDIDATE_OFFER_ID, RETIRED_G2G_OFFER_IDS, automaticDeliveryVerified } from "../src/lib/g2g-pilot.ts";
import { runPilotDeliveryAttempt } from "../src/lib/g2g-pilot-delivery-orchestrator.ts";

const SECRET_CODE = "SECRET-GP-TR-9988-7766-5544";

function baseInput(overrides = {}) {
  return {
    orderId: "ORD-PILOT-1001",
    deliveryId: "DEL-PILOT-1001",
    offerId: PILOT_CANDIDATE_OFFER_ID,
    requestedQty: 1,
    supplierOrderRef: "FAZ-ORD-1001",
    expiresAt: new Date("2026-11-26T13:00:00.000Z"),
    ...overrides,
  };
}

function makeG2gEnvelope({
  orderId = "ORD-PILOT-1001",
  deliveryId = "DEL-PILOT-1001",
  offerId = PILOT_CANDIDATE_OFFER_ID,
  requestedQty = 1,
  deliveredQty = 0,
  deliveryStatus = "pending",
  code = "20000001",
} = {}) {
  return {
    code,
    payload: {
      order_id: orderId,
      offer_id: offerId,
      delivery_summary: {
        delivery_id: deliveryId,
        requested_qty: requestedQty,
        delivered_qty: deliveredQty,
        delivery_status: deliveryStatus,
      },
    },
  };
}

function makeSupplierEnvelope({
  id = "FAZ-ORD-1001",
  kind = "gift_card",
  status = "completed",
  code = SECRET_CODE,
  codes,
  ok = true,
} = {}) {
  const order = { id, kind, status };
  if (code !== undefined) order.code = code;
  if (codes !== undefined) order.codes = codes;
  return { ok, order };
}

/**
 * Simule fidèlement PostgreSQL (`g2g_dispatch_intents` + `clock_timestamp()` +
 * verrouillage exclusif par `delivery_id` entre `INSERT` et `COMMIT`/`ROLLBACK`).
 */
function createFakeDatabase({ initialNowIso = "2026-11-26T12:00:00.000Z" } = {}) {
  let nowMs = Date.parse(initialNowIso);
  /** @type {Map<string, Record<string, unknown>>} */
  const committedIntents = new Map();
  /** @type {Map<string, Promise<void>>} */
  const activeKeyLocks = new Map();

  function createSession({ failOnCommit = false } = {}) {
    let inTx = false;
    /** @type {Map<string, Record<string, unknown>>} */
    let staged = new Map();
    /** @type {Array<() => void>} */
    let releaseLocks = [];

    function unlockAll() {
      const callbacks = releaseLocks;
      releaseLocks = [];
      for (const fn of callbacks) fn();
    }

    return {
      async query(sqlText, params) {
        const normalized = sqlText.replace(/\s+/g, " ").trim();

        if (normalized === "BEGIN") {
          inTx = true;
          staged = new Map();
          return { rows: [] };
        }

        if (normalized === "COMMIT") {
          for (const [k, v] of staged.entries()) {
            committedIntents.set(k, v);
          }
          inTx = false;
          staged.clear();
          unlockAll();
          if (failOnCommit) {
            throw new Error("simulated connection drop during COMMIT ack");
          }
          return { rows: [] };
        }

        if (normalized === "ROLLBACK") {
          inTx = false;
          staged.clear();
          unlockAll();
          return { rows: [] };
        }

        if (normalized.startsWith("INSERT INTO g2g_dispatch_intents")) {
          const [orderId, deliveryId, offerId, supplierOrderId, quantity, referenceId, expiresAt] = params;
          const expDate = expiresAt instanceof Date ? expiresAt : new Date(String(expiresAt));
          if (!Number.isFinite(expDate.getTime()) || expDate.getTime() <= nowMs) {
            return { rows: [] };
          }

          while (activeKeyLocks.has(deliveryId)) {
            await activeKeyLocks.get(deliveryId);
          }

          if (committedIntents.has(deliveryId) || staged.has(deliveryId)) {
            return { rows: [] };
          }

          let releaseKey;
          const lockPromise = new Promise((resolve) => {
            releaseKey = resolve;
          });
          activeKeyLocks.set(deliveryId, lockPromise);
          releaseLocks.push(() => {
            if (activeKeyLocks.get(deliveryId) === lockPromise) {
              activeKeyLocks.delete(deliveryId);
            }
            releaseKey();
          });

          const nowDate = new Date(nowMs);
          const row = {
            order_id: orderId,
            delivery_id: deliveryId,
            offer_id: offerId,
            supplier_order_id: supplierOrderId,
            quantity,
            reference_id: referenceId,
            expires_at: expDate,
            state: "dispatching",
            reserved_at: nowDate,
            acknowledged_at: null,
            confirmed_at: null,
            updated_at: nowDate,
            last_detail: null,
          };

          if (inTx) {
            staged.set(deliveryId, row);
          } else {
            committedIntents.set(deliveryId, row);
            unlockAll();
          }
          return { rows: [{ order_id: orderId, delivery_id: deliveryId, reference_id: referenceId, state: "dispatching" }] };
        }

        if (normalized.startsWith("SELECT order_id, delivery_id, offer_id")) {
          const [deliveryId] = params;
          const row = (inTx && staged.get(deliveryId)) || committedIntents.get(deliveryId);
          return { rows: row ? [{ ...row }] : [] };
        }

        if (normalized.startsWith("UPDATE g2g_dispatch_intents")) {
          const [orderId, deliveryId, toState, allowedFrom, detail] = params;
          const row = committedIntents.get(deliveryId);
          if (!row || row.order_id !== orderId || !allowedFrom.includes(row.state)) {
            return { rows: [] };
          }
          const nowDate = new Date(nowMs);
          row.state = toState;
          row.updated_at = nowDate;
          if (toState === "acknowledged" && !row.acknowledged_at) row.acknowledged_at = nowDate;
          if (toState === "confirmed" && !row.confirmed_at) row.confirmed_at = nowDate;
          row.last_detail = detail;
          return { rows: [{ state: toState }] };
        }

        throw new Error(`Unexpected SQL: ${normalized}`);
      },
    };
  }

  return {
    committedIntents,
    now: () => nowMs,
    advanceMs(deltaMs) {
      nowMs += deltaMs;
    },
    setNow(iso) {
      nowMs = Date.parse(iso);
    },
    createSession,
  };
}

function createHarness(options = {}) {
  const db = createFakeDatabase({ initialNowIso: options.initialNowIso });
  const poolExec = db.createSession();

  const counters = {
    getDeliveryStatus: 0,
    getSupplierOrder: 0,
    deliverCodes: 0,
    reserveCalls: 0,
  };

  let g2gState = {
    orderId: "ORD-PILOT-1001",
    deliveryId: "DEL-PILOT-1001",
    offerId: PILOT_CANDIDATE_OFFER_ID,
    requestedQty: 1,
    deliveredQty: 0,
    deliveryStatus: "pending",
    ...(options.initialG2g ?? {}),
  };

  let supplierState = {
    id: "FAZ-ORD-1001",
    kind: "gift_card",
    status: "completed",
    code: SECRET_CODE,
    ...(options.initialSupplier ?? {}),
  };

  /** @type {Array<Record<string, unknown>>} */
  const deliveredPayloads = [];

  const ports = {
    now: () => db.now(),
    readDispatchIntent: (expected) => readDispatchIntent(poolExec, expected),
    reserveDispatchIntent: async (reserveInput) => {
      counters.reserveCalls += 1;
      if (options.beforeReserve) await options.beforeReserve(counters.reserveCalls);
      const txSession = db.createSession({
        failOnCommit: Boolean(options.failCommitOnCall === counters.reserveCalls),
      });
      const res = await reserveDispatchIntentCommitted(txSession, reserveInput);
      if (options.afterReserve) await options.afterReserve(res, counters.reserveCalls);
      return res;
    },
    transitionDispatchIntent: (transitionInput) =>
      transitionDispatchIntentState(poolExec, transitionInput),
    getDeliveryStatus: async (orderId, deliveryId) => {
      counters.getDeliveryStatus += 1;
      if (options.onGetDeliveryStatus) {
        return options.onGetDeliveryStatus({
          callIndex: counters.getDeliveryStatus,
          orderId,
          deliveryId,
          g2gState,
          db,
        });
      }
      return makeG2gEnvelope(g2gState);
    },
    getSupplierOrder: async (supplierOrderId) => {
      counters.getSupplierOrder += 1;
      if (options.onGetSupplierOrder) {
        return options.onGetSupplierOrder({
          callIndex: counters.getSupplierOrder,
          supplierOrderId,
          supplierState,
        });
      }
      return makeSupplierEnvelope(supplierState);
    },
    deliverCodes: async (deliverInput) => {
      counters.deliverCodes += 1;
      deliveredPayloads.push(structuredClone(deliverInput));
      if (options.onDeliverCodes) {
        return options.onDeliverCodes({
          callIndex: counters.deliverCodes,
          deliverInput,
          g2gState,
          db,
        });
      }
      g2gState = {
        ...g2gState,
        deliveredQty: deliverInput.codes.length,
        deliveryStatus: "delivered",
      };
      return {
        code: "20000001",
        payload: { delivery_id: deliverInput.deliveryId },
      };
    },
  };

  return {
    db,
    ports,
    counters,
    deliveredPayloads,
    setG2gState: (patch) => {
      g2gState = { ...g2gState, ...patch };
    },
    setSupplierState: (patch) => {
      supplierState = { ...supplierState, ...patch };
    },
  };
}

function assertNoSecretCodeLeak(value, contextLabel) {
  const serialized = JSON.stringify(value);
  assert.equal(
    serialized.includes(SECRET_CODE),
    false,
    `Le code secret ne doit jamais fuiter dans ${contextLabel}`,
  );
}

test("1. cycle nominal pilote complet : 1 lecture FazerCards, 1 COMMIT, 1 POST G2G, confirmation séparée GET -> confirmed", async () => {
  const h = createHarness();
  const input = baseInput();
  const result = await runPilotDeliveryAttempt(input, h.ports);

  assert.deepEqual(result, { kind: "delivered", codes: 1 });
  assert.equal(h.counters.getSupplierOrder, 1);
  assert.equal(h.counters.deliverCodes, 1);
  assert.equal(h.counters.getDeliveryStatus, 3);

  assert.equal(h.deliveredPayloads.length, 1);
  assert.deepEqual(h.deliveredPayloads[0], {
    orderId: "ORD-PILOT-1001",
    deliveryId: "DEL-PILOT-1001",
    codes: [
      {
        content: SECRET_CODE,
        reference_id: buildStableDispatchReferenceId("ORD-PILOT-1001", "DEL-PILOT-1001"),
      },
    ],
  });

  const savedIntent = h.db.committedIntents.get("DEL-PILOT-1001");
  assert.equal(savedIntent.state, "confirmed");
  assert.ok(savedIntent.acknowledged_at);
  assert.ok(savedIntent.confirmed_at);
  assertNoSecretCodeLeak(result, "le résultat d'orchestration");
  assertNoSecretCodeLeak(savedIntent, "la ligne g2g_dispatch_intents");
});

test("2. rejeu après confirmation ou expiration du bail de 5 minutes : 0 lecture FazerCards, 0 second POST", async () => {
  const h = createHarness();
  const input = baseInput();

  const first = await runPilotDeliveryAttempt(input, h.ports);
  assert.equal(first.kind, "delivered");

  h.db.advanceMs(10 * 60_000);
  const replay = await runPilotDeliveryAttempt(input, h.ports);

  assert.deepEqual(replay, { kind: "delivered", codes: 1 });
  assert.equal(h.counters.getSupplierOrder, 1, "aucune nouvelle lecture FazerCards au rejeu");
  assert.equal(h.counters.deliverCodes, 1, "aucun second POST G2G au rejeu");
});

test("3. concurrence : deux workers simultanés -> exactement 1 POST G2G, le second attend sans fausse alerte d'échec", async () => {
  let releaseWorker1CommitHold;
  const worker1Hold = new Promise((resolve) => {
    releaseWorker1CommitHold = resolve;
  });
  let notifyWorker1Entered;
  const worker1EnteredPromise = new Promise((resolve) => {
    notifyWorker1Entered = resolve;
  });

  const db = createFakeDatabase();
  const poolExec = db.createSession();
  let deliverCalls = 0;

  let g2gState = {
    orderId: "ORD-PILOT-1001",
    deliveryId: "DEL-PILOT-1001",
    offerId: PILOT_CANDIDATE_OFFER_ID,
    requestedQty: 1,
    deliveredQty: 0,
    deliveryStatus: "pending",
  };

  function makeWorkerPorts(isWorker1) {
    return {
      now: () => db.now(),
      readDispatchIntent: (expected) => readDispatchIntent(poolExec, expected),
      reserveDispatchIntent: async (reserveInput) => {
        const baseSession = db.createSession();
        const wrappedSession = {
          async query(sql, params) {
            if (isWorker1 && sql === "COMMIT") {
              notifyWorker1Entered();
              await worker1Hold;
            }
            return baseSession.query(sql, params);
          },
        };
        return reserveDispatchIntentCommitted(wrappedSession, reserveInput);
      },
      transitionDispatchIntent: (ti) => transitionDispatchIntentState(poolExec, ti),
      getDeliveryStatus: async () => makeG2gEnvelope(g2gState),
      getSupplierOrder: async () => makeSupplierEnvelope(),
      deliverCodes: async (payload) => {
        deliverCalls += 1;
        g2gState = { ...g2gState, deliveredQty: 1, deliveryStatus: "delivered" };
        return { code: "20000001", payload: { delivery_id: payload.deliveryId } };
      },
    };
  }

  const p1 = runPilotDeliveryAttempt(baseInput(), makeWorkerPorts(true));
  await worker1EnteredPromise;

  const p2 = runPilotDeliveryAttempt(baseInput(), makeWorkerPorts(false));
  await new Promise((r) => setTimeout(r, 15));
  releaseWorker1CommitHold();

  const [r1, r2] = await Promise.all([p1, p2]);
  assert.equal(deliverCalls, 1, "un seul POST G2G malgré la course concurrente");
  assert.deepEqual(r1, { kind: "delivered", codes: 1 });
  assert.equal(
    r2.kind === "awaiting_confirmation" || r2.kind === "delivered",
    true,
    `le second worker ne doit jamais échouer ni renvoyer : ${JSON.stringify(r2)}`,
  );
});

test("4. expiration : échéance absente, dépassée ou atteinte dans la marge de sécurité -> aucun achat/envoi", async () => {
  const hMissing = createHarness();
  const rMissing = await runPilotDeliveryAttempt(baseInput({ expiresAt: null }), hMissing.ports);
  assert.equal(rMissing.kind, "manual_review");
  assert.equal(hMissing.counters.getSupplierOrder, 0);
  assert.equal(hMissing.counters.deliverCodes, 0);
  assert.equal(hMissing.counters.reserveCalls, 0);

  const hExpired = createHarness({ initialNowIso: "2026-11-26T13:00:01.000Z" });
  const rExpired = await runPilotDeliveryAttempt(baseInput(), hExpired.ports);
  assert.equal(rExpired.kind, "manual_review");
  assert.equal(hExpired.counters.getSupplierOrder, 0);
  assert.equal(hExpired.counters.deliverCodes, 0);

  const hBuffer = createHarness({ initialNowIso: "2026-11-26T12:59:56.000Z" });
  const rBuffer = await runPilotDeliveryAttempt(baseInput(), hBuffer.ports, { safetyBufferMs: 5_000 });
  assert.equal(rBuffer.kind, "manual_review");
  assert.equal(hBuffer.counters.deliverCodes, 0);
});

test("5. expiration ou annulation survenant ENTRE le COMMIT de réservation et le POST -> transition aborted, 0 POST", async () => {
  const hCancelRace = createHarness({
    afterReserve: async () => {
      hCancelRace.setG2gState({ deliveryStatus: "cancelled" });
    },
  });
  const rCancel = await runPilotDeliveryAttempt(baseInput(), hCancelRace.ports);
  assert.equal(rCancel.kind, "manual_review");
  assert.equal(hCancelRace.counters.deliverCodes, 0, "aucun POST après annulation");
  assert.equal(hCancelRace.db.committedIntents.get("DEL-PILOT-1001").state, "aborted");

  const rCancelReplay = await runPilotDeliveryAttempt(baseInput(), hCancelRace.ports);
  assert.equal(rCancelReplay.kind, "manual_review");
  assert.equal(hCancelRace.counters.deliverCodes, 0);

  const hExpiryRace = createHarness({
    afterReserve: async () => {
      hExpiryRace.db.setNow("2026-11-26T12:59:58.000Z");
    },
  });
  const rExpiryRace = await runPilotDeliveryAttempt(baseInput(), hExpiryRace.ports, { safetyBufferMs: 5_000 });
  assert.equal(rExpiryRace.kind, "manual_review");
  assert.equal(hExpiryRace.counters.deliverCodes, 0);
  assert.equal(hExpiryRace.db.committedIntents.get("DEL-PILOT-1001").state, "aborted");
});

test("6. annulation avant réservation : 0 lecture FazerCards, 0 réservation, 0 POST", async () => {
  const h = createHarness({
    initialG2g: { deliveryStatus: "cancelled", deliveredQty: 0 },
  });
  const res = await runPilotDeliveryAttempt(baseInput(), h.ports);
  assert.equal(res.kind, "manual_review");
  assert.equal(h.counters.getSupplierOrder, 0);
  assert.equal(h.counters.reserveCalls, 0);
  assert.equal(h.counters.deliverCodes, 0);
});

test("7. crash / coupure avant réservation vs perte d'acquittement COMMIT vs crash après COMMIT", async () => {
  let failSupplierFirst = true;
  const hPreReserve = createHarness({
    onGetSupplierOrder: async ({ supplierState }) => {
      if (failSupplierFirst) {
        failSupplierFirst = false;
        throw new Error("FazerCards socket hang up");
      }
      return makeSupplierEnvelope(supplierState);
    },
  });
  const firstTry = await runPilotDeliveryAttempt(baseInput(), hPreReserve.ports);
  assert.equal(firstTry.kind, "failed");
  assert.equal(hPreReserve.db.committedIntents.size, 0);
  const secondTry = await runPilotDeliveryAttempt(baseInput(), hPreReserve.ports);
  assert.deepEqual(secondTry, { kind: "delivered", codes: 1 });
  assert.equal(hPreReserve.counters.deliverCodes, 1);

  // Perte d'acquittement du COMMIT (`uncertain`) : 0 POST immédiat, pas de renvoi au tour suivant
  const hLostCommit = createHarness({ failCommitOnCall: 1 });
  const uncertainRes = await runPilotDeliveryAttempt(baseInput(), hLostCommit.ports);
  assert.equal(uncertainRes.kind, "manual_review");
  assert.equal(hLostCommit.counters.deliverCodes, 0, "interdiction absolue de poster sur COMMIT incertain");
  assert.equal(hLostCommit.db.committedIntents.get("DEL-PILOT-1001").state, "dispatching");

  // Au tour suivant avant échéance, tant que G2G affiche pending (0 livré), attente sans renvoi
  const followUpBeforeExpiry = await runPilotDeliveryAttempt(baseInput(), hLostCommit.ports);
  assert.equal(followUpBeforeExpiry.kind, "awaiting_confirmation");
  assert.equal(hLostCommit.counters.deliverCodes, 0);

  // Une fois l'échéance passée avec 0 livré, escalade en manual_review sans jamais avoir posté
  hLostCommit.db.setNow("2026-11-26T13:05:00.000Z");
  const followUpAfterExpiry = await runPilotDeliveryAttempt(baseInput(), hLostCommit.ports);
  assert.equal(followUpAfterExpiry.kind, "manual_review");
  assert.equal(hLostCommit.counters.deliverCodes, 0);
  assert.equal(hLostCommit.db.committedIntents.get("DEL-PILOT-1001").state, "manual_review");
});

test("8. timeout / réponse HTTP perdue sur POST G2G -> transition unknown, 0 renvoi, réconciliation par GET", async () => {
  // 8a : le POST a livré chez G2G mais la réponse HTTP s'est perdue
  const hDeliveredBehindTimeout = createHarness({
    onDeliverCodes: async ({ deliverInput }) => {
      hDeliveredBehindTimeout.setG2gState({
        deliveredQty: deliverInput.codes.length,
        deliveryStatus: "delivered",
      });
      throw new Error("AbortError: POST G2G timed out after 15000ms");
    },
  });

  const res8a = await runPilotDeliveryAttempt(baseInput(), hDeliveredBehindTimeout.ports);
  assert.deepEqual(res8a, { kind: "delivered", codes: 1 });
  assert.equal(hDeliveredBehindTimeout.counters.deliverCodes, 1);
  assert.equal(hDeliveredBehindTimeout.db.committedIntents.get("DEL-PILOT-1001").state, "confirmed");

  // 8b : le POST timeout, G2G est encore 'in_progress' (0 livré), puis confirme au tour suivant
  const hDelayedConfirm = createHarness({
    onDeliverCodes: async () => {
      hDelayedConfirm.setG2gState({
        deliveredQty: 0,
        deliveryStatus: "in_progress",
      });
      throw new Error("ECONNRESET during POST /delivery");
    },
  });

  const firstAttempt = await runPilotDeliveryAttempt(baseInput(), hDelayedConfirm.ports);
  assert.equal(firstAttempt.kind, "awaiting_confirmation");
  assert.equal(hDelayedConfirm.counters.deliverCodes, 1);
  assert.equal(hDelayedConfirm.db.committedIntents.get("DEL-PILOT-1001").state, "unknown");

  const secondAttempt = await runPilotDeliveryAttempt(baseInput(), hDelayedConfirm.ports);
  assert.equal(secondAttempt.kind, "awaiting_confirmation");
  assert.equal(hDelayedConfirm.counters.deliverCodes, 1, "aucun renvoi sur état unknown");

  hDelayedConfirm.setG2gState({ deliveredQty: 1, deliveryStatus: "delivered" });
  const thirdAttempt = await runPilotDeliveryAttempt(baseInput(), hDelayedConfirm.ports);
  assert.deepEqual(thirdAttempt, { kind: "delivered", codes: 1 });
  assert.equal(hDelayedConfirm.counters.deliverCodes, 1);
  assert.equal(hDelayedConfirm.db.committedIntents.get("DEL-PILOT-1001").state, "confirmed");
});

test("9. livraison partielle ou incohérence de statut G2G -> manual_review immédiat, 0 renvoi", async () => {
  const hPartial = createHarness({
    onDeliverCodes: async () => {
      hPartial.setG2gState({
        requestedQty: 1,
        deliveredQty: 0,
        deliveryStatus: "partial_delivered",
      });
      return { code: "20000001", payload: { delivery_id: "DEL-PILOT-1001" } };
    },
  });

  const res = await runPilotDeliveryAttempt(baseInput(), hPartial.ports);
  assert.equal(res.kind, "manual_review");
  assert.equal(hPartial.counters.deliverCodes, 1);
  assert.equal(hPartial.db.committedIntents.get("DEL-PILOT-1001").state, "manual_review");

  const replay = await runPilotDeliveryAttempt(baseInput(), hPartial.ports);
  assert.equal(replay.kind, "manual_review");
  assert.equal(hPartial.counters.deliverCodes, 1, "aucun renvoi sur partial_delivered");
});

test("10. cas limites contrat FazerCards : processing (attente), cancelled, code vide, kind != gift_card ou ID discordant", async () => {
  const hProc = createHarness({ initialSupplier: { status: "processing", code: undefined } });
  const rProc = await runPilotDeliveryAttempt(baseInput(), hProc.ports);
  assert.equal(rProc.kind, "awaiting_codes");
  assert.equal(hProc.db.committedIntents.size, 0);
  assert.equal(hProc.counters.deliverCodes, 0);

  const hCancelled = createHarness({ initialSupplier: { status: "cancelled", code: undefined } });
  const rCancelled = await runPilotDeliveryAttempt(baseInput(), hCancelled.ports);
  assert.equal(rCancelled.kind, "manual_review");
  assert.equal(hCancelled.counters.deliverCodes, 0);

  const hTopup = createHarness({ initialSupplier: { kind: "topup", status: "completed", code: SECRET_CODE } });
  const rTopup = await runPilotDeliveryAttempt(baseInput(), hTopup.ports);
  assert.equal(rTopup.kind, "manual_review");
  assert.equal(hTopup.counters.deliverCodes, 0);

  const hBlank = createHarness({ initialSupplier: { status: "completed", code: "   " } });
  const rBlank = await runPilotDeliveryAttempt(baseInput(), hBlank.ports);
  assert.equal(rBlank.kind, "manual_review");
  assert.equal(hBlank.counters.deliverCodes, 0);

  const hMismatch = createHarness({ initialSupplier: { id: "FAZ-OTHER-999", status: "completed", code: SECRET_CODE } });
  const rMismatch = await runPilotDeliveryAttempt(baseInput(), hMismatch.ports);
  assert.equal(rMismatch.kind, "manual_review");
  assert.equal(hMismatch.counters.deliverCodes, 0);
  assertNoSecretCodeLeak(rMismatch, "discordance ID fournisseur");
});

test("11. garde-fous de périmètre : offre retirée, autre offre, qty > 1, commande synthétique et verrou production", async () => {
  assert.equal(automaticDeliveryVerified(), false, "fermé par défaut tant que les variables pilote ne sont pas armées");
  assert.equal(automaticDeliveryVerified(PILOT_CANDIDATE_OFFER_ID, "1"), true, "ouvert uniquement pour le pilote unique armé");
  assert.equal(automaticDeliveryVerified("G1795076410074VF", "1"), false, "toujours fermé pour l'offre retirée");

  const h = createHarness();
  for (const retired of RETIRED_G2G_OFFER_IDS) {
    const rRetired = await runPilotDeliveryAttempt(baseInput({ offerId: retired }), h.ports);
    assert.equal(rRetired.kind, "manual_review");
  }
  const rOtherOffer = await runPilotDeliveryAttempt(baseInput({ offerId: "G999999999999ZZ" }), h.ports);
  assert.equal(rOtherOffer.kind, "manual_review");

  const rQty2 = await runPilotDeliveryAttempt(baseInput({ requestedQty: 2 }), h.ports);
  assert.equal(rQty2.kind, "manual_review");

  const rSynthetic = await runPilotDeliveryAttempt(
    baseInput({ deliveryId: "TESTD1001" }),
    h.ports,
  );
  assert.equal(rSynthetic.kind, "manual_review");

  assert.equal(h.counters.getDeliveryStatus, 0);
  assert.equal(h.counters.getSupplierOrder, 0);
  assert.equal(h.counters.deliverCodes, 0);

  function walkTs(dir) {
    const out = [];
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) out.push(...walkTs(full));
      else if (/\.(ts|tsx|mts|mjs)$/.test(entry)) out.push(full);
    }
    return out;
  }
  const callers = walkTs("src")
    .map((f) => f.replaceAll("\\", "/"))
    .filter((f) => {
      const codeOnly = readFileSync(f, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      return /\bg2gDeliverCodes\b/.test(codeOnly);
    });
  assert.deepEqual(callers.sort(), ["src/lib/g2g-delivery.ts", "src/lib/g2g.ts"]);
});
