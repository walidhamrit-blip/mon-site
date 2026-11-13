import { getDigitalPlatforms, getDigitalRegions } from "@/lib/digital-store";
import { lowestPriceUsd } from "@/lib/digital-types";
import { absoluteUrl } from "@/lib/seo";
import {
  getPublicCatalogCached,
  getSiteDataCachedShared as getSiteDataCached,
} from "@/lib/catalog-cache";

/**
 * API publique du catalogue digital (codes logiciels & cartes cadeaux).
 *
 * Lecture seule : aucune donnée sensible n'y figure (ni stock, ni prix
 * d'achat interne, ni référence de commande). Les prix sont exprimés en USD
 * — la devise de facturation — pour que le client puisse les convertir
 * avec les mêmes taux que l'interface.
 *
 * Réponse cacheable : le catalogue bouge peu. La lecture passe par le cache
 * de données partagé (`tag digital-catalog`), purgé à chaque écriture du
 * catalogue ; les en-têtes CDN (`s-maxage`) laissent en plus Vercel servir
 * la réponse sans exécuter la fonction.
 */
export async function GET() {
  const [{ config }, snapshot, platforms, regions] = await Promise.all([
    getSiteDataCached(),
    getPublicCatalogCached(),
    getDigitalPlatforms(true),
    getDigitalRegions(true),
  ]);
  const catalog = snapshot.products;

  const products = catalog.map((product) => ({
    id: product.id,
    slug: product.slug,
    kind: product.kind,
    status: product.status,
    platform: product.platform,
    color: product.color,
    titleAr: product.titleAr,
    titleEn: product.titleEn,
    descriptionAr: product.descriptionAr,
    descriptionEn: product.descriptionEn,
    image: product.image,
    regions: product.regions,
    featuresAr: product.featuresAr,
    featuresEn: product.featuresEn,
    deliveryNoteAr: product.deliveryNoteAr,
    deliveryNoteEn: product.deliveryNoteEn,
    url: absoluteUrl(config, `/codes/${product.slug}`),
    fromUsd: lowestPriceUsd(product),
    denominations: product.denominations
      .filter((denomination) => denomination.available)
      .map((denomination) => ({
        label: denomination.label,
        faceValue: denomination.faceValue,
        region: denomination.region,
        priceUsd: denomination.priceUsd,
        noteAr: denomination.noteAr,
        noteEn: denomination.noteEn,
      })),
  }));

  return Response.json(
    {
      ok: true,
      count: products.length,
      baseCurrency: config.currency?.base ?? "USD",
      // Affichage public : USDT (à parité avec le dollar, aucune conversion).
      displayCurrency: "USDT",
      platforms,
      regions,
      products,
    },
    {
      headers: {
        // `s-maxage` : 5 min au CDN, puis 1 h de service périmé pendant la
        // revalidation en arrière-plan. Une commande ne dépend JAMAIS de
        // cette réponse : le serveur recalcule prix et disponibilité.
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
        "Vary": "Accept-Encoding",
      },
    },
  );
}
