// Règles de cycle de vie d'un abonnement — fonctions pures (sans I/O).
// Utilisées par la souscription, l'IPN d'abonnement, l'annulation, les
// relances, l'espace abonné et les tests. Le statut affiché est DÉRIVÉ de
// la date de fin de période : une période expirée bascule en « grâce »
// puis « expiré » sans état stocké à maintenir.

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
  | "expired"; // accès suspendu, réabonnement possible

const DAY_MS = 24 * 60 * 60 * 1000;

/** Relance envoyée avant l'échéance (jours). */
export const REMINDER_LEAD_DAYS = 3;

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

export interface SubscriptionTiming {
  currentPeriodEnd: Date | null;
  /** Renouvellement annulé par le client : pas de grâce après la fin de période. */
  canceledAt?: Date | null;
}

export function displayStatus(
  subscription: SubscriptionTiming,
  now: Date,
  graceDays: number = SUBSCRIPTION_GRACE_DAYS,
): SubscriptionDisplayStatus {
  if (!subscription.currentPeriodEnd) return "inactive";
  // Après une annulation, l'accès s'arrête à la fin de la période payée :
  // la grâce ne sert qu'aux renouvellements échoués.
  const grace = subscription.canceledAt ? 0 : graceDays;
  const state = accessStateAt(subscription.currentPeriodEnd, now, grace);
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
 * adresse : une facture en attente de paiement, ou un accès en cours
 * (période, grâce, ou période payée après annulation). Évite les doubles
 * factures ; après expiration, on peut de nouveau souscrire.
 */
export function blocksNewSubscription(status: SubscriptionDisplayStatus): boolean {
  return status === "inactive" || hasAccess(status);
}

/** Équivalent mensuel d'un prix (ex. 69 $ / 365 j ≈ 5,67 $ / mois), pour le revenu récurrent. */
export function monthlyEquivalentUsd(priceUsd: number, intervalDay: number): number {
  if (!Number.isFinite(priceUsd) || intervalDay <= 0) return 0;
  return Math.round(((priceUsd * 30) / intervalDay) * 100) / 100;
}

/* ------------------------------------------------------------------ */
/* Relances                                                            */
/* ------------------------------------------------------------------ */

export type SubscriptionNotice = "reminder" | "overdue" | "expired";

export interface NoticeState extends SubscriptionTiming {
  /** Échéance pour laquelle la relance « avant échéance » a été envoyée. */
  reminderFor: Date | null;
  /** Échéance pour laquelle l'avis « en retard » a été envoyé. */
  overdueNoticeFor: Date | null;
  /** Échéance pour laquelle l'avis « suspendu » a été envoyé. */
  expiredNoticeFor: Date | null;
}

function sameInstant(a: Date | null, b: Date): boolean {
  return a !== null && a.getTime() === b.getTime();
}

/**
 * Quelle relance envoyer maintenant, s'il y en a une. Chaque relance n'est
 * envoyée qu'une fois par échéance : l'appelant enregistre l'échéance
 * après envoi réussi. Un abonnement annulé ne reçoit aucune relance.
 */
export function noticeToSend(
  sub: NoticeState,
  now: Date,
  graceDays: number = SUBSCRIPTION_GRACE_DAYS,
): SubscriptionNotice | null {
  const end = sub.currentPeriodEnd;
  if (!end || sub.canceledAt) return null;

  if (now.getTime() <= end.getTime()) {
    const untilEnd = end.getTime() - now.getTime();
    if (untilEnd <= REMINDER_LEAD_DAYS * DAY_MS && !sameInstant(sub.reminderFor, end)) {
      return "reminder";
    }
    return null;
  }
  if (now.getTime() <= accessEndOf(end, graceDays).getTime()) {
    return sameInstant(sub.overdueNoticeFor, end) ? null : "overdue";
  }
  return sameInstant(sub.expiredNoticeFor, end) ? null : "expired";
}

function accessEndOf(end: Date, graceDays: number): Date {
  return new Date(end.getTime() + graceDays * DAY_MS);
}

/* ------------------------------------------------------------------ */
/* Charge utile IPN et e-mails                                         */
/* ------------------------------------------------------------------ */

/**
 * Identifiant NOWPayments de l'abonnement porté par une notification IPN.
 * Le nom exact du champ varie selon les versions de l'API : on accepte les
 * variantes scalaires connues, puis les objets imbriqués, plutôt que
 * d'échouer silencieusement et de laisser le paiement sans rattachement.
 */
const SUBSCRIPTION_ID_KEYS = [
  "subscription_id",
  "recurring_payment_id",
  "subscriptionId",
  "recurringPaymentId",
  // Variante observée sur la page de facture hébergée NOWPayments
  // (paramètre d'URL `subscriptionPaymentId`).
  "subscription_payment_id",
  "subscriptionPaymentId",
] as const;

/**
 * Racines d'un éventuel objet imbriqué portant l'identifiant. Noms
 * volontairement spécifiques aux abonnements : un racine générique
 * (`data`, `payload`) risquerait un faux positif qui détournerait un
 * paiement ponctuel vers la branche abonnement.
 */
const SUBSCRIPTION_NESTED_ROOTS = [
  "subscription",
  "recurring_payment",
  "recurringPayment",
] as const;

function asIdText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

export function subscriptionIdFromPayload(
  payload: Record<string, unknown>,
): string | null {
  for (const key of SUBSCRIPTION_ID_KEYS) {
    const text = asIdText(payload[key]);
    if (text) return text;
  }
  for (const root of SUBSCRIPTION_NESTED_ROOTS) {
    const node = payload[root];
    if (!node || typeof node !== "object" || Array.isArray(node)) continue;
    const record = node as Record<string, unknown>;
    const text = asIdText(
      record.id ?? record.subscription_id ?? record.subscriptionId,
    );
    if (text) return text;
  }
  return null;
}

/** Normalise une adresse e-mail pour la comparaison (casse, espaces). */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/* ------------------------------------------------------------------ */
/* Factures (iid) : seul pont entre une IPN d'abonnement et l'abonné  */
/* ------------------------------------------------------------------ */

/**
 * Les IPN des abonnements NOWPayments n'embarquent aucun identifiant
 * d'abonnement : elles ne contiennent que `invoice_id`. Le lien de
 * paiement renvoyé à la création de l'abonnement porte quant à lui cet
 * iid en paramètre d'URL (`…/payment?iid=5267182715`).
 */
export function invoiceIdFromUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = value.match(/[?&]iid=(\d+)/i);
  return match ? match[1] : null;
}

