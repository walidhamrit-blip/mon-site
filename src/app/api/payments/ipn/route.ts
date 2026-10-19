import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { orders, type Order } from "@/db/schema";
import { getSiteData } from "@/lib/store";
import {
  isPaidStatus,
  orderStatusFromIpn,
  verifyIpnSignature,
} from "@/lib/nowpayments";
import { orderRefCandidates } from "@/lib/installments";
import { sendPaymentConfirmedEmail } from "@/lib/order-emails";

/**
 * Webhook IPN NOWPayments.
 * POSTé par NOWPayments à chaque changement de statut d'un
 * paiement. La signature HMAC-SHA512 (en-tête
 * x-nowpayments-sig) est vérifiée AVANT toute lecture du
 * corps : une notification non vérifiée ne modifie jamais
 * l'état d'une commande.
 *
 * À déclarer aussi dans le tableau NOWPayments :
 *   Settings → IPN → https://<votre-domaine>/api/payments/ipn
 */

export const runtime = "nodejs";

export async function POST(req: Request) {
  // Corps brut indispensable : la signature porte sur le JSON
  // tel qu'envoyé, pas sur une re-sérialisation.
  const rawBody = await req.text();
  const signature = req.headers.get("x-nowpayments-sig");

  if (!verifyIpnSignature(rawBody, signature)) {
    console.warn("[ipn] signature invalide — notification rejetée");
    return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const paymentId = payload.payment_id != null ? String(payload.payment_id) : "";
  const orderId = payload.order_id != null ? String(payload.order_id) : "";
  const ipnStatus = payload.payment_status != null ? String(payload.payment_status) : "";

  if (!paymentId || !ipnStatus) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }

  try {
    await ensureSchema();

    // 1) La commande est d'abord cherchée par payment_id (paiements
    //    déjà réconciliés par un IPN précédent).
    let order: Order | undefined;
    const byPayment = await db
      .select()
      .from(orders)
      .where(eq(orders.paymentId, paymentId))
      .limit(1);
    order = byPayment[0];

    // 2) Sinon par la référence de facture (order_id) : c'est le seul
    //    identifiant connu lors du premier IPN d'une nouvelle facture.
    if (!order && orderId) {
      const candidates = orderRefCandidates(orderId);
      const byRef = await db
        .select()
        .from(orders)
        .where(inArray(orders.ref, candidates));
      order =
        byRef.find((row) => row.ref === candidates[0]) ??
        byRef.find((row) => row.ref === candidates[1]) ??
        byRef[0];
    }

    if (!order) {
      // Paiement inconnu (ex. commande créée sur un autre
      // environnement) : on accepte la notification sans rien
      // modifier, pour que NOWPayments ne la renvoie pas.
      console.warn("[ipn] paiement inconnu :", paymentId, orderId);
      return NextResponse.json({ ok: true, ignored: true });
    }

    const newStatus = orderStatusFromIpn(ipnStatus);
    const wasPaid = order.status === "paid";

    await db
      .update(orders)
      .set({
        status: newStatus,
        ipnStatus,
        // Mémorise le payment_id le plus récent : le polling direct
        // (page de suivi) interroge alors le bon paiement.
        paymentId,
        payAddress:
          (payload.pay_address as string | undefined) ?? order.payAddress,
        payCurrency:
          (payload.pay_currency as string | undefined) ?? order.payCurrency,
        payAmount:
          payload.pay_amount != null
            ? String(payload.pay_amount)
            : order.payAmount,
        paymentUrl: order.paymentUrl,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));

    // Notification à l'agence uniquement au moment de la
    // confirmation (jamais en double).
    if (!wasPaid && isPaidStatus(ipnStatus)) {
      const { config } = await getSiteData();
      const updated = {
        ...order,
        status: newStatus,
        ipnStatus,
        payAddress:
          (payload.pay_address as string | undefined) ?? order.payAddress,
        payCurrency:
          (payload.pay_currency as string | undefined) ?? order.payCurrency,
        payAmount:
          payload.pay_amount != null ? String(payload.pay_amount) : order.payAmount,
      };
      const outcome = await sendPaymentConfirmedEmail(
        updated,
        config.name,
        config.url,
      );
      if (!outcome.ok) {
        console.warn("[ipn] e-mail paiement non envoyé :", outcome.error);
      }
    }

    console.info(`[ipn] commande ${order.ref} → ${ipnStatus}`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[ipn] traitement impossible :", error instanceof Error ? error.message : error);
    // 500 → NOWPayments réessaiera plus tard.
    return NextResponse.json({ ok: false, error: "processing_failed" }, { status: 500 });
  }
}
