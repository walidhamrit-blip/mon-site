import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { g2gOfferMappings, type G2gOfferMapping } from "@/db/schema";
import {
  fazercardsBalance,
  fazercardsConfigured,
  fazercardsGiftCardCards,
} from "@/lib/fazercards";
import { g2gFeePercent, planG2gFulfilment } from "@/lib/g2g-fulfilment-core";
import { automaticDeliveryVerified, pilotQuantityAllowed } from "@/lib/g2g-pilot";
import { isAdminAuthenticated } from "@/lib/auth";
import {
  g2gConfigured,
  g2gErrorMessage,
  g2gGetOffer,
  g2gPatchOffer,
  type G2gOffer,
} from "@/lib/g2g";

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
 *  - Toute activation est limitée à l’offre pilote explicitement configurée.
 *  - Refuse si G2G n'est pas configuré.
 *  - `api_qty` doit être 0 ou 1.
 */
export async function PATCH(req: Request) {
  if (!(await isAdminAuthenticated())) {
    return noStoreJson({ ok: false, error: "unauthorized" }, 401);
  }

  let input: { offerId?: unknown; api_qty?: unknown; apiQty?: unknown };
  try {
    input = (await req.json()) as { offerId?: unknown; api_qty?: unknown; apiQty?: unknown };
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

  const apiQty = Number(input.apiQty ?? input.api_qty);
  if (!Number.isInteger(apiQty) || apiQty < 0 || apiQty > 1) {
    return noStoreJson(
      { ok: false, error: "invalid_api_qty", message: "api_qty doit être un entier entre 0 et 1." },
      400,
    );
  }

  if (!pilotQuantityAllowed(offerId, apiQty, process.env.G2G_PILOT_OFFER_ID)) {
    return noStoreJson({ ok: false, error: "pilot_offer_not_configured", message: "Activation refusée : configurez G2G_PILOT_OFFER_ID pour cette offre unique et vérifiez les autres offres sur G2G." }, 403);
  }

  if (apiQty > 0 && process.env.G2G_AUTO_DELIVERY !== "1") {
    return noStoreJson({ ok: false, error: "auto_delivery_disabled", message: "Activation refusée : G2G_AUTO_DELIVERY n'est pas armé." }, 403);
  }

  if (apiQty > 0 && !automaticDeliveryVerified()) {
    return noStoreJson({ ok: false, error: "delivery_not_verified", message: "Activation bloquée : le format des codes fournisseur et la livraison automatique doivent être vérifiés de bout en bout." }, 503);
  }

  // Si on active (api_qty > 0), le mapping doit exister et être activé :
  // autrement un client paierait une commande que rien ne livre.
  let mapping: G2gOfferMapping | undefined;
  if (apiQty > 0) {
    await ensureSchema();
    const rows = await db
      .select()
      .from(g2gOfferMappings)
      .where(eq(g2gOfferMappings.offerId, offerId))
      .limit(1);
    mapping = rows[0];
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

  // Lire l'offre chez G2G pour vérifier qu'elle existe et que sa devise concorde avec le mapping.
  let offer: G2gOffer | null = null;
  if (g2gConfigured()) {
    try {
      const response = await g2gGetOffer(offerId);
      offer = response.payload ?? null;
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
  if (apiQty > 0 && mapping) {
    const offerCurrency = (offer.currency ?? "").trim().toUpperCase();
    const saleCurrency = mapping.saleCurrency.trim().toUpperCase();
    const rate = Number(mapping.conversionRateUsd ?? 1);
    const convCost = Number(mapping.conversionCostUsd ?? 0);
    if (offerCurrency !== saleCurrency) {
      return noStoreJson(
        {
          ok: false,
          error: "currency_mismatch",
          message: `Offre ${offerId} libellée en ${offer.currency ?? "?"} alors que le mapping attend ${mapping.saleCurrency}.`,
        },
        400,
      );
    }
    if (
      !Number.isFinite(rate) ||
      rate <= 0 ||
      (saleCurrency === "USD" && rate !== 1) ||
      !Number.isFinite(convCost) ||
      convCost < 0
    ) {
      return noStoreJson(
        {
          ok: false,
          error: "invalid_conversion",
          message: `Paramètres de conversion invalides pour ${offerId}.`,
        },
        400,
      );
    }

    const feePercent = g2gFeePercent(process.env.G2G_FEE_PERCENT);
    if (feePercent === null) {
      return noStoreJson(
        {
          ok: false,
          error: "fee_not_configured",
          message: "Activation refusée : configurez d'abord G2G_FEE_PERCENT côté serveur (ex. 9.98).",
        },
        400,
      );
    }
    if (mapping.supplierKind !== "gift_card" || !mapping.categoryId || !mapping.supplierSkuId) {
      return noStoreJson(
        {
          ok: false,
          error: "invalid_supplier_sku",
          message: "Activation refusée : le pilote exige une carte cadeau FazerCards (category_id + card_id).",
        },
        400,
      );
    }
    if (!fazercardsConfigured()) {
      return noStoreJson(
        {
          ok: false,
          error: "fazercards_not_configured",
          message: "Clé API FazerCards absente côté serveur.",
        },
        503,
      );
    }

    let supplierCostUsd = 0;
    try {
      const [cards, balance] = await Promise.all([
        fazercardsGiftCardCards(mapping.categoryId),
        fazercardsBalance({ timeoutMs: 10_000 }),
      ]);
      const sku = cards.offers.find((item) => item.card_id === mapping.supplierSkuId);
      if (!sku || sku.stock < 1 || 1 < sku.min_order_quantity || 1 > sku.max_order_quantity) {
        return noStoreJson(
          {
            ok: false,
            error: "supplier_out_of_stock",
            message: `Stock FazerCards indisponible pour ${mapping.categoryId} / ${mapping.supplierSkuId}.`,
          },
          400,
        );
      }
      supplierCostUsd = Number(sku.price_usd);
      const balanceUsd = Number(balance.balance);
      if (!Number.isFinite(supplierCostUsd) || supplierCostUsd <= 0) {
        return noStoreJson(
          { ok: false, error: "supplier_cost_invalid", message: "Prix FazerCards invalide." },
          400,
        );
      }
      if (!Number.isFinite(balanceUsd) || balanceUsd < supplierCostUsd) {
        return noStoreJson(
          {
            ok: false,
            error: "insufficient_supplier_balance",
            message: `Solde FazerCards insuffisant (${balance.balance} USD) pour couvrir ${sku.price_usd} USD.`,
          },
          400,
        );
      }
    } catch (error) {
      return noStoreJson(
        {
          ok: false,
          error: "supplier_check_failed",
          message: `Vérification FazerCards impossible avant ouverture : ${error instanceof Error ? error.message : String(error)}`,
        },
        502,
      );
    }

    const livePlan = planG2gFulfilment({
      mappingEnabled: true,
      autoDeliveryEnabled: true,
      feePercent,
      offerUnitPrice: offer.unit_price ?? null,
      offerCurrency: offer.currency ?? "",
      offerDeliveryType: offer.delivery_type ?? null,
      offerCodeLabel: offer.code_label ?? null,
      supplierCostUsd,
      saleCurrency: mapping.saleCurrency,
      conversionRateUsd: rate,
      conversionCostUsd: convCost,
      minMarginPercent: mapping.minMarginPercent,
      maxCostUsd: Number(mapping.maxCostUsd ?? 0) || 0,
      requestedQty: 1,
    });
    if (livePlan.decision !== "proceed") {
      return noStoreJson(
        {
          ok: false,
          error: `preflight_${livePlan.decision}`,
          message: `Activation refusée (${livePlan.decision}) : ${livePlan.summary}`,
        },
        400,
      );
    }
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
