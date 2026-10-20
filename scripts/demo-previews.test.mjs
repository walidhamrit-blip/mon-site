#!/usr/bin/env node
/**
 * Tests de l'automatisation des captures (`scripts/capture-previews.mjs`) et
 * du manifeste lu par le site (`src/lib/preview-manifest.ts`).
 *
 * Aucun navigateur ni appel réseau : Playwright, Sharp et `fetch` sont
 * remplacés par des doubles dans `captureAll()`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

import {
  MANIFEST_VERSION,
  VIEWPORTS,
  OUTPUT_SIZES,
  normalizePreviewUrl,
  isCapturableUrl,
  safeSlug,
  previewFileNames,
  shortHash,
  hashBuffers,
  classifyHttpStatus,
  mergeManifest,
  summarizeResults,
  captureAll,
} from "./capture-previews.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const srcRoot = join(root, "src");
const outDir = mkdtempSync(join(tmpdir(), "previews-"));

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

const manifestLib = await compileModule("lib/preview-manifest.ts", "preview-manifest.mjs");
const { projectPreview } = await (async () => {
  const mod = await compileModule("lib/project-previews.ts", "project-previews.mjs");
  return { projectPreview: mod.getProjectPreview };
})();

const manifestPath = join(root, "public", "previews", "manifest.json");
const onDiskManifest = JSON.parse(readFileSync(manifestPath, "utf8"));

test.after(() => {
  rmSync(outDir, { recursive: true, force: true });
});

/* ───────────────────────── Helpers de capture ───────────────────────── */

test("normalizePreviewUrl retire slash, query et fragment", () => {
  assert.equal(normalizePreviewUrl("https://x.vercel.app/"), "https://x.vercel.app");
  assert.equal(normalizePreviewUrl(" https://x.vercel.app/page/?a=1#top "), "https://x.vercel.app/page");
  assert.equal(normalizePreviewUrl("#"), "");
  assert.equal(normalizePreviewUrl(""), "");
  // Même normalisation des deux côtés (script ↔ site)
  for (const url of [
    "https://a.vercel.app/",
    "https://b.vercel.app/x/?q=1",
    "https://c.vercel.app",
  ]) {
    assert.equal(normalizePreviewUrl(url), manifestLib.normalizePreviewUrl(url));
  }
});

test("isCapturableUrl refuse localhost, fichiers et entrées vides", () => {
  assert.equal(isCapturableUrl("https://demo.vercel.app/"), true);
  assert.equal(isCapturableUrl("http://demo.example.com"), true);
  assert.equal(isCapturableUrl("#"), false);
  assert.equal(isCapturableUrl(""), false);
  assert.equal(isCapturableUrl("/previews/x.webp"), false);
  assert.equal(isCapturableUrl("http://localhost:3000"), false);
  assert.equal(isCapturableUrl("http://127.0.0.1:3100/"), false);
  assert.equal(isCapturableUrl("https://demo.local"), false);
  assert.equal(isCapturableUrl("ftp://demo.example.com"), false);
});

test("safeSlug produit des noms de fichiers sûrs et uniques", () => {
  assert.equal(safeSlug("al-manhaj-company"), "al-manhaj-company");
  assert.equal(safeSlug("Hala Dun!"), "hala-dun");
  assert.equal(safeSlug("  "), "demo");
  assert.equal(safeSlug("", "https://hala-dun.vercel.app/"), "hala-dun-vercel-app");
  assert.equal(safeSlug("مقهى"), "demo");
  assert.match(previewFileNames("x").desktop, /^\/previews\/x-desktop\.webp$/);
  assert.match(previewFileNames("x").mobile, /^\/previews\/x-mobile\.webp$/);
});

test("shortHash / hashBuffers sont stables et courts", () => {
  const a = Buffer.from("desktop");
  const b = Buffer.from("mobile");
  assert.equal(shortHash(a), shortHash(a));
  assert.notEqual(shortHash(a), shortHash(b));
  assert.equal(shortHash(a).length, 10);
  assert.equal(hashBuffers(a, b), hashBuffers(a, b));
  assert.notEqual(hashBuffers(a, b), hashBuffers(b, a));
});

