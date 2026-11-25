import { createSign } from "node:crypto";
import { siteConfig } from "@/lib/config";

/**
 * Intégration **Google Search Console** (API Sitemaps + Search Analytics).
 *
 * Pourquoi ce module :
 *  1. L'ancien « ping » `https://www.google.com/ping?sitemap=…` a été retiré
 *     par Google (404 depuis 2023). La seule voie officielle est l'API Search
 *     Console (`sitemaps.submit` / `sitemaps.get`), authentifiée par un compte
 *     de service Google Cloud.
 *  2. La lecture de `searchAnalytics.query` permet d'extraire automatiquement
 *     les indicateurs (clics, impressions, CTR, position moyenne), les
 *     **Quick Wins Page 2** (positions 11–20) et les pages **Page 1 à faible
 *     CTR** pour alimenter `/admin/search-console` et le suivi hebdomadaire CI.
 *
 * Aucune dépendance supplémentaire : le JWT RS256 est signé avec `node:crypto`.
 *
 * Configuration (100 % optionnelle, le site fonctionne sans) :
 *   GOOGLE_INDEXING_CLIENT_EMAIL   → `xxx@projet.iam.gserviceaccount.com`
 *   GOOGLE_INDEXING_PRIVATE_KEY    → clé privée du compte de service (PEM)
 *   GOOGLE_INDEXING_SITE_URL       → propriété Search Console
 *                                    (`sc-domain:exemple.com` ou `https://exemple.com/`)
 *   GOOGLE_INDEXING_ALLOW_NON_PRODUCTION=true → autorise la soumission hors Vercel prod
 *
 * Important sur les droits Search Console :
 *   - Lecture seule (`searchAnalytics.query`, `sitemaps.get`) : accès « Restreint » ou « Complet ».
 *   - Soumission du sitemap (`PUT sitemaps`) : accès **« Complet » (`Full`)** requis dans
 *     Search Console → Paramètres → Utilisateurs et autorisations.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const WEBMASTERS_SCOPE = "https://www.googleapis.com/auth/webmasters";
const REQUEST_TIMEOUT_MS = 12_000;

export interface GoogleServiceAccount {
  clientEmail: string;
  privateKey: string;
}

export interface GoogleSitemapResult {
  status: "submitted" | "skipped" | "error";
  reason?: string;
  httpStatus?: number;
  property?: string;
  sitemapUrl?: string;
}

export interface GoogleSitemapStatus {
  status: "ok" | "not_found" | "skipped" | "error";
  property: string;
  sitemapUrl: string;
  lastSubmitted?: string | null;
  lastDownloaded?: string | null;
  isPending?: boolean;
  isSitemapsIndex?: boolean;
  warnings?: number;
  errors?: number;
  submittedUrls?: number;
  indexedUrls?: number;
  reason?: string;
  httpStatus?: number;
}

export interface SearchConsoleRow {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SearchConsoleOpportunity extends SearchConsoleRow {
  kind: "page2_quick_win" | "page1_low_ctr";
  opportunityScore: number;
  missedClicksEstimate: number;
  recommendedAction: string;
}

export interface SearchConsolePageMetric {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SearchConsoleTotals {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SearchConsolePeriodSummary {
  days: number;
  startDate: string;
  endDate: string;
  previousStartDate: string;
  previousEndDate: string;
  current: SearchConsoleTotals;
  previous: SearchConsoleTotals;
  deltas: {
    clicksPct: number | null;
    impressionsPct: number | null;
    /** Différence en points de pourcentage (ex. +0.8 pt). */
    ctrPts: number;
    /** Différence de position moyenne (négatif = amélioration du rang). */
    positionDiff: number;
  };
}

export interface SearchConsoleSnapshot {
  status: "ok" | "skipped" | "error";
  generatedAt: string;
  property: string;
  sitemapUrl: string;
  reason?: string;
  summary?: SearchConsolePeriodSummary;
  sitemap?: GoogleSitemapStatus;
  topPages?: SearchConsolePageMetric[];
  topQueries?: SearchConsoleRow[];
  quickWins?: SearchConsoleOpportunity[];
  lowCtrPageOne?: SearchConsoleOpportunity[];
}

export interface SearchConsoleConfigStatus {
  configured: boolean;
  clientEmail: string | null;
  privateKeyConfigured: boolean;
  property: string;
  sitemapUrl: string;
  allowedInCurrentEnv: boolean;
}

