import { desc, eq } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { subscriptionPlans, subscriptions } from "@/db/schema";
import {
  displayStatus,
  hasAccess,
  monthlyEquivalentUsd,
  type SubscriptionDisplayStatus,
} from "@/lib/subscription-lifecycle";
import { SUBSCRIPTION_GRACE_DAYS } from "@/lib/subscription-plans";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Abonnements — Administration",
  robots: { index: false, follow: false },
};

const STATUS_LABEL: Record<SubscriptionDisplayStatus, string> = {
  inactive: "En attente de paiement",
  active: "Actif",
  grace: "Grâce",
  expired: "Suspendu",
};

const STATUS_TONE: Record<SubscriptionDisplayStatus, string> = {
  inactive: "bg-stone-100 text-stone-700",
  active: "bg-emerald-50 text-emerald-700",
  grace: "bg-amber-50 text-amber-700",
  expired: "bg-red-50 text-red-700",
};

function frDate(value: Date | null): string {
  if (!value) return "—";
  return value.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Africa/Tripoli",
  });
}

export default async function AdminSubscriptionsPage() {
  await ensureSchema();
  const rows = await db
    .select({ sub: subscriptions, plan: subscriptionPlans })
    .from(subscriptions)
    .innerJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
    .orderBy(desc(subscriptions.createdAt))
    .limit(300);

  const now = new Date();
  const items = rows.map(({ sub, plan }) => {
    const status = displayStatus(sub, now, SUBSCRIPTION_GRACE_DAYS);
    const price = Number(plan.priceUsd);
    return {
      id: sub.id,
      ref: sub.ref,
      name: sub.clientName ?? "—",
      email: sub.email,
      phone: sub.phone ?? "—",
      plan: plan.title,
      status,
      renewalCanceled: sub.canceledAt !== null,
      periodEnd: sub.currentPeriodEnd,
      createdAt: sub.createdAt,
      // Revenu récurrent : abonnés qui paient encore (hors annulés et en attente).
      mrr:
        hasAccess(status) && !sub.canceledAt
          ? monthlyEquivalentUsd(price, plan.intervalDay)
          : 0,
    };
  });

  const count = (s: SubscriptionDisplayStatus) => items.filter((i) => i.status === s).length;
  const mrr = Math.round(items.reduce((sum, i) => sum + i.mrr, 0) * 100) / 100;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-black text-stone-900">Abonnements</h1>
        <p className="text-sm text-stone-500">
          Abonnés mensuels et annuels payés en crypto (NOWPayments). Grâce de {SUBSCRIPTION_GRACE_DAYS} jours.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: "Revenu mensuel récurrent", value: `$${mrr.toFixed(2)}` },
          { label: "Actifs", value: String(count("active")) },
          { label: "En grâce", value: String(count("grace")) },
          { label: "Suspendus", value: String(count("expired")) },
          { label: "En attente de paiement", value: String(count("inactive")) },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-2xs">
            <div className="text-xs text-stone-500">{card.label}</div>
            <div className="mt-1 text-xl font-black text-stone-900">{card.value}</div>
          </div>
        ))}
      </section>

      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-2xs">
        <table className="min-w-full divide-y divide-stone-100 text-sm">
          <thead className="bg-stone-50 text-start text-xs text-stone-500">
            <tr>
              <th className="px-4 py-3 text-start">Référence</th>
              <th className="px-4 py-3 text-start">Client</th>
              <th className="px-4 py-3 text-start">Formule</th>
              <th className="px-4 py-3 text-start">Statut</th>
              <th className="px-4 py-3 text-start">Fin de période</th>
              <th className="px-4 py-3 text-start">Renouvellement</th>
              <th className="px-4 py-3 text-start">Créé le</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-stone-500">
                  Aucun abonné pour le moment.
                </td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={item.id} className="align-top">
                <td className="px-4 py-3 font-mono text-xs" dir="ltr">{item.ref}</td>
                <td className="px-4 py-3">
                  <div className="font-bold text-stone-900">{item.name}</div>
                  <div className="text-xs text-stone-500" dir="ltr">{item.email}</div>
                  <div className="text-xs text-stone-500" dir="ltr">{item.phone}</div>
                </td>
                <td className="px-4 py-3">{item.plan}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_TONE[item.status]}`}>
                    {STATUS_LABEL[item.status]}
                  </span>
                </td>
                <td className="px-4 py-3">{frDate(item.periodEnd)}</td>
                <td className="px-4 py-3">
                  {item.renewalCanceled ? (
                    <span className="text-red-600">Annulé par le client</span>
                  ) : (
                    <span className="text-stone-600">Actif</span>
                  )}
                </td>
                <td className="px-4 py-3">{frDate(item.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-stone-500">
        Revenu mensuel = prix × 30 ÷ durée du cycle (annuel : prix × 30 ÷ 365). Affiche les 300 dernières souscriptions.
      </p>
    </div>
  );
}
