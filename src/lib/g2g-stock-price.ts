/**
 * Synchronisation stock & prix des offres G2G (phase 2, brique 4).
 *
 * Ce cron, appelé régulièrement, aligne `api_qty` sur chaque offre G2G :
 *
 *   - **Stock** : le qty disponible chez FazerCards pour le `card_id` du
 *     mapping. Si le stock est nul, l'offre est coupée (`api_qty = 0`).
 *   - **Prix / marge** : le prix de vente G2G est relu à chaque exécution.
 *     Si la marge nette passe sous le seuil du mapping, l'offre est coupée.
 *
 * C'est le garde-fou économique : une offre dont le coût fournisseur
 * augmente ou dont le stock s'épuise n'est plus achetable automatiquement.
 *
 * Aucun code produit, aucun secret : seuls les quantités et les montants
 * sont manipulés.
 */

import { and, eq } from "drizzle-orm";

import { db, ensureSchema } from "@/db";
import { g2gOfferMappings, type G2gOfferMapping } from "@/db/schema";
import { fazercardsGiftCardCards, fazercardsConfigured } from "@/lib/fazercards";
import {
  g2gGetOffer,
  g2gPatchOffer,
  g2gConfigured,
  type G2gOffer,
} from "@/lib/g2g";
import { g2gFeePercent, planG2gFulfilment } from "@/lib/g2g-fulfilment-core";

/** Quantité maximale proposée sur une offre G2G, même si le stock est plus élevé. */
const G2G_STOCK_QTY_CAP = 100;

/**
 * Résultat de l'évaluation d'une seule offre : le qty à proposer sur G2G
 * et la raison de la décision.
 */
export type G2gStockPriceResult =
  | {
      kind: "updated";
      /** Nouvelle valeur de api_qty posée sur l'offre G2G. */
      apiQty: number;
      /** Raison lisible de la décision. */
      reason: string;
    }
  | {
      kind: "skipped";
      /** Pourquoi l'offre n'a pas été mise à jour. */
      reason: string;
    };

/**
 * Calcule le `api_qty` à proposer pour une offre G2G donnée, en fonction
 * du stock chez FazerCards et de la marge nette.
 *
 * Retourne `0` (offre coupée) quand :
 *   - le stock chez FazerCards est nul ou indisponible ;
 *   - le prix de vente G2G est illisible ou non en USD ;
 *   - la marge nette passe sous le seuil du mapping.
 */
