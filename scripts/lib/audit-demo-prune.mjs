/**
 * Règles pures du retrait des fiches non-modèles des « exemples de modèles de sites ».
 *
 * Aucune requête réseau ni base : le script `scripts/remove-audit-service-demo.mjs`
 * fournit la liste lue, ces fonctions la filtrent. Elles sont testables hors ligne.
 *
 * Contexte : le service audit est une offre à part entière (/audit,
 * `fix-optimize` dans /services). Il ne doit pas apparaître dans la galerie
 * « Exemples & réalisations ». La fiche d'audit est une erreur de contenu :
 * elle est distinguée des modèles par son slug.
 */

/** Fiches à retirer de la galerie (slug exact, non casse-sens). */
export const REMOVE_SLUGS = ["audit-de-site"];

/**
 * Filtre une liste de fiches et renvoie { kept, removed }.
 *
 * Les slugs sont normalisés (trim) avant comparaison. Une fiche sans slug
 * ou avec un slug absent du tableau de retrait est conservée telle quelle
 * (aucune altération des données).
 *
 * @param {unknown} demos - liste de fiches brutes (settings.content_demos)
 * @param {readonly string[]} slugs - slugs à retirer
 * @returns {{ kept: unknown[]; removed: Array<{ slug: string, title: string }> }}
 */
export function removeSlugs(demos, slugs = REMOVE_SLUGS) {
  if (!Array.isArray(demos)) return { kept: [], removed: [] };
  const toRemove = new Set(slugs.map((s) => String(s ?? "").trim()).filter(Boolean));
  const kept = [];
  const removed = [];
  for (const demo of demos) {
    const slug = typeof demo?.slug === "string" ? demo.slug.trim() : "";
    if (toRemove.has(slug)) {
      removed.push({
        slug,
        title: typeof demo?.title === "string" ? demo.title.trim() : "",
      });
    } else {
      kept.push(demo);
    }
  }
  return { kept, removed };
}
