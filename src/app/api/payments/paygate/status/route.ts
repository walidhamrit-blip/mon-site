import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { orders } from "@/db/schema";
import { checkRateLimit } from "@/lib/rate-limit";
import { payGateCallbackSecret, reconcilePayGateOrder } from "@/lib/paygate";
import { verifyPayGateCheckoutToken } from "@/lib/paygate-core";

export const dynamic = "force-dynamic";

const STATUS_LIMIT = {
  windowMs: 60 * 1000,
  max: 30,
  minIntervalMs: 1500,
  prefix: "paygate-ui-status",
} as const;

/**
 * Sonde légère pour la page `/pay/card/[ref]` : vérifie le jeton HMAC `k`,
 * déclenche la réconciliation sous budget de requêtes si nécessaire, et
 * renvoie uniquement l'état de paiement (`pending` / `paid` / `failed`),
 * sans jamais exposer de code livré ni de donnée personnelle.
 */
export async function GET(req: Request) {
  const decision = checkRateLimit(STATUS_LIMIT, req);
  if (!decision.allow) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: { "Cache-Control": "no-store" } },
    );
  }

  const url = new URL(req.url);
  const ref = (url.searchParams.get("ref") ?? "").trim().toUpperCase();
  const token = (url.searchParams.get("k") ?? "").trim();

  if (!ref || !token || !verifyPayGateCheckoutToken(ref, token, payGateCallbackSecret())) {
    return NextResponse.json(
      { ok: false, error: "forbidden" },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  await ensureSchema();
  const [row] = await db.select().from(orders).where(eq(orders.ref, ref)).limit(1);
  if (!row || row.paymentMethod !== "paygate") {
    return NextResponse.json(
      { ok: false, error: "not_found" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  const reconciled = await reconcilePayGateOrder(row).catch(() => row);
  return NextResponse.json(
    {
      ok: true,
      status: reconciled.status,
      kind: reconciled.kind,
    },
    { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } },
  );
}
