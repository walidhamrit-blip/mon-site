#!/usr/bin/env node
/** Tests du catalogue d'abonnements et des règles de période, grâce et statut. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("..", import.meta.url));
const srcRoot = join(root, "src");
const outDir = mkdtempSync(join(tmpdir(), "subscription-plans-"));
const outfile = join(outDir, "subscriptions.mjs");

const aliasPlugin = {
  name: "alias-at-src",
  setup(builder) {
    builder.onResolve({ filter: /^@\// }, (args) => {
      const base = join(srcRoot, args.path.slice(2));
      const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")];
      const found = candidates.find((c) => existsSync(c) && statSync(c).isFile());
      return { path: found ?? base };
    });
  },
};

// Le module « lifecycle » importe « @/lib/subscription-plans » : on bundle
// les deux modules purs ensemble (aucune base ni réseau n'est nécessaire).
await build({
  stdin: {
    contents: `export * from "./src/lib/subscription-plans.ts";
export * from "./src/lib/subscription-lifecycle.ts";`,
    resolveDir: root,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
  plugins: [aliasPlugin],
});
const mod = await import(outfile);
test.after(() => rmSync(outDir, { recursive: true, force: true }));

const DAY = 24 * 60 * 60 * 1000;
const END = new Date("2026-11-20T00:00:00Z");

/* ---------- Catalogue ---------- */

test("catalogue : 3 offres × (mensuel 30 j + annuel 365 j)", () => {
  assert.equal(mod.SUBSCRIPTION_PLANS.length, 6);
  const expected = {
    "vitrine-monthly": [10, 30],
    "vitrine-annual": [69, 365],
    "vitrine-plus-monthly": [12, 30],
    "vitrine-plus-annual": [89, 365],
    "boutique-monthly": [25, 30],
    "boutique-annual": [199, 365],
  };
  for (const [id, [price, interval]] of Object.entries(expected)) {
    const plan = mod.getSubscriptionPlan(id);
    assert.ok(plan, `plan ${id} manquant`);
    assert.equal(plan.priceUsd, price, `prix ${id}`);
    assert.equal(plan.intervalDay, interval, `intervalle ${id}`);
    assert.equal(plan.graceDays, 5, `grâce ${id}`);
  }
});

test("grâce = 5 jours, plafond passerelle = 5 jours", () => {
  assert.equal(mod.SUBSCRIPTION_GRACE_DAYS, 5);
  assert.equal(mod.GATEWAY_MAX_GRACE_DAYS, 5);
  assert.ok(mod.SUBSCRIPTION_GRACE_DAYS <= mod.GATEWAY_MAX_GRACE_DAYS);
});

test("identifiants uniques ; plan inconnu → undefined", () => {
  const ids = mod.SUBSCRIPTION_PLANS.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(mod.getSubscriptionPlan("vitrine"), undefined);
  assert.equal(mod.getSubscriptionPlan("../../etc"), undefined);
});

test("formatage du montant : deux décimales", () => {
  assert.equal(mod.formatUsdAmount(10), "10.00");
  assert.equal(mod.formatUsdAmount(199), "199.00");
  assert.equal(mod.formatUsdAmount(12.005), "12.01");
});

/* ---------- Périodes et accès ---------- */

test("fin de période = début + intervalle en jours", () => {
  const start = new Date("2026-10-21T00:00:00Z");
  assert.equal(mod.computePeriodEnd(start, 30).getTime(), start.getTime() + 30 * DAY);
  assert.equal(mod.computePeriodEnd(start, 365).getTime(), start.getTime() + 365 * DAY);
});

test("accès : courant, grâce de 5 jours, puis expiré", () => {
  assert.equal(mod.accessEndsAt(END, 5).getTime(), END.getTime() + 5 * DAY);
  assert.equal(mod.accessStateAt(END, new Date(END.getTime() - DAY), 5), "current");
  assert.equal(mod.accessStateAt(END, END, 5), "current");
  assert.equal(mod.accessStateAt(END, new Date(END.getTime() + DAY), 5), "grace");
  assert.equal(mod.accessStateAt(END, new Date(END.getTime() + 5 * DAY), 5), "grace");
  assert.equal(mod.accessStateAt(END, new Date(END.getTime() + 6 * DAY), 5), "expired");
});

test("paiement après expiration : nouvelle période à partir de maintenant", () => {
  const paidAt = new Date(END.getTime() + 20 * DAY);
  const period = mod.nextBillingPeriod(END, paidAt, 30);
  assert.equal(period.periodStart.getTime(), paidAt.getTime());
  assert.equal(period.periodEnd.getTime(), paidAt.getTime() + 30 * DAY);
});

test("paiement anticipé : la période est prolongée depuis l'échéance", () => {
  const paidAt = new Date(END.getTime() - 3 * DAY);
  const period = mod.nextBillingPeriod(END, paidAt, 30);
  assert.equal(period.periodStart.getTime(), END.getTime());
  assert.equal(period.periodEnd.getTime(), END.getTime() + 30 * DAY);
});

test("premier paiement : la période démarre au paiement", () => {
  const paidAt = new Date("2026-10-21T10:00:00Z");
  const period = mod.nextBillingPeriod(null, paidAt, 365);
  assert.equal(period.periodStart.getTime(), paidAt.getTime());
  assert.equal(period.periodEnd.getTime(), paidAt.getTime() + 365 * DAY);
});

/* ---------- Statut affiché ---------- */

test("statut dérivé : inactif, actif, grâce, expiré, annulé", () => {
  const now = (offsetDays) => new Date(END.getTime() + offsetDays * DAY);
  assert.equal(mod.displayStatus({ status: "inactive", currentPeriodEnd: null }, now(0)), "inactive");
  assert.equal(mod.displayStatus({ status: "active", currentPeriodEnd: END }, now(-1)), "active");
  assert.equal(mod.displayStatus({ status: "active", currentPeriodEnd: END }, now(2)), "grace");
  assert.equal(mod.displayStatus({ status: "active", currentPeriodEnd: END }, now(6)), "expired");
  assert.equal(mod.displayStatus({ status: "canceled", currentPeriodEnd: END }, now(-1)), "canceled");
});

test("accès et réabonnement : grâce = accès, expiré = réabonnement possible", () => {
  assert.equal(mod.hasAccess("active"), true);
  assert.equal(mod.hasAccess("grace"), true);
  assert.equal(mod.hasAccess("expired"), false);
  assert.equal(mod.blocksNewSubscription("grace"), true);
  assert.equal(mod.blocksNewSubscription("expired"), false);
  assert.equal(mod.blocksNewSubscription("canceled"), false);
  assert.equal(mod.blocksNewSubscription("inactive"), true, "facture en attente = pas de doublon");
});

/* ---------- Charge utile IPN ---------- */

test("identifiant d'abonnement lu dans l'IPN", () => {
  assert.equal(mod.subscriptionIdFromPayload({ subscription_id: 4821 }), "4821");
  assert.equal(mod.subscriptionIdFromPayload({ subscription_id: " 77 " }), "77");
  assert.equal(mod.subscriptionIdFromPayload({ recurring_payment_id: "abc" }), "abc");
  assert.equal(mod.subscriptionIdFromPayload({ payment_id: "1" }), null);
  assert.equal(mod.subscriptionIdFromPayload({ subscription_id: "  " }), null);
  assert.equal(mod.subscriptionIdFromPayload({ subscription_id: null }), null);
});

test("normalisation de l'e-mail", () => {
  assert.equal(mod.normalizeEmail("  Client@Example.COM "), "client@example.com");
});
