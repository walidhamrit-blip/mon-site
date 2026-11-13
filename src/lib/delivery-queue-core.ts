// Noyau PUR de la file de livraison (webhooks NOWPayments → fournisseurs).
//
// Pourquoi : un client paie en crypto, puis l'appel vers FazerCards (ou
// Reloadly) échoue — timeout, 5xx, rupture de stock, solde insuffisant.
// Sans file d'attente, la commande payée restait bloquée jusqu'à ce que le
// client rouvre sa page de suivi ou que le cron quotidien passe.
//
// Ce module décide, SANS base ni réseau (importable par un composant client
// et testé seul) :
//   - les statuts granulaires de fulfillment (`pending_payment`,
//     `paid_fulfilling`, `delivered`, `manual_review`) et leur correspondance
//     avec les statuts historiques (`pending`, `paid`, `delivered`, `manual`,
//     `failed`) encore stockés dans `digital_orders.status` ;
//   - la politique de retry (backoff exponentiel borné + jitter) ;
//   - la classification des erreurs fournisseur (transitoire → réessayer,
//     permanente → revue manuelle, en attente → relecture courte) ;
//   - les clés d'idempotence (commande + webhook).
//
// L'exécution (base, réseau, Telegram) vit dans `delivery-queue.ts`.

/* ------------------------- Statuts granulaires -------------------------- */

/**
 * Statuts granulaires de fulfillment (colonne `fulfillment_status`).
 *
 * Ils décrivent où en est la LIVRAISON, pas le paiement :
 *  - `pending_payment` : facture crypto émise, fonds non confirmés ;
 *  - `paid_fulfilling`  : paiement confirmé, achat fournisseur en cours
 *    (y compris retries programmés) ;
 *  - `delivered`        : code transmis au client (terminal) ;
 *  - `manual_review`    : échec définitif ou retries épuisés — un humain
 *    doit acheter le code et le transmettre (ou rembourser).
 */
export const FULFILLMENT_STATUSES = [
  "pending_payment",
  "paid_fulfilling",
  "delivered",
  "manual_review",
] as const;

export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];

export const FULFILLMENT_STATUS_LABELS: Record<FulfillmentStatus, string> = {
  pending_payment: "En attente de paiement",
  paid_fulfilling: "Payé — livraison en cours",
  delivered: "Livré",
  manual_review: "Revue manuelle requise",
};

export const FULFILLMENT_STATUS_TONES: Record<FulfillmentStatus, string> = {
  pending_payment: "bg-amber-50 text-amber-800 border-amber-200",
  paid_fulfilling: "bg-sky-50 text-sky-800 border-sky-200",
  delivered: "bg-emerald-50 text-emerald-800 border-emerald-200",
  manual_review: "bg-orange-50 text-orange-800 border-orange-200",
};

/** Statut granulaire normalisé (valeur inconnue → `pending_payment`). */
export function normalizeFulfillmentStatus(
  value: string | null | undefined,
): FulfillmentStatus {
  return (FULFILLMENT_STATUSES as readonly string[]).includes(value ?? "")
    ? (value as FulfillmentStatus)
    : "pending_payment";
}

/**
 * Correspondance historique → granulaire.
 *
 * La colonne `status` historique reste la source de vérité pour le code
 * existant (admin, suivi client, reprise) ; `fulfillment_status` est la
 * vue granulaire demandée pour la file de livraison. Les deux colonnes
 * sont écrites ensemble à chaque transition (voir `delivery-queue.ts`).
 */
export function fulfillmentStatusFromLegacy(
  legacy: string | null | undefined,
): FulfillmentStatus {
  switch ((legacy ?? "").trim()) {
    case "pending":
      return "pending_payment";
    case "paid":
      return "paid_fulfilling";
    case "delivered":
      return "delivered";
    case "manual":
    case "failed":
      // `failed` = achat refusé par le fournisseur : c'est aussi une revue
      // manuelle (remplacement ou remboursement), pas un état terminal
      // silencieux.
      return "manual_review";
    default:
      return "pending_payment";
  }
}

