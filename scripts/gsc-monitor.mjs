#!/usr/bin/env node
/**
 * Google Search Console Monitor — Suivi automatique hebdomadaire & Quick Wins SEO.
 *
 * Exécuté chaque lundi par `.github/workflows/gsc-monitor.yml` (et à la demande) :
 *   1. Resoumet optionnellement `https://nokhba.net.ly/sitemap.xml` (`--submit-sitemap`).
 *   2. Vérifie l'état du sitemap (erreurs, avertissements, URL soumises / indexées).
 *   3. Compare les 28 derniers jours aux 28 jours précédents (clics, impressions, CTR, position).
 *   4. Extrait les **Quick Wins Page 2** (positions 11–20) et les **Pages en 1re page à faible CTR**
 *      avec les actions d'optimisation concrètes (`/seo page`).
 *   5. Écrit `reports/gsc-monitor-YYYY-MM-DD.json`, `reports/gsc-monitor-latest.json`
 *      et `reports/gsc-monitor-latest.md` (publiés en artefact GitHub + Issue de suivi pour Arena).
 *   6. Optionnel : synchronise un Google Sheet (`GOOGLE_SHEETS_GSC_SPREADSHEET_ID`) lisible
 *      directement par le connecteur `google_sheets` d'Arena, et envoie un condensé Telegram / Resend.
 *
 * Tolérant : sans clés (`GOOGLE_INDEXING_CLIENT_EMAIL` / `GOOGLE_INDEXING_PRIVATE_KEY`),
 * le script écrit un rapport `status: "skipped"` et se termine avec le code 0.
 */

import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const WEBMASTERS_SCOPE = "https://www.googleapis.com/auth/webmasters";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

export function parseMonitorArgs(argv = []) {
  const opts = {
    days: 28,
    submitSitemap: false,
    csv: null,
    outDir: null,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--days" && argv[i + 1]) opts.days = Math.max(7, Math.min(90, Number(argv[++i]) || 28));
    else if (arg === "--submit-sitemap") opts.submitSitemap = true;
    else if (arg === "--csv" && argv[i + 1]) opts.csv = argv[++i];
    else if (arg === "--out-dir" && argv[i + 1]) opts.outDir = argv[++i];
    else if (arg === "--dry-run") opts.dryRun = true;
  }
  return opts;
}

export function normalizePrivateKey(raw = "") {
  let key = String(raw).trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, "\n").replace(/\r/g, "");
}

export function normalizeProperty(siteUrl, override) {
  const value = (override?.trim() || siteUrl || "https://nokhba.net.ly").trim();
  if (/^sc-domain:/i.test(value)) {
    return `sc-domain:${value.slice("sc-domain:".length).trim().replace(/\/+$/, "").toLowerCase()}`;
  }
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return `${withProtocol.replace(/\/+$/, "")}/`;
}

export function isPreviewOrLocalOrigin(origin = "") {
  try {
    const parsed = new URL(/^https?:\/\//i.test(origin) ? origin : `https://${origin}`);
    const host = parsed.hostname.toLowerCase();
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".local") ||
      host.endsWith(".vercel.app") ||
      host.endsWith(".e2b.app")
    );
  } catch {
    return true;
  }
}

export function buildJwtAssertion(clientEmail, privateKey, scope = WEBMASTERS_SCOPE, nowMs = Date.now()) {
  const now = Math.floor(nowMs / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: clientEmail,
      scope,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  ).toString("base64url");
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const sig = signer.sign(privateKey).toString("base64url");
  return `${unsigned}.${sig}`;
}

async function fetchGoogleAccessToken(clientEmail, privateKey, scope = WEBMASTERS_SCOPE) {
  const assertion = buildJwtAssertion(clientEmail, privateKey, scope);
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(`OAuth HTTP ${res.status}: ${data.error ?? ""} ${data.error_description ?? ""}`.trim());
  }
  return data.access_token;
}

function parseCsvLine(line) {
  const cells = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      cells.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur.trim());
  return cells;
}

