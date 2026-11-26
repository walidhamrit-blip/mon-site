/**
 * Persistance durable de l'intention d'envoi G2G (étape 1 — non raccordée).
 *
 * Ce module est volontairement isolé :
 * - aucun `process.env`, aucun appel HTTP, aucun import du cron ou des routes ;
 * - client SQL injecté uniquement (testable en mémoire et sur `g2g-test`) ;
 * - aucun code cadeau, secret ou URL de base n'y transite ni n'est stocké.
 *
 * Pourquoi le bail de 5 minutes (`delivery_claimed_at`) ne suffit pas :
 * - un worker ralenti, interrompu ou tombé en timeout pendant le POST G2G peut
 *   voir son bail repris 5 minutes plus tard par un second cron ;
 * - seule une ligne permanente commitée dans `g2g_dispatch_intents` AVANT tout
 *   appel réseau garantit qu'un second worker constatera l'intention existante
 *   et ne réémettra jamais le POST (lecture de statut G2G uniquement).
 */

import { createHash } from "node:crypto";

export type DispatchIntentState =
  | "dispatching"
  | "acknowledged"
  | "unknown"
  | "confirmed"
  | "aborted"
  | "manual_review";

export interface DispatchIntentRecord {
  orderId: string;
  deliveryId: string;
  offerId: string;
  supplierOrderId: string;
  quantity: number;
  referenceId: string;
  expiresAt: Date;
  state: DispatchIntentState;
}

export interface ReserveDispatchIntentInput {
  orderId: string;
  deliveryId: string;
  offerId: string;
  supplierOrderId: string;
  quantity: number;
  expiresAt: Date;
  /** Optionnel : calculé de manière déterministe si omis. */
  referenceId?: string;
}

export type SqlRow = Record<string, unknown>;
export interface SqlExecutor {
  query: (sql: string, params: unknown[]) => Promise<{ rows: SqlRow[] }>;
}

const MAX_DATE_MS = 8_640_000_000_000_000;
const RETIRED_OFFERS = new Set(["G1795076410074VF"]);

const ALLOWED_STATES = new Set<DispatchIntentState>([
  "dispatching",
  "acknowledged",
  "unknown",
  "confirmed",
  "aborted",
  "manual_review",
]);

/**
 * Transitions strictement monotones : aucun état ne peut revenir en arrière ni
 * repasser à `dispatching`. Après un crash ou un timeout (`dispatching` ou
 * `unknown`), seule une lecture `g2gGetDeliveryStatus` cohérente peut mener à
 * `confirmed`, sinon `manual_review`.
 */
const ALLOWED_TRANSITIONS: Record<DispatchIntentState, readonly DispatchIntentState[]> = {
  dispatching: ["acknowledged", "unknown", "aborted", "confirmed", "manual_review"],
  acknowledged: ["confirmed", "manual_review"],
  unknown: ["confirmed", "manual_review"],
  aborted: [],
  confirmed: [],
  manual_review: [],
};

function isSafeId(value: unknown, maxLength = 128): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= maxLength &&
    value === value.trim() &&
    !/[\x00-\x20\x7f]/.test(value)
  );
}

function isSafeReferenceId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 16 &&
    value.length <= 128 &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}

/**
 * Convertit l'échéance `expired_at` (millisecondes G2G) en `Date` fiable.
 * Retourne `null` si la valeur est absente, nulle (ex. événement synthétique),
 * négative ou non entière : une échéance `null` interdit tout envoi automatique.
 */
export function parseG2gExpiresAt(rawMs: unknown): Date | null {
  if (typeof rawMs !== "number" || !Number.isSafeInteger(rawMs)) return null;
  if (rawMs <= 0 || rawMs > MAX_DATE_MS) return null;
  const date = new Date(rawMs);
  return Number.isFinite(date.getTime()) ? date : null;
}

/**
 * Construit un `reference_id` déterministe, stable et sans collision pour une
 * paire `(orderId, deliveryId)`. Jamais régénéré aléatoirement : deux appels
 * concurrents sur la même livraison produisent exactement la même référence.
 */