test("classifyHttpStatus distingue 2xx des autres", () => {
  assert.equal(classifyHttpStatus(200), "ok");
  assert.equal(classifyHttpStatus(204), "ok");
  assert.equal(classifyHttpStatus(301), "down");
  assert.equal(classifyHttpStatus(404), "down");
  assert.equal(classifyHttpStatus(503), "down");
  assert.equal(classifyHttpStatus(0), "down");
});

test("mergeManifest conserve les projets absents du run et n'écrase pas tout", () => {
  const previous = {
    version: 1,
    generatedAt: "2026-01-01T00:00:00.000Z",
    projects: {
      "https://a.vercel.app": { slug: "a", desktop: "/previews/a-desktop.webp" },
      "https://b.vercel.app": { slug: "b", desktop: "/previews/b-desktop.webp" },
    },
  };
  const now = new Date("2026-10-20T10:00:00.000Z");
  const merged = mergeManifest(
    previous,
    { "https://b.vercel.app": { status: "down", httpStatus: 503 } },
    { now },
  );
  assert.equal(merged.version, MANIFEST_VERSION);
  assert.equal(merged.generatedAt, now.toISOString());
  assert.deepEqual(merged.projects["https://a.vercel.app"], previous.projects["https://a.vercel.app"]);
  assert.equal(merged.projects["https://b.vercel.app"].desktop, "/previews/b-desktop.webp");
  assert.equal(merged.projects["https://b.vercel.app"].status, "down");
  // le manifeste précédent n'est pas muté
  assert.equal(previous.projects["https://b.vercel.app"].status, undefined);
});

test("summarizeResults agrège les issues d'un run", () => {
  const summary = summarizeResults([
    { outcome: "captured" },
    { outcome: "captured" },
    { outcome: "down" },
    { outcome: "error" },
    { outcome: "skipped" },
  ]);
  assert.deepEqual(summary, {
    total: 5,
    captured: 2,
    unchanged: 0,
    down: 1,
    error: 1,
    skipped: 1,
  });
  assert.equal(summarizeResults([{ outcome: "unchanged" }]).unchanged, 1);
});

/* ─────────────────────── Orchestration (doubles) ─────────────────────── */

const demos = [
  { slug: "ok-demo", previewUrl: "https://ok.vercel.app/", title: "OK" },
  { slug: "down-demo", previewUrl: "https://down.vercel.app/", title: "Down" },
  { slug: "skip-demo", previewUrl: "#", title: "Skip" },
];

function fakeDeps({ failCapture = [] } = {}) {
  const writes = [];
  return {
    writes,
    deps: {
      checkUrl: async (url) => {
        if (url.includes("down.")) return { ok: false, status: 503 };
        return { ok: true, status: 200 };
      },
      capture: async ({ url }) => {
        if (failCapture.some((needle) => url.includes(needle))) {
          throw new Error("Timeout de capture");
        }
        return Buffer.from(`png:${url}`);
      },
      convert: async (buffer, size) => ({
        buffer: Buffer.from(`webp:${size.width}x${size.height}:${buffer.toString()}`),
        hash: "hash",
      }),
      writePreview: async (path, buffer) => writes.push({ path, buffer }),
    },
  };
}

test("captureAll capture les démos joignables et ignore les URL non capturables", async () => {
  const { deps, writes } = fakeDeps();
  const { results, summary, updates, manifest } = await captureAll({
    demos,
    previousManifest: null,
    deps,
    options: { force: true },
    now: new Date("2026-10-20T12:00:00.000Z"),
  });

  assert.equal(summary.captured, 1);
  assert.equal(summary.down, 1);
  assert.equal(summary.skipped, 1);
  // L'ordre n'est pas garanti (pool de workers) : on compare en ensemble.
  assert.deepEqual(
    results.map((result) => `${result.slug}:${result.outcome}`).sort(),
    ["down-demo:down", "ok-demo:captured", "skip-demo:skipped"],
  );

  // Deux fichiers écrits (desktop + mobile)
  assert.deepEqual(writes.map((write) => write.path).sort(), [
    "/previews/ok-demo-desktop.webp",
    "/previews/ok-demo-mobile.webp",
  ]);

  const entry = updates["https://ok.vercel.app"];
  assert.equal(entry.slug, "ok-demo");
  assert.equal(entry.status, "ok");
  assert.equal(entry.screenshot, true);
  assert.equal(entry.source, "playwright");
  assert.equal(entry.httpStatus, 200);
  assert.deepEqual(entry.desktopSize, OUTPUT_SIZES.desktop);
  assert.equal(manifest.version, MANIFEST_VERSION);
  assert.deepEqual(manifest.viewports, VIEWPORTS);
});

