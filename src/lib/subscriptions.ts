// Abonnements mensuels / annuels (NOWPayments) — logique serveur.
//  - synchronisation des plans avec NOWPayments (idempotente) ;
//  - souscription d'un client (abonné + ajout à NOWPayments) ;
//  - traitement des paiements d'abonnement reçus par IPN ;
//  - lecture de l'espace abonné protégé par jeton.
// Voir docs/abonnements-nowpayments.md.

import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import {
  orders,
  subscriptionPlans,
  subscriptions,
  type Order,
  type Subscription,
} from "@/db/schema";
import { siteBaseUrl } from "@/lib/site-url";
import {
  cancelSubscriptionRemote,
  createSubscription,
  createSubscriptionPlan,
  isFailedStatus,
  isNowPaymentsError,
  isPaidStatus,
  nowPaymentsConfigured,
  updateSubscriptionPlan,
  validatePaidAmount,
} from "@/lib/nowpayments";
import {
  newOrderReference,
  createTrackingToken,
  maskEmail,
  verifyTrackingToken,
} from "@/lib/order-tracking";
import {
  SUBSCRIPTION_CURRENCY,
  SUBSCRIPTION_GRACE_DAYS,
  SUBSCRIPTION_PLANS,
  accessEndsAt,
  formatUsdAmount,
  getSubscriptionPlan,
  type SubscriptionPlanDef,
} from "@/lib/subscription-plans";
import {
  blocksNewSubscription,
  displayStatus,
  hasAccess,
  nextBillingPeriod,
  noticeToSend,
  normalizeEmail,
  type SubscriptionDisplayStatus,
} from "@/lib/subscription-lifecycle";
import { buildNoticeEmail } from "@/lib/subscription-emails";
import type { OutgoingEmail } from "@/lib/mailer";

/** Message d'erreur sans secret (le corps NOWPayments est déjà tronqué). */
function describeError(error: unknown): string {
  if (isNowPaymentsError(error)) return error.message;
  return error instanceof Error ? error.message : String(error);
}

function planTitle(plan: SubscriptionPlanDef): string {
  const cycle = plan.cycle === "monthly" ? "Mensuel" : "Annuel";
  return `${plan.nameEn} — ${cycle}`;
}

/* ------------------------------------------------------------------ */
/* 1. Synchronisation des plans                                        */
/* ------------------------------------------------------------------ */

export interface SyncReport {
  created: string[];
  updated: string[];
  unchanged: string[];
  failed: { id: string; error: string }[];
}

/**
 * Crée ou met à jour chaque plan du catalogue chez NOWPayments, puis
 * enregistre l'identifiant renvoyé. Une erreur sur un plan n'arrête pas
 * les autres : elle est rapportée.
 */
