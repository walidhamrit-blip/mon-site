#!/usr/bin/env node
/**
 * Tests du badge de netlinking client : détection dans le HTML d'un site
 * client (`src/lib/badge.ts`) et orchestration de l'audit
 * (`scripts/badge-audit.mjs`).
 *
 * Aucun appel réseau : `fetchHtml` est remplacé par un double.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

import {
  CLIENTS_VERSION,
  SCAN_PATHS,
  normalizeUrl,
  isAuditableUrl,
  classifyStatus,
  mergeClients,
  summarize,
  adviceFor,
  auditAll,
} from "./badge-audit.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const srcRoot = join(root, "src");
const outDir = mkdtempSync(join(tmpdir(), "badge-"));

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

const badge = await compileModule("lib/badge.ts", "badge.mjs");
const clientsPath = join(root, "public", "badge", "clients.json");
const onDiskClients = JSON.parse(readFileSync(clientsPath, "utf8"));

test.after(() => {
  rmSync(outDir, { recursive: true, force: true });
});

/* ───────────────────────── Helpers d'URL ───────────────────────── */

test("normalizeUrl retire slash, query et fragment", () => {
  assert.equal(normalizeUrl("https://x.vercel.app/"), "https://x.vercel.app");
  assert.equal(normalizeUrl(" https://x.vercel.app/a/?a=1#top "), "https://x.vercel.app/a");
  assert.equal(normalizeUrl("#"), "");
  assert.equal(normalizeUrl(""), "");
});

test("isAuditableUrl refuse localhost et les hôtes non publics", () => {
  assert.equal(isAuditableUrl("https://client.vercel.app/"), true);
  assert.equal(isAuditableUrl("http://localhost:3000"), false);
  assert.equal(isAuditableUrl("http://127.0.0.1:8080"), false);
  assert.equal(isAuditableUrl("https://demo.local"), false);
  assert.equal(isAuditableUrl("ftp://client.com"), false);
  assert.equal(isAuditableUrl(""), false);
});

test("classifyStatus distingue 2xx des autres", () => {
  assert.equal(classifyStatus(200), "ok");
  assert.equal(classifyStatus(204), "ok");
  assert.equal(classifyStatus(301), "down");
  assert.equal(classifyStatus(404), "down");
  assert.equal(classifyStatus(0), "down");
});

test("les chemins de repli sont essayés dans un ordre stable", () => {
  assert.deepEqual(SCAN_PATHS, ["/", "/ar", "/en"]);
});

/* ───────────────────────── Détection du badge ───────────────────────── */

test("detectBadge trouve un lien dofollow avec ancre et utm", () => {
  const html = `
    <footer>
      <a href="https://nokhba.net.ly/?utm_source=client_footer&amp;utm_medium=badge"
         target="_blank" rel="noopener" title="نخبة">
        <img src="https://nokhba.net.ly/badge/nukhba-badge.svg" alt="Website by Nukhba">
      </a>
    </footer>`;
  const result = badge.detectBadge(html);
  assert.equal(result.found, true);
  assert.equal(result.nofollow, false);
  assert.equal(result.utm, true);
  assert.match(result.href, /nokhba\.net\.ly/);
});

test("detectBadge reconnaît un lien nofollow (badge dégradé)", () => {
  const html = `<a rel="nofollow noopener" href="https://www.nokhba.net.ly/">Website by Nukhba</a>`;
  const result = badge.detectBadge(html);
  assert.equal(result.found, true);
  assert.equal(result.nofollow, true);
  assert.equal(result.anchor, "Website by Nukhba");
  assert.equal(result.rel, "nofollow noopener");
});

test("detectBadge ignore les liens hors nokhba.net.ly et les imitations", () => {
  for (const html of [
    `<a href="https://nokhba.net.ly.evil.com/">x</a>`,
    `<a href="https://notnokhba.net.ly/">x</a>`,
    `<a href="https://example.com/nokhba.net.ly">x</a>`,
    `<a href="/contact">Contact</a>`,
    "",
  ]) {
    assert.equal(badge.detectBadge(html).found, false, html);
  }
});

test("detectBadge accepte un href non quoté et une ancre arabe", () => {
  const html = `<a href=https://nokhba.net.ly dir=rtl>تصميم وتطوير المواقع — نخبة طرابلس</a>`;
  const result = badge.detectBadge(html);
  assert.equal(result.found, true);
  assert.equal(result.href, "https://nokhba.net.ly");
  assert.match(result.anchor, /نخبة/);
});

