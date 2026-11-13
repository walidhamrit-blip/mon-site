/**
 * File de livraison persistante (Neon) : enqueue, réclamation atomique,
 * retries programmés, statuts granulaires, idempotence webhook et alerte
 * Telegram.
 *
 * ── Pourquoi une file en base plutôt qu'un service externe ──
 * Le site tourne sur Vercel (serverless) : une promesse lancée après la
 * réponse n'est pas garantie, et un service de file (QStash, SQS…)
 * ajouterait un compte, un secret et une panne de plus. Neon est déjà la
 * source de vérité des commandes — la file vit donc dans la même
 * transaction logique que la commande :
 *
 *   IPN NOWPayments (signature vérifiée)
 *     ├─ journal d'idempotence `webhook_events` (event_key UNIQUE)
 *     ├─ `orders.status = paid` (update conditionnel anti-concurrence)
 *     ├─ `digital_orders.fulfillment_status = paid_fulfilling`
 *     ├─ job `delivery_jobs` (order_ref + idempotency_key UNIQUES)
 *     └─ tentative immédiate ; échec → retry programmé + alerte Telegram
 *
 * ── Garanties ──
 *  - **Un seul achat par commande** : `delivery_jobs.idempotency_key` et
 *    `digital_orders.idempotency_key` sont UNIQUE, et la réclamation d'un
 *    job se fait par UPDATE conditionnel (aucun double traitement même
 *    avec deux workers simultanés).
 *  - **Aucun job perdu** : un job `processing` dont le bail (`claimed_at`)
 *    a expiré est réclamable à nouveau.
 *  - **Backoff borné** : 60 s → 30 min, ±20 % de jitter (voir
 *    `deliveryRetryDelayMs`).
 *  - **Escalade humaine** : après `max_attempts` ou un échec permanent,
 *    job `dead_letter` + commande `manual_review` + alerte Telegram.
 *  - **Aucune dépendance à Telegram** : une panne du bot n'empêche
 *    jamais une livraison (les envois sont « au mieux »).
 */

