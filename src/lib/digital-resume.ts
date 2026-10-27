// Reprise automatique des commandes de codes bloquées — côté serveur.
//
// Une commande payée dont le webhook IPN s'est perdu reste en `pending`, et
// une commande dont le fournisseur répond « processing » puis se tait reste
// en `paid`. Sans client pour rouvrir sa page de suivi, elle n'avançait plus.
//
// Ce balayage, déclenché par un cron protégé (`/api/cron/digital-orders`),
// relance la livraison des commandes qui remplissent les conditions de
// `digital-resume-core.ts` :
//   - paiement confirmé (`orders.status = paid`) — jamais de reprise sinon ;
//   - statut `pending` ou `paid` ;
//   - dernière activité il y a plus de 15 minutes (laisse sa chance à l'IPN) ;
//   - moins de 6 tentatives et moins de 14 jours.
//
// La reprise réutilise `deliverPaidDigitalOrder` : aucune logique d'achat
// n'est dupliquée, l'Idempotency-Key par commande évite tout double débit
// chez le fournisseur. Une commande abandonnée passe en livraison manuelle
// (« À livrer manuellement » dans l'admin), jamais en silence.

import { and, asc, eq, inArray } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { digitalOrders, orders } from "@/db/schema";
import {
  decideDigitalResume,
  RESUME_MAX_ATTEMPTS,
  RESUME_MAX_AGE_MS,
  RESUME_MIN_AGE_MS,
  RESUME_STATUSES,
} from "@/lib/digital-resume-core";
import {
  deliverPaidDigitalOrder,
  digitalOrderSupplier,
  reloadlyEnvironmentMismatch,
} from "@/lib/digital-orders";
import { fazercardsConfigured } from "@/lib/fazercards";
import { reloadlyConfigured } from "@/lib/reloadly";

/** Nombre maximal de commandes traitées par balayage (borne l'exécution). */
export const RESUME_BATCH_LIMIT = 10;

export interface ResumeResultLine {
  ref: string;
  supplier: "fazercards" | "reloadly";
  action: "delivered" | "awaiting" | "manual" | "skipped" | "give_up" | "error";
  detail?: string;
}

export interface ResumeReport {
  scanned: number;
  attempted: number;
  delivered: number;
  awaiting: number;
  manual: number;
  skipped: number;
  errors: number;
  results: ResumeResultLine[];
}

export interface ResumeOptions {
  now?: number;
  limit?: number;
  minAgeMs?: number;
  maxAgeMs?: number;
  maxAttempts?: number;
  /** N'exécute aucune livraison, seulement le diagnostic. */
  dryRun?: boolean;
}

/** Vrai si le fournisseur de la commande est utilisable sur ce serveur. */
function supplierReady(order: { productSlug?: string | null; productId?: string | null }): boolean {
  if (digitalOrderSupplier(order) === "fazercards") return fazercardsConfigured();
  return reloadlyConfigured() && !reloadlyEnvironmentMismatch();
}

/**
 * Reprend les commandes bloquées. Ne lève jamais : un fournisseur en panne
 * ne doit pas faire échouer le cron (le rapport porte les erreurs).
 */
export async function resumeStaleDigitalOrders(
  options: ResumeOptions = {},
): Promise<ResumeReport> {
  const report: ResumeReport = {
    scanned: 0,
    attempted: 0,
    delivered: 0,
    awaiting: 0,
    manual: 0,
    skipped: 0,
    errors: 0,
    results: [],
  };

  await ensureSchema();

  const limit = Math.min(50, Math.max(1, options.limit ?? RESUME_BATCH_LIMIT));
  const rows = await db
    .select({ order: digitalOrders, paymentStatus: orders.status })
    .from(digitalOrders)
    .leftJoin(orders, eq(orders.ref, digitalOrders.ref))
    .where(inArray(digitalOrders.status, [...RESUME_STATUSES]))
    .orderBy(asc(digitalOrders.updatedAt))
    .limit(limit * 3);

  report.scanned = rows.length;
  let processed = 0;

  for (const row of rows) {
    if (processed >= limit) break;
    const order = row.order;

    const decision = decideDigitalResume({
      status: order.status,
      paymentStatus: row.paymentStatus,
      attempts: order.attempts,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      now: options.now,
      minAgeMs: options.minAgeMs ?? RESUME_MIN_AGE_MS,
      maxAgeMs: options.maxAgeMs ?? RESUME_MAX_AGE_MS,
      maxAttempts: options.maxAttempts ?? RESUME_MAX_ATTEMPTS,
    });

    const supplier = digitalOrderSupplier(order);

    if (decision.action === "skip") {
      report.skipped += 1;
      report.results.push({
        ref: order.ref,
        supplier,
        action: "skipped",
        detail: decision.reason,
      });
      continue;
    }

    if (decision.action === "give_up") {
      report.manual += 1;
      if (!options.dryRun) {
        await db
          .update(digitalOrders)
          .set({
            status: "manual",
            lastError: decision.reason.slice(0, 800),
            updatedAt: new Date(),
          })
          .where(eq(digitalOrders.id, order.id));
      }
      report.results.push({
        ref: order.ref,
        supplier,
        action: "give_up",
        detail: decision.reason,
      });
      continue;
    }

    // Fournisseur non configuré sur ce serveur (préversion, oubli de clé) :
    // ne rien tenter plutôt que de basculer toutes les commandes en manuel.
    if (!supplierReady(order)) {
      report.skipped += 1;
      report.results.push({
        ref: order.ref,
        supplier,
        action: "skipped",
        detail: `fournisseur ${supplier} non configuré sur ce serveur`,
      });
      continue;
    }

    processed += 1;

    if (!options.dryRun) {
      // Réservation optimiste : deux exécutions simultanées (cron + suivi
      // client) ne doivent pas livrer la même commande deux fois.
      const claimed = await db
        .update(digitalOrders)
        .set({ updatedAt: new Date() })
        .where(
          and(
            eq(digitalOrders.id, order.id),
            eq(digitalOrders.updatedAt, order.updatedAt),
          ),
        )
        .returning({ id: digitalOrders.id });
      if (claimed.length === 0) {
        report.skipped += 1;
        report.results.push({
          ref: order.ref,
          supplier,
          action: "skipped",
          detail: "commande déjà prise en charge par une autre exécution",
        });
        continue;
      }
    }

    report.attempted += 1;
    try {
      const result = await deliverPaidDigitalOrder(order.id);
      const line: ResumeResultLine = { ref: order.ref, supplier, action: "skipped" };
      if (result.outcome === "delivered" || result.outcome === "already_delivered") {
        report.delivered += 1;
        line.action = "delivered";
      } else if (result.outcome === "awaiting_codes") {
        report.awaiting += 1;
        line.action = "awaiting";
        line.detail = result.message;
      } else if (result.outcome === "manual") {
        report.manual += 1;
        line.action = "manual";
        line.detail = result.message;
      } else {
        report.skipped += 1;
        line.action = "skipped";
        line.detail = result.message ?? result.outcome;
      }
      report.results.push(line);
    } catch (error) {
      report.errors += 1;
      report.results.push({
        ref: order.ref,
        supplier,
        action: "error",
        detail: error instanceof Error ? error.message.slice(0, 300) : "erreur inconnue",
      });
    }
  }

  return report;
}
