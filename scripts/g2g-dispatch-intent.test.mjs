#!/usr/bin/env node
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
  READ_DISPATCH_INTENT_SQL,
  RESERVE_DISPATCH_INTENT_SQL,
  TRANSITION_DISPATCH_INTENT_SQL,
  buildStableDispatchReferenceId,
  canTransitionDispatchIntentState,
  parseG2gExpiresAt,
  readDispatchIntent,
  reserveDispatchIntentCommitted,
  transitionDispatchIntentState,
} from "../src/lib/g2g-dispatch-intent.ts";

const root = process.cwd();
const read = (p) => readFileSync(join(root, p), "utf8");

function listSourceFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...listSourceFiles(full));
    else if (/\.(ts|tsx|js|mjs)$/.test(entry)) out.push(full);
  }
  return out;
}

test("règles d'appelants strictes sur g2gPatchOffer et g2gDeliverCodes dans tout src/", () => {
  const allowedPatchFiles = new Set([
    "src/lib/g2g.ts",
    "src/app/api/admin/g2g/offer-qty/route.ts",
    "src/lib/g2g-stock-price.ts",
  ]);
  const allowedDeliverFiles = new Set([
    "src/lib/g2g.ts",
    "src/lib/g2g-delivery.ts",
  ]);

  for (const file of listSourceFiles(join(root, "src"))) {
    const rel = relative(root, file).replace(/\\/g, "/");
    const content = readFileSync(file, "utf8");
    // On retire les commentaires pour tester les usages réels.
    const codeOnly = content
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

    if (/\bg2gPatchOffer\b/.test(codeOnly)) {
      assert.ok(
        allowedPatchFiles.has(rel),
        `g2gPatchOffer interdit dans ${rel}`,
      );
    }
    if (/\bg2gDeliverCodes\b/.test(codeOnly)) {
      assert.ok(
        allowedDeliverFiles.has(rel),
        `g2gDeliverCodes interdit dans ${rel}`,
      );
    }
  }

  // Dans g2g-delivery.ts, g2gDeliverCodes est strictement en aval de automaticDeliveryVerified() === false.
  const deliverySrc = read("src/lib/g2g-delivery.ts");
  const verifiedGate = deliverySrc.indexOf("if (!automaticDeliveryVerified())");
  const deliverCall = deliverySrc.lastIndexOf("g2gDeliverCodes(");
  assert.ok(verifiedGate > 0 && deliverCall > verifiedGate);

  // L'ancien PATCH /api/admin/g2g répond 405 et renvoie vers /api/admin/g2g/offer-qty.
  const adminRoute = read("src/app/api/admin/g2g/route.ts");
  const patchIndex = adminRoute.indexOf("export async function PATCH(");
  assert.ok(patchIndex > 0);
  const patchBody = adminRoute.slice(patchIndex);
  assert.match(patchBody, /status:\s*405/);
  assert.match(patchBody, /\/api\/admin\/g2g\/offer-qty/);
});

test("horaires vercel.json et règles de paiement manuel préservés", () => {
  const vercel = JSON.parse(read("vercel.json"));
  const byPath = Object.fromEntries(vercel.crons.map((c) => [c.path, c.schedule]));
  assert.equal(byPath["/api/cron/g2g-delivery"], "* * * * *");
  assert.equal(byPath["/api/cron/g2g-stock-price"], "0 6 * * *");

  const hours = read("src/lib/manual-payment-hours.ts");
  assert.match(hours, /timeZone:\s*"Africa\/Tripoli"/);
  assert.match(hours, /hour < 9/);
});

test("brouillon SQL durable : complet, sans code ni secret, et non exécuté en production", () => {
  const sql = read("docs/sql/g2g-dispatch-intent-migration-draft.sql");
  const sqlNoComments = sql.replace(/--.*$/gm, "");
  assert.match(sqlNoComments, /ALTER TABLE g2g_deliveries\s+ADD COLUMN IF NOT EXISTS expires_at timestamptz/i);
  assert.match(sqlNoComments, /CREATE TABLE IF NOT EXISTS g2g_dispatch_intents/i);
  assert.match(sqlNoComments, /PRIMARY KEY \(order_id, delivery_id\)/i);
  assert.match(sqlNoComments, /delivery_id text NOT NULL UNIQUE/i);
  assert.match(sqlNoComments, /reference_id text NOT NULL UNIQUE/i);
  assert.match(sqlNoComments, /ENABLE ROW LEVEL SECURITY/i);
  assert.match(sqlNoComments, /REVOKE ALL ON TABLE g2g_dispatch_intents FROM anon, authenticated/i);
  assert.doesNotMatch(sqlNoComments, /\b(gift_code|codes_cipher|code_content|secret_key|api_key)\b/i);

  // Non exécuté automatiquement en production sans accord explicite.
  const dbIndex = read("src/db/index.ts");
  assert.doesNotMatch(dbIndex, /g2g_dispatch_intents/);
  const deliverySrc = read("src/lib/g2g-delivery.ts");
  const gateIdx = deliverySrc.indexOf("if (!automaticDeliveryVerified())");
  const readIdx = deliverySrc.indexOf("readDispatchIntent(");
  assert.ok(gateIdx > 0 && readIdx > gateIdx);
});

