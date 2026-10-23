import { getDigitalCatalog, getDigitalPlatforms, getDigitalRegions } from "@/lib/digital-store";
import { lowestPriceUsd } from "@/lib/digital-types";
import { absoluteUrl } from "@/lib/seo";
import { getSiteDataCached } from "@/lib/store";

/**
 * API publique du catalogue digital (codes logiciels & cartes cadeaux).
 *
 * Lecture seule : aucune donnée sensible n'y figure (ni stock, ni prix
 * d'achat interne, ni référence de commande). Les prix sont exprimés en USD
 * — la devise de facturation — pour que le client puisse les convertir
 * avec les mêmes taux que l'interface.
 *
 * Réponse cacheable : le catalogue bouge peu.
 */
export async function GET() {
  const [{ config }, catalog, platforms, regions] = await Promise.all([
    getSiteDataCached(),
    getDigitalCatalog({ publicOnly: true }),
    getDigitalPlatforms(true),
    getDigitalRegions(true),
  ]);

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
      platforms,
      regions,
      products,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
      },
    },
  );
}