/** Nettoie une clé PEM copiée depuis une variable d'environnement. */
export function normalizePrivateKey(raw: string): string {
  let key = raw.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, "\n").replace(/\r/g, "");
}

/** Lit le compte de service depuis l'environnement (null si incomplet). */
export function readGoogleServiceAccount(
  env: Record<string, string | undefined> = process.env,
): GoogleServiceAccount | null {
  const clientEmail = env.GOOGLE_INDEXING_CLIENT_EMAIL?.trim();
  const rawKey = env.GOOGLE_INDEXING_PRIVATE_KEY?.trim();
  if (!clientEmail || !rawKey) return null;
  return { clientEmail, privateKey: normalizePrivateKey(rawKey) };
}

function base64url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

/**
 * Construit l'assertion JWT « compte de service » (grant OAuth2
 * `urn:ietf:params:oauth:grant-type:jwt-bearer`).
 */
export function buildServiceAccountAssertion(
  account: GoogleServiceAccount,
  options: { now?: number; scope?: string; audience?: string; lifetimeSeconds?: number } = {},
): string {
  const nowSeconds = Math.floor((options.now ?? Date.now()) / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: account.clientEmail,
    scope: options.scope ?? WEBMASTERS_SCOPE,
    aud: options.audience ?? TOKEN_URL,
    iat: nowSeconds,
    exp: nowSeconds + (options.lifetimeSeconds ?? 3600),
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(account.privateKey);
  return `${unsigned}.${base64url(signature)}`;
}

/**
 * Normalise la propriété Search Console :
 *   - `exemple.com` → `https://exemple.com/`
 *   - `sc-domain:exemple.com` conservé tel quel (propriété Domaine).
 *
 * La propriété suit le domaine configuré : `GOOGLE_INDEXING_SITE_URL` pour la
 * surcharger, sinon l'URL canonique du site.
 */
export function searchConsoleProperty(siteUrl: string, override?: string): string {
  const value = (override?.trim() || siteUrl).trim();
  if (/^sc-domain:/i.test(value)) {
    return `sc-domain:${value.slice("sc-domain:".length).trim().replace(/\/+$/, "").toLowerCase()}`;
  }
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return `${withProtocol.replace(/\/+$/, "")}/`;
}

/** Sitemap absolu par défaut, toujours sur le domaine de production. */
export function sitemapUrlFor(baseUrl: string, path = "/sitemap.xml"): string {
  const origin = baseUrl.trim().replace(/\/+$/, "");
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Refuse les domaines éphémères ou locaux lors d'une soumission de sitemap,
 * même si un administrateur force l'exécution depuis une preview.
 */
export function isPreviewOrLocalOrigin(urlOrOrigin: string): boolean {
  try {
    const parsed = new URL(
      /^https?:\/\//i.test(urlOrOrigin) ? urlOrOrigin : `https://${urlOrOrigin}`,
    );
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

/** N'appelle l'API d'écriture qu'en production (ou si l'override explicite est posé). */
export function googleIndexingAllowed(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return (
    env.VERCEL_ENV === "production" ||
    env.GOOGLE_INDEXING_ALLOW_NON_PRODUCTION === "true" ||
    env.NODE_ENV === "test"
  );
}

/** État lisible de la configuration Search Console sans exposer la clé privée. */
export function getSearchConsoleConfigStatus(
  baseUrl: string = siteConfig.url,
  env: Record<string, string | undefined> = process.env,
): SearchConsoleConfigStatus {
  const clientEmail = env.GOOGLE_INDEXING_CLIENT_EMAIL?.trim() || null;
  const privateKeyConfigured = Boolean(env.GOOGLE_INDEXING_PRIVATE_KEY?.trim());
  const property = searchConsoleProperty(baseUrl, env.GOOGLE_INDEXING_SITE_URL);
  const sitemapUrl = sitemapUrlFor(baseUrl);
  return {
    configured: Boolean(clientEmail && privateKeyConfigured),
    clientEmail,
    privateKeyConfigured,
    property,
    sitemapUrl,
    allowedInCurrentEnv: googleIndexingAllowed(env),
  };
}

type TokenCacheEntry = { accessToken: string; expiresAt: number };
const tokenCache = new Map<string, TokenCacheEntry>();

async function fetchAccessToken(
  account: GoogleServiceAccount,
  scope: string = WEBMASTERS_SCOPE,
): Promise<string> {
  const cacheKey = `${account.clientEmail}:${scope}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 30_000) {
    return cached.accessToken;
  }
  const assertion = buildServiceAccountAssertion(account, { scope });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }).toString(),
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };
    if (!res.ok || !data.access_token) {
      throw new Error(
        `token ${res.status} ${data.error ?? ""} ${data.error_description ?? ""}`.trim(),
      );
    }
    tokenCache.set(cacheKey, {
      accessToken: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    });
    return data.access_token;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Soumet (ou re-soumet) le sitemap à Search Console. Idempotent : Google
 * traite un sitemap déjà connu comme une demande de recrawl.
 */
export async function notifyGoogleSitemap(
  baseUrl: string = siteConfig.url,
  options: { sitemapPath?: string; siteUrl?: string; allowManualAdmin?: boolean } = {},
): Promise<GoogleSitemapResult> {
  const account = readGoogleServiceAccount();
  if (!account) {
    return { status: "skipped", reason: "not-configured" };
  }
  if (!options.allowManualAdmin && !googleIndexingAllowed()) {
    return { status: "skipped", reason: "not-production" };
  }
  if (isPreviewOrLocalOrigin(baseUrl)) {
    return { status: "skipped", reason: "preview-or-local-origin" };
  }

  const property = searchConsoleProperty(
    baseUrl,
    options.siteUrl ?? process.env.GOOGLE_INDEXING_SITE_URL,
  );
  const sitemapUrl = sitemapUrlFor(baseUrl, options.sitemapPath);

  try {
    const accessToken = await fetchAccessToken(account);
    const endpoint =
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}` +
      `/sitemaps/${encodeURIComponent(sitemapUrl)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: controller.signal,
      });
      if (res.ok) {
        console.log(`[search-console] sitemap soumis : ${sitemapUrl} (${property})`);
        return {
          status: "submitted",
          httpStatus: res.status,
          property,
          sitemapUrl,
        };
      }
      console.warn(`[search-console] réponse non-OK : ${res.status}`);
      return {
        status: "error",
        reason: `http_${res.status}`,
        httpStatus: res.status,
        property,
        sitemapUrl,
      };
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Un échec d'authentification ne doit jamais faire échouer une sauvegarde
    // d'administration : on journalise et on continue.
    console.warn("[search-console] soumission ignorée :", message);
    return {
      status: "error",
      reason: message.slice(0, 160),
      property,
      sitemapUrl,
    };
  }
}

interface RawGscSitemapResponse {
  path?: string;
  lastSubmitted?: string;
  lastDownloaded?: string;
  isPending?: boolean;
  isSitemapsIndex?: boolean;
  warnings?: string | number;
  errors?: string | number;
  contents?: Array<{
    type?: string;
    submitted?: string | number;
    indexed?: string | number;
  }>;
}

/** Interroge l'état actuel du sitemap déclaré dans Search Console. */
export async function fetchGoogleSitemapStatus(
  baseUrl: string = siteConfig.url,
  options: { sitemapPath?: string; siteUrl?: string; accessToken?: string } = {},
): Promise<GoogleSitemapStatus> {
  const property = searchConsoleProperty(
    baseUrl,
    options.siteUrl ?? process.env.GOOGLE_INDEXING_SITE_URL,
  );
  const sitemapUrl = sitemapUrlFor(baseUrl, options.sitemapPath);

  let token = options.accessToken;
  if (!token) {
    const account = readGoogleServiceAccount();
    if (!account) {
      return {
        status: "skipped",
        property,
        sitemapUrl,
        reason: "not-configured",
      };
    }
    try {
      token = await fetchAccessToken(account);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        status: "error",
        property,
        sitemapUrl,
        reason: message.slice(0, 160),
      };
    }
  }

  const endpoint =
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}` +
    `/sitemaps/${encodeURIComponent(sitemapUrl)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(endpoint, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    if (res.status === 404) {
      return {
        status: "not_found",
        property,
        sitemapUrl,
        httpStatus: 404,
        reason: "sitemap_not_submitted_yet",
      };
    }
    if (!res.ok) {
      return {
        status: "error",
        property,
        sitemapUrl,
        httpStatus: res.status,
        reason: `http_${res.status}`,
      };
    }
    const data = (await res.json()) as RawGscSitemapResponse;
    const contents = Array.isArray(data.contents) ? data.contents : [];
    const submittedUrls = contents.reduce(
      (sum, entry) => sum + (Number(entry.submitted ?? 0) || 0),
      0,
    );
    const indexedUrls = contents.reduce(
      (sum, entry) => sum + (Number(entry.indexed ?? 0) || 0),
      0,
    );
    return {
      status: "ok",
      property,
      sitemapUrl,
      httpStatus: res.status,
      lastSubmitted: data.lastSubmitted ?? null,
      lastDownloaded: data.lastDownloaded ?? null,
      isPending: Boolean(data.isPending),
      isSitemapsIndex: Boolean(data.isSitemapsIndex),
      warnings: Number(data.warnings ?? 0) || 0,
      errors: Number(data.errors ?? 0) || 0,
      submittedUrls,
      indexedUrls,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: "error",
      property,
      sitemapUrl,
      reason: message.slice(0, 160),
    };
  } finally {
    clearTimeout(timeout);
  }
}

/** Score d'opportunité pour une requête en Page 2 (positions ~10.5 à 20.5). */
export function scoreSearchConsoleOpportunity(row: SearchConsoleRow): number {
  const targetCtr = 0.08;
  const ctrGap = Math.max(0.005, targetCtr - row.ctr);
  const proximityBoost = Math.max(0.5, (21 - row.position) / 10);
  return Math.round(row.impressions * ctrGap * proximityBoost * 100) / 100;
}

/** Prescrit l'action SEO concrète selon la position et le CTR observés. */
export function recommendPageOptimization(row: SearchConsoleRow): string {
  if (row.position < 10.5) {
    return "Déjà en Page 1 mais CTR bas : réécrire <title> & meta description (bénéfice immédiat USD/USDT, livraison auto, chiffre clé) sans toucher l’URL.";
  }
  const actions: string[] = [];
  if (row.ctr < 0.02) {
    actions.push("Réécrire <title> & meta description avec l’expression exacte + proposition de valeur");
  }
  if (row.position >= 14.5) {
    actions.push("Ajouter un H2 exact + paragraphe Answer-First (40–60 mots) + 2 liens internes depuis les hubs");
  } else {
    actions.push("Aligner H1 / chapô avec l’intention exacte + ajouter une question FAQ dédiée");
  }
  return actions.join(" · ");
}

/**
 * Classe les lignes Search Console en deux leviers actionnables :
 *  1. `quickWins` : positions 10.5–20.5 (« Page 2 » proche du Top 10).
 *  2. `lowCtrPageOne` : positions 1–10.4 avec CTR < 2.5 % et impressions significatives.
 */
export function classifySearchConsoleOpportunities(
  rows: readonly SearchConsoleRow[],
  options: {
    minPos?: number;
    maxPos?: number;
    minImpr?: number;
    minPageOneImpr?: number;
    maxLowCtr?: number;
    limit?: number;
  } = {},
): {
  quickWins: SearchConsoleOpportunity[];
  lowCtrPageOne: SearchConsoleOpportunity[];
} {
  const minPos = options.minPos ?? 10.5;
  const maxPos = options.maxPos ?? 20.5;
  const minImpr = options.minImpr ?? 5;
  const minPageOneImpr = options.minPageOneImpr ?? 20;
  const maxLowCtr = options.maxLowCtr ?? 0.025;
  const limit = options.limit ?? 30;

  const quickWins = rows
    .filter(
      (r) =>
        r.position >= minPos &&
        r.position <= maxPos &&
        r.impressions >= minImpr,
    )
    .map<SearchConsoleOpportunity>((r) => {
      const missedClicksEstimate = Math.max(
        1,
        Math.round(r.impressions * Math.max(0.01, 0.08 - r.ctr)),
      );
      return {
        ...r,
        kind: "page2_quick_win",
        opportunityScore: scoreSearchConsoleOpportunity(r),
        missedClicksEstimate,
        recommendedAction: recommendPageOptimization(r),
      };
    })
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
    .slice(0, limit);

  const lowCtrPageOne = rows
    .filter(
      (r) =>
        r.position >= 1 &&
        r.position < minPos &&
        r.impressions >= minPageOneImpr &&
        r.ctr < maxLowCtr,
    )
    .map<SearchConsoleOpportunity>((r) => {
      const expectedCtr = r.position <= 3 ? 0.15 : r.position <= 6 ? 0.07 : 0.04;
      const missed = Math.max(1, Math.round(r.impressions * Math.max(0.01, expectedCtr - r.ctr)));
      return {
        ...r,
        kind: "page1_low_ctr",
        opportunityScore: Math.round(missed * 100) / 100,
        missedClicksEstimate: missed,
        recommendedAction: recommendPageOptimization(r),
      };
    })
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
    .slice(0, limit);

  return { quickWins, lowCtrPageOne };
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
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

/** Parse un export CSV Google Search Console (FR / EN / ES / AR). */
export function parseSearchConsoleCsv(rawCsv: string): SearchConsoleRow[] {
  const cleaned = rawCsv.replace(/^\uFEFF/, "");
  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const idxQuery = headers.findIndex((h) =>
    /query|queries|requête|requêtes|consulta|طلب|عبارة/i.test(h),
  );
  const idxPage = headers.findIndex((h) => /page|pages|url|página|صفح/i.test(h));
  const idxClicks = headers.findIndex((h) => /click|clic|نقر/i.test(h));
  const idxImpr = headers.findIndex((h) => /impr|ظهور/i.test(h));
  const idxCtr = headers.findIndex((h) => /ctr|نسبة النقر/i.test(h));
  const idxPos = headers.findIndex((h) => /pos|متوسط الموضع/i.test(h));

  return lines
    .slice(1)
    .map((line) => {
      const cols = parseCsvLine(line);
      const ctrRaw = (idxCtr >= 0 ? cols[idxCtr] : "0") ?? "0";
      const normalizedCtr = ctrRaw.replace(",", ".").trim();
      const ctrVal = normalizedCtr.endsWith("%")
        ? (Number.parseFloat(normalizedCtr.slice(0, -1)) || 0) / 100
        : Number.parseFloat(normalizedCtr) || 0;
      const parseNum = (raw: string | undefined): number => {
        if (!raw) return 0;
        const cleanedNum = raw.replace(/\s/g, "").replace(/,/g, "");
        return Number.parseFloat(cleanedNum) || 0;
      };
      const posRaw = (idxPos >= 0 ? cols[idxPos] : "0") ?? "0";
      const position = Number.parseFloat(posRaw.replace(",", ".")) || 0;
      return {
        query: idxQuery >= 0 ? (cols[idxQuery] ?? "") : (cols[0] ?? ""),
        page: idxPage >= 0 ? (cols[idxPage] ?? "") : "",
        clicks: parseNum(idxClicks >= 0 ? cols[idxClicks] : "0"),
        impressions: parseNum(idxImpr >= 0 ? cols[idxImpr] : "0"),
        ctr: ctrVal,
        position,
      };
    })
    .filter((row) => Boolean(row.query || row.page));
}

function isoDateUtcDaysAgo(daysAgo: number, nowMs: number = Date.now()): string {
  return new Date(nowMs - daysAgo * 86_400_000).toISOString().slice(0, 10);
}

interface RawSearchAnalyticsResponse {
  rows?: Array<{
    keys?: string[];
    clicks?: number;
    impressions?: number;
    ctr?: number;
    position?: number;
  }>;
}

async function runSearchAnalyticsQuery(params: {
  property: string;
  accessToken: string;
  startDate: string;
  endDate: string;
  dimensions: string[];
  rowLimit: number;
}): Promise<RawSearchAnalyticsResponse> {
  const endpoint =
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(params.property)}` +
    `/searchAnalytics/query`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate: params.startDate,
        endDate: params.endDate,
        dimensions: params.dimensions,
        rowLimit: params.rowLimit,
        dataState: "final",
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`gsc_analytics_${res.status} ${detail.slice(0, 140)}`.trim());
    }
    return (await res.json()) as RawSearchAnalyticsResponse;
  } finally {
    clearTimeout(timeout);
  }
}

function extractTotals(resp: RawSearchAnalyticsResponse): SearchConsoleTotals {
  const first = resp.rows?.[0];
  if (!first) {
    return { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  }
  return {
    clicks: Number(first.clicks ?? 0) || 0,
    impressions: Number(first.impressions ?? 0) || 0,
    ctr: Number(first.ctr ?? 0) || 0,
    position: Number(first.position ?? 0) || 0,
  };
}

function pctDelta(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/**
 * Récupère un instantané complet et en lecture seule de Google Search Console :
 * KPI 28j vs 28j précédents, état du sitemap, Top pages, Top requêtes,
 * Quick Wins Page 2 (positions 11–20) et pages Page 1 à faible CTR.
 */
export async function fetchSearchConsoleSnapshot(
  baseUrl: string = siteConfig.url,
  options: { days?: number; siteUrl?: string; nowMs?: number } = {},
): Promise<SearchConsoleSnapshot> {
  const days = Math.max(7, Math.min(90, options.days ?? 28));
  const nowMs = options.nowMs ?? Date.now();
  const generatedAt = new Date(nowMs).toISOString();
  const property = searchConsoleProperty(
    baseUrl,
    options.siteUrl ?? process.env.GOOGLE_INDEXING_SITE_URL,
  );
  const sitemapUrl = sitemapUrlFor(baseUrl);

  const account = readGoogleServiceAccount();
  if (!account) {
    return {
      status: "skipped",
      generatedAt,
      property,
      sitemapUrl,
      reason: "not-configured",
    };
  }

  try {
    const accessToken = await fetchAccessToken(account);
    // Search Console a ~2 jours de latence pour `dataState: "final"`.
    const endDate = isoDateUtcDaysAgo(2, nowMs);
    const startDate = isoDateUtcDaysAgo(days + 1, nowMs);
    const previousEndDate = isoDateUtcDaysAgo(days + 2, nowMs);
    const previousStartDate = isoDateUtcDaysAgo(days * 2 + 1, nowMs);

    const [currentTotalsRaw, previousTotalsRaw, topPagesRaw, queryPagesRaw, sitemap] =
      await Promise.all([
        runSearchAnalyticsQuery({
          property,
          accessToken,
          startDate,
          endDate,
          dimensions: [],
          rowLimit: 1,
        }),
        runSearchAnalyticsQuery({
          property,
          accessToken,
          startDate: previousStartDate,
          endDate: previousEndDate,
          dimensions: [],
          rowLimit: 1,
        }),
        runSearchAnalyticsQuery({
          property,
          accessToken,
          startDate,
          endDate,
          dimensions: ["page"],
          rowLimit: 25,
        }),
        runSearchAnalyticsQuery({
          property,
          accessToken,
          startDate,
          endDate,
          dimensions: ["query", "page"],
          rowLimit: 2500,
        }),
        fetchGoogleSitemapStatus(baseUrl, { siteUrl: property, accessToken }),
      ]);

    const current = extractTotals(currentTotalsRaw);
    const previous = extractTotals(previousTotalsRaw);

    const summary: SearchConsolePeriodSummary = {
      days,
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
    };

    const topPages: SearchConsolePageMetric[] = (topPagesRaw.rows ?? []).map((row) => ({
      page: row.keys?.[0] ?? "",
      clicks: Number(row.clicks ?? 0) || 0,
      impressions: Number(row.impressions ?? 0) || 0,
      ctr: Number(row.ctr ?? 0) || 0,
      position: Number(row.position ?? 0) || 0,
    }));

    const queryPageRows: SearchConsoleRow[] = (queryPagesRaw.rows ?? []).map((row) => ({
      query: row.keys?.[0] ?? "",
      page: row.keys?.[1] ?? "",
      clicks: Number(row.clicks ?? 0) || 0,
      impressions: Number(row.impressions ?? 0) || 0,
      ctr: Number(row.ctr ?? 0) || 0,
      position: Number(row.position ?? 0) || 0,
    }));

    const topQueries = [...queryPageRows]
      .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
      .slice(0, 20);

    const { quickWins, lowCtrPageOne } = classifySearchConsoleOpportunities(queryPageRows, {
      limit: 30,
    });

    return {
      status: "ok",
      generatedAt,
      property,
      sitemapUrl,
      summary,
      sitemap,
      topPages,
      topQueries,
      quickWins,
      lowCtrPageOne,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: "error",
      generatedAt,
      property,
      sitemapUrl,
      reason: message.slice(0, 200),
    };
  }
}

/** Réinitialise le cache de jetons (tests et rotation de clé). */
export function resetGoogleTokenCache(): void {
  tokenCache.clear();
}
