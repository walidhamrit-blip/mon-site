/**
 * Règles pures du contrôle des liens.
 *
 * Aucune requête réseau ici : le script `scripts/link-check.mjs` fournit le
 * HTML et les statuts, ces fonctions les interprètent. Elles sont testables
 * hors ligne et sans accès à la production.
 */

/** Décode les entités les plus fréquentes dans les attributs href. */
export function decodeEntities(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** Extrait les URL du sitemap, dédupliquées. */
export function parseSitemap(xml) {
  const urls = [];
  const seen = new Set();
  for (const match of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
    const url = decodeEntities(match[1]);
    if (!seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }
  return urls;
}

const IGNORED_PROTOCOLS = /^(mailto|tel|sms|javascript|data|blob):/i;

/**
 * Extrait les liens d'une page, résolus en URL absolues.
 * Ignore les ancres, les protocoles non HTTP et les doublons.
 */
export function extractLinks(html, baseUrl) {
  const links = [];
  const seen = new Set();

  for (const match of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    const raw = decodeEntities(match[1]).trim();
    if (!raw || raw.startsWith("#") || IGNORED_PROTOCOLS.test(raw)) continue;

    let absolute;
    try {
      absolute = new URL(raw, baseUrl);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(absolute.protocol)) continue;
    absolute.hash = "";

    const href = absolute.toString();
    if (!seen.has(href)) {
      seen.add(href);
      links.push(href);
    }
  }

  return links;
}

/** Vrai si l'URL appartient à l'origine donnée. */
export function isSameOrigin(url, origin) {
  try {
    return new URL(url).origin === new URL(origin).origin;
  } catch {
    return false;
  }
}

/**
 * Un 404/410/5xx est un échec ; un 401/403/429 peut venir d'une protection
 * anti-robots et ne doit pas ouvrir une fausse alerte.
 */
export function classifyStatus(status) {
  if (status >= 200 && status < 400) return "ok";
  if (status === 401 || status === 403 || status === 429) return "warn";
  if (status >= 400) return "fail";
  return "warn";
}

/** Ces statuts valent une nouvelle tentative : limitation ou incident passager. */
export function isRetryableStatus(status) {
  return status === 429 || status >= 500;
}

/** Résumé lisible pour le rapport et l'issue. */
export function summarize(results) {
  const failures = results.filter((result) => result.status === "fail");
  const warnings = results.filter((result) => result.status === "warn");
  return {
    failures,
    warnings,
    total: results.length,
    ok: results.length - failures.length - warnings.length,
  };
}
