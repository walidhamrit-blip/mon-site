#!/usr/bin/env node
/**
 * Tests légers de l'assistant SEO IA — `node:test`, aucune dépendance de test.
 *
 *   npm run test:seo
 *   (ou) node scripts/seo-generator.test.mjs
 *
 * Le module TypeScript `src/lib/ai/seo-generator.ts` est d'abord compilé à la
 * volée avec esbuild (déjà présent : dépendance de drizzle-kit/Next), alias
 * `@/` résolu comme dans tsconfig, puis importé. Aucun accès réseau réel :
 * `fetch` et `process.env.OPENAI_API_KEY` sont simulés pour chaque cas.
 *
 * Couverture :
 *   1. clé absente                → engine "template" + warning "missing_key" ;
 *   2. clé présente + HTTP 401    → engine "error"    + warning "http_401" ;
 *   3. endpoint OK                → engine "llm", valeurs appliquées ;
 *   4. valeurs trop longues       → troncature 60 / 160 / 125 ;
 *   5. timeout / réponses cassées → codes "timeout", "invalid_json",
 *      "empty_response" ;
 *   6. aucun secret ni corps brut ne fuit dans le résultat.
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
const outFile = join(outDir, "seo-generator.mjs");

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

await build({
  entryPoints: [join(srcRoot, "lib/ai/seo-generator.ts")],
  outfile: outFile,
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node22",
  plugins: [aliasPlugin],
  logLevel: "silent",
});

const { generateSeoCopy, templateSeoCopy, LIMITS } = await import(
  pathToFileURL(outFile).href
);

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