export async function syncSubscriptionPlans(req?: Request): Promise<SyncReport> {
  if (!nowPaymentsConfigured()) {
    throw new Error("NOWPAYMENTS_API_KEY manquant");
  }
  await ensureSchema();

  const base = siteBaseUrl(req);
  const report: SyncReport = { created: [], updated: [], unchanged: [], failed: [] };

  for (const plan of SUBSCRIPTION_PLANS) {
    try {
      const amount = formatUsdAmount(plan.priceUsd);
      const title = planTitle(plan);
      const [row] = await db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, plan.id))
        .limit(1);

      if (row?.nowpaymentsPlanId) {
        const changed =
          row.priceUsd !== amount ||
          row.intervalDay !== plan.intervalDay ||
          row.title !== title ||
          row.graceDays !== plan.graceDays;
        if (!changed) {
          report.unchanged.push(plan.id);
          continue;
        }
        await updateSubscriptionPlan(row.nowpaymentsPlanId, {
          amount: Number(amount),
          intervalDay: plan.intervalDay,
          title,
        });
        await db
          .update(subscriptionPlans)
          .set({
            priceUsd: amount,
            intervalDay: plan.intervalDay,
            graceDays: plan.graceDays,
            title,
            syncedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(subscriptionPlans.id, plan.id));
        report.updated.push(plan.id);
        continue;
      }

      const created = await createSubscriptionPlan({
        title,
        intervalDay: plan.intervalDay,
        amount: Number(amount),
        currency: SUBSCRIPTION_CURRENCY,
        ipnCallbackUrl: `${base}/api/payments/ipn`,
        successUrl: `${base}/abonnements`,
        cancelUrl: `${base}/abonnements`,
      });
      const nowpaymentsPlanId = String(created.id ?? "");
      if (!nowpaymentsPlanId) {
        throw new Error("NOWPayments n'a pas renvoyé l'identifiant du plan");
      }

      await db
        .insert(subscriptionPlans)
        .values({
          id: plan.id,
          nowpaymentsPlanId,
          tier: plan.tier,
          cycle: plan.cycle,
          title,
          priceUsd: amount,
          intervalDay: plan.intervalDay,
          graceDays: plan.graceDays,
          syncedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: subscriptionPlans.id,
          set: {
            nowpaymentsPlanId,
            priceUsd: amount,
            intervalDay: plan.intervalDay,
            graceDays: plan.graceDays,
            title,
            syncedAt: new Date(),
            updatedAt: new Date(),
          },
        });
      report.created.push(plan.id);
    } catch (error) {
      report.failed.push({ id: plan.id, error: describeError(error) });
    }
  }

  return report;
}

/* ------------------------------------------------------------------ */
/* 2. Souscription d'un client                                         */
/* ------------------------------------------------------------------ */

export type SubscribeFailure =
  | { ok: false; code: "unknown_plan"; status: 400; message: string }
  | { ok: false; code: "plans_not_synced"; status: 503; message: string }
  | { ok: false; code: "already_subscribed"; status: 409; message: string }
  | { ok: false; code: "gateway_error"; status: 502; message: string };

export type SubscribeResult =
  | {
      ok: true;
      ref: string;
      /** Jeton de suivi en clair : affiché une seule fois au client. */
      trackingToken: string;
      planName: string;
      priceUsd: string;
      intervalDay: number;
    }
  | SubscribeFailure;

export interface SubscribeInput {
  planId: string;
  email: string;
  name: string;
  phone: string;
}

/**
 * Ouvre un abonnement : crée l'abonné en base, puis l'ajoute au plan chez
 * NOWPayments, qui envoie au client le lien de la première facture. En cas
 * d'échec côté passerelle, la ligne locale est supprimée (aucun abonné
 * fantôme).
 */
export async function createClientSubscription(
  input: SubscribeInput,
): Promise<SubscribeResult> {
  await ensureSchema();

  const catalogue = getSubscriptionPlan(input.planId);
  if (!catalogue) {
    return { ok: false, code: "unknown_plan", status: 400, message: "Formule inconnue." };
  }

  const [plan] = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.id, catalogue.id))
    .limit(1);
  if (!plan?.nowpaymentsPlanId) {
    return {
      ok: false,
      code: "plans_not_synced",
      status: 503,
      message: "Les abonnements ne sont pas encore disponibles. Réessayez plus tard.",
    };
  }

  const email = normalizeEmail(input.email);

  // Pas de doublon : un abonnement encore actif (ou en grâce) bloque une
  // nouvelle souscription à la même formule pour la même adresse.
  const sameOffer = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.email, email),
        eq(subscriptions.planId, plan.id),
        inArray(subscriptions.status, ["inactive", "active"]),
      ),
    );
  const blocking = sameOffer.some((row) => {
    const status = displayStatus(row, new Date(), SUBSCRIPTION_GRACE_DAYS);
    // Une formule annulée ne bloque le réabonnement qu'en cas d'accès restant.
    return row.canceledAt ? hasAccess(status) : blocksNewSubscription(status);
  });
  if (blocking) {
    return {
      ok: false,
      code: "already_subscribed",
      status: 409,
      message:
        "Un abonnement à cette formule existe déjà pour cette adresse e-mail (actif ou en attente de paiement). Réglez la facture reçue par e-mail ou utilisez votre lien de suivi.",
    };
  }

  const ref = newOrderReference("ABO");
  const token = createTrackingToken();
  const [row] = await db
    .insert(subscriptions)
    .values({
      ref,
      trackingTokenHash: token.hash,
      planId: plan.id,
      email,
      clientName: input.name.trim(),
      phone: input.phone.trim(),
      status: "inactive",
    })
    .returning();

  try {
    const remote = await createSubscription({
      planId: plan.nowpaymentsPlanId,
      email,
    });
    const remoteId = remote.id != null ? String(remote.id) : "";
    if (!remoteId) {
      throw new Error("NOWPayments n'a pas renvoyé l'identifiant de l'abonnement");
    }
    await db
      .update(subscriptions)
      .set({ nowpaymentsSubscriptionId: remoteId, updatedAt: new Date() })
      .where(eq(subscriptions.id, row.id));
  } catch (error) {
    await db.delete(subscriptions).where(eq(subscriptions.id, row.id));
    return {
      ok: false,
      code: "gateway_error",
      status: 502,
      message: `Création de l'abonnement impossible : ${describeError(error)}`,
    };
  }

  return {
    ok: true,
    ref,
    trackingToken: token.token,
    planName: plan.title,
    priceUsd: plan.priceUsd,
    intervalDay: plan.intervalDay,
  };
}

