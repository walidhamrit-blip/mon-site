#!/usr/bin/env node
/**
 * Google Search Console Monitor — Mode « Quotidien intelligent » (7j/7).
 *
 * Exécuté tous les matins à 08:30 UTC par `.github/workflows/gsc-monitor.yml` :
 *   1. Contrôle quotidien des clics, impressions, CTR et positions :
 *      - Pouls court terme (7 derniers jours vs 7 jours précédents)
 *      - Tendance de fond (28 derniers jours vs 28 jours précédents)
 *   2. Gestion intelligente du `sitemap.xml` (`--sitemap-mode auto`) :
 *      - Lit d'abord l'état actuel chez Google (`GET sitemaps`).
 *      - Resoumet (`PUT sitemaps`) uniquement le lundi, si le sitemap est absent,
 *        si Google ne l'a pas relu depuis >= 7 jours, ou si des erreurs subsistent
 *        (avec un délai minimal de 20h entre deux renvois) — évite le spam quotidien.
 *   3. Détection élargie des **Quick Wins Page 2** (requêtes ET pages en pos. 11–20)
 *      et des **Pages en 1re page à CTR < 3,5 %**.
 *   4. Met à jour quotidiennement `reports/gsc-monitor-latest.md` (+ Ticket GitHub #269
 *      lisible directement depuis Arena) et n'alerte Telegram hors lundi qu'en cas
 *      d'anomalie (erreurs sitemap ou chute brutale de clics).
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
    sitemapMode: "never", // "never" | "always" | "auto"
    forceAlert: false,
    csv: null,
    outDir: null,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--days" && argv[i + 1]) {
      opts.days = Math.max(7, Math.min(90, Number(argv[++i]) || 28));
    } else if (arg === "--submit-sitemap") {
      opts.submitSitemap = true;
      opts.sitemapMode = "always";
    } else if (arg === "--sitemap-mode" && argv[i + 1]) {
      const m = String(argv[++i]).toLowerCase();
      if (m === "auto" || m === "always" || m === "never") {
        opts.sitemapMode = m;
        opts.submitSitemap = m === "always";
      }
    } else if (arg === "--force-alert") {
      opts.forceAlert = true;
    } else if (arg === "--csv" && argv[i + 1]) {
      opts.csv = argv[++i];
    } else if (arg === "--out-dir" && argv[i + 1]) {
      opts.outDir = argv[++i];
    } else if (arg === "--dry-run") {
      opts.dryRun = true;
    }
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

/**
 * Décide intelligemment s'il faut resoumettre `sitemap.xml` aujourd'hui.
 */
export function decideSmartSitemapSubmit({
  mode = "auto",
  status = "ok",
  errors = 0,
  lastDownloaded = null,
  lastSubmitted = null,
  nowMs = Date.now(),
} = {}) {
  if (mode === "never") return { shouldSubmit: false, reason: "disabled" };
  if (mode === "always") return { shouldSubmit: true, reason: "forced_always" };

  if (status === "not_found") {
    return { shouldSubmit: true, reason: "missing_in_gsc" };
  }

  const submittedAgeMs = lastSubmitted ? nowMs - Date.parse(lastSubmitted) : Infinity;
  if (errors > 0 && (!Number.isFinite(submittedAgeMs) || submittedAgeMs >= 20 * 3_600_000)) {
    return { shouldSubmit: true, reason: "has_errors_retry_24h" };
  }

  const downloadedAgeMs = lastDownloaded ? nowMs - Date.parse(lastDownloaded) : Infinity;
  if (!Number.isFinite(downloadedAgeMs) || downloadedAgeMs >= 7 * 86_400_000) {
    return { shouldSubmit: true, reason: "stale_download_7d" };
  }

  const dayOfWeekUtc = new Date(nowMs).getUTCDay(); // 1 = Lundi
  if (dayOfWeekUtc === 1 && (!Number.isFinite(submittedAgeMs) || submittedAgeMs >= 20 * 3_600_000)) {
    return { shouldSubmit: true, reason: "weekly_monday_refresh" };
  }

  return { shouldSubmit: false, reason: "healthy_skip_daily" };
}

/**
 * Décide si une notification active (Telegram) doit partir aujourd'hui :
 * - Lundi = condensé hebdomadaire complet
 * - Mardi–Dimanche = uniquement en cas d'anomalie (erreur sitemap ou chute >= 50 % sur 7j)
 */
