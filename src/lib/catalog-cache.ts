/**
 * Couche de cache PARTAGÉE des Pages Router / Routes (Next.js `unstable_cache`).
 *
 * ── Le problème ──
 * Le catalogue (`/codes`, `/codes/category/[kind]`, `/codes/[slug]`) est rendu
 * à chaque requête (`force-dynamic`, indispensable pour ne jamais figer un
 * repli). Le mémo interne de `digital-store.ts` ne survit que dans
 * l'instance qui l'a rempli : sur Vercel, chaque instance serverless froide
 * relisait Neon et reconstruisait les ~280 fiches. Résultat : TTFB élevé et
 * consommation de quota de calcul Neon proportionnelle au trafic.
 *
 * ── La solution ──
 * `unstable_cache` (Next 16) : le résultat est mémorisé dans le cache de
 * données de Next, donc **partagé entre requêtes et entre instances**, avec
 * une durée de vie (`revalidate`, en secondes) et une invalidation par
 * **tag** (`revalidateTag`) — plus `revalidatePath` pour le HTML.
 *
 * ── Ce qui n'est JAMAIS mis en cache ici ──
 * - le stock / la disponibilité au moment du panier : `createDigitalCheckout`
 *   relit la fiche et son montant en base à chaque commande
 *   (`checkSupplierUnitPrice`), et `companyPasses`/`quoteDigitalOrder`
 *   recalculent le prix côté serveur ;
 * - la création de facture NOWPayments, les commandes, les codes livrés ;
 * - l'état de panne (`digitalCatalogStatus`) : une panne ne doit pas être
 *   mémorisée (elle serait servie 5 minutes de plus après le retour de la
 *   base).
 *
 * ── Invalidations ──
 * Toute écriture appelle `invalidateDigitalCaches()` / `invalidateSiteCaches()`
 * (voir `cache-tags.ts`). En complément, la durée de vie courte (60 s pour la
 * vitrine) borne la fenêtre de fraîcheur si une invalidation est manquée
 * (écriture par un autre déploiement, seed, script).
 */

import { unstable_cache } from "next/cache";
import { digitalCatalogStatus, getDigitalCatalog } from "@/lib/digital-store";
import { getSiteData } from "@/lib/store";
import type { SiteData } from "@/lib/store";
import type { DigitalProduct } from "@/lib/digital-types";
import {
  CACHE_TAGS,
  DIGITAL_CATALOG_REVALIDATE_SECONDS,
  SITE_DATA_REVALIDATE_SECONDS,
} from "@/lib/cache-tags";

/**
 * Réglages du site (configuration + contenu éditorial), partagés entre
 * instances. Invalidation : `revalidateTag(CACHE_TAGS.site)` à chaque
 * écriture admin (`upsertSetting`, `deleteSetting`).
 */
export const getSiteDataCachedShared = unstable_cache(
  async (): Promise<SiteData> => getSiteData(),
  ["site-data"],
  { revalidate: SITE_DATA_REVALIDATE_SECONDS, tags: [CACHE_TAGS.site] },
);

export interface SharedCatalogSnapshot {
  products: DigitalProduct[];
  /**
   * État de panne relevé AU MOMENT de la lecture. Il est renvoyé avec les
   * données (et non lu après coup) pour que la valeur mise en cache ne
   * puisse jamais faire passer un repli de démonstration pour le catalogue.
   */
  degraded: boolean;
}

/**
 * Catalogue public, partagé entre instances.
 *
 * Le tag `catalog` est purgé par les synchronisations fournisseur, les
 * écritures admin du catalogue et le cron ; la durée de vie de 60 s garantit
 * qu'une vitrine ne reste jamais plus d'une minute sur une version périmée.
 */
export const getPublicCatalogCached = unstable_cache(
  async (): Promise<SharedCatalogSnapshot> => {
    const products = await getDigitalCatalog({ publicOnly: true });
    return { products, degraded: digitalCatalogStatus().degraded };
  },
  ["public-catalog"],
  { revalidate: DIGITAL_CATALOG_REVALIDATE_SECONDS, tags: [CACHE_TAGS.catalog] },
);
