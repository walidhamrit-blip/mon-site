import { getDigitalProductBySlug } from "@/lib/digital-store";
import { lowestPriceUsd } from "@/lib/digital-types";
import { absoluteUrl } from "@/lib/seo";
import { getSiteDataCached } from "@/lib/store";

/**
 * Fiche détaillée d'un produit du catalogue digital.
 *
 * `404` explicite si la fiche n'existe pas ou n'est pas publiée : le
 * catalogue public ne doit jamais exposer un brouillon ni une archive.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const [{ config }, product] = await Promise.all([
    getSiteDataCached(),
    getDigitalProductBySlug(slug),
  ]);

  if (!product) {
    return Response.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  return Response.json(
    {
      ok: true,
      product: {
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
        denominations: product.denominations.map((denomination) => ({
          label: denomination.label,
          faceValue: denomination.faceValue,
          region: denomination.region,
          priceUsd: denomination.priceUsd,
          noteAr: denomination.noteAr,
          noteEn: denomination.noteEn,
          available: denomination.available,
        })),
      },
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
      },
    },
  );
}