export function parseGscCsv(rawCsv = "") {
  const cleaned = String(rawCsv).replace(/^\uFEFF/, "");
  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const idxQuery = headers.findIndex((h) => /query|queries|requête|requêtes|consulta|طلب|عبارة/i.test(h));
  const idxPage = headers.findIndex((h) => /page|pages|url|página|صفح/i.test(h));
  const idxClicks = headers.findIndex((h) => /click|clic|نقر/i.test(h));
  const idxImpr = headers.findIndex((h) => /impr|ظهور/i.test(h));
  const idxCtr = headers.findIndex((h) => /ctr|نسبة النقر/i.test(h));
  const idxPos = headers.findIndex((h) => /pos|متوسط الموضع/i.test(h));

  return lines
    .slice(1)
    .map((line) => {
      const cols = parseCsvLine(line);
      const ctrRaw = ((idxCtr >= 0 ? cols[idxCtr] : "0") ?? "0").replace(",", ".").trim();
      const ctr = ctrRaw.endsWith("%")
        ? (Number.parseFloat(ctrRaw.slice(0, -1)) || 0) / 100
        : Number.parseFloat(ctrRaw) || 0;
      const parseNum = (raw) => Number.parseFloat(String(raw ?? "0").replace(/\s/g, "").replace(/,/g, "")) || 0;
      const position = Number.parseFloat(String((idxPos >= 0 ? cols[idxPos] : "0") ?? "0").replace(",", ".")) || 0;
      return {
        query: idxQuery >= 0 ? (cols[idxQuery] ?? "") : (cols[0] ?? ""),
        page: idxPage >= 0 ? (cols[idxPage] ?? "") : "",
        clicks: parseNum(idxClicks >= 0 ? cols[idxClicks] : "0"),
        impressions: parseNum(idxImpr >= 0 ? cols[idxImpr] : "0"),
        ctr,
        position,
      };
    })
    .filter((row) => Boolean(row.query || row.page));
}

export function scoreOpportunity(row) {
  const targetCtr = 0.08;
  const ctrGap = Math.max(0.005, targetCtr - row.ctr);
  const proximityBoost = Math.max(0.5, (21 - row.position) / 10);
  return Math.round(row.impressions * ctrGap * proximityBoost * 100) / 100;
}

export function recommendAction(row) {
  if (row.position < 10.5) {
    return "Page 1 mais CTR bas : réécrire <title> & meta description (bénéfice immédiat USD/USDT, livraison auto) sans changer l'URL";
  }
  const actions = [];
  if (row.ctr < 0.02) {
    actions.push("Réécrire <title> & meta description avec la requête exacte + valeur ajoutée");
  }
  if (row.position >= 14.5) {
    actions.push("Ajouter un H2 exact + paragraphe Answer-First (40–60 mots) + 2 liens internes depuis les hubs");
  } else {
    actions.push("Aligner H1 / chapô avec l'intention exacte + ajouter une question FAQ dédiée");
  }
  return actions.join(" · ");
}

export function classifyOpportunities(rows = [], limit = 25) {
  const quickWins = rows
    .filter((r) => r.position >= 10.5 && r.position <= 20.5 && r.impressions >= 5)
    .map((r) => ({
      ...r,
      kind: "page2_quick_win",
      opportunityScore: scoreOpportunity(r),
      missedClicksEstimate: Math.max(1, Math.round(r.impressions * Math.max(0.01, 0.08 - r.ctr))),
      recommendedAction: recommendAction(r),
    }))
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
    .slice(0, limit);

  const lowCtrPageOne = rows
    .filter((r) => r.position >= 1 && r.position < 10.5 && r.impressions >= 20 && r.ctr < 0.025)
    .map((r) => {
      const expectedCtr = r.position <= 3 ? 0.15 : r.position <= 6 ? 0.07 : 0.04;
      const missed = Math.max(1, Math.round(r.impressions * Math.max(0.01, expectedCtr - r.ctr)));
      return {
        ...r,
        kind: "page1_low_ctr",
        opportunityScore: missed,
        missedClicksEstimate: missed,
        recommendedAction: recommendAction(r),
      };
    })
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
    .slice(0, limit);

  return { quickWins, lowCtrPageOne };
}

function isoDateDaysAgo(days, nowMs = Date.now()) {
  return new Date(nowMs - days * 86_400_000).toISOString().slice(0, 10);
}

