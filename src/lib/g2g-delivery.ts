/**
 * File de livraison G2G (phase 2, brique 2).
 *
 * Après l'achat juste-à-temps (brique 1), une ligne `g2g_deliveries` se
 * trouve en statut `purchased` avec une `supplier_order_ref`. Cette brique
 * :
 *
 *   1. Sonde la commande chez FazerCards jusqu'à ce que les codes soient
 *      disponibles ;
 *   2. Livre chaque code à G2G via `POST /v2/orders/{id}/delivery` ;
 *   3. Marque la livraison `delivered` ou reprogramme une tentative avec
 *      backoff exponentiel ;
 *   4. Escalade vers l'humain (Telegram) après épuisement des tentatives.
 *
 * Aucun code produit n'est jamais journalisé ni stocké en clair : seuls les
 * noms de clés du payload fournisseur sont consignés, pour diagnostic.
 */

import { and, eq, inArray, lte, or, sql } from "drizzle-orm";

import { db, ensureSchema } from "@/db";
import { g2gDeliveries, type G2gDelivery } from "@/db/schema";
import { fazercardsOrder } from "@/lib/fazercards";
import { g2gDeliverCodes } from "@/lib/g2g";
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
  | { kind: "failed"; reason: string };

/**
 * Extrait les codes cadeaux d'une réponse FazerCards.
 *
 * La structure exacte de `payload` n'est pas documentée de façon fiable, donc
 * on explore l'objet de façon défensive : toute valeur chaîne qui ressemble
 * à un code cadeau (alphanumérique majuscule, 8–32 caractères) est candidate.
 *
 * ⚠️ Jamais de valeur de code dans les journaux : seuls les chemins de clés
 * sont consignés, pour diagnostic.
 */
