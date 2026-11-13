/**
 * Invalidation du cache de données Next (`revalidateTag`) + du HTML
 * (`revalidatePath`), en un seul appel.
 *
 * Pourquoi les deux : le HTML d'une page est revalidé par chemin, mais la
 * DONNÉE qui l'alimente est mémorisée par tag (`unstable_cache`). Oublier
 * l'un des deux produit soit une page périmée, soit une page reconstruite
 * avec des données périmées — les deux ont été observés en production
 * (catalogue figé après une synchro, réglages qui ne remontaient pas).
 *
 * Toutes les fonctions sont « best effort » : hors contexte de requête Next
 * (script, test, cron), `revalidate*` lève ; on journalise et on continue.
 * Une invalidation ratée n'est jamais une raison de faire échouer une
 * écriture — les TTL courts servent de filet.
 */

import { revalidatePath, revalidateTag, updateTag } from "next/cache";
import { CACHE_TAGS, type CacheTag } from "@/lib/cache-tags";

function safe(operation: () => void, label: string): void {
  try {
    operation();
  } catch (error) {
    console.warn(
      `[cache] invalidation « ${label} » impossible hors requête Next :`,
      error instanceof Error ? error.message : error,
    );
  }
}

/**
 * Invalide un tag de données.
 *
 * Deux mécanismes, selon le contexte d'exécution :
 *  - **Server Action** (écriture admin) : `updateTag` purge immédiatement et
 *    garantit le « read-your-own-writes » — l'admin qui vient d'enregistrer
 *    un prix le voit tout de suite ;
 *  - **Route / cron / script** : `revalidateTag(tag, { expire: 0 })` purge
 *    aussi immédiatement, mais sans la sémantique Server Action.
 *
 * Le premier est tenté puis le second : aucun contexte commun aux deux.
 */
function invalidateTag(tag: CacheTag): void {
  try {
    updateTag(tag);
    return;
  } catch {
    // Hors Server Action : on retombe sur revalidateTag.
  }
  safe(() => revalidateTag(tag, { expire: 0 }), tag);
}

/** Invalide des tags de données (sans toucher au HTML). */
export function invalidateTags(tags: readonly CacheTag[]): void {
  for (const tag of tags) invalidateTag(tag);
}

/**
 * Invalide le HTML des pages du catalogue.
 *
 * `"layout"` couvre les pages imbriquées (`/codes/[slug]`,
 * `/codes/category/[kind]`) sans les énumérer — la liste des 280 fiches
 * change à chaque synchro, on ne revalide pas 280 chemins.
 */
export function revalidateCatalogPages(): void {
  safe(() => revalidatePath("/codes", "layout"), "/codes (layout)");
}

/** Invalide le HTML public (layout racine : tout le site public). */
export function revalidatePublicSite(): void {
  safe(() => revalidatePath("/", "layout"), "/(site) (layout)");
}

/**
 * Écriture du CATALOGUE (fiche, prix, dénomination, synchro fournisseur,
 * masquage admin) : les acheteurs doivent voir le nouveau prix tout de suite.
 */
export function invalidateCatalogCaches(): void {
  invalidateTags([CACHE_TAGS.catalog]);
  revalidateCatalogPages();
}

/**
 * Écriture des RÉGLAGES / CONTENU (configuration, textes, visuels) : le
 * catalogue ne dépend pas de ces valeurs, mais l'en-tête, le pied de page et
 * les fiches (devise, marché, WhatsApp) oui.
 */
export function invalidateSiteCaches(): void {
  invalidateTags([CACHE_TAGS.site, CACHE_TAGS.catalog]);
  revalidatePublicSite();
}
