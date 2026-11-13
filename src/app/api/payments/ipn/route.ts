import { NextResponse, after } from "next/server";
import { isHighCostNetwork } from "@/lib/payment-networks";
import { and, eq, inArray } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { orders, webhookEvents, type Order } from "@/db/schema";
import { getSiteData } from "@/lib/store";
import {
  isPaidStatus,
  nextOrderStatus,
  orderStatusFromIpn,
  validatePaidAmount,
  verifyIpnSignature,
  type OrderStatus,
} from "@/lib/nowpayments";
import { orderRefCandidates } from "@/lib/installments";
import { sendPaymentConfirmedEmail } from "@/lib/order-emails";
import {
  applySubscriptionIpn,
  reconcileSubscriptionInvoice,
} from "@/lib/subscriptions";
import { subscriptionIdFromPayload } from "@/lib/subscription-lifecycle";
import {
  enqueueDelivery,
  reserveWebhookEvent,
  runDeliveryQueue,
  settleWebhookEvent,
} from "@/lib/delivery-queue";

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

  // ── Idempotence stricte ────────────────────────────────────────────────
  // NOWPayments rejoue un même événement (retry réseau, `finished` répété).
  // `webhook_events.event_key` est UNIQUE : la première requête réserve la
  // clé et traite ; les suivantes répondent 200 sans rien refaire (ni
  // second e-mail, ni second achat). Un échec de traitement libère la clé
  // pour que le rejeu du fournisseur puisse aboutir.
  let webhookKey = "";
  try {
    const reservation = await reserveWebhookEvent({
      provider: "nowpayments",
      eventId: paymentId,
      status: ipnStatus,
      rawBody,
    });
    if (!reservation.fresh) {
      console.info(`[ipn] doublon ignoré : ${paymentId} (${ipnStatus})`);
      return NextResponse.json({ ok: true, duplicate: true });
    }
    webhookKey = reservation.key;
  } catch (error) {
    // Le journal d'idempotence ne doit jamais bloquer un paiement : on
    // continue (les garde-fous de la commande restent en place) mais on
    // trace l'incident.
    console.warn(
      "[ipn] journal d'idempotence indisponible :",
      error instanceof Error ? error.message : error,
    );
  }

  // Paiement d'abonnement (mensuel / annuel) : traité à part, il ne passe
  // pas par le flux des commandes ponctuelles ci-dessous.
  const subscriptionRemoteId = subscriptionIdFromPayload(payload);
  if (subscriptionRemoteId) {
    try {
      const result = await applySubscriptionIpn(payload, subscriptionRemoteId);
      if (result.outcome === "activated" || result.outcome === "renewed") {
        console.info(
          `[ipn][abonnement] ${result.outcome} — ${result.order.ref} (${ipnStatus})`,
        );
        if (result.firstActivation) {
          const { config } = await getSiteData();
          const outcome = await sendPaymentConfirmedEmail(
            result.order,
            config.name,
            config.url,
            config.email,
          );
          if (!outcome.ok) {
            console.warn("[ipn][abonnement] e-mail non envoyé :", outcome.error);
          }
        }
      } else if (result.outcome === "amount_mismatch") {
        console.warn(`[ipn][abonnement] montant refusé : ${result.reason}`);
      } else {
        console.info(`[ipn][abonnement] ignoré : ${result.outcome}`);
      }
      return NextResponse.json({ ok: true, subscription: result.outcome });
    } catch (error) {
      console.error(
        "[ipn][abonnement] traitement impossible :",
        error instanceof Error ? error.message : error,
      );
      // 500 → NOWPayments réessaiera plus tard.
      return NextResponse.json({ ok: false, error: "processing_failed" }, { status: 500 });
    }
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
      // Les IPN d'abonnement ne portent ni order_id ni identifiant
      // d'abonnement, seulement invoice_id : on tente la réconciliation
      // par facture avant de déclarer le paiement inconnu.
      if (isPaidStatus(ipnStatus)) {
        try {
          const reconciled = await reconcileSubscriptionInvoice(payload);
          if (reconciled) {
            if (
              reconciled.outcome === "activated" ||
              reconciled.outcome === "renewed"
            ) {
              console.info(
                `[ipn][abonnement] ${reconciled.outcome} par facture — ${reconciled.order.ref} (${ipnStatus})`,
              );
              if (reconciled.firstActivation) {
                const { config } = await getSiteData();
                const outcome = await sendPaymentConfirmedEmail(
                  reconciled.order,
                  config.name,
                  config.url,
                  config.email,
                );
                if (!outcome.ok) {
                  console.warn(
                    "[ipn][abonnement] e-mail non envoyé :",
                    outcome.error,
                  );
                }
              }
              return NextResponse.json({
                ok: true,
                subscription: reconciled.outcome,
                reconciledViaInvoice: true,
              });
            }
            if (reconciled.outcome === "amount_mismatch") {
              console.warn(
                `[ipn][abonnement] montant refusé (facture ${payload.invoice_id ?? "?"}) : ${reconciled.reason}`,
              );
            }
            return NextResponse.json({
              ok: true,
              subscription: reconciled.outcome,
              reconciledViaInvoice: true,
            });
          }
        } catch (error) {
          console.error(
            "[ipn][abonnement] réconciliation impossible :",
            error instanceof Error ? error.message : error,
          );
          // 500 → NOWPayments réessaiera plus tard.
          return NextResponse.json(
            { ok: false, error: "processing_failed" },
            { status: 500 },
          );
        }
      }

      // Paiement inconnu (ex. commande créée sur un autre
      // environnement) : on accepte la notification sans rien
      // modifier, pour que NOWPayments ne la renvoie pas.
      // Diagnostic : le corps de l'IPN ne contient aucun secret
      // (la signature HMAC voyage dans l'en-tête), on le journalise
      // donc tronqué pour identifier les champs réellement envoyés,
      // notamment l'identifiant d'abonnement si sa clé diffère.
      console.warn(
        "[ipn] paiement inconnu :",
        paymentId,
        orderId,
        "| clés:",
        Object.keys(payload).join(","),
        "| corps:",
        rawBody.slice(0, 1200),
      );
      return NextResponse.json({ ok: true, ignored: true });
    }

    const currentStatus: OrderStatus = (
      ["pending", "paid", "failed", "expired"] as const
    ).includes(order.status as OrderStatus)
      ? (order.status as OrderStatus)
      : "pending";
    const incomingStatus = orderStatusFromIpn(ipnStatus);
    let resolvedStatus = nextOrderStatus(currentStatus, ipnStatus);

    // Un statut « terminé » ne valide la commande que si le montant et
    // la devise annoncés correspondent à la facture attendue.
    const amountValidation =
      incomingStatus === "paid"
        ? validatePaidAmount(order, payload)
        : { ok: true, reason: null as string | null };
    if (incomingStatus === "paid" && !amountValidation.ok) {
      resolvedStatus = currentStatus;
      console.warn(
        `[ipn] montant refusé pour ${order.ref} : ${amountValidation.reason}`,
      );
    }

    // Déjà payée : une notification « terminé » incohérente ne doit pas
    // écraser les informations du paiement qui a validé la commande.
    if (
      currentStatus === "paid" &&
      incomingStatus === "paid" &&
      !amountValidation.ok
    ) {
      return NextResponse.json({
        ok: true,
        ignored: "amount_mismatch",
        reason: amountValidation.reason,
      });
    }

    // Notification plus ancienne que l'état déjà connu (ex. `confirming`
    // reçue après `finished`) : on accuse réception sans rien écraser.
    const isStale =
      resolvedStatus !== incomingStatus && amountValidation.ok;
    if (isStale) {
      console.info(
        `[ipn] statut ignoré pour ${order.ref} : ${ipnStatus} après ${currentStatus}`,
      );
      return NextResponse.json({ ok: true, ignored: "stale_status" });
    }

    const payAddress =
      payload.pay_address != null
        ? String(payload.pay_address)
        : order.payAddress;
    const payCurrency =
      payload.pay_currency != null
        ? String(payload.pay_currency)
        : order.payCurrency;
    const payAmount =
      payload.pay_amount != null ? String(payload.pay_amount) : order.payAmount;

    // Chaîne coûteuse détectée (ERC-20, TRC-20, BTC, ETH natif) : les frais
    // fixes y dépassent la marge d'un petit article. Le paiement est honoré
    // — on ne refuse jamais un client qui a payé — mais on le signale pour
    // vérifier que la liste blanche est bien réglée dans NOWPayments
    // (Coin settings) et pour suivre la marge réelle.
    if (isHighCostNetwork(payCurrency)) {
      console.warn(
        `[ipn] paiement ${order.ref} reçu sur une chaîne coûteuse (${payCurrency}) — vérifier les Coin settings NOWPayments`,
      );
    }

    // Mise à jour conditionnelle : si le polling (ou un autre IPN) a déjà
    // fait la même transition en parallèle, cette requête ne revendique
    // pas une seconde fois le passage à `paid` — donc pas d'e-mail doublé.
    const claimed = await db
      .update(orders)
      .set({
        status: resolvedStatus,
        ipnStatus,
        // Mémorise le payment_id le plus récent : le polling direct
        // (page de suivi) interroge alors le bon paiement.
        paymentId,
        payAddress,
        payCurrency,
        payAmount,
        paymentUrl: order.paymentUrl,
        updatedAt: new Date(),
      })
      .where(and(eq(orders.id, order.id), eq(orders.status, order.status)))
      .returning({ id: orders.id });

    if (claimed.length === 0) {
      return NextResponse.json({ ok: true, ignored: "concurrent_update" });
    }

    if (!amountValidation.ok) {
      return NextResponse.json({
        ok: true,
        ignored: "amount_mismatch",
        reason: amountValidation.reason,
      });
    }

    // Notification à l'agence uniquement par la requête qui a réellement
    // fait passer la commande à `paid`.
    if (currentStatus !== "paid" && resolvedStatus === "paid") {
      const { config } = await getSiteData();
      const updated = {
        ...order,
        status: resolvedStatus,
        ipnStatus,
        payAddress,
        payCurrency,
        payAmount,
      };
      const outcome = await sendPaymentConfirmedEmail(
        updated,
        config.name,
        config.url,
        config.email,
      );
      if (!outcome.ok) {
        console.warn("[ipn] e-mail paiement non envoyé :", outcome.error);
      }
    }

    // Commande de code / carte cadeau : le paiement est confirmé, la
    // livraison passe par la FILE (Neon) au lieu d'être tentée en série
    // dans cette requête.
    //
    // Pourquoi : un appel fournisseur peut dépasser la limite de temps
    // serverless. Avant, la commande restait alors « payée » sans achat,
    // jusqu'au cron du lendemain. Désormais :
    //   1. la commande passe en `paid_fulfilling` et un job de livraison
    //      UNIQUE est créé (idempotence stricte : `order_ref` +
    //      `idempotency_key` uniques) ;
    //   2. le job est traité juste après la réponse HTTP (`after()`, Next
    //      16) — le webhook répond vite, NOWPayments ne rejoue pas ;
    //   3. en cas d'échec : retry programmé (backoff) + alerte Telegram
    //      instantanée, puis revue manuelle après épuisement.
    let digital: string | null = null;
    if (order.digitalOrderId) {
      try {
        const queued = await enqueueDelivery({
          id: order.digitalOrderId,
          ref: order.ref,
        });
        digital = queued.created ? "queued" : "already_queued";

        after(async () => {
          try {
            const report = await runDeliveryQueue({ limit: 3 });
            console.info(`[ipn][file] ${order.ref} : ${JSON.stringify(report.results)}`);
          } catch (error) {
            // Le job reste en base : le cron et le suivi client le reprendront.
            console.error(
              "[ipn][file] traitement différé impossible :",
              error instanceof Error ? error.message : error,
            );
          }
        });
      } catch (error) {
        // La commande reste `paid_fulfilling` : reprise par le cron/suivi.
        digital = "queue_error";
        console.error(
          "[ipn][file] mise en file impossible :",
          error instanceof Error ? error.message : error,
        );
      }
    }

    console.info(`[ipn] commande ${order.ref} → ${ipnStatus}`);
    await settleWebhookEvent(webhookKey, "processed");
    return NextResponse.json({ ok: true, ...(digital ? { digital } : {}) });
  } catch (error) {
    console.error("[ipn] traitement impossible :", error instanceof Error ? error.message : error);
    // La clé d'idempotence est libérée : le rejeu de NOWPayments doit
    // pouvoir retenter un traitement qui a échoué (sinon la commande
    // resterait bloquée derrière un événement marqué « reçu »).
    if (webhookKey) {
      try {
        await db.delete(webhookEvents).where(eq(webhookEvents.eventKey, webhookKey));
      } catch {
        // sans effet : le pire cas est un doublon ignoré, jamais un double achat
      }
    }
    // 500 → NOWPayments réessaiera plus tard.
    return NextResponse.json({ ok: false, error: "processing_failed" }, { status: 500 });
  }
}
