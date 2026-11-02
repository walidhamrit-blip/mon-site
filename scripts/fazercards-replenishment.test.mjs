import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DEFAULT_REPLENISHMENT_SETTINGS as defaults, validReplenishmentSettings as valid, replenishmentNeed, replenishmentAlertLevel } from "../src/lib/fazercards-replenishment-core.ts";

test("seuil 30 et cible 100 : recharge uniquement sous le seuil", () => {
  assert.equal(replenishmentNeed(25, defaults), 75);
  assert.equal(replenishmentNeed(29.99, defaults), 70.01);
  assert.equal(replenishmentNeed(30, defaults), 0);
  assert.equal(replenishmentNeed(101, defaults), 0);
  assert.equal(replenishmentNeed(null, defaults), null);
  assert.equal(replenishmentNeed(-1, defaults), null);
});

test("le seuil déclenche une alerte même si la couverture du plafond est suffisante", () => {
  assert.equal(replenishmentAlertLevel("ok", 29.99, defaults), "low");
  assert.equal(replenishmentAlertLevel("ok", 30, defaults), "ok");
  assert.equal(replenishmentAlertLevel("critical", 1, defaults), "critical");
  assert.equal(replenishmentAlertLevel("unknown", null, defaults), "unknown");
  assert.equal(replenishmentAlertLevel("low", 80, defaults), "low");
});

test("valide les montants et refuse les entrées dangereuses", () => {
  assert.equal(valid(defaults), true);
  assert.equal(valid({ thresholdUsd: 1.15, targetUsd: 100.12 }), true);
  for (const rule of [null, {}, { thresholdUsd: 30, targetUsd: 30 }, { thresholdUsd: -1, targetUsd: 100 }, { thresholdUsd: 30, targetUsd: 50001 }, { thresholdUsd: 1.001, targetUsd: 10 }, { thresholdUsd: '30', targetUsd: 100 }]) assert.equal(valid(rule), false);
});

test("règle stockée et accès administrateur, sans virement automatique", () => {
  const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  const action = read('src/app/admin/actions.ts').split('export async function saveFazercardsReplenishmentRule')[1].split('/* ---------------- Connexion')[0];
  assert.match(action, /await requireAdmin\(\)/);
  assert.match(action, /validReplenishmentSettings\(input\)/);
  assert.match(action, /saveReplenishmentSettings\(input\)/);
  assert.match(read('src/lib/fazercards-balance.ts'), /replenishmentAlertLevel\(assessment.level, assessment.balanceUsd, rule\)/);
  assert.doesNotMatch(read('src/lib/fazercards-replenishment.ts'), /payout|fazercardsPaymentCreate/);
});
