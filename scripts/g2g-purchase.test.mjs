#!/usr/bin/env node
// Tests simulés : aucun accès réseau, aucun achat ni base de production.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = process.cwd();
mkdirSync(join(root, ".scratch"), { recursive: true });
const dir = mkdtempSync(join(root, ".scratch", "g2g-purchase-test-"));
test.after(() => rmSync(dir, { recursive: true, force: true }));

const sources = {
  "drizzle-orm": `
    export const eq = (field, value) => row => row[field] === value;
    export const inArray = (field, values) => row => values.includes(row[field]);
    export const isNull = field => row => row[field] == null;
    export const and = (...clauses) => row => clauses.every(fn => fn(row));
    export const sql = () => ({increment: true});
  `,
  "@/db/schema": `export const g2gDeliveries = Object.fromEntries([
    'id','deliveryId','orderId','offerId','requestedQty','status','attempts',
    'supplierIdempotencyKey','supplierPurchasePayload','supplierPurchaseStartedAt'
  ].map(x => [x, x]));`,
  "@/db": `
    export async function ensureSchema() { if (globalThis.__g2gTest.dbFailure) throw Error('database down'); }
    export const db = { update() { return { set(changes) { return { where(condition) {
      const row = globalThis.__g2gTest.row;
      const match = row && condition(row);
      if (match) for (const [key, value] of Object.entries(changes)) row[key] = value?.increment ? row[key] + 1 : value;
      return { returning: async () => match ? [{...row}] : [], then: (resolve) => resolve() };
    } }; } }; } };
  `,
  "@/lib/g2g-pilot": `
    export const automaticDeliveryVerified = () => globalThis.__g2gTest.verified;
    export const isRetiredG2gOffer = (id) => String(id ?? "").trim().toUpperCase() === "G1795076410074VF";
  `,
  "@/lib/g2g-fulfilment-core": `export const shouldPurchaseNow = (_plan, enabled) => enabled;`,
  "@/lib/fazercards": `
    export async function fazercardsBalance() { return {balance: 100}; }
    export async function fazercardsGiftCardOrder(input) {
      const test = globalThis.__g2gTest;
      test.calls.push(input);
      test.atPost = {...test.row};
      if (test.timeout) throw Error('simulated timeout');
      return {order: {id: 'fake-order'}};
    }
  `,
};
const plugin = { name: "fake-g2g-dependencies", setup(b) {
  b.onResolve({ filter: /^(drizzle-orm|@\/db|@\/db\/schema|@\/lib\/g2g-pilot|@\/lib\/g2g-fulfilment-core|@\/lib\/fazercards)$/ }, args => ({path: args.path, namespace: "fake"}));
  b.onLoad({ filter: /.*/, namespace: "fake" }, args => ({contents: sources[args.path], loader: "js"}));
} };
const outfile = join(dir, "purchase.mjs");
await build({entryPoints: [join(root, "src/lib/g2g-purchase.ts")], outfile, bundle: true, platform: "node", format: "esm", plugins: [plugin], logLevel: "silent"});
const { purchaseG2gDelivery } = await import(pathToFileURL(outfile).href);
const input = {deliveryId: "fake-delivery", orderId: "fake-order", offerId: "G1795521210943KM", requestedQty: 1, categoryId: "google_play_tr", cardId: "25_try", plan: {totalCostUsd: 1}, autoDeliveryEnabled: true};
function reset({verified = true, timeout = false} = {}) {
  globalThis.__g2gTest = {verified, timeout, calls: [], row: {id: 1, deliveryId: input.deliveryId, orderId: input.orderId, offerId: input.offerId, requestedQty: 1, status: "planned", attempts: 0, supplierIdempotencyKey: null, supplierPurchasePayload: null, supplierPurchaseStartedAt: null}};
}

test("intention persistée avant POST simulé, clé conforme, concurrence et reprise interdite", async () => {
  reset();
  const results = await Promise.all([purchaseG2gDelivery(input), purchaseG2gDelivery(input)]);
  const fake = globalThis.__g2gTest;
  assert.deepEqual(results.map(x => x.outcome).sort(), ["already_handled", "purchased"]);
  assert.equal(fake.calls.length, 1);
  const request = fake.calls[0], atPost = fake.atPost;
  assert.equal(atPost.status, "purchasing");
  assert.ok(atPost.supplierPurchaseStartedAt instanceof Date);
  assert.match(request.idempotencyKey, /^g2g-fzr-[0-9a-f-]{36}$/);
  assert.ok(request.idempotencyKey.length <= 255 && /^[\x21-\x7e]+$/.test(request.idempotencyKey));
  assert.equal(atPost.supplierIdempotencyKey, request.idempotencyKey);
  assert.deepEqual(JSON.parse(atPost.supplierPurchasePayload), {category_id: request.category_id, card_id: request.card_id, quantity: request.quantity});
  assert.equal((await purchaseG2gDelivery(input)).outcome, "already_handled");
  assert.equal(fake.calls.length, 1);
});

