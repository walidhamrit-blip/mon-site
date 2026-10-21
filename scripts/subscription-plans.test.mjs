#!/usr/bin/env node
/** Tests du catalogue d'abonnements et des règles de période / grâce. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("..", import.meta.url));
const outDir = mkdtempSync(join(tmpdir(), "subscription-plans-"));
const outfile = join(outDir, "subscription-plans.mjs");

await build({
  entryPoints: [join(root, "src/lib/subscription-plans.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
});
const mod = await import(outfile);
const {
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_GRACE_DAYS,
  getSubscriptionPlan,
  formatUsdAmount,
  computePeriodEnd,
  accessEndsAt,
  accessStateAt,
} = mod;

test.after(() => rmSync(outDir, { recursive: true, force: true }));

const DAY = 24 * 60 * 60 * 1000;

test("catalogue : 3 offres × (mensuel 30 j + annuel 365 j)", () => {
  assert.equal(SUBSCRIPTION_PLANS.length, 6);
  const expected = {
    "vitrine-monthly": [10, 30],
    "vitrine-annual": [69, 365],
    "vitrine-plus-monthly": [12, 30],
    "vitrine-plus-annual": [89, 365],
    "boutique-monthly": [25, 30],
    "boutique-annual": [199, 365],
  };
  for (const [id, [price, interval]] of Object.entries(expected)) {
    const plan = getSubscriptionPlan(id);
    assert.ok(plan, `plan ${id} manquant`);
    assert.equal(plan.priceUsd, price, `prix ${id}`);
    assert.equal(plan.intervalDay, interval, `intervalle ${id}`);
    assert.equal(plan.graceDays, 10, `grâce ${id}`);
  }
});

test("identifiants uniques et grâce uniforme", () => {
  const ids = SUBSCRIPTION_PLANS.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(SUBSCRIPTION_GRACE_DAYS, 10);
});

test("plan inconnu → undefined (jamais de prix par défaut)", () => {
  assert.equal(getSubscriptionPlan("vitrine"), undefined);
  assert.equal(getSubscriptionPlan("../../etc"), undefined);
});

test("formatage du montant : deux décimales", () => {
  assert.equal(formatUsdAmount(10), "10.00");
  assert.equal(formatUsdAmount(199), "199.00");
  assert.equal(formatUsdAmount(12.005), "12.01");
});

test("fin de période = début + intervalle en jours", () => {
  const start = new Date("2026-10-21T00:00:00Z");
  assert.equal(computePeriodEnd(start, 30).getTime(), start.getTime() + 30 * DAY);
  assert.equal(computePeriodEnd(start, 365).getTime(), start.getTime() + 365 * DAY);
});

test("accès : courant, grâce de 10 jours, puis expiré", () => {
  const end = new Date("2026-11-20T00:00:00Z");
  assert.equal(accessEndsAt(end, 10).getTime(), end.getTime() + 10 * DAY);
  assert.equal(accessStateAt(end, new Date(end.getTime() - DAY), 10), "current");
  assert.equal(accessStateAt(end, end, 10), "current");
  assert.equal(accessStateAt(end, new Date(end.getTime() + DAY), 10), "grace");
  assert.equal(accessStateAt(end, new Date(end.getTime() + 10 * DAY), 10), "grace");
  assert.equal(accessStateAt(end, new Date(end.getTime() + 11 * DAY), 10), "expired");
});