/** Correspondance granulaire → historique (pour les écritures duales). */
export function legacyStatusFromFulfillment(
  fulfillment: string | null | undefined,
): "pending" | "paid" | "delivered" | "manual" {
  switch (normalizeFulfillmentStatus(fulfillment)) {
    case "pending_payment":
      return "pending";
    case "paid_fulfilling":
      return "paid";
    case "delivered":
      return "delivered";
    case "manual_review":
      return "manual";
  }
}

/* --------------------------- Machine à états ---------------------------- */

/** Événements qui font avancer le fulfillment. */
export type FulfillmentEvent =
  | "payment_confirmed"
  | "delivery_started"
  | "delivery_succeeded"
  | "delivery_failed_transient"
  | "delivery_failed_permanent"
  | "delivery_awaiting"
  | "manual_delivered";

/**
 * Transition granulaire. `delivered` est terminal : aucun événement ne
 * le fait reculer (un code déjà transmis ne se « dé-livre » jamais).
 * Un échec transitoire ne change PAS le statut (on reste en
 * `paid_fulfilling`, le retry est programmé) ; seul l'épuisement des
 * retries ou un échec permanent bascule en `manual_review`.
 */
export function nextFulfillmentStatus(
  current: string | null | undefined,
  event: FulfillmentEvent,
): FulfillmentStatus {
  const from = normalizeFulfillmentStatus(current);
  if (from === "delivered") return "delivered";

  switch (event) {
    case "payment_confirmed":
      return from === "pending_payment" ? "paid_fulfilling" : from;
    case "delivery_succeeded":
    case "manual_delivered":
      return "delivered";
    case "delivery_failed_permanent":
      return "manual_review";
    case "delivery_started":
    case "delivery_failed_transient":
    case "delivery_awaiting":
      // En cours (ou retry programmé) : on reste en `paid_fulfilling`
      // dès que le paiement est confirmé.
      return from === "pending_payment" ? "paid_fulfilling" : from;
  }
}

/* --------------------------- Politique de retry ------------------------- */

/** Tentatives fournisseur maximales avant bascule en revue manuelle. */
export const DELIVERY_MAX_ATTEMPTS = 6;

/** Délai de base entre deux retries (1re relance après 60 s). */
export const DELIVERY_RETRY_BASE_MS = 60_000;

/** Délai maximal entre deux retries (30 min). */
export const DELIVERY_RETRY_CAP_MS = 30 * 60_000;

/** Jitter maximal (±20 %) pour éviter les rafales synchronisées. */
export const DELIVERY_RETRY_JITTER_RATIO = 0.2;

/** Durée du bail de traitement d'un job (au-delà, il est réclamable). */
export const JOB_CLAIM_LEASE_MS = 5 * 60_000;

/**
 * Délai avant la prochaine tentative après `attempt` échecs (1 = premier
 * échec). Backoff exponentiel borné : 60 s, 120 s, 240 s, 480 s, 960 s,
 * puis 30 min plafonnées. `random` (0..1) permet des tests déterministes ;
 * par défaut, jitter aléatoire ±20 %.
 */
export function deliveryRetryDelayMs(
  attempt: number,
  random?: number,
): number {
  const safeAttempt = Number.isFinite(attempt) ? Math.max(1, Math.trunc(attempt)) : 1;
  const exponential = DELIVERY_RETRY_BASE_MS * 2 ** (safeAttempt - 1);
  const capped = Math.min(DELIVERY_RETRY_CAP_MS, exponential);
  const roll = random ?? Math.random();
  const clamped = Math.min(1, Math.max(0, roll));
  const jitter = 1 + (clamped * 2 - 1) * DELIVERY_RETRY_JITTER_RATIO;
  return Math.round(capped * jitter);
}