test("une démo hors ligne conserve sa capture précédente marquée down", async () => {
  const previous = {
    version: 1,
    generatedAt: "2026-09-01T00:00:00.000Z",
    projects: {
      "https://down.vercel.app": {
        slug: "down-demo",
        desktop: "/previews/down-demo-desktop.webp",
        mobile: "/previews/down-demo-mobile.webp",
        hash: "oldhash",
        capturedAt: "2026-09-01T00:00:00.000Z",
        status: "ok",
        screenshot: true,
        source: "playwright",
      },
    },
  };
  const { deps } = fakeDeps();
  const { results, updates } = await captureAll({
    demos: [demos[1]],
    previousManifest: previous,
    deps,
    options: { force: true },
    now: new Date("2026-10-20T12:00:00.000Z"),
  });

  assert.equal(results[0].outcome, "down");
  assert.equal(results[0].keptPreviousCapture, true);
  const entry = updates["https://down.vercel.app"];
  assert.equal(entry.status, "down");
  assert.equal(entry.httpStatus, 503);
  assert.equal(entry.desktop, "/previews/down-demo-desktop.webp", "la capture est conservée");
  assert.equal(entry.hash, "oldhash");
  assert.match(entry.lastError, /503/);
});

test("une capture récente est ignorée sauf avec --force", async () => {
  const previous = {
    version: 1,
    generatedAt: "2026-10-19T00:00:00.000Z",
    projects: {
      "https://ok.vercel.app": {
        slug: "ok-demo",
        capturedAt: "2026-10-19T00:00:00.000Z",
        status: "ok",
        source: "playwright",
      },
    },
  };
  const { deps, writes } = fakeDeps();
  const skipped = await captureAll({
    demos: [demos[0]],
    previousManifest: previous,
    deps,
    options: {},
    now: new Date("2026-10-20T12:00:00.000Z"),
  });
  assert.equal(skipped.results[0].outcome, "skipped");
  assert.equal(skipped.results[0].reason, "recent");
  assert.equal(writes.length, 0);

  const forced = await captureAll({
    demos: [demos[0]],
    previousManifest: previous,
    deps,
    options: { force: true },
    now: new Date("2026-10-20T12:00:00.000Z"),
  });
  assert.equal(forced.results[0].outcome, "captured");
  assert.equal(writes.length, 2);
});

test("--only limite le run sans supprimer les autres entrées du manifeste", async () => {
  const previous = {
    version: 1,
    generatedAt: "2026-09-01T00:00:00.000Z",
    projects: {
      "https://other.vercel.app": { slug: "other", desktop: "/previews/other-desktop.webp" },
    },
  };
  const { deps } = fakeDeps();
  const { results, manifest } = await captureAll({
    demos: [demos[0], { slug: "other", previewUrl: "https://other.vercel.app" }],
    previousManifest: previous,
    deps,
    options: { only: ["ok-demo"], force: true },
  });
  assert.equal(results.length, 1);
  assert.equal(results[0].slug, "ok-demo");
  assert.ok(manifest.projects["https://other.vercel.app"]);
  assert.ok(manifest.projects["https://ok.vercel.app"]);
});

