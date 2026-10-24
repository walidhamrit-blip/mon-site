// Protection CSRF « origin vs host » pour les routes API POST sensibles.
//
// Next.js protège automatiquement les cookies `SameSite=lax`/`strict`
// contre les soumissions cross-origin. Pour les requêtes `fetch` JSON sur
// `/api/lead`, `/api/payments/create` et `/api/payments/reserve`, on vérifie
// en plus que l'en-tête `Origin` (ou à défaut `Referer`) provient bien du
// même hôte que la requête entrante (`Host` / `X-Forwarded-Host`) ou d'un
// domaine canonique configuré (`SITE_URL`, `NEXT_PUBLIC_SITE_URL`,
// `VERCEL_URL`, `VERCEL_PROJECT_PRODUCTION_URL`, variante `www.` incluse).
//
// Ainsi :
//  - toute requête cross-site depuis `https://attaquant.exemple` est rejetée
//    avec HTTP 403 (`Origin` ≠ `Host` et hors domaines configurés) ;
//  - tous les environnements légitimes du site (domaine canonique et son
//    alias `www.`, déploiements Vercel `*.vercel.app`, previews Arena
//    `*.e2b.app`, `localhost`) fonctionnent sans faux positif.
//    Les origines autorisées suivent le domaine configuré : `SITE_URL` et
//    `NEXT_PUBLIC_SITE_URL` priment sur le domaine par défaut, il faut donc
//    les mettre à jour en même temps qu'un changement de domaine.

import { siteConfig } from "@/lib/config";

const ENV_KEY = "INTERNAL_API_SECRET";

function addHostWithWwwAlias(hosts: Set<string>, rawHost: string | undefined | null) {
  if (!rawHost) return;
  const cleaned = rawHost.trim().toLowerCase().replace(/\/+$/, "");
  if (!cleaned) return;
  hosts.add(cleaned);
  if (cleaned.startsWith("www.")) {
    hosts.add(cleaned.slice(4));
  } else if (!cleaned.includes(":") && cleaned.split(".").length >= 2) {
    hosts.add(`www.${cleaned}`);
  }
}

function addUrlHost(hosts: Set<string>, rawUrl: string | undefined | null) {
  if (!rawUrl) return;
  const trimmed = rawUrl.trim();
  if (!trimmed) return;
  try {
    const parsed = new URL(
      /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
    );
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      addHostWithWwwAlias(hosts, parsed.host);
    }
  } catch {
    /* URL invalide : ignorée */
  }
}

/** Ensemble des hôtes légitimes pour cette requête. */
function allowedHostSet(req: Request): Set<string> {
  const hosts = new Set<string>();

  // 1. Hôte cible réel de la requête entrante (standard OWASP CSRF Origin=Host).
  const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const hostHeader = req.headers.get("host")?.split(",")[0]?.trim();
  addHostWithWwwAlias(hosts, forwardedHost);
  addHostWithWwwAlias(hosts, hostHeader);
  try {
    const reqUrl = new URL(req.url);
    addHostWithWwwAlias(hosts, reqUrl.host);
  } catch {
    /* req.url relative ou invalide */
  }

  // 2. Domaines canoniques et URLs de déploiement Vercel.
  addUrlHost(hosts, process.env.SITE_URL);
  addUrlHost(hosts, process.env.NEXT_PUBLIC_SITE_URL);
  addUrlHost(hosts, process.env.VERCEL_URL);
  addUrlHost(hosts, process.env.VERCEL_BRANCH_URL);
  addUrlHost(hosts, process.env.VERCEL_PROJECT_PRODUCTION_URL);
  // Domaine canonique configuré (défaut de l'application).
  addUrlHost(hosts, siteConfig.url);
  addHostWithWwwAlias(hosts, siteConfig.domain);

  return hosts;
}

function isOriginAllowed(rawHeader: string, allowedHosts: Set<string>): boolean {
  try {
    const parsed = new URL(rawHeader);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    return allowedHosts.has(parsed.host.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Vérifie qu'une requête POST provient bien d'une origine autorisée :
 *  - `Origin` présent → doit correspondre à un hôte autorisé ;
 *  - sinon `Referer` présent → doit correspondre à un hôte autorisé ;
 *  - sinon appel serveur-à-serveur autorisé uniquement avec
 *    `X-Requested-By: <INTERNAL_API_SECRET>`.
 */
export function enforceSameOrigin(req: Request): boolean {
  const allowedHosts = allowedHostSet(req);

  const origin = req.headers.get("origin")?.trim();
  if (origin) {
    return isOriginAllowed(origin, allowedHosts);
  }

  const referer = req.headers.get("referer")?.trim();
  if (referer) {
    return isOriginAllowed(referer, allowedHosts);
  }

  const secret = process.env[ENV_KEY]?.trim();
  if (secret) {
    const presented = req.headers.get("x-requested-by")?.trim();
    if (presented && timingSafeStringEqual(presented, secret)) return true;
  }
  return false;
}

/** Comparaison à temps constant. */
function timingSafeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
