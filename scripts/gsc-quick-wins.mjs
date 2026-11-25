#!/usr/bin/env node
/**
 * Google Search Console "Page 2 Quick Wins" extractor (positions 11–20)
 * — Step 3 of the claude-seo workflow (`/seo google` -> `/seo page <url>`).
 *
 * Modes:
 *   1. Live Search Console API (RS256 service account via node:crypto):
 *        GOOGLE_INDEXING_CLIENT_EMAIL=... GOOGLE_INDEXING_PRIVATE_KEY=... \
 *        GOOGLE_INDEXING_SITE_URL="sc-domain:nokhba.net.ly" \
 *        npm run seo:gsc-quick-wins
 *   2. Offline CSV export from Google Search Console (Performance -> Export CSV):
 *        npm run seo:gsc-quick-wins -- --csv path/to/Queries.csv
 *
 * Options:
 *   --days <n>       Lookback window in days (default: 28)
 *   --min-pos <n>    Minimum average position (default: 10.5)
 *   --max-pos <n>    Maximum average position (default: 20.5)
 *   --min-impr <n>   Minimum impressions filter (default: 5)
 *   --csv <file>     Parse a local GSC CSV export instead of calling the API
 *   --json           Emit machine-readable JSON
 */

import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const GSC_READONLY_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

function parseArgs(argv) {
  const opts = {
    days: 28,
    minPos: 10.5,
    maxPos: 20.5,
    minImpr: 5,
    csv: null,
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--days" && argv[i + 1]) opts.days = Number(argv[++i]);
    else if (arg === "--min-pos" && argv[i + 1]) opts.minPos = Number(argv[++i]);
    else if (arg === "--max-pos" && argv[i + 1]) opts.maxPos = Number(argv[++i]);
    else if (arg === "--min-impr" && argv[i + 1]) opts.minImpr = Number(argv[++i]);
    else if (arg === "--csv" && argv[i + 1]) opts.csv = argv[++i];
    else if (arg === "--json") opts.json = true;
  }
  return opts;
}

function normalizePrivateKey(raw) {
  let key = raw.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, "\n").replace(/\r/g, "");
}

function buildJwtAssertion(clientEmail, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: clientEmail,
      scope: GSC_READONLY_SCOPE,
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

async function fetchAccessToken(clientEmail, privateKey) {
  const assertion = buildJwtAssertion(clientEmail, privateKey);
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) {
    throw new Error(`OAuth token exchange failed (HTTP ${res.status})`);
  }
  const data = await res.json();
  if (!data.access_token) throw new Error("Missing access_token in OAuth response");
  return data.access_token;
}

function isoDateDaysAgo(days) {
  const d = new Date(Date.now() - days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

async function querySearchAnalytics({ siteUrl, token, days }) {
  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      startDate: isoDateDaysAgo(days + 2),
      endDate: isoDateDaysAgo(2),
      dimensions: ["query", "page"],
      rowLimit: 5000,
      dataState: "final",
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`GSC Search Analytics HTTP ${res.status}: ${detail.slice(0, 200)}`);
  }
  const payload = await res.json();
  return (payload.rows ?? []).map((row) => ({
    query: row.keys?.[0] ?? "",
    page: row.keys?.[1] ?? "",
    clicks: Number(row.clicks ?? 0),
    impressions: Number(row.impressions ?? 0),
    ctr: Number(row.ctr ?? 0),
    position: Number(row.position ?? 0),
  }));
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

function loadRowsFromCsv(filePath) {
  const raw = readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const idxQuery = headers.findIndex((h) => /query|requête|consulta|top queries/i.test(h));
  const idxPage = headers.findIndex((h) => /page|url|página/i.test(h));
  const idxClicks = headers.findIndex((h) => /click|clic/i.test(h));
  const idxImpr = headers.findIndex((h) => /impr/i.test(h));
  const idxCtr = headers.findIndex((h) => /ctr/i.test(h));
  const idxPos = headers.findIndex((h) => /pos/i.test(h));

  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    const ctrRaw = cols[idxCtr] ?? "0";
    const ctrVal = ctrRaw.endsWith("%")
      ? Number.parseFloat(ctrRaw.replace("%", "")) / 100
      : Number.parseFloat(ctrRaw) || 0;
    return {
      query: idxQuery >= 0 ? cols[idxQuery] ?? "" : cols[0] ?? "",
      page: idxPage >= 0 ? cols[idxPage] ?? "" : "",
      clicks: Number.parseFloat((cols[idxClicks] ?? "0").replace(/,/g, "")) || 0,
      impressions: Number.parseFloat((cols[idxImpr] ?? "0").replace(/,/g, "")) || 0,
      ctr: ctrVal,
      position: Number.parseFloat((cols[idxPos] ?? "0").replace(/,/g, "")) || 0,
    };
  });
}