function extractCodesFromPayload(
  payload: unknown,
): { content: string; reference_id: string }[] {
  const codes: { content: string; reference_id: string }[] = [];
  const seen = new Set<string>();
  const keyLog: string[] = [];

  function walk(value: unknown, path: string): void {
    if (typeof value === "string") {
      keyLog.push(path);
      if (/^[A-Z0-9]{8,32}$/.test(value) && !seen.has(value)) {
        seen.add(value);
        codes.push({ content: value, reference_id: `payload:${path}` });
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((v, i) => walk(v, `${path}[${i}]`));
      return;
    }
    if (value && typeof value === "object") {
      for (const [key, val] of Object.entries(
        value as Record<string, unknown>,
      )) {
        walk(val, `${path}.${key}`);
      }
    }
  }

  walk(payload, "root");
  console.info(
    `[g2g][delivery] clés du payload scannées: ${keyLog.join(", ") || "(aucune)"}`,
  );
  return codes;
}

/** Délai avant la prochaine tentative, avec backoff borné. */
function nextDeliveryDelayMs(attempts: number): number {
  const raw = G2G_DELIVERY_BASE_DELAY_MS * Math.pow(2, attempts - 1);
  return Math.min(raw, G2G_DELIVERY_MAX_DELAY_MS);
}

/**
 * Tente de livrer une commande déjà achetée (statut `purchased` ou
 * `purchasing`). Fonction pure : aucune écriture en base.
 *
 * Le statut `purchasing` signifie qu'un achat a pu partir mais que le
 * processus est mort avant de confirmer : on sonde tout de même le
 * fournisseur au cas où la commande existe déjà.
 */
export async function attemptG2gDelivery(
  delivery: G2gDelivery,
): Promise<G2gDeliveryResult> {
  const supplierOrderRef = delivery.supplierOrderRef;
  if (!supplierOrderRef) {
    return { kind: "no_order_ref" };
  }

  // Sonde le fournisseur pour voir si les codes sont disponibles.
  let orderPayload: Record<string, unknown> | undefined;
  try {
    const detail = await fazercardsOrder(supplierOrderRef);
    orderPayload = detail.order?.payload as
      | Record<string, unknown>
      | undefined;
  } catch (error) {
    return {
      kind: "awaiting_codes",
      reason: `Fournisseur illisible : ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const codes = orderPayload
    ? extractCodesFromPayload(orderPayload)
    : [];

  if (codes.length === 0) {
    return {
      kind: "awaiting_codes",
      reason: `Aucun code trouvé dans le détail de la commande ${supplierOrderRef}.`,
    };
  }

  // Livre chaque code à G2G.
  try {
    await g2gDeliverCodes({
      orderId: delivery.orderId,
      deliveryId: delivery.deliveryId,
      codes: codes.map((c, i) => ({
        content: c.content,
        // reference_id stable : commande fournisseur + rang du code.
        reference_id: `${supplierOrderRef}:${i + 1}`,
      })),
    });
    return { kind: "delivered", codes: codes.length };
  } catch (error) {
    return {
      kind: "failed",
      reason: `Échec de livraison chez G2G : ${error instanceof Error ? error.message : String(error)}`,
    };
  }
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

  // Réclame atomiquement les livraisons dues.
  const due = await db
    .select()
    .from(g2gDeliveries)
    .where(
      and(
        sql`${g2gDeliveries.deliveryAttempts} < ${G2G_DELIVERY_MAX_ATTEMPTS}`,
        sql`${g2gDeliveries.nextAttemptAt} IS NOT NULL AND ${g2gDeliveries.nextAttemptAt} <= now()`,
        or(
          inArray(g2gDeliveries.status, ["purchasing", "purchased", "failed"]),
          and(
            eq(g2gDeliveries.status, "delivery_processing"),
            lte(g2gDeliveries.deliveryClaimedAt, leaseFloor),
          ),
        ),
      ),
    )
    .orderBy(sql`${g2gDeliveries.nextAttemptAt} ASC`, sql`${g2gDeliveries.createdAt} ASC`)
    .limit(limit);

  if (due.length === 0) return { claimed: 0, results: [] };

  const ids = due.map((row) => row.id);

  // Prise de possession : marque `delivery_processing` + bail. Deux crons
  // concurrents ne peuvent pas traiter la même livraison.
  await db
    .update(g2gDeliveries)
    .set({
      status: "delivery_processing",
      deliveryClaimedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        inArray(g2gDeliveries.id, ids),
        or(
          inArray(g2gDeliveries.status, ["purchasing", "purchased", "failed"]),
          and(
            eq(g2gDeliveries.status, "delivery_processing"),
            lte(g2gDeliveries.deliveryClaimedAt, leaseFloor),
          ),
        ),
      ),
    );

  const results: {
    deliveryId: string;
    kind: string;
    attempts: number;
    reason?: string;
  }[] = [];

  for (const delivery of due) {
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
          .where(eq(g2gDeliveries.deliveryId, delivery.deliveryId));
        results.push({
          deliveryId: delivery.deliveryId,
          kind: "delivered",
          attempts,
        });
        break;
      }

      case "awaiting_codes": {
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
          .where(eq(g2gDeliveries.deliveryId, delivery.deliveryId));
        results.push({
          deliveryId: delivery.deliveryId,
          kind: "awaiting_codes",
          attempts,
          reason: result.reason,
        });
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
              "Aucune référence fournisseur : achat à vérifier manuellement.",
            updatedAt: new Date(),
          })
          .where(eq(g2gDeliveries.deliveryId, delivery.deliveryId));
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
            .where(eq(g2gDeliveries.deliveryId, delivery.deliveryId));
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
            .where(eq(g2gDeliveries.deliveryId, delivery.deliveryId));
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

  return { claimed: due.length, results };
}

/** Alerte Telegram pour une livraison en échec définitif. */
async function escalateDelivery(
  delivery: G2gDelivery,
  reason: string,
  attempts?: number,
): Promise<void> {
  try {
    await notifyTelegramAdmin(
      [
        "🚨 G2G — LIVRAISON EN ÉCHEC DÉFINITIF",
        `Commande : ${delivery.orderId}`,
        `Offre : ${delivery.offerId}`,
        `Livraison : ${delivery.deliveryId}`,
        `Référence fournisseur : ${delivery.supplierOrderRef ?? "aucune"}`,
        `Tentatives : ${attempts ?? delivery.deliveryAttempts}`,
        `Dernière erreur : ${reason}`,
        "Action : livrer le code manuellement à l'acheteur ou rembourser.",
      ]
        .filter((line): line is string => Boolean(line))
        .join("\n"),
    );
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