const INVOICE_DIRECT_KEYS = ["invoice_id", "iid", "invoiceId"] as const;
const INVOICE_LINK_KEYS = [
  "payment_link",
  "invoice_url",
  "payment_url",
  "link",
  "url",
] as const;

function invoiceIdFromFlatRecord(record: Record<string, unknown>): string | null {
  for (const key of INVOICE_DIRECT_KEYS) {
    const value = record[key];
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (/^\d+$/.test(text)) return text;
  }
  for (const key of INVOICE_LINK_KEYS) {
    const id = invoiceIdFromUrl(record[key]);
    if (id) return id;
  }
  return null;
}

/**
 * Extrait l'iid de la facture de la réponse de `POST /v1/subscriptions`.
 * Accepte un objet, un tableau d'objets, et une imbrication d'un niveau
 * (`{ result: { … } }`, lien dans un sous-objet) — la forme exacte varie
 * selon les comptes NOWPayments.
 */
export function invoiceIdFromSubscriptionRecord(record: unknown): string | null {
  const roots = Array.isArray(record) ? record : [record];
  for (const root of roots) {
    if (!root || typeof root !== "object") continue;
    const source = root as Record<string, unknown>;
    const direct = invoiceIdFromFlatRecord(source);
    if (direct) return direct;
    for (const value of Object.values(source)) {
      if (!value || typeof value !== "object") continue;
      const nested = Array.isArray(value) ? value : [value];
      for (const item of nested) {
        if (!item || typeof item !== "object") continue;
        const id = invoiceIdFromFlatRecord(item as Record<string, unknown>);
        if (id) return id;
      }
    }
  }
  return null;
}

/**
 * Vrai si un abonnement distant (réponse de `GET /v1/subscriptions/{id}`)
 * référence la facture cherchée, directement ou dans une liste imbriquée
 * de paiements/factures. L'exploration est volontairement générique : la
 * structure exacte de la réponse n'est pas documentée de façon stable.
 */
export function recordReferencesInvoiceId(
  record: unknown,
  invoiceId: string,
): boolean {
  if (!record || typeof record !== "object") return false;
  const source = record as Record<string, unknown>;
  for (const key of INVOICE_DIRECT_KEYS) {
    if (source[key] != null && String(source[key]).trim() === invoiceId) {
      return true;
    }
  }
  for (const key of INVOICE_LINK_KEYS) {
    if (invoiceIdFromUrl(source[key]) === invoiceId) return true;
  }
  for (const value of Object.values(source)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === "object" &&
          recordReferencesInvoiceId(item, invoiceId)) {
          return true;
        }
      }
    }
  }
  return false;
}
