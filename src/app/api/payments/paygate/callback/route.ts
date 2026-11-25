import { after } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { orders, paygatePayments } from "@/db/schema";
import {
  extractRawQuery,
  parsePayGateCallbackQuery,
  validatePayGateSettlement,
  verifyPayGateCallbackSignature,
  verifyPayGateOrderToken,
} from "@/lib/paygate-core";
import { getPayGatePaymentByOrderRef, payGateCallbackSecret } from "@/lib/paygate";
import {
  enqueueDelivery,
  reserveWebhookEvent,
  runDeliveryQueue,
  settleWebhookEvent,
} from "@/lib/delivery-queue";
import { getSiteData } from "@/lib/store";
import { sendPaymentConfirmedEmail } from "@/lib/order-emails";

export const dynamic = "force-dynamic";

function plainResponse(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Webhook GET entrant de PayGate.to (`/api/payments/paygate/callback`).
 *
 * Double authentification cryptographique avant toute action :
 *  1. Jeton HMAC-SHA256 (`token`) propre à la référence de commande ;
 *  2. Signature asymétrique RSA-SHA256 officielle de PayGate.to
 *     (`X-PayGate-Signature` / `X-PayGate-Key-Id`) vérifiée sur l'URL exacte.
 */
export async function GET(req: Request) {
  const rawQuery = extractRawQuery(req.url);
  const parsed = parsePayGateCallbackQuery(rawQuery);

  if (!parsed.order || !parsed.token) {
    return plainResponse("missing_order_or_token", 400);
  }

  let secret: string;
  try {
    secret = payGateCallbackSecret();
  } catch (error) {
    console.error(
      "[paygate][callback] secret indisponible :",
      error instanceof Error ? error.message : error,
    );
    return plainResponse("server_misconfigured", 503);
  }

  if (!verifyPayGateOrderToken(parsed.order, parsed.token, secret)) {
    console.warn(`[paygate][callback] jeton HMAC invalide pour order=${parsed.order}`);
    return plainResponse("invalid_token", 401);
  }

  await ensureSchema();
  const session = await getPayGatePaymentByOrderRef(parsed.order);
  if (!session) {
    console.warn(`[paygate][callback] session introuvable pour order=${parsed.order}`);
    return plainResponse("session_not_found", 404);
  }

  // Vérification de la signature RSA-SHA256 officielle de PayGate.to.
  const sigCheck = verifyPayGateCallbackSignature({
    registeredCallbackUrl: session.callbackUrl,
    rawQuery,
    signature: req.headers.get("x-paygate-signature"),
    keyId: req.headers.get("x-paygate-key-id"),
  });

  if (!sigCheck.valid) {
    console.warn(
      `[paygate][callback] signature RSA refusée (${sigCheck.reason}) pour order=${parsed.order}`,
    );
    return plainResponse(`invalid_signature:${sigCheck.reason}`, 401);
  }

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.ref, parsed.order))
    .limit(1);

  if (!order) {
    return plainResponse("order_not_found", 404);
  }

  // Notification "pending" (transaction non confirmée sur la blockchain) :
  // on accuse réception sans jamais livrer.
  if (parsed.pending) {
    await db
      .update(paygatePayments)
      .set({
        txidIn: parsed.txidIn || session.txidIn,
        coin: parsed.coin || session.coin,
        lastDetail: "Callback reçu avec pending=1 (en attente de confirmation réseau).",
        updatedAt: new Date(),
      })
      .where(eq(paygatePayments.orderRef, session.orderRef))
      .catch(() => null);
    return plainResponse("ok", 200);
  }

  // Idempotence stricte sur (order, txid_in) : un retry réseau de PayGate.to
  // ne déclenche jamais ni double e-mail ni double livraison.
  const reservation = await reserveWebhookEvent({
    provider: "paygate",
    eventId: `${session.orderRef}:${parsed.txidIn || "no-tx"}`,
    status: "confirmed",
    rawBody: rawQuery,
  });

  if (!reservation.fresh) {
    // Si la commande était déjà payée mais qu'un job de livraison attendait,
    // on relance simplement la file en arrière-plan par précaution.
    if (order.status === "paid" && (order.digitalOrderId || order.kind === "digital")) {
      after(async () => {
        await runDeliveryQueue({ limit: 2 }).catch(() => null);
      });
    }
    return plainResponse("ok", 200);
  }

  const decision = validatePayGateSettlement({
    callback: parsed,
    expectedPolygonAddressIn: session.polygonAddressIn,
    expectedMerchantWallet: session.merchantWallet,
    minAcceptableUsd: Number(session.minAcceptableUsd),
  });

  if (decision.status === "pending") {
    await settleWebhookEvent(reservation.key, "ignored");
    return plainResponse("ok", 200);
  }

  if (decision.status === "rejected") {
    console.error(
      `[paygate][callback] rejet métier pour ${session.orderRef} : ${decision.reason}`,
    );
    await db
      .update(paygatePayments)
      .set({
        status: session.status === "paid" ? "paid" : "failed",
        lastDetail: decision.reason,
        updatedAt: new Date(),
      })
      .where(eq(paygatePayments.orderRef, session.orderRef))
      .catch(() => null);
    await settleWebhookEvent(reservation.key, "failed");
    return plainResponse("rejected", 400);
  }

  if (decision.status === "underpaid") {
    console.warn(
      `[paygate][callback] sous-paiement pour ${session.orderRef} : ${decision.reason}`,
    );
    const now = new Date();
    await db
      .update(paygatePayments)
      .set({
        status: session.status === "paid" ? "paid" : "underpaid",
        valueCoin: parsed.valueCoin || null,
        valueForwardedCoin: parsed.valueForwardedCoin || null,
        coin: parsed.coin || null,
        txidIn: parsed.txidIn || null,
        txidOut: parsed.txidOut || null,
        lastDetail: decision.reason,
        updatedAt: now,
      })
      .where(eq(paygatePayments.orderRef, session.orderRef));

    if (order.status !== "paid") {
      await db
        .update(orders)
        .set({
          ipnStatus: "partially_paid",
          paymentId: parsed.txidIn || order.paymentId,
          payCurrency: parsed.coin || order.payCurrency,
          payAmount: parsed.valueCoin || order.payAmount,
          updatedAt: now,
        })
        .where(and(eq(orders.id, order.id), eq(orders.status, order.status)))
        .catch(() => null);
    }

    await settleWebhookEvent(reservation.key, "ignored");
    return plainResponse("ok", 200);
  }

  // `decision.status === "paid"` : règlement validé !
  const now = new Date();
  await db
    .update(paygatePayments)
    .set({
      status: "paid",
      valueCoin: parsed.valueCoin,
      valueForwardedCoin: parsed.valueForwardedCoin || null,
      coin: parsed.coin,
      txidIn: parsed.txidIn,
      txidOut: parsed.txidOut || null,
      paidAt: session.paidAt ?? now,
      lastDetail: `Reversement marchand validé : ${decision.merchantPayoutCoin} ${parsed.coin}`,
      updatedAt: now,
    })
    .where(eq(paygatePayments.orderRef, session.orderRef));

  if (order.status === "paid") {
    await settleWebhookEvent(reservation.key, "processed");
    return plainResponse("ok", 200);
  }

  const claimed = await db
    .update(orders)
    .set({
      status: "paid",
      ipnStatus: "finished",
      paymentId: parsed.txidIn,
      payAddress: session.polygonAddressIn,
      payCurrency: parsed.coin,
      payAmount: parsed.valueCoin,
      updatedAt: now,
    })
    .where(and(eq(orders.id, order.id), eq(orders.status, order.status)))
    .returning();

  const winner = claimed[0];
  if (winner) {
    try {
      const { config } = await getSiteData();
      await sendPaymentConfirmedEmail(winner, config.name, config.url, config.email);
    } catch (error) {
      console.warn(
        "[paygate][callback] e-mail confirmation impossible :",
        error instanceof Error ? error.message : error,
      );
    }

    if (winner.digitalOrderId || winner.kind === "digital") {
      await enqueueDelivery({ id: winner.digitalOrderId, ref: winner.ref });
      after(async () => {
        try {
          await runDeliveryQueue({ limit: 3 });
        } catch (error) {
          console.error(
            "[paygate][callback] exécution file livraison impossible :",
            error instanceof Error ? error.message : error,
          );
        }
      });
    }
  }

  await settleWebhookEvent(reservation.key, "processed");
  return plainResponse("ok", 200);
}
