import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { g2gOfferMappings } from "@/db/schema";
import { g2gConfig } from "@/lib/g2g";
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

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
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
  try {
    await ensureSchema();
    const rows = await db
      .select({ enabled: g2gOfferMappings.enabled })
      .from(g2gOfferMappings)
      .where(eq(g2gOfferMappings.offerId, event.offerId))
      .limit(1);
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

  // Journal UNIQUEMENT des identifiants et quantités : jamais de code,
  // jamais de donnée acheteur, jamais de secret.
  console.info(
    `[g2g][webhook] order.api_delivery order=${event.orderId} offer=${event.offerId} delivery=${event.deliveryId} qty=${event.requestedQty} mapping=${mappingFound ? (mappingEnabled ? "enabled" : "disabled") : "absent"} mode=shadow`,
  );

  try {
    await notifyTelegramAdmin(
      [
        "🛰️ G2G — événement reçu (phase 1, aucun achat automatique)",
        `Commande : ${event.orderId}`,
        `Offre : ${event.offerId}`,
        `Livraison : ${event.deliveryId} · qté ${event.requestedQty}`,
        `Mapping : ${mappingFound ? (mappingEnabled ? "actif" : "désactivé") : "absent"}`,
        "Action : garder api_qty = 0 et traiter manuellement si une vente est en cours.",
      ].join("\n"),
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
    auto_delivery: false,
    mapping: mappingFound ? (mappingEnabled ? "enabled" : "disabled") : "absent",
  });
}