test("timeout simulé : l'intention subsiste, aucun nouvel achat automatique", async () => {
  reset({timeout: true});
  assert.equal((await purchaseG2gDelivery(input)).outcome, "failed");
  const fake = globalThis.__g2gTest;
  assert.equal(fake.row.status, "failed");
  assert.equal(fake.row.supplierIdempotencyKey, fake.calls[0].idempotencyKey);
  assert.equal((await purchaseG2gDelivery(input)).outcome, "already_handled");
  assert.equal(fake.calls.length, 1);
});

test("garde de livraison, offre retirée, ligne incohérente, ancienne tentative et base en panne bloquent le POST", async () => {
  reset({verified: false});
  assert.equal((await purchaseG2gDelivery(input)).reason, "delivery_not_verified");
  assert.equal(globalThis.__g2gTest.calls.length, 0);
  reset();
  assert.equal((await purchaseG2gDelivery({...input, offerId: "G1795076410074VF"})).reason, "retired_offer");
  assert.equal(globalThis.__g2gTest.calls.length, 0);
  reset(); globalThis.__g2gTest.row.requestedQty = 2;
  assert.equal((await purchaseG2gDelivery(input)).outcome, "already_handled");
  assert.equal(globalThis.__g2gTest.calls.length, 0);
  reset(); globalThis.__g2gTest.row.attempts = 1;
  assert.equal((await purchaseG2gDelivery(input)).outcome, "already_handled");
  assert.equal(globalThis.__g2gTest.calls.length, 0);
  reset(); globalThis.__g2gTest.dbFailure = true;
  await assert.rejects(purchaseG2gDelivery(input), /database down/);
  assert.equal(globalThis.__g2gTest.calls.length, 0);
  delete globalThis.__g2gTest;
});

test("le client FazerCards transmet le même en-tête et le corps prévus sans réseau réel", async () => {
  const stubs = {"@/lib/nowpayments": "export const sanitizeSecret = value => value ?? '';", "@/lib/digital-types": "export const MIN_CRYPTO_INVOICE_USD = 1;", "@/lib/digital-sales-policy": "export const MAX_DIGITAL_ORDER_USD = 1000;"};
  const alias = {name: "client-stubs", setup(b) {
    b.onResolve({filter: /^@\/lib\/(nowpayments|digital-types|digital-sales-policy)$/}, args => ({path: args.path, namespace: "client"}));
    b.onLoad({filter: /.*/, namespace: "client"}, args => ({contents: stubs[args.path], loader: "js"}));
  }};
  const clientPath = join(dir, "fake-fazercards.mjs");
  await build({entryPoints: [join(root, "src/lib/fazercards.ts")], outfile: clientPath, bundle: true, platform: "node", format: "esm", plugins: [alias], logLevel: "silent"});
  const {fazercardsGiftCardOrder} = await import(pathToFileURL(clientPath).href);
  const originalFetch = globalThis.fetch, oldKey = process.env.FAZERCARDS_API_KEY, oldBase = process.env.FAZERCARDS_API_BASE;
  const requests = [];
  try {
    process.env.FAZERCARDS_API_KEY = "test-only-fake-key";
    process.env.FAZERCARDS_API_BASE = "https://fake.invalid";
    globalThis.fetch = async (url, options) => { requests.push({url, options}); return new Response(JSON.stringify({ok: true, order: {id: "fake"}}), {status: 200}); };
    const key = "g2g-fzr-01234567-0123-4567-89ab-0123456789ab";
    await fazercardsGiftCardOrder({category_id: "google_play_tr", card_id: "25_try", quantity: 1, idempotencyKey: key});
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "https://fake.invalid/giftcards/order");
    assert.equal(requests[0].options.headers["Idempotency-Key"], key);
    assert.deepEqual(JSON.parse(requests[0].options.body), {category_id: "google_play_tr", card_id: "25_try", quantity: 1});
  } finally {
    globalThis.fetch = originalFetch;
    if (oldKey === undefined) delete process.env.FAZERCARDS_API_KEY; else process.env.FAZERCARDS_API_KEY = oldKey;
    if (oldBase === undefined) delete process.env.FAZERCARDS_API_BASE; else process.env.FAZERCARDS_API_BASE = oldBase;
  }
});
