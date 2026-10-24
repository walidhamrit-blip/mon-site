import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createDigitalCheckout,
  DigitalOrderError,
} from "@/lib/digital-orders";
import { isNowPaymentsError } from "@/lib/nowpayments";
import { checkRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/csrf";

/**
 * Création d'une commande de code / carte cadeau (boutique `/codes`).
 *
 * Le client n'envoie QUE des identifiants (produit, montant, quantité) et
 * ses coordonnées : le prix est recalculé côté serveur à partir du
 * catalogue, puis une facture crypto hébergée est créée. Aucun achat
 * n'est effectué chez Reloadly à ce stade — l'achat a lieu APRÈS
 * confirmation du paiement (IPN).
 */

export const runtime = "nodejs";

const checkoutSchema = z.object({
  productSlug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug invalide"),
  denominationId: z.string().min(1).max(100),
  quantity: z.coerce.number().int().min(1).max(10).default(1),
  email: z.string().email().max(254),
  name: z.string().max(120).optional(),
  phone: z.string().max(40).optional(),
  locale: z.enum(["ar", "en"]).optional(),
});

const CHECKOUT_LIMIT = {
  windowMs: 10 * 60 * 1000,
  max: 8,
  minIntervalMs: 1200,
  prefix: "digital-checkout",
} as const;

export async function POST(req: Request) {
  if (!enforceSameOrigin(req)) {
    return NextResponse.json(
      { ok: false, error: "csrf", message: "Origine non autorisée." },
      { status: 403 },
    );
  }

  const decision = checkRateLimit(CHECKOUT_LIMIT, req);
  if (!decision.allow) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", retryAfterSec: decision.retryAfterSec },
      {
        status: 429,
        headers: { "Retry-After": String(Math.max(1, decision.retryAfterSec)) },
      },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json", message: "Corps JSON invalide." },
      { status: 400 },
    );
  }

  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_input",
        message: parsed.error.issues
          .map((issue) => `${issue.path.join(".") || "?"}: ${issue.message}`)
          .join(" ; "),
      },
      { status: 400 },
    );
  }

  try {
    const result = await createDigitalCheckout(parsed.data, req);
    return NextResponse.json({
      ok: true,
      orderRef: result.orderRef,
      trackingToken: result.trackingToken,
      paymentUrl: result.paymentUrl,
      totalUsd: result.totalUsd,
      productTitle: result.productTitle,
      denominationLabel: result.denominationLabel,
      quantity: result.quantity,
    });
  } catch (error) {
    if (error instanceof DigitalOrderError) {
      return NextResponse.json(
        { ok: false, error: error.code, message: error.message },
        { status: error.status },
      );
    }
    if (isNowPaymentsError(error)) {
      console.error("[digital][checkout] NOWPayments :", error.message);
      return NextResponse.json(
        {
          ok: false,
          error: "gateway_error",
          message: `Paiement indisponible : ${error.message}`,
        },
        { status: 502 },
      );
    }
    console.error(
      "[digital][checkout] échec :",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { ok: false, error: "checkout_failed", message: "Commande impossible pour le moment." },
      { status: 500 },
    );
  }
}
