// Règles de cycle de vie d'un abonnement — fonctions pures (sans I/O).
// Utilisées par la souscription, l'IPN d'abonnement, l'espace abonné et
// les tests. Le statut affiché est DÉRIVÉ de la date de fin de période :
// une période expirée bascule en « grâce » puis « expiré » sans cron.

import {
  SUBSCRIPTION_GRACE_DAYS,
  accessStateAt,
  computePeriodEnd,
} from "@/lib/subscription-plans";

/** Statut tel qu'affiché au client et à l'administration. */
export type SubscriptionDisplayStatus =
  | "inactive" // souscrit, première facture non réglée
  | "active" // période payée en cours
  | "grace" // échéance dépassée, accès maintenu pendant la grâce
  | "expired" // grâce écoulée : accès suspendu, réabonnement possible
  | "canceled";

/**
 * Période suivant un paiement confirmé. Un paiement anticipé (avant
 * l'échéance) prolonge la période courante au lieu de la remplacer, pour
 * ne pas faire perdre au client les jours déjà payés.
 */
export function nextBillingPeriod(
  currentPeriodEnd: Date | null,
  paidAt: Date,
  intervalDay: number,
): { periodStart: Date; periodEnd: Date } {
  const periodStart =
    currentPeriodEnd && currentPeriodEnd.getTime() > paidAt.getTime()
      ? currentPeriodEnd
      : paidAt;
  return {
    periodStart,
    periodEnd: computePeriodEnd(periodStart, intervalDay),
  };
}

export function displayStatus(
  subscription: { status: string; currentPeriodEnd: Date | null },
  now: Date,
  graceDays: number = SUBSCRIPTION_GRACE_DAYS,
): SubscriptionDisplayStatus {
  if (subscription.status === "canceled") return "canceled";
  if (!subscription.currentPeriodEnd) return "inactive";
  const state = accessStateAt(subscription.currentPeriodEnd, now, graceDays);
  if (state === "current") return "active";
  if (state === "grace") return "grace";
  return "expired";
}

/** Vrai si le client doit encore avoir accès (période payée ou grâce). */
export function hasAccess(status: SubscriptionDisplayStatus): boolean {
  return status === "active" || status === "grace";
}

/**
 * Vrai si un nouvel abonnement à la même formule est interdit pour la même
 * adresse : une facture en attente de paiement (la première facture déjà
 * envoyée par NOWPayments) ou un accès en cours (période ou grâce).
 * Évite les doubles factures ; après expiration ou annulation, on peut
 * de nouveau souscrire.
 */
export function blocksNewSubscription(status: SubscriptionDisplayStatus): boolean {
  return status === "inactive" || hasAccess(status);
}

/**
 * Identifiant NOWPayments de l'abonnement porté par une notification IPN.
 * Le nom exact du champ est à confirmer sur sandbox ; on accepte les
 * variantes connues plutôt que d'échouer silencieusement.
 */
const SUBSCRIPTION_ID_KEYS = ["subscription_id", "recurring_payment_id"] as const;

export function subscriptionIdFromPayload(
  payload: Record<string, unknown>,
): string | null {
  for (const key of SUBSCRIPTION_ID_KEYS) {
    const value = payload[key];
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return null;
}

/** Normalise une adresse e-mail pour la comparaison (casse, espaces). */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}
