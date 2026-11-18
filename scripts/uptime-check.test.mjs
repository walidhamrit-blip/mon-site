#!/usr/bin/env node
/**
 * Tests des règles de surveillance (aucun accès réseau).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  evaluateHealth,
  evaluatePage,
  evaluateTls,
  overallStatus,
} from "./lib/uptime-checks.mjs";

test("santé : 200 + ok=true est un succès", () => {
  const verdict = evaluateHealth(200, JSON.stringify({ ok: true }));
  assert.equal(verdict.status, "ok");
});

test("santé : 200 avec base coupée est un échec explicite", () => {
  const verdict = evaluateHealth(
    200,
    JSON.stringify({ ok: false, database: { connected: false } }),
  );
  assert.equal(verdict.status, "fail");
  assert.match(verdict.message, /base connectée : false/);
});

test("santé : 503 et JSON illisible échouent", () => {
  assert.equal(evaluateHealth(503, "{}").status, "fail");
  assert.equal(evaluateHealth(200, "<html>").status, "fail");
  assert.match(evaluateHealth(200, "<html>").message, /JSON illisible/);
});

test("page : marqueur présent ou absent", () => {
  assert.equal(
    evaluatePage(200, "<html>نخبة</html>", ["نخبة", "NUKHBA"]).status,
    "ok",
  );
  assert.equal(
    evaluatePage(200, "<html>maintenance</html>", ["نخبة"]).status,
    "fail",
  );
  assert.equal(evaluatePage(500, "نخبة", ["نخبة"]).status, "fail");
});

test("TLS : seuils 14 et 7 jours", () => {
  const now = new Date("2026-11-18T00:00:00Z");
  const inDays = (days) =>
    new Date(now.getTime() + days * 86_400_000).toISOString();

  assert.equal(evaluateTls(inDays(30), now).status, "ok");
  assert.equal(evaluateTls(inDays(10), now).status, "warn");
  assert.equal(evaluateTls(inDays(3), now).status, "fail");
  assert.equal(evaluateTls(inDays(-1), now).status, "fail");
  assert.equal(evaluateTls("pas une date", now).status, "fail");
});

test("agrégation : un échec domine, un avertissement suffit à signaler", () => {
  assert.equal(overallStatus([{ status: "ok", message: "" }]), "ok");
  assert.equal(
    overallStatus([
      { status: "ok", message: "" },
      { status: "warn", message: "" },
    ]),
    "warn",
  );
  assert.equal(
    overallStatus([
      { status: "warn", message: "" },
      { status: "fail", message: "" },
    ]),
    "fail",
  );
});