test("une erreur de capture est isolée et n'empêche pas les autres démos", async () => {
  const { deps } = fakeDeps({ failCapture: ["ok."] });
  const { results, summary } = await captureAll({
    demos: [demos[0], { slug: "second", previewUrl: "https://second.vercel.app/" }],
    previousManifest: null,
    deps,
    options: { concurrency: 1, force: true },
  });
  assert.equal(summary.error, 1);
  assert.equal(summary.captured, 1);
  const errored = results.find((result) => result.outcome === "error");
  assert.match(errored.error, /Timeout/);
});

test("--dry-run n'écrit aucun fichier, ne capture rien et n'appelle pas le réseau", async () => {
  const { deps, writes } = fakeDeps();
  let networkCalls = 0;
  deps.checkUrl = async () => {
    networkCalls += 1;
    return { ok: true, status: 200 };
  };
  const { summary, results } = await captureAll({
    demos: [demos[0]],
    previousManifest: null,
    deps,
    options: { dryRun: true, force: true },
  });
  assert.equal(summary.captured, 1);
  assert.equal(results[0].dryRun, true);
  assert.equal(writes.length, 0);
  assert.equal(networkCalls, 0);
});

test("un rendu identique est marqué inchangé (aucun commit de binaires)", async () => {
  const previous = {
    version: 1,
    generatedAt: "2026-10-19T00:00:00.000Z",
    projects: {
      "https://ok.vercel.app": {
        slug: "ok-demo",
        desktop: "/previews/ok-demo-desktop.webp",
        mobile: "/previews/ok-demo-mobile.webp",
        hash: hashBuffers(
          Buffer.from("webp:960x600:png:https://ok.vercel.app"),
          Buffer.from("webp:390x693:png:https://ok.vercel.app"),
        ),
        capturedAt: "2026-10-19T00:00:00.000Z",
        status: "ok",
        screenshot: true,
        source: "playwright",
      },
    },
  };
  const { deps, writes } = fakeDeps();
  const { results, updates, summary } = await captureAll({
    demos: [demos[0]],
    previousManifest: previous,
    deps,
    options: { force: false, maxAgeDays: 0 },
    now: new Date("2026-10-20T12:00:00.000Z"),
  });
  assert.equal(results[0].outcome, "unchanged");
  assert.equal(writes.length, 0);
  assert.equal(summary.unchanged, 1);
  assert.equal(updates["https://ok.vercel.app"].capturedAt, "2026-10-19T00:00:00.000Z");
  assert.equal(updates["https://ok.vercel.app"].status, "ok");
});

test("les chemins publiés sont réutilisés (URL stable) sauf visuel partagé", async () => {
  // hala-perfumes : le slug du contenu ne correspond pas au nom de fichier
  // historique — on garde les fichiers déjà servis pour ne pas casser les URL.
  const previous = {
    version: 1,
    generatedAt: "2026-10-01T00:00:00.000Z",
    projects: {
      "https://ok.vercel.app": {
        slug: "hala-perfumes",
        desktop: "/previews/hala-perfumes-desktop.webp",
        mobile: "/previews/hala-perfumes-mobile.webp",
        hash: "ancien",
        capturedAt: "2026-10-01T00:00:00.000Z",
        status: "ok",
        screenshot: true,
        source: "playwright",
      },
    },
  };
  const first = fakeDeps();
  const reused = await captureAll({
    demos: [demos[0]],
    previousManifest: previous,
    deps: first.deps,
    options: { force: true },
    now: new Date("2026-10-20T12:00:00.000Z"),
  });
  assert.deepEqual(first.writes.map((write) => write.path).sort(), [
    "/previews/hala-perfumes-desktop.webp",
    "/previews/hala-perfumes-mobile.webp",
  ]);
  assert.equal(reused.updates["https://ok.vercel.app"].slug, "hala-perfumes");

  // Visuel unique partagé ordinateur/téléphone (ex. tripo-teck-visual.webp) :
  // la capture produit deux fichiers distincts, sans écraser l'ancien visuel.
  const shared = {
    ...previous,
    projects: {
      "https://ok.vercel.app": {
        ...previous.projects["https://ok.vercel.app"],
        slug: "tripo-teck-outillage",
        desktop: "/previews/tripo-teck-visual.webp",
        mobile: "/previews/tripo-teck-visual.webp",
      },
    },
  };
  const second = fakeDeps();
  const split = await captureAll({
    demos: [demos[0]],
    previousManifest: shared,
    deps: second.deps,
    options: { force: true },
    now: new Date("2026-10-20T12:00:00.000Z"),
  });
  assert.deepEqual(second.writes.map((write) => write.path).sort(), [
    "/previews/ok-demo-desktop.webp",
    "/previews/ok-demo-mobile.webp",
  ]);
  assert.equal(split.updates["https://ok.vercel.app"].slug, "ok-demo");
});

