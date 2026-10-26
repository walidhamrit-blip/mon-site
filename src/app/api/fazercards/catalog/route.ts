import { NextResponse } from "next/server";
import { getFazercardsDigitalCatalog } from "@/lib/fazercards-catalog";
import { fazercardsConfigured } from "@/lib/fazercards";

/**
 * Catalogue public servi par FazerCards (source de vérité de la boutique).
 *
 * Sert le cache mémoire (`FAZERCARDS_CATALOG_TTL_SECONDS`, 10 min) : cet
 * endpoint ne déclenche pas une synchronisation par requête, et il continue
 * de répondre avec le dernier catalogue connu si le fournisseur est en panne
 * (`stale: true`).
 *
 * Aucune donnée sensible : ni solde, ni coût fournisseur, ni identifiant
 * interne. `?refresh=1` force une resynchronisation (throttlé par le cache :
 * les appels concurrents partagent la même synchro).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** `?refresh=1` déclenche une synchro complète : il lui faut du temps. */
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!fazercardsConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: "supplier_not_configured",
        message: "Catalogue fournisseur non configuré.",
      },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const force = url.searchParams.get("refresh") === "1";

  try {
    const catalog = await getFazercardsDigitalCatalog({ force });
    return NextResponse.json(
      {
        ok: true,
        total: catalog.products.length,
        cached: catalog.cached,
        stale: catalog.stale,
        fetchedAt: catalog.fetchedAt,
        products: catalog.products.map((product) => ({
          slug: product.slug,
          kind: product.kind,
          platform: product.platform,
          titleAr: product.titleAr,
          titleEn: product.titleEn,
          descriptionAr: product.descriptionAr,
          descriptionEn: product.descriptionEn,
          regions: product.regions,
          image: product.image,
          // Pas de `supplierCostUsd` : le coût d'achat est une donnée
          // interne, jamais exposée au navigateur.
          denominations: product.denominations.map((denomination) => ({
            id: denomination.id,
            label: denomination.label,
            faceValue: denomination.faceValue,
            region: denomination.region,
            priceUsd: denomination.priceUsd,
            available: denomination.available,
            maxQuantity: denomination.maxQuantity ?? null,
            fields: denomination.fields ?? [],
          })),
        })),
      },
      { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } },
    );
  } catch (error) {
    console.error(
      "[fazercards][catalogue] échec :",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      {
        ok: false,
        error: "catalog_unavailable",
        message: "Catalogue fournisseur indisponible pour le moment.",
      },
      { status: 502 },
    );
  }
}
