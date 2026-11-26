#!/usr/bin/env node
/**
 * Tests du moniteur Google Search Console (`scripts/gsc-monitor.mjs`),
 * du workflow quotidien `.github/workflows/gsc-monitor.yml` et de la sécurité
 * du panneau `/admin/search-console`.
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
  decideSmartSitemapSubmit,
  parseGscCsv,
  parseMonitorArgs,
  runGscMonitor,
  shouldSendDailyAlert,
} from "./gsc-monitor.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), "gsc-monitor-test-"));

test.after(() => {
  rmSync(tmp, { recursive: true, force: true });
});

test("parseMonitorArgs lit --days, --sitemap-mode, --submit-sitemap, --csv et borne la fenêtre", () => {
  const opts = parseMonitorArgs(["--days", "14", "--sitemap-mode", "auto", "--csv", "q.csv"]);
  assert.equal(opts.days, 14);
  assert.equal(opts.sitemapMode, "auto");
  assert.equal(opts.csv, "q.csv");
  assert.equal(parseMonitorArgs(["--submit-sitemap"]).sitemapMode, "always");
  assert.equal(parseMonitorArgs(["--days", "999"]).days, 90);
});

test("decideSmartSitemapSubmit évite le spam quotidien mais renvoie le lundi ou sur erreur", () => {
  const wednesdayMs = Date.parse("2026-11-25T08:30:00Z"); // Mercredi
  const mondayMs = Date.parse("2026-11-30T08:30:00Z"); // Lundi

  // Mercredi, 0 erreur, lu hier -> skip (pas de spam quotidien)
  assert.deepEqual(
    decideSmartSitemapSubmit({
      mode: "auto",
      status: "ok",
      errors: 0,
      lastDownloaded: "2026-11-24T12:00:00Z",
      lastSubmitted: "2026-11-23T08:30:00Z",
      nowMs: wednesdayMs,
    }),
    { shouldSubmit: false, reason: "healthy_skip_daily" },
  );

  // Mercredi, erreurs > 0 et dernier envoi > 20h -> resoumission autorisée
  assert.deepEqual(
    decideSmartSitemapSubmit({
      mode: "auto",
      status: "ok",
      errors: 9,
      lastDownloaded: "2026-11-24T12:00:00Z",
      lastSubmitted: "2026-11-24T08:00:00Z",
      nowMs: wednesdayMs,
    }),
    { shouldSubmit: true, reason: "has_errors_retry_24h" },
  );

  // Mercredi, erreurs > 0 mais déjà renvoyé il y a 2h -> attend 20h
  assert.deepEqual(
    decideSmartSitemapSubmit({
      mode: "auto",
      status: "ok",
      errors: 9,
      lastDownloaded: "2026-11-25T06:00:00Z",
      lastSubmitted: "2026-11-25T06:30:00Z",
      nowMs: wednesdayMs,
    }),
    { shouldSubmit: false, reason: "healthy_skip_daily" },
  );

  // Lundi, 0 erreur -> rafraîchissement hebdomadaire
  assert.deepEqual(
    decideSmartSitemapSubmit({
      mode: "auto",
      status: "ok",
      errors: 0,
      lastDownloaded: "2026-11-29T12:00:00Z",
      lastSubmitted: "2026-11-23T08:30:00Z",
      nowMs: mondayMs,
    }),
    { shouldSubmit: true, reason: "weekly_monday_refresh" },
  );
});

test("shouldSendDailyAlert reste silencieux hors lundi sauf anomalie", () => {
  const wednesdayMs = Date.parse("2026-11-25T08:30:00Z");
  const mondayMs = Date.parse("2026-11-30T08:30:00Z");
  const healthyReport = {
    status: "ok",
    sitemap: { errors: 0 },
    pulse7d: { current: { clicks: 15 }, previous: { clicks: 12 } },
  };

  assert.equal(shouldSendDailyAlert({ report: healthyReport, nowMs: wednesdayMs }).send, false);
  assert.equal(shouldSendDailyAlert({ report: healthyReport, nowMs: mondayMs }).send, true);
  assert.equal(
    shouldSendDailyAlert({
      report: { ...healthyReport, sitemap: { errors: 3 } },
      nowMs: wednesdayMs,
    }).reason,
    "sitemap_errors",
  );
  assert.equal(
    shouldSendDailyAlert({
      report: {
        ...healthyReport,
        pulse7d: { current: { clicks: 4 }, previous: { clicks: 14 } },
      },
      nowMs: wednesdayMs,
    }).reason,
    "traffic_drop_7d",
  );
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

test("en mode --csv, runGscMonitor extrait Quick Wins Page 2 et faible CTR Page 1 (< 3,5 %)", async () => {
  const csvPath = join(tmp, "sample.csv");
  const outDir = join(tmp, "csv-out");
  writeFileSync(
    csvPath,
    [
      "Top queries,Page,Clicks,Impressions,CTR,Position",
      "carte psn libye usdt,https://nokhba.net.ly/codes/psn,2,150,1.33%,11.6",
      "toy store tripoli,https://nokhba.net.ly/demos/toy-store-tripoly,1,36,2.78%,9.0",
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
  assert.equal(report.lowCtrPageOne[0].query, "toy store tripoli");
  assert.match(markdown, /Quick Wins Page 2 — Positions 11 à 20 \(1\)/);
  assert.match(markdown, /Pages en 1re page à faible CTR < 3,5 % \(1\)/);
});

test("classifyOpportunities détecte aussi les pages Page 2 agrégées (topPages) et échappe '|'", () => {
  const rows = parseGscCsv(
    'Query,Page,Clicks,Impressions,CTR,Position\n"steam | wallet",https://nokhba.net.ly/codes,1,90,1.1%,13.2\n',
  );
  const topPages = [
    {
      page: "https://nokhba.net.ly/demos/al-manhaj-company",
      clicks: 3,
      impressions: 19,
      ctr: 0.158,
      position: 13.5,
    },
  ];
  const { quickWins } = classifyOpportunities(rows, topPages);
  assert.equal(quickWins.length, 2);
  const md = buildMarkdownReport({
    status: "ok",
    generatedAt: "2026-11-25T08:30:00.000Z",
    property: "sc-domain:nokhba.net.ly",
    sitemapUrl: "https://nokhba.net.ly/sitemap.xml",
    quickWins,
    lowCtrPageOne: [],
  });
  assert.match(md, /steam \\\| wallet/);
  assert.match(md, /al-manhaj-company/);
});

test("garde-fous sécurité : /admin/search-console et cron quotidien 7j/7", () => {
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

  const actionCount = (actionsSrc.match(/export async function /g) ?? []).length;
  const guardCount = (actionsSrc.match(/await requireAdmin\(\);/g) ?? []).length;
  assert.ok(actionCount >= 3);
  assert.equal(guardCount, actionCount);

  assert.match(pageSrc, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
  assert.doesNotMatch(panelSrc, /useEffect/);
  assert.doesNotMatch(panelSrc, /PRIVATE_KEY.*value/i);

  assert.match(workflowSrc, /cron:\s*"30 8 \* \* \*"/);
  assert.match(workflowSrc, /--body-file reports\/gsc-monitor-latest\.md/);
});
