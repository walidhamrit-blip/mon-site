#!/usr/bin/env node
/**
 * Tests du moniteur Google Search Console (`scripts/gsc-monitor.mjs`),
 * du workflow `.github/workflows/gsc-monitor.yml` et de la sécurité du
 * panneau `/admin/search-console`.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildMarkdownReport,
  classifyOpportunities,
  parseGscCsv,
  parseMonitorArgs,
  runGscMonitor,
} from "./gsc-monitor.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), "gsc-monitor-test-"));

test.after(() => {
  rmSync(tmp, { recursive: true, force: true });
});

test("parseMonitorArgs lit --days, --submit-sitemap, --csv et borne la fenêtre", () => {
  const opts = parseMonitorArgs(["--days", "14", "--submit-sitemap", "--csv", "q.csv"]);
  assert.equal(opts.days, 14);
  assert.equal(opts.submitSitemap, true);
  assert.equal(opts.csv, "q.csv");
  assert.equal(parseMonitorArgs(["--days", "999"]).days, 90);
});

test("sans identifiants GSC, runGscMonitor écrit un rapport skipped (code 0)", async () => {
  const outDir = join(tmp, "skipped-out");
  const { report, latestJsonPath, latestMdPath } = await runGscMonitor(
    ["--out-dir", outDir],
    { SITE_URL: "https://nokhba.net.ly" },
  );
  assert.equal(report.status, "skipped");
  assert.equal(report.reason, "missing_gsc_credentials");
  assert.ok(existsSync(latestJsonPath));
  assert.ok(existsSync(latestMdPath));
  const md = readFileSync(latestMdPath, "utf8");
  assert.match(md, /Identifiants Search Console non configurés/);
});

test("en mode --csv, runGscMonitor extrait Quick Wins Page 2 et faible CTR Page 1", async () => {
  const csvPath = join(tmp, "sample.csv");
  const outDir = join(tmp, "csv-out");
  writeFileSync(
    csvPath,
    [
      "Top queries,Page,Clicks,Impressions,CTR,Position",
      "carte psn libye usdt,https://nokhba.net.ly/codes/psn,2,150,1.33%,11.6",
      "creation site web tripoli,https://nokhba.net.ly/creation-sites,1,220,0.45%,3.8",
      "nokhba,https://nokhba.net.ly/,60,80,75%,1.0",
    ].join("\n"),
    "utf8",
  );

  const { report, markdown } = await runGscMonitor(
    ["--csv", csvPath, "--out-dir", outDir],
    { SITE_URL: "https://nokhba.net.ly", GOOGLE_INDEXING_SITE_URL: "sc-domain:nokhba.net.ly" },
  );

  assert.equal(report.status, "ok");
  assert.equal(report.property, "sc-domain:nokhba.net.ly");
  assert.equal(report.quickWins.length, 1);
  assert.equal(report.quickWins[0].query, "carte psn libye usdt");
  assert.equal(report.lowCtrPageOne.length, 1);
  assert.equal(report.lowCtrPageOne[0].query, "creation site web tripoli");
  assert.match(markdown, /Quick Wins Page 2 — Positions 11 à 20 \(1\)/);
  assert.match(markdown, /Pages en 1re page à faible CTR < 2,5 % \(1\)/);
});

test("parseGscCsv + classifyOpportunities + buildMarkdownReport échappent les barres verticales", () => {
  const rows = parseGscCsv(
    'Query,Page,Clicks,Impressions,CTR,Position\n"steam | wallet",https://nokhba.net.ly/codes,1,90,1.1%,13.2\n',
  );
  const { quickWins } = classifyOpportunities(rows);
  assert.equal(quickWins.length, 1);
  const md = buildMarkdownReport({
    status: "ok",
    generatedAt: "2026-11-24T08:30:00.000Z",
    property: "sc-domain:nokhba.net.ly",
    sitemapUrl: "https://nokhba.net.ly/sitemap.xml",
    quickWins,
    lowCtrPageOne: [],
  });
  assert.match(md, /steam \\\| wallet/);
});

test("garde-fous sécurité : /admin/search-console et workflow GitHub Actions", () => {
  const actionsSrc = readFileSync(
    join(root, "src/app/admin/(panel)/search-console/actions.ts"),
    "utf8",
  );
  const pageSrc = readFileSync(
    join(root, "src/app/admin/(panel)/search-console/page.tsx"),
    "utf8",
  );
  const panelSrc = readFileSync(
    join(root, "src/app/admin/(panel)/search-console/search-console-panel.tsx"),
    "utf8",
  );
  const workflowSrc = readFileSync(
    join(root, ".github/workflows/gsc-monitor.yml"),
    "utf8",
  );

  // Chaque action serveur exportée appelle requireAdmin().
  const actionCount = (actionsSrc.match(/export async function /g) ?? []).length;
  const guardCount = (actionsSrc.match(/await requireAdmin\(\);/g) ?? []).length;
  assert.ok(actionCount >= 3, "Les 3 actions serveur doivent exister");
  assert.equal(guardCount, actionCount, "Chaque action serveur doit exiger requireAdmin()");

  // Noindex admin + absence d'appel automatique au montage + pas de fuite de clé privée.
  assert.match(pageSrc, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
  assert.doesNotMatch(panelSrc, /useEffect/);
  assert.doesNotMatch(panelSrc, /PRIVATE_KEY.*value/i);

  // Le workflow utilise --body-file (pas d'interpolation shell du rapport Markdown).
  assert.match(workflowSrc, /--body-file reports\/gsc-monitor-latest\.md/);
});
