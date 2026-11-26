// Test manuel uniquement sur g2g-test. Aucun fournisseur, code réel ou cron.
// La chaîne de connexion n'est jamais affichée. Les écritures sont limitées
// à la table prototype existante et à des identifiants aléatoires fictifs.
import assert from "node:assert/strict";
import { randomUUID, X509Certificate } from "node:crypto";
import { readFileSync } from "node:fs";
import { rootCertificates } from "node:tls";
import { spawn } from "node:child_process";
import pg from "pg";
import { diagnosticError, safePostgresError } from "./g2g-postgres-diagnostic.mjs";
import { reserveCommittedPrototype, reserveDispatchPrototype } from "../src/lib/g2g-dispatch-reservation-prototype.ts";
import {
  RESERVE_DISPATCH_INTENT_SQL,
  buildStableDispatchReferenceId,
  readDispatchIntent,
  reserveDispatchIntentCommitted,
  transitionDispatchIntentState,
} from "../src/lib/g2g-dispatch-intent.ts";
import { PILOT_CANDIDATE_OFFER_ID } from "../src/lib/g2g-pilot.ts";
import { runPilotDeliveryAttempt } from "../src/lib/g2g-pilot-delivery-orchestrator.ts";
import { assessSupplierGiftCard } from "../src/lib/g2g-delivery-assessment.ts";
import { planDelivery } from "../src/lib/g2g-delivery-plan.ts";
import { runIsolatedDelivery } from "./g2g-isolated-delivery.mjs";

const PROJECT = "tghunxntbjtkvvmyvxwh";
function configFromEnvironment() {
  const raw = process.env.G2G_TEST_DATABASE_URL;
  if (!raw) throw diagnosticError("G2G_SECRET_MISSING");
  let url;
  try { url = new URL(raw); decodeURIComponent(url.username); decodeURIComponent(url.password); } catch { throw diagnosticError("G2G_URL_INVALID"); }
  const direct = url.hostname === `db.${PROJECT}.supabase.co` && decodeURIComponent(url.username) === "postgres";
  const pooler = /^[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname) && decodeURIComponent(url.username) === `postgres.${PROJECT}`;
  if (!(["postgres:","postgresql:"].includes(url.protocol)) || !(direct || pooler) || url.pathname !== "/postgres" || url.search || url.hash || !url.password || (url.port && !["5432","6543"].includes(url.port))) throw diagnosticError("G2G_TARGET_INVALID");
  const ca = process.env.G2G_TEST_DATABASE_CA;
  let ssl = {rejectUnauthorized:true};
  if (ca) {
    try {
      const cert = new X509Certificate(ca);
      if (!cert.ca || !/^\s*-----BEGIN CERTIFICATE-----\s+[A-Za-z0-9+/=\r\n]+\s*-----END CERTIFICATE-----\s*$/.test(ca)) throw Error();
      ssl = {rejectUnauthorized:true, ca:[...rootCertificates, ca]};
    } catch { throw diagnosticError("G2G_CA_INVALID"); }
  }
  return {host:url.hostname,port:Number(url.port || 5432),database:"postgres",user:decodeURIComponent(url.username),password:decodeURIComponent(url.password),ssl,connectionTimeoutMillis:10000,statement_timeout:10000};
}
let config;
let phase = "validation du secret";
const client = () => new pg.Client(config);
const inputFor = id => ({orderId:`integration-fake-${id}`,deliveryId:`delivery-fake-${id}`,supplierOrderId:"supplier-fake",quantity:1,expiresAt:new Date(Date.now()+3600000)});
const intentInputFor = id => ({
  orderId:`ord-intent-fake-${id}`,
  deliveryId:`del-intent-fake-${id}`,
  offerId:PILOT_CANDIDATE_OFFER_ID,
  supplierOrderId:`sup-intent-fake-${id}`,
  supplierOrderRef:`sup-intent-fake-${id}`,
  quantity:1,
  requestedQty:1,
  expiresAt:new Date(Date.now()+3600000),
});

