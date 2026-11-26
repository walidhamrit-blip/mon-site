/**
 * Orchestrateur du parcours de livraison pilote G2G (étape 2 — derrière garde-fous).
 *
 * Ce module ne dépend ni de `process.env`, ni de `fetch`, ni du pool global :
 * tous les effets externes sont injectés via `PilotDeliveryPorts`.
 * Seul `src/lib/g2g-delivery.ts` lui câble les vrais clients, uniquement
 * derrière les trois verrous (`automaticDeliveryVerified()`,
 * `G2G_AUTO_DELIVERY === "1"` et `G2G_PILOT_OFFER_ID === "G1795521210943KM"`).
 *
 * Garanties :
 * - aucun code cadeau n'est stocké, journalisé ni inclus dans un motif ;
 * - un seul créneau d'envoi durable par `(orderId, deliveryId)`, commité sur
 *   connexion PostgreSQL exclusive AVANT tout `POST` G2G ;
 * - relecture fraîche du statut G2G et de l'horloge entre `COMMIT` et `POST` ;
 * - un accusé HTTP du `POST` ne confirme jamais la livraison : seule une
 *   lecture séparée `getDeliveryStatus` (`delivered`, `delivered_qty === 1`)
 *   peut conclure `delivered` ;
 * - tout résultat ambigu (`dispatching`, `unknown`, timeout, crash) interdit
 *   définitivement une réémission automatique du `POST`.
 */

import {
  assessG2gDeliveryStatus,
  assessSupplierGiftCard,
} from "./g2g-delivery-assessment.ts";
import { preparePilotDeliveryRequest } from "./g2g-delivery-request-prototype.ts";
import {
  buildStableDispatchReferenceId,
  type DispatchIntentState,
  type ReadDispatchIntentOutcome,
  type ReserveDispatchIntentInput,
  type ReserveDispatchIntentOutcome,
} from "./g2g-dispatch-intent.ts";
import {
  PILOT_CANDIDATE_OFFER_ID,
  isRetiredG2gOffer,
  isSyntheticDelivery,
} from "./g2g-pilot.ts";

export interface PilotDeliveryItem {
  orderId: string;
  deliveryId: string;
  offerId: string;
  requestedQty: number;
  supplierOrderRef: string | null | undefined;
  /** Échéance persistée de l'événement `order.api_delivery` (`NULL` = inconnue -> refus). */
  expiresAt: Date | null | undefined;
}

export interface PilotDeliveryPorts {
  now: () => number;
  readDispatchIntent: (expected: {
    orderId: string;
    deliveryId: string;
    offerId: string;
    supplierOrderId: string;
    quantity: number;
  }) => Promise<ReadDispatchIntentOutcome>;
  reserveDispatchIntent: (
    input: ReserveDispatchIntentInput,
  ) => Promise<ReserveDispatchIntentOutcome>;
  transitionDispatchIntent: (input: {
    orderId: string;
    deliveryId: string;
    fromStates: readonly DispatchIntentState[];
    toState: DispatchIntentState;
    detail?: string;
  }) => Promise<"updated" | "not_updated" | "forbidden">;
  getDeliveryStatus: (orderId: string, deliveryId: string) => Promise<unknown>;
  getSupplierOrder: (supplierOrderId: string) => Promise<unknown>;
  deliverCodes: (input: {
    orderId: string;
    deliveryId: string;
    codes: { content: string; reference_id: string }[];
  }) => Promise<unknown>;
}

export type PilotOrchestratorResult =
  | { kind: "delivered"; codes: number }
  | { kind: "awaiting_codes"; reason: string }
  | { kind: "awaiting_confirmation"; reason: string }
  | { kind: "no_order_ref" }
  | { kind: "manual_review"; reason: string }
  | { kind: "failed"; reason: string };

function isSafeAsciiId(value: unknown, maxLen = 128): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= maxLen &&
    value === value.trim() &&
    !/[\x00-\x20\x7f]/.test(value)
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Vérifie que `payload.offer_id`, lorsqu'il est fourni par G2G, correspond au pilote. */
function remoteOfferConsistent(remoteResponse: unknown, expectedOfferId: string): boolean {
  const root = asRecord(remoteResponse);
  const payload = asRecord(root?.payload);
  if (!payload || payload.offer_id === undefined || payload.offer_id === null) {
    return true;
  }
  return typeof payload.offer_id === "string" && payload.offer_id.trim().toUpperCase() === expectedOfferId;
}

