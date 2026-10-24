import clientsFile from "../../public/badge/clients.json";
// Import relatif (et non `@/lib/…`) : ce module est empaqueté par esbuild
// dans `scripts/badge-audit.mjs`, qui ne résout pas les alias de tsconfig.
import {
  DEFAULT_SITE_DOMAIN,
  domainFromOrigin,
  normalizeOrigin,
  normalizeOrigins,
  resolveSiteOrigin,
} from "./site-identity";

/**
 * Badge de netlinking client (« شارة نخبة » / « Nukhba badge »).
 *
 * Chaque site livré affiche un lien réel vers le domaine de l'agence dans
 * son pied de page. Ce module est la source unique côté site :
 *   - résolution de l'URL de crédit (elle suit le domaine configuré) ;
 *   - lecture de `public/badge/clients.json`, mis à jour par
 *     `scripts/badge-audit.mjs` (vérification hebdomadaire en CI) ;
 *   - génération des extraits de code copiables depuis `/badge`.
 *
 * Le lien porte `utm_source=client_footer` : les visites issues des pieds de
 * page clients sont identifiables dans les statistiques, et les robots
 * d'audit peuvent reconnaître un badge officiel.
 */

/**
 * URL canonique de crédit — celle que doivent utiliser les sites clients.
 * Suit le domaine configuré (`/admin` → Réglages → Domaine / URL canonique).
 */
export function badgeCanonical(origin?: string): string {
  const base = normalizeOrigin(origin ?? "") || resolveSiteOrigin();
  return `${base}/`;
}

/** Variante avec paramètres de campagne (lien à coller dans le pied de page). */
export function badgeLink(origin?: string): string {
  const base = normalizeOrigin(origin ?? "") || resolveSiteOrigin();
  return `${base}/?utm_source=client_footer&utm_medium=badge&utm_campaign=client_credit`;
}

/** Assets servis par notre domaine (aucune dépendance externe). */
export const BADGE_ASSET = "/badge/nukhba-badge.svg";
export const BADGE_ASSET_LIGHT = "/badge/nukhba-badge-light.svg";

export const BADGE_WIDTH = 176;
export const BADGE_HEIGHT = 44;

/** Ancres bilingues recommandées (texte visible ou `alt`). */
export const BADGE_ANCHOR_AR = "تصميم وتطوير المواقع — نخبة طرابلس";
export const BADGE_ANCHOR_EN = "Website by Nukhba — Tripoli web design agency";

export type BadgeStatus = "verified" | "nofollow" | "missing" | "down" | "pending";

export interface BadgeClientEntry {
  slug: string;
  title: string;
  titleEn?: string;
  status: BadgeStatus;
  /** Date du dernier changement de statut (pas de la dernière vérification). */
  checkedAt: string | null;
  /** Ancre réellement trouvée sur le site client (diagnostic). */
  anchor?: string;
  /** Valeur de `rel` trouvée sur le lien. */
  rel?: string;
}

export interface BadgeClientsFile {
  version: number;
  generatedAt: string;
  clients: Record<string, BadgeClientEntry>;
}

export const badgeClientsFile = clientsFile as BadgeClientsFile;

/** Entrée correspondant à l'URL d'aperçu d'une démo (slash final ignoré). */
export function findBadgeClient(
  previewUrl: string,
  source: BadgeClientsFile = badgeClientsFile,
): { url: string; entry: BadgeClientEntry } | null {
  const key = String(previewUrl ?? "")
    .trim()
    .replace(/\/+$/, "");
  if (!key) return null;
  const entry = source.clients?.[key];
  return entry ? { url: key, entry } : null;
}

export interface BadgeStats {
  total: number;
  verified: number;
  nofollow: number;
  missing: number;
  down: number;
  pending: number;
}

/** Compte les statuts — utilisé par la page /badge et les tests. */
export function badgeStats(source: BadgeClientsFile = badgeClientsFile): BadgeStats {
  const stats: BadgeStats = {
    total: 0,
    verified: 0,
    nofollow: 0,
    missing: 0,
    down: 0,
    pending: 0,
  };
  for (const entry of Object.values(source.clients ?? {})) {
    stats.total += 1;
    const status: BadgeStatus = entry.status ?? "pending";
    if (status in stats) stats[status] += 1;
    else stats.pending += 1;
  }
  return stats;
}

/** Clients dont le lien est réellement présent (dofollow ou nofollow). */
export function linkedClients(
  source: BadgeClientsFile = badgeClientsFile,
): Array<{ url: string; entry: BadgeClientEntry }> {
  return Object.entries(source.clients ?? {})
    .filter(([, entry]) => entry.status === "verified" || entry.status === "nofollow")
    .map(([url, entry]) => ({ url, entry }));
}

/* ───────────────────────── Extraits copiables ───────────────────────── */

export interface SnippetOptions {
  /** Badge sombre (pieds de page clairs) ou clair (pieds de page sombres). */
  variant?: "dark" | "light";
  /** Ajoute une ancre texte visible sous l'image (recommandé). */
  withText?: boolean;
  /** URL de crédit (par défaut : lien de crédit de l'origine configurée). */
  href?: string;
  /** Domaine absolu pour l'asset (snippet destiné à un autre site). */
  origin?: string;
}

