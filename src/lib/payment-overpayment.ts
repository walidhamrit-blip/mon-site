// Persistance et alerte d'un écart de montant NOWPayments. L'encaissement et la
// livraison ne dépendent jamais de la disponibilité de la messagerie.
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders, type Order } from "@/db/schema";
import { compareCryptoAmounts, cryptoPaymentSnapshot } from "@/lib/payment-amounts";
import { sendPaymentAmountAlertEmail } from "@/lib/order-emails";
import { getSiteData } from "@/lib/store";

export async function recordCryptoPaymentSnapshot(
  order: Order,
  payload: { pay_amount?: unknown; actually_paid?: unknown; pay_currency?: unknown },
): Promise<void> {
  const snapshot = cryptoPaymentSnapshot(payload);
  if (!snapshot) return; // aucune déduction si NOWPayments omet un champ
  // La comparaison conditionnelle évite de notifier plusieurs fois un même
  // instantané en cas d'IPN répétés ou de polling simultané.
  let changed: { id: number }[];
  try {
    changed = await db
      .update(orders)
      .set({
        actualPaid: snapshot.actual,
        actualPaidExpected: snapshot.expected,
        actualPaidCurrency: snapshot.currency,
      })
      .where(and(
        eq(orders.id, order.id),
        // Pour une même facture crypto, ne pas effacer un trop-payé connu
        // avec un ancien événement arrivé après le plus récent.
        sql`(${orders.actualPaid} IS NULL OR ${orders.actualPaidCurrency} IS DISTINCT FROM ${snapshot.currency} OR ${orders.actualPaidExpected}::numeric IS DISTINCT FROM ${snapshot.expected}::numeric OR ${orders.actualPaid}::numeric < ${snapshot.actual}::numeric)`,
      ))
      .returning({ id: orders.id });
  } catch (error) {
    // La livraison de la quantité payée ne dépend pas de cette alerte.
    console.error(`[payments] enregistrement montant impossible pour ${order.ref}:`, error instanceof Error ? error.message : error);
    return;
  }
  if (!changed.length || compareCryptoAmounts(snapshot.actual, snapshot.expected) === 0) return;
  try {
    const { config } = await getSiteData();
    const result = await sendPaymentAmountAlertEmail(order, snapshot, config.url, config.email);
    if (!result.ok) console.warn(`[payments] alerte écart de paiement non envoyée pour ${order.ref}: ${result.error}`);
  } catch (error) {
    console.warn(`[payments] alerte écart de paiement impossible pour ${order.ref}:`, error instanceof Error ? error.message : error);
  }
}
