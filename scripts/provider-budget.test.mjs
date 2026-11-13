import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  PROVIDER_BUDGET_DEFAULTS,
  RECONCILE_BACKOFF_MS,
  decideProviderBudget,
  decideReconcileThrottle,
  reconcileIntervalMs,
  stepForAge,
} from "../src/lib/provider-budget-core.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8");
/** Retire les commentaires : on teste le code, pas la prose. */
const code = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const NOW = 1_800_000_000_000;

/* ------------------------- Throttle par commande ------------------------- */

test("une commande jamais synchronisée interroge le fournisseur aussitôt", () => {
  const decision = decideReconcileThrottle({ lastSyncAt: null, now: NOW });
  assert.equal(decision.sync, true);
  assert.equal(decision.waitMs, 0);
});

test("deuxième affichage immédiat : pas d'appel sortant", () => {
  const decision = decideReconcileThrottle({
    lastSyncAt: NOW - 2_000, // 2 s après une synchro
    since: NOW - 2_000,
    now: NOW,
  });
  assert.equal(decision.sync, false);
  assert.ok(decision.waitMs > 0, "un délai d'attente est annoncé");
});

test("le premier palier laisse passer au bout de 30 s", () => {
  const tooEarly = decideReconcileThrottle({
    lastSyncAt: NOW - 29_000,
    since: NOW - 29_000,
    now: NOW,
  });
  const onTime = decideReconcileThrottle({
    lastSyncAt: NOW - 30_000,
    since: NOW - 30_000,
    now: NOW,
  });
  assert.equal(tooEarly.sync, false);
  assert.equal(onTime.sync, true);
});

test("l'intervalle s'allonge avec l'âge de la commande", () => {
  const ages = [0, 90_000, 240_000, 600_000, 7_200_000];
  const intervals = ages.map((age) => reconcileIntervalMs(age));
  for (let index = 1; index < intervals.length; index += 1) {
    assert.ok(
      intervals[index] > intervals[index - 1],
      `${intervals[index - 1]} → ${intervals[index]} doit augmenter`,
    );
  }
  // Plafond : jamais plus de 10 minutes entre deux interrogations.
  assert.ok(intervals.at(-1) <= 600_000);
});

test("la rampe de backoff reste courte au démarrage", () => {
  // Un client qui vient de payer regarde sa page : on doit rester réactif.
  assert.ok(RECONCILE_BACKOFF_MS[0] <= 30_000);
  assert.ok(stepForAge(0) === 0);
});

test("un créneau expiré est de nouveau disponible", () => {
  const age = 7_200_000; // commande vieille de 2 h → palier 10 min
  const decision = decideReconcileThrottle({
    lastSyncAt: NOW - 605_000,
    since: NOW - age,
    now: NOW,
  });
  assert.equal(decision.sync, true);
  assert.equal(decision.step, RECONCILE_BACKOFF_MS.length - 1);
});

test("une horloge incohérente ne fige pas la commande", () => {
  // `last_sync_at` dans le futur (instance redémarrée, réglage système) : on
  // autorise l'appel plutôt que de bloquer indéfiniment le suivi.
  const decision = decideReconcileThrottle({
    lastSyncAt: NOW + 3_600_000,
    since: NOW - 1_000,
    now: NOW,
  });
  assert.equal(decision.sync, true);
});

test("aucune valeur absurde ne provoque d'exception", () => {
  for (const lastSyncAt of [undefined, null, 0, Number.NaN, -1]) {
    const decision = decideReconcileThrottle({ lastSyncAt, now: NOW });
    assert.equal(typeof decision.sync, "boolean");
    assert.ok(Number.isFinite(decision.waitMs));
  }
});

test("le throttle est sans état : mêmes entrées, même décision", () => {
  const input = { lastSyncAt: NOW - 45_000, since: NOW - 45_000, now: NOW };
  assert.deepEqual(decideReconcileThrottle(input), decideReconcileThrottle(input));
});

/* ----------------------------- Budget global ----------------------------- */

test("premier appel : la fenêtre démarre et le compteur s'incrémente", () => {
  const decision = decideProviderBudget({
    used: 0,
    limit: 10,
    windowMs: 60_000,
    windowStartedAt: null,
    now: NOW,
  });
  assert.equal(decision.allow, true);
  assert.equal(decision.reset, true);
  assert.equal(decision.remaining, 9);
});

test("le plafond refuse l'appel en trop et annonce le délai", () => {
  const decision = decideProviderBudget({
    used: 10,
    limit: 10,
    windowMs: 60_000,
    windowStartedAt: NOW - 20_000,
    now: NOW,
  });
  assert.equal(decision.allow, false);
  assert.equal(decision.retryAfterSec, 40);
});

test("une fenêtre expirée repart de zéro", () => {
  const decision = decideProviderBudget({
    used: 500,
    limit: 10,
    windowMs: 60_000,
    windowStartedAt: NOW - 61_000,
    now: NOW,
  });
  assert.equal(decision.allow, true);
  assert.equal(decision.reset, true);
});

test("une fenêtre « dans le futur » est traitée comme expirée", () => {
  const decision = decideProviderBudget({
    used: 500,
    limit: 10,
    windowMs: 60_000,
    windowStartedAt: NOW + 5_000,
    now: NOW,
  });
  assert.equal(decision.allow, true);
});

