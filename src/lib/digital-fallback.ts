/**
 * A05 (audit SEO/GEO 2026-11-01) — repli de la page fiche `/codes/[slug]`
 * quand le slug est absent du catalogue actuellement servi.
 *
 * Deux cas, deux réponses :
 *  - panne déclarée (`degraded`, base + fournisseur indisponibles) →
 *    `"unavailable"` : on rend une page « temporairement indisponible » en
 *    200 + `noindex`. Jamais de 404 : Google lirait une suppression
 *    définitive et désindexerait une fiche qui existe encore chez le
 *    fournisseur (elle reviendra au prochain rafraîchissement du cache).
 *  - aucune panne → `"not_found"` : 404 classique, sauf si le slug correspond
 *    à l'une des 8 fiches historiques indexées avant la bascule FazerCards
 *    (ex. `/codes/spotify-premium`), auquel cas une redirection 308 transfère
 *    le trafic organique vers la fiche active ou le rayon correspondant.
 */
export type ProductPageFallback = "unavailable" | "not_found";

export function productPageFallback(degraded: boolean): ProductPageFallback {
  return degraded ? "unavailable" : "not_found";
}

interface LegacySlugRule {
  pattern: RegExp;
  fallbackPath: string;
}

const LEGACY_SEED_SLUG_RULES: Record<string, LegacySlugRule> = {
  "spotify-premium": {
    pattern: /\bspotify\b/i,
    fallbackPath: "/codes/category/subscription_code",
  },
  "steam-wallet": {
    pattern: /\bsteam\b/i,
    fallbackPath: "/codes/category/gift_card",
  },
  "playstation-store": {
    pattern: /\b(playstation|psn)\b/i,
    fallbackPath: "/codes/category/gift_card",
  },
  "xbox-gift-card": {
    pattern: /\bxbox\b/i,
    fallbackPath: "/codes/category/gift_card",
  },
  "robux-roblox": {
    pattern: /\b(roblox|robux)\b/i,
    fallbackPath: "/codes/category/gift_card",
  },
  "google-play-gift": {
    pattern: /\bgoogle\s*play\b/i,
    fallbackPath: "/codes/category/gift_card",
  },
  "amazon-gift-card": {
    pattern: /\bamazon\b/i,
    fallbackPath: "/codes/category/gift_card",
  },
  "nvidia-redeem": {
    pattern: /\bnvidia\b/i,
    fallbackPath: "/codes/category/software_key",
  },
};

export interface LegacyProductCandidate {
  slug: string;
  platform?: string;
  titleEn?: string;
  status?: string;
}

/**
 * Résout une ancienne URL indexée (`/codes/spotify-premium`, etc.) vers la
 * fiche FazerCards active correspondante (ou vers son rayon thématique).
 * Renvoie `null` pour tout slug inconnu afin de conserver la 404 légitime.
 */
export function resolveLegacyDigitalSlugRedirect(
  slug: string,
  products: readonly LegacyProductCandidate[],
): string | null {
  const rule = LEGACY_SEED_SLUG_RULES[slug.trim().toLowerCase()];
  if (!rule) return null;

  const candidates = products.filter(
    (p) =>
      p.slug !== slug &&
      (rule.pattern.test(p.platform ?? "") || rule.pattern.test(p.titleEn ?? "")),
  );
  const availableMatch = candidates.find((p) => p.status === "available");
  const chosen = availableMatch ?? candidates[0];
  return chosen ? `/codes/${chosen.slug}` : rule.fallbackPath;
}
