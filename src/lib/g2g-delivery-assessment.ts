/**
 * Prototype pur, non raccordé à la file ni aux API : les structures de code
 * FazerCards ne sont pas confirmées par un exemple de réponse GET. Les tests
 * emploient exclusivement des données fictives ; aucune vente n'est activée.
 */
type Obj = Record<string, unknown>;
const object = (value: unknown): Obj | null => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Obj : null;

export type SupplierAssessment =
  | { kind: "waiting" }
  | { kind: "manual_review" }
  | { kind: "ready"; codes: string[] };

/** Vérifie uniquement une hypothèse de forme `order.code` ou `order.codes`. */
export function assessSupplierGiftCard(value: unknown, expectedId: string, qty: number): SupplierAssessment {
  const root = object(value);
  const order = object(root?.order);
  if (root?.ok !== true || !order || !expectedId || order.id !== expectedId || !Number.isInteger(qty) || qty < 1 || qty > 100) return { kind: "manual_review" };
  if (order.status === "created" || order.status === "processing") return { kind: "waiting" };
  if (order.status !== "completed") return { kind: "manual_review" };
  // Ne jamais rechercher récursivement, interpréter des objets inconnus ou
  // choisir entre deux champs contradictoires. Aucun code n'est journalisé.
  const hasCode = order.code !== undefined && order.code !== null;
  const hasCodes = order.codes !== undefined && order.codes !== null;
  if (hasCode === hasCodes) return { kind: "manual_review" };
  const raw = hasCode ? [order.code] : order.codes;
  if (!Array.isArray(raw) || raw.length !== qty || raw.some(code => typeof code !== "string" || !code || code !== code.trim() || /[\x00-\x1f\x7f]/.test(code))) return { kind: "manual_review" };
  const codes = raw as string[];
  if (new Set(codes).size !== codes.length) return { kind: "manual_review" };
  return { kind: "ready", codes };
}

export type DeliveryAssessment = "confirmed" | "waiting" | "manual_review";
/** Un accusé POST n'est pas une livraison : seule une lecture de statut fiable peut confirmer. */
export function assessG2gDeliveryStatus(value: unknown, orderId: string, deliveryId: string, qty: number): DeliveryAssessment {
  const root = object(value);
  const payload = object(root?.payload);
  const summary = object(payload?.delivery_summary);
  if (!orderId || !deliveryId || !Number.isInteger(qty) || qty < 1 || qty > 100 || root?.code !== "20000001" || !payload || !summary || payload.order_id !== orderId || summary.delivery_id !== deliveryId || summary.requested_qty !== qty || !Number.isInteger(summary.delivered_qty) || (summary.delivered_qty as number) < 0 || (summary.delivered_qty as number) > qty) return "manual_review";
  if (summary.delivery_status === "delivered" && summary.delivered_qty === qty) return "confirmed";
  if ((summary.delivery_status === "pending" || summary.delivery_status === "in_progress") && summary.delivered_qty === 0) return "waiting";
  // Les livraisons partielles, échecs, états contradictoires et expirations
  // demandent un rapprochement manuel ; aucune réémission automatique.
  return "manual_review";
}