test("parseG2gExpiresAt : refuse 0, valeurs négatives ou invalides", () => {
  assert.equal(parseG2gExpiresAt(0), null);
  assert.equal(parseG2gExpiresAt(-1000), null);
  assert.equal(parseG2gExpiresAt(NaN), null);
  assert.equal(parseG2gExpiresAt(1.5), null);
  assert.equal(parseG2gExpiresAt("1700000000000"), null);
  assert.equal(parseG2gExpiresAt(null), null);
  const valid = parseG2gExpiresAt(1795651200000);
  assert.ok(valid instanceof Date);
  assert.equal(valid.getTime(), 1795651200000);
});

test("buildStableDispatchReferenceId : déterministe, borné, sûr et distinct par commande/livraison", () => {
  const ref1 = buildStableDispatchReferenceId("1795521210943-1", "D1795521210999");
  const ref2 = buildStableDispatchReferenceId("1795521210943-1", "D1795521210999");
  const refOtherOrder = buildStableDispatchReferenceId("1795521210943-2", "D1795521210999");
  assert.ok(ref1);
  assert.equal(ref1, ref2);
  assert.notEqual(ref1, refOtherOrder);
  assert.match(ref1, /^g2g-ref-[A-Za-z0-9_-]+-[0-9a-f]{16}$/);
  assert.ok(ref1.length >= 16 && ref1.length <= 64);

  assert.equal(buildStableDispatchReferenceId("", "D1"), null);
  assert.equal(buildStableDispatchReferenceId("O1", "bad id"), null);
  assert.equal(buildStableDispatchReferenceId("O1\n", "D1"), null);
});

test("machine d'états monotone : aucun retour en arrière ni réémission", () => {
  assert.equal(canTransitionDispatchIntentState("dispatching", "acknowledged"), true);
  assert.equal(canTransitionDispatchIntentState("dispatching", "unknown"), true);
  assert.equal(canTransitionDispatchIntentState("dispatching", "aborted"), true);
  assert.equal(canTransitionDispatchIntentState("dispatching", "confirmed"), true);
  assert.equal(canTransitionDispatchIntentState("dispatching", "manual_review"), true);

  assert.equal(canTransitionDispatchIntentState("acknowledged", "confirmed"), true);
  assert.equal(canTransitionDispatchIntentState("acknowledged", "manual_review"), true);
  assert.equal(canTransitionDispatchIntentState("unknown", "confirmed"), true);
  assert.equal(canTransitionDispatchIntentState("unknown", "manual_review"), true);

  for (const from of ["dispatching", "acknowledged", "unknown", "aborted", "confirmed", "manual_review"]) {
    assert.equal(canTransitionDispatchIntentState(from, "dispatching"), false);
  }
  for (const terminal of ["aborted", "confirmed", "manual_review"]) {
    for (const to of ["dispatching", "acknowledged", "unknown", "aborted", "confirmed", "manual_review"]) {
      assert.equal(canTransitionDispatchIntentState(terminal, to), false);
    }
  }
});

function createFakeStore({ nowMs = 1_000_000 } = {}) {
  const rowsByDelivery = new Map();
  // Modélise le verrou d'index unique PostgreSQL posé dès l'INSERT jusqu'au COMMIT/ROLLBACK.
  const inflightLocks = new Map();

  function makeClient({ failInsert = false, failCommit = false } = {}) {
    let staged = null;
    let releaseStagedLock = null;
    const log = [];
    return {
      log,
      async query(sql, params) {
        if (sql === "BEGIN") {
          log.push("BEGIN");
          staged = null;
          return { rows: [] };
        }
        if (sql === "ROLLBACK") {
          log.push("ROLLBACK");
          staged = null;
          if (releaseStagedLock) {
            const release = releaseStagedLock;
            releaseStagedLock = null;
            release();
          }
          return { rows: [] };
        }
        if (sql === "COMMIT") {
          log.push("COMMIT");
          if (staged) {
            rowsByDelivery.set(staged.delivery_id, staged);
            staged = null;
          }
          if (releaseStagedLock) {
            const release = releaseStagedLock;
            releaseStagedLock = null;
            release();
          }
          if (failCommit) throw new Error("lost commit ack");
          return { rows: [] };
        }
        if (sql === RESERVE_DISPATCH_INTENT_SQL) {
          log.push("INSERT");
          if (failInsert) throw new Error("db error");
          const [orderId, deliveryId, offerId, supplierOrderId, quantity, referenceId, expiresAt] = params;
          if (expiresAt.getTime() <= nowMs) return { rows: [] };
          while (inflightLocks.has(deliveryId)) {
            await inflightLocks.get(deliveryId);
          }
          const duplicateRef = [...rowsByDelivery.values()].some((r) => r.reference_id === referenceId);
          if (rowsByDelivery.has(deliveryId) || duplicateRef) return { rows: [] };
          let unlock;
          const lockPromise = new Promise((resolve) => {
            unlock = resolve;
          });
          inflightLocks.set(deliveryId, lockPromise);
          releaseStagedLock = () => {
            inflightLocks.delete(deliveryId);
            unlock();
          };
          staged = {
            order_id: orderId,
            delivery_id: deliveryId,
            offer_id: offerId,
            supplier_order_id: supplierOrderId,
            quantity,
            reference_id: referenceId,
            expires_at: expiresAt,
            state: "dispatching",
            last_detail: null,
          };
          return { rows: [{ ...staged }] };
        }
        if (sql === READ_DISPATCH_INTENT_SQL) {
          const [deliveryId] = params;
          const row = rowsByDelivery.get(deliveryId);
          return { rows: row ? [{ ...row }] : [] };
        }
        if (sql === TRANSITION_DISPATCH_INTENT_SQL) {
          const [orderId, deliveryId, toState, fromStates, detail] = params;
          const row = rowsByDelivery.get(deliveryId);
          if (!row || row.order_id !== orderId || !fromStates.includes(row.state)) {
            return { rows: [] };
          }
          row.state = toState;
          row.last_detail = detail;
          return { rows: [{ state: row.state }] };
        }
        throw new Error(`Unexpected SQL: ${sql}`);
      },
    };
  }
  return { rowsByDelivery, makeClient };
}

