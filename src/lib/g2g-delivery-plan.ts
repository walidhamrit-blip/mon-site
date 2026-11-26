/**
 * Planification pure, non raccordée au cron ni aux fournisseurs.
 * Un verdict n'est ni une autorisation de vente ni une exécution. Les effets
 * nécessaires (notamment un claim transactionnel) restent à implémenter.
 */
import { assessG2gDeliveryStatus, assessSupplierGiftCard } from "./g2g-delivery-assessment.ts";

export type DispatchState = "not_sent" | "dispatching" | "acknowledged" | "unknown";
export type DeliveryPlan = "wait_supplier" | "reserve_dispatch" | "check_delivery" | "confirmed" | "manual_review";

export function planDelivery(input: {
  supplierResponse: unknown;
  g2gResponse: unknown;
  supplierOrderId: string;
  orderId: string;
  deliveryId: string;
  quantity: number;
  dispatchState: DispatchState;
  /** Échéance G2G en millisecondes, préalablement vérifiée dans l'événement. */
  expiresAt: number;
  now: number;
}): DeliveryPlan {
  const remote = assessG2gDeliveryStatus(input.g2gResponse, input.orderId, input.deliveryId, input.quantity);
  if (input.dispatchState === "dispatching" || input.dispatchState === "acknowledged" || input.dispatchState === "unknown") {
    // Une réponse perdue ou un crash n'autorise JAMAIS un nouvel envoi.
    if (remote === "confirmed") return "confirmed";
    return remote === "waiting" ? "check_delivery" : "manual_review";
  }
  if (input.dispatchState !== "not_sent" || remote !== "waiting") return "manual_review";
  // Une échéance absente ou dépassée n'est pas une autorisation de livrer.
  if (!Number.isFinite(input.now) || !Number.isFinite(input.expiresAt) || input.expiresAt <= input.now || input.now <= 0) return "manual_review";
  const supplier = assessSupplierGiftCard(input.supplierResponse, input.supplierOrderId, input.quantity);
  if (supplier.kind === "waiting") return "wait_supplier";
  if (supplier.kind !== "ready") return "manual_review";
  // Indique uniquement la nécessité d'une réservation atomique durable. Ce
  // prototype n'effectue aucun POST et ne doit pas être relié sans revue.
  return "reserve_dispatch";
}