export function shouldSendDailyAlert({
  report,
  forceAlert = false,
  nowMs = Date.now(),
} = {}) {
  if (!report || report.status !== "ok") return { send: false, reason: "not_ok" };
  if (forceAlert) return { send: true, reason: "manual_run" };
  if ((report.sitemap?.errors ?? 0) > 0) {
    return { send: true, reason: "sitemap_errors" };
  }
  const prev7 = report.pulse7d?.previous?.clicks ?? 0;
  const cur7 = report.pulse7d?.current?.clicks ?? 0;
  if (prev7 >= 10 && cur7 <= prev7 * 0.5) {
    return { send: true, reason: "traffic_drop_7d" };
  }
  if (new Date(nowMs).getUTCDay() === 1) {
    return { send: true, reason: "weekly_monday_digest" };
  }
  return { send: false, reason: "quiet_healthy_day" };
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
    return "Page 1 mais CTR < 3,5 % : réécrire <title> & meta description (bénéfice immédiat USD/USDT, livraison auto) — respecter 14–21j entre deux retouches";
  }
  const actions = [];
  if (row.ctr < 0.025) {
    actions.push("Réécrire <title> & meta description avec la requête exacte + valeur ajoutée");
  }
  if (row.position >= 14.5) {
    actions.push("Ajouter un H2 exact + paragraphe Answer-First (40–60 mots) + 2 liens internes depuis les hubs");
  } else {
    actions.push("Aligner H1 / chapô avec l'intention exacte + ajouter une question FAQ dédiée");
  }
  return actions.join(" · ");
}

