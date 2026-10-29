#!/usr/bin/env node
/**
 * Tests légers des automatisations SEO & GEO (Référencement IA) — `node:test`.
 *
 *   npm run test:seo
 *   (ou) node scripts/seo-generator.test.mjs
 *
 * Les modules TypeScript sont compilés à la volée avec esbuild (déjà présent :
 * dépendance de drizzle-kit/Next), alias `@/` résolu comme dans tsconfig.
 * Aucun accès réseau réel : `fetch` et `process.env.OPENAI_API_KEY` sont simulés.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, statSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("..", import.meta.url));
const srcRoot = join(root, "src");
const outDir = mkdtempSync(join(tmpdir(), "seo-generator-"));

/** Résout l'alias TypeScript `@/…` → `src/…` comme Next/tsconfig. */
const aliasPlugin = {
  name: "alias-at-src",
  setup(builder) {
    builder.onResolve({ filter: /^@\// }, (args) => {
      const base = join(srcRoot, args.path.slice(2));
      const candidates = [
        base,
        `${base}.ts`,
        `${base}.tsx`,
        `${base}.js`,
        join(base, "index.ts"),
        join(base, "index.tsx"),
      ];
      const found = candidates.find(
        (candidate) => existsSync(candidate) && statSync(candidate).isFile(),
      );
      return { path: found ?? base };
    });
  },
};

async function compileModule(relPath, outName) {
  const outfile = join(outDir, outName);
  await build({
    entryPoints: [join(srcRoot, relPath)],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22",
    plugins: [aliasPlugin],
    logLevel: "silent",
  });
  return import(pathToFileURL(outfile).href);
}

const {
  generateSeoCopy,
  generateSeoCopyBatch,
  ensureDemoSeoFields,
  templateSeoCopy,
  LIMITS,
} = await compileModule("lib/ai/seo-generator.ts", "seo-generator.mjs");

const { buildLlmsTxt, buildLlmsFullTxt } = await compileModule(
  "lib/llms-txt.ts",
  "llms-txt.mjs",
);

const { runSeoAudit } = await compileModule(
  "lib/seo-audit.ts",
  "seo-audit.mjs",
);

const {
  localBusinessJsonLd,
  offerCatalogJsonLd,
  howToJsonLd,
  demoJsonLd,
} = await compileModule("lib/seo.ts", "seo.mjs");

const { siteConfig } = await compileModule("lib/config.ts", "config.mjs");
const {
  demos: defaultDemos,
  faqs: defaultFaqs,
  testimonials: defaultTestimonials,
  heroContent: defaultHero,
  servicesRibbonContent: defaultRibbon,
  defaultWhyUs,
  defaultProcess,
  defaultSectionHeadings,
} = await compileModule("lib/content.ts", "content.mjs");

// ── Helpers ────────────────────────────────────────────────────────────────
const DEMO = {
  title: "مطعم النخبة",
  titleEn: "Nukhba Restaurant",
  description: "موقع حجز طاولات لمطعم راقٍ في طرابلس.",
  descriptionEn: "Table booking website for a fine restaurant in Tripoli.",
  sectorAr: "مطاعم",
  sectorEn: "Restaurants",
};

const originalFetch = globalThis.fetch;
const originalKey = process.env.OPENAI_API_KEY;

