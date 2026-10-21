// Synchronisation des plans d'abonnement avec NOWPayments.
// Idempotente : un plan déjà créé n'est recréé jamais ; un changement de
// prix ou d'intervalle est poussé par PATCH (il ne vaut que pour les
// prochains cycles, règle NOWPayments).

import { eq } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { subscriptionPlans } from "@/db/schema";
import { siteBaseUrl } from "@/lib/site-url";
import {
  createSubscriptionPlan,
  isNowPaymentsError,
  nowPaymentsConfigured,
  updateSubscriptionPlan,
} from "@/lib/nowpayments";
import {
  SUBSCRIPTION_CURRENCY,
  SUBSCRIPTION_PLANS,
  formatUsdAmount,
  type SubscriptionPlanDef,
} from "@/lib/subscription-plans";

export interface SyncReport {
  created: string[];
  updated: string[];
  unchanged: string[];
  failed: { id: string; error: string }[];
}

/** Message d'erreur sans secret (le corps NOWPayments est déjà tronqué). */
function describeError(error: unknown): string {
  if (isNowPaymentsError(error)) return error.message;
  return error instanceof Error ? error.message : String(error);
}

function planTitle(plan: SubscriptionPlanDef): string {
  const cycle = plan.cycle === "monthly" ? "Mensuel" : "Annuel";
  return `${plan.nameEn} — ${cycle}`;
}

/**
 * Crée ou met à jour chaque plan du catalogue chez NOWPayments, puis
 * enregistre l'identifiant renvoyé. Une erreur sur un plan n'arrête pas
 * les autres : elle est rapportée.
 */
export async function syncSubscriptionPlans(
  req?: Request,
): Promise<SyncReport> {
  if (!nowPaymentsConfigured()) {
    throw new Error("NOWPAYMENTS_API_KEY manquant");
  }
  await ensureSchema();

  const base = siteBaseUrl(req);
  const report: SyncReport = {
    created: [],
    updated: [],
    unchanged: [],
    failed: [],
  };

  for (const plan of SUBSCRIPTION_PLANS) {
    try {
      const amount = formatUsdAmount(plan.priceUsd);
      const [row] = await db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, plan.id))
        .limit(1);

      if (row?.nowpaymentsPlanId) {
        const changed =
          row.priceUsd !== amount ||
          row.intervalDay !== plan.intervalDay ||
          row.title !== planTitle(plan);
        if (!changed) {
          report.unchanged.push(plan.id);
          continue;
        }
        await updateSubscriptionPlan(row.nowpaymentsPlanId, {
          amount: Number(amount),
          intervalDay: plan.intervalDay,
          title: planTitle(plan),
        });
        await db
          .update(subscriptionPlans)
          .set({
            priceUsd: amount,
            intervalDay: plan.intervalDay,
            title: planTitle(plan),
            syncedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(subscriptionPlans.id, plan.id));
        report.updated.push(plan.id);
        continue;
      }

      const created = await createSubscriptionPlan({
        title: planTitle(plan),
        intervalDay: plan.intervalDay,
        amount: Number(amount),
        currency: SUBSCRIPTION_CURRENCY,
        ipnCallbackUrl: `${base}/api/payments/ipn`,
        successUrl: `${base}/pay/success`,
        cancelUrl: `${base}/pay/cancel`,
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
          title: planTitle(plan),
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
            title: planTitle(plan),
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