export function classifyOpportunities(rows = [], topPages = [], limit = 25) {
  const queryQuickWins = rows
    .filter((r) => r.position >= 10.5 && r.position <= 20.5 && r.impressions >= 3)
    .map((r) => ({
      ...r,
      kind: "page2_quick_win",
      opportunityScore: scoreOpportunity(r),
      missedClicksEstimate: Math.max(1, Math.round(r.impressions * Math.max(0.01, 0.08 - r.ctr))),
      recommendedAction: recommendAction(r),
    }));

  const coveredPages = new Set(queryQuickWins.map((r) => r.page).filter(Boolean));
  const pageLevelQuickWins = topPages
    .filter(
      (p) =>
        p.page &&
        !coveredPages.has(p.page) &&
        p.position >= 10.5 &&
        p.position <= 20.5 &&
        p.impressions >= 5,
    )
    .map((p) => {
      const synthetic = { query: "(toutes requêtes cumulées)", ...p };
      return {
        ...synthetic,
        kind: "page2_quick_win",
        opportunityScore: scoreOpportunity(synthetic),
        missedClicksEstimate: Math.max(1, Math.round(p.impressions * Math.max(0.01, 0.08 - p.ctr))),
        recommendedAction: recommendAction(synthetic),
      };
    });

  const quickWins = [...queryQuickWins, ...pageLevelQuickWins]
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
    .slice(0, limit);

  const queryLowCtr = rows
    .filter((r) => r.position >= 1 && r.position < 10.5 && r.impressions >= 20 && r.ctr < 0.035)
    .map((r) => {
      const expectedCtr = r.position <= 3 ? 0.15 : r.position <= 6 ? 0.07 : 0.05;
      const missed = Math.max(1, Math.round(r.impressions * Math.max(0.01, expectedCtr - r.ctr)));
      return {
        ...r,
        kind: "page1_low_ctr",
        opportunityScore: missed,
        missedClicksEstimate: missed,
        recommendedAction: recommendAction(r),
      };
    });

  const coveredLowCtrPages = new Set(queryLowCtr.map((r) => r.page).filter(Boolean));
  const pageLowCtr = topPages
    .filter(
      (p) =>
        p.page &&
        !coveredLowCtrPages.has(p.page) &&
        p.position >= 1 &&
        p.position < 10.5 &&
        p.impressions >= 20 &&
        p.ctr < 0.035,
    )
    .map((p) => {
      const expectedCtr = p.position <= 3 ? 0.15 : p.position <= 6 ? 0.07 : 0.05;
      const missed = Math.max(1, Math.round(p.impressions * Math.max(0.01, expectedCtr - p.ctr)));
      const synthetic = { query: "(toutes requêtes cumulées)", ...p };
      return {
        ...synthetic,
        kind: "page1_low_ctr",
        opportunityScore: missed,
        missedClicksEstimate: missed,
        recommendedAction: recommendAction(synthetic),
      };
    });

  const lowCtrPageOne = [...queryLowCtr, ...pageLowCtr]
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

async function readSitemapState({ endpoint, token }) {
  const getRes = await fetch(endpoint, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (getRes.status === 404) {
    return { status: "not_found", warnings: 0, errors: 0, submittedUrls: 0, indexedUrls: 0 };
  }
  if (!getRes.ok) {
    return { status: `http_${getRes.status}`, warnings: 0, errors: 0, submittedUrls: 0, indexedUrls: 0 };
  }
  const data = await getRes.json();
  const contents = Array.isArray(data.contents) ? data.contents : [];
  return {
    status: "ok",
    lastSubmitted: data.lastSubmitted ?? null,
    lastDownloaded: data.lastDownloaded ?? null,
    isPending: Boolean(data.isPending),
    warnings: Number(data.warnings ?? 0) || 0,
    errors: Number(data.errors ?? 0) || 0,
    submittedUrls: contents.reduce((sum, c) => sum + (Number(c.submitted ?? 0) || 0), 0),
    indexedUrls: contents.reduce((sum, c) => sum + (Number(c.indexed ?? 0) || 0), 0),
  };
}

async function inspectAndSmartSubmitSitemap({ property, sitemapUrl, token, sitemapMode, nowMs }) {
  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/sitemaps/${encodeURIComponent(sitemapUrl)}`;
  let current = await readSitemapState({ endpoint, token });

  const decision = decideSmartSitemapSubmit({
    mode: sitemapMode,
    status: current.status,
    errors: current.errors,
    lastDownloaded: current.lastDownloaded,
    lastSubmitted: current.lastSubmitted,
    nowMs,
  });

  let submission = {
    attempted: false,
    ok: false,
    status: null,
    decisionReason: decision.reason,
    note: null,
  };

  if (decision.shouldSubmit) {
    if (isPreviewOrLocalOrigin(sitemapUrl)) {
      submission.note = "skipped_preview_or_local";
    } else {
      submission.attempted = true;
      const putRes = await fetch(endpoint, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      submission.status = putRes.status;
      submission.ok = putRes.ok;
      if (putRes.ok) {
        current = await readSitemapState({ endpoint, token });
      } else {
        submission.note =
          putRes.status === 403
            ? "HTTP 403 : donnez le droit « Complet » au compte de service dans Search Console."
            : `HTTP ${putRes.status}`;
      }
    }
  }

  return {
    ...current,
    submission,
  };
}

function escapeMdCell(text = "") {
  return String(text).replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
}

function buildPeriodSummary(days, current, previous, dates) {
  return {
    days,
    ...dates,
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
  };
}

export function buildMarkdownReport(report) {
  const lines = [];
  lines.push(`# 📊 Suivi quotidien Google Search Console — \`${report.property}\``);
  lines.push("");
  lines.push(`- **Dernier contrôle (7j/7)** : \`${report.generatedAt}\``);
  lines.push(`- **Statut** : \`${report.status}\``);
  lines.push(`- **Sitemap contrôlé** : \`${report.sitemapUrl}\``);

  if (report.status === "skipped") {
    lines.push("");
    lines.push("> ℹ️ **Identifiants Search Console non configurés.** Ajoutez `GOOGLE_INDEXING_CLIENT_EMAIL`, `GOOGLE_INDEXING_PRIVATE_KEY` et `GOOGLE_INDEXING_SITE_URL` dans GitHub Secrets & Vercel pour activer le suivi automatique.");
    return `${lines.join("\n")}\n`;
  }

  const fmtDelta = (v, unit = "%") => (v === null || v === undefined ? "—" : `${v > 0 ? "+" : ""}${v}${unit}`);

  if (report.pulse7d && report.summary) {
    const p7 = report.pulse7d;
    const s28 = report.summary;
    lines.push(`- **Pouls 7 jours** : \`${p7.startDate}\` → \`${p7.endDate}\` · **Tendance ${s28.days} jours** : \`${s28.startDate}\` → \`${s28.endDate}\``);
    lines.push("");
    lines.push("## 1. Indicateurs globaux (Pouls 7j & Tendance 28j)");
    lines.push("");
    lines.push("| Indicateur | 7 derniers jours | Évol. 7j | 28 derniers jours | Évol. 28j |");
    lines.push("|---|---:|---:|---:|---:|");
    lines.push(`| **Clics organiques** | **${p7.current.clicks}** | ${fmtDelta(p7.deltas.clicksPct, " %")} | **${s28.current.clicks}** | ${fmtDelta(s28.deltas.clicksPct, " %")} |`);
    lines.push(`| **Impressions** | **${p7.current.impressions}** | ${fmtDelta(p7.deltas.impressionsPct, " %")} | **${s28.current.impressions}** | ${fmtDelta(s28.deltas.impressionsPct, " %")} |`);
    lines.push(`| **CTR moyen** | **${(p7.current.ctr * 100).toFixed(2)} %** | ${fmtDelta(p7.deltas.ctrPts, " pt")} | **${(s28.current.ctr * 100).toFixed(2)} %** | ${fmtDelta(s28.deltas.ctrPts, " pt")} |`);
    lines.push(`| **Position moyenne** | **${p7.current.position > 0 ? p7.current.position.toFixed(1) : "—"}** | ${fmtDelta(p7.deltas.positionDiff, "")} | **${s28.current.position > 0 ? s28.current.position.toFixed(1) : "—"}** | ${fmtDelta(s28.deltas.positionDiff, "")} |`);
  } else if (report.summary) {
    const s = report.summary;
    lines.push(`- **Fenêtre** : \`${s.startDate}\` → \`${s.endDate}\` (${s.days}j vs \`${s.previousStartDate}\` → \`${s.previousEndDate}\`)`);
    lines.push("");
    lines.push(`## 1. Indicateurs globaux (${s.days} jours)`);
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
        `- **Resoumission intelligente** : ${sm.submission.ok ? `✅ envoyée (\`${sm.submission.decisionReason}\`)` : `⚠️ ${sm.submission.note ?? "échec"}`}`,
      );
    } else if (sm.submission?.decisionReason) {
      lines.push(
        `- **Resoumission intelligente** : ⏭️ non nécessaire aujourd'hui (\`${sm.submission.decisionReason}\` — évite le spam Google)`,
      );
    }
  }

  const quickWins = report.quickWins ?? [];
  lines.push("");
  lines.push(`## 3. Quick Wins Page 2 — Positions 11 à 20 (${quickWins.length})`);
  lines.push("");
  if (quickWins.length === 0) {
    lines.push("_Aucune requête ou page détectée entre les positions 10.5 et 20.5 sur cette période._");
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
  lines.push(`## 4. Pages en 1re page à faible CTR < 3,5 % (${lowCtr.length})`);
  lines.push("");
  if (lowCtr.length === 0) {
    lines.push("_Aucune requête ou page en Top 10 avec >= 20 impressions et CTR < 3,5 %._");
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
  lines.push("> **Règle SEO anti-yo-yo :** laissez **14 à 21 jours** à Google après la réécriture du `<title>` d'une page avant de la retoucher à nouveau. Optimisez en priorité les nouvelles URL détectées.");
  lines.push("_Pour appliquer automatiquement les nouvelles opportunités dans Arena : demandez « Applique les Quick Wins du dernier rapport Search Console »._");
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
      report.pulse7d?.current?.clicks ?? "",
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
      console.warn(`[gsc-monitor] Google Sheets HTTP ${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[gsc-monitor] Sync Google Sheets ignorée :", err.message);
    return false;
  }
}

async function sendTelegramDigest(report, alertDecision) {
  if (!alertDecision?.send) return false;
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID?.trim();
  if (!botToken || !chatId || report.status !== "ok" || !report.summary) return false;
  try {
    const s = report.summary;
    const p7 = report.pulse7d;
    const topWin = report.quickWins?.[0];
    const prefix =
      alertDecision.reason === "sitemap_errors"
        ? "⚠️ Alerte Sitemap Search Console"
        : alertDecision.reason === "traffic_drop_7d"
          ? "⚠️ Alerte baisse de clics Search Console (7j)"
          : "📊 Bilan Search Console";
    const text = [
      `${prefix} — ${report.property}`,
      p7 ? `• 7 jours : ${p7.current.clicks} clics · ${p7.current.impressions} impr.` : "",
      `• ${s.days} jours : ${s.current.clicks} clics (${s.deltas.clicksPct !== null ? `${s.deltas.clicksPct > 0 ? "+" : ""}${s.deltas.clicksPct}%` : "—"}) · ${s.current.impressions} impr.`,
      `• CTR : ${(s.current.ctr * 100).toFixed(2)}% · Pos. moy. : ${s.current.position.toFixed(1)}`,
      `• Sitemap : ${report.sitemap?.errors ?? 0} erreur(s) · ${report.sitemap?.submittedUrls ?? 0} URL`,
      `• Quick Wins Page 2 : ${report.quickWins?.length ?? 0}`,
      topWin ? `• Priorité #1 : « ${topWin.query} » (${topWin.page.replace(/^https?:\/\/[^/]+/, "") || "/"}, pos. ${topWin.position.toFixed(1)})` : "",
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

export async function runGscMonitor(argv = process.argv.slice(2), env = process.env, nowMs = Date.now()) {
  const opts = parseMonitorArgs(argv);
  const baseUrl = (env.SITE_URL || "https://nokhba.net.ly").trim().replace(/\/+$/, "");
  const property = normalizeProperty(baseUrl, env.GOOGLE_INDEXING_SITE_URL);
  const sitemapUrl = `${baseUrl}/sitemap.xml`;
  const generatedAt = new Date(nowMs).toISOString();
  const rootDir = fileURLToPath(new URL("..", import.meta.url));
  const outDir = opts.outDir || join(rootDir, "reports");

  let report;

  if (opts.csv) {
    const rows = parseGscCsv(readFileSync(opts.csv, "utf8"));
    const { quickWins, lowCtrPageOne } = classifyOpportunities(rows, [], 25);
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

    const endDate = isoDateDaysAgo(2, nowMs);
    const startDate = isoDateDaysAgo(opts.days + 1, nowMs);
    const previousEndDate = isoDateDaysAgo(opts.days + 2, nowMs);
    const previousStartDate = isoDateDaysAgo(opts.days * 2 + 1, nowMs);

    const start7d = isoDateDaysAgo(8, nowMs);
    const prevEnd7d = isoDateDaysAgo(9, nowMs);
    const prevStart7d = isoDateDaysAgo(15, nowMs);

    const [
      curTotalsRaw,
      prevTotalsRaw,
      cur7Raw,
      prev7Raw,
      pagesRaw,
      queryPageRaw,
      sitemap,
    ] = await Promise.all([
      queryAnalytics({ property, token, startDate, endDate, dimensions: [], rowLimit: 1 }),
      queryAnalytics({
        property,
        token,
        startDate: previousStartDate,
        endDate: previousEndDate,
        dimensions: [],
        rowLimit: 1,
      }),
      queryAnalytics({ property, token, startDate: start7d, endDate, dimensions: [], rowLimit: 1 }),
      queryAnalytics({
        property,
        token,
        startDate: prevStart7d,
        endDate: prevEnd7d,
        dimensions: [],
        rowLimit: 1,
      }),
      queryAnalytics({ property, token, startDate, endDate, dimensions: ["page"], rowLimit: 30 }),
      queryAnalytics({
        property,
        token,
        startDate,
        endDate,
        dimensions: ["query", "page"],
        rowLimit: 5000,
      }),
      inspectAndSmartSubmitSitemap({
        property,
        sitemapUrl,
        token,
        sitemapMode: opts.sitemapMode,
        nowMs,
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

    const { quickWins, lowCtrPageOne } = classifyOpportunities(rows, topPages, 25);

    report = {
      status: "ok",
      source: `gsc-api:${property}`,
      generatedAt,
      property,
      sitemapUrl,
      pulse7d: buildPeriodSummary(7, extract(cur7Raw), extract(prev7Raw), {
        startDate: start7d,
        endDate,
        previousStartDate: prevStart7d,
        previousEndDate: prevEnd7d,
      }),
      summary: buildPeriodSummary(opts.days, extract(curTotalsRaw), extract(prevTotalsRaw), {
        startDate,
        endDate,
        previousStartDate,
        previousEndDate,
      }),
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

    const alertDecision = shouldSendDailyAlert({
      report,
      forceAlert: opts.forceAlert,
      nowMs,
    });
    report.alertDecision = alertDecision;
    await sendTelegramDigest(report, alertDecision);
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
          `✅ GSC Monitor quotidien terminé (${report.property}) : ` +
            `7j=${report.pulse7d?.current.clicks ?? "—"} clics, ` +
            `28j=${report.summary?.current.clicks ?? 0} clics, ` +
            `${report.quickWins?.length ?? 0} Quick Wins -> ${latestMdPath}`,
        );
      }
    })
    .catch((err) => {
      console.error("❌ GSC Monitor erreur :", err.message);
      process.exit(1);
    });
}
