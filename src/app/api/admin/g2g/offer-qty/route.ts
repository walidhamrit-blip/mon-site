import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { g2gOfferMappings } from "@/db/schema";
import { isAdminAuthenticated } from "@/lib/auth";
import { g2gConfigured, g2gErrorMessage, g2gGetOffer, g2gPatchOffer } from "@/lib/g2g";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function cleanText(value: unknown, max = 200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/**
 * Met à jour `api_qty` sur une offre G2G (ex. `api_qty = 1` pour le pilote
 * single-offer). C'est l'action qui rend une offre achetable sur G2G et
 * déclenche les webhooks `order.api_delivery`.
 *
 * Usage brique 3 : `PATCH /api/admin/g2g/offer-qty` avec
 * `{ offerId: "G1793906316865GE", api_qty: 1 }`.
 *
 * Garde-fous :
 *  - Refuse si le mapping n'existe pas ou n'est pas activé (pas d'achat sans
 *    correspondance).
 *  - Refuse si l'offre n'est pas en USD (pas de conversion implicite).
 *  - Refuse si G2G n'est pas configuré.
 *  - `api_qty` doit être un entier entre 0 et 10000.
 */
export async function PATCH(req: Request) {
  if (!(await isAdminAuthenticated())) {
    return noStoreJson({ ok: false, error: "unauthorized" }, 401);
  }

  let input: { offerId?: unknown; api_qty?: unknown };
  try {
    input = (await req.json()) as { offerId?: unknown; api_qty?: unknown };
  } catch {
    return noStoreJson({ ok: false, error: "invalid_json" }, 400);
  }

  const offerId = cleanText(input.offerId, 64).toUpperCase();
  if (!/^G[0-9A-Z]{8,}$/.test(offerId)) {
    return noStoreJson(
      {
        ok: false,
        error: "invalid_offer_id",
        message: "offer_id G2G attendu (ex. G1793906316865GE).",
      },
      400,
    );
  }

  const apiQty = Number(input.api_qty);
  if (!Number.isInteger(apiQty) || apiQty < 0 || apiQty > 10000) {
    return noStoreJson(
      { ok: false, error: "invalid_api_qty", message: "api_qty doit être un entier entre 0 et 10000." },
      400,
    );
  }

  // Si on active (api_qty > 0), le mapping doit exister et être activé :
  // autrement un client paierait une commande que rien ne livre.
  if (apiQty > 0) {
    await ensureSchema();
    const rows = await db
      .select()
      .from(g2gOfferMappings)
      .where(eq(g2gOfferMappings.offerId, offerId))
      .limit(1);
    const mapping = rows[0];
    if (!mapping) {
      return noStoreJson(
        {
          ok: false,
          error: "mapping_missing",
          message: `Aucune correspondance pour ${offerId} : créez-la d'abord dans /admin/digital.`,
        },
        400,
      );
    }
    if (mapping.enabled !== true) {
      return noStoreJson(
        {
          ok: false,
          error: "mapping_disabled",
          message: `La correspondance ${offerId} existe mais n'est pas activée. Activez-la avant de passer api_qty > 0.`,
        },
        400,
      );
    }
  }

  // Lire l'offre chez G2G pour vérifier qu'elle existe et est libellée en USD.
  let offer: { currency?: string; status?: string; unit_price?: number } | null = null;
  if (g2gConfigured()) {
    try {
      const response = await g2gGetOffer(offerId);
      offer = (response.payload ?? null) as { currency?: string; status?: string; unit_price?: number } | null;
    } catch (error) {
      return noStoreJson(
        {
          ok: false,
          error: "offer_unreadable",
          message: `Offre G2G ${offerId} illisible : ${error instanceof Error ? error.message : String(error)}`,
        },
        400,
      );
    }
  } else {
    return noStoreJson(
      { ok: false, error: "g2g_not_configured", message: "Clés API G2G absentes côté serveur." },
      503,
    );
  }

  if (!offer) {
    return noStoreJson(
      { ok: false, error: "offer_not_found", message: `Offre ${offerId} introuvable chez G2G.` },
      404,
    );
  }
  if (offer.currency !== "USD") {
    return noStoreJson(
      {
        ok: false,
        error: "currency_not_usd",
        message: `Offre ${offerId} libellée en ${offer.currency ?? "?"} : l'automation exige USD (pas de conversion implicite).`,
      },
      400,
    );
  }

  try {
    const response = await g2gPatchOffer(offerId, { api_qty: apiQty });
    return noStoreJson({
      ok: true,
      offerId,
      api_qty: apiQty,
      code: response.code,
      message: response.message,
    });
  } catch (error) {
    console.error("[admin][g2g] patch api_qty impossible :", error instanceof Error ? error.message : error);
    return noStoreJson(
      { ok: false, error: "patch_failed", message: g2gErrorMessage(error) },
      502,
    );
  }
}
