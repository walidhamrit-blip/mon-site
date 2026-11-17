import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { g2gDeliveries, g2gOfferMappings, type G2gOfferMapping } from "@/db/schema";
import {
  applyKillSwitch,
  g2gAutoDeliveryEnabled,
  g2gFeePercent,
  planG2gFulfilment,
  type G2gFulfilmentDecision,
  type G2gFulfilmentPlan,
} from "@/lib/g2g-fulfilment-core";
import {
  g2gConfig,
  g2gConfigured,
  g2gGetOffer,
  type G2gOffer,
} from "@/lib/g2g";
import {
  parseG2gDeliveryEvent,
  verifyG2gWebhookSignature,
} from "@/lib/g2g-core";
import {
  reserveWebhookEvent,
  settleWebhookEvent,
} from "@/lib/delivery-queue";
import { notifyTelegramAdmin } from "@/lib/telegram";

/**
 * Réception des webhooks G2G OpenAPI v2 (PHASE 1 : « shadow mode »).
 *
 * À déclarer dans g2g.com → Avatar → API Integration → Webhook :
 *   Callback URL : https://<domaine>/api/webhooks/g2g
 *   Secret token : généré par G2G, stocké dans G2G_WEBHOOK_SECRET_TOKEN
 *   Events       : order.api_delivery
 *
 * La signature `g2g-signature` est vérifiée AVANT toute lecture du corps.
 * Le corps brut n'est jamais journalisé, et AUCUN code ni secret n'est
 * renvoyé. Les événements sont dédupliqués par `delivery_id` via la table
 * `webhook_events` (déjà utilisée par l'IPN NOWPayments).
 *
 * ⚠️ PHASE 1 — AUCUN ACHAT FOURNISSEUR, AUCUNE LIVRAISON AUTOMATIQUE.
 * Le webhook valide, trace et alerte, puis répond 200. Tant que la phase 2
 * (achat FazerCards à la commande + POST /v2/orders/{id}/delivery) n'est pas
 * déployée, TOUTES les offres G2G doivent rester à `api_qty = 0` : sinon un
 * acheteur paierait une commande que rien ne livre.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function noStoreJson(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...extraHeaders },
  });
}

/**
 * Réponse explicite pour qui ouvre l'URL dans un navigateur.
 *
 * La route n'accepte QUE les `POST` signés de G2G. Sans ce handler, un `GET`
 * produisait une page d'erreur nue (« This page isn't working right now » /
 * HTTP ERROR 405) qui laissait croire à une route absente ou cassée — alors
 * qu'un 405 est au contraire la preuve qu'elle est déployée (une route
 * inexistante renvoie 404).
 *
 * On garde strictement le même statut 405 : aucune information sur la
 * configuration, aucun secret, aucune donnée d'événement n'est exposé.
 */
export async function GET() {
  return noStoreJson(
    {
      ok: false,
      error: "method_not_allowed",
      message:
        "Cette URL est un webhook G2G : elle n'accepte que les POST signés (événement order.api_delivery). Ce 405 est normal et confirme que la route est déployée.",
    },
    405,
    { Allow: "POST" },
  );
}

