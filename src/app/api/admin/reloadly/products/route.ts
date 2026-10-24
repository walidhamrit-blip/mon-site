import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import {
  isReloadlyError,
  listGiftCardProducts,
  reloadlyConfigured,
  reloadlyErrorMessage,
  reloadlyMode,
  type ReloadlyGiftCardProduct,
} from "@/lib/reloadly";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Recherche de produits dans le catalogue Reloadly — réservé à l'admin.
 *
 * Sert à retrouver l'ID produit et ses valeurs faciales à relier à une
 * fiche du catalogue local (admin → Codes & Cartes → « Rechercher sur
 * Reloadly »). Lecture seule : aucun achat, aucune donnée de compte
 * renvoyée (ni solde ni identifiant).
 */
export async function GET(req: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  if (!reloadlyConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: "not_configured",
        message:
          "RELOADLY_CLIENT_ID / RELOADLY_CLIENT_SECRET absents : ajoutez-les sur Vercel puis redéployez.",
      },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const search = (url.searchParams.get("q") ?? "").trim();
  const country = (url.searchParams.get("country") ?? "").trim().toUpperCase();
  const page = Number(url.searchParams.get("page") ?? 1);

  try {
    const { products, total } = await listGiftCardProducts({
      productName: search || undefined,
      countryCode: country || undefined,
      page: Number.isFinite(page) ? page : 1,
      size: 24,
    });

    return NextResponse.json({
      ok: true,
      mode: reloadlyMode(),
      total,
      products: products.map((product: ReloadlyGiftCardProduct) => ({
        productId: product.productId,
        name: product.productName,
        country: product.countryCode,
        currency: product.currencyCode,
        brand: product.brandName,
        type: product.denominationType,
        fixedDenominations: product.fixedDenominations,
        minDenomination: product.minDenomination,
        maxDenomination: product.maxDenomination,
        status: product.status,
        logo: product.logoUrls[0] ?? null,
      })),
    });
  } catch (error) {
    console.error(
      "[admin][reloadly] recherche impossible :",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      {
        ok: false,
        error: "supplier_error",
        message: reloadlyErrorMessage(error),
        status: isReloadlyError(error) ? error.status : null,
      },
      { status: 502 },
    );
  }
}
