/**
 * File de livraison G2G : le raccordement du pilote unique (`G1795521210943KM`)
 * est préparé derrière un triple verrou (`automaticDeliveryVerified() === false`,
 * `G2G_AUTO_DELIVERY === "1"` et `G2G_PILOT_OFFER_ID === "G1795521210943KM"`).
 * Tant que ces trois verrous ne sont pas explicitement levés après validation,
 * aucun code fournisseur n'est lu ni transmis et toute commande passe en revue
 * manuelle. Aucun code produit n'est jamais journalisé ni stocké.
 */

import { and, eq, inArray, lte, or, sql } from "drizzle-orm";

import { db, ensureSchema, pool } from "@/db";
import { g2gDeliveries, type G2gDelivery } from "@/db/schema";
import { fazercardsOrder } from "@/lib/fazercards";
import { g2gDeliverCodes, g2gGetDeliveryStatus } from "@/lib/g2g";
import {
  readDispatchIntent,
  reserveDispatchIntentCommitted,
  transitionDispatchIntentState,
  type SqlRow,
} from "@/lib/g2g-dispatch-intent";
import { g2gAutoDeliveryEnabled } from "@/lib/g2g-fulfilment-core";
import {
  PILOT_CANDIDATE_OFFER_ID,
  automaticDeliveryVerified,
  isRetiredG2gOffer,
  isSyntheticDelivery,
  pilotOfferId,
} from "@/lib/g2g-pilot";
import { runPilotDeliveryAttempt } from "@/lib/g2g-pilot-delivery-orchestrator";
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
  | { kind: "awaiting_confirmation"; reason: string }
  | { kind: "no_order_ref" }
  | { kind: "manual_review"; reason: string }
  | { kind: "failed"; reason: string };

/** Marge de sécurité (5 s) soustraite à l'échéance G2G avant tout envoi réel. */
const G2G_DISPATCH_SAFETY_BUFFER_MS = 5_000;

const poolExecutor = {
  async query(queryText: string, params: unknown[]): Promise<{ rows: SqlRow[] }> {
    const res = await pool.query(queryText, params);
    return { rows: res.rows as SqlRow[] };
  },
};

async function readDeliveryExpiresAt(deliveryRowId: number): Promise<Date | null> {
  const res = await pool.query<{ expires_at: Date | string | null }>(
    "SELECT expires_at FROM g2g_deliveries WHERE id = $1",
    [deliveryRowId],
  );
  const raw = res.rows[0]?.expires_at;
  if (!raw) return null;
  const date = raw instanceof Date ? raw : new Date(raw);
  return Number.isFinite(date.getTime()) ? date : null;
}

/** Délai avant la prochaine tentative, avec backoff borné. */
function nextDeliveryDelayMs(attempts: number): number {
  const raw = G2G_DELIVERY_BASE_DELAY_MS * Math.pow(2, attempts - 1);
  return Math.min(raw, G2G_DELIVERY_MAX_DELAY_MS);
}

/**
 * Évalue et exécute (uniquement si tous les garde-fous sont ouverts) une
 * livraison du pilote unique :
 * 1. `automaticDeliveryVerified()` reste `false` jusqu'à validation complète ;
 * 2. `G2G_AUTO_DELIVERY` doit valoir exactement `"1"` ;
 * 3. seule l'offre pilote `G1795521210943KM` en quantité `1` est autorisée.
 */
