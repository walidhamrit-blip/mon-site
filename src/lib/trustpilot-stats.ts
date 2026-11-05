/**
 * Lecture de la note publique Trustpilot — module SERVEUR (réseau).
 *
 * Le site n'affiche aucune note qu'il n'a pas lue : cette fonction va
 * chercher le JSON-LD de la fiche publique (`aggregateRating`) et laisse le
 * parseur pur (`parseTrustpilotAggregate`) en extraire le nombre d'avis et la
 * moyenne.
 *
 * Trois principes :
 *   1. **jamais bloquant** — 4 s de délai maximum, toute erreur renvoie
 *      « aucun avis » ;
 *   2. **mis en cache 1 h** (`next.revalidate`) : une requête par heure et par
 *      instance, pas une par visite ;
 *   3. **aucune donnée inventée** — `available: false` signifie « on ne sait
 *      pas », pas « zéro avis ». Les appelants décident (ici : ne pas afficher
 *      le widget).
 */

import { normalizeReviewUrl, parseTrustpilotAggregate, trustpilotProfileUrl } from "@/lib/trust";
import { DEFAULT_SITE_ORIGIN } from "@/lib/site-identity";
import type { TrustConfigData } from "@/lib/site-types";

export interface TrustpilotStats {
  /** Nombre d'avis publiés sur la fiche (0 si inconnu). */
  reviewCount: number;
  /** Moyenne affichée par Trustpilot (0 si inconnue). */
  ratingValue: number;
  /** `true` uniquement si la fiche a réellement été lue. */
  available: boolean;
}

const UNKNOWN: TrustpilotStats = { reviewCount: 0, ratingValue: 0, available: false };

const REVALIDATE_SECONDS = 60 * 60;
const TIMEOUT_MS = 4000;

/**
 * Note publique du profil configuré. Renvoie `UNKNOWN` (jamais une exception)
 * si le profil n'est pas configuré, si le réseau échoue, ou si Trustpilot
 * répond autre chose qu'une fiche.
 */
export async function getTrustpilotStats(
  trust: TrustConfigData | null | undefined,
): Promise<TrustpilotStats> {
  const profileUrl = trustpilotProfileUrl(trust);
  if (!profileUrl) return UNKNOWN;

  // On lit toujours la fiche (`/review/`), jamais le formulaire (`/evaluate/`).
  const url = normalizeReviewUrl("trustpilot", profileUrl);
  if (!url) return UNKNOWN;

  try {
    const response = await fetch(url, {
      headers: {
        // Un agent identifiable : si Trustpilot veut nous contacter ou nous
        // bloquer, autant que ce soit explicite.
        "user-agent": `NukhbaSiteBot/1.0 (+${DEFAULT_SITE_ORIGIN}/avis)`,
        "accept-language": "en",
      },
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return UNKNOWN;
    const html = await response.text();
    const aggregate = parseTrustpilotAggregate(html);
    if (!aggregate) return UNKNOWN;
    return { ...aggregate, available: true };
  } catch (error) {
    // Un profil indisponible ne doit jamais casser une page publique.
    console.warn(
      "[trustpilot] note publique non lue :",
      error instanceof Error ? error.message : error,
    );
    return UNKNOWN;
  }
}
