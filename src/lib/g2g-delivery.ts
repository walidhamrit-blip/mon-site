/**
 * Surveillance des livraisons G2G : la livraison automatique reste bloquée
 * tant que le format fournisseur n'est pas vérifié. Les commandes achetées
 * ou au résultat incertain sont orientées vers une intervention humaine.
 * Aucun code produit n'est lu, journalisé ou envoyé par cette version.
 */

import { and, eq, inArray, lte, or, sql } from "drizzle-orm";

import { db, ensureSchema } from "@/db";
import { g2gDeliveries, type G2gDelivery } from "@/db/schema";
import { notifyTelegramAdmin } from "@/lib/telegram";

/** Nombre max de tentatives de livraison avant escalade humaine. */
export const G2G_DELIVERY_MAX_ATTEMPTS = 10;

/** Délai initial entre deux tentatives (ms), puis backoff exponentiel. */
const G2G_DELIVERY_BASE_DELAY_MS = 60_000;

/** Délai max entre deux tentatives (ms). */
const G2G_DELIVERY_MAX_DELAY_MS = 4 * 60 * 60 * 1000; // 4 h

/** Bail de reprise : une livraison `delivery_processing` plus vieille que
 * ce délai est réclamable à nouveau (protection contre un worker mort). */
const G2G_DELIVERY_LEASE_MS = 5 * 60 * 1000; // 5 min

/**
 * Résultat d'une tentative de livraison (sans écriture en base : l'appelant
 * décide de la suite).
 */
export type G2gDeliveryResult =
  | { kind: "delivered"; codes: number }
  | { kind: "awaiting_codes"; reason: string }
  | { kind: "no_order_ref" }
  | { kind: "manual_review"; reason: string }
  | { kind: "failed"; reason: string };

/** Délai avant la prochaine tentative, avec backoff borné. */
function nextDeliveryDelayMs(attempts: number): number {
  const raw = G2G_DELIVERY_BASE_DELAY_MS * Math.pow(2, attempts - 1);
  return Math.min(raw, G2G_DELIVERY_MAX_DELAY_MS);
}

/**
 * Évalue une livraison : sans format fournisseur vérifié, ne rien livrer
 * automatiquement et demander un rapprochement ou une livraison manuelle.
 */
export async function attemptG2gDelivery(
  delivery: G2gDelivery,
): Promise<G2gDeliveryResult> {
  const supplierOrderRef = delivery.supplierOrderRef;
  if (!supplierOrderRef) {
    return { kind: "no_order_ref" };
  }

  // Le schéma exact du code fournisseur n'est pas vérifié. Ne jamais
  // deviner ni transmettre une chaîne arbitraire : intervention humaine.
  return { kind: "manual_review", reason: "Format des codes fournisseur non vérifié : livraison manuelle requise." };
}

/**
 * Traite toutes les livraisons dues : celles dont le statut est `purchased`,
 * `purchasing` (reprise après crash) ou `failed` (retry programmé), et dont
 * `nextAttemptAt` est échu. Inclut aussi les `delivery_processing` dont le
 * bail a expiré.
 *
 * C'est le point d'entrée du cron `/api/cron/g2g-delivery`.
 */
