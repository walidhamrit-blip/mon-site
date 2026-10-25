import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { orders } from "@/db/schema";
import {
  getPayment,
  nextOrderStatus,
  nowPaymentsConfigured,
  orderStatusFromIpn,
  validatePaidAmount,
} from "@/lib/nowpayments";
import { getSiteData } from "@/lib/store";
import { sendPaymentConfirmedEmail } from "@/lib/order-emails";
import { deliverPaidDigitalOrder } from "@/lib/digital-orders";
import { baseRefOf } from "@/lib/installments";
import {
  maskEmail,
  trackingAccess,
  trackingTokenFromRequest,
} from "@/lib/order-tracking";

/**
 * Statut public minimisé d'une commande (page de suivi client).
 *
 * Les commandes récentes exigent leur jeton de suivi (en-tête
 * `x-order-tracking-token`, Bearer ou `?t=`) : sans lui, la réponse est
 * indistinguable d'une commande inconnue. Les anciennes commandes sans
 * empreinte restent consultables, mais sans donnée personnelle ni lien
 * de paiement direct. Dans tous les cas, cette route ne renvoie jamais
 * nom, téléphone, e-mail complet ni adresse crypto — l'administration
 * lit ces champs directement en base, derrière authentification.
 *
 * Rafraîchit opportunément depuis NOWPayments tant que le paiement est
 * en attente ; l'IPN reste la source de vérité et les transitions sont
 * les mêmes que dans /api/payments/ipn.
 */

export async function GET(
  req: Request,
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

    const access = trackingAccess(
      order.trackingTokenHash,
      trackingTokenFromRequest(req),
    );
    if (access === "denied") {
      // Même réponse qu'une référence inconnue : ne pas confirmer
      // l'existence de la commande à un porteur de mauvais jeton.
      return NextResponse.json({ ok: false, error: "order_not_found" }, { status: 404 });
    }
    const canUsePaymentLinks = access === "granted";

    if (order.status === "pending" && order.paymentId && nowPaymentsConfigured()) {
      const remote = await getPayment(order.paymentId);
      if (remote && remote.payment_status) {
        const remoteStatus = remote.payment_status;
        const incomingStatus = orderStatusFromIpn(remoteStatus);
        let resolvedStatus = nextOrderStatus(order.status, remoteStatus);

        const amountValidation =
          incomingStatus === "paid"
            ? validatePaidAmount(order, remote)
            : { ok: true, reason: null as string | null };
        if (incomingStatus === "paid" && !amountValidation.ok) {
          resolvedStatus = "pending";
          console.warn(
            `[payments] montant refusé pour ${order.ref} : ${amountValidation.reason}`,
          );
        }

        const refreshed = {
          ...order,
          status: resolvedStatus,
          ipnStatus: remoteStatus,
          payAddress: remote.pay_address ?? order.payAddress,
          payCurrency: remote.pay_currency ?? order.payCurrency,
          payAmount:
            remote.pay_amount != null ? String(remote.pay_amount) : order.payAmount,
        };

        const shouldPersist =
          refreshed.status !== order.status ||
          refreshed.ipnStatus !== order.ipnStatus ||
          refreshed.payAddress !== order.payAddress ||
          refreshed.payCurrency !== order.payCurrency ||
          refreshed.payAmount !== order.payAmount;

        let claimLost = false;
        if (shouldPersist) {
          // Même revendication conditionnelle que l'IPN : un seul des
          // deux chemins envoie l'e-mail de confirmation.
          const claimed = await db
            .update(orders)
            .set({
              status: refreshed.status,
              ipnStatus: refreshed.ipnStatus,
              payAddress: refreshed.payAddress,
              payCurrency: refreshed.payCurrency,
              payAmount: refreshed.payAmount,
              updatedAt: new Date(),
            })
            .where(
              and(eq(orders.id, order.id), eq(orders.status, order.status)),
            )
            .returning({ id: orders.id });

          claimLost = claimed.length === 0;

          if (claimed.length > 0 && refreshed.status === "paid") {
            const { config } = await getSiteData();
            await sendPaymentConfirmedEmail(
              refreshed,
              config.name,
              config.url,
              config.email,
            ).catch((error) =>
              console.warn(
                "[payments] e-mail impossible :",
                error instanceof Error ? error.message : error,
              ),
            );
            if (order.digitalOrderId) {
              await deliverPaidDigitalOrder(order.digitalOrderId).catch((error) =>
                console.error(
                  "[payments][digital] livraison impossible :",
                  error instanceof Error ? error.message : error,
                ),
              );
            }
          }
        }

        if (claimLost) {
          // L'IPN (ou un autre polling) a fait la transition entre-temps :
          // relire l'état gagnant plutôt que renvoyer notre copie périmée.
          const current = await db
            .select()
            .from(orders)
            .where(eq(orders.id, order.id))
            .limit(1);
          order = current[0] ?? refreshed;
        } else {
          order = refreshed;
        }
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
      if (siblings.length > 0) {
        // La ligne interrogée peut avoir été rafraîchie ci-dessus.
        groupRows = siblings.map((row) => (row.id === order.id ? order : row));
      }
    }

    return NextResponse.json({
      ok: true,
      order: {
        ref: order.ref,
        kind: order.kind,
        planName: order.planName,
        amountLyd: order.amountLyd,
        amountUsd: order.amountUsd,
        currency: order.currency,
        installments: order.installments,
        installmentIndex: order.installmentIndex,
        emailMasked: maskEmail(order.email),
        payCurrency: order.payCurrency,
        payAmount: order.payAmount,
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
        // Les liens de paiement existants ne sont exposés qu'au porteur
        // du jeton ; les anciennes commandes passent par une nouvelle
        // facture explicite (bouton de la page de suivi).
        paymentUrl: canUsePaymentLinks ? row.paymentUrl : null,
      })),
    });
  } catch (error) {
    console.error(
      "[payments] lecture commande impossible :",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json({ ok: false, error: "read_failed" }, { status: 500 });
  }
}
