import { NextResponse } from "next/server";
import { z } from "zod";
import { cancelClientSubscription } from "@/lib/subscriptions";
import { checkRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/csrf";

export const runtime = "nodejs";

const CANCEL_LIMIT = {
  windowMs: 10 * 60 * 1000,
  max: 10,
  minIntervalMs: 1000,
  prefix: "subscription-cancel",
} as const;

const cancelSchema = z.object({
  ref: z.string().min(4).max(64),
  token: z.string().min(16).max(200),
});

/**
 * Annule le renouvellement d'un abonnement. Protégé par la référence et le
 * jeton de suivi (jamais par un identifiant devinable).
 */
export async function POST(req: Request) {
  if (!enforceSameOrigin(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const decision = checkRateLimit(CANCEL_LIMIT, req);
  if (!decision.allow) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(decision.retryAfterSec ?? 60) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const parsed = cancelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
  }

  try {
    const result = await cancelClientSubscription(parsed.data.ref, parsed.data.token);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.code, message: result.message },
        { status: result.status },
      );
    }
    return NextResponse.json({
      ok: true,
      alreadyCanceled: result.alreadyCanceled,
      accessUntil: result.accessUntil,
    });
  } catch (error) {
    console.error(
      "[subscriptions] annulation impossible :",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