export async function evaluateOfferStockPrice(
  mapping: G2gOfferMapping,
): Promise<G2gStockPriceResult> {
  const offerId = mapping.offerId;
  const categoryId = mapping.categoryId;
  const supplierSkuId = mapping.supplierSkuId;
  const minMarginPercent = mapping.minMarginPercent;
  const maxCostUsd = Number(mapping.maxCostUsd ?? 0);

  // 1. Lire l'offre G2G actuelle (prix, devise, format).
  let offer: G2gOffer | null = null;
  if (g2gConfigured()) {
    try {
      const response = await g2gGetOffer(offerId);
      offer = response.payload ?? null;
    } catch (error) {
      return {
        kind: "skipped",
        reason: `Offre G2G ${offerId} illisible : ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  } else {
    return {
      kind: "skipped",
      reason: "Clés API G2G absentes côté serveur.",
    };
  }

  if (!offer) {
    return { kind: "skipped", reason: `Offre G2G ${offerId} introuvable.` };
  }

  // Seules les offres libellées en USD sont automatisées (pas de conversion implicite).
  if (offer.currency !== "USD") {
    return {
      kind: "skipped",
      reason: `Devise ${offer.currency ?? "?"} — seule USD est automatisée.`,
    };
  }

  // Le format de code attendu doit être connu.
  if (!offer.code_label) {
    return {
      kind: "skipped",
      reason: "code_label absent — format de code inconnu.",
    };
  }

  // Un top-up par ID joueur ne peut pas être livré avec un code.
  const types = (offer.delivery_type ?? []).map((value) =>
    String(value ?? "").trim().toLowerCase(),
  );
  if (types.some((value) => value.includes("top_up") || value.includes("topup"))) {
    return {
      kind: "skipped",
      reason: "Top-up par ID joueur — jamais de code automatique.",
    };
  }

  // 2. Lire le stock chez FazerCards pour ce card_id.
  let stock = 0;
  if (categoryId && supplierSkuId && fazercardsConfigured()) {
    try {
      const cards = await fazercardsGiftCardCards(categoryId);
      const sku = cards.offers.find((o) => o.card_id === supplierSkuId);
      stock = sku?.stock ?? 0;
    } catch (error) {
      return {
        kind: "skipped",
        reason: `Stock FazerCards illisible : ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  } else {
    return {
      kind: "skipped",
      reason: "category_id / card_id manquants ou FazerCards non configuré.",
    };
  }

  // 3. Calcul de la marge sur 1 unité (la marge % est identique pour N unités).
  const feePercent = g2gFeePercent(process.env.G2G_FEE_PERCENT);
  const plan = planG2gFulfilment({
    mappingEnabled: true,
    autoDeliveryEnabled: true, // calcul hypothétique : on veut juste connaître la marge
    feePercent,
    offerUnitPrice: offer.unit_price ?? null,
    offerCurrency: offer.currency ?? "USD",
    offerDeliveryType: offer.delivery_type ?? null,
    offerCodeLabel: offer.code_label ?? null,
    supplierCostUsd: Number(mapping.supplierPriceUsd ?? 0) || 0,
    saleCurrency: mapping.saleCurrency,
    minMarginPercent,
    maxCostUsd,
    requestedQty: 1,
  });

  if (plan.decision !== "proceed") {
    return {
      kind: "skipped",
      reason: `Marge insuffisante ou garde-fou : ${plan.decision} (${plan.summary}).`,
    };
  }

  // 4. Déterminer le qty à proposer sur G2G.
  //    Borné par le stock chez FazerCards et par un plafond raisonnable.
  let apiQty = Math.min(stock, G2G_STOCK_QTY_CAP);

  // Nécessite au moins 1 unité pour rester achetable.
  if (apiQty < 1) {
    return {
      kind: "skipped",
      reason: `Stock FazerCards épuisé (${stock}) pour ${supplierSkuId}.`,
    };
  }

  // Respecter le plafond de coût : ne pas proposer plus que ce que maxCostUsd permet.
  const unitPrice = Number(offer.unit_price ?? 0);
  if (Number.isFinite(unitPrice) && unitPrice > 0 && Number.isFinite(maxCostUsd) && maxCostUsd > 0) {
    const qtyByCost = Math.floor(maxCostUsd / unitPrice);
    if (qtyByCost < apiQty) {
      apiQty = qtyByCost;
    }
  }

  if (apiQty < 1) {
    return {
      kind: "skipped",
      reason: `Plafond de coût (${maxCostUsd} $) inférieur au prix unitaire (${unitPrice} $).`,
    };
  }

  return {
    kind: "updated",
    apiQty,
    reason: `Stock ${stock}, marge ${plan.netMarginPercent.toFixed(1)} %, qty proposée ${apiQty}.`,
  };
}

/**
 * Traite tous les mappings G2G activés : pour chacun, évalue le stock et
 * la marge, puis pose `api_qty` sur l'offre chez G2G.
 *
 * C'est le point d'entrée du cron `/api/cron/g2g-stock-price`.
 */
export async function syncG2gStockAndPrice(): Promise<{
  processed: number;
  updated: number;
  skipped: number;
  results: {
    offerId: string;
    kind: string;
    apiQty?: number;
    reason: string;
  }[];
}> {
  await ensureSchema();

  const mappings = await db
    .select()
    .from(g2gOfferMappings)
    .where(eq(g2gOfferMappings.enabled, true))
    .orderBy(g2gOfferMappings.offerId);

  const results: {
    offerId: string;
    kind: string;
    apiQty?: number;
    reason: string;
  }[] = [];

  let updated = 0;
  let skipped = 0;

  for (const mapping of mappings) {
    const evaluation = await evaluateOfferStockPrice(mapping);

    if (evaluation.kind === "updated") {
      // Pose api_qty sur l'offre G2G.
      try {
        await g2gPatchOffer(mapping.offerId, { api_qty: evaluation.apiQty });
        updated++;
        results.push({
          offerId: mapping.offerId,
          kind: "updated",
          apiQty: evaluation.apiQty,
          reason: evaluation.reason,
        });
      } catch (error) {
        skipped++;
        results.push({
          offerId: mapping.offerId,
          kind: "skipped",
          reason: `Échec de mise à jour G2G : ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    } else {
      skipped++;
      results.push({
        offerId: mapping.offerId,
        kind: "skipped",
        reason: evaluation.reason,
      });
    }

    // Met à jour last_checked_at quel que soit le résultat.
    try {
      await db
        .update(g2gOfferMappings)
        .set({ lastCheckedAt: new Date(), updatedAt: new Date() })
        .where(eq(g2gOfferMappings.offerId, mapping.offerId));
    } catch {
      // Non bloquant : l'évaluation a déjà été faite.
    }
  }

  return {
    processed: mappings.length,
    updated,
    skipped,
    results,
  };
}