/* ------------------------------------------------------------------ */
/* 3. Paiements d'abonnement reçus par IPN                             */
/* ------------------------------------------------------------------ */

export type SubscriptionIpnOutcome =
  | { outcome: "activated" | "renewed"; order: Order; firstActivation: boolean }
  | {
      outcome:
        | "duplicate"
        | "unknown_subscription"
        | "unknown_plan"
        | "missing_fields"
        | "payment_failed"
        | "pending";
    }
  | { outcome: "amount_mismatch"; reason: string | null };

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

/**
 * Applique un paiement d'abonnement confirmé. Idempotent : un même
 * `payment_id` n'est enregistré qu'une fois (contrainte unique + verrou sur
 * la ligne d'abonnement). Le montant et la devise doivent correspondre au
 * prix du plan. Une notification `failed`/`expired` ne modifie pas l'accès.
 */
export async function applySubscriptionIpn(
  payload: Record<string, unknown>,
  nowpaymentsSubscriptionId: string,
): Promise<SubscriptionIpnOutcome> {
  await ensureSchema();

  const paymentId = text(payload.payment_id);
  const status = text(payload.payment_status);
  if (!paymentId || !status) return { outcome: "missing_fields" };

  const [sub] = await db
    .select({ planId: subscriptions.planId })
    .from(subscriptions)
    .where(eq(subscriptions.nowpaymentsSubscriptionId, nowpaymentsSubscriptionId))
    .limit(1);
  if (!sub) return { outcome: "unknown_subscription" };

  const [plan] = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.id, sub.planId))
    .limit(1);
  if (!plan) return { outcome: "unknown_plan" };

  if (!isPaidStatus(status)) {
    return { outcome: isFailedStatus(status) ? "payment_failed" : "pending" };
  }

  const check = validatePaidAmount(
    { amountUsd: plan.priceUsd, currency: SUBSCRIPTION_CURRENCY },
    payload,
  );
  if (!check.ok) return { outcome: "amount_mismatch", reason: check.reason };

  return db.transaction(async (tx) => {
    // Verrou sur l'abonné : deux notifications concurrentes sont sérialisées.
    const [current] = await tx
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.nowpaymentsSubscriptionId, nowpaymentsSubscriptionId))
      .for("update")
      .limit(1);
    if (!current) return { outcome: "unknown_subscription" as const };

    const paidAt = new Date();
    // « Accès » = période payée ou grâce : seul ce cas est un renouvellement.
    // (Une facture en attente n'a pas d'accès : son paiement est une activation.)
    const wasAccessible = hasAccess(
      displayStatus(current, paidAt, SUBSCRIPTION_GRACE_DAYS),
    );
    const period = nextBillingPeriod(
      current.currentPeriodEnd,
      paidAt,
      plan.intervalDay,
    );

    const inserted = await tx
      .insert(orders)
      .values({
        ref: newOrderReference("ABO"),
        kind: "subscription",
        planId: plan.id,
        planName: plan.title,
        amountLyd: "",
        amountUsd: plan.priceUsd,
        currency: SUBSCRIPTION_CURRENCY,
        installments: 1,
        installmentIndex: 1,
        clientName: current.clientName,
        email: current.email,
        phone: current.phone,
        paymentId,
        payAddress: text(payload.pay_address) || null,
        payCurrency: text(payload.pay_currency) || null,
        payAmount: text(payload.pay_amount) || null,
        status: "paid",
        ipnStatus: status,
        subscriptionId: current.id,
      })
      .onConflictDoNothing({ target: orders.paymentId })
      .returning();

    if (inserted.length === 0) return { outcome: "duplicate" as const };

    await tx
      .update(subscriptions)
      .set({
        status: "active",
        currentPeriodStart: period.periodStart,
        currentPeriodEnd: period.periodEnd,
        lastPaymentId: paymentId,
        updatedAt: paidAt,
      })
      .where(eq(subscriptions.id, current.id));

    return {
      outcome: wasAccessible ? ("renewed" as const) : ("activated" as const),
      order: inserted[0],
      firstActivation: !wasAccessible,
    };
  });
}

