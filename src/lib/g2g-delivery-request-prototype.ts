/**
 * Préparation isolée, sans accès réseau ni appelant de production.
 * Retourne une charge sensible qui contient un code : ne jamais journaliser,
 * stocker ou exposer cette valeur. Ce résultat n'autorise pas un envoi.
 * Le contrat réel, l'échéance, l'annulation et la réservation durable doivent
 * encore être vérifiés de bout en bout avant tout raccordement.
 */
import { assessSupplierGiftCard, assessG2gDeliveryStatus } from "./g2g-delivery-assessment.ts";

const PILOT_OFFER = "G1795521210943KM";
const safeIdentifier = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 128 && !/[\x00-\x20\x7f]/.test(value);

export type PreparedDelivery =
  | { kind: "waiting" | "manual_review" }
  | { kind: "prepared"; request: { orderId: string; deliveryId: string; codes: { content: string; reference_id: string }[] } };

/** Construit uniquement l'entrée de g2gDeliverCodes pour le pilote unitaire.
 * referenceId doit être fourni par un futur mécanisme stable et durable :
 * ce prototype ne crée ni n'enregistre de référence d'idempotence.
 */
export function preparePilotDeliveryRequest(input: {
  offerId: string;
  orderId: string;
  deliveryId: string;
  supplierOrderId: string;
  referenceId: string;
  quantity: number;
  supplierResponse: unknown;
  deliveryResponse: unknown;
  now: number;
  expiresAt: number;
}): PreparedDelivery {
  if (input.offerId !== PILOT_OFFER || input.quantity !== 1 ||
      ![input.orderId, input.deliveryId, input.supplierOrderId, input.referenceId].every(safeIdentifier) ||
      !Number.isFinite(input.now) || input.now <= 0 || !Number.isFinite(input.expiresAt) || input.expiresAt <= input.now) {
    return {kind:"manual_review"};
  }
  if (assessG2gDeliveryStatus(input.deliveryResponse, input.orderId, input.deliveryId, 1) !== "waiting") return {kind:"manual_review"};
  const supplier = assessSupplierGiftCard(input.supplierResponse, input.supplierOrderId, 1);
  if (supplier.kind !== "ready") return {kind:supplier.kind};
  return {kind:"prepared",request:{orderId:input.orderId,deliveryId:input.deliveryId,codes:[{content:supplier.codes[0],reference_id:input.referenceId}]}};
}
