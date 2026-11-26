// LABORATOIRE UNIQUEMENT : interfaces injectées, aucun branchement au cron,
// aux routes, aux secrets ou aux clients réseau. Les états et les doubles ne
// sont pas un système de livraison exploitable en production.
import { assessSupplierGiftCard, assessG2gDeliveryStatus } from "../src/lib/g2g-delivery-assessment.ts";
import { planDelivery } from "../src/lib/g2g-delivery-plan.ts";

export async function runIsolatedDelivery(input, ports) {
  const { orderId, deliveryId, supplierOrderId, quantity, expiresAt, dispatchState } = input;
  const remoteAssessment = response => assessG2gDeliveryStatus(response, orderId, deliveryId, quantity);
  let remote;
  try { remote = await ports.readDelivery(); } catch { return "manual_review"; }

  // En reprise, aucun accès au fournisseur ni nouveau POST, même si le
  // premier envoi n'a peut-être jamais eu lieu.
  if (dispatchState !== "not_sent") {
    const state = remoteAssessment(remote);
    if (!["dispatching", "acknowledged", "unknown"].includes(dispatchState)) return "manual_review";
    return state === "confirmed" ? "confirmed" : state === "waiting" ? "check_delivery" : "manual_review";
  }

  let supplier, now;
  try { supplier = await ports.readSupplier(); now = ports.now(); } catch { return "manual_review"; }
  const plan = planDelivery({supplierResponse:supplier,g2gResponse:remote,supplierOrderId,orderId,deliveryId,quantity,dispatchState,now,expiresAt});
  if (plan !== "reserve_dispatch") return plan;

  let reservation;
  try { reservation = await ports.reserve({orderId,deliveryId,supplierOrderId,quantity,expiresAt:new Date(expiresAt)}); }
  catch { return "manual_review"; }
  // Un conflit, une erreur ou un COMMIT incertain n'autorise jamais l'envoi.
  if (reservation !== "committed") return "manual_review";

  // Nouveau contrôle fictif après COMMIT. Une interruption ici laisse la
  // réservation conservée ; le prochain traitement doit faire une revue.
  let fresh, currentTime;
  try { fresh = await ports.readFreshOrder(); currentTime = ports.now(); } catch { return "manual_review"; }
  if (fresh?.active !== true || !Number.isFinite(currentTime) || currentTime <= 0 || currentTime >= expiresAt || remoteAssessment(fresh.delivery) !== "waiting") return "manual_review";
  const assessment = assessSupplierGiftCard(supplier, supplierOrderId, quantity);
  if (assessment.kind !== "ready") return "manual_review";
  try { await ports.sendFake({orderId,deliveryId,codes:assessment.codes}); }
  catch { return "unknown"; } // timeout : potentiellement envoyé, ne pas répéter
  return "check_delivery"; // un accusé de réception ne confirme pas la livraison
}
