// Validation de l'URL d'un webhook sortant (anti-SSRF).
//
// `WEBHOOK_URL` (variable d'environnement) peut pointer vers une URL
// arbitraire configurée par l'opérateur du site. Sans validation, un
// attaquant ayant accès aux variables d'env pourrait transformer le
// serveur Nukhba en relais SSRF (lire des métadonnées cloud, sonder un
// réseau interne, etc.). On refuse :
//  - les schémas non-HTTP(S) (`file://`, `gopher://`, …) ;
//  - les cibles sur localhost / loopback / RFC1918 / link-local ;
//  - les noms d'hôte non résolvables côté serveur.
//
// Cette validation est appelée AVANT chaque `fetch(webhook, …)` côté
// `src/app/api/lead/route.ts`.

const ALLOWED_PROTOCOLS = new Set(["https:", "http:"]);

function isPrivateAddress(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (
    lower === "localhost" ||
    lower === "127.0.0.1" ||
    lower === "::1" ||
    lower === "[::1]" ||
    lower.endsWith(".localhost") ||
    lower.endsWith(".local") ||
    lower.endsWith(".internal") ||
    lower.endsWith(".localdomain")
  ) {
    return true;
  }
  // IPv4 privée / loopback / link-local.
  if (/^10\./.test(lower)) return true;
  if (/^192\.168\./.test(lower)) return true;
  if (/^169\.254\./.test(lower)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(lower)) return true;
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(lower)) return true; // CGNAT
  if (/^0\./.test(lower)) return true;
  // IPv6 ULA (fc00::/7) et link-local (fe80::/10).
  if (/^f[cd]/i.test(lower)) return true;
  if (/^fe[89ab][0-9a-f]:/i.test(lower)) return true;
  return false;
}

/**
 * Vérifie qu'une URL est utilisable comme webhook sortant : protocole
 * autorisé, hôte non privé, et (en option) hostname correspond à une
 * liste blanche explicite. Si `allowPrivateHosts` est `false` (défaut),
 * les hôtes locaux/RFC1918 sont refusés.
 */
export function isValidWebhookUrl(
  raw: string,
  options: { allowPrivateHosts?: boolean; whitelist?: string[] } = {},
): boolean {
  if (!raw) return false;
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return false;
  }
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol.toLowerCase())) return false;
  const host = parsed.hostname.trim();
  if (!host) return false;

  if (options.whitelist && options.whitelist.length > 0) {
    const allowed = options.whitelist.some(
      (entry) => entry.toLowerCase() === host.toLowerCase(),
    );
    if (!allowed) return false;
  }

  if (options.allowPrivateHosts !== true && isPrivateAddress(host)) {
    return false;
  }

  return true;
}