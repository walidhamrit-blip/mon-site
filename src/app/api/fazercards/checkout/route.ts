import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createFazercardsCheckout,
  FazercardsOrderError,
} from "@/lib/fazercards-orders";
import { getFazercardsCatalog } from "@/lib/fazercards-catalog";
import { checkRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/csrf";

/**
 * Création d'une commande de code / carte cadeau chez FazerCards.
 *
 * Le client n'envoie QUE des identifiants (produit, montant, quantité)
 * et ses coordonnées : le prix est recalculé côté serveur à partir du
 * catalogue FazerCards, puis une facture crypto hébergée est créée.
 * Aucun achat n'est effectué chez FazerCards à ce stade — l'achat a lieu
 * APRÈS confirmation du paiement (IPN NOWPayments).
 */

export const runtime = "nodejs";

const checkoutSchema = z.object({
  productId: z.string().min(1).max(120),
  denominationId: z.string().min(1).max(100),
  quantity: z.coerce.number().int().min(1).max(10).default(1),
  email: z.string().email().max(254),
  name: z.string().max(120).optional(),
  phone: z.string().max(40).optional(),
  locale: z.enum(["ar", "en"]).optional(),
  // Champs acheteur dynamiques (top-ups : player_id, …) — transmis tels quels.
  fields: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
});

const CHECKOUT_LIMIT = {
  windowMs: 10 * 60 * 1000,
  max: 8,
  minIntervalMs: 1200,
  prefix: "fazercards-checkout",
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

  // Catalogue FazerCards : servi depuis le cache (10 min par défaut, voir
  // FAZERCARDS_CATALOG_TTL_SECONDS). Une synchro unique est partagée par
  // toutes les requêtes concurrentes ; en cas de panne fournisseur, le
  // dernier catalogue connu reste servi jusqu'à 60 min.
  let catalog;
  try {
    catalog = await getFazercardsCatalog();
  } catch (error) {
    console.error("[fazercards][checkout] synchronisation catalogue :", error);
    return NextResponse.json(
      {
        ok: false,
        error: "catalog_unavailable",
        message: "Catalogue fournisseur indisponible pour le moment.",
      },
      { status: 502 },
    );
  }

  const productsAdapter = {
    findBySlug: (slug: string) => {
      const p = catalog.products.find((x) => x.slug === slug);
      if (!p) return null;
      return {
        kind: p.kind,
        categoryId: p.categoryId,
        denominations: p.denominations.map((d) => ({
          id: d.id,
          label: d.label,
          priceUsd: d.priceUsd,
          available: d.available,
          maxOrderQuantity: d.maxOrderQuantity,
          supplierOfferId: d.supplierOfferId,
          supplierCostUsd: d.supplierCostUsd,
          fields: d.fields,
        })),
      };
    },
  };

  try {
    const result = await createFazercardsCheckout(
      {
        productId: parsed.data.productId,
        denominationId: parsed.data.denominationId,
        quantity: parsed.data.quantity,
        email: parsed.data.email,
        name: parsed.data.name,
        phone: parsed.data.phone,
        locale: parsed.data.locale,
        fields: parsed.data.fields,
      },
      productsAdapter,
      req,
    );
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
    if (error instanceof FazercardsOrderError) {
      return NextResponse.json(
        { ok: false, error: error.code, message: error.message },
        { status: error.status },
      );
    }
    console.error("[fazercards][checkout] échec :", error);
    return NextResponse.json(
      { ok: false, error: "checkout_failed", message: "Commande impossible pour le moment." },
      { status: 500 },
    );
  }
}
