#!/usr/bin/env node
/**
 * Tests du GEO Tracker (`scripts/geo-citations.mjs`) — détection des
 * citations de marque, agrégation des taux et configuration des moteurs.
 * Aucun appel réseau.
 *
 * A06 (audit SEO/GEO 2026-11-01) : on distingue mention textuelle, citation
 * d'URL vérifiée (hostname exact du domaine de marque) et citations ancrées
 * web ; les erreurs API sont un état à part, exclues des dénominateurs.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PROMPTS,
  BRAND_DOMAIN,
  detectBrandMention,
  hostOf,
  citesBrandDomain,
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

test("detectBrandMention reconnaît le nom arabe, latin et le domaine exact", () => {
  assert.equal(detectBrandMention("أفضل وكالة هي نخبة في طرابلس.").mentioned, true);
  assert.equal(detectBrandMention("Try Nukhba agency in Tripoli.").mentioned, true);
  const withUrl = detectBrandMention(
    "Source: https://nokhba.net.ly/services/restyle — best option.",
  );
  assert.equal(withUrl.mentioned, true);
  assert.equal(withUrl.url, "https://nokhba.net.ly/services/restyle");
  assert.equal(detectBrandMention("Agence inconnue à Benghazi.").mentioned, false);
});

test("A06 : un domaine ressemblant n'est PAS une URL de marque (hostname exact)", () => {
  const evil = detectBrandMention("Voir https://nokhba.net.ly.evil.example/ pour comparer.");
  // Le nom latin « nokhba » apparaît dans l'hostname falsifié : la mention
  // textuelle peut exister, mais l'URL citée ne doit PAS être retenue.
  assert.equal(evil.url, null);
  assert.equal(citesBrandDomain(["https://nokhba.net.ly.evil.example/"]), false);
  assert.equal(citesBrandDomain(["https://www.nokhba.net.ly/pricing"]), true);
  assert.equal(citesBrandDomain(["https://example.com/"]), false);
  assert.equal(citesBrandDomain([]), false);
  assert.equal(citesBrandDomain(undefined), false);
});

test("hostOf normalise les URL citées", () => {
  assert.equal(hostOf("https://www.nokhba.net.ly/"), BRAND_DOMAIN);
  assert.equal(hostOf("not a url"), null);
});

test("A06 : summarize distingue mention, citation d'URL et ancré web, et exclut les erreurs", () => {
  const summary = summarize([
    // mentionné + cité (source = domaine exact), ancré web
    { provider: "perplexity", lang: "ar", status: "ok", grounded: true, mentioned: true, sources: [`https://${BRAND_DOMAIN}/`] },
    // mentionné mais AUCUNE source sur le domaine → pas une citation
    { provider: "perplexity", lang: "en", status: "ok", grounded: true, mentioned: true, sources: ["https://example.com/"] },
    // ni mentionné ni cité, non ancré (mémoire)
    { provider: "openai", lang: "ar", status: "ok", grounded: false, mentioned: false, sources: [] },
    // cité mais non ancré
    { provider: "openai", lang: "en", status: "ok", grounded: false, mentioned: false, sources: [`https://${BRAND_DOMAIN}/x`] },
    // erreur API : état distinct, exclue des taux
    { provider: "openai", lang: "en", status: "error", mentioned: false, sources: [], error: "HTTP 429" },
  ]);
  assert.equal(summary.total, 5);
  assert.equal(summary.errors, 1);
  assert.equal(summary.answered, 4);
  assert.equal(summary.mentioned, 2);
  assert.equal(summary.mentionRate, 50);
  assert.equal(summary.cited, 2);
  assert.equal(summary.citationRate, 50);
  assert.equal(summary.groundedTotal, 2);
  assert.equal(summary.groundedCited, 1);
  assert.equal(summary.groundedCitationRate, 50);
  // rétrocompat : rate = mentionRate
  assert.equal(summary.rate, 50);
  assert.deepEqual(summary.byProvider.perplexity, {
    total: 2, errors: 0, answered: 2, mentioned: 2, mentionRate: 100, cited: 1, citationRate: 50,
  });
  assert.equal(summary.byProvider.openai.errors, 1);
  assert.equal(summary.byProvider.openai.citationRate, 50); // 1 citation / 2 répondues
  assert.equal(summary.byLang.ar.citationRate, 50);
  assert.equal(summary.topDomains[0].domain, BRAND_DOMAIN);
  assert.equal(summary.topDomains[0].count, 2);
});

test("A06 : une simple mention sans URL ne fait pas un taux de citation de 100 %", () => {
  // Cas de l'audit : une réponse qui mentionne la marque sans citer d'URL
  // donnait auparavant rate = 100 %.
  const summary = summarize([
    { provider: "openai", lang: "ar", status: "ok", grounded: false, mentioned: true, sources: [] },
  ]);
  assert.equal(summary.mentionRate, 100);
  assert.equal(summary.citationRate, 0);
  assert.equal(summary.rate, 100); // rétrocompat = mention
});

test("summarize sans résultat ne divise pas par zéro", () => {
  const summary = summarize([]);
  assert.equal(summary.total, 0);
  assert.equal(summary.mentionRate, 0);
  assert.equal(summary.citationRate, 0);
  assert.equal(summary.groundedCitationRate, 0);
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