function snippetParts(options: SnippetOptions = {}) {
  const variant = options.variant === "light" ? "light" : "dark";
  const origin = normalizeOrigin(options.origin ?? "") || resolveSiteOrigin();
  const href = options.href ?? badgeLink(origin);
  const asset = `${origin}${variant === "light" ? BADGE_ASSET_LIGHT : BADGE_ASSET}`;
  return { variant, href, asset, withText: options.withText ?? false };
}

/** Extrait HTML autonome (sites statiques, WordPress, Webflow…). */
export function badgeHtmlSnippet(options: SnippetOptions = {}): string {
  const { href, asset, withText } = snippetParts(options);
  const image = `<img src="${asset}" alt="${BADGE_ANCHOR_AR} | ${BADGE_ANCHOR_EN}" width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}" loading="lazy" decoding="async" style="display:block;width:${BADGE_WIDTH}px;height:auto">`;
  const text = withText
    ? `\n  <span style="display:block;margin-top:6px;font-size:12px;line-height:1.4;color:#9C9A94">${BADGE_ANCHOR_AR} · ${BADGE_ANCHOR_EN}</span>`
    : "";
  return `<a href="${href}" target="_blank" rel="noopener" title="${BADGE_ANCHOR_AR}" style="display:inline-block;text-decoration:none">\n  ${image}${text}\n</a>`;
}

/** Extrait React / Next.js (App Router ou Pages Router). */
export function badgeReactSnippet(options: SnippetOptions = {}): string {
  const { href, asset, withText } = snippetParts(options);
  return `export function NukhbaBadge() {
  return (
    <a
      href="${href}"
      target="_blank"
      rel="noopener"
      title="${BADGE_ANCHOR_AR}"
      style={{ display: "inline-block", textDecoration: "none" }}
    >
      <img
        src="${asset}"
        alt="${BADGE_ANCHOR_AR} | ${BADGE_ANCHOR_EN}"
        width={${BADGE_WIDTH}}
        height={${BADGE_HEIGHT}}
        loading="lazy"
        decoding="async"
        style={{ display: "block", width: ${BADGE_WIDTH}, height: "auto" }}
      />${withText ? `\n      <span style={{ display: "block", marginTop: 6, fontSize: 12, color: "#9C9A94" }}>\n        ${BADGE_ANCHOR_AR} · ${BADGE_ANCHOR_EN}\n      </span>` : ""}
    </a>
  );
}`;
}

/**
 * Détecte un badge valide dans le HTML d'un site client.
 * Fonction pure : testée dans `scripts/badge-audit.test.mjs`.
 */
export interface BadgeDetection {
  found: boolean;
  href: string | null;
  anchor: string | null;
  rel: string | null;
  nofollow: boolean;
  utm: boolean;
  imageOnly: boolean;
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export interface BadgeDetectOptions {
  /**
   * Origines reconnues comme badge officiel. Par défaut : le domaine
   * configuré. Pendant une migration de domaine, on y ajoute l'ancien
   * domaine — les pieds de page clients qui pointent encore vers l'ancien
   * lien restent alors valides au lieu d'être signalés « manquants ».
   */
  origins?: string[];
}

/**
 * Motif de reconnaissance des liens de badge :/http(s) + domaine(s)
 * accepté(s), `www.` facultatif. Les domaines sont échappés.
 */
export function badgeHostPattern(origins: string[] = []): RegExp {
  const hosts = normalizeOrigins(origins)
    .map((origin) => domainFromOrigin(origin))
    .filter(Boolean);
  const list = hosts.length > 0 ? hosts : [DEFAULT_SITE_DOMAIN];
  const escaped = list.map((host) => host.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`^https?:\\/\\/(www\\.)?(?:${escaped.join("|")})(?:\\/|$|\\?|#)`, "i");
}

export function detectBadge(html: string, options: BadgeDetectOptions = {}): BadgeDetection {
  const empty: BadgeDetection = {
    found: false,
    href: null,
    anchor: null,
    rel: null,
    nofollow: false,
    utm: false,
    imageOnly: false,
  };
  const source = String(html ?? "");
  if (!source) return empty;

  // Toutes les balises <a …> … </a> qui pointent vers le domaine de l'agence
  // (http/https, www facultatif). Les attributs peuvent être dans n'importe
  // quel ordre.
  const hostPattern = badgeHostPattern(options.origins ?? []);
  const anchors = [...source.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi)];
  for (const [, rawAttrs, inner] of anchors) {
    const hrefMatch = rawAttrs.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const href = (hrefMatch?.[1] ?? hrefMatch?.[2] ?? hrefMatch?.[3] ?? "").trim();
    if (!hostPattern.test(href)) continue;

    const relMatch = rawAttrs.match(/\brel\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const rel = (relMatch?.[1] ?? relMatch?.[2] ?? relMatch?.[3] ?? "").trim();
    const anchor = stripTags(inner).slice(0, 160) || null;
    return {
      found: true,
      href,
      anchor,
      rel: rel || null,
      nofollow: /\bnofollow\b/i.test(rel),
      utm: /[?&]utm_source=client_footer\b/i.test(href),
      imageOnly: Boolean(anchor) === false && /<img\b/i.test(inner),
    };
  }

  // Lien présent mais construit en JavaScript (href vide + data-href) : on ne
  // peut pas le vérifier depuis le HTML initial — considéré comme absent.
  return empty;
}