test("le plafond par défaut laisse passer un trafic de boutique normal", () => {
  // 240 appels / 5 min ≈ 0,8/s : très au-dessus de quelques commandes par
  // heure, très en dessous d'un lien de suivi martelé.
  assert.ok(PROVIDER_BUDGET_DEFAULTS.limit >= 120);
  assert.ok(PROVIDER_BUDGET_DEFAULTS.limit <= 600);
  assert.equal(PROVIDER_BUDGET_DEFAULTS.windowMs, 5 * 60 * 1000);
});

test("aucune valeur absurde ne provoque d'exception côté budget", () => {
  for (const used of [0, -5, Number.NaN, 1e9]) {
    const decision = decideProviderBudget({
      used,
      limit: 5,
      windowMs: 1,
      windowStartedAt: NOW - 1,
      now: NOW,
    });
    assert.equal(typeof decision.allow, "boolean");
    assert.ok(Number.isFinite(decision.retryAfterSec));
  }
});

/* ------------------------------ Câblage --------------------------------- */

test("le suivi des codes n'interroge NOWPayments qu'avec un créneau", () => {
  const source = code(read("/src/lib/digital-orders.ts"));
  const block = source.slice(
    source.indexOf("async function reconcileDigitalOrderOnPoll"),
    source.indexOf("async function reconcileDigitalOrderOnPoll") + 4_000,
  );
  // Le créneau et le budget sont vérifiés AVANT getPayment.
  const claim = block.indexOf("claimProviderSync(");
  const budget = block.indexOf("claimProviderBudget(");
  const call = block.indexOf("getPayment(");
  assert.ok(claim > 0 && budget > 0 && call > 0, "garde-fous absents");
  assert.ok(claim < call, "le créneau doit être pris avant l'appel");
  assert.ok(budget < call, "le budget doit être vérifié avant l'appel");
  // Et relâché quoi qu'il arrive.
  assert.match(block, /finally\s*\{[\s\S]*releaseProviderSync\(/);
});

test("la page de paiement applique le même garde-fou", () => {
  const source = code(read("/src/app/api/payments/order/[ref]/route.ts"));
  const call = source.indexOf("getPayment(order.paymentId)");
  assert.ok(call > 0);
  assert.ok(source.indexOf("claimProviderSync(") < call);
  assert.ok(source.indexOf("claimProviderBudget(") < call);
});

test("un refus de créneau ne renvoie pas d'erreur au client", () => {
  const route = code(read("/src/app/api/payments/order/[ref]/route.ts"));
  const source = code(read("/src/lib/digital-orders.ts"));
  // Le suivi sert l'état en base ; aucune exception levée.
  assert.match(source, /\/\/ Refus = on sert l'état en base|return order;/);
  assert.doesNotMatch(route, /status:\s*429/);
});

test("le throttle s'appuie sur une colonne persistée, pas sur la mémoire", () => {
  const schema = code(read("/src/db/schema.ts"));
  const migration = read("/src/db/index.ts");
  assert.match(schema, /lastProviderSyncAt: timestamp\("last_provider_sync_at"/);
  assert.match(migration, /ALTER TABLE orders ADD COLUMN IF NOT EXISTS last_provider_sync_at/);
  // Une migration est indispensable : sans elle, la production casse au
  // premier déploiement (colonne absente).
  assert.match(read("/src/lib/provider-budget.ts"), /ensureSchema\(\)/);
});

test("la réservation est atomique (UPDATE conditionnel renvoyant la ligne)", () => {
  const source = code(read("/src/lib/provider-budget.ts"));
  const block = source.slice(source.indexOf("export async function claimProviderSync"));
  assert.match(block, /\.update\(orders\)/);
  assert.match(block, /isNull\(orders\.lastProviderSyncAt\)/);
  assert.match(block, /\.returning\(/);
  assert.match(block, /claimed\.length === 0/);
});

test("une erreur base refuse l'appel sortant plutôt que de le laisser filer", () => {
  const source = code(read("/src/lib/provider-budget.ts"));
  const block = source.slice(source.indexOf("export async function claimProviderSync"));
  const catchBlock = block.slice(block.indexOf("catch (error)"));
  assert.match(catchBlock.slice(0, 400), /sync: false/);
});

test("le plafond est configurable par variable d'environnement", () => {
  const source = code(read("/src/lib/provider-budget.ts"));
  assert.match(source, /PROVIDER_BUDGET_PER_5MIN/);
});

test("la sonde de santé expose l'état des garde-fous", () => {
  const health = code(read("/src/app/api/health/route.ts"));
  assert.match(health, /providerCalls:/);
  assert.match(health, /throttleReady/);
  assert.match(health, /providerBudgetStatus\(/);
  // Une colonne absente doit produire un avertissement, pas un silence.
  assert.match(health, /providerThrottleReady\(\)/);
});

test("les actions admin ne sont pas retardées par le créneau client", () => {
  const source = code(read("/src/lib/digital-orders.ts"));
  const block = source.slice(source.indexOf("export async function resendDigitalCodesEmail"));
  assert.match(block.slice(0, 400), /clearProviderSyncGate\(/);
});
