#!/usr/bin/env node
/**
 * Garde-fous du contenu C-06 :
 *  - le référentiel fait bien 40+ points et 100 % de poids ;
 *  - chaque point est bilingue et sans texte de remplissage ;
 *  - le rapport exemple est daté, outillé et assume ses limites ;
 *  - le formulaire réutilise `/api/lead` et émet `audit_request`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(join(root, path), "utf8");
const checklist = await import("../src/lib/audit-checklist.ts");

test("le référentiel couvre au moins 40 points, en 8 catégories", () => {
  assert.ok(checklist.AUDIT_ITEM_COUNT >= 40, `${checklist.AUDIT_ITEM_COUNT} points`);
  assert.equal(checklist.AUDIT_CATEGORIES.length, 8);
  assert.equal(checklist.AUDIT_WEIGHT_TOTAL, 100);
});

test("chaque point est bilingue, non vide et sans texte de remplissage", () => {
  for (const category of checklist.AUDIT_CATEGORIES) {
    assert.ok(category.weight > 0);
    assert.ok(category.items.length >= 5);
    for (const item of category.items) {
      assert.ok(item.ar.trim().length > 3, `arabe manquant : ${item.en}`);
      assert.ok(item.en.trim().length > 3, `anglais manquant : ${item.ar}`);
      assert.doesNotMatch(`${item.ar} ${item.en}`, /TODO|lorem|placeholder/i);
    }
  }
});

test("le rapport exemple est daté, outillé et limité explicitement", () => {
  const page = read("src/app/(site)/audit/audit-client.tsx");
  assert.match(page, /20\/11\/2026/);
  assert.match(page, /Lighthouse 12/);
  assert.match(page, /3 runs/);
  assert.match(page, /69/);
  assert.match(page, /86/);
  assert.match(page, /not a client|لا عميل/, "le site audité doit être présenté comme une démo");
});

test("le formulaire réutilise /api/lead et émet audit_request", () => {
  const form = read("src/components/audit-request-form.tsx");
  assert.match(form, /fetch\("\/api\/lead"/);
  assert.match(form, /need: "audit"/);
  assert.match(form, /utm: "source=audit-form"/);
  assert.match(form, /trackEvent\(\{ name: "audit_request", source: "audit-form" \}\)/);
});

test("la page est déclarée dans le sitemap et liée depuis Fix & Optimize", () => {
  assert.match(read("src/app/sitemap.ts"), /`\$\{base\}\/audit`/);
  assert.match(read("src/components/service-detail-view.tsx"), /href="\/audit"/);
});
