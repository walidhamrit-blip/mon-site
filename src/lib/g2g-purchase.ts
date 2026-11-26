import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import { db, ensureSchema } from "@/db";
import { g2gDeliveries } from "@/db/schema";
import { fazercardsBalance, fazercardsGiftCardOrder } from "@/lib/fazercards";
import { automaticDeliveryVerified, isRetiredG2gOffer } from "@/lib/g2g-pilot";
import {
  shouldPurchaseNow,
  type G2gFulfilmentPlan,
} from "@/lib/g2g-fulfilment-core";

/**
 * Achat juste-à-temps d'une commande G2G (phase 2, brique 1).
 *
 * C'est le seul endroit du projet qui dépense de l'argent sans qu'un
 * humain ait cliqué. Tout y est donc fail-closed : au moindre doute, on
 * n'achète pas.
 *
 * Trois protections, dans cet ordre :
 *
 *   1. `shouldPurchaseNow()` — la porte. Elle croise le verdict du moteur
 *      avec l'état RÉEL du coupe-circuit.
 *   2. Une prise de possession atomique en base — deux webhooks concurrents
 *      ne peuvent pas acheter tous les deux.
 *
 * Le journal est écrit AVANT l'appel réseau (`status = 'purchasing'`). Si le
 * processus meurt pendant l'achat, la trace existe : on sait que de l'argent
 * a pu partir, et la file de livraison pourra reprendre la main. Sans ça, un
 * plantage laisserait une commande payée dont personne ne sait rien.
 */

export interface G2gPurchaseInput {
  deliveryId: string;
  orderId: string;
  offerId: string;
  requestedQty: number;
  /** Identifiants fournisseur issus de la correspondance. */
  categoryId: string | null | undefined;
  cardId: string | null | undefined;
  plan: G2gFulfilmentPlan | null;
  autoDeliveryEnabled: boolean;
}

export type G2gPurchaseOutcome =
  /** Rien à faire : marge insuffisante, coupe-circuit, offre illisible… */
  | { outcome: "not_eligible"; reason: string }
  /** Identifiants fournisseur manquants : on n'achète pas à l'aveugle. */
  | { outcome: "missing_sku" }
  /** Solde fournisseur insuffisant — souvent transitoire, donc réessayable. */
  | { outcome: "insufficient_balance"; balanceUsd: number; neededUsd: number }
  /** Solde illisible : on ne commande pas à l'aveugle. */
  | { outcome: "balance_unknown"; reason: string }
  /** Un autre traitement possède déjà cette livraison (rejeu ou concurrence). */
  | { outcome: "already_handled" }
  | { outcome: "purchased"; supplierOrderRef: string }
  | { outcome: "failed"; reason: string };

/** Motif d'erreur sans corps de réponse, sans en-tête, sans secret. */
function safeReason(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 300);
  return String(error).slice(0, 300);
}

/**
 * Une minute : délai avant rapprochement manuel en cas d'issue incertaine.
 */
const RETRY_DELAY_MS = 60_000;

/** États qui interdisent une nouvelle tentative d'achat. */
const TERMINAL_STATUSES = ["purchased", "delivered", "failed"];

