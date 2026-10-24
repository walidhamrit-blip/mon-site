import { NextResponse } from "next/server";
import { getPublicDigitalOrder } from "@/lib/digital-orders";
import { trackingTokenFromRequest } from "@/lib/order-tracking";

/**
 * Suivi public d'une commande digitale.
 *
 * Exige le jeton de suivi (en-tête `x-order-tracking-token`, `Bearer`, ou
 * `?t=`) : sans lui, la commande est introuvable (404), jamais « 403 » —
 * on ne révèle pas l'existence d'une référence.
 *
 * Les codes ne sont renvoyés qu'une fois la commande livrée, et le jeton
 * est le seul secret qui y donne accès.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, context: { params: Promise<{ ref: string }> }) {
  const { ref } = await context.params;
  const token = trackingTokenFromRequest(req);

  try {
    const order = await getPublicDigitalOrder(decodeURIComponent(ref ?? ""), token);
    if (!order) {
      return NextResponse.json(
        { ok: false, error: "not_found" },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      { ok: true, order },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error(
      "[digital][suivi] échec :",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { ok: false, error: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
