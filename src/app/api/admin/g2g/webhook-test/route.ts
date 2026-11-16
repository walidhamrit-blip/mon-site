import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { g2gConfig, g2gWebhookConfigured } from "@/lib/g2g";
import {
  G2G_CONTENT_TYPE,
  g2gBuildTestDeliveryEvent,
  g2gWebhookSignature,
  g2gWebhookTestVerdict,
} from "@/lib/g2g-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/** Délai au-delà duquel on considère le webhook injoignable (ms). */
const TEST_TIMEOUT_MS = 15_000;

/** Taille maximale du corps de réponse renvoyé à l'interface. */
const MAX_ECHO = 1_000;

/** Longueur de l'aperçu gardé quand la réponse est trop grosse pour l'écran. */
const MAX_PREVIEW = 300;

/**
 * Rend une réponse affichable, quelle que soit sa nature.
 *
 * Une URL mal configurée renvoie souvent une page HTML entière : l'afficher
 * brute noierait le verdict sous des kilo-octets de balises. On garde donc
 * un aperçu lisible et on annonce la troncature.
 */
function readableBody(raw: string): unknown {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    const text = raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    return {
      nonJson: true,
      length: raw.length,
      preview: text.slice(0, MAX_PREVIEW) || "(réponse vide)",
    };
  }
  const serialized = JSON.stringify(parsed) ?? "";
  if (serialized.length <= MAX_ECHO) return parsed;
  return {
    truncated: true,
    length: serialized.length,
    preview: serialized.slice(0, MAX_PREVIEW),
  };
}

/**
 * Envoie un événement `order.api_delivery` SYNTHÉTIQUE et correctement signé
 * à notre propre webhook, puis rapporte exactement ce qui s'est passé.
 *
 * Pourquoi ça existe : avec `api_qty = 0` (obligatoire en phase 1), aucune
 * commande réelle ne peut être passée, donc G2G n'émettra jamais spontanément
 * d'événement. Sans ce bouton, la première exécution du webhook aurait lieu
 * le jour où un vrai client paie — c'est-à-dire le pire moment pour découvrir
 * qu'une signature est refusée.
 *
 * Ce que ça valide, de bout en bout :
 *   1. la signature HMAC calculée avec `G2G_WEBHOOK_SECRET_TOKEN` ;
 *   2. l'URL exacte `G2G_WEBHOOK_URL` (elle entre dans la signature) ;
 *   3. la vérification d'horodatage, le décodage, l'idempotence ;
 *   4. la journalisation et l'alerte Telegram.
 *
 * Ce que ça ne fait PAS : aucun achat fournisseur, aucune livraison, aucune
 * modification d'offre. Le `delivery_id` est préfixé `TESTD…`.
 *
 * Sécurité : admin uniquement ; ni le secret token ni la signature ne sont
 * jamais renvoyés ; la cible est l'URL déjà déclarée en configuration
 * (https, ou http de bouclage hors production pour les essais locaux).
 */
export async function POST(req: Request) {
  if (!(await isAdminAuthenticated())) {
    return noStoreJson({ ok: false, error: "unauthorized" }, 401);
  }

  let offerId = "";
  try {
    const input = (await req.json()) as { offerId?: unknown };
    if (typeof input.offerId === "string") offerId = input.offerId.trim().slice(0, 64);
  } catch {
    // Corps absent ou invalide : on garde l'offre de repli.
  }

  const cfg = g2gConfig();

  if (!g2gWebhookConfigured()) {
    const missing = [
      !cfg.webhookSecretToken ? "G2G_WEBHOOK_SECRET_TOKEN" : "",
      !cfg.webhookUrl ? "G2G_WEBHOOK_URL" : "",
      !cfg.userId ? "G2G_USER_ID" : "",
    ].filter(Boolean);
    return noStoreJson(
      {
        ok: false,
        error: "not_configured",
        missing,
        message: `Test impossible : ${missing.join(", ")} ${missing.length > 1 ? "sont" : "est"} absent${missing.length > 1 ? "s" : ""} côté serveur.`,
      },
      503,
    );
  }

  // La cible est la configuration de production, déjà approuvée par un
  // administrateur. On exige néanmoins https en production : un test ne doit
  // pas devenir un vecteur d'appel sortant arbitraire en clair.
  let target: URL;
  try {
    target = new URL(cfg.webhookUrl);
  } catch {
    return noStoreJson(
      {
        ok: false,
        error: "invalid_webhook_url",
        message: "G2G_WEBHOOK_URL n'est pas une URL valide.",
      },
      400,
    );
  }
  const isLoopback = ["localhost", "127.0.0.1", "[::1]", "::1"].includes(target.hostname);
  const allowPlainHttp = isLoopback && process.env.VERCEL_ENV !== "production";
  if (target.protocol !== "https:" && !(target.protocol === "http:" && allowPlainHttp)) {
    return noStoreJson(
      {
        ok: false,
        error: "insecure_webhook_url",
        message: "G2G_WEBHOOK_URL doit être en https pour être testé.",
      },
      400,
    );
  }

  const timestamp = Date.now();
  const signature = g2gWebhookSignature({
    secretToken: cfg.webhookSecretToken,
    webhookUrl: cfg.webhookUrl,
    userId: cfg.userId,
    timestamp,
  });
  const body = g2gBuildTestDeliveryEvent({
    sellerId: cfg.userId,
    offerId: offerId || "G0000000000TEST",
    timestamp,
  });

  let httpStatus: number | null = null;
  let responseBody: unknown = null;
  let networkError: string | null = null;

  try {
    const response = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": G2G_CONTENT_TYPE,
        "g2g-timestamp": String(timestamp),
        "g2g-signature": signature,
        "g2g-userid": cfg.userId,
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(TEST_TIMEOUT_MS),
    });
    httpStatus = response.status;
    responseBody = readableBody(await response.text());
  } catch (error) {
    networkError = error instanceof Error ? error.message : String(error);
    console.warn("[admin][g2g] événement de test non acheminé :", networkError);
  }

  const verdict = g2gWebhookTestVerdict({ httpStatus, body: responseBody, networkError: Boolean(networkError) });

  // Journal de bord : identifiants et statut uniquement. Jamais la signature,
  // jamais le secret token, jamais le corps de l'événement.
  console.info(
    `[admin][g2g] test webhook → ${httpStatus ?? "échec réseau"} verdict=${verdict} delivery=TESTD${timestamp}`,
  );

  return noStoreJson({
    ok: verdict === "accepted" || verdict === "duplicate",
    verdict,
    httpStatus,
    targetUrl: cfg.webhookUrl,
    deliveryId: `TESTD${timestamp}`,
    timestamp,
    response: responseBody,
    networkError,
  });
}
