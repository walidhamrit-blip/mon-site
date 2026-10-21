// Offres d'abonnement mensuel / annuel payées en crypto (NOWPayments).
// Module pur (sans I/O) : partagé par la synchronisation serveur, les
// routes et les tests. Les prix sont en USD (NOWPayments ne supporte pas
// la livre libyenne) ; le navigateur ne choisit jamais ni le prix ni
// l'intervalle — tout est relu depuis ce catalogue côté serveur.
//
// Voir docs/abonnements-nowpayments.md.

export const SUBSCRIPTION_CURRENCY = "usd";

/**
 * Période de grâce après l'échéance, en jours.
 * Limitée à 5 jours par les règles de la passerelle NOWPayments : au-delà,
 * l'abonnement est suspendu et le client peut s'abonner de nouveau.
 */
export const SUBSCRIPTION_GRACE_DAYS = 5;
/** Plafond de la grâce imposé par NOWPayments (jours). */
export const GATEWAY_MAX_GRACE_DAYS = 5;

export type SubscriptionCycle = "monthly" | "annual";

export interface SubscriptionPlanDef {
  /** Identifiant local stable (clé en base), ex. `vitrine-monthly`. */
  id: string;
  /** Offre commerciale : vitrine, vitrine-plus, boutique. */
  tier: "vitrine" | "vitrine-plus" | "boutique";
  cycle: SubscriptionCycle;
  name: string;
  nameEn: string;
  /** Montant facturé à chaque cycle, en USD. */
  priceUsd: number;
  /** Durée d'un cycle en jours (30 = mensuel, 365 = annuel). */
  intervalDay: number;
  graceDays: number;
}

const TIERS = [
  {
    tier: "vitrine",
    name: "الواجهة",
    nameEn: "Vitrine",
    monthlyUsd: 10,
    annualUsd: 69,
  },
  {
    tier: "vitrine-plus",
    name: "الواجهة بلس",
    nameEn: "Vitrine+",
    monthlyUsd: 12,
    annualUsd: 89,
  },
  {
    tier: "boutique",
    name: "المتجر / الحجز",
    nameEn: "Boutique",
    monthlyUsd: 25,
    annualUsd: 199,
  },
] as const;

/** Catalogue complet : chaque offre existe en mensuel (30 j) et annuel (365 j). */
export const SUBSCRIPTION_PLANS: readonly SubscriptionPlanDef[] = TIERS.flatMap(
  (t) => [
    {
      id: `${t.tier}-monthly`,
      tier: t.tier,
      cycle: "monthly" as const,
      name: t.name,
      nameEn: t.nameEn,
      priceUsd: t.monthlyUsd,
      intervalDay: 30,
      graceDays: SUBSCRIPTION_GRACE_DAYS,
    },
    {
      id: `${t.tier}-annual`,
      tier: t.tier,
      cycle: "annual" as const,
      name: t.name,
      nameEn: t.nameEn,
      priceUsd: t.annualUsd,
      intervalDay: 365,
      graceDays: SUBSCRIPTION_GRACE_DAYS,
    },
  ],
);

export function getSubscriptionPlan(id: string): SubscriptionPlanDef | undefined {
  return SUBSCRIPTION_PLANS.find((plan) => plan.id === id);
}

/** Montant formaté pour NOWPayments et la base : deux décimales, sans arrondi. */
export function formatUsdAmount(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Fin de période : début + intervalle en jours (pas une date de calendrier). */
export function computePeriodEnd(start: Date, intervalDay: number): Date {
  return new Date(start.getTime() + intervalDay * DAY_MS);
}

/** Fin de l'accès accordé : fin de période + délai de grâce. */
export function accessEndsAt(periodEnd: Date, graceDays: number): Date {
  return new Date(periodEnd.getTime() + graceDays * DAY_MS);
}

export type AccessState = "current" | "grace" | "expired";

/**
 * État d'accès à l'instant `now`.
 * - `current` : période payée en cours ;
 * - `grace`   : échéance dépassée, accès maintenu pendant la grâce ;
 * - `expired` : grâce écoulée, accès suspendu.
 */
export function accessStateAt(
  periodEnd: Date,
  now: Date,
  graceDays: number,
): AccessState {
  if (now.getTime() <= periodEnd.getTime()) return "current";
  if (now.getTime() <= accessEndsAt(periodEnd, graceDays).getTime()) {
    return "grace";
  }
  return "expired";
}
