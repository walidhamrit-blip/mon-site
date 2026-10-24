import { createSign } from "node:crypto";
import { siteConfig } from "@/lib/config";

/**
 * Soumission automatique du sitemap à **Google Search Console**.
 *
 * Pourquoi ce module : l'ancien « ping » `https://www.google.com/ping?sitemap=…`
 * a été retiré par Google (réponse 404 depuis 2023) — il ne notifiait donc
 * plus rien. La seule voie officielle restante est l'API Search Console
 * (`sitemaps.submit`), authentifiée par un compte de service Google Cloud.
 *
 * Aucune dépendance supplémentaire : le JWT RS256 est signé avec `node:crypto`.
 *
 * Configuration (100 % optionnelle, le site fonctionne sans) :
 *   GOOGLE_INDEXING_CLIENT_EMAIL   → `xxx@projet.iam.gserviceaccount.com`
 *   GOOGLE_INDEXING_PRIVATE_KEY    → clé privée du compte de service (PEM)
 *   GOOGLE_INDEXING_SITE_URL       → propriété Search Console
 *                                    (`https://exemple.com/` ou `sc-domain:exemple.com`)
 *   GOOGLE_INDEXING_ALLOW_NON_PRODUCTION=true → autorise l'appel hors Vercel prod
 *
 * Le compte de service doit être ajouté comme utilisateur (au moins
 * « Restreint ») dans Search Console → Paramètres → Utilisateurs et autorisations.
 * En l'absence de configuration, la fonction ne fait rien et journalise une
 * seule ligne — aucune action admin n'échoue.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const WEBMASTERS_SCOPE = "https://www.googleapis.com/auth/webmasters";
const REQUEST_TIMEOUT_MS = 8000;

export interface GoogleServiceAccount {
  clientEmail: string;
  privateKey: string;
}

export interface GoogleSitemapResult {
  status: "submitted" | "skipped" | "error";
  reason?: string;
  httpStatus?: number;
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

/** N'appelle l'API qu'en production (ou si l'override explicite est posé). */
export function googleIndexingAllowed(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return (
    env.VERCEL_ENV === "production" ||
    env.GOOGLE_INDEXING_ALLOW_NON_PRODUCTION === "true" ||
    env.NODE_ENV === "test"
  );
}

type TokenCache = { accessToken: string; expiresAt: number };
let tokenCache: TokenCache | null = null;

async function fetchAccessToken(account: GoogleServiceAccount): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) {
    return tokenCache.accessToken;
  }
  const assertion = buildServiceAccountAssertion(account);
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
    tokenCache = {
      accessToken: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    };
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
  options: { sitemapPath?: string; siteUrl?: string } = {},
): Promise<GoogleSitemapResult> {
  const account = readGoogleServiceAccount();
  if (!account) {
    return { status: "skipped", reason: "not-configured" };
  }
  if (!googleIndexingAllowed()) {
    return { status: "skipped", reason: "not-production" };
  }

  const property = searchConsoleProperty(baseUrl, options.siteUrl ?? process.env.GOOGLE_INDEXING_SITE_URL);
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
        return { status: "submitted", httpStatus: res.status };
      }
      console.warn(`[search-console] réponse non-OK : ${res.status}`);
      return { status: "error", reason: `http_${res.status}`, httpStatus: res.status };
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Un échec d'authentification ne doit jamais faire échouer une sauvegarde
    // d'administration : on journalise et on continue.
    console.warn("[search-console] soumission ignorée :", message);
    return { status: "error", reason: message.slice(0, 160) };
  }
}

/** Réinitialise le cache de jeton (tests et rotation de clé). */
export function resetGoogleTokenCache(): void {
  tokenCache = null;
}