test("réservation durable simulée : concurrence, expiration, offre retirée, commit incertain et transitions", async () => {
  const baseInput = {
    orderId: "order-fake-1",
    deliveryId: "delivery-fake-1",
    offerId: "G1795521210943KM",
    supplierOrderId: "ord-fake-1",
    quantity: 1,
    expiresAt: new Date(2_000_000),
  };

  // Offre retirée refusée avant tout SQL.
  const store0 = createFakeStore();
  const c0 = store0.makeClient();
  const retired = await reserveDispatchIntentCommitted(c0, {
    ...baseInput,
    offerId: "G1795076410074VF",
  });
  assert.deepEqual(retired, { status: "invalid", reason: "retired_offer" });
  assert.equal(c0.log.length, 0);

  // Échéance dépassée refusée par l'horloge de base.
  const expired = await reserveDispatchIntentCommitted(c0, {
    ...baseInput,
    expiresAt: new Date(1_000_000),
  });
  assert.deepEqual(expired, { status: "not_reserved" });

  // Deux réservations concurrentes : une seule passe en committed, l'autre en not_reserved.
  const store = createFakeStore();
  const [r1, r2] = await Promise.all([
    reserveDispatchIntentCommitted(store.makeClient(), baseInput),
    reserveDispatchIntentCommitted(store.makeClient(), baseInput),
  ]);
  const statuses = [r1.status, r2.status].sort();
  assert.deepEqual(statuses, ["committed", "not_reserved"]);
  const winner = r1.status === "committed" ? r1 : r2;
  assert.equal(
    winner.referenceId,
    buildStableDispatchReferenceId(baseInput.orderId, baseInput.deliveryId),
  );

  // Lecture cohérente vs incohérence d'identité.
  const reader = store.makeClient();
  const found = await readDispatchIntent(reader, baseInput);
  assert.equal(found.kind, "found");
  assert.equal(found.intent.state, "dispatching");
  assert.equal(found.intent.referenceId, winner.referenceId);

  const corrupt = await readDispatchIntent(reader, {
    ...baseInput,
    supplierOrderId: "ord-different",
  });
  assert.deepEqual(corrupt, { kind: "corrupt", reason: "identity_mismatch" });

  // Transition vers unknown (timeout POST) puis interdiction de revenir à dispatching.
  assert.equal(
    await transitionDispatchIntentState(reader, {
      orderId: baseInput.orderId,
      deliveryId: baseInput.deliveryId,
      fromStates: ["dispatching"],
      toState: "unknown",
      detail: "Timeout POST G2G ; lecture statut requise.",
    }),
    "updated",
  );
  assert.equal(
    await transitionDispatchIntentState(reader, {
      orderId: baseInput.orderId,
      deliveryId: baseInput.deliveryId,
      fromStates: ["unknown"],
      toState: "dispatching",
    }),
    "forbidden",
  );
  assert.equal(
    await transitionDispatchIntentState(reader, {
      orderId: baseInput.orderId,
      deliveryId: baseInput.deliveryId,
      fromStates: ["unknown"],
      toState: "confirmed",
      detail: "Confirmé par GET statut G2G.",
    }),
    "updated",
  );

  // Commit perdu : retourne uncertain (même si la ligne a été commitée côté base), jamais d'envoi.
  const storeUncertain = createFakeStore();
  const clientLostCommit = storeUncertain.makeClient({ failCommit: true });
  const uncertain = await reserveDispatchIntentCommitted(clientLostCommit, baseInput);
  assert.deepEqual(uncertain, { status: "uncertain" });
  assert.equal(clientLostCommit.log.at(-1), "ROLLBACK");
  // Et une reprise ultérieure constate que la ligne existe déjà !
  const checkAfterCrash = await readDispatchIntent(storeUncertain.makeClient(), baseInput);
  assert.equal(checkAfterCrash.kind, "found");
  assert.equal(checkAfterCrash.intent.state, "dispatching");
});
