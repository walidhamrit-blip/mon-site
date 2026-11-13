// Noyau PUR du budget d'appels sortants — côté serveur uniquement.
//
// ── Le problème ───────────────────────────────────────────────────────────
// `GET /api/digital/orders/{ref}` interroge NOWPayments (`getPayment`) à
// chaque requête tant que la commande est `pending` et que `ipn_status` est
// encore `waiting` (voir `reconcileDigitalOrderOnPoll`). Sans garde-fou :
//   • un onglet de suivi laissé ouvert = 4 appels/minute et par onglet ;
//   • six onglets, ou un simple rafraîchissement en boucle, multiplient ;
//   • toute personne qui détient un lien de suivi (référence + jeton) peut
//     marteler la route : chaque appel est un appel SORTANT facturé, et le
//     quota de l'API NOWPayments est partagé par TOUT le site — l'épuiser
//     empêche aussi la création de factures pour les autres clients.
//
// On ne peut pas faire confiance au seul limiteur par IP (le client légitime
// a la même IP que ses propres onglets), d'où deux garde-fous distincts :
//   1. `decideReconcileThrottle` : par commande, on n'interroge le fournisseur
//      qu'à intervalle croissant — l'info la plus fraîche n'est pas
//      nécessaire, la page se met à jour d'elle-même ;
//   2. `decideProviderBudget` : un plafond global d'appels sortants par
//      fenêtre, tous clients confondus, qui dégrade proprement (on sert
//      l'état en base) au lieu de tomber en panne.

/* --------------------------- 1. Throttle par commande --------------------- */

/**
 * Délais (ms) entre deux interrogations du fournisseur pour une même
 * commande. On interroge tôt (l'IPN peut tarder), puis on espace : les
 * premières minutes sont celles où le client regarde, ensuite la commande
 * est de toute façon reprise par le cron.
 */
export const RECONCILE_BACKOFF_MS: readonly number[] = [
  30_000, // 0-1 min : 2 interrogations
  60_000, // 1-3 min
  120_000, // 3-7 min
  300_000, // 7 min - 1 h
  600_000, // au-delà : 10 min
];

export interface ReconcileThrottleInput {
  /** Dernière interrogation du fournisseur pour cette commande (null = jamais). */
  lastSyncAt: Date | number | null | undefined;
  /** Moment de la demande. */
  now?: Date | number;
  /** Dernière activité de la commande (création ou mise à jour). */
  since?: Date | number | null;
  /** Délai minimum supporté par l'appelant (tests, cadence resserrée). */
  minIntervalMs?: number;
}

export interface ReconcileThrottleDecision {
  /** Faut-il interroger le fournisseur MAINTENANT ? */
  sync: boolean;
  /** Millisecondes restantes avant la prochaine interrogation autorisée. */
  waitMs: number;
  /** Index utilisé dans la rampe de backoff (diagnostic). */
  step: number;
}

