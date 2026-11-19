#!/usr/bin/env node
/**
 * Tests des règles du contrôle des liens (aucun accès réseau).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  classifyStatus,
  extractLinks,
  isSameOrigin,
  parseSitemap,
  summarize,
} from "./lib/link-checks.mjs";

test("sitemap : déduplique et décode les entités", () => {
  const xml = `<?xml version="1.0"?>
    <urlset>
      <url><loc>https://exemple.test/a</loc></url>
      <url><loc>https://exemple.test/a</loc></url>
      <url><loc>https://exemple.test/b?x=1&amp;y=2</loc></url>
    </urlset>`;
  assert.deepEqual(parseSitemap(xml), [
    "https://exemple.test/a",
    "https://exemple.test/b?x=1&y=2",
  ]);
});

test("liens : résout les URL relatives et ignore les protocoles non HTTP", () => {
  const html = `
    <a href="/services">Services</a>
    <a href="contact">Contact</a>
    <a href="mailto:a@b.test">Mail</a>
    <a href="tel:+218900000000">Téléphone</a>
    <a href="#ancre">Ancre</a>
    <a href="https://externe.test/page">Externe</a>
    <a href="/services">Doublon</a>
    <a href="/services#tarifs">Ancre sur page</a>`;
  assert.deepEqual(extractLinks(html, "https://exemple.test/base/"), [
    "https://exemple.test/services",
    "https://exemple.test/base/contact",
    "https://externe.test/page",
  ]);
});

test("origine : interne contre externe", () => {
  assert.equal(isSameOrigin("https://exemple.test/a", "https://exemple.test"), true);
  assert.equal(isSameOrigin("https://autre.test/a", "https://exemple.test"), false);
  assert.equal(isSameOrigin("pas une url", "https://exemple.test"), false);
});

test("statuts : 404/410/5xx échouent, 401/403/429 avertissent", () => {
  assert.equal(classifyStatus(200), "ok");
  assert.equal(classifyStatus(204), "ok");
  assert.equal(classifyStatus(301), "ok");
  assert.equal(classifyStatus(404), "fail");
  assert.equal(classifyStatus(410), "fail");
  assert.equal(classifyStatus(500), "fail");
  assert.equal(classifyStatus(403), "warn");
  assert.equal(classifyStatus(429), "warn");
});

test("résumé : compte les échecs et les avertissements", () => {
  const summary = summarize([
    { status: "ok" },
    { status: "ok" },
    { status: "warn" },
    { status: "fail" },
  ]);
  assert.equal(summary.total, 4);
  assert.equal(summary.ok, 2);
  assert.equal(summary.warnings.length, 1);
  assert.equal(summary.failures.length, 1);
});