export async function attemptG2gDelivery(
  delivery: G2gDelivery,
): Promise<G2gDeliveryResult> {
  const supplierOrderRef = delivery.supplierOrderRef;
  if (!supplierOrderRef) {
    return { kind: "no_order_ref" };
  }

  // Verrou 1 (code) : bloque tout accès à g2g_dispatch_intents, FazerCards et G2G
  // tant que la migration et le pilote n'ont pas été validés et approuvés.
  if (!automaticDeliveryVerified()) {
    return {
      kind: "manual_review",
      reason: "Livraison automatique verrouillée (automaticDeliveryVerified = false) : intervention manuelle requise.",
    };
  }

  // Verrou 2 (coupe-circuit d'environnement).
  if (!g2gAutoDeliveryEnabled(process.env.G2G_AUTO_DELIVERY)) {
    return {
      kind: "manual_review",
      reason: "Coupe-circuit G2G_AUTO_DELIVERY désarmé : intervention manuelle requise.",
    };
  }

  // Verrou 3 (offre pilote unique G1795521210943KM, hors offres retirées et tests synthétiques).
  const configuredPilot = pilotOfferId(process.env.G2G_PILOT_OFFER_ID);
  const normalizedOffer = (delivery.offerId ?? "").trim().toUpperCase();
  if (
    configuredPilot !== PILOT_CANDIDATE_OFFER_ID ||
    isRetiredG2gOffer(normalizedOffer) ||
    normalizedOffer !== PILOT_CANDIDATE_OFFER_ID ||
    delivery.requestedQty !== 1 ||
    isSyntheticDelivery(delivery.deliveryId, delivery.orderId)
  ) {
    return {
      kind: "manual_review",
      reason: "Commande hors périmètre strict du pilote unique : intervention manuelle requise.",
    };
  }

  let expiresAt: Date | null = delivery.expiresAt instanceof Date ? delivery.expiresAt : null;
  if (!expiresAt) {
    try {
      expiresAt = await readDeliveryExpiresAt(delivery.id);
    } catch {
      return {
        kind: "manual_review",
        reason: "Lecture de l'échéance G2G impossible (migration non appliquée ou base indisponible).",
      };
    }
  }

  return runPilotDeliveryAttempt(
    {
      orderId: delivery.orderId,
      deliveryId: delivery.deliveryId,
      offerId: normalizedOffer,
      requestedQty: delivery.requestedQty,
      supplierOrderRef,
      expiresAt,
    },
    {
      now: () => Date.now(),
      readDispatchIntent: (expected) => readDispatchIntent(poolExecutor, expected),
      reserveDispatchIntent: async (reserveInput) => {
        const client = await pool.connect();
        let destroyConnection = false;
        try {
          const outcome = await reserveDispatchIntentCommitted(
            {
              async query(queryText: string, params: unknown[]) {
                const r = await client.query(queryText, params);
                return { rows: r.rows as SqlRow[] };
              },
            },
            reserveInput,
          );
          if (outcome.status === "uncertain") destroyConnection = true;
          return outcome;
        } catch {
          destroyConnection = true;
          return { status: "uncertain" };
        } finally {
          client.release(destroyConnection);
        }
      },
      transitionDispatchIntent: (transitionInput) =>
        transitionDispatchIntentState(poolExecutor, transitionInput),
      getDeliveryStatus: (orderId, deliveryId) =>
        g2gGetDeliveryStatus(orderId, deliveryId),
      getSupplierOrder: (supplierOrderId) => fazercardsOrder(supplierOrderId),
      deliverCodes: (deliverInput) => g2gDeliverCodes(deliverInput),
    },
    { safetyBufferMs: G2G_DISPATCH_SAFETY_BUFFER_MS },
  );
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

      case "awaiting_confirmation": {
        if (attempts >= G2G_DELIVERY_MAX_ATTEMPTS) {
          const escalationNote = `${result.reason} — Vérifier d'abord le statut sur G2G avant toute action manuelle (aucune réémission effectuée).`;
          await db
            .update(g2gDeliveries)
            .set({
              status: "failed",
              deliveryAttempts: attempts,
              nextAttemptAt: null,
              deliveryClaimedAt: null,
              detail: escalationNote,
              updatedAt: new Date(),
            })
            .where(owned);
          await escalateDelivery(delivery, escalationNote, attempts);
          results.push({
            deliveryId: delivery.deliveryId,
            kind: "failed",
            attempts,
            reason: escalationNote,
          });
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
            detail: `Confirmation G2G en attente (tentative ${attempts}, sans réémission) : ${result.reason}`,
            updatedAt: new Date(),
          })
          .where(owned);
        results.push({
          deliveryId: delivery.deliveryId,
          kind: "awaiting_confirmation",
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