async function child(id, mode = "prototype") {
  const db = client();
  try {
    await db.connect();
    if (mode === "intent") {
      const outcome = await reserveDispatchIntentCommitted(db, intentInputFor(id));
      assert.equal(outcome.status, "committed");
    } else {
      assert.equal(await reserveCommittedPrototype(db,inputFor(id)),"committed");
    }
    // Arrêt brutal du worker après COMMIT, sans exécuter de transport.
    process.exit(0);
  } catch { process.stderr.write("Worker de test en échec.\n"); process.exit(1); }
}
async function runChild(id, flag = "--child") {
  await new Promise((resolve,reject) => {
    const p = spawn(process.execPath,[process.argv[1],flag,id],{stdio:["ignore","ignore","ignore"],env:process.env});
    const timer = setTimeout(() => {p.kill("SIGKILL"); reject(Error("Délai du worker dépassé"));},20000);
    p.once("error",() => {clearTimeout(timer); reject(Error("Impossible de démarrer le worker"));});
    p.once("exit",code => {clearTimeout(timer); code === 0 ? resolve() : reject(Error("Worker de test en échec"));});
  });
}
async function main() {
  const ids = Array.from({length:7},() => randomUUID());
  const intentIds = Array.from({length:8},() => randomUUID());
  const [a,b,c] = [client(),client(),client()];
  let connected = false, writesAttempted = false, intentTableReady = false;
  try {
    phase = "connexion PostgreSQL";
    const connections = await Promise.allSettled([a.connect(),b.connect(),c.connect()]);
    connected = connections[2].status === "fulfilled";
    const failure = connections.find(result => result.status === "rejected");
    if (failure) throw failure.reason;
    phase = "réservations concurrentes";
    writesAttempted = true;
    // Deux connexions séparées exécutent la fonction applicative et COMMIT.
    const results = await Promise.all([reserveCommittedPrototype(a,inputFor(ids[0])),reserveCommittedPrototype(b,inputFor(ids[0]))]);
    assert.deepEqual(results.sort(),["committed","not_reserved"]);
    let result = await c.query("SELECT count(*)::int AS n FROM public.g2g_dispatch_reservation_prototype WHERE order_id = $1",[inputFor(ids[0]).orderId]);
    assert.equal(result.rows[0].n,1);
    phase = "expiration";
    // Une échéance dépassée est refusée par l'horloge PostgreSQL.
    assert.equal(await reserveCommittedPrototype(a,{...inputFor(ids[1]),expiresAt:new Date(0)}),"not_reserved");
    phase = "rollback";
    // ROLLBACK : l'intention non validée ne doit pas persister.
    await a.query("BEGIN");
    assert.equal(await reserveDispatchPrototype(a,inputFor(ids[2])),"reserved");
    await a.query("ROLLBACK");
    assert.equal(await reserveCommittedPrototype(b,inputFor(ids[2])),"committed");
    phase = "reprise après arrêt";
    // Un nouveau processus s'arrête sans nettoyage après COMMIT ; au redémarrage
    // la même réservation ne doit pas pouvoir être prise une deuxième fois.
    await runChild(ids[3]);
    assert.equal(await reserveCommittedPrototype(c,inputFor(ids[3])),"not_reserved");
    phase = "parcours simulé avec réservation PostgreSQL";
    // Les réponses et le transport sont des doubles locaux : jamais de réseau
    // fournisseur/G2G. Seule la réservation est enregistrée dans g2g-test.
    const fixture = inputFor(ids[4]);
    const remote = (status, count) => ({code:"20000001",payload:{order_id:fixture.orderId,delivery_summary:{delivery_id:fixture.deliveryId,requested_qty:1,delivered_qty:count,delivery_status:status}}});
    const supplier = status => ({ok:true,order:{id:fixture.supplierOrderId,status,...(status === "completed" ? {code:"FAKE-CODE"} : {})}});
    const plan = (status, state, remoteStatus = "pending", count = 0) => planDelivery({supplierResponse:supplier(status),g2gResponse:remote(remoteStatus,count),supplierOrderId:fixture.supplierOrderId,orderId:fixture.orderId,deliveryId:fixture.deliveryId,quantity:1,dispatchState:state,now:Date.now(),expiresAt:fixture.expiresAt.getTime()});
    assert.equal(plan("processing","not_sent"),"wait_supplier");
    assert.equal(plan("completed","not_sent"),"reserve_dispatch");
    let fakeSends = 0;
    const worker = async db => {
      const reservation = await reserveCommittedPrototype(db,fixture);
      if (reservation !== "committed") return reservation;
      // Le code fictif ne sort pas du processus et n'est jamais écrit en base.
      assert.deepEqual(assessSupplierGiftCard(supplier("completed"),fixture.supplierOrderId,1),{kind:"ready",codes:["FAKE-CODE"]});
      fakeSends++;
      return "fake_ack";
    };
    assert.deepEqual((await Promise.all([worker(a),worker(b)])).sort(),["fake_ack","not_reserved"]);
    assert.equal(fakeSends,1);
    assert.equal(await worker(a),"not_reserved");
    assert.equal(plan("completed","acknowledged"),"check_delivery");
    assert.equal(plan("completed","acknowledged","delivered",1),"confirmed");
    // Timeout fictif : même après résultat incertain, le claim persiste et un
    // traitement répété n'est pas autorisé à simuler un nouvel envoi.
    const timeoutFixture = inputFor(ids[5]);
    assert.equal(await reserveCommittedPrototype(a,timeoutFixture),"committed");
    let timeoutFakeSends = 1;
    if (await reserveCommittedPrototype(b,timeoutFixture) === "committed") timeoutFakeSends++;
    assert.equal(timeoutFakeSends,1);
    assert.equal(plan("completed","unknown"),"check_delivery");
    assert.equal(plan("completed","unknown","partial_delivered",0),"manual_review");
    phase = "orchestrateur isolé avec réservation PostgreSQL";
    const labFixture = inputFor(ids[6]);
    const labRemote = (state, count = 0) => ({code:"20000001",payload:{order_id:labFixture.orderId,delivery_summary:{delivery_id:labFixture.deliveryId,requested_qty:1,delivered_qty:count,delivery_status:state}}});
    const labInput = {...labFixture,expiresAt:labFixture.expiresAt.getTime(),dispatchState:"not_sent"};
    let labSends = 0;
    const labPorts = db => ({
      now:() => Date.now(),
      readDelivery:async () => labRemote("pending"),
      readSupplier:async () => ({ok:true,order:{id:labFixture.supplierOrderId,status:"completed",code:"FAKE-CODE"}}),
      reserve:async value => reserveCommittedPrototype(db,value),
      readFreshOrder:async () => ({active:true,delivery:labRemote("pending")}),
      sendFake:async ({codes}) => {assert.deepEqual(codes,["FAKE-CODE"]); labSends++;},
    });
    assert.deepEqual((await Promise.all([runIsolatedDelivery(labInput,labPorts(a)),runIsolatedDelivery(labInput,labPorts(b))])).sort(),["check_delivery","manual_review"]);
    assert.equal(labSends,1);
    assert.equal(await runIsolatedDelivery(labInput,labPorts(a)),"manual_review");
    assert.equal(labSends,1);
    assert.equal(await runIsolatedDelivery({...labInput,dispatchState:"unknown"},{...labPorts(c),readDelivery:async () => labRemote("delivered",1)}),"confirmed");

    phase = "migration g2g_dispatch_intents et droits RLS sur g2g-test";
    // Garantit la présence de g2g_deliveries sur g2g-test avant d'appliquer tel quel le brouillon SQL.
    await a.query(`
      CREATE TABLE IF NOT EXISTS public.g2g_deliveries (
        id SERIAL PRIMARY KEY,
        order_id TEXT NOT NULL,
        delivery_id TEXT NOT NULL UNIQUE,
        offer_id TEXT NOT NULL,
        product_key TEXT NOT NULL,
        requested_qty INTEGER NOT NULL,
        unit_price NUMERIC(12, 4),
        supplier_order_ref TEXT,
        supplier_cost_usd NUMERIC(12, 4),
        status TEXT NOT NULL DEFAULT 'pending',
        detail TEXT,
        delivery_attempts INTEGER NOT NULL DEFAULT 0,
        next_attempt_at TIMESTAMPTZ,
        delivery_claimed_at TIMESTAMPTZ,
        delivered_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `);
    const migrationSql = readFileSync("docs/sql/g2g-dispatch-intent-migration-draft.sql", "utf8");
    await a.query(migrationSql);
    await a.query(`
      DO $$ BEGIN
        ALTER TABLE public.g2g_dispatch_intents
          ADD CONSTRAINT g2g_dispatch_intents_no_retired_offer
          CHECK (upper(btrim(offer_id)) <> 'G1795076410074VF');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    intentTableReady = true;

    const rlsCheck = await c.query(
      "SELECT relrowsecurity FROM pg_class WHERE oid = 'public.g2g_dispatch_intents'::regclass",
    );
    assert.equal(rlsCheck.rows[0]?.relrowsecurity, true);

    const privCheck = await c.query(`
      SELECT
        has_table_privilege('anon', 'public.g2g_dispatch_intents', 'SELECT') AS anon_select,
        has_table_privilege('anon', 'public.g2g_dispatch_intents', 'INSERT') AS anon_insert,
        has_table_privilege('authenticated', 'public.g2g_dispatch_intents', 'SELECT') AS auth_select,
        has_table_privilege('authenticated', 'public.g2g_dispatch_intents', 'INSERT') AS auth_insert
    `);
    assert.deepEqual(privCheck.rows[0], {
      anon_select: false,
      anon_insert: false,
      auth_select: false,
      auth_insert: false,
    });

    const colCheck = await c.query(`
      SELECT data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'g2g_deliveries' AND column_name = 'expires_at'
    `);
    assert.equal(colCheck.rows[0]?.data_type, "timestamp with time zone");

    phase = "contrainte offre retirée et concurrence g2g_dispatch_intents";
    let retiredConstraintRejected = false;
    try {
      await a.query(
        `INSERT INTO public.g2g_dispatch_intents
          (order_id, delivery_id, offer_id, supplier_order_id, quantity, reference_id, expires_at, state)
         VALUES ($1, $2, 'G1795076410074VF', 'sup-retired', 1, $3, now() + interval '1 hour', 'dispatching')`,
        [`ord-ret-${intentIds[0]}`, `del-ret-${intentIds[0]}`, `g2g-ref-retired-${intentIds[0].slice(0, 16)}`],
      );
    } catch (e) {
      retiredConstraintRejected = e?.code === "23514";
    }
    assert.equal(retiredConstraintRejected, true);

    // Concurrence réelle PostgreSQL sur g2g_dispatch_intents
    const concFixture = intentInputFor(intentIds[1]);
    const concRes = await Promise.all([
      reserveDispatchIntentCommitted(a, concFixture),
      reserveDispatchIntentCommitted(b, concFixture),
    ]);
    assert.deepEqual(concRes.map(r => r.status).sort(), ["committed", "not_reserved"]);
    const countConc = await c.query(
      "SELECT count(*)::int AS n FROM public.g2g_dispatch_intents WHERE delivery_id = $1",
      [concFixture.deliveryId],
    );
    assert.equal(countConc.rows[0].n, 1);

    phase = "expiration clock_timestamp et rollback g2g_dispatch_intents";
    const expRes = await reserveDispatchIntentCommitted(a, {
      ...intentInputFor(intentIds[2]),
      expiresAt: new Date(0),
    });
    assert.deepEqual(expRes, { status: "not_reserved" });

    const rbFixture = intentInputFor(intentIds[3]);
    const rbRef = buildStableDispatchReferenceId(rbFixture.orderId, rbFixture.deliveryId);
    await a.query("BEGIN");
    const rbIns = await a.query(RESERVE_DISPATCH_INTENT_SQL, [
      rbFixture.orderId,
      rbFixture.deliveryId,
      rbFixture.offerId,
      rbFixture.supplierOrderId,
      1,
      rbRef,
      rbFixture.expiresAt,
    ]);
    assert.equal(rbIns.rows.length, 1);
    await a.query("ROLLBACK");
    const rbAfter = await reserveDispatchIntentCommitted(b, rbFixture);
    assert.equal(rbAfter.status, "committed");

    phase = "arrêt brutal worker et orchestrateur pilote sur PostgreSQL";
    await runChild(intentIds[4], "--child-intent");
    const crashedFixture = intentInputFor(intentIds[4]);
    let crashFakePosts = 0;
    let crashedRemoteStatus = "pending";
    let crashedDeliveredQty = 0;
    const makePgPilotPorts = (txConn, hooks = {}) => ({
      now: () => Date.now(),
      readDispatchIntent: (exp) => readDispatchIntent(c, exp),
      reserveDispatchIntent: (inp) => reserveDispatchIntentCommitted(txConn, inp),
      transitionDispatchIntent: (ti) => transitionDispatchIntentState(c, ti),
      getDeliveryStatus: async (orderId, deliveryId) => ({
        code: "20000001",
        payload: {
          order_id: orderId,
          offer_id: PILOT_CANDIDATE_OFFER_ID,
          delivery_summary: {
            delivery_id: deliveryId,
            requested_qty: 1,
            delivered_qty: hooks.getDeliveredQty ? hooks.getDeliveredQty() : crashedDeliveredQty,
            delivery_status: hooks.getStatus ? hooks.getStatus() : crashedRemoteStatus,
          },
        },
      }),
      getSupplierOrder: async (supId) => ({
        ok: true,
        order: {
          id: supId,
          kind: "gift_card",
          status: "completed",
          code: "FAKE-TEST-CODE-ONLY",
        },
      }),
      deliverCodes: async (payload) => {
        if (hooks.onPost) return hooks.onPost(payload);
        crashFakePosts += 1;
        return { code: "20000001", payload: { delivery_id: payload.deliveryId } };
      },
    });

    // Après crash post-COMMIT, aucun second envoi pendant que l'état distant est pending
    const afterCrashPending = await runPilotDeliveryAttempt(crashedFixture, makePgPilotPorts(a));
    assert.equal(afterCrashPending.kind, "awaiting_confirmation");
    assert.equal(crashFakePosts, 0);

    // Si G2G confirme l'état livré, l'intention passe en confirmed sans nouvel envoi
    crashedRemoteStatus = "delivered";
    crashedDeliveredQty = 1;
    const afterCrashConfirmed = await runPilotDeliveryAttempt(crashedFixture, makePgPilotPorts(a));
    assert.deepEqual(afterCrashConfirmed, { kind: "delivered", codes: 1 });
    assert.equal(crashFakePosts, 0);

    // Concurrence de bout en bout de runPilotDeliveryAttempt sur PostgreSQL réel
    const e2eConc = intentInputFor(intentIds[5]);
    let e2ePosts = 0;
    let e2eStatus = "pending";
    let e2eQty = 0;
    const e2eHooks = {
      getStatus: () => e2eStatus,
      getDeliveredQty: () => e2eQty,
      onPost: async (payload) => {
        e2ePosts += 1;
        e2eStatus = "delivered";
        e2eQty = 1;
        return { code: "20000001", payload: { delivery_id: payload.deliveryId } };
      },
    };
    const [w1, w2] = await Promise.all([
      runPilotDeliveryAttempt(e2eConc, makePgPilotPorts(a, e2eHooks)),
      runPilotDeliveryAttempt(e2eConc, makePgPilotPorts(b, e2eHooks)),
    ]);
    assert.equal(e2ePosts, 1);
    assert.equal([w1.kind, w2.kind].includes("delivered"), true);

    // Annulation entre COMMIT et envoi -> état PostgreSQL aborted, 0 envoi
    const cancelRace = intentInputFor(intentIds[6]);
    let cancelPosts = 0;
    let cancelStatusCalls = 0;
    const cancelPorts = {
      ...makePgPilotPorts(a, {
        getStatus: () => {
          cancelStatusCalls += 1;
          return cancelStatusCalls === 1 ? "pending" : "cancelled";
        },
        getDeliveredQty: () => 0,
        onPost: async () => { cancelPosts += 1; return {}; },
      }),
    };
    const cancelRes = await runPilotDeliveryAttempt(cancelRace, cancelPorts);
    assert.equal(cancelRes.kind, "manual_review");
    assert.equal(cancelPosts, 0);
    const cancelRow = await c.query(
      "SELECT state FROM public.g2g_dispatch_intents WHERE delivery_id = $1",
      [cancelRace.deliveryId],
    );
    assert.equal(cancelRow.rows[0]?.state, "aborted");

    // Timeout sur envoi -> état PostgreSQL unknown -> reprise sans nouvel envoi -> confirmed
    const timeoutIntent = intentInputFor(intentIds[7]);
    let timeoutPosts = 0;
    let timeoutRemoteStatus = "pending";
    let timeoutRemoteQty = 0;
    const timeoutHooks = {
      getStatus: () => timeoutRemoteStatus,
      getDeliveredQty: () => timeoutRemoteQty,
      onPost: async () => {
        timeoutPosts += 1;
        timeoutRemoteStatus = "in_progress";
        throw new Error("Simulated transport timeout");
      },
    };
    const tFirst = await runPilotDeliveryAttempt(timeoutIntent, makePgPilotPorts(a, timeoutHooks));
    assert.equal(tFirst.kind, "awaiting_confirmation");
    assert.equal(timeoutPosts, 1);
    const unknownRow = await c.query(
      "SELECT state FROM public.g2g_dispatch_intents WHERE delivery_id = $1",
      [timeoutIntent.deliveryId],
    );
    assert.equal(unknownRow.rows[0]?.state, "unknown");

    timeoutRemoteStatus = "delivered";
    timeoutRemoteQty = 1;
    const tRecovered = await runPilotDeliveryAttempt(timeoutIntent, makePgPilotPorts(a, timeoutHooks));
    assert.deepEqual(tRecovered, { kind: "delivered", codes: 1 });
    assert.equal(timeoutPosts, 1);
    const confirmedRow = await c.query(
      "SELECT state FROM public.g2g_dispatch_intents WHERE delivery_id = $1",
      [timeoutIntent.deliveryId],
    );
    assert.equal(confirmedRow.rows[0]?.state, "confirmed");

    process.stdout.write("OK : concurrence, expiration, rollback, arrêt, RLS et orchestrateur pilote sur PostgreSQL g2g-test. Aucun transport réel.\n");
  } finally {
    // Suppression uniquement des lignes aléatoires créées par cette exécution.
    if (writesAttempted && connected) {
      try {
        await c.query("DELETE FROM public.g2g_dispatch_reservation_prototype WHERE order_id = ANY($1::text[])",[ids.map(id => inputFor(id).orderId)]);
        if (intentTableReady) {
          await c.query("DELETE FROM public.g2g_dispatch_intents WHERE order_id = ANY($1::text[])",[intentIds.map(id => intentInputFor(id).orderId)]);
        }
      }
      catch { process.stderr.write("Nettoyage des données fictives impossible ; vérifier la table de test.\n"); process.exitCode = 1; }
    }
    await Promise.allSettled([a.end(),b.end(),c.end()]);
  }
}
try {
  config = configFromEnvironment();
  if (process.argv[2] === "--child") await child(process.argv[3], "prototype");
  else if (process.argv[2] === "--child-intent") await child(process.argv[3], "intent");
  else await main();
} catch (error) {
  // Seules la phase prédéfinie et une catégorie de la liste blanche sont affichées.
  process.stderr.write(`Échec à l’étape ${phase}. ${safePostgresError(error)}\n`);
  process.exitCode = 1;
}