export function buildStableDispatchReferenceId(
  orderId: string,
  deliveryId: string,
): string | null {
  if (!isSafeId(orderId, 128) || !isSafeId(deliveryId, 128)) return null;
  const cleanDelivery = deliveryId
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
  if (!cleanDelivery) return null;
  const digest = createHash("sha256")
    .update(`${orderId}\n${deliveryId}`, "utf8")
    .digest("hex")
    .slice(0, 16);
  return `g2g-ref-${cleanDelivery}-${digest}`;
}

export function canTransitionDispatchIntentState(
  from: DispatchIntentState,
  to: DispatchIntentState,
): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export const RESERVE_DISPATCH_INTENT_SQL = `
  INSERT INTO g2g_dispatch_intents
    (order_id, delivery_id, offer_id, supplier_order_id, quantity, reference_id, expires_at, state)
  SELECT $1, $2, $3, $4, $5, $6, $7::timestamptz, 'dispatching'
  WHERE $7::timestamptz > clock_timestamp()
  ON CONFLICT DO NOTHING
  RETURNING order_id, delivery_id, reference_id, state
`;

export const READ_DISPATCH_INTENT_SQL = `
  SELECT order_id, delivery_id, offer_id, supplier_order_id, quantity, reference_id, expires_at, state
  FROM g2g_dispatch_intents
  WHERE delivery_id = $1
`;

export const TRANSITION_DISPATCH_INTENT_SQL = `
  UPDATE g2g_dispatch_intents
  SET state = $3,
      acknowledged_at = CASE WHEN $3 = 'acknowledged' THEN COALESCE(acknowledged_at, clock_timestamp()) ELSE acknowledged_at END,
      confirmed_at = CASE WHEN $3 = 'confirmed' THEN COALESCE(confirmed_at, clock_timestamp()) ELSE confirmed_at END,
      last_detail = $5,
      updated_at = clock_timestamp()
  WHERE order_id = $1
    AND delivery_id = $2
    AND state = ANY($4::text[])
  RETURNING state
`;

export type ReserveDispatchIntentOutcome =
  | { status: "committed"; referenceId: string }
  | { status: "not_reserved" }
  | { status: "invalid"; reason: string }
  | { status: "uncertain" };

/**
 * Réserve et commite l'unique intention d'envoi sur une connexion PostgreSQL
 * exclusive (`pg.Client` dédié, jamais `pool.query`).
 *
 * - `committed` : l'unique créneau d'envoi a été réservé et commité ;
 * - `not_reserved` : déjà réservé par un autre traitement ou échéance dépassée ;
 * - `invalid` : paramètres refusés avant toute requête SQL ;
 * - `uncertain` : erreur SQL ou réponse `COMMIT` perdue — ne JAMAIS envoyer,
 *   escalader en revue humaine après lecture éventuelle du statut G2G.
 */
export async function reserveDispatchIntentCommitted(
  exclusiveClient: SqlExecutor,
  input: ReserveDispatchIntentInput,
): Promise<ReserveDispatchIntentOutcome> {
  if (!isSafeId(input.orderId, 128)) return { status: "invalid", reason: "invalid_order_id" };
  if (!isSafeId(input.deliveryId, 128)) return { status: "invalid", reason: "invalid_delivery_id" };
  const offerId = typeof input.offerId === "string" ? input.offerId.trim().toUpperCase() : "";
  if (!isSafeId(offerId, 64) || !/^G[0-9A-Z]{8,63}$/.test(offerId)) {
    return { status: "invalid", reason: "invalid_offer_id" };
  }
  if (RETIRED_OFFERS.has(offerId)) {
    return { status: "invalid", reason: "retired_offer" };
  }
  if (!isSafeId(input.supplierOrderId, 128)) {
    return { status: "invalid", reason: "invalid_supplier_order_id" };
  }
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 100) {
    return { status: "invalid", reason: "invalid_quantity" };
  }
  if (!(input.expiresAt instanceof Date) || !Number.isFinite(input.expiresAt.getTime())) {
    return { status: "invalid", reason: "invalid_expires_at" };
  }

  const derivedReference = buildStableDispatchReferenceId(input.orderId, input.deliveryId);
  const referenceId = input.referenceId ?? derivedReference ?? "";
  if (!isSafeReferenceId(referenceId)) {
    return { status: "invalid", reason: "invalid_reference_id" };
  }

  try {
    await exclusiveClient.query("BEGIN", []);
    const inserted = await exclusiveClient.query(RESERVE_DISPATCH_INTENT_SQL, [
      input.orderId,
      input.deliveryId,
      offerId,
      input.supplierOrderId,
      input.quantity,
      referenceId,
      input.expiresAt,
    ]);
    await exclusiveClient.query("COMMIT", []);
    if (inserted.rows.length !== 1) {
      return { status: "not_reserved" };
    }
    const persistedRef = inserted.rows[0]?.reference_id;
    if (typeof persistedRef !== "string" || persistedRef !== referenceId) {
      return { status: "uncertain" };
    }
    return { status: "committed", referenceId: persistedRef };
  } catch {
    try {
      await exclusiveClient.query("ROLLBACK", []);
    } catch {
      // Un échec de ROLLBACK après erreur garde le résultat strictement incertain.
    }
    return { status: "uncertain" };
  }
}

