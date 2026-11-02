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
 *  - aucune panne → `"not_found"` : 404 classique, le slug est réellement
 *    inconnu (lien cassé, fiche retirée).
 */
export type ProductPageFallback = "unavailable" | "not_found";

export function productPageFallback(degraded: boolean): ProductPageFallback {
  return degraded ? "unavailable" : "not_found";
}
