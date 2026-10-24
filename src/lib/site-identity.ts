/**
 * Identité du site — domaine canonique et origine publique.
 *
 * Source unique de vérité pour « quelle est l'adresse publique du site ».
 * Tout ce qui dépend du domaine (sitemap, canoniques, badge de netlinking,
 * lien de crédit, origine d'envoi des e-mails, agent du robot d'audit)
 * passe par ici au lieu de répéter le littéral.
 *
 * Volontairement **sans aucun import** : ce module est utilisé
 *   - côté serveur (fonctions qui lisent la configuration admin) ;
 *   - côté client (à partir des variables `NEXT_PUBLIC_*`) ;
 *   - dans les scripts Node (`scripts/badge-audit.mjs` empaquete le module
 *     `badge.ts` avec esbuild, sans alias `@/`) ;
 *   - dans les tests Node.
 */

/** Domaine par défaut — l'adresse actuelle du site. */
export const DEFAULT_SITE_DOMAIN = "nokhba.net.ly";

/** Origine canonique par défaut (schéma + domaine, sans slash final). */
export const DEFAULT_SITE_ORIGIN = `https://${DEFAULT_SITE_DOMAIN}`;

/** Origines acceptées par défaut (domaine principal + alias `www`). */
export const DEFAULT_SITE_ORIGINS = [
  DEFAULT_SITE_ORIGIN,
  `https://www.${DEFAULT_SITE_DOMAIN}`,
] as const;

export interface SiteOriginInput {
  /** URL canonique telle que configurée dans l'administration. */
  url?: string | null;
  /** Domaine « affiché » tel que configuré dans l'administration. */
  domain?: string | null;
}

/**
 * Normalise une origine :ajoute `https://` si le schéma manque, retire le
 * slash final et les espaces. Une entrée vide renvoie une chaîne vide.
 */
export function normalizeOrigin(value: string | null | undefined): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withProtocol.replace(/\/+$/, "");
}

/**
 * Domaine d'une URL ou d'un domaine brut.
 * `https://www.exemple.com/chemin` → `exemple.com` (minuscules, sans `www.`).
 */
export function domainFromOrigin(value: string | null | undefined): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(candidate).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return trimmed
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split(/[/?#]/)[0]
      .toLowerCase();
  }
}

/** Construit l'origine `https://` d'un domaine brut. */
export function originFromDomain(domain: string | null | undefined): string {
  const normalized = domainFromOrigin(domain);
  return normalized ? `https://${normalized}` : DEFAULT_SITE_ORIGIN;
}

/**
 * Origine lue dans l'environnement (`SITE_URL`, puis `NEXT_PUBLIC_SITE_URL`).
 * `null` si aucune n'est définie.
 */
export function envSiteOrigin(): string | null {
  if (typeof process === "undefined") return null;
  const explicit =
    process.env.SITE_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return explicit ? normalizeOrigin(explicit) : null;
}

/**
 * Origine canonique du site — l'adresse publique à publier dans les
 * URL absolues, les sitemap et les liens de crédit.
 *
 * Ordre de priorité :
 *   1. la configuration admin, **si elle a été explicitement modifiée**
 *      (elle diffère du domaine par défaut) — c'est le choix le plus
 *      récent de l'exploitant ;
 *   2. l'environnement (`SITE_URL`, puis `NEXT_PUBLIC_SITE_URL`) — il décrit
 *      le déploiement réel, utile quand l'administration n'a pas été touchée ;
 *   3. le domaine par défaut.
 *
 * Ce choix évite les deux pièges : un `SITE_URL` de déploiement qui écraserait
 * un changement fait depuis `/admin`, et une configuration admin restée sur
 * ses valeurs par défaut qui casserait un déploiement sur un autre domaine.
 */
export function resolveSiteOrigin(input: SiteOriginInput = {}): string {
  const configuredUrl = normalizeOrigin(input.url);
  const configuredDomain = domainFromOrigin(input.domain);

  const urlCustomized = configuredUrl !== "" && configuredUrl !== DEFAULT_SITE_ORIGIN;
  const domainCustomized =
    configuredDomain !== "" && configuredDomain !== DEFAULT_SITE_DOMAIN;

  if (urlCustomized) return configuredUrl;
  if (domainCustomized) return originFromDomain(configuredDomain);

  const fromEnv = envSiteOrigin();
  if (fromEnv) return fromEnv;

  return configuredUrl || DEFAULT_SITE_ORIGIN;
}

/**
 * Liste d'origines acceptées pour un même site : l'origine canonique plus les
 * domaines historiques (redirections, anciens pieds de page clients).
 * Les doublons sont retirés, l'ordre est conservé.
 */
export function normalizeOrigins(origins: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const origin of origins) {
    const normalized = normalizeOrigin(origin);
    if (!normalized) continue;
    const key = domainFromOrigin(normalized) || normalized;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}
