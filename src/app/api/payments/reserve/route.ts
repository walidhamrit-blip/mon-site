import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { orders } from "@/db/schema";
import { siteConfig } from "@/lib/config";
import { getSiteData } from "@/lib/store";
import { siteBaseUrl } from "@/lib/site-url";
import { resolveDemoClassification } from "@/lib/classification";
import {
  createInvoice,
  isNowPaymentsError,
  nowPaymentsConfigured,
  type CreatedInvoice,
} from "@/lib/nowpayments";
import {
  createTrackingToken,
  newOrderReference,
  trackingQuery,
} from "@/lib/order-tracking";
import { checkRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/csrf";

/**
 * Réservation prioritaire : le client verse un petit acompte (1 $ par
 * défaut, réglable dans /admin/settings) pour prendre une place en avance
 * dans le planning, sur un site précis du portfolio.
 *
 * Le montant est calculé côté serveur depuis la configuration « vivante » :
 * le navigateur ne peut pas choisir un autre prix. Une commande de type
 * `reservation` est créée puis une facture NOWPayments est générée ; la
 * confirmation arrive par le même webhook IPN que les formules.
 */

interface ErrorDetail {
  source: "config" | "database" | "nowpayments" | "input";
  status: number | null;
  message: string;
}

function errorResponse(error: string, httpStatus: number, detail: ErrorDetail) {
  return NextResponse.json({ ok: false, error, detail }, { status: httpStatus });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function gatewayDetail(error: unknown): ErrorDetail {
  return {
    source: "nowpayments",
    status: isNowPaymentsError(error) ? error.status : null,
    message: errorMessage(error),
  };
}

function databaseDetail(error: unknown): ErrorDetail {
  return { source: "database", status: null, message: errorMessage(error) };
}

/* Limitation par IP + empreinte UA (cf. src/lib/rate-limit.ts) : évite
 * qu'une même personne crée des dizaines de factures de 1 $.
 * Note : sur Vercel serverless, la limite s'applique par instance (la
 * mémoire n'est pas partagée entre instances) — c'est volontairement
 * plus permissif que la valeur affichée. */
const RESERVE_LIMIT = {
  windowMs: 10 * 60 * 1000,
  max: 8,
  // Anti-rafale : bloque les rafales courtes (5 requêtes en 1 s).
  minIntervalMs: 800,
  prefix: "reserve",
} as const;

const reserveSchema = z.object({
  demoSlug: z.string().min(1).max(120),
  name: z.string().max(120).optional(),
  email: z.string().email("Email invalide").max(254),
  phone: z.string().max(40).optional(),
  locale: z.enum(["ar", "en"]).optional(),
  utm: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  // Anti-CSRF : la réservation est déclenchée depuis le site public. On
  // vérifie l'en-tête `Origin` (renvoyé par les navigateurs pour les
  // fetch AJAX cross-origin et par les soumissions POST). Les bots
  // légitimes (curl, Postman) doivent ajouter un en-tête `X-Requested-By`
  // (cf. lib/csrf.ts) — cela évite les soumissions déclenchées depuis un
  // site tiers malveillant à l'insu du visiteur.
  if (!enforceSameOrigin(req)) {
    return errorResponse("csrf", 403, {
      source: "input",
      status: null,
      message: "Origine non autorisée.",
    });
  }

  const decision = checkRateLimit(RESERVE_LIMIT, req);
  if (!decision.allow) {
    return errorResponse("rate_limited", 429, {
      source: "input",
      status: null,
      message: `Trop de réservations en peu de temps — réessayez dans ${Math.max(1, decision.retryAfterSec)} s.`,
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("invalid_json", 400, {
      source: "input",
      status: null,
      message: "Corps JSON invalide",
    });
  }

  const parsed = reserveSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("invalid_input", 400, {
      source: "input",
      status: null,
      message: parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "?"}: ${issue.message}`)
        .join(" ; "),
    });
  }

  const data = parsed.data;
  const { config, content } = await getSiteData();

  const demo = content.demos.find((item) => item.slug === data.demoSlug);
  if (!demo) {
    return errorResponse("demo_not_found", 404, {
      source: "input",
      status: null,
      message: `Site « ${data.demoSlug} » introuvable`,
    });
  }

  const reservation = config.reservation ?? siteConfig.reservation;
  if (!reservation.enabled) {
    return errorResponse("reservation_disabled", 403, {
      source: "config",
      status: null,
      message:
        "L'offre de réservation est désactivée (Configuration → Réservation).",
    });
  }

  const depositUsd = Number(reservation.depositUsd);
  if (!Number.isFinite(depositUsd) || depositUsd <= 0) {
    return errorResponse("invalid_deposit", 400, {
      source: "config",
      status: null,
      message: `Acompte invalide : ${reservation.depositUsd}`,
    });
  }
  const depositLyd =
    Number.isFinite(Number(reservation.depositLyd)) && Number(reservation.depositLyd) >= 0
      ? Number(reservation.depositLyd)
      : 0;

  if (!nowPaymentsConfigured()) {
    return errorResponse("gateway_not_configured", 503, {
      source: "config",
      status: null,
      message:
        "NOWPAYMENTS_API_KEY absente du serveur (variable d'environnement non définie ou non appliquée à l'environnement interrogé).",
    });
  }

  const classification = resolveDemoClassification(demo, config.pricing.plans);
  const tierInfo = classification ? `Cat. ${classification.tier}` : "Réservation";
  const categoryLabel = classification
    ? `Cat. ${classification.tier} · ${classification.nameEn}`
    : null;
  const ref = newOrderReference("RSV");
  const tracking = createTrackingToken();

  // 1) Commande en attente — trace immédiate dans /admin/orders.
  let orderId: number;
  try {
    await ensureSchema();
    const inserted = await db
      .insert(orders)
      .values({
        ref,
        trackingTokenHash: tracking.hash,
        kind: "reservation",
        demoSlug: demo.slug,
        planId: "reservation",
        planName: `Réservation — ${demo.titleEn}${
          categoryLabel ? ` (${categoryLabel})` : ""
        }`.slice(0, 190),
        amountLyd: String(depositLyd),
        amountUsd: String(depositUsd),
        currency: "usd",
        installments: 1,
        installmentIndex: 1,
        clientName: data.name?.trim() || null,
        email: data.email.trim(),
        phone: data.phone?.trim() || null,
        utm: data.utm || null,
        locale: data.locale ?? null,
      })
      .returning({ id: orders.id });
    orderId = inserted[0]?.id ?? 0;
  } catch (error) {
    console.error("[reservation] création commande impossible :", errorMessage(error));
    return errorResponse("save_failed", 500, databaseDetail(error));
  }

  // 2) Facture NOWPayments à 1 $ (page de paiement hébergée).
  //    Les URLs de retour (succès/annulation/IPN) pointent vers
  //    l'environnement réellement utilisé (voir src/lib/site-url.ts).
  const baseUrl = siteBaseUrl(req);
  const trackingParams = trackingQuery(ref, tracking.token);
  let invoice: CreatedInvoice;
  try {
    invoice = await createInvoice({
      priceAmount: depositUsd,
      orderId: ref,
      orderDescription: `${config.name} — ${tierInfo} — ${demo.titleEn} (réservation prioritaire)`,
      ipnCallbackUrl: `${baseUrl}/api/payments/ipn`,
      successUrl: `${baseUrl}/pay/success?${trackingParams}`,
      cancelUrl: `${baseUrl}/pay/cancel?${trackingParams}`,
    });
  } catch (error) {
    console.error("[reservation] NOWPayments refusé :", errorMessage(error));
    // Aucune facture → on retire la ligne orpheline.
    await db.delete(orders).where(eq(orders.id, orderId)).catch(() => null);
    return errorResponse("gateway_error", 502, gatewayDetail(error));
  }

  try {
    await db
      .update(orders)
      .set({ paymentUrl: invoice.invoice_url, updatedAt: new Date() })
      .where(eq(orders.id, orderId));
  } catch (error) {
    console.error(
      "[reservation] lien facture impossible :",
      errorMessage(error),
    );
  }

  return NextResponse.json({
    ok: true,
    orderRef: ref,
    trackingToken: tracking.token,
    demoSlug: demo.slug,
    classification: classification
      ? {
          tier: classification.tier,
          planId: classification.planId,
          name: classification.name,
          nameEn: classification.nameEn,
          priceUsd: classification.priceUsd,
          priceLyd: classification.priceLyd,
        }
      : null,
    depositUsd,
    depositLyd,
    paymentUrl: invoice.invoice_url,
    priceAmount: invoice.price_amount,
    priceCurrency: invoice.price_currency,
  });
}
