// Test manuel uniquement sur g2g-test. Aucun fournisseur, code réel ou cron.
// La chaîne de connexion n'est jamais affichée. Les écritures sont limitées
// à la table prototype existante et à des identifiants aléatoires fictifs.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import pg from "pg";
import { diagnosticError, safePostgresError } from "./g2g-postgres-diagnostic.mjs";
import { reserveCommittedPrototype, reserveDispatchPrototype } from "../src/lib/g2g-dispatch-reservation-prototype.ts";

const PROJECT = "tghunxntbjtkvvmyvxwh";
function configFromEnvironment() {
  const raw = process.env.G2G_TEST_DATABASE_URL;
  if (!raw) throw diagnosticError("G2G_SECRET_MISSING");
  let url;
  try { url = new URL(raw); decodeURIComponent(url.username); decodeURIComponent(url.password); } catch { throw diagnosticError("G2G_URL_INVALID"); }
  const direct = url.hostname === `db.${PROJECT}.supabase.co` && decodeURIComponent(url.username) === "postgres";
  const pooler = /^[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname) && decodeURIComponent(url.username) === `postgres.${PROJECT}`;
  if (!(["postgres:","postgresql:"].includes(url.protocol)) || !(direct || pooler) || url.pathname !== "/postgres" || url.search || url.hash || !url.password || (url.port && !["5432","6543"].includes(url.port))) throw diagnosticError("G2G_TARGET_INVALID");
  return {host:url.hostname,port:Number(url.port || 5432),database:"postgres",user:decodeURIComponent(url.username),password:decodeURIComponent(url.password),ssl:{rejectUnauthorized:true},connectionTimeoutMillis:10000,statement_timeout:10000};
}
let config;
let phase = "validation du secret";
const client = () => new pg.Client(config);
const inputFor = id => ({orderId:`integration-fake-${id}`,deliveryId:`delivery-fake-${id}`,supplierOrderId:"supplier-fake",quantity:1,expiresAt:new Date(Date.now()+3600000)});

async function child(id) {
  const db = client();
  try {
    await db.connect();
    assert.equal(await reserveCommittedPrototype(db,inputFor(id)),"committed");
    // Arrêt brutal du worker après COMMIT, sans exécuter de transport.
    process.exit(0);
  } catch { process.stderr.write("Worker de test en échec.\n"); process.exit(1); }
}
async function runChild(id) {
  await new Promise((resolve,reject) => {
    const p = spawn(process.execPath,[process.argv[1],"--child",id],{stdio:["ignore","ignore","ignore"],env:process.env});
    const timer = setTimeout(() => {p.kill("SIGKILL"); reject(Error("Délai du worker dépassé"));},20000);
    p.once("error",() => {clearTimeout(timer); reject(Error("Impossible de démarrer le worker"));});
    p.once("exit",code => {clearTimeout(timer); code === 0 ? resolve() : reject(Error("Worker de test en échec"));});
  });
}
async function main() {
  const ids = Array.from({length:4},() => randomUUID());
  const [a,b,c] = [client(),client(),client()];
  let connected = false, writesAttempted = false;
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
    process.stdout.write("OK : concurrence, expiration, rollback et reprise après arrêt du worker. Aucun transport réel.\n");
  } finally {
    // Suppression uniquement des lignes aléatoires créées par cette exécution.
    if (writesAttempted && connected) {
      try { await c.query("DELETE FROM public.g2g_dispatch_reservation_prototype WHERE order_id = ANY($1::text[])",[ids.map(id => inputFor(id).orderId)]); }
      catch { process.stderr.write("Nettoyage des données fictives impossible ; vérifier la table de test.\n"); process.exitCode = 1; }
    }
    await Promise.allSettled([a.end(),b.end(),c.end()]);
  }
}
try {
  config = configFromEnvironment();
  if (process.argv[2] === "--child") await child(process.argv[3]);
  else await main();
} catch (error) {
  // Seules la phase prédéfinie et une catégorie de la liste blanche sont affichées.
  process.stderr.write(`Échec à l’étape ${phase}. ${safePostgresError(error)}\n`);
  process.exitCode = 1;
}