test("detectBadge signale une image sans texte d'ancre", () => {
  const html = `<a href="https://nokhba.net.ly/"><img src="/badge.svg" alt="badge"></a>`;
  const result = badge.detectBadge(html);
  assert.equal(result.found, true);
  assert.equal(result.imageOnly, true);
  assert.equal(result.anchor, null);
});

/* ───────────────────────── Extraits copiables ───────────────────────── */

test("badgeHtmlSnippet pointe vers le lien de crédit et le bon asset", () => {
  const html = badge.badgeHtmlSnippet();
  assert.match(html, /href="https:\/\/nokhba\.net\.ly\/\?utm_source=client_footer/);
  assert.match(html, /src="https:\/\/nokhba\.net\.ly\/badge\/nukhba-badge\.svg"/);
  assert.match(html, /width="176"/);
  assert.match(html, /loading="lazy"/);
  assert.match(html, /rel="noopener"/);
  assert.match(html, /تصميم وتطوير المواقع/);
});

test("badgeHtmlSnippet variante claire et texte visible", () => {
  const html = badge.badgeHtmlSnippet({ variant: "light", withText: true });
  assert.match(html, /nukhba-badge-light\.svg/);
  assert.match(html, /<span style=/);
  assert.match(html, /Website by Nukhba/);
});

test("badgeReactSnippet produit du JSX valide et sans nofollow", () => {
  const jsx = badge.badgeReactSnippet();
  assert.match(jsx, /export function NukhbaBadge\(\)/);
  assert.match(jsx, /width=\{176\}/);
  assert.match(jsx, /href="https:\/\/nokhba\.net\.ly\//);
  assert.doesNotMatch(jsx, /nofollow/);
});

test("aucun extrait ne contient rel=nofollow", () => {
  for (const snippet of [
    badge.badgeHtmlSnippet(),
    badge.badgeHtmlSnippet({ variant: "light", withText: true }),
    badge.badgeReactSnippet({ withText: true }),
  ]) {
    assert.doesNotMatch(snippet, /nofollow/i);
  }
});

test("les constantes du badge restent cohérentes", () => {
  assert.equal(badge.BADGE_CANONICAL, "https://nokhba.net.ly/");
  assert.match(badge.BADGE_LINK, /utm_source=client_footer/);
  assert.equal(badge.BADGE_WIDTH, 176);
  assert.equal(badge.BADGE_HEIGHT, 44);
  assert.equal(badge.BADGE_ASSET, "/badge/nukhba-badge.svg");
  assert.notEqual(badge.BADGE_ASSET, badge.BADGE_ASSET_LIGHT);
});

/* ───────────────────────── Lecture du fichier clients ───────────────────────── */

test("le fichier clients committé est valide et couvre les démos", () => {
  assert.equal(onDiskClients.version, CLIENTS_VERSION);
  const entries = Object.entries(onDiskClients.clients ?? {});
  assert.ok(entries.length >= 1, `attendu ≥ 1 client, reçu ${entries.length}`);
  for (const [url, entry] of entries) {
    assert.match(url, /^https?:\/\//, `clé non absolue : ${url}`);
    assert.doesNotMatch(url, /\/$/, `clé avec slash final : ${url}`);
    assert.ok(entry.slug, `slug manquant pour ${url}`);
    assert.ok(
      ["verified", "nofollow", "missing", "down", "pending"].includes(entry.status),
      `statut inconnu pour ${url} : ${entry.status}`,
    );
  }
});

test("findBadgeClient normalise le slash final et ignore les inconnus", () => {
  const source = {
    version: 1,
    generatedAt: "2026-10-20T00:00:00.000Z",
    clients: {
      "https://client.vercel.app": {
        slug: "client",
        title: "Client",
        status: "verified",
        checkedAt: "2026-10-20T00:00:00.000Z",
      },
    },
  };
  assert.equal(
    badge.findBadgeClient("https://client.vercel.app/", source)?.entry.slug,
    "client",
  );
  assert.equal(badge.findBadgeClient("https://autre.vercel.app", source), null);
  assert.equal(badge.findBadgeClient("", source), null);
});

test("badgeStats et linkedClients agrègent les statuts", () => {
  const source = {
    version: 1,
    generatedAt: "2026-10-20T00:00:00.000Z",
    clients: {
      a: { slug: "a", title: "A", status: "verified", checkedAt: null },
      b: { slug: "b", title: "B", status: "verified", checkedAt: null },
      c: { slug: "c", title: "C", status: "nofollow", checkedAt: null },
      d: { slug: "d", title: "D", status: "missing", checkedAt: null },
      e: { slug: "e", title: "E", status: "down", checkedAt: null },
    },
  };
  assert.deepEqual(badge.badgeStats(source), {
    total: 5,
    verified: 2,
    nofollow: 1,
    missing: 1,
    down: 1,
    pending: 0,
  });
  assert.deepEqual(
    badge.linkedClients(source).map((item) => item.entry.slug),
    ["a", "b", "c"],
  );
});

test("le fichier clients réel se lit sans erreur et son total est positif", () => {
  const stats = badge.badgeStats(onDiskClients);
  assert.ok(stats.total >= 1);
  assert.equal(
    stats.total,
    stats.verified + stats.nofollow + stats.missing + stats.down + stats.pending,
  );
});

/* ───────────────────────── Fusion du fichier ───────────────────────── */

test("mergeClients conserve checkedAt quand le statut ne change pas", () => {
  const previous = {
    version: 1,
    generatedAt: "2026-10-01T00:00:00.000Z",
    clients: {
      "https://a.vercel.app": {
        slug: "a",
        title: "A",
        status: "missing",
        checkedAt: "2026-10-01T00:00:00.000Z",
      },
    },
  };
  const same = mergeClients(
    previous,
    [{ url: "https://a.vercel.app", slug: "a", status: "missing" }],
    { now: new Date("2026-10-20T00:00:00.000Z") },
  );
  assert.equal(same.changed, false);
  assert.equal(same.doc.clients["https://a.vercel.app"].checkedAt, "2026-10-01T00:00:00.000Z");
  assert.equal(same.doc.generatedAt, "2026-10-01T00:00:00.000Z");

  const changed = mergeClients(
    previous,
    [{ url: "https://a.vercel.app", slug: "a", status: "verified", anchor: "Nukhba" }],
    { now: new Date("2026-10-20T00:00:00.000Z") },
  );
  assert.equal(changed.changed, true);
  assert.equal(changed.doc.clients["https://a.vercel.app"].status, "verified");
  assert.equal(changed.doc.clients["https://a.vercel.app"].checkedAt, "2026-10-20T00:00:00.000Z");
  assert.equal(changed.doc.generatedAt, "2026-10-20T00:00:00.000Z");
});

test("mergeClients ne perd pas les clients absents du run --only", () => {
  const previous = {
    version: 1,
    generatedAt: "2026-10-01T00:00:00.000Z",
    clients: {
      "https://a.vercel.app": { slug: "a", title: "A", status: "verified", checkedAt: null },
      "https://b.vercel.app": { slug: "b", title: "B", status: "missing", checkedAt: null },
    },
  };
  const { doc } = mergeClients(previous, [
    { url: "https://b.vercel.app", slug: "b", status: "verified" },
  ]);
  assert.deepEqual(Object.keys(doc.clients).sort(), [
    "https://a.vercel.app",
    "https://b.vercel.app",
  ]);
  assert.equal(doc.clients["https://a.vercel.app"].status, "verified");
});

test("un run complet élague les clients retirés du contenu", () => {
  const previous = {
    version: 1,
    generatedAt: "2026-10-01T00:00:00.000Z",
    clients: {
      "https://a.vercel.app": { slug: "a", title: "A", status: "verified", checkedAt: null },
      "https://supprime.vercel.app": {
        slug: "supprime",
        title: "Supprimé",
        status: "missing",
        checkedAt: null,
      },
    },
  };
  const pruned = mergeClients(
    previous,
    [{ url: "https://a.vercel.app", slug: "a", status: "verified" }],
    { prune: true },
  );
  assert.deepEqual(Object.keys(pruned.doc.clients), ["https://a.vercel.app"]);
  assert.equal(pruned.changed, true);

  const kept = mergeClients(previous, [{ url: "https://a.vercel.app", slug: "a", status: "verified" }], {
    prune: false,
  });
  assert.equal(Object.keys(kept.doc.clients).length, 2);
});

test("auditAll n'élague pas sur un run --only", async () => {
  const previous = {
    version: 1,
    generatedAt: "2026-10-01T00:00:00.000Z",
    clients: {
      "https://autre.vercel.app": {
        slug: "autre",
        title: "Autre",
        status: "verified",
        checkedAt: null,
      },
    },
  };
  const { deps } = fakeDeps();
  const { doc } = await auditAll({
    sites,
    previousClients: previous,
    deps,
    options: { only: ["bare"] },
  });
  assert.ok(doc.clients["https://autre.vercel.app"]);
});

test("summarize compte chaque statut et les erreurs", () => {
  assert.deepEqual(
    summarize([
      { status: "verified" },
      { status: "verified" },
      { status: "nofollow" },
      { status: "missing" },
      { status: "down" },
      { status: "error" },
      { status: "pending" },
      { status: "skipped" },
    ]),
    {
      total: 8,
      verified: 2,
      nofollow: 1,
      missing: 1,
      down: 1,
      pending: 1,
      error: 1,
      skipped: 1,
    },
  );
});

test("adviceFor donne une action concrète par statut", () => {
  assert.match(adviceFor("verified"), /dofollow/);
  assert.match(adviceFor("nofollow"), /nofollow/);
  assert.match(adviceFor("missing"), /pied de page/);
  assert.match(adviceFor("down"), /injoignable/);
});

/* ───────────────────────── Orchestration ───────────────────────── */

const sites = [
  { slug: "good", previewUrl: "https://good.vercel.app/", title: "Good" },
  { slug: "nofollow", previewUrl: "https://nofollow.vercel.app/", title: "Nofollow" },
  { slug: "bare", previewUrl: "https://bare.vercel.app/", title: "Bare" },
  { slug: "dead", previewUrl: "https://dead.vercel.app/", title: "Dead" },
  { slug: "local", previewUrl: "http://localhost:3000", title: "Local" },
];

function fakeDeps() {
  const calls = [];
  return {
    calls,
    deps: {
      fetchHtml: async (url) => {
        calls.push(url);
        if (url.includes("dead.")) return { ok: false, status: 503, html: "" };
        if (url.includes("good.")) {
          return {
            ok: true,
            status: 200,
            html: `<footer><a rel="noopener" href="https://nokhba.net.ly/?utm_source=client_footer"><img src="/b.svg" alt="Nukhba"><span>Website by Nukhba</span></a></footer>`,
          };
        }
        if (url.includes("nofollow.")) {
          return {
            ok: true,
            status: 200,
            html: `<a rel="nofollow" href="https://nokhba.net.ly/">Website by Nukhba</a>`,
          };
        }
        return { ok: true, status: 200, html: "<footer>rien</footer>" };
      },
      detect: badge.detectBadge,
    },
  };
}

test("auditAll classe les quatre cas de figure", async () => {
  const { deps } = fakeDeps();
  const { results, summary } = await auditAll({
    sites,
    deps,
    options: { force: true },
    now: new Date("2026-10-20T12:00:00.000Z"),
  });
  const bySlug = Object.fromEntries(results.map((result) => [result.slug, result.status]));
  assert.equal(bySlug.good, "verified");
  assert.equal(bySlug.nofollow, "nofollow");
  assert.equal(bySlug.bare, "missing");
  assert.equal(bySlug.dead, "down");
  assert.equal(bySlug.local, "skipped");
  assert.deepEqual(summary, {
    total: 5,
    verified: 1,
    nofollow: 1,
    missing: 1,
    down: 1,
    pending: 0,
    error: 0,
    skipped: 1,
  });
  // Résultat trié : rapports et diffs stables.
  assert.deepEqual(
    results.map((result) => result.slug),
    [...results.map((result) => result.slug)].sort(),
  );
});

test("auditAll mémorise l'ancre et le rel trouvés", async () => {
  const { deps } = fakeDeps();
  const { results } = await auditAll({ sites: [sites[0]], deps });
  assert.match(results[0].anchor ?? "", /Nukhba/);
  assert.equal(results[0].rel, "noopener");
  assert.equal(results[0].utm, true);
  assert.equal(results[0].href, "https://nokhba.net.ly/?utm_source=client_footer");
});

test("un site en 404 sur tous les chemins est marqué down (3 essais)", async () => {
  const calls = [];
  const { results } = await auditAll({
    sites: [sites[3]],
    deps: {
      fetchHtml: async (url) => {
        calls.push(url);
        return { ok: false, status: 404, html: "" };
      },
      detect: badge.detectBadge,
    },
  });
  assert.equal(results[0].status, "down");
  assert.equal(results[0].httpStatus, 0);
  assert.equal(results[0].error, "HTTP 404");
  assert.deepEqual(calls, [
    "https://dead.vercel.app",
    "https://dead.vercel.app/ar",
    "https://dead.vercel.app/en",
  ]);
});

test("une racine en erreur réseau n'empêche pas les autres audits", async () => {
  const { results } = await auditAll({
    sites: [sites[0], sites[3], sites[3]],
    deps: {
      fetchHtml: async (url) => {
        if (url.includes("dead.")) throw new Error("ENOTFOUND");
        return { ok: true, status: 200, html: `<a href="https://nokhba.net.ly/">Nukhba</a>` };
      },
      detect: badge.detectBadge,
    },
  });
  assert.equal(results.filter((r) => r.status === "verified").length, 1);
  const dead = results.filter((r) => r.slug === "dead");
  assert.equal(dead.length, 2);
  assert.ok(dead.every((r) => r.status === "down" && r.error === "ENOTFOUND"));
});

test("le fallback /ar est utilisé quand la racine ne porte pas le badge", async () => {
  const calls = [];
  const { results } = await auditAll({
    sites: [sites[2]],
    deps: {
      fetchHtml: async (url) => {
        calls.push(url);
        if (url.endsWith("/ar"))
          return { ok: true, status: 200, html: `<a href="https://nokhba.net.ly/">Nukhba</a>` };
        return { ok: true, status: 200, html: "<footer>sans crédit</footer>" };
      },
      detect: badge.detectBadge,
    },
  });
  assert.equal(results[0].status, "verified");
  assert.equal(results[0].scannedUrl, "https://bare.vercel.app/ar");
  assert.deepEqual(calls, ["https://bare.vercel.app", "https://bare.vercel.app/ar"]);
});

test("/en est essayé en dernier et un échec réseau n'arrête pas la boucle", async () => {
  const calls = [];
  const { results } = await auditAll({
    sites: [sites[2]],
    deps: {
      fetchHtml: async (url) => {
        calls.push(url);
        if (url.endsWith("/ar")) throw new Error("ECONNRESET");
        if (url.endsWith("/en"))
          return { ok: true, status: 200, html: `<a href="https://nokhba.net.ly/">By Nukhba</a>` };
        return { ok: true, status: 200, html: "<footer>sans crédit</footer>" };
      },
      detect: badge.detectBadge,
    },
  });
  assert.equal(results[0].status, "verified");
  assert.equal(results[0].scannedUrl, "https://bare.vercel.app/en");
  assert.deepEqual(calls, [
    "https://bare.vercel.app",
    "https://bare.vercel.app/ar",
    "https://bare.vercel.app/en",
  ]);
});

test("aucune page atteignable (500 partout) donne down avec la dernière erreur", async () => {
  const { results } = await auditAll({
    sites: [sites[2]],
    deps: {
      fetchHtml: async () => ({ ok: false, status: 500, html: "" }),
      detect: badge.detectBadge,
    },
  });
  assert.equal(results[0].status, "down");
  assert.equal(results[0].httpStatus, 0);
  assert.equal(results[0].error, "HTTP 500");
});

test("--dry-run ne fait aucun appel réseau et ne change rien", async () => {
  let calls = 0;
  const { results, summary, changed } = await auditAll({
    sites,
    deps: {
      fetchHtml: async () => {
        calls += 1;
        return { ok: true, status: 200, html: "" };
      },
      detect: badge.detectBadge,
    },
    options: { dryRun: true },
  });
  assert.equal(calls, 0);
  assert.equal(changed, false);
  assert.ok(
    results
      .filter((result) => result.status !== "skipped")
      .every((result) => result.status === "pending"),
  );
  assert.equal(summary.pending, 4);
  assert.equal(summary.skipped, 1);
  assert.equal(results.filter((result) => result.status === "skipped").length, 1);
});

test("--only limite le run sans supprimer les autres clients", async () => {
  const previous = {
    version: 1,
    generatedAt: "2026-10-01T00:00:00.000Z",
    clients: {
      "https://good.vercel.app": {
        slug: "good",
        title: "Good",
        status: "verified",
        checkedAt: "2026-10-01T00:00:00.000Z",
      },
    },
  };
  const { deps } = fakeDeps();
  const { results, doc } = await auditAll({
    sites,
    previousClients: previous,
    deps,
    options: { only: ["bare"] },
  });
  assert.deepEqual(results.map((result) => result.slug), ["bare"]);
  assert.equal(doc.clients["https://good.vercel.app"].status, "verified");
  assert.equal(doc.clients["https://bare.vercel.app"].status, "missing");
});