/* ------------------------------------------------------------------ */
/* 4. Espace abonné (lecture protégée par jeton)                       */
/* ------------------------------------------------------------------ */

export interface SubscriberView {
  ref: string;
  planName: string;
  cycle: "monthly" | "annual";
  priceUsd: string;
  intervalDay: number;
  status: SubscriptionDisplayStatus;
  currentPeriodEnd: string | null;
  accessEndsAt: string | null;
  graceDays: number;
  canResubscribe: boolean;
  /** Renouvellement annulé : l'accès s'arrête à `accessEndsAt` (pas de grâce). */
  renewalCanceled: boolean;
  emailMasked: string | null;
}

/**
 * Renvoie l'état d'un abonnement si le jeton correspond. Jeton absent ou
 * faux → `null` (même réponse que pour une référence inconnue).
 */
export async function findSubscriptionForTracking(
  ref: string,
  token: string | null | undefined,
): Promise<SubscriberView | null> {
  await ensureSchema();
  const [row] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.ref, ref.trim()))
    .limit(1);
  if (!row || !verifyTrackingToken(token, row.trackingTokenHash)) return null;

  const [plan] = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.id, row.planId))
    .limit(1);
  if (!plan) return null;

  const now = new Date();
  const status = displayStatus(row as Subscription, now, SUBSCRIPTION_GRACE_DAYS);
  const end = row.currentPeriodEnd;
  const accessUntil = end
    ? row.canceledAt
      ? end
      : accessEndsAt(end, SUBSCRIPTION_GRACE_DAYS)
    : null;
  return {
    ref: row.ref,
    planName: plan.title,
    cycle: plan.cycle === "annual" ? "annual" : "monthly",
    priceUsd: plan.priceUsd,
    intervalDay: plan.intervalDay,
    status,
    currentPeriodEnd: end ? end.toISOString() : null,
    accessEndsAt: accessUntil ? accessUntil.toISOString() : null,
    graceDays: SUBSCRIPTION_GRACE_DAYS,
    canResubscribe: !blocksNewSubscription(status),
    renewalCanceled: row.canceledAt !== null,
    emailMasked: maskEmail(row.email),
  };
}

/* ------------------------------------------------------------------ */
/* 5. Annulation du renouvellement                                     */
/* ------------------------------------------------------------------ */

export type CancelResult =
  | { ok: true; alreadyCanceled: boolean; accessUntil: string | null }
  | { ok: false; code: "not_found"; status: 404; message: string }
  | { ok: false; code: "gateway_error"; status: 502; message: string };