import { and, asc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import {
  deliveryJobs,
  digitalOrders,
  webhookEvents,
  type DeliveryJob,
  type DigitalOrder,
} from "@/db/schema";
import {
  DELIVERY_MAX_ATTEMPTS,
  JOB_CLAIM_LEASE_MS,
  classifyDeliveryError,
  deliveryIdempotencyKey,
  deliveryOutcomeSignal,
  legacyStatusFromFulfillment,
  nextFulfillmentStatus,
  nextDeliveryRetryAt,
  webhookEventKey,
  type DeliveryErrorClass,
  type FulfillmentEvent,
  type FulfillmentStatus,
} from "@/lib/delivery-queue-core";
import {
  notifyTelegramDeliveryFailure,
  telegramConfigured,
} from "@/lib/telegram";
import { getSiteData } from "@/lib/store";

/* ------------------------------ Utilitaires ------------------------------ */

function randomToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Empreinte SHA-256 d'un corps de webhook (jamais le corps lui-même). */
export async function payloadHash(body: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

/**
 * Motif expurgé : un message fournisseur peut contenir un code, un jeton ou
 * un e-mail. On ne garde que 300 caractères et on masque les longues
 * chaînes alphanumériques (format typique d'une clé).
 */
export function redactDeliveryReason(reason: string): string {
  return reason
    .replace(/\b[A-Z0-9]{4}(?:-[A-Z0-9]{4}){2,}\b/g, "<code masqué>")
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "<chaîne masquée>")
    .slice(0, 300);
}

/* ----------------------- Statuts granulaires (écriture) ------------------- */

/**
 * Applique un événement de fulfillment à une commande : met à jour le
 * statut granulaire `fulfillment_status` ET le statut historique `status`
 * (les deux colonnes restent cohérentes — le reste du code lit `status`).
 *
 * `delivered` est terminal : l'appel est sans effet sur une commande déjà
 * livrée, même si l'appelant se trompe d'événement.
 */
export async function applyFulfillmentEvent(
  orderId: number,
  event: FulfillmentEvent,
  options: { reason?: string | null } = {},
): Promise<FulfillmentStatus> {
  await ensureSchema();
  const [row] = await db
    .select({
      status: digitalOrders.status,
      fulfillmentStatus: digitalOrders.fulfillmentStatus,
    })
    .from(digitalOrders)
    .where(eq(digitalOrders.id, orderId))
    .limit(1);

  if (!row) return "pending_payment";

  const current = nextFulfillmentStatus(
    row.fulfillmentStatus ?? legacyStatusFromFulfillment(row.status),
    event,
  );

  // Colonne historique (`status`) : on ne RÉGRESSE jamais. Un `delivered`
  // déjà posé le reste ; un `manual` existant n'est pas écrasé par un simple
  // redémarrage de livraison (sinon l'admin perdrait sa file humaine).
  const legacy =
    row.status === "delivered" || current === "delivered"
      ? "delivered"
      : current === "paid_fulfilling" && row.status === "pending"
        ? "paid"
        : current === "manual_review" && row.status !== "delivered"
          ? "manual"
          : null;

  await db
    .update(digitalOrders)
    .set({
      fulfillmentStatus: current,
      ...(legacy ? { status: legacy as "delivered" | "paid" | "manual" } : {}),
      ...(options.reason !== undefined && options.reason !== null
        ? { lastError: options.reason.slice(0, 800) }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(digitalOrders.id, orderId));

  return current;
}

/* ------------------------------- Enqueue --------------------------------- */

export interface EnqueueResult {
  /** Vrai si le job a été créé par CET appel (faux = déjà en file). */
  created: boolean;
  job: DeliveryJob | null;
}

/**
 * Met une commande payée en file de livraison.
 *
 * Idempotent par construction : `order_ref` et `idempotency_key` sont
 * UNIQUE et l'insertion utilise `ON CONFLICT DO NOTHING`. Un double IPN,
 * un cron et un clic admin peuvent appeler cette fonction en parallèle :
 * il n'en résulte qu'un seul job.
 *
 * Le statut granulaire passe à `paid_fulfilling` ici : dès que l'argent
 * est confirmé, la commande est « payée, livraison en cours », jamais
 * « bloquée ».
 */
export async function enqueueDelivery(
  target: { id?: number | null; ref?: string | null },
  options: { supplier?: "fazercards" | "reloadly"; maxAttempts?: number } = {},
): Promise<EnqueueResult> {
  await ensureSchema();

  // La ligne en base est la source de vérité (le slug produit décide du
  // fournisseur) : on ne fait jamais confiance aux champs passés en
  // argument, souvent incomplets au moment de l'IPN.
  const [row] = await db
    .select()
    .from(digitalOrders)
    .where(
      target.id
        ? eq(digitalOrders.id, target.id)
        : eq(digitalOrders.ref, deliveryIdempotencyKey(target.ref ?? "")),
    )
    .limit(1);

  if (!row) return { created: false, job: null };

  const order = row;
  const signal = deliveryOutcomeSignal(
    {
      status: "paid",
      productSlug: order.productSlug,
      productId: order.productId,
    },
    options.maxAttempts ?? DELIVERY_MAX_ATTEMPTS,
  );
  const supplier = options.supplier ?? signal.supplier;
  const key = deliveryIdempotencyKey(order.ref);

  await db
    .update(digitalOrders)
    .set({
      supplier,
      idempotencyKey: key,
      fulfillmentStatus: "paid_fulfilling",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(digitalOrders.id, order.id),
        // Ne jamais « réveiller » une commande déjà livrée.
        sql`${digitalOrders.status} <> 'delivered'`,
      ),
    );

  const inserted = await db
    .insert(deliveryJobs)
    .values({
      orderRef: key,
      digitalOrderId: order.id,
      supplier,
      idempotencyKey: key,
      status: "queued",
      attempts: 0,
      maxAttempts: options.maxAttempts ?? DELIVERY_MAX_ATTEMPTS,
      nextRetryAt: new Date(),
    })
    .onConflictDoNothing({ target: deliveryJobs.idempotencyKey })
    .returning();

  if (inserted[0]) return { created: true, job: inserted[0] };

  const [existing] = await db
    .select()
    .from(deliveryJobs)
    .where(eq(deliveryJobs.idempotencyKey, key))
    .limit(1);
  return { created: false, job: existing ?? null };
}

/* ------------------------------- Réclamation ------------------------------ */

/**
 * Réclame atomiquement les jobs dus.
 *
 * L'UPDATE conditionnel sur `status`/`claimed_at` fait office de verrou :
 * deux workers concurrents ne peuvent pas réclamer le même job. Un job
 * `processing` dont le bail a expiré (worker tué par la limite de temps
 * Vercel) est repris ici.
 */
export async function claimDueDeliveryJobs(limit = 5): Promise<DeliveryJob[]> {
  await ensureSchema();
  const now = new Date();
  const token = randomToken();
  const leaseFloor = new Date(now.getTime() - JOB_CLAIM_LEASE_MS);

  const due = await db
    .select({ id: deliveryJobs.id })
    .from(deliveryJobs)
    .where(
      or(
        and(
          eq(deliveryJobs.status, "queued"),
          or(isNull(deliveryJobs.nextRetryAt), lte(deliveryJobs.nextRetryAt, now)),
        ),
        and(
          eq(deliveryJobs.status, "processing"),
          or(isNull(deliveryJobs.claimedAt), lte(deliveryJobs.claimedAt, leaseFloor)),
        ),
      ),
    )
    .orderBy(asc(deliveryJobs.nextRetryAt), asc(deliveryJobs.createdAt))
    .limit(limit);

  if (due.length === 0) return [];
  const ids = due.map((row) => row.id);

  const claimed = await db
    .update(deliveryJobs)
    .set({
      status: "processing",
      claimedAt: now,
      claimToken: token,
      updatedAt: now,
    })
    .where(
      and(
        inArray(deliveryJobs.id, ids),
        or(
          eq(deliveryJobs.status, "queued"),
          and(
            eq(deliveryJobs.status, "processing"),
            or(isNull(deliveryJobs.claimedAt), lte(deliveryJobs.claimedAt, leaseFloor)),
          ),
        ),
      ),
    )
    .returning();

  return claimed;
}

/* ------------------------------- Résolution ------------------------------ */

export interface DeliveryRunResult {
  ref: string;
  /** Issue de la tentative (ou de la décision sans tentative). */
  kind: "delivered" | "retry_scheduled" | "awaiting" | "manual_review" | "skipped" | "error";
  attempts: number;
  reason?: string;
}

/**
 * Traite un job : tente la livraison fournisseur, puis enregistre le
 * résultat (job terminé, retry programmé, ou revue manuelle + alerte
 * Telegram).
 *
 * Le module de livraison est importé **dynamiquement** : `digital-orders.ts`
 * importe la file (pour mettre en file au moment du paiement), donc un
 * import statique créerait un cycle. L'import paresseux le casse.
 */
export async function processDeliveryJob(job: DeliveryJob): Promise<DeliveryRunResult> {
  await ensureSchema();
  const now = new Date();

  const [order] = await db
    .select()
    .from(digitalOrders)
    .where(eq(digitalOrders.ref, job.orderRef))
    .limit(1);

  if (!order) {
    await finishJob(job.id, "failed", "Commande introuvable.");
    return { ref: job.orderRef, kind: "error", attempts: job.attempts, reason: "Commande introuvable." };
  }

  // Le statut fait foi : une commande livrée entre-temps (admin, autre
  // worker) rend le job obsolète.
  const signal = deliveryOutcomeSignal(order, job.maxAttempts);
  if (signal.kind === "done") {
    await finishJob(job.id, "done", null);
    // Ne marquer « livrée » que si elle l'est vraiment : une commande non
    // payée clôt aussi son job (« done »), sans jamais devenir `delivered`.
    if (order.status === "delivered" || order.deliveredAt) {
      await applyFulfillmentEvent(order.id, "delivery_succeeded");
      return { ref: job.orderRef, kind: "delivered", attempts: job.attempts };
    }
    return {
      ref: job.orderRef,
      kind: "skipped",
      attempts: job.attempts,
      reason: signal.reason,
    };
  }
  if (signal.kind === "manual") {
    await escalateJob(job, order, signal.reason, "permanent");
    return {
      ref: job.orderRef,
      kind: "manual_review",
      attempts: job.attempts,
      reason: signal.reason,
    };
  }

  const attempts = job.attempts + 1;
  let outcome: DeliveryRunResult["kind"] = "retry_scheduled";
  let reason: string | undefined;
  let errorClass: DeliveryErrorClass = "transient";

  try {
    const { deliverPaidDigitalOrder } = await import("@/lib/digital-orders");
    const result = await deliverPaidDigitalOrder(order.id, { force: true });

    switch (result.outcome) {
      case "delivered":
      case "already_delivered":
        await finishJob(job.id, "done", null, attempts);
        await applyFulfillmentEvent(order.id, "delivery_succeeded");
        return { ref: job.orderRef, kind: "delivered", attempts };

      case "awaiting_codes": {
        // Le fournisseur travaille : relecture courte, sans consommer
        // tout le budget de retries (on plafonne à une tentative sur deux).
        const next = nextDeliveryRetryAt(1, Date.now());
        await scheduleRetry(job, attempts, next, result.message ?? "Fournisseur en cours.", "awaiting");
        await applyFulfillmentEvent(order.id, "delivery_awaiting");
        return { ref: job.orderRef, kind: "awaiting", attempts, reason: result.message };
      }

      case "manual":
        reason = result.message ?? "Livraison manuelle requise.";
        errorClass = result.errorClass ?? classifyDeliveryError({ message: reason });
        if (errorClass === "transient" && attempts < job.maxAttempts) {
          await scheduleRetry(job, attempts, nextDeliveryRetryAt(attempts), reason, "transient");
          await alertDeliveryFailure(order, job, attempts, reason, "transient");
          outcome = "retry_scheduled";
        } else {
          await escalateJob(job, order, reason, errorClass, attempts);
          outcome = "manual_review";
        }
        break;

      case "not_paid":
        // Paiement non confirmé : pas une erreur fournisseur, on remet la
        // commande en attente de paiement et on clôt le job.
        await finishJob(job.id, "failed", "Paiement non confirmé.", attempts);
        return {
          ref: job.orderRef,
          kind: "skipped",
          attempts,
          reason: "Paiement non confirmé.",
        };

      case "not_found":
        await finishJob(job.id, "failed", "Commande introuvable.", attempts);
        return { ref: job.orderRef, kind: "error", attempts, reason: "Commande introuvable." };

      default:
        reason = result.message ?? "Échec fournisseur.";
        if (attempts < job.maxAttempts) {
          await scheduleRetry(job, attempts, nextDeliveryRetryAt(attempts), reason, "transient");
          await alertDeliveryFailure(order, job, attempts, reason, "transient");
          outcome = "retry_scheduled";
        } else {
          await escalateJob(job, order, reason, "exhausted", attempts);
          outcome = "manual_review";
        }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    reason = redactDeliveryReason(`Exception de livraison : ${message}`);
    if (attempts < job.maxAttempts) {
      await scheduleRetry(job, attempts, nextDeliveryRetryAt(attempts), reason, "transient");
      await alertDeliveryFailure(order, job, attempts, reason, "transient");
      outcome = "retry_scheduled";
    } else {
      await escalateJob(job, order, reason, "exhausted", attempts);
      outcome = "manual_review";
    }
  }

  return { ref: job.orderRef, kind: outcome, attempts, ...(reason ? { reason } : {}) };
}

/* ------------------------- Écritures d'état des jobs ---------------------- */

async function finishJob(
  id: number,
  status: "done" | "failed",
  reason: string | null,
  attempts?: number,
): Promise<void> {
  const now = new Date();
  await db
    .update(deliveryJobs)
    .set({
      status,
      lastError: reason ? redactDeliveryReason(reason) : null,
      nextRetryAt: null,
      claimToken: null,
      completedAt: now,
      updatedAt: now,
      ...(attempts !== undefined ? { attempts } : {}),
    })
    .where(eq(deliveryJobs.id, id));
}

async function scheduleRetry(
  job: DeliveryJob,
  attempts: number,
  nextRetryAt: Date,
  reason: string,
  kind: "transient" | "awaiting",
): Promise<void> {
  const now = new Date();
  await db
    .update(deliveryJobs)
    .set({
      status: "queued",
      attempts,
      nextRetryAt,
      lastError: redactDeliveryReason(reason),
      claimedAt: null,
      claimToken: null,
      updatedAt: now,
    })
    .where(eq(deliveryJobs.id, job.id));

  await db
    .update(digitalOrders)
    .set({
      attempts,
      lastError: redactDeliveryReason(reason),
      nextRetryAt,
      fulfillmentStatus: "paid_fulfilling",
      updatedAt: now,
    })
    .where(eq(digitalOrders.ref, job.orderRef));

  void kind;
}

/**
 * Escalade humaine : job en `dead_letter`, commande en `manual_review`,
 * alerte Telegram immédiate, plus l'e-mail agence existant (envoyé par
 * `flagManual` dans le module de livraison).
 */
async function escalateJob(
  job: DeliveryJob,
  order: DigitalOrder,
  reason: string,
  kind: DeliveryErrorClass | "exhausted",
  attempts: number = job.attempts,
): Promise<void> {
  const now = new Date();
  await db
    .update(deliveryJobs)
    .set({
      status: "dead_letter",
      attempts,
      lastError: redactDeliveryReason(reason),
      nextRetryAt: null,
      claimToken: null,
      completedAt: now,
      updatedAt: now,
    })
    .where(eq(deliveryJobs.id, job.id));

  await applyFulfillmentEvent(order.id, "delivery_failed_permanent", { reason });
  await db
    .update(digitalOrders)
    .set({
      attempts,
      lastError: redactDeliveryReason(reason),
      nextRetryAt: null,
      updatedAt: now,
    })
    .where(eq(digitalOrders.ref, job.orderRef));

  await alertDeliveryFailure(order, job, attempts, reason, kind === "exhausted" ? "exhausted" : "permanent", true);
}

/**
 * Escalade directe en revue manuelle (utilisée par la reprise historique
 * quand la commande est trop vieille ou a épuisé son délai : plus aucune
 * tentative automatique n'est permise, mais l'équipe doit être prévenue
 * immédiatement — pas au prochain passage du cron).
 */
export async function escalateOrderToManualReview(
  ref: string,
  reason: string,
): Promise<void> {
  await ensureSchema();
  const [order] = await db
    .select()
    .from(digitalOrders)
    .where(eq(digitalOrders.ref, deliveryIdempotencyKey(ref)))
    .limit(1);
  if (!order || order.status === "delivered") return;

  await applyFulfillmentEvent(order.id, "delivery_failed_permanent", { reason });
  await db
    .update(digitalOrders)
    .set({
      status: "manual",
      fulfillmentStatus: "manual_review",
      nextRetryAt: null,
      lastError: redactDeliveryReason(reason),
      updatedAt: new Date(),
    })
    .where(eq(digitalOrders.id, order.id));

  await alertDeliveryFailure(
    order,
    {
      id: 0,
      orderRef: order.ref,
      digitalOrderId: order.id,
      supplier: order.supplier ?? "fazercards",
      idempotencyKey: order.ref,
      status: "dead_letter",
      attempts: order.attempts,
      maxAttempts: DELIVERY_MAX_ATTEMPTS,
      nextRetryAt: null,
      lastError: reason,
      claimedAt: null,
      claimToken: null,
      completedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    order.attempts,
    reason,
    "exhausted",
    true,
  );
}

/* ------------------------------ Alerte Telegram --------------------------- */

/**
 * Alerte Telegram « livraison fournisseur en échec ».
 *
 * Anti-spam : la même commande n'alerte qu'une fois par fenêtre de 15 min
 * (sauf escalade finale, toujours annoncée). `telegram_alerted_at` est
 * mémorisé en base : le limiteur survit aux redémarrages serverless.
 */
async function alertDeliveryFailure(
  order: DigitalOrder,
  job: DeliveryJob,
  attempts: number,
  reason: string,
  kind: "transient" | "permanent" | "exhausted",
  force = false,
): Promise<void> {
  try {
    const now = Date.now();

    // Le perdre sans prévenir serait le pire des cas : on alerte dès que
    // Telegram est configuré, même si la commande a été téléchargée depuis
    // la base par un chemin qui ne connaît pas `telegram_alerted_at`.
    if (!telegramConfigured()) return;

    const last = order.telegramAlertedAt ? new Date(order.telegramAlertedAt).getTime() : 0;
    if (!force && last && now - last < 15 * 60_000) return;

    const { config } = await getSiteData();
    await notifyTelegramDeliveryFailure(
      {
        ref: order.ref,
        productTitle: order.productTitle,
        supplier: job.supplier,
        totalUsd: order.totalUsd,
        recipientEmail: order.recipientEmail || null,
        attempts,
        maxAttempts: job.maxAttempts,
        reason: redactDeliveryReason(reason),
        kind,
      },
      config.name,
      config.url,
    );

    await db
      .update(digitalOrders)
      .set({ telegramAlertedAt: new Date() })
      .where(eq(digitalOrders.ref, order.ref));
  } catch (error) {
    console.warn(
      "[delivery][file] alerte Telegram non envoyée :",
      error instanceof Error ? error.message : error,
    );
  }
}

/* --------------------------- Boucle de traitement ------------------------- */

/**
 * Traite jusqu'à `limit` jobs dus. Utilisé par le cron et le suivi client.
 * `dryRun` ne réclame rien et ne livrer rien : diagnostic seulement.
 */
/**
 * Taille de lot par défaut : `DELIVERY_QUEUE_BATCH` (1–10) quand la variable
 * est définie, sinon 5. Un lot trop gros dépasse la durée d'une fonction
 * serverless (chaque job pouvant appeler le fournisseur).
 */
export function deliveryQueueBatchSize(): number {
  const raw = Number(process.env.DELIVERY_QUEUE_BATCH ?? "");
  const value = Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : 5;
  return Math.min(10, Math.max(1, value));
}

export async function runDeliveryQueue(
  options: { limit?: number; dryRun?: boolean } = {},
): Promise<{ claimed: number; results: DeliveryRunResult[] }> {
  const limit = Math.min(10, Math.max(1, options.limit ?? deliveryQueueBatchSize()));

  if (options.dryRun) {
    const due = await claimDueDeliveryJobsForInspection(limit);
    return { claimed: due.length, results: due.map((job) => ({ ref: job.orderRef, kind: "skipped", attempts: job.attempts })) };
  }

  const jobs = await claimDueDeliveryJobs(limit);
  const results: DeliveryRunResult[] = [];
  for (const job of jobs) {
    try {
      results.push(await processDeliveryJob(job));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[delivery][file] job en échec :", job.orderRef, message);
      results.push({ ref: job.orderRef, kind: "error", attempts: job.attempts, reason: message });
    }
  }
  return { claimed: jobs.length, results };
}

/** Lecture seule des jobs dus (diagnostic `?dry=1`). */
async function claimDueDeliveryJobsForInspection(limit: number): Promise<DeliveryJob[]> {
  await ensureSchema();
  const now = new Date();
  const leaseFloor = new Date(now.getTime() - JOB_CLAIM_LEASE_MS);
  return db
    .select()
    .from(deliveryJobs)
    .where(
      or(
        and(
          eq(deliveryJobs.status, "queued"),
          or(isNull(deliveryJobs.nextRetryAt), lte(deliveryJobs.nextRetryAt, now)),
        ),
        and(
          eq(deliveryJobs.status, "processing"),
          or(isNull(deliveryJobs.claimedAt), lte(deliveryJobs.claimedAt, leaseFloor)),
        ),
      ),
    )
    .orderBy(asc(deliveryJobs.nextRetryAt), asc(deliveryJobs.createdAt))
    .limit(limit);
}

/* ------------------------------ Idempotence ------------------------------ */

/**
 * Réserve un événement de webhook. Renvoie `true` si c'est la PREMIÈRE
 * fois (l'appelant doit traiter), `false` si c'est un doublon (l'appelant
 * répond 200 sans rien faire).
 *
 * L'insertion s'appuie sur la contrainte UNIQUE de `event_key` : deux
 * IPN identiques reçus en parallèle ne peuvent pas tous deux « gagner ».
 */
export async function reserveWebhookEvent(input: {
  provider: string;
  eventId: string;
  status: string;
  rawBody?: string;
}): Promise<{ fresh: boolean; key: string }> {
  await ensureSchema();
  const key = webhookEventKey(input.provider, input.eventId, input.status);
  if (!key) return { fresh: true, key };

  const hash = input.rawBody ? await payloadHash(input.rawBody) : null;

  const inserted = await db
    .insert(webhookEvents)
    .values({
      provider: input.provider,
      eventKey: key,
      payloadHash: hash,
      eventStatus: input.status,
      outcome: "received",
    })
    .onConflictDoNothing({ target: webhookEvents.eventKey })
    .returning({ id: webhookEvents.id });

  return { fresh: inserted.length > 0, key };
}

/** Clôt un événement réservé (traçabilité : `processed`, `ignored`, `failed`). */
export async function settleWebhookEvent(
  key: string,
  outcome: "processed" | "ignored" | "failed",
): Promise<void> {
  if (!key) return;
  try {
    await db
      .update(webhookEvents)
      .set({ outcome, processedAt: new Date() })
      .where(eq(webhookEvents.eventKey, key));
  } catch (error) {
    console.warn(
      "[delivery][webhook] journal non mis à jour :",
      error instanceof Error ? error.message : error,
    );
  }
}

/**
 * Nombre de jobs en souffrance (diagnostic admin / `/api/health`).
 * `queued` en retard + `dead_letter` récentes.
 */
export async function deliveryQueueStats(): Promise<{
  queued: number;
  processing: number;
  deadLetter: number;
}> {
  await ensureSchema();
  const rows = await db
    .select({ status: deliveryJobs.status, count: sql<number>`count(*)::int` })
    .from(deliveryJobs)
    .groupBy(deliveryJobs.status);
  const pick = (status: string) =>
    Number(rows.find((row) => row.status === status)?.count ?? 0);
  return {
    queued: pick("queued"),
    processing: pick("processing"),
    deadLetter: pick("dead_letter"),
  };
}