/** Date de la prochaine tentative après `attempt` échecs. */
export function nextDeliveryRetryAt(
  attempt: number,
  now: number = Date.now(),
  random?: number,
): Date {
  return new Date(now + deliveryRetryDelayMs(attempt, random));
}

/** Reste-t-il des retries autorisés après `attempts` tentatives ? */
export function shouldRetryDelivery(
  attempts: number,
  maxAttempts: number = DELIVERY_MAX_ATTEMPTS,
): boolean {
  const safeAttempts = Number.isFinite(attempts) ? Math.max(0, Math.trunc(attempts)) : 0;
  const safeMax = Number.isFinite(maxAttempts) ? Math.max(1, Math.trunc(maxAttempts)) : DELIVERY_MAX_ATTEMPTS;
  return safeAttempts < safeMax;
}

/* --------------------- Classification des erreurs ----------------------- */

/**
 * Classe d'une erreur fournisseur :
 *  - `transient`  : panne réseau, timeout, 429, 5xx → réessayer (backoff) ;
 *  - `permanent`  : 4xx métier (mauvais produit, identifiant refusé, rupture
 *    de stock, solde insuffisant) → revue manuelle immédiate, réessayer
 *    ne changerait rien ;
 *  - `awaiting`   : le fournisseur traite encore (processing/pending) →
 *    relecture courte, sans compter comme un échec métier.
 */
export type DeliveryErrorClass = "transient" | "permanent" | "awaiting";

export interface SupplierErrorSignal {
  /** Code HTTP (null = erreur réseau/timeout, avant toute réponse). */
  status?: number | null;
  /** Code métier du fournisseur (ex. `WRONG_PRODUCT_PRICE`). */
  code?: string | null;
  /** Message brut (pour les statuts « processing » sans code HTTP). */
  message?: string | null;
}

const AWAITING_HINTS = [
  "processing",
  "pending",
  "awaiting",
  "in_progress",
  "en cours",
  "en attente",
];

const PERMANENT_HINTS = [
  "out of stock",
  "out_of_stock",
  "rupture",
  "insufficient balance",
  "insufficient_balance",
  "solde insuffisant",
  "wrong_product_price",
  "invalid",
  "refused",
  "refusé",
  "not found",
  "introuvable",
];

/**
 * Classifie une erreur fournisseur. Prudence volontaire : sans code HTTP
 * ni hint connu, on choisit `transient` (réessayer puis passer en revue
 * manuelle) plutôt que d'abandonner une commande payée sur un doute.
 */
export function classifyDeliveryError(
  signal: SupplierErrorSignal,
): DeliveryErrorClass {
  const status =
    signal.status != null && Number.isFinite(Number(signal.status))
      ? Number(signal.status)
      : null;
  const code = (signal.code ?? "").trim().toLowerCase();
  const message = (signal.message ?? "").trim().toLowerCase();
  const haystack = `${code} ${message}`.trim();

  // Le fournisseur dit « en cours » : ce n'est pas une erreur.
  if (AWAITING_HINTS.some((hint) => haystack.includes(hint))) {
    return "awaiting";
  }

  // Un motif métier explicite (rupture de stock, solde insuffisant, prix
  // refusé) prime sur l'absence de code HTTP : réessayer ne changera rien,
  // même si l'erreur est arrivée sous forme de message.
  if (PERMANENT_HINTS.some((hint) => haystack.includes(hint))) return "permanent";

  // Erreur réseau / timeout : aucun code HTTP n'est jamais arrivé.
  if (status === null) return "transient";

  // Rate limit et erreurs serveur : transitoires par définition.
  if (status === 429 || status === 408 || status >= 500) return "transient";

  // 4xx métier : réessayer ne change rien (produit, identifiant, stock,
  // solde, authentification). Les hints confirment, le code suffit.
  if (status >= 400 && status < 500) return "permanent";

  // 2xx/3xx avec un message d'erreur : on ne sait pas — on réessaie.
  return "transient";
}

