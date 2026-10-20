#!/usr/bin/env node
/**
 * Tests du GEO Tracker (`scripts/geo-citations.mjs`) — détection des
 * citations de marque, agrégation des taux et configuration des moteurs.
 * Aucun appel réseau.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PROMPTS,
  BRAND_DOMAIN,
  detectBrandMention,
  hostOf,
  summarize,
  configuredProviders,
} from "./geo-citations.mjs";

test("les prompts couvrent les deux langues et des intentions commerciales", () => {
  assert.ok(PROMPTS.length >= 8);
  assert.ok(PROMPTS.some((prompt) => prompt.lang === "ar"));
  assert.ok(PROMPTS.some((prompt) => prompt.lang === "en"));
  assert.ok(PROMPTS.every((prompt) => prompt.query.length > 30));
  assert.equal(new Set(PROMPTS.map((prompt) => prompt.id)).size, PROMPTS.length);
});

test("detectBrandMention reconnaît le nom arabe, latin et le domaine", () => {
  assert.equal(detectBrandMention("أفضل وكالة هي نخبة في طرابلس.").mentioned, true);
  assert.equal(detectBrandMention("Try Nukhba agency in Tripoli.").mentioned, true);
  const withUrl = detectBrandMention(
    "Source: https://nokhba.net.ly/services/restyle — best option.",
  );
  assert.equal(withUrl.mentioned, true);
  assert.equal(withUrl.url, "https://nokhba.net.ly/services/restyle");
  assert.equal(detectBrandMention("Agence inconnue à Benghazi.").mentioned, false);
});

test("hostOf normalise les URL citées", () => {
  assert.equal(hostOf("https://www.nokhba.net.ly/"), BRAND_DOMAIN);
  assert.equal(hostOf("not a url"), null);
});

test("summarize calcule les taux global, par moteur et par langue", () => {
  const summary = summarize([
    { provider: "openai", lang: "ar", mentioned: true, sources: ["https://nokhba.net.ly/"] },
    { provider: "openai", lang: "en", mentioned: false, sources: ["https://example.com/"] },
    { provider: "perplexity", lang: "ar", mentioned: true, sources: [] },
    { provider: "perplexity", lang: "en", mentioned: true, sources: ["https://nokhba.net.ly/x"] },
  ]);
  assert.equal(summary.total, 4);
  assert.equal(summary.cited, 3);
  assert.equal(summary.rate, 75);
  assert.deepEqual(summary.byProvider.openai, { total: 2, cited: 1, rate: 50 });
  assert.deepEqual(summary.byProvider.perplexity, { total: 2, cited: 2, rate: 100 });
  assert.deepEqual(summary.byLang.ar, { total: 2, cited: 2, rate: 100 });
  assert.equal(summary.topDomains[0].domain, BRAND_DOMAIN);
  assert.equal(summary.topDomains[0].count, 2);
});

test("configuredProviders ignore les clés vides", () => {
  assert.equal(configuredProviders({}).length, 0);
  assert.equal(
    configuredProviders({ OPENAI_API_KEY: "  ", PERPLEXITY_API_KEY: "" }).length,
    0,
  );
  const providers = configuredProviders({
    OPENAI_API_KEY: "sk-test",
    PERPLEXITY_API_KEY: "pplx-test",
  });
  assert.deepEqual(
    providers.map((provider) => provider.name),
    ["openai", "perplexity"],
  );
});