function toMs(value: Date | number | null | undefined): number | null {
  if (value == null) return null;
  const ms = value instanceof Date ? value.getTime() : value;
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Décide s'il faut interroger le fournisseur pour cette commande.
 *
 * Règles :
 *  - jamais interrogé → on interroge (premier affichage) ;
 *  - premier délai (30 s) juste après la création, puis espacé ;
 *  - horloge incohérente (`lastSyncAt` dans le futur : instance redémarrée,
 *    fuseau, réglage système) → on autorise, plutôt que de bloquer la
 *    commande indéfiniment sur un état figé.
 */
export function decideReconcileThrottle(
  input: ReconcileThrottleInput,
): ReconcileThrottleDecision {
  const now = toMs(input.now) ?? Date.now();
  const lastSync = toMs(input.lastSyncAt);
  const base = toMs(input.since);

  // Jamais interrogée : on interroge (premier affichage de la commande).
  if (lastSync == null) return { sync: true, waitMs: 0, step: 0 };

  const elapsed = now - lastSync;
  // Horloge incohérente (`lastSyncAt` dans le futur : instance redémarrée,
  // réglage système) : autoriser plutôt que figer la commande pour toujours.
  if (elapsed < 0) return { sync: true, waitMs: 0, step: 0 };

  // L'intervalle dépend de l'ÂGE de la commande : on interroge souvent au
  // début (le client regarde), puis de moins en moins (le cron prend le
  // relais pour les commandes payées).
  const age = Math.max(0, now - (base ?? lastSync));
  const step = stepForAge(age);
  const interval = Math.max(input.minIntervalMs ?? 0, RECONCILE_BACKOFF_MS[step]);

  return elapsed >= interval
    ? { sync: true, waitMs: 0, step }
    : { sync: false, waitMs: interval - elapsed, step };
}

/**
 * Palier de backoff selon l'âge de la commande :
 * 0-1 min → 30 s, 1-3 min → 60 s, 3-7 min → 120 s, 7 min-1 h → 300 s,
 * au-delà → 600 s.
 */
export function stepForAge(ageMs: number): number {
  if (!Number.isFinite(ageMs) || ageMs <= 0) return 0;
  const thresholds = [60_000, 180_000, 420_000, 3_600_000];
  const index = thresholds.findIndex((limit) => ageMs < limit);
  return index === -1 ? RECONCILE_BACKOFF_MS.length - 1 : index;
}

/** Intervalle courant (ms) pour une commande de cet âge. */
export function reconcileIntervalMs(ageMs: number): number {
  return RECONCILE_BACKOFF_MS[stepForAge(ageMs)];
}

/* ------------------------- 2. Budget global d'appels --------------------- */

export interface ProviderBudgetInput {
  /** Appels sortants déjà consommés dans la fenêtre courante. */
  used: number;
  /** Plafond de la fenêtre. */
  limit: number;
  /** Fenêtre en millisecondes. */
  windowMs: number;
  /** Début de la fenêtre courante (premier appel). */
  windowStartedAt: Date | number | null | undefined;
  now?: Date | number;
}

export interface ProviderBudgetDecision {
  allow: boolean;
  /** Fenêtre redémarrée : l'appelant remet le compteur à zéro. */
  reset: boolean;
  /** Appels restants après cette décision. */
  remaining: number;
  /** Secondes avant réouverture si refusé. */
  retryAfterSec: number;
}

/**
 * Plafond global : le fournisseur est un bien COMMUN (quota + facturation).
 * Quand le budget est épuisé, on ne met pas le site en panne — le suivi
 * continue de servir l'état en base, simplement sans interrogation distante
 * jusqu'à la fenêtre suivante.
 */
export function decideProviderBudget(input: ProviderBudgetInput): ProviderBudgetDecision {
  const now = toMs(input.now) ?? Date.now();
  const startedAt = toMs(input.windowStartedAt);
  const limit = Math.max(1, Math.floor(input.limit));
  const windowMs = Math.max(1_000, Math.floor(input.windowMs));

  // Fenêtre absente (premier appel) ou expirée → on repart de zéro.
  if (startedAt == null || now - startedAt >= windowMs || now < startedAt) {
    return { allow: true, reset: true, remaining: limit - 1, retryAfterSec: 0 };
  }

  const used = Math.max(0, Math.floor(input.used));
  if (used >= limit) {
    return {
      allow: false,
      reset: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((startedAt + windowMs - now) / 1000)),
    };
  }

  return { allow: true, reset: false, remaining: limit - used - 1, retryAfterSec: 0 };
}

/**
 * Valeurs par défaut du budget : 240 appels / 5 min ≈ 0,8 appel/s.
 * Une boutique de cette taille (quelques commandes par heure) reste très
 * en dessous ; le plafond n'existe que pour les pics et les abus.
 */
export const PROVIDER_BUDGET_DEFAULTS = {
  limit: 240,
  windowMs: 5 * 60 * 1000,
} as const;