export async function purchaseG2gDelivery(
  input: G2gPurchaseInput,
): Promise<G2gPurchaseOutcome> {
  /**
   * 1. LA porte. Un plan `proceed` calculé « comme si » ne suffit pas :
   *    on exige que la décision RÉELLE, coupe-circuit appliqué, soit
   *    `proceed`. C'est ce qui rend le coupe-circuit effectif.
   */
  if (!automaticDeliveryVerified()) {
    return { outcome: "not_eligible", reason: "delivery_not_verified" };
  }
  if (isRetiredG2gOffer(input.offerId)) {
    return { outcome: "not_eligible", reason: "retired_offer" };
  }
  if (!shouldPurchaseNow(input.plan, input.autoDeliveryEnabled)) {
    return { outcome: "not_eligible", reason: input.plan?.decision ?? "no_plan" };
  }

  // 2. Sans identifiants fournisseur, impossible de commander. La
  //    correspondance activée les impose déjà, on revérifie tout de même :
  //    c'est de l'argent réel.
  const categoryId = (input.categoryId ?? "").trim();
  const cardId = (input.cardId ?? "").trim();
  if (!categoryId || !cardId) {
    return { outcome: "missing_sku" };
  }
  if (!Number.isInteger(input.requestedQty) || input.requestedQty < 1 || input.requestedQty > 100) {
    return { outcome: "not_eligible", reason: "invalid_quantity" };
  }

  await ensureSchema();

  /**
   * 4. Solde fournisseur.
   *
   * Commander à découvert, c'est soit un échec, soit un compte mis en
   * négatif — dans les deux cas une commande payée qu'on ne peut pas
   * honorer. On vérifie donc AVANT de dépenser.
   *
   * Placé avant la prise de possession. Si le solde est indisponible ou
   * insuffisant, le traitement s'arrête pour intervention manuelle ; il n'y
   * a pas de reprise automatique d'achat.
   */
  const neededUsd = Number(input.plan?.totalCostUsd ?? 0);
  let balanceUsd: number;
  try {
    const account = await fazercardsBalance({ timeoutMs: 10_000 });
    balanceUsd = Number(account.balance);
    if (!Number.isFinite(balanceUsd)) throw new Error("solde illisible");
  } catch (error) {
    // Solde inconnu ⇒ on ne dépense pas. C'est le sens du doute.
    await db
      .update(g2gDeliveries)
      .set({
        status: "failed",
        nextAttemptAt: null,
        detail: `Solde fournisseur illisible : ${safeReason(error)}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(g2gDeliveries.deliveryId, input.deliveryId),
          inArray(g2gDeliveries.status, ["planned"]),
        ),
      );
    return { outcome: "balance_unknown", reason: safeReason(error) };
  }

  if (balanceUsd < neededUsd) {
    await db
      .update(g2gDeliveries)
      .set({
        status: "failed",
        nextAttemptAt: null,
        detail: `Solde insuffisant : ${balanceUsd} $ disponibles pour ${neededUsd} $ nécessaires.`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(g2gDeliveries.deliveryId, input.deliveryId),
          inArray(g2gDeliveries.status, ["planned"]),
        ),
      );
    return { outcome: "insufficient_balance", balanceUsd, neededUsd };
  }

  /**
   * 5. Prise de possession ATOMIQUE.
   *
   * L'UPDATE conditionnel est la protection contre la concurrence : la
   * clause `WHERE status IN ('planned')` ne laisse passer qu'un seul
   * traitement. Un webhook rejoué, ou deux invoications simultanées,
   * trouveront 0 ligne et s'arrêteront — sans dépenser.
   *
   * C'est aussi l'écriture anticipée : `purchasing` signifie « de l'argent
   * a pu partir ».
   */
  // Chaque intention reçoit une clé aléatoire ; elle et le corps exact sont
  // persistés dans le même UPDATE que la prise de possession. Aucune reprise
  // automatique n'est activée, même avec la garantie annoncée de 7 jours.
  const idempotencyKey = `g2g-fzr-${randomUUID()}`;
  const purchasePayload = JSON.stringify({ category_id: categoryId, card_id: cardId, quantity: input.requestedQty });
  const purchaseStartedAt = new Date();
  const claimed = await db
    .update(g2gDeliveries)
    .set({
      status: "purchasing",
      supplierIdempotencyKey: idempotencyKey,
      supplierPurchasePayload: purchasePayload,
      supplierPurchaseStartedAt: purchaseStartedAt,
      attempts: sql`${g2gDeliveries.attempts} + 1`,
      // Résultat incertain : la file déclenchera un rapprochement manuel.
      nextAttemptAt: new Date(Date.now() + RETRY_DELAY_MS),
      detail: "Achat en cours ; résultat incertain à vérifier manuellement en cas de panne.",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(g2gDeliveries.deliveryId, input.deliveryId),
        eq(g2gDeliveries.orderId, input.orderId),
        eq(g2gDeliveries.offerId, input.offerId),
        eq(g2gDeliveries.requestedQty, input.requestedQty),
        eq(g2gDeliveries.attempts, 0),
        isNull(g2gDeliveries.supplierIdempotencyKey),
        isNull(g2gDeliveries.supplierPurchasePayload),
        isNull(g2gDeliveries.supplierPurchaseStartedAt),
        inArray(g2gDeliveries.status, ["planned"]),
      ),
    )
    .returning({ id: g2gDeliveries.id, supplierIdempotencyKey: g2gDeliveries.supplierIdempotencyKey, supplierPurchasePayload: g2gDeliveries.supplierPurchasePayload });

  if (claimed.length === 0) {
    // Soit un autre traitement l'a déjà pris, soit l'état est terminal.
    return { outcome: "already_handled" };
  }

  // Toute incohérence laisse l'intention en revue manuelle, jamais de POST.
  if (claimed[0].supplierIdempotencyKey !== idempotencyKey || claimed[0].supplierPurchasePayload !== purchasePayload) {
    return { outcome: "failed", reason: "Intention d'achat incohérente : rapprochement manuel requis." };
  }

  // 6. L'appel qui coûte de l'argent.
  try {
    const response = await fazercardsGiftCardOrder({
      category_id: categoryId,
      card_id: cardId,
      quantity: input.requestedQty,
      idempotencyKey,
    });

    const supplierOrderRef = response.order?.id ?? "";
    await db
      .update(g2gDeliveries)
      .set({
        status: "purchased",
        supplierOrderRef: supplierOrderRef || null,
        // ⚠️ La livraison automatique n'est PAS encore câblée (brique 2).
        // On laisse donc une reprise programmée ET on alerte en aval.
        nextAttemptAt: new Date(Date.now() + RETRY_DELAY_MS),
        detail: supplierOrderRef
          ? `Acheté (réf. ${supplierOrderRef}). Code à livrer — livraison automatique non encore câblée.`
          : "Acheté, mais le fournisseur n'a renvoyé aucune référence : à rapprocher manuellement.",
        updatedAt: new Date(),
      })
      .where(eq(g2gDeliveries.id, claimed[0].id));

    return { outcome: "purchased", supplierOrderRef };
  } catch (error) {
    const reason = safeReason(error);
    await db
      .update(g2gDeliveries)
      .set({
        status: "failed",
        nextAttemptAt: new Date(Date.now() + RETRY_DELAY_MS),
        detail: `Échec d'achat : ${reason}`,
        updatedAt: new Date(),
      })
      .where(eq(g2gDeliveries.id, claimed[0].id));

    return { outcome: "failed", reason };
  }
}

/**
 * Livraisons à reprendre : achetées mais jamais livrées, ou échec à
 * relancer. Alimentera la brique 2 (file de livraison).
 */
export async function g2gDeliveriesToResume(limit = 20) {
  await ensureSchema();
  return db
    .select()
    .from(g2gDeliveries)
    .where(
      and(
        inArray(g2gDeliveries.status, ["purchasing", "purchased", "failed"]),
        sql`${g2gDeliveries.nextAttemptAt} IS NOT NULL AND ${g2gDeliveries.nextAttemptAt} <= now()`,
      ),
    )
    .limit(limit);
}

export { TERMINAL_STATUSES };