function useKey(key) {
  if (key === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = key;
}

/** Simule un endpoint OpenAI renvoyant `payload` (statut 200 par défaut). */
function mockFetch(payload, status = 200) {
  globalThis.fetch = async () =>
    new Response(
      typeof payload === "string" ? payload : JSON.stringify(payload),
      { status, headers: { "Content-Type": "application/json" } },
    );
}

function llmPayload(copy) {
  return { choices: [{ message: { content: JSON.stringify(copy) } }] };
}

test.after(() => {
  globalThis.fetch = originalFetch;
  useKey(originalKey);
  rmSync(outDir, { recursive: true, force: true });
});

// ── 1. Clé absente → gabarit ───────────────────────────────────────────────
test("clé absente → engine template, warning missing_key, copy complète", async () => {
  useKey(undefined);
  const result = await generateSeoCopy(DEMO);
  assert.equal(result.engine, "template");
  assert.equal(result.warning, "missing_key");
  assert.deepEqual(result.copy, templateSeoCopy(DEMO));
  for (const [key, max] of Object.entries({
    metaTitle: LIMITS.title,
    metaDescription: LIMITS.description,
    metaTitleEn: LIMITS.title,
    metaDescriptionEn: LIMITS.description,
    imageAltAr: LIMITS.alt,
    imageAltEn: LIMITS.alt,
  })) {
    assert.equal(typeof result.copy[key], "string");
    assert.ok(result.copy[key].length > 0 && result.copy[key].length <= max);
  }
});

// ── 2. Clé présente + 401 → erreur explicite ──────────────────────────────
test("clé présente + HTTP 401 → engine error, warning http_401, gabarit renvoyé", async () => {
  useKey("sk-test-refusee-401");
  mockFetch({ error: { message: "Incorrect API key provided: sk-test-refusee-401" } }, 401);
  const result = await generateSeoCopy(DEMO);
  assert.equal(result.engine, "error");
  assert.equal(result.warning, "http_401");
  assert.deepEqual(result.copy, templateSeoCopy(DEMO));
  const serialized = JSON.stringify(result);
  assert.ok(!serialized.includes("sk-test-refusee-401"), "la clé ne doit jamais fuiter");
  assert.ok(!serialized.includes("Incorrect API key"), "le corps brut ne doit pas fuiter");
});

test("clé présente + HTTP 429 (quota) → warning http_429", async () => {
  useKey("sk-test-quota");
  mockFetch({ error: { message: "rate limit" } }, 429);
  const result = await generateSeoCopy(DEMO);
  assert.equal(result.engine, "error");
  assert.equal(result.warning, "http_429");
});

// ── 3. Endpoint OK → LLM ──────────────────────────────────────────────────
test("endpoint OK → engine llm, valeurs du modèle appliquées", async () => {
  useKey("sk-test-ok");
  const generated = {
    metaTitle: "مطعم النخبة — حجز طاولات في طرابلس",
    metaDescription: "احجز طاولتك في مطعم النخبة بطرابلس.",
    metaTitleEn: "Nukhba Restaurant — Table booking in Tripoli",
    metaDescriptionEn: "Book a table at Nukhba Restaurant in Tripoli.",
    imageAltAr: "مطعم النخبة — واجهة موقع الحجز",
    imageAltEn: "Nukhba Restaurant — booking website preview",
  };
  mockFetch(llmPayload(generated));
  const result = await generateSeoCopy(DEMO);
  assert.equal(result.engine, "llm");
  assert.equal(result.warning, undefined);
  assert.deepEqual(result.copy, generated);
});

// ── 4. Troncature 60 / 160 / 125 ──────────────────────────────────────────
test("valeurs trop longues → troncature à 60/160/125", async () => {
  useKey("sk-test-long");
  const long = (n) => "ا".repeat(n);
  mockFetch(
    llmPayload({
      metaTitle: long(120),
      metaDescription: long(300),
      metaTitleEn: "T".repeat(120),
      metaDescriptionEn: "D".repeat(300),
      imageAltAr: long(200),
      imageAltEn: "A".repeat(200),
    }),
  );
  const result = await generateSeoCopy(DEMO);
  assert.equal(result.engine, "llm");
  assert.equal(result.copy.metaTitle.length, LIMITS.title);
  assert.equal(result.copy.metaDescription.length, LIMITS.description);
  assert.equal(result.copy.metaTitleEn.length, LIMITS.title);
  assert.equal(result.copy.metaDescriptionEn.length, LIMITS.description);
  assert.equal(result.copy.imageAltAr.length, LIMITS.alt);
  assert.equal(result.copy.imageAltEn.length, LIMITS.alt);
});

// ── 5. Timeout et réponses invalides ──────────────────────────────────────
test("abandon (timeout 20 s) → engine error, warning timeout", async () => {
  useKey("sk-test-timeout");
  globalThis.fetch = async () => {
    throw new DOMException("The operation was aborted.", "AbortError");
  };
  const result = await generateSeoCopy(DEMO);
  assert.equal(result.engine, "error");
  assert.equal(result.warning, "timeout");
  assert.deepEqual(result.copy, templateSeoCopy(DEMO));
});

test("contenu non JSON → warning invalid_json + gabarit", async () => {
  useKey("sk-test-json");
  mockFetch({ choices: [{ message: { content: "pas du json" } }] });
  const result = await generateSeoCopy(DEMO);
  assert.equal(result.engine, "error");
  assert.equal(result.warning, "invalid_json");
  assert.deepEqual(result.copy, templateSeoCopy(DEMO));
});

test("réponse vide → warning empty_response + gabarit", async () => {
  useKey("sk-test-vide");
  mockFetch({ choices: [{ message: { content: "   " } }] });
  const result = await generateSeoCopy(DEMO);
  assert.equal(result.engine, "error");
  assert.equal(result.warning, "empty_response");
});

test("objet JSON sans aucun champ exploitable → warning empty_response", async () => {
  useKey("sk-test-vide2");
  mockFetch(llmPayload({ foo: "bar" }));
  const result = await generateSeoCopy(DEMO);
  assert.equal(result.engine, "error");
  assert.equal(result.warning, "empty_response");
});

// ── 6. Auto-complétion & Batch SEO ────────────────────────────────────────
test("ensureDemoSeoFields complète les champs vides sans écraser les champs personnalisés", () => {
  const custom = ensureDemoSeoFields({
    ...DEMO,
    metaTitle: "Titre personnalisé AR",
    metaDescription: "",
  });
  assert.equal(custom.metaTitle, "Titre personnalisé AR");
  assert.ok(custom.metaDescription.length > 10);
  assert.ok(custom.metaTitleEn.length > 5);
  assert.ok(custom.imageAltAr.length > 5);
  assert.ok(custom.imageAltEn.length > 5);
});

test("generateSeoCopyBatch traite plusieurs démos en un appel", async () => {
  useKey(undefined);
  const batch = await generateSeoCopyBatch([DEMO, { ...DEMO, titleEn: "Second Project" }]);
  assert.equal(batch.engine, "template");
  assert.equal(batch.items.length, 2);
  assert.ok(batch.items[1].copy.metaTitleEn.includes("Second Project"));
});

// ── 7. Flux IA dynamiques /llms.txt et /llms-full.txt ─────────────────────
test("buildLlmsTxt et buildLlmsFullTxt synchronisent dynamiquement toutes les réalisations et tarifs", () => {
  const content = {
    demos: defaultDemos.map((d) => ensureDemoSeoFields(d)),
    faqs: defaultFaqs,
    testimonials: defaultTestimonials,
    hero: defaultHero,
    ribbon: defaultRibbon,
    whyUs: defaultWhyUs,
    process: defaultProcess,
    headings: defaultSectionHeadings,
  };
  const llms = buildLlmsTxt({ config: siteConfig, content });
  const llmsFull = buildLlmsFullTxt({ config: siteConfig, content });

  assert.ok(llms.includes("/llms-full.txt"));
  for (const demo of defaultDemos) {
    assert.ok(llms.includes(`/demos/${demo.slug}`), `llms.txt doit contenir /demos/${demo.slug}`);
    assert.ok(
      llmsFull.includes(`/demos/${demo.slug}`),
      `llms-full.txt doit contenir /demos/${demo.slug}`,
    );
  }
  for (const srv of siteConfig.standaloneServices) {
    assert.ok(llms.includes(srv.titleEn));
    assert.ok(llmsFull.includes(srv.titleAr));
    assert.ok(
      llms.includes(`/services/${srv.id}`),
      `llms.txt doit contenir la page /services/${srv.id}`,
    );
    assert.ok(
      llmsFull.includes(`/services/${srv.id}`),
      `llms-full.txt doit contenir la page /services/${srv.id}`,
    );
    assert.ok(
      llmsFull.includes(`$${srv.priceFromUsd}`),
      `llms-full.txt doit publier le tarif de ${srv.id}`,
    );
  }
  assert.ok(llms.includes("Preferred citation"));
  assert.ok(llmsFull.includes("Preferred Citations & Entity Facts"));
});

// ── 8. Schémas JSON-LD enrichis & Moteur d'audit SEO/GEO ──────────────────
test("schémas JSON-LD incluent geo, offre, HowTo — et aucun avis auto-déclaré", () => {
  const lb = localBusinessJsonLd(siteConfig, defaultTestimonials);
  assert.equal(lb.geo["@type"], "GeoCoordinates");
  // Politique Google : les avis qu'une entreprise publie sur sa propre page
  // ne sont pas éligibles aux rich results (self-serving reviews). On ne les
  // balise plus — les témoignages restent visibles dans le HTML.
  assert.equal(lb.review, undefined);
  assert.equal(lb.aggregateRating, undefined);
  assert.equal(lb.serviceArea["@type"], "GeoCircle");
  assert.equal(lb.serviceArea.geoRadius, "60000");
  assert.ok(lb.hasOfferCatalog["@id"].endsWith("/pricing#offer-catalog"));
  assert.deepEqual(lb.knowsLanguage, ["ar", "en", "fr"]);

  const catalog = offerCatalogJsonLd(siteConfig);
  assert.ok(catalog["@id"].endsWith("/pricing#offer-catalog"));
  assert.equal(
    catalog.itemListElement.length,
    siteConfig.pricing.plans.length + siteConfig.standaloneServices.length,
  );
  assert.deepEqual(
    catalog.itemListElement.slice(0, 3).map((offer) => offer.price),
    ["360", "612", "1056"],
    "les offres structurées publient le total modèle + 20 % de personnalisation",
  );

  const quoteConfig = {
    ...siteConfig,
    pricing: {
      ...siteConfig.pricing,
      plans: siteConfig.pricing.plans.map((plan) => ({
        ...plan,
        customizationPercent: null,
      })),
    },
  };
  const quoteCatalog = offerCatalogJsonLd(quoteConfig);
  assert.equal(quoteCatalog.itemListElement.length, siteConfig.standaloneServices.length);

  const pricedConfig = {
    ...siteConfig,
    pricing: {
      ...siteConfig.pricing,
      plans: siteConfig.pricing.plans.map((plan) => ({
        ...plan,
        customizationPercent: 5,
      })),
    },
  };
  const pricedCatalog = offerCatalogJsonLd(pricedConfig);
  assert.equal(
    pricedCatalog.itemListElement.length,
    siteConfig.pricing.plans.length + siteConfig.standaloneServices.length,
  );

  const howTo = howToJsonLd(siteConfig, defaultProcess);
  assert.equal(howTo["@type"], "HowTo");
  assert.equal(howTo.step.length, defaultProcess.length);

  const work = demoJsonLd(siteConfig, defaultDemos[0]);
  assert.equal(work["@type"], "CreativeWork");
  assert.ok(work.offers, "une offre avec personnalisation tarifée publie le total");
  const quoteWork = demoJsonLd(quoteConfig, defaultDemos[0]);
  assert.equal(quoteWork.offers, undefined, "un devis non confirmé ne doit pas être présenté comme total");
  const pricedWork = demoJsonLd(pricedConfig, defaultDemos[0]);
  assert.equal(pricedWork.offers["@type"], "Offer");
  assert.equal(Number(pricedWork.offers.price), 924);
  assert.equal(work.isPartOf["@id"], `${siteConfig.url}/#website`);
  assert.equal(work.mainEntityOfPage["@type"], "WebPage");
  assert.equal(work.about["@type"], "Thing");
});

test("runSeoAudit calcule un score 100/100 quand les réalisations sont auto-complétées", () => {
  const report = runSeoAudit(
    {
      demos: defaultDemos.map((d) => ensureDemoSeoFields(d)),
      faqs: defaultFaqs,
      testimonials: defaultTestimonials,
      process: defaultProcess,
    },
    siteConfig,
    { openAiConfigured: false, indexNowConfigured: true },
  );
  assert.equal(report.score, 100);
  assert.equal(report.summary.error, 0);
  assert.equal(report.summary.demosWithCompleteSeo, defaultDemos.length);
});