function scoreOpportunity(row) {
  // Expected top-5 organic CTR (~8%) minus current CTR, weighted by impressions
  // and proximity to position 11.
  const targetCtr = 0.08;
  const ctrGap = Math.max(0.005, targetCtr - row.ctr);
  const proximityBoost = Math.max(0.5, (21 - row.position) / 10);
  return Math.round(row.impressions * ctrGap * proximityBoost * 100) / 100;
}

function recommendAction(row) {
  const actions = [];
  if (row.ctr < 0.02) {
    actions.push("Rewrite <title> & meta description with exact query + USD/USDT value prop");
  }
  if (row.position >= 14) {
    actions.push("Add exact query to H2 + Answer-First intro paragraph + 2 internal links from hubs");
  } else {
    actions.push("Align H1/lead copy with query intent + add FAQ item answering exact phrasing");
  }
  return actions.join("; ");
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  let rows = [];
  let source = "";

  if (opts.csv) {
    rows = loadRowsFromCsv(opts.csv);
    source = `csv:${opts.csv}`;
  } else {
    const clientEmail = process.env.GOOGLE_INDEXING_CLIENT_EMAIL?.trim();
    const rawKey = process.env.GOOGLE_INDEXING_PRIVATE_KEY?.trim();
    const siteUrl = (process.env.GOOGLE_INDEXING_SITE_URL || "sc-domain:nokhba.net.ly").trim();
    if (!clientEmail || !rawKey) {
      const msg = {
        status: "skipped",
        reason: "missing_gsc_credentials",
        howToRunLive:
          "Set GOOGLE_INDEXING_CLIENT_EMAIL, GOOGLE_INDEXING_PRIVATE_KEY, and GOOGLE_INDEXING_SITE_URL (e.g. sc-domain:nokhba.net.ly), or pass --csv path/to/gsc-export.csv",
      };
      if (opts.json) {
        console.log(JSON.stringify(msg, null, 2));
      } else {
        console.log("ℹ️  GSC credentials not configured in environment.");
        console.log(`   ${msg.howToRunLive}`);
      }
      return;
    }
    const token = await fetchAccessToken(clientEmail, normalizePrivateKey(rawKey));
    rows = await querySearchAnalytics({ siteUrl, token, days: opts.days });
    source = `gsc-api:${siteUrl}`;
  }

  const quickWins = rows
    .filter(
      (r) =>
        r.position >= opts.minPos &&
        r.position <= opts.maxPos &&
        r.impressions >= opts.minImpr,
    )
    .map((r) => ({
      ...r,
      opportunityScore: scoreOpportunity(r),
      recommendedAction: recommendAction(r),
    }))
    .sort((a, b) => b.opportunityScore - a.opportunityScore);

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          source,
          filter: { minPos: opts.minPos, maxPos: opts.maxPos, minImpr: opts.minImpr },
          count: quickWins.length,
          quickWins: quickWins.slice(0, 50),
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(`# GSC Page-2 Quick Wins (positions ${opts.minPos}–${opts.maxPos}) — ${source}`);
  console.log(`Found ${quickWins.length} queries with >= ${opts.minImpr} impressions.\n`);
  console.log("| # | Query | Target URL | Pos | Impr | Clicks | CTR | Score | Action (`/seo page`) |");
  console.log("|---|---|---|---|---|---|---|---|---|");
  for (const [idx, item] of quickWins.slice(0, 30).entries()) {
    const ctrPct = `${(item.ctr * 100).toFixed(1)}%`;
    console.log(
      `| ${idx + 1} | ${item.query} | ${item.page || "—"} | ${item.position.toFixed(1)} | ${item.impressions} | ${item.clicks} | ${ctrPct} | ${item.opportunityScore} | ${item.recommendedAction} |`,
    );
  }
}

main().catch((err) => {
  console.error("gsc-quick-wins error:", err.message);
  process.exit(1);
});
