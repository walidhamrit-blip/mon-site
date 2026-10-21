import { NextResponse } from "next/server";
import { z } from "zod";
import { createClientSubscription } from "@/lib/subscriptions";
import { checkRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/csrf";
import { SUBSCRIPTION_GRACE_DAYS } from "@/lib/subscription-plans";

export const runtime = "nodejs";

/* Limite la cadence des souscriptions par IP+UA : chaque appel crée un
 * abonné et une demande auprès de NOWPayments. */
const SUBSCRIBE_LIMIT = {
  windowMs: 10 * 60 * 1000,
  max: 5,
  minIntervalMs: 1500,
  prefix: "subscription",
} as const;

const subscribeSchema = z.object({
  planId: z.string().min(1).max(64),
  email: z.email().max(254),
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(6).max(24),
  /** Le client doit avoir pris connaissance de la règle de grâce (5 jours). */
  acceptGraceRule: z.literal(true),
});

/**
 * Ouvre un abonnement mensuel ou annuel. NOWPayments envoie au client le
 * lien de la première facture par e-mail ; cette réponse renvoie aussi
 * le lien de suivi (jeton affiché une seule fois).
 */
export async function POST(req: Request) {
  if (!enforceSameOrigin(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const decision = checkRateLimit(SUBSCRIBE_LIMIT, req);
  if (!decision.allow) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      {
        status: 429,
        headers: { "Retry-After": String(decision.retryAfterSec ?? 60) },
      },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_input", message: "Vérifiez les champs du formulaire." },
      { status: 400 },
    );
  }

  try {
    const result = await createClientSubscription(parsed.data);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.code, message: result.message },
        { status: result.status },
      );
    }

    const params = new URLSearchParams({
      ref: result.ref,
      t: result.trackingToken,
    });
    return NextResponse.json(
      {
        ok: true,
        ref: result.ref,
        planName: result.planName,
        priceUsd: result.priceUsd,
        intervalDay: result.intervalDay,
        trackingUrl: `/abonnements/suivi?${params.toString()}`,
        graceDays: SUBSCRIPTION_GRACE_DAYS,
        notice: `La période de grâce ne peut pas dépasser ${SUBSCRIPTION_GRACE_DAYS} jours selon les règles de la passerelle de paiement. Passé ce délai, l'abonnement est suspendu : vous pouvez alors vous réabonner.`,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(
      "[subscriptions] création impossible :",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