/** Vérifie que `order.kind`, lorsqu'il figure dans la réponse FazerCards, vaut `gift_card`. */
function supplierKindConsistent(supplierResponse: unknown): boolean {
  const root = asRecord(supplierResponse);
  const order = asRecord(root?.order);
  if (!order || order.kind === undefined || order.kind === null) {
    return true;
  }
  return order.kind === "gift_card";
}

/** Vérifie l'enveloppe d'accusé d'un POST de livraison G2G (sans valoir confirmation finale). */
function isValidG2gPostAck(ack: unknown, expectedDeliveryId: string): boolean {
  const root = asRecord(ack);
  if (!root || root.code !== "20000001") return false;
  const payload = asRecord(root.payload);
  if (payload && payload.delivery_id !== undefined && payload.delivery_id !== null) {
    return payload.delivery_id === expectedDeliveryId;
  }
  return true;
}

async function safeTransition(
  ports: PilotDeliveryPorts,
  input: {
    orderId: string;
    deliveryId: string;
    fromStates: readonly DispatchIntentState[];
    toState: DispatchIntentState;
    detail: string;
  },
): Promise<boolean> {
  try {
    const res = await ports.transitionDispatchIntent(input);
    return res === "updated";
  } catch {
    return false;
  }
}

/**
 * Lecture séparée du statut G2G après un envoi (ou une reprise d'intention
 * `dispatching` / `acknowledged` / `unknown`). N'émet JAMAIS de `POST`.
 */
async function verifyRemoteDeliveryAfterAttempt(input: {
  orderId: string;
  deliveryId: string;
  offerId: string;
  expiresAt: Date;
  ports: PilotDeliveryPorts;
  postOutcomeNote: string;
}): Promise<PilotOrchestratorResult> {
  const { orderId, deliveryId, offerId, expiresAt, ports, postOutcomeNote } = input;
  let remoteStatus: unknown;
  try {
    remoteStatus = await ports.getDeliveryStatus(orderId, deliveryId);
  } catch {
    const now = ports.now();
    if (!Number.isFinite(now) || now <= 0 || now >= expiresAt.getTime()) {
      await safeTransition(ports, {
        orderId,
        deliveryId,
        fromStates: ["dispatching", "acknowledged", "unknown"],
        toState: "manual_review",
        detail: "Statut G2G illisible après échéance sur un envoi antérieur.",
      });
      return {
        kind: "manual_review",
        reason: "Statut G2G illisible après échéance sur un envoi antérieur : revue manuelle requise.",
      };
    }
    return {
      kind: "awaiting_confirmation",
      reason: `${postOutcomeNote} Lecture du statut G2G temporairement indisponible ; nouvelle vérification programmée sans réémission.`,
    };
  }

  if (!remoteOfferConsistent(remoteStatus, offerId)) {
    await safeTransition(ports, {
      orderId,
      deliveryId,
      fromStates: ["dispatching", "acknowledged", "unknown"],
      toState: "manual_review",
      detail: "Offre G2G incohérente lors du contrôle post-envoi.",
    });
    return {
      kind: "manual_review",
      reason: "Offre G2G distante incohérente après envoi : rapprochement manuel requis.",
    };
  }

  const verdict = assessG2gDeliveryStatus(remoteStatus, orderId, deliveryId, 1);
  if (verdict === "confirmed") {
    const transitioned = await safeTransition(ports, {
      orderId,
      deliveryId,
      fromStates: ["dispatching", "acknowledged", "unknown"],
      toState: "confirmed",
      detail: "Livraison confirmée par lecture séparée du statut G2G (delivered, qté 1).",
    });
    if (!transitioned) {
      return {
        kind: "awaiting_confirmation",
        reason: "Livraison constatée chez G2G, mais mise à jour locale en attente de confirmation.",
      };
    }
    return { kind: "delivered", codes: 1 };
  }

  if (verdict === "waiting") {
    const now = ports.now();
    if (!Number.isFinite(now) || now <= 0 || now >= expiresAt.getTime()) {
      await safeTransition(ports, {
        orderId,
        deliveryId,
        fromStates: ["dispatching", "acknowledged", "unknown"],
        toState: "manual_review",
        detail: "Échéance G2G dépassée sans confirmation finale après envoi.",
      });
      return {
        kind: "manual_review",
        reason: "Échéance G2G atteinte sans statut delivered après envoi : rapprochement manuel requis.",
      };
    }
    return {
      kind: "awaiting_confirmation",
      reason: `${postOutcomeNote} Statut G2G encore en attente (aucune réémission automatique).`,
    };
  }

  await safeTransition(ports, {
    orderId,
    deliveryId,
    fromStates: ["dispatching", "acknowledged", "unknown"],
    toState: "manual_review",
    detail: "Statut G2G partiel, annulé, expiré ou incohérent après envoi.",
  });
  return {
    kind: "manual_review",
    reason: "Statut G2G final non conforme (partiel, expiré ou annulé) après envoi : rapprochement manuel requis.",
  };
}