export async function POST(req: Request) {
  // Corps brut : la signature porte sur l'URL + userId + timestamp (pas sur
  // le corps), mais on garde le texte exact pour l'empreinte d'idempotence.
  const rawBody = await req.text();
  const cfg = g2gConfig();
  const signature = req.headers.get("g2g-signature") ?? "";
  const timestamp = req.headers.get("g2g-timestamp") ?? "";
  const headerUserId = (req.headers.get("g2g-userid") ?? "").trim();

  if (!cfg.webhookSecretToken || !cfg.webhookUrl || !cfg.userId) {
    console.warn("[g2g][webhook] secret token / callback URL / user id absent");
    return noStoreJson({ ok: false, error: "not_configured" }, 503);
  }

  // La doc ne liste que `g2g-signature` et `g2g-timestamp` côté webhook ;
  // si G2G ajoute `g2g-userid`, on l'accepte comme second candidat. Dans
  // tous les cas la vérification exige le secret token.
  const userIds = Array.from(new Set([cfg.userId, headerUserId].filter(Boolean)));
  const verified = userIds.some((userId) =>
    verifyG2gWebhookSignature({
      secretToken: cfg.webhookSecretToken,
      webhookUrl: cfg.webhookUrl,
      userId,
      apiKey: cfg.apiKey,
      timestamp,
      signature,
    }),
  );
  if (!verified) {
    console.warn("[g2g][webhook] signature ou timestamp invalide — rejet");
    return noStoreJson({ ok: false, error: "invalid_signature" }, 401);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return noStoreJson({ ok: false, error: "invalid_json" }, 400);
  }

  const parsed = parseG2gDeliveryEvent(payload);
  if (!parsed.ok) {
    if (parsed.reason === "unsupported_event") {
      // Les autres événements (order.created, offer.updated …) ne doivent
      // jamais déclencher d'achat : on les accuse réception sans les traiter.
      return noStoreJson({ ok: true, ignored: true, eventType: parsed.eventType });
    }
    return noStoreJson({ ok: false, error: parsed.reason }, 400);
  }
  const event = parsed.event;

  // Idempotence stricte : un même delivery_id rejoué ne produit ni second
  // achat ni seconde alerte. Une panne de journal ne bloque pas la réception.
  let webhookKey = "";
  try {
    const reservation = await reserveWebhookEvent({
      provider: "g2g",
      eventId: event.deliveryId,
      status: event.eventType,
      rawBody,
    });
    if (!reservation.fresh) {
      return noStoreJson({ ok: true, duplicate: true });
    }
    webhookKey = reservation.key;
  } catch (error) {
    console.warn(
      "[g2g][webhook] journal d'idempotence indisponible :",
      error instanceof Error ? error.message : error,
    );
  }

  let mappingFound = false;
  let mappingEnabled = false;
  let mapping: G2gOfferMapping | null = null;
  try {
    await ensureSchema();
    const rows = await db
      .select()
      .from(g2gOfferMappings)
      .where(eq(g2gOfferMappings.offerId, event.offerId))
      .limit(1);
    mapping = rows[0] ?? null;
    mappingFound = rows.length > 0;
    mappingEnabled = rows[0]?.enabled === true;
  } catch (error) {
    console.error(
      "[g2g][webhook] mapping illisible :",
      error instanceof Error ? error.message : error,
    );
    // 503 → G2G réessaie ; l'événement reste « received » dans le journal.
    return noStoreJson({ ok: false, error: "db_unavailable" }, 503);
  }

  // Coupe-circuit global : tant qu'il n'est pas activé, AUCUN achat n'est
  // possible, quel que soit l'état de la correspondance.
  const autoDeliveryEnabled = g2gAutoDeliveryEnabled(process.env.G2G_AUTO_DELIVERY);

  /**
   * Répétition générale de la phase 2.
   *
   * On calcule la décision qu'on PRENDRAIT, et on la consigne — sans jamais
   * dépenser un centime : l'achat fournisseur n'est pas encore câblé. Cela
   * permet de voir, sur des événements réels, exactement ce que l'automation
   * ferait avant de l'autoriser.
   */
  let decision: G2gFulfilmentDecision = mappingFound ? "offer_unreadable" : "mapping_disabled";
  let plan: G2gFulfilmentPlan | null = null;
  let offerUnreadable: string | null = null;

  if (mapping) {
    let offer: G2gOffer | null = null;
    if (g2gConfigured()) {
      try {
        const response = await g2gGetOffer(event.offerId);
        offer = response.payload ?? null;
      } catch (error) {
        offerUnreadable = error instanceof Error ? error.message : String(error);
        console.warn("[g2g][webhook] offre illisible :", offerUnreadable);
      }
    } else {
      offerUnreadable = "clés API G2G absentes";
    }

    if (offer) {
      plan = planG2gFulfilment({
        mappingEnabled: mapping.enabled,
        /**
         * « Comme si » l'automation était activée — VOLONTAIRE, et sans
         * risque puisqu'aucun achat n'est câblé.
         *
         * Le coupe-circuit est vérifié en tête de `planG2gFulfilment` : le
         * laisser ici masquerait marge, plafond et format de code derrière
         * un sempiternel `kill_switch_off`, et la répétition générale
         * n'apprendrait rien. On calcule donc la décision hypothétique,
         * puis `applyKillSwitch()` la retient si elle aurait acheté.
         */
        autoDeliveryEnabled: true,
        feePercent: g2gFeePercent(process.env.G2G_FEE_PERCENT),
        offerUnitPrice: offer.unit_price ?? null,
        offerCurrency: offer.currency ?? mapping.saleCurrency,
        offerDeliveryType: offer.delivery_type ?? null,
        offerCodeLabel: offer.code_label ?? null,
        supplierCostUsd: Number(mapping.supplierPriceUsd ?? 0) || 0,
        saleCurrency: mapping.saleCurrency,
        minMarginPercent: mapping.minMarginPercent,
        maxCostUsd: Number(mapping.maxCostUsd ?? 0) || 0,
        requestedQty: event.requestedQty,
      });
      decision = applyKillSwitch(plan.decision, autoDeliveryEnabled);
    }
  }

  // Journal de la décision : identifiants, montants et verdict uniquement.
  // Jamais de code, jamais de donnée acheteur, jamais de secret.
  console.info(
    `[g2g][webhook] order.api_delivery order=${event.orderId} offer=${event.offerId} delivery=${event.deliveryId} qty=${event.requestedQty} mapping=${mappingFound ? (mappingEnabled ? "enabled" : "disabled") : "absent"} decision=${decision}${plan ? ` hypothetique=${plan.decision}` : ""}${plan ? ` prix=${plan.unitPrice} cout=${plan.supplierCostUsd} commission=${plan.feePercent}% net=${plan.netRevenueUsd} marge=${plan.netMarginPercent}%` : ""}${offerUnreadable ? ` offer_illisible=1` : ""} coupe_circuit=${autoDeliveryEnabled ? "on" : "off"} achat=aucun`,
  );

  try {
    await ensureSchema();
    await db
      .insert(g2gDeliveries)
      .values({
        deliveryId: event.deliveryId,
        orderId: event.orderId,
        offerId: event.offerId,
        requestedQty: event.requestedQty,
        decision,
        status: offerUnreadable ? "failed" : decision === "proceed" ? "planned" : "skipped",
        unitPriceUsd: plan && plan.unitPrice > 0 ? String(plan.unitPrice) : null,
        supplierCostUsd: plan && plan.supplierCostUsd > 0 ? String(plan.supplierCostUsd) : null,
        netMarginPercent: plan ? String(plan.netMarginPercent) : null,
        detail: offerUnreadable
          ? `Offre G2G illisible : ${offerUnreadable}`
          : plan
            ? autoDeliveryEnabled
              ? plan.summary
              : `${plan.summary} — achat retenu par le coupe-circuit (G2G_AUTO_DELIVERY).`
            : decision,
        updatedAt: new Date(),
      })
      .onConflictDoNothing({ target: g2gDeliveries.deliveryId });
  } catch (error) {
    // Une panne du journal ne doit jamais faire échouer la réception :
    // mieux vaut un événement sans trace qu'un événement rejoué sans fin.
    console.warn(
      "[g2g][webhook] journal de livraison indisponible :",
      error instanceof Error ? error.message : error,
    );
  }

  try {
    await notifyTelegramAdmin(
      [
        "🛰️ G2G — événement reçu (aucun achat automatique)",
        `Commande : ${event.orderId}`,
        `Offre : ${event.offerId}`,
        `Livraison : ${event.deliveryId} · qté ${event.requestedQty}`,
        `Mapping : ${mappingFound ? (mappingEnabled ? "actif" : "désactivé") : "absent"}`,
        plan
          ? `Décision : ${decision} — ${plan.summary}`
          : `Décision : ${decision}${offerUnreadable ? " (offre illisible)" : ""}`,
        plan
          ? `Prix ${plan.unitPrice} $ · coût ${plan.supplierCostUsd} $ · commission ${plan.feePercent} %`
          : null,
        plan
          ? `Net ${plan.netRevenueUsd} $ → marge ${plan.netMarginPercent} % (seuil ${mapping?.minMarginPercent ?? "?"} %)`
          : null,
        plan && !autoDeliveryEnabled
          ? `Si l'automation était activée : ${plan.decision} (marge ${plan.netMarginPercent} %)`
          : null,
        "Action : garder api_qty = 0 et traiter manuellement si une vente est en cours.",
      ]
        .filter((line): line is string => Boolean(line))
        .join("\n"),
    );
  } catch (error) {
    console.warn(
      "[g2g][webhook] alerte Telegram impossible :",
      error instanceof Error ? error.message : error,
    );
  }

  await settleWebhookEvent(webhookKey, "ignored");

  return noStoreJson({
    ok: true,
    dry_run: true,
    /** Reflète le coupe-circuit, pas une capacité : rien n'est acheté. */
    auto_delivery: false,
    auto_delivery_enabled: autoDeliveryEnabled,
    mapping: mappingFound ? (mappingEnabled ? "enabled" : "disabled") : "absent",
    decision,
    /** Ce qui se serait passé si le coupe-circuit était activé. */
    hypothetical_decision: plan?.decision ?? null,
    net_margin_percent: plan?.netMarginPercent ?? null,
    /**
     * Prix de vente relu chez G2G et commission appliquée — de quoi
     * relire un verdict sans ouvrir les logs. Le coût fournisseur est
     * délibérément absent : cette réponse revient à G2G sur un vrai
     * événement, et notre prix d'achat ne les regarde pas.
     */
    unit_price_usd: plan?.unitPrice ?? null,
    fee_percent: plan?.feePercent ?? null,
  });
}