function pctDelta(current, previous) {
  if (previous <= 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

async function queryAnalytics({ property, token, startDate, endDate, dimensions, rowLimit }) {
  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      startDate,
      endDate,
      dimensions,
      rowLimit,
      dataState: "final",
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Search Analytics HTTP ${res.status}: ${detail.slice(0, 180)}`);
  }
  return res.json();
}

async function submitAndInspectSitemap({ property, sitemapUrl, token, shouldSubmit }) {
  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/sitemaps/${encodeURIComponent(sitemapUrl)}`;
  let submission = { attempted: false, ok: false, status: null, note: null };

  if (shouldSubmit) {
    if (isPreviewOrLocalOrigin(sitemapUrl)) {
      submission = { attempted: false, ok: false, status: null, note: "skipped_preview_or_local" };
    } else {
      submission.attempted = true;
      const putRes = await fetch(endpoint, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      submission.status = putRes.status;
      submission.ok = putRes.ok;
      if (!putRes.ok) {
        submission.note =
          putRes.status === 403
            ? "HTTP 403 : donnez le droit « Complet » au compte de service dans Search Console pour autoriser l'envoi du sitemap."
            : `HTTP ${putRes.status}`;
      }
    }
  }

  const getRes = await fetch(endpoint, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (getRes.status === 404) {
    return { status: "not_found", submission, warnings: 0, errors: 0, submittedUrls: 0, indexedUrls: 0 };
  }
  if (!getRes.ok) {
    return { status: `http_${getRes.status}`, submission, warnings: 0, errors: 0, submittedUrls: 0, indexedUrls: 0 };
  }
  const data = await getRes.json();
  const contents = Array.isArray(data.contents) ? data.contents : [];
  return {
    status: "ok",
    submission,
    lastSubmitted: data.lastSubmitted ?? null,
    lastDownloaded: data.lastDownloaded ?? null,
    isPending: Boolean(data.isPending),
    warnings: Number(data.warnings ?? 0) || 0,
    errors: Number(data.errors ?? 0) || 0,
    submittedUrls: contents.reduce((sum, c) => sum + (Number(c.submitted ?? 0) || 0), 0),
    indexedUrls: contents.reduce((sum, c) => sum + (Number(c.indexed ?? 0) || 0), 0),
  };
}

function escapeMdCell(text = "") {
  return String(text).replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
}

export function buildMarkdownReport(report) {
  const lines = [];
  lines.push(`# 📊 Suivi automatique Google Search Console — \`${report.property}\``);
  lines.push("");
  lines.push(`- **Généré le** : \`${report.generatedAt}\``);
  lines.push(`- **Statut** : \`${report.status}\``);
  lines.push(`- **Sitemap contrôlé** : \`${report.sitemapUrl}\``);

  if (report.status === "skipped") {
    lines.push("");
    lines.push("> ℹ️ **Identifiants Search Console non configurés.** Ajoutez `GOOGLE_INDEXING_CLIENT_EMAIL`, `GOOGLE_INDEXING_PRIVATE_KEY` et `GOOGLE_INDEXING_SITE_URL` dans GitHub Secrets & Vercel pour activer le suivi automatique.");
    return `${lines.join("\n")}\n`;
  }

  if (report.summary) {
    const s = report.summary;
    const fmtDelta = (v, unit = "%") => (v === null || v === undefined ? "—" : `${v > 0 ? "+" : ""}${v}${unit}`);
    lines.push(`- **Fenêtre** : \`${s.startDate}\` → \`${s.endDate}\` (${s.days}j vs \`${s.previousStartDate}\` → \`${s.previousEndDate}\`)`);
    lines.push("");
    lines.push("## 1. Indicateurs globaux (28 jours)");
    lines.push("");
    lines.push("| Indicateur | Période actuelle | Période précédente | Évolution |");
    lines.push("|---|---:|---:|---:|");
    lines.push(`| **Clics organiques** | **${s.current.clicks}** | ${s.previous.clicks} | ${fmtDelta(s.deltas.clicksPct, " %")} |`);
    lines.push(`| **Impressions** | **${s.current.impressions}** | ${s.previous.impressions} | ${fmtDelta(s.deltas.impressionsPct, " %")} |`);
    lines.push(`| **CTR moyen** | **${(s.current.ctr * 100).toFixed(2)} %** | ${(s.previous.ctr * 100).toFixed(2)} % | ${fmtDelta(s.deltas.ctrPts, " pt")} |`);
    lines.push(`| **Position moyenne** | **${s.current.position > 0 ? s.current.position.toFixed(1) : "—"}** | ${s.previous.position > 0 ? s.previous.position.toFixed(1) : "—"} | ${fmtDelta(s.deltas.positionDiff, "")} |`);
  }

  if (report.sitemap) {
    const sm = report.sitemap;
    lines.push("");
    lines.push("## 2. Santé du Sitemap (`sitemap.xml`)");
    lines.push("");
    lines.push(`- **État API** : \`${sm.status}\` · **Erreurs** : \`${sm.errors ?? 0}\` · **Avertissements** : \`${sm.warnings ?? 0}\``);
    lines.push(`- **URL soumises / indexées** : \`${sm.submittedUrls ?? 0}\` / \`${sm.indexedUrls ?? 0}\``);
    if (sm.lastDownloaded) lines.push(`- **Dernière lecture Google** : \`${sm.lastDownloaded}\``);
    if (sm.submission?.attempted) {
      lines.push(
        `- **Resoumission hebdomadaire** : ${sm.submission.ok ? "✅ acceptée" : `⚠️ ${sm.submission.note ?? "échec"}`}`,
      );
    }
  }

  const quickWins = report.quickWins ?? [];
  lines.push("");
  lines.push(`## 3. Quick Wins Page 2 — Positions 11 à 20 (${quickWins.length})`);
  lines.push("");
  if (quickWins.length === 0) {
    lines.push("_Aucune requête détectée entre les positions 10.5 et 20.5 avec >= 5 impressions sur cette période._");
  } else {
    lines.push("| # | Requête | Page cible | Pos. | Impr. | Clics | CTR | Action recommandée (`/seo page`) |");
    lines.push("|---:|---|---|---:|---:|---:|---:|---|");
    for (const [idx, item] of quickWins.slice(0, 20).entries()) {
      lines.push(
        `| ${idx + 1} | ${escapeMdCell(item.query)} | ${escapeMdCell(item.page || "—")} | ${item.position.toFixed(1)} | ${item.impressions} | ${item.clicks} | ${(item.ctr * 100).toFixed(1)} % | ${escapeMdCell(item.recommendedAction)} |`,
      );
    }
  }

  const lowCtr = report.lowCtrPageOne ?? [];
  lines.push("");
  lines.push(`## 4. Pages en 1re page à faible CTR < 2,5 % (${lowCtr.length})`);
  lines.push("");
  if (lowCtr.length === 0) {
    lines.push("_Aucune requête en Top 10 avec >= 20 impressions et CTR < 2,5 %._");
  } else {
    lines.push("| # | Requête | Page cible | Pos. | Impr. | Clics | CTR | Action recommandée |");
    lines.push("|---:|---|---|---:|---:|---:|---:|---|");
    for (const [idx, item] of lowCtr.slice(0, 15).entries()) {
      lines.push(
        `| ${idx + 1} | ${escapeMdCell(item.query)} | ${escapeMdCell(item.page || "—")} | ${item.position.toFixed(1)} | ${item.impressions} | ${item.clicks} | ${(item.ctr * 100).toFixed(1)} % | ${escapeMdCell(item.recommendedAction)} |`,
      );
    }
  }

  const topPages = report.topPages ?? [];
  if (topPages.length > 0) {
    lines.push("");
    lines.push("## 5. Top 10 pages par clics organiques");
    lines.push("");
    lines.push("| # | Page | Clics | Impressions | CTR | Position |");
    lines.push("|---:|---|---:|---:|---:|---:|");
    for (const [idx, p] of topPages.slice(0, 10).entries()) {
      lines.push(
        `| ${idx + 1} | ${escapeMdCell(p.page)} | ${p.clicks} | ${p.impressions} | ${(p.ctr * 100).toFixed(1)} % | ${p.position.toFixed(1)} |`,
      );
    }
  }

  lines.push("");
  lines.push("---");
  lines.push("_Pour appliquer automatiquement ces optimisations dans Arena : demandez « Applique les Quick Wins du dernier rapport Search Console »._");
  return `${lines.join("\n")}\n`;
}

async function syncToGoogleSheet({ clientEmail, privateKey, spreadsheetId, report }) {
  if (!spreadsheetId || report.status !== "ok") return false;
  try {
    const token = await fetchGoogleAccessToken(clientEmail, privateKey, SHEETS_SCOPE);
    const s = report.summary;
    const row = [
      report.generatedAt.slice(0, 10),
      report.property,
      s?.current.clicks ?? 0,
      s?.deltas.clicksPct ?? "",
      s?.current.impressions ?? 0,
      s ? Number((s.current.ctr * 100).toFixed(2)) : 0,
      s ? Number(s.current.position.toFixed(2)) : 0,
      report.quickWins?.length ?? 0,
      report.sitemap?.errors ?? 0,
    ];
    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/A1:append?valueInputOption=USER_ENTERED`;
    const res = await fetch(appendUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: [row] }),
    });
    if (!res.ok) {
      console.warn(`[gsc-monitor] Google Sheets HTTP ${res.status} (vérifiez le partage du fichier avec ${clientEmail})`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[gsc-monitor] Sync Google Sheets ignorée :", err.message);
    return false;
  }
}

async function sendTelegramDigest(report) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID?.trim();
  if (!botToken || !chatId || report.status !== "ok" || !report.summary) return false;
  try {
    const s = report.summary;
    const topWin = report.quickWins?.[0];
    const text = [
      `📊 Search Console (${s.days}j) — ${report.property}`,
      `• Clics : ${s.current.clicks} (${s.deltas.clicksPct !== null ? `${s.deltas.clicksPct > 0 ? "+" : ""}${s.deltas.clicksPct}%` : "—"})`,
      `• Impressions : ${s.current.impressions}`,
      `• CTR : ${(s.current.ctr * 100).toFixed(2)}% · Pos. moy. : ${s.current.position.toFixed(1)}`,
      `• Sitemap : ${report.sitemap?.errors ?? 0} erreur(s) · ${report.sitemap?.submittedUrls ?? 0} URL`,
      `• Quick Wins Page 2 : ${report.quickWins?.length ?? 0}`,
      topWin ? `• Priorité #1 : « ${topWin.query} » (pos. ${topWin.position.toFixed(1)}, ${topWin.impressions} impr.)` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function runGscMonitor(argv = process.argv.slice(2), env = process.env) {
  const opts = parseMonitorArgs(argv);
  const baseUrl = (env.SITE_URL || "https://nokhba.net.ly").trim().replace(/\/+$/, "");
  const property = normalizeProperty(baseUrl, env.GOOGLE_INDEXING_SITE_URL);
  const sitemapUrl = `${baseUrl}/sitemap.xml`;
  const generatedAt = new Date().toISOString();
  const rootDir = fileURLToPath(new URL("..", import.meta.url));
  const outDir = opts.outDir || join(rootDir, "reports");

  let report;

  if (opts.csv) {
    const rows = parseGscCsv(readFileSync(opts.csv, "utf8"));
    const { quickWins, lowCtrPageOne } = classifyOpportunities(rows, 25);
    const totalClicks = rows.reduce((sum, r) => sum + r.clicks, 0);
    const totalImpr = rows.reduce((sum, r) => sum + r.impressions, 0);
    const avgPos =
      rows.length > 0 ? rows.reduce((sum, r) => sum + r.position, 0) / rows.length : 0;
    report = {
      status: "ok",
      source: `csv:${opts.csv}`,
      generatedAt,
      property,
      sitemapUrl,
      summary: {
        days: opts.days,
        startDate: "csv",
        endDate: "csv",
        previousStartDate: "—",
        previousEndDate: "—",
        current: {
          clicks: totalClicks,
          impressions: totalImpr,
          ctr: totalImpr > 0 ? totalClicks / totalImpr : 0,
          position: avgPos,
        },
        previous: { clicks: 0, impressions: 0, ctr: 0, position: 0 },
        deltas: { clicksPct: null, impressionsPct: null, ctrPts: 0, positionDiff: 0 },
      },
      quickWins,
      lowCtrPageOne,
      topPages: [],
      topQueries: [...rows].sort((a, b) => b.clicks - a.clicks).slice(0, 15),
    };
  } else if (opts.dryRun || !env.GOOGLE_INDEXING_CLIENT_EMAIL?.trim() || !env.GOOGLE_INDEXING_PRIVATE_KEY?.trim()) {
    report = {
      status: "skipped",
      reason: opts.dryRun ? "dry_run" : "missing_gsc_credentials",
      generatedAt,
      property,
      sitemapUrl,
      quickWins: [],
      lowCtrPageOne: [],
    };
  } else {
    const clientEmail = env.GOOGLE_INDEXING_CLIENT_EMAIL.trim();
    const privateKey = normalizePrivateKey(env.GOOGLE_INDEXING_PRIVATE_KEY);
    const token = await fetchGoogleAccessToken(clientEmail, privateKey, WEBMASTERS_SCOPE);

    const endDate = isoDateDaysAgo(2);
    const startDate = isoDateDaysAgo(opts.days + 1);
    const previousEndDate = isoDateDaysAgo(opts.days + 2);
    const previousStartDate = isoDateDaysAgo(opts.days * 2 + 1);

    const [curTotalsRaw, prevTotalsRaw, pagesRaw, queryPageRaw, sitemap] = await Promise.all([
      queryAnalytics({ property, token, startDate, endDate, dimensions: [], rowLimit: 1 }),
      queryAnalytics({
        property,
        token,
        startDate: previousStartDate,
        endDate: previousEndDate,
        dimensions: [],
        rowLimit: 1,
      }),
      queryAnalytics({ property, token, startDate, endDate, dimensions: ["page"], rowLimit: 25 }),
      queryAnalytics({
        property,
        token,
        startDate,
        endDate,
        dimensions: ["query", "page"],
        rowLimit: 5000,
      }),
      submitAndInspectSitemap({
        property,
        sitemapUrl,
        token,
        shouldSubmit: opts.submitSitemap,
      }),
    ]);

    const extract = (raw) => {
      const r = raw.rows?.[0];
      return {
        clicks: Number(r?.clicks ?? 0) || 0,
        impressions: Number(r?.impressions ?? 0) || 0,
        ctr: Number(r?.ctr ?? 0) || 0,
        position: Number(r?.position ?? 0) || 0,
      };
    };
    const current = extract(curTotalsRaw);
    const previous = extract(prevTotalsRaw);

    const rows = (queryPageRaw.rows ?? []).map((r) => ({
      query: r.keys?.[0] ?? "",
      page: r.keys?.[1] ?? "",
      clicks: Number(r.clicks ?? 0) || 0,
      impressions: Number(r.impressions ?? 0) || 0,
      ctr: Number(r.ctr ?? 0) || 0,
      position: Number(r.position ?? 0) || 0,
    }));

    const topPages = (pagesRaw.rows ?? []).map((r) => ({
      page: r.keys?.[0] ?? "",
      clicks: Number(r.clicks ?? 0) || 0,
      impressions: Number(r.impressions ?? 0) || 0,
      ctr: Number(r.ctr ?? 0) || 0,
      position: Number(r.position ?? 0) || 0,
    }));

    const { quickWins, lowCtrPageOne } = classifyOpportunities(rows, 25);

    report = {
      status: "ok",
      source: `gsc-api:${property}`,
      generatedAt,
      property,
      sitemapUrl,
      summary: {
        days: opts.days,
        startDate,
        endDate,
        previousStartDate,
        previousEndDate,
        current,
        previous,
        deltas: {
          clicksPct: pctDelta(current.clicks, previous.clicks),
          impressionsPct: pctDelta(current.impressions, previous.impressions),
          ctrPts: Math.round((current.ctr - previous.ctr) * 10_000) / 100,
          positionDiff:
            previous.position > 0 && current.position > 0
              ? Math.round((current.position - previous.position) * 100) / 100
              : 0,
        },
      },
      sitemap,
      topPages,
      topQueries: [...rows].sort((a, b) => b.clicks - a.clicks).slice(0, 20),
      quickWins,
      lowCtrPageOne,
    };

    const spreadsheetId = env.GOOGLE_SHEETS_GSC_SPREADSHEET_ID?.trim();
    if (spreadsheetId) {
      report.sheetsSynced = await syncToGoogleSheet({
        clientEmail,
        privateKey,
        spreadsheetId,
        report,
      });
    }
    await sendTelegramDigest(report);
  }

  await mkdir(outDir, { recursive: true });
  const dateStamp = generatedAt.slice(0, 10);
  const datedJsonPath = join(outDir, `gsc-monitor-${dateStamp}.json`);
  const latestJsonPath = join(outDir, "gsc-monitor-latest.json");
  const latestMdPath = join(outDir, "gsc-monitor-latest.md");
  const markdown = buildMarkdownReport(report);

  await Promise.all([
    writeFile(datedJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8"),
    writeFile(latestJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8"),
    writeFile(latestMdPath, markdown, "utf8"),
  ]);

  return { report, markdown, datedJsonPath, latestJsonPath, latestMdPath };
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  runGscMonitor()
    .then(({ report, latestMdPath }) => {
      if (report.status === "skipped") {
        console.log(`ℹ️  GSC Monitor ignoré (${report.reason}). Rapport écrit : ${latestMdPath}`);
      } else {
        console.log(
          `✅ GSC Monitor terminé (${report.property}) : ${report.summary?.current.clicks ?? 0} clics, ` +
            `${report.quickWins?.length ?? 0} Quick Wins Page 2 -> ${latestMdPath}`,
        );
      }
    })
    .catch((err) => {
      console.error("❌ GSC Monitor erreur :", err.message);
      process.exit(1);
    });
}
