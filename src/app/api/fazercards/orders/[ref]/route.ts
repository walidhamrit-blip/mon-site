import { NextResponse } from "next/server";
import { getPublicDigitalOrder } from "@/lib/digital-orders";
import { trackingTokenFromRequest } from "@/lib/order-tracking";

/**
 * Suivi public d'une commande passée via la caisse FazerCards.
 *
 * Même contrat que `/api/digital/orders/[ref]` : la commande est identifiée
 * par sa référence **et** le jeton de suivi (en-tête
 * `x-order-tracking-token`, `Bearer`, ou `?t=`). Sans jeton valide, la
 * réponse est 404 — jamais 403 — pour ne pas révéler l'existence d'une
 * référence.
 *
 * ⚠️ Le jeton est le SEUL secret qui donne accès aux codes : cette route ne
 * doit jamais répondre sur la seule référence.
 *
 * Les codes ne sont renvoyés qu'une fois la commande livrée ; ils sont
 * déchiffrés à la volée et jamais mis en cache (`no-store`).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  context: { params: Promise<{ ref: string }> },
) {
  const { ref } = await context.params;
  const token = trackingTokenFromRequest(req);

  try {
    const order = await getPublicDigitalOrder(
      decodeURIComponent(ref ?? ""),
      token,
    );
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
      "[fazercards][suivi] échec :",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { ok: false, error: "server_error" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