export type ReadDispatchIntentOutcome =
  | { kind: "none" }
  | { kind: "found"; intent: DispatchIntentRecord }
  | { kind: "corrupt"; reason: string };

/**
 * Relit l'intention durable d'une livraison et contrôle sa cohérence stricte
 * avec la commande attendue. Toute divergence renvoie `corrupt` (-> revue).
 */
export async function readDispatchIntent(
  executor: SqlExecutor,
  expected: {
    orderId: string;
    deliveryId: string;
    offerId: string;
    supplierOrderId: string;
    quantity: number;
  },
): Promise<ReadDispatchIntentOutcome> {
  if (!isSafeId(expected.deliveryId, 128)) {
    return { kind: "corrupt", reason: "invalid_delivery_id" };
  }
  const result = await executor.query(READ_DISPATCH_INTENT_SQL, [expected.deliveryId]);
  if (result.rows.length === 0) return { kind: "none" };
  if (result.rows.length > 1) return { kind: "corrupt", reason: "duplicate_rows" };

  const row = result.rows[0];
  const state = row.state as DispatchIntentState;
  const expiresAt = row.expires_at instanceof Date ? row.expires_at : new Date(String(row.expires_at ?? ""));
  const referenceId = typeof row.reference_id === "string" ? row.reference_id : "";

  if (
    row.order_id !== expected.orderId ||
    row.delivery_id !== expected.deliveryId ||
    row.offer_id !== expected.offerId.trim().toUpperCase() ||
    row.supplier_order_id !== expected.supplierOrderId ||
    row.quantity !== expected.quantity ||
    !isSafeReferenceId(referenceId) ||
    !Number.isFinite(expiresAt.getTime()) ||
    !ALLOWED_STATES.has(state)
  ) {
    return { kind: "corrupt", reason: "identity_mismatch" };
  }

  return {
    kind: "found",
    intent: {
      orderId: row.order_id,
      deliveryId: row.delivery_id,
      offerId: row.offer_id as string,
      supplierOrderId: row.supplier_order_id,
      quantity: row.quantity,
      referenceId,
      expiresAt,
      state,
    },
  };
}

function sanitizeDetail(detail: string | undefined): string | null {
  if (!detail) return null;
  const cleaned = detail.replace(/[\x00-\x1f\x7f]+/g, " ").trim().slice(0, 500);
  return cleaned || null;
}

/**
 * Applique une transition d'état autorisée. Refuse toute transition arrière ou
 * ré-ouverture d'envoi.
 */
export async function transitionDispatchIntentState(
  executor: SqlExecutor,
  input: {
    orderId: string;
    deliveryId: string;
    fromStates: readonly DispatchIntentState[];
    toState: DispatchIntentState;
    detail?: string;
  },
): Promise<"updated" | "not_updated" | "forbidden"> {
  if (
    !isSafeId(input.orderId, 128) ||
    !isSafeId(input.deliveryId, 128) ||
    input.fromStates.length === 0 ||
    !input.fromStates.every((from) => canTransitionDispatchIntentState(from, input.toState))
  ) {
    return "forbidden";
  }

  const updated = await executor.query(TRANSITION_DISPATCH_INTENT_SQL, [
    input.orderId,
    input.deliveryId,
    input.toState,
    [...input.fromStates],
    sanitizeDetail(input.detail),
  ]);
  return updated.rows.length === 1 ? "updated" : "not_updated";
}
