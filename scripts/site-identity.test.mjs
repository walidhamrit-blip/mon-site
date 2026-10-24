#!/usr/bin/env node
/**
 * Tests « identité du site » — domaine canonique et origine publique.
 *
 * Quatre volets :
 *  1. `src/lib/site-identity.ts` : normalisation, extraction de domaine,
 *     précédence de résolution (admin → environnement → défaut) ;
 *  2. `src/lib/badge.ts` : les URL de crédit suivent le domaine configuré et
 *     la détection accepte plusieurs origines (migration de domaine) ;
 *  3. cohérence entre les replis des scripts (`badge-audit`, `geo-citations`)
 *     et la source de vérité ;
 *  4. garde-fou statique : le domaine n'est plus écrit en dur ailleurs que
 *     dans `src/lib/site-identity.ts`.
 *
 * Aucun appel réseau, aucun accès base : les modules testés sont purs.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("..", import.meta.url));
const srcRoot = join(root, "src");
const outDir = mkdtempSync(join(tmpdir(), "site-identity-"));

async function compileModule(entry, outName) {
  const outfile = join(outDir, outName);
  await build({
    entryPoints: [join(srcRoot, entry)],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    logLevel: "silent",
  });
  return import(pathToFileURL(outfile).href);
}

const identity = await compileModule("lib/site-identity.ts", "site-identity.mjs");
const badge = await compileModule("lib/badge.ts", "badge.mjs");

/* ---------------- Normalisation ---------------- */

test("normalizeOrigin complète le schéma et retire le slash final", () => {
  assert.equal(identity.normalizeOrigin("https://exemple.com/"), "https://exemple.com");
  assert.equal(identity.normalizeOrigin("exemple.com"), "https://exemple.com");
  assert.equal(identity.normalizeOrigin("  https://exemple.com///  "), "https://exemple.com");
  assert.equal(identity.normalizeOrigin("http://localhost:3000"), "http://localhost:3000");
  assert.equal(identity.normalizeOrigin(""), "");
  assert.equal(identity.normalizeOrigin(null), "");
});

test("domainFromOrigin retire le schéma, le www et le chemin", () => {
  assert.equal(identity.domainFromOrigin("https://www.exemple.com/chemin?a=1"), "exemple.com");
  assert.equal(identity.domainFromOrigin("exemple.com"), "exemple.com");
  assert.equal(identity.domainFromOrigin("HTTPS://Exemple.COM"), "exemple.com");
  assert.equal(identity.domainFromOrigin(""), "");
});

test("originFromDomain reconstruit une origine https", () => {
  assert.equal(identity.originFromDomain("exemple.com"), "https://exemple.com");
  assert.equal(identity.originFromDomain("www.exemple.com"), "https://exemple.com");
  assert.equal(identity.originFromDomain(""), identity.DEFAULT_SITE_ORIGIN);
});

test("normalizeOrigins dédoublonne par domaine et conserve l'ordre", () => {
  const origins = identity.normalizeOrigins([
    "https://exemple.com/",
    "https://www.exemple.com",
    "https://autre.com",
    "",
    null,
  ]);
  assert.deepEqual(origins, ["https://exemple.com", "https://autre.com"]);
});

/* ---------------- Résolution ---------------- */