/* ───────────────────── Lecture du manifeste par le site ───────────────────── */

test("le manifeste committé est valide et couvre les captures existantes", () => {
  assert.equal(onDiskManifest.version, MANIFEST_VERSION);
  assert.ok(Object.keys(onDiskManifest.projects).length >= 4);
  for (const [url, entry] of Object.entries(onDiskManifest.projects)) {
    assert.equal(url, normalizePreviewUrl(url), `clé non normalisée : ${url}`);
    assert.ok(entry.slug);
    assert.match(entry.desktop, /^\/previews\/[a-z0-9-]+\.webp$/);
    assert.match(entry.mobile, /^\/previews\/[a-z0-9-]+\.webp$/);
    assert.equal(typeof entry.screenshot, "boolean");
  }
});

test("findPreviewEntry / previewSrc gèrent l'anti-cache et les absences", () => {
  const entry = manifestLib.findPreviewEntry("https://al-manhaj-company.vercel.app/");
  assert.ok(entry);
  assert.equal(entry.slug, "al-manhaj-company");
  assert.equal(
    manifestLib.previewSrc(entry, "desktop"),
    "/previews/al-manhaj-company-desktop.webp?v=Qczn4Pr0NM",
  );
  assert.equal(
    manifestLib.previewSrc(entry, "mobile"),
    "/previews/al-manhaj-company-mobile.webp?v=Qczn4Pr0NM",
  );
  assert.equal(manifestLib.findPreviewEntry("https://inconnu.example.com"), null);
  assert.equal(manifestLib.previewSrc(null, "desktop"), null);
});

test("getDemoPreview privilégie le manifeste puis retombe sur l'image du portfolio", () => {
  const known = manifestLib.getDemoPreview(
    { previewUrl: "https://hala-dun.vercel.app", image: "https://cdn/x.jpg" },
    "desktop",
  );
  assert.equal(known.src, "/previews/hala-perfumes-desktop.webp?v=mkNYWXBepQ");
  assert.equal(known.local, true);
  assert.equal(known.screenshot, true);

  const unknown = manifestLib.getDemoPreview(
    { previewUrl: "https://unknown.example.com", image: "https://cdn/x.jpg" },
    "mobile",
  );
  assert.equal(unknown.src, "https://cdn/x.jpg");
  assert.equal(unknown.local, false);
});

test("getDemoPreviewImages renvoie des chemins uniques sans query", () => {
  const images = manifestLib.getDemoPreviewImages({
    previewUrl: "https://m-et-outillage-modele-3.vercel.app",
  });
  // desktop et mobile pointent vers le même visuel : dédoublonné
  assert.deepEqual(images, ["/previews/tripo-teck-visual.webp"]);
});

test("getProjectPreview (carrousel) lit le manifeste", () => {
  const demo = {
    previewUrl: "https://al-manhaj-company.vercel.app/",
    image: "https://cdn/x.jpg",
  };
  const desktop = projectPreview(demo, "desktop");
  assert.equal(desktop.src, "/previews/al-manhaj-company-desktop.webp?v=Qczn4Pr0NM");
  assert.equal(desktop.screenshot, true);
});

test("getDemoCapturedAt renvoie une date exploitable par le sitemap", () => {
  const date = manifestLib.getDemoCapturedAt({
    previewUrl: "https://al-manhaj-company.vercel.app",
  });
  assert.ok(date instanceof Date && !Number.isNaN(date.getTime()));
  assert.equal(
    manifestLib.getDemoCapturedAt({ previewUrl: "https://inconnu.example.com" }),
    null,
  );
});
