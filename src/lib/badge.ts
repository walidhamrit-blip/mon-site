import clientsFile from "../../public/badge/clients.json";

/**
 * Badge de netlinking client (« شارة نخبة » / « Nukhba badge »).
 *
 * Chaque site livré affiche un lien réel vers nokhba.net.ly dans son pied de
 * page. Ce module est la source unique côté site :
 *   - constantes (URL de crédit, assets, ancres bilingues) ;
 *   - lecture de `public/badge/clients.json`, mis à jour par
 *     `scripts/badge-audit.mjs` (vérification hebdomadaire en CI) ;
 *   - génération des extraits de code copiables depuis `/badge`.
 *
 * Le lien porte `utm_source=client_footer` : les visites issues des pieds de
 * page clients sont identifiables dans les statistiques, et les robots
 * d'audit peuvent reconnaître un badge officiel.
 */

/** URL canonique de crédit — celle que doivent utiliser les sites clients. */
export const BADGE_LINK =
  "https://nokhba.net.ly/?utm_source=client_footer&utm_medium=badge&utm_campaign=client_credit";

/** Même URL sans paramètres de campagne (canonical, llms.txt, vérification). */
export const BADGE_CANONICAL = "https://nokhba.net.ly/";

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
  /** URL de crédit (par défaut BADGE_LINK). */
  href?: string;
  /** Domaine absolu pour l'asset (snippet destiné à un autre site). */
  origin?: string;
}

function snippetParts(options: SnippetOptions = {}) {
  const variant = options.variant === "light" ? "light" : "dark";
  const href = options.href ?? BADGE_LINK;
  const origin = (options.origin ?? "https://nokhba.net.ly").replace(/\/+$/, "");
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

export function detectBadge(html: string): BadgeDetection {
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

  // Toutes les balises <a …> … </a> qui pointent vers nokhba.net.ly (http/https,
  // www facultatif). Les attributs peuvent être dans n'importe quel ordre.
  const anchors = [...source.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi)];
  for (const [, rawAttrs, inner] of anchors) {
    const hrefMatch = rawAttrs.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const href = (hrefMatch?.[1] ?? hrefMatch?.[2] ?? hrefMatch?.[3] ?? "").trim();
    if (!/^https?:\/\/(www\.)?nokhba\.net\.ly(\/|$|\?|#)/i.test(href)) continue;

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