export async function runPilotDeliveryAttempt(
  item: PilotDeliveryItem,
  ports: PilotDeliveryPorts,
  options: { safetyBufferMs?: number } = {},
): Promise<PilotOrchestratorResult> {
  if (isSyntheticDelivery(item.deliveryId, item.orderId)) {
    return {
      kind: "manual_review",
      reason: "Événement synthétique de diagnostic : aucun envoi réel.",
    };
  }
  if (isRetiredG2gOffer(item.offerId)) {
    return {
      kind: "manual_review",
      reason: "Offre G2G retirée et irrécupérable : envoi interdit.",
    };
  }
  const offerId = (item.offerId ?? "").trim().toUpperCase();
  if (offerId !== PILOT_CANDIDATE_OFFER_ID) {
    return {
      kind: "manual_review",
      reason: `Offre ${offerId || "?"} hors pilote unique ${PILOT_CANDIDATE_OFFER_ID} : envoi interdit.`,
    };
  }
  if (item.requestedQty !== 1) {
    return {
      kind: "manual_review",
      reason: "Quantité différente de 1 : pilote strictement unitaire.",
    };
  }

  const supplierOrderRef = (item.supplierOrderRef ?? "").trim();
  if (!supplierOrderRef) {
    return { kind: "no_order_ref" };
  }
  if (
    !isSafeAsciiId(item.orderId, 128) ||
    !isSafeAsciiId(item.deliveryId, 128) ||
    !isSafeAsciiId(supplierOrderRef, 128)
  ) {
    return {
      kind: "manual_review",
      reason: "Identifiants de commande, livraison ou référence fournisseur invalides.",
    };
  }

  const { orderId, deliveryId } = item;
  const safetyBufferMs =
    typeof options.safetyBufferMs === "number" &&
    Number.isFinite(options.safetyBufferMs) &&
    options.safetyBufferMs >= 0
      ? options.safetyBufferMs
      : 0;

  // 1. Contrôle préalable de toute intention durable déjà enregistrée.
  //    Si une ligne existe (même après crash ou bail de file expiré), on ne lit
  //    JAMAIS les codes fournisseur et on n'émet JAMAIS de second POST.
  let existingIntent: ReadDispatchIntentOutcome;
  try {
    existingIntent = await ports.readDispatchIntent({
      orderId,
      deliveryId,
      offerId,
      supplierOrderId: supplierOrderRef,
      quantity: 1,
    });
  } catch {
    return {
      kind: "manual_review",
      reason: "Lecture de l'intention d'envoi durable indisponible : aucun envoi tenté.",
    };
  }

  if (existingIntent.kind === "corrupt") {
    return {
      kind: "manual_review",
      reason: "Intention d'envoi incohérente avec la commande : rapprochement manuel requis.",
    };
  }

  if (existingIntent.kind === "found") {
    const { state, expiresAt: intentExpiresAt } = existingIntent.intent;
    if (state === "confirmed") {
      return { kind: "delivered", codes: 1 };
    }
    if (state === "aborted" || state === "manual_review") {
      return {
        kind: "manual_review",
        reason: "Intention d'envoi déjà placée en arrêt/revue manuelle : aucune réémission.",
      };
    }
    return verifyRemoteDeliveryAfterAttempt({
      orderId,
      deliveryId,
      offerId,
      expiresAt: intentExpiresAt,
      ports,
      postOutcomeNote: "Reprise sur intention d'envoi antérieure.",
    });
  }

  // 2. Aucune intention enregistrée : exiger une échéance G2G fiable et future.
  const expiresAt = item.expiresAt;
  if (!(expiresAt instanceof Date) || !Number.isFinite(expiresAt.getTime())) {
    return {
      kind: "manual_review",
      reason: "Échéance G2G absente ou invalide (expires_at NULL) : envoi automatique interdit.",
    };
  }
  const deadlineMs = expiresAt.getTime() - safetyBufferMs;
  const nowBeforeCheck = ports.now();
  if (!Number.isFinite(nowBeforeCheck) || nowBeforeCheck <= 0 || nowBeforeCheck >= deadlineMs) {
    return {
      kind: "manual_review",
      reason: "Échéance G2G dépassée ou trop proche avant réservation : revue manuelle.",
    };
  }

  // 3. Contrôle préalable du statut G2G (source d'annulation / expiration / livraison déjà faite).
  let preDeliveryStatus: unknown;
  try {
    preDeliveryStatus = await ports.getDeliveryStatus(orderId, deliveryId);
  } catch {
    return {
      kind: "failed",
      reason: "Statut G2G pré-envoi temporairement illisible (aucun code lu ni envoyé).",
    };
  }
  if (!remoteOfferConsistent(preDeliveryStatus, offerId)) {
    return {
      kind: "manual_review",
      reason: "Offre distante G2G incohérente avec l'offre pilote avant envoi.",
    };
  }
  const preStatusVerdict = assessG2gDeliveryStatus(preDeliveryStatus, orderId, deliveryId, 1);
  if (preStatusVerdict === "confirmed") {
    return { kind: "delivered", codes: 1 };
  }
  if (preStatusVerdict !== "waiting") {
    return {
      kind: "manual_review",
      reason: "Commande G2G annulée, expirée ou non livrable avant réservation : aucun envoi.",
    };
  }

  // 4. Lecture stricte de la commande FazerCards (identité, type, statut completed, code unique).
  let supplierResponse: unknown;
  try {
    supplierResponse = await ports.getSupplierOrder(supplierOrderRef);
  } catch {
    return {
      kind: "failed",
      reason: "Lecture de la commande FazerCards temporairement indisponible (aucun envoi effectué).",
    };
  }
  if (!supplierKindConsistent(supplierResponse)) {
    return {
      kind: "manual_review",
      reason: "Type de commande FazerCards inattendu (gift_card requis).",
    };
  }
  const supplierVerdict = assessSupplierGiftCard(supplierResponse, supplierOrderRef, 1);
  if (supplierVerdict.kind === "waiting") {
    return {
      kind: "awaiting_codes",
      reason: "Commande FazerCards pas encore à l'état completed.",
    };
  }
  if (supplierVerdict.kind !== "ready") {
    return {
      kind: "manual_review",
      reason: "Réponse FazerCards non conforme au contrat strict : livraison manuelle requise.",
    };
  }

  // 5. Réservation durable commitée AVANT toute tentative de transport réseau G2G.
  const referenceId = buildStableDispatchReferenceId(orderId, deliveryId);
  if (!referenceId) {
    return {
      kind: "manual_review",
      reason: "Impossible de dériver une référence d'envoi stable.",
    };
  }
  const nowBeforeReserve = ports.now();
  if (!Number.isFinite(nowBeforeReserve) || nowBeforeReserve <= 0 || nowBeforeReserve >= deadlineMs) {
    return {
      kind: "manual_review",
      reason: "Échéance G2G atteinte juste avant réservation : aucun envoi.",
    };
  }

  let reservation: ReserveDispatchIntentOutcome;
  try {
    reservation = await ports.reserveDispatchIntent({
      orderId,
      deliveryId,
      offerId,
      supplierOrderId: supplierOrderRef,
      quantity: 1,
      expiresAt,
      referenceId,
    });
  } catch {
    reservation = { status: "uncertain" };
  }

  if (reservation.status === "not_reserved") {
    const nowAfterConflict = ports.now();
    if (!Number.isFinite(nowAfterConflict) || nowAfterConflict >= expiresAt.getTime()) {
      return {
        kind: "manual_review",
        reason: "Réservation d'envoi refusée car l'échéance G2G est dépassée.",
      };
    }
    return {
      kind: "awaiting_confirmation",
      reason: "Intention d'envoi déjà réservée par un traitement concurrent ; suivi sans réémission.",
    };
  }
  if (reservation.status !== "committed") {
    return {
      kind: "manual_review",
      reason: "Résultat de réservation PostgreSQL incertain ou invalide : aucun POST effectué, revue manuelle.",
    };
  }

  // 6. Contrôle frais d'annulation et d'horloge APRÈS COMMIT et JUSTE AVANT le POST.
  let freshDeliveryStatus: unknown;
  let nowBeforePost: number;
  try {
    freshDeliveryStatus = await ports.getDeliveryStatus(orderId, deliveryId);
    nowBeforePost = ports.now();
  } catch {
    await safeTransition(ports, {
      orderId,
      deliveryId,
      fromStates: ["dispatching"],
      toState: "aborted",
      detail: "Lecture fraîche pré-POST échouée après réservation ; aucun POST émis.",
    });
    return {
      kind: "manual_review",
      reason: "Contrôle frais G2G indisponible juste avant POST : envoi annulé par sécurité.",
    };
  }

  if (!remoteOfferConsistent(freshDeliveryStatus, offerId)) {
    await safeTransition(ports, {
      orderId,
      deliveryId,
      fromStates: ["dispatching"],
      toState: "aborted",
      detail: "Offre distante incohérente au dernier contrôle pré-POST ; aucun POST émis.",
    });
    return {
      kind: "manual_review",
      reason: "Offre G2G incohérente au dernier contrôle avant POST : envoi annulé.",
    };
  }

  const prepared = preparePilotDeliveryRequest({
    offerId,
    orderId,
    deliveryId,
    supplierOrderId: supplierOrderRef,
    referenceId: reservation.referenceId,
    quantity: 1,
    supplierResponse,
    deliveryResponse: freshDeliveryStatus,
    now: nowBeforePost,
    expiresAt: deadlineMs,
  });

  if (prepared.kind !== "prepared") {
    await safeTransition(ports, {
      orderId,
      deliveryId,
      fromStates: ["dispatching"],
      toState: "aborted",
      detail: "Annulation, expiration ou statut non livrable détecté avant POST ; aucun POST émis.",
    });
    return {
      kind: "manual_review",
      reason: "Commande G2G annulée ou expirée juste avant POST : aucun code transmis.",
    };
  }

  // 7. POST unique de livraison G2G, suivi obligatoirement d'une lecture séparée du statut.
  let postAcknowledged = false;
  try {
    const ack = await ports.deliverCodes(prepared.request);
    postAcknowledged = isValidG2gPostAck(ack, deliveryId);
  } catch {
    postAcknowledged = false;
  }

  if (postAcknowledged) {
    await safeTransition(ports, {
      orderId,
      deliveryId,
      fromStates: ["dispatching"],
      toState: "acknowledged",
      detail: "Accusé POST G2G reçu ; vérification séparée du statut requise.",
    });
  } else {
    await safeTransition(ports, {
      orderId,
      deliveryId,
      fromStates: ["dispatching"],
      toState: "unknown",
      detail: "Résultat du POST G2G incertain (timeout ou erreur) ; aucune réémission.",
    });
  }

  return verifyRemoteDeliveryAfterAttempt({
    orderId,
    deliveryId,
    offerId,
    expiresAt,
    ports,
    postOutcomeNote: postAcknowledged
      ? "Accusé POST reçu."
      : "POST G2G au résultat incertain.",
  });
}