export async function processG2gDeliveryQueue(limit = 20): Promise<{
  claimed: number;
  results: {
    deliveryId: string;
    kind: string;
    attempts: number;
    reason?: string;
  }[];
}> {
  await ensureSchema();
  const now = new Date();
  const leaseFloor = new Date(now.getTime() - G2G_DELIVERY_LEASE_MS);
  // Une ligne planned abandonnée peut être une commande client non traitée.
  // Attendre 10 minutes évite de perturber une exécution webhook en cours.
  const abandonedFloor = new Date(now.getTime() - 10 * 60_000);
  const eligible = or(
    and(eq(g2gDeliveries.status, "planned"), lte(g2gDeliveries.updatedAt, abandonedFloor)),
    and(
      sql`${g2gDeliveries.nextAttemptAt} IS NOT NULL AND ${g2gDeliveries.nextAttemptAt} <= now()`,
      or(
        inArray(g2gDeliveries.status, ["purchasing", "purchased", "failed"]),
        and(eq(g2gDeliveries.status, "delivery_processing"), lte(g2gDeliveries.deliveryClaimedAt, leaseFloor)),
      ),
    ),
  );

  // Le candidat est réévalué au moment de la prise de possession.
  const due = await db
    .select()
    .from(g2gDeliveries)
    .where(and(
      sql`${g2gDeliveries.deliveryAttempts} < ${G2G_DELIVERY_MAX_ATTEMPTS}`,
      eligible,
    ))
    .orderBy(sql`${g2gDeliveries.nextAttemptAt} ASC`, sql`${g2gDeliveries.createdAt} ASC`)
    .limit(limit);

  if (due.length === 0) return { claimed: 0, results: [] };

  const ids = due.map((row) => row.id);

  // Prise de possession : marque `delivery_processing` + bail. Deux crons
  // concurrents ne peuvent pas traiter la même livraison.
  const claimedRows = await db
    .update(g2gDeliveries)
    .set({
      status: "delivery_processing",
      deliveryClaimedAt: now,
      updatedAt: now,
    })
    .where(and(
      inArray(g2gDeliveries.id, ids),
      sql`${g2gDeliveries.deliveryAttempts} < ${G2G_DELIVERY_MAX_ATTEMPTS}`,
      eligible,
    )).returning();

  const results: {
    deliveryId: string;
    kind: string;
    attempts: number;
    reason?: string;
  }[] = [];

  for (const delivery of claimedRows) {
    // Un worker dont le bail a été repris ne doit pas écraser son successeur.
    const owned = and(
      eq(g2gDeliveries.id, delivery.id),
      eq(g2gDeliveries.status, "delivery_processing"),
      eq(g2gDeliveries.deliveryClaimedAt, now),
    );
    const attempts = Number(delivery.deliveryAttempts ?? 0) + 1;

    let result: G2gDeliveryResult;
    try {
      result = await attemptG2gDelivery(delivery);
    } catch (error) {
      result = {
        kind: "failed",
        reason: `Exception : ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    switch (result.kind) {
      case "delivered": {
        await db
          .update(g2gDeliveries)
          .set({
            status: "delivered",
            deliveryAttempts: attempts,
            nextAttemptAt: null,
            deliveryClaimedAt: null,
            detail: `Livré : ${result.codes} code(s) transmis à G2G.`,
            updatedAt: new Date(),
          })
          .where(owned);
        results.push({
          deliveryId: delivery.deliveryId,
          kind: "delivered",
          attempts,
        });
        break;
      }

      case "awaiting_codes": {
        if (attempts >= G2G_DELIVERY_MAX_ATTEMPTS) {
          await db.update(g2gDeliveries).set({ status: "failed", deliveryAttempts: attempts, nextAttemptAt: null, deliveryClaimedAt: null, detail: `Codes indisponibles : ${result.reason}`, updatedAt: new Date() }).where(owned);
          await escalateDelivery(delivery, result.reason, attempts);
          results.push({ deliveryId: delivery.deliveryId, kind: "failed", attempts, reason: result.reason });
          break;
        }
        const nextAttemptAt = new Date(
          Date.now() + nextDeliveryDelayMs(attempts),
        );
        await db
          .update(g2gDeliveries)
          .set({
            status: "purchased",
            deliveryAttempts: attempts,
            nextAttemptAt,
            deliveryClaimedAt: null,
            detail: `En attente des codes (tentative ${attempts}) : ${result.reason}`,
            updatedAt: new Date(),
          })
          .where(owned);
        results.push({
          deliveryId: delivery.deliveryId,
          kind: "awaiting_codes",
          attempts,
          reason: result.reason,
        });
        break;
      }

      case "manual_review": {
        await db.update(g2gDeliveries).set({ status: "failed", deliveryAttempts: attempts, nextAttemptAt: null, deliveryClaimedAt: null, detail: result.reason, updatedAt: new Date() }).where(owned);
        await escalateDelivery(delivery, result.reason, attempts);
        results.push({ deliveryId: delivery.deliveryId, kind: "manual_review", attempts, reason: result.reason });
        break;
      }

      case "no_order_ref": {
        await db
          .update(g2gDeliveries)
          .set({
            status: "failed",
            deliveryAttempts: attempts,
            nextAttemptAt: null,
            deliveryClaimedAt: null,
            detail:
              "Aucune référence fournisseur : commande et achat éventuel à vérifier manuellement avant toute action.",
            updatedAt: new Date(),
          })
          .where(owned);
        await escalateDelivery(delivery, "Aucune référence fournisseur.");
        results.push({
          deliveryId: delivery.deliveryId,
          kind: "failed",
          attempts,
          reason: "no_order_ref",
        });
        break;
      }

      case "failed": {
        if (attempts >= G2G_DELIVERY_MAX_ATTEMPTS) {
          await db
            .update(g2gDeliveries)
            .set({
              status: "failed",
              deliveryAttempts: attempts,
              nextAttemptAt: null,
              deliveryClaimedAt: null,
              detail: `Échec définitif de livraison : ${result.reason}`,
              updatedAt: new Date(),
            })
            .where(owned);
          await escalateDelivery(delivery, result.reason, attempts);
        } else {
          const nextAttemptAt = new Date(
            Date.now() + nextDeliveryDelayMs(attempts),
          );
          await db
            .update(g2gDeliveries)
            .set({
              status: "purchased",
              deliveryAttempts: attempts,
              nextAttemptAt,
              deliveryClaimedAt: null,
              detail: `Échec de livraison (tentative ${attempts}) : ${result.reason}`,
              updatedAt: new Date(),
            })
            .where(owned);
        }
        results.push({
          deliveryId: delivery.deliveryId,
          kind: "failed",
          attempts,
          reason: result.reason,
        });
        break;
      }
    }
  }

  return { claimed: claimedRows.length, results };
}

/** Alerte Telegram pour une livraison en échec définitif. */
async function escalateDelivery(
  delivery: G2gDelivery,
  reason: string,
  attempts?: number,
): Promise<void> {
  try {
    const notification = await notifyTelegramAdmin(
      [
        "🚨 G2G — LIVRAISON EN ÉCHEC DÉFINITIF",
        `Commande : ${delivery.orderId}`,
        `Offre : ${delivery.offerId}`,
        `Livraison : ${delivery.deliveryId}`,
        `Référence fournisseur : ${delivery.supplierOrderRef ?? "aucune"}`,
        `Tentatives : ${attempts ?? delivery.deliveryAttempts}`,
        `Dernière erreur : ${reason}`,
        "Action : vérifier d'abord la commande et tout achat éventuel ; traiter ou rembourser manuellement. Ne pas racheter sans rapprochement.",
      ]
        .filter((line): line is string => Boolean(line))
        .join("\n"),
    );
    if (!notification.ok) console.warn("[g2g][delivery] alerte Telegram refusée ; vérifier les livraisons en échec.");
  } catch (error) {
    console.warn(
      "[g2g][delivery] alerte Telegram impossible :",
      error instanceof Error ? error.message : String(error),
    );
  }
}

/** Statistiques de la file de livraison G2G (diagnostic admin). */
export async function g2gDeliveryStats(): Promise<{
  purchased: number;
  delivered: number;
  failed: number;
}> {
  await ensureSchema();
  const rows = await db
    .select({
      status: g2gDeliveries.status,
      count: sql<number>`count(*)::int`,
    })
    .from(g2gDeliveries)
    .groupBy(g2gDeliveries.status);
  const pick = (status: string) =>
    Number(rows.find((row) => row.status === status)?.count ?? 0);
  return {
    purchased: pick("purchased"),
    delivered: pick("delivered"),
    failed: pick("failed"),
  };
}