/**
 * Annule le renouvellement : NOWPayments n'émet plus de facture, et l'accès
 * reste ouvert jusqu'à la fin de la période déjà payée (sans grâce, et sans
 * remboursement). Si NOWPayments refuse, rien n'est modifié localement.
 */
export async function cancelClientSubscription(
  ref: string,
  token: string | null | undefined,
): Promise<CancelResult> {
  await ensureSchema();
  const [row] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.ref, ref.trim()))
    .limit(1);
  if (!row || !verifyTrackingToken(token, row.trackingTokenHash)) {
    return { ok: false, code: "not_found", status: 404, message: "Abonnement introuvable." };
  }

  const accessUntil = row.currentPeriodEnd ? row.currentPeriodEnd.toISOString() : null;
  if (row.canceledAt) return { ok: true, alreadyCanceled: true, accessUntil };

  if (row.nowpaymentsSubscriptionId) {
    try {
      await cancelSubscriptionRemote(row.nowpaymentsSubscriptionId);
    } catch (error) {
      // 404 : déjà supprimé côté NOWPayments → l'annulation est effective.
      const alreadyGone = isNowPaymentsError(error) && error.status === 404;
      if (!alreadyGone) {
        return {
          ok: false,
          code: "gateway_error",
          status: 502,
          message: `Annulation impossible : ${describeError(error)}`,
        };
      }
    }
  }

  const now = new Date();
  await db
    .update(subscriptions)
    .set({ canceledAt: now, updatedAt: now })
    .where(eq(subscriptions.id, row.id));
  return { ok: true, alreadyCanceled: false, accessUntil };
}

/* ------------------------------------------------------------------ */
/* 6. Relances (appelées par le cron)                                  */
/* ------------------------------------------------------------------ */

export type NoticeSender = (
  message: OutgoingEmail,
) => Promise<{ ok: boolean; error?: string }>;

export interface NoticeReport {
  checked: number;
  sent: { reminder: number; overdue: number; expired: number };
  failed: number;
}

/**
 * Envoie les relances dues à `now`. Chaque relance part une seule fois par
 * échéance (colonnes `*_for`, mises à jour seulement après un envoi réussi :
 * un échec sera retenté au passage suivant). `send` est injectable pour les tests.
 */
export async function runSubscriptionNotices(
  now: Date,
  send: NoticeSender,
  siteUrl: string,
  siteName: string,
): Promise<NoticeReport> {
  await ensureSchema();
  const report: NoticeReport = {
    checked: 0,
    sent: { reminder: 0, overdue: 0, expired: 0 },
    failed: 0,
  };

  const rows = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.status, "active"), isNotNull(subscriptions.currentPeriodEnd)));
  const plans = new Map(
    (await db.select().from(subscriptionPlans)).map((plan) => [plan.id, plan]),
  );
  const subscribeUrl = `${siteUrl.replace(/\/+$/, "")}/abonnements`;

  for (const row of rows) {
    report.checked++;
    const plan = plans.get(row.planId);
    const end = row.currentPeriodEnd;
    if (!plan || !end) continue;

    const kind = noticeToSend(row, now, plan.graceDays);
    if (!kind) continue;

    try {
      const mail = buildNoticeEmail(kind, {
        ref: row.ref,
        planName: plan.title,
        endsAt: end,
        accessEndsAt: accessEndsAt(end, plan.graceDays),
        graceDays: plan.graceDays,
        subscribeUrl,
        siteName,
      });
      const result = await send({
        to: row.email,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      });
      if (!result.ok) {
        report.failed++;
        continue;
      }
      const marker =
        kind === "reminder"
          ? { reminderFor: end }
          : kind === "overdue"
            ? { overdueNoticeFor: end }
            : { expiredNoticeFor: end };
      await db
        .update(subscriptions)
        .set({ ...marker, updatedAt: now })
        .where(eq(subscriptions.id, row.id));
      report.sent[kind]++;
    } catch (error) {
      report.failed++;
      console.error(
        `[relances] ${row.ref} (${kind}) :`,
        error instanceof Error ? error.message : error,
      );
    }
  }
  return report;
}
