// Protection CSRF « origin check » pour les routes API POST sensibles.
//
// Next.js 14+ protège automatiquement les cookies `SameSite=lax`/`strict`
// des soumissions cross-origin de formulaires HTML : le navigateur ne
// joint pas le cookie. Cette défense bloque déjà la majorité des attaques
// CSRF classiques. Pour les requêtes `fetch` JSON (et les bots / scripts
// serveur-à-serveur), on renforce avec une vérification de l'en-tête
// `Origin` (renvoyé par tous les navigateurs) ou `Referer`.
//
// Whitelist : l'origine de la requête doit correspondre à l'URL
// canonique du site (production ou preview e2b). Les bots serveur-à-
// serveur (curl, Postman, scripts d'intégration) n'envoient pas d'Origin
// : on autorise dans ce cas uniquement si l'en-tête `X-Requested-By` est
// présent avec une valeur secrète (cf. variable `INTERNAL_API_SECRET`).
//
// Routes à protéger : tout endpoint POST qui modifie l'état (paiement,
// création de lead…). Les webhooks externes (NOWPayments IPN) sont
// identifiés par leur signature HMAC — pas par l'origine.

import { siteConfig } from "@/lib/config";

const ENV_KEY = "INTERNAL_API_SECRET";

/** Origines autorisées (calculées depuis la config + Vercel preview). */
function allowedOriginSet(): Set<string> {
  const set = new Set<string>();
  const pushNormalized = (value: string | undefined | null) => {
    if (!value) return;
    try {
      const normalized = new URL(value.trim()).origin.toLowerCase();
      if (normalized.startsWith("http")) set.add(normalized);
    } catch {
      /* URL invalide : ignorée */
    }
  };
  pushNormalized(process.env.SITE_URL);
  pushNormalized(process.env.NEXT_PUBLIC_SITE_URL);
  pushNormalized(siteConfig.url);
  // Aperçus Vercel : on accepte toutes les URLs de préfixe `*.vercel.app`
  // en dev/prévisualisation, jamais en production.
  if (process.env.VERCEL_ENV !== "production") {
    set.add("https://vercel.app");
  }
  return set;
}

/**
 * Vérifie qu'une requête POST provient bien d'une origine autorisée.
 *  - Si l'en-tête `Origin` est présent et correspond à une origine
 *    autorisée → OK ;
 *  - Sinon, on tombe sur le `Referer` (même politique) ;
 *  - Sinon, on accepte uniquement si `X-Requested-By` correspond au
 *    secret serveur (appels serveur-à-serveur d'outils internes) ;
 *  - Sinon, la requête est rejetée.
 *
 * Retourne `true` quand l'origine est valide, `false` sinon.
 */
export function enforceSameOrigin(req: Request): boolean {
  const allowed = allowedOriginSet();
  const origin = req.headers.get("origin")?.trim();
  if (origin) {
    try {
      const normalized = new URL(origin).origin.toLowerCase();
      return allowed.has(normalized);
    } catch {
      return false;
    }
  }
  // Pas d'Origin : on regarde le Referer (souvent présent sur les
  // navigateurs même quand Origin ne l'est pas, ex. anciennes versions).
  const referer = req.headers.get("referer")?.trim();
  if (referer) {
    try {
      const normalized = new URL(referer).origin.toLowerCase();
      return allowed.has(normalized);
    } catch {
      return false;
    }
  }
  // Aucun des deux : on autorise uniquement les appels serveur authentifiés
  // par le secret partagé (header `X-Requested-By: <secret>`).
  const secret = process.env[ENV_KEY]?.trim();
  if (secret) {
    const presented = req.headers.get("x-requested-by")?.trim();
    if (presented && timingSafeStringEqual(presented, secret)) return true;
  }
  return false;
}

/** Comparaison à temps constant (évite les attaques par canal auxiliaire). */
function timingSafeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}