/* ------------------- Décision : quoi faire de cette commande ------------------ */

/** Colonnes minimales de `digital_orders` nécessaires à la décision. */
export interface DeliverySignalInput {
  /** Statut historique : pending | paid | manual | delivered | failed. */
  status: string | null | undefined;
  productSlug?: string | null;
  productId?: string | null;
  /** Configuration de la fiche : auto | manual. */
  fulfillment?: string | null;
  /** Produit fournisseur relié (Reloadly) ou catégorie (FazerCards). */
  reloadlyProductId?: number | null;
  reloadlyTransactionId?: string | null;
  reloadlyStatus?: string | null;
  attempts?: number | null;
  lastError?: string | null;
  /** Horodatage de livraison (non nul = codes envoyés). */
  deliveredAt?: Date | string | null;
}

export interface DeliverySignal {
  /**
   *  - `retry`    : échec transitoire — réessayer (backoff) ;
   *  - `awaiting` : le fournisseur traite encore — relecture courte ;
   *  - `manual`   : intervention humaine (échec permanent, config) ;
   *  - `done`     : livrée, ou rien à livrer automatiquement.
   */
  kind: "retry" | "awaiting" | "manual" | "done";
  reason: string;
  supplier: "fazercards" | "reloadly";
}

/** Préfixes de slug du catalogue live FazerCards. */
const FAZERCARDS_SLUG_PREFIXES = ["fzr-topup-", "fzr-giftcard-", "fzr-gamekey-"];

/**
 * Fournisseur d'une commande, sans toucher à la base.
 *
 * Même règle que `digitalOrderSupplier` (`digital-orders.ts`) : une
 * commande du catalogue live (`fzr-…`) est achetée chez FazerCards, tout
 * le reste relève du fournisseur historique (Reloadly, retiré).
 */
export function supplierFromOrder(order: {
  productSlug?: string | null;
  productId?: string | null;
}): "fazercards" | "reloadly" {
  const slug = (order.productSlug ?? "").trim().toLowerCase();
  const id = (order.productId ?? "").trim().toLowerCase();
  const prefixes = FAZERCARDS_SLUG_PREFIXES;
  return prefixes.some((prefix) => slug.startsWith(prefix)) ||
    prefixes.some((prefix) => id.startsWith(prefix))
    ? "fazercards"
    : "reloadly";
}

/**
 * Décide ce que la livraison d'une commande doit faire MAINTENANT.
 *
 * Cette fonction est le cœur de la résilience demandée : elle remplace un
 * « ça a échoué, on ne saura jamais » par une décision explicite que la
 * file peut rejouer, que le cron peut réveiller et que Telegram peut
 * signaler.
 *
 * Règles, dans l'ordre :
 *  1. livrée (statut `delivered` ou `deliveredAt` posé) → `done` ;
 *  2. paiement non confirmé (`pending`) → `done` (rien à faire, pas
 *     d'achat sans argent — garde-fou absolu) ;
 *  3. commande en `manual`/`failed` → `manual` (un humain a la main) ;
 *  4. dernier motif « en cours » chez le fournisseur → `awaiting` ;
 *  5. dernier motif d'échec PERMANENT (stock, identifiant, config, solde)
 *     → `manual` immédiat : réessayer ne changerait rien ;
 *  6. reste-t-il des tentatives ? → `retry` ;
 *  7. sinon → `manual` (retries épuisés).
 */
