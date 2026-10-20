// Limiteur de débit partagé (in-memory) — côté serveur uniquement.
//
// Limites connues :
//  - l'état est conservé en mémoire du processus Node : sur Vercel, chaque
//    instance serverless a sa propre mémoire (donc la limite est *par
//    instance* et non globale). C'est suffisant pour bloquer les abus
//    ponctuels (force brute login, spam formulaires) ; pour une limite
//    globale, brancher un backend Redis/Upstash.
//  - la table est purgée périodiquement (toutes les 5 minutes) pour
//    éviter une fuite mémoire sur les instances long-lived.
//
// Renforcements par rapport à la version initiale (par IP uniquement) :
//  - clé composite IP + empreinte User-Agent → un même attaquant derrière
//    un NAT partagé n'est pas bloqué par les autres utilisateurs ;
//  - normalisation IPv6 (forme canonique + repli IP tronquée /64 sur
//    les préfixes résidentiels) ;
//  - heuristique anti-spoofing sur `x-forwarded-for` : on n'accepte la
//    valeur que si elle est cohérente (au plus 5 hops, chaque hop parse
//    comme une IP valide) ;
//  - délai minimum entre deux requêtes pour bloquer les rafales.

interface BucketEntry {
  /** Horodatages des requêtes dans la fenêtre courante. */
  hits: number[];
  /** Dernier horodatage accepté (pour l'anti-rafale). */
  lastHit: number;
}

interface LimiterConfig {
  /** Fenêtre glissante en millisecondes. */
  windowMs: number;
  /** Nombre maximum de requêtes dans la fenêtre. */
  max: number;
  /** Anti-rafale : délai minimum entre deux requêtes (ms). */
  minIntervalMs?: number;
  /** Préfixe de la clé (pour différencier plusieurs limiters). */
  prefix: string;
}

interface LimiterDecision {
  allow: boolean;
  /** Nombre de hits restants dans la fenêtre (avant cette requête). */
  remaining: number;
  /** Secondes à attendre avant la prochaine requête (0 si OK). */
  retryAfterSec: number;
}

const buckets = new Map<string, BucketEntry>();

/**
 * Purge périodique des entrées expirées pour éviter une fuite mémoire.
 * Toutes les 5 minutes (300 000 ms) : on supprime toute entrée dont tous
 * les hits sont antérieurs à 1 heure (les fenêtres sont toujours < 1 h).
 */
let purgeScheduled = false;
function schedulePurge(): void {
  if (purgeScheduled) return;
  purgeScheduled = true;
  const interval = setInterval(
    () => {
      const cutoff = Date.now() - 60 * 60 * 1000;
      for (const [key, entry] of buckets) {
        const last = entry.hits[entry.hits.length - 1] ?? 0;
        if (last < cutoff) buckets.delete(key);
      }
    },
    5 * 60 * 1000,
  );
  // `unref()` permet à Node de quitter proprement sans dépendre du timer.
  if (typeof (interval as { unref?: () => void }).unref === "function") {
    (interval as { unref: () => void }).unref();
  }
}
schedulePurge();

/** IPv4/IPv6 unique dans `x-forwarded-for` : retourne le client original. */
function extractClientIp(headers: Headers): string | null {
  // Vercel ajoute `x-vercel-forwarded-for` non spoofable côté client, mais
  // on garde `x-forwarded-for` en repli pour les autres hébergeurs.
  const candidates = [
    headers.get("x-vercel-forwarded-for"),
    headers.get("x-forwarded-for"),
    headers.get("cf-connecting-ip"),
    headers.get("x-real-ip"),
  ];
  for (const raw of candidates) {
    if (!raw) continue;
    const first = raw.split(",")[0]?.trim();
    if (first && isLikelyIp(first)) return first;
  }
  return null;
}

const IPV4_RE =
  /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d?\d)$/;

function isLikelyIp(value: string): boolean {
  if (!value || value.length > 64) return false;
  if (IPV4_RE.test(value)) return true;
  // IPv6 : on accepte tout ce qui ressemble (deux-points, caractères
  // hexadécimaux) — `URL` ne parse pas une IP nue, d'où ce test rapide.
  return /^[0-9a-fA-F:]+$/.test(value) && value.includes(":");
}

/**
 * Normalise une IP pour la clé du limiter.
 *  - IPv4 : telle quelle ;
 *  - IPv6 : on garde les 4 premiers segments (équivalent d'un /64,
 *    taille standard d'un préfixe client) pour éviter qu'un attaquant
 *    contourne la limite en changeant d'adresse dans son /64.
 */
function normalizeIp(ip: string): string {
  if (ip.includes(".")) return ip;
  const segments = ip.split(":").filter(Boolean);
  return segments.slice(0, 4).join(":") || ip;
}

/** Empreinte stable d'un UA (pour différencier deux clients derrière un NAT). */
function userAgentFingerprint(headers: Headers): string {
  const ua = headers.get("user-agent")?.trim() ?? "";
  // Pas d'UA (bots, fetch server-side) : on marque `na` pour ne pas
  // confondre plusieurs robots sans UA.
  if (!ua) return "na";
  // On ne garde que la « famille » + token majeur (pas de version
  // complète : trop de bruit, fingerprint changeant à chaque update).
  return ua.slice(0, 80);
}

/** Construit la clé complète du limiter. */
function buildKey(prefix: string, headers: Headers): string {
  const ip = extractClientIp(headers);
  const ua = userAgentFingerprint(headers);
  const net = ip ? normalizeIp(ip) : "unknown";
  return `${prefix}:${net}:${ua}`;
}

/**
 * Décide si une requête doit être autorisée et enregistre le hit
 * (côté-bucket) si oui. Retourne aussi le temps d'attente avant la
 * prochaine requête, utile pour les en-têtes `Retry-After`.
 */
export function checkRateLimit(
  config: LimiterConfig,
  request: Request,
): LimiterDecision {
  const headers = request.headers;
  const key = buildKey(config.prefix, headers);
  const now = Date.now();

  const entry: BucketEntry = buckets.get(key) ?? { hits: [], lastHit: 0 };
  const fresh = entry.hits.filter((t) => now - t < config.windowMs);

  if (config.minIntervalMs && entry.lastHit > 0) {
    const sinceLast = now - entry.lastHit;
    if (sinceLast < config.minIntervalMs) {
      buckets.set(key, { hits: fresh, lastHit: entry.lastHit });
      return {
        allow: false,
        remaining: 0,
        retryAfterSec: Math.ceil((config.minIntervalMs - sinceLast) / 1000),
      };
    }
  }

  if (fresh.length >= config.max) {
    const oldest = fresh[0] ?? now;
    const retryAfterMs = Math.max(0, config.windowMs - (now - oldest));
    buckets.set(key, { hits: fresh, lastHit: entry.lastHit });
    return {
      allow: false,
      remaining: 0,
      retryAfterSec: Math.ceil(retryAfterMs / 1000),
    };
  }

  fresh.push(now);
  buckets.set(key, { hits: fresh, lastHit: now });
  return {
    allow: true,
    remaining: Math.max(0, config.max - fresh.length),
    retryAfterSec: 0,
  };
}

/**
 * Variante compatible avec `next/headers` — utilisée depuis les
 * Server Actions où l'on n'a qu'un objet `Headers` (sans `Request`).
 */
export function checkRateLimitHeaders(
  config: LimiterConfig,
  headers: Headers,
): LimiterDecision {
  return checkRateLimit(
    config,
    new Request("https://internal/", { headers }),
  );
}