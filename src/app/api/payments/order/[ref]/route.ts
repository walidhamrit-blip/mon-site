import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { orders } from "@/db/schema";
import {
  getPayment,
  nowPaymentsConfigured,
  orderStatusFromIpn,
} from "@/lib/nowpayments";
import { getSiteData } from "@/lib/store";
import { sendPaymentConfirmedEmail } from "@/lib/order-emails";
import { baseRefOf } from "@/lib/installments";

/**
 * Statut d'une commande (lu par la page de succès et l'admin).
 * Rafraîchit opportunément depuis NOWPayments tant que le
 * paiement est en attente ; l'IPN reste la source de vérité.
 *
 * Renvoie aussi le plan de paiement complet (`tranches`) afin
 * que le client puisse régler les versements suivants.
 */

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ref: string }> },
) {
  const { ref } = await params;
  if (!ref) {
    return NextResponse.json({ ok: false, error: "missing_ref" }, { status: 400 });
  }

  try {
    await ensureSchema();
    const rows = await db
      .select()
      .from(orders)
      .where(eq(orders.ref, ref.toUpperCase()))
      .limit(1);
    let order = rows[0];

    if (!order) {
      return NextResponse.json({ ok: false, error: "order_not_found" }, { status: 404 });
    }

    if (order.status === "pending" && order.paymentId && nowPaymentsConfigured()) {
      const remote = await getPayment(order.paymentId);
      if (remote && remote.payment_status) {
        const remoteStatus = remote.payment_status;
        const newStatus = orderStatusFromIpn(remoteStatus);
        if (newStatus !== order.status) {
          await db
            .update(orders)
            .set({ status: newStatus, ipnStatus: remoteStatus, updatedAt: new Date() })
            .where(eq(orders.id, order.id));

          if (newStatus === "paid") {
            const { config } = await getSiteData();
            await sendPaymentConfirmedEmail(
              {
                ...order,
                status: "paid",
                ipnStatus: remoteStatus,
                payAddress: remote.pay_address ?? order.payAddress,
                payCurrency: remote.pay_currency ?? order.payCurrency,
                payAmount:
                  remote.pay_amount != null ? String(remote.pay_amount) : order.payAmount,
              },
              config.name,
              config.url,
            ).catch((error) =>
              console.warn("[payments] e-mail impossible :", error instanceof Error ? error.message : error),
            );
          }
        }
        order = {
          ...order,
          status: newStatus,
          ipnStatus: remoteStatus,
          payAddress: remote.pay_address ?? order.payAddress,
          payCurrency: remote.pay_currency ?? order.payCurrency,
          payAmount:
            remote.pay_amount != null ? String(remote.pay_amount) : order.payAmount,
        };
      }
    }

    // Plan de paiement : toutes les tranches du même groupe.
    // Les commandes antérieures (une seule ligne) retombent sur
    // elles-mêmes.
    const groupRef = order.groupRef ?? baseRefOf(order.ref);
    let groupRows = [order];
    if (order.groupRef) {
      const siblings = await db
        .select()
        .from(orders)
        .where(eq(orders.groupRef, groupRef))
        .orderBy(asc(orders.installmentIndex));
      if (siblings.length > 0) groupRows = siblings;
    }

    return NextResponse.json({
      ok: true,
      order: {
        ref: order.ref,
        planName: order.planName,
        amountLyd: order.amountLyd,
        amountUsd: order.amountUsd,
        currency: order.currency,
        installments: order.installments,
        installmentIndex: order.installmentIndex,
        groupRef: order.groupRef,
        clientName: order.clientName,
        email: order.email,
        phone: order.phone,
        payAddress: order.payAddress,
        payCurrency: order.payCurrency,
        payAmount: order.payAmount,
        paymentUrl: order.paymentUrl,
        status: order.status,
        ipnStatus: order.ipnStatus,
        createdAt: order.createdAt.toISOString(),
      },
      tranches: groupRows.map((row) => ({
        ref: row.ref,
        installmentIndex: row.installmentIndex,
        installments: row.installments,
        amountUsd: row.amountUsd,
        amountLyd: row.amountLyd,
        status: row.status,
        paymentUrl: row.paymentUrl,
      })),
    });
  } catch (error) {
    console.error("[payments] lecture commande impossible :", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "read_failed" }, { status: 500 });
  }
}