export function deliveryOutcomeSignal(
  order: DeliverySignalInput,
  maxAttempts: number = DELIVERY_MAX_ATTEMPTS,
): DeliverySignal {
  const supplier = supplierFromOrder(order);
  const status = (order.status ?? "").trim();

  if (status === "delivered" || order.deliveredAt) {
    return { kind: "done", reason: "Déjà livrée.", supplier };
  }
  if (status === "pending") {
    return { kind: "done", reason: "Paiement non confirmé — aucun achat.", supplier };
  }
  if (status === "manual" || status === "failed") {
    return {
      kind: "manual",
      reason: order.lastError?.trim() || "Revue manuelle en cours.",
      supplier,
    };
  }

  const lastError = (order.lastError ?? "").trim();
  const attempts = Number(order.attempts ?? 0);
  const supplierStatus = (order.reloadlyStatus ?? "").trim().toLowerCase();

  if (AWAITING_HINTS.some((hint) => lastError.toLowerCase().includes(hint))) {
    return { kind: "awaiting", reason: lastError, supplier };
  }
  if (supplierStatus === "processing" || supplierStatus === "pending") {
    return {
      kind: "awaiting",
      reason: `Fournisseur : ${supplierStatus}.`,
      supplier,
    };
  }

  if (lastError) {
    const cls = classifyDeliveryError({ message: lastError });
    if (cls === "permanent") {
      return { kind: "manual", reason: lastError, supplier };
    }
  }

  if (shouldRetryDelivery(attempts, maxAttempts)) {
    return {
      kind: "retry",
      reason:
        lastError ||
        (attempts > 0
          ? `Tentative ${attempts}/${maxAttempts} sans code — nouvel essai.`
          : "Aucune tentative encore effectuée."),
      supplier,
    };
  }

  return {
    kind: "manual",
    reason:
      lastError ||
      `${maxAttempts} tentatives sans livraison — acheter le code à la main ou rembourser.`,
    supplier,
  };
}

/* ----------------------------- Idempotence ------------------------------ */

/**
 * Clé d'idempotence d'une commande : sa référence publique (`DGC-…`).
 *
 * C'est la même valeur déjà transmise aux fournisseurs (en-tête
 * `Idempotency-Key` FazerCards, `customIdentifier` Reloadly) : la file
 * ne fait que la rendre UNIQUE en base, pour qu'un double IPN, un double
 * cron ou un double clic admin ne puisse jamais produire deux achats.
 */
export function deliveryIdempotencyKey(orderRef: string): string {
  return (orderRef ?? "").trim().toUpperCase();
}

/**
 * Clé d'idempotence d'un webhook : `fournisseur:identifiant:statut`.
 *
 * NOWPayments renvoie le même événement plusieurs fois (retry réseau,
 * `finished` répété) : la même clé = même événement, déjà traité.
 * Un changement de statut (`waiting` → `finished`) est un événement
 * différent, donc une clé différente.
 */
export function webhookEventKey(
  provider: string,
  eventId: string,
  status: string,
): string {
  const clean = (value: string) =>
    (value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._:-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120);
  const parts = [clean(provider), clean(eventId), clean(status)].filter(Boolean);
  return parts.join(":").slice(0, 200);
}

/* ------------------------------ Jobs de file ---------------------------- */

/** Statuts d'un job de livraison (`delivery_jobs.status`). */
export const DELIVERY_JOB_STATUSES = [
  "queued",
  "processing",
  "done",
  "failed",
  "dead_letter",
] as const;

export type DeliveryJobStatus = (typeof DELIVERY_JOB_STATUSES)[number];

/**
 * Un job est-il dû ? `queued` dont l'heure de retry est passée, ou
 * `processing` dont le bail est expiré (worker mort en cours de route).
 */
export function isDeliveryJobDue(
  job: {
    status: string | null | undefined;
    nextRetryAt?: Date | string | number | null;
    claimedAt?: Date | string | number | null;
  },
  now: number = Date.now(),
): boolean {
  const status = (job.status ?? "").trim();
  if (status === "queued") {
    const due = toMs(job.nextRetryAt);
    return due === 0 || due <= now;
  }
  if (status === "processing") {
    const claimed = toMs(job.claimedAt);
    return claimed === 0 || now - claimed > JOB_CLAIM_LEASE_MS;
  }
  return false;
}

function toMs(value: Date | string | number | null | undefined): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}
