/**
 * Tags et durées de vie du cache partagé (Next `unstable_cache`).
 *
 * Module PUR (aucun import de Next, aucune base) : il peut être importé par
 * un composant client, par une route, par un script de maintenance et par
 * les tests sans tirer `next/cache`.
 *
 * Règle de nommage : un tag décrit une DONNÉE, pas une page. Le HTML des
 * pages est revalidé par `revalidatePath` ; les données le sont par
 * `revalidateTag`. Les deux sont appelés ensemble après une écriture.
 */

export const CACHE_TAGS = {
  /** Réglages + contenu éditorial (`getSiteData`). */
  site: "site-data",
  /** Catalogue public (fiches + dénominations + surcharges). */
  catalog: "digital-catalog",
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];

/**
 * Durées de vie (secondes). Volontairement courtes : ce sont des bornes de
 * sécurité, pas la fraîcheur attendue. La fraîcheur réelle vient des
 * invalidations explicites ; ces TTL garantissent qu'un oubli (écriture par
 * un script, un autre déploiement, un seed) ne bloque jamais une mise à
 * jour plus longtemps que cette fenêtre.
 */
export const SITE_DATA_REVALIDATE_SECONDS = 300;

/** Le prix et la disponibilité bougent : une minute maximum. */
export const DIGITAL_CATALOG_REVALIDATE_SECONDS = 60;

/**
 * Décrit l'effet d'une invalidation, pour les journaux et les tests.
 * Pur : permet d'asserter la politique sans exécuter `revalidateTag`.
 */
export function invalidationPlan(kind: "catalog" | "site" | "both"): {
  tags: CacheTag[];
  paths: string[];
} {
  const catalogPaths = ["/codes", "/codes/[slug]", "/codes/category/[kind]"];
  switch (kind) {
    case "catalog":
      return { tags: [CACHE_TAGS.catalog], paths: catalogPaths };
    case "site":
      return { tags: [CACHE_TAGS.site], paths: ["/(site)"] };
    case "both":
      return {
        tags: [CACHE_TAGS.site, CACHE_TAGS.catalog],
        paths: ["/(site)", ...catalogPaths],
      };
  }
}