test("resolveSiteOrigin : la configuration admin modifiée prime", () => {
  const previous = process.env.SITE_URL;
  process.env.SITE_URL = "https://deploiement.example";
  try {
    assert.equal(
      identity.resolveSiteOrigin({ url: "https://exemple.com", domain: "exemple.com" }),
      "https://exemple.com",
      "un domaine choisi dans /admin doit primer sur la variable d'environnement",
    );
  } finally {
    if (previous === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = previous;
  }
});

test("resolveSiteOrigin : l'environnement sert quand l'admin n'a pas été touchée", () => {
  const previous = process.env.SITE_URL;
  process.env.SITE_URL = "https://deploiement.example";
  try {
    assert.equal(
      identity.resolveSiteOrigin({
        url: identity.DEFAULT_SITE_ORIGIN,
        domain: identity.DEFAULT_SITE_DOMAIN,
      }),
      "https://deploiement.example",
    );
  } finally {
    if (previous === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = previous;
  }
});

test("resolveSiteOrigin : le domaine seul suffit, et le défaut reste la valeur de repli", () => {
  const previous = process.env.SITE_URL;
  delete process.env.SITE_URL;
  try {
    assert.equal(
      identity.resolveSiteOrigin({ domain: "exemple.com" }),
      "https://exemple.com",
    );
    assert.equal(identity.resolveSiteOrigin({}), identity.DEFAULT_SITE_ORIGIN);
    assert.equal(identity.resolveSiteOrigin(), identity.DEFAULT_SITE_ORIGIN);
  } finally {
    if (previous !== undefined) process.env.SITE_URL = previous;
  }
});

/* ---------------- Badge ---------------- */

test("les URL de crédit suivent le domaine fourni", () => {
  assert.equal(badge.badgeCanonical(), `${identity.DEFAULT_SITE_ORIGIN}/`);
  assert.equal(badge.badgeCanonical("https://exemple.com"), "https://exemple.com/");
  assert.match(badge.badgeLink("https://exemple.com"), /^https:\/\/exemple\.com\/\?utm_source=client_footer/);
});

test("les extraits copiables pointent vers le domaine configuré", () => {
  const html = badge.badgeHtmlSnippet({ origin: "https://exemple.com" });
  assert.match(html, /href="https:\/\/exemple\.com\/\?utm_source=client_footer/);
  assert.match(html, /src="https:\/\/exemple\.com\/badge\/nukhba-badge\.svg"/);
});

test("la détection accepte plusieurs origines et refuse les imitations", () => {
  const link = '<a href="https://exemple.com/?utm_source=client_footer"><img src="/b.svg"></a>';
  assert.equal(badge.detectBadge(link).found, false);
  assert.equal(badge.detectBadge(link, { origins: ["https://exemple.com"] }).found, true);
  assert.equal(
    badge.detectBadge('<a href="https://exemple.com.evil.net/">x</a>', {
      origins: ["https://exemple.com"],
    }).found,
    false,
    "un domaine qui se termine par le bon nom mais pointe ailleurs doit être refusé",
  );
});

/* ---------------- Cohérence des scripts ---------------- */

test("les replis des scripts correspondent à la source de vérité", async () => {
  const audit = await import(pathToFileURL(join(root, "scripts", "badge-audit.mjs")).href);
  assert.equal(
    audit.DEFAULT_BADGE_ORIGIN,
    identity.DEFAULT_SITE_ORIGIN,
    "scripts/badge-audit.mjs doit recopier src/lib/site-identity.ts",
  );

  const geo = await import(pathToFileURL(join(root, "scripts", "geo-citations.mjs")).href);
  assert.equal(
    geo.BRAND_DOMAIN,
    identity.DEFAULT_SITE_DOMAIN,
    "scripts/geo-citations.mjs doit recopier src/lib/site-identity.ts",
  );
});

test("resolveBadgeOrigins privilégie l'API du site puis accepte les domaines historiques", async () => {
  const audit = await import(pathToFileURL(join(root, "scripts", "badge-audit.mjs")).href);
  const origins = audit.resolveBadgeOrigins(
    { base: "https://exemple.com" },
    { BADGE_ORIGIN: "", SITE_URL: "", NEXT_PUBLIC_SITE_URL: "" },
  );
  assert.deepEqual(origins, ["https://exemple.com"]);

  const withLegacy = audit.resolveBadgeOrigins(
    { base: "https://exemple.com", accept: ["https://ancien.com"] },
    { BADGE_ORIGIN: "", SITE_URL: "", NEXT_PUBLIC_SITE_URL: "" },
  );
  assert.deepEqual(withLegacy, ["https://exemple.com", "https://ancien.com"]);
});

/* ---------------- Garde-fou statique ---------------- */

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (/\.(ts|tsx|mjs|js)$/.test(entry)) files.push(full);
  }
  return files;
}

test("le domaine n'est écrit en dur que dans la source de vérité", () => {
  const allowed = new Set([
    join(srcRoot, "lib", "site-identity.ts"),
    join(root, "scripts", "badge-audit.mjs"),
    join(root, "scripts", "geo-citations.mjs"),
  ]);
  const offenders = [];
  for (const file of walk(srcRoot)) {
    if (allowed.has(file)) continue;
    if (file.endsWith(".test.mjs")) continue;
    if (readFileSync(file, "utf8").includes(identity.DEFAULT_SITE_DOMAIN)) {
      offenders.push(relative(root, file));
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `domaine figé hors src/lib/site-identity.ts : ${offenders.join(", ")}`,
  );
});

test("l'admin expose bien les deux champs de domaine", () => {
  const form = readFileSync(
    join(srcRoot, "app", "admin", "(panel)", "settings", "settings-form.tsx"),
    "utf8",
  );
  assert.match(form, /form\.domain/, "le champ « domaine » doit rester éditable");
  assert.match(form, /form\.url/, "le champ « URL canonique » doit rester éditable");
});
