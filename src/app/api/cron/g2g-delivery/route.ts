import { NextResponse } from "next/server";
import { processG2gDeliveryQueue } from "@/lib/g2g-delivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** La file traite quelques livraisons par exécution : largement sous la limite. */
export const maxDuration = 30;

/**
 * File de livraison G2G (cron Vercel, toutes les minutes — plan Pro).
 *
 * Après l'achat JIT (brique 1), une ligne `g2g_deliveries` se trouve en
 * statut `purchased`. Ce cron :
 *
 *   1. Réclame les livraisons dues (nextAttemptAt échu, attempts < max) ;
 *   2. Sonde FazerCards pour récupérer les codes ;
 *   3. Livre chaque code à G2G via POST /v2/orders/{id}/delivery ;
 *   4. Reprogramme avec backoff, ou escalade (Telegram) après épuisement.
 *
 * Protégé par `CRON_SECRET` (obligatoire : Vercel envoie l'en-tête
 * `Authorization: Bearer <secret>` sur chaque exécution cron).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "cron_not_configured" },
      { status: 503 },
    );
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { claimed, results } = await processG2gDeliveryQueue(20);

  const summary = results.reduce(
    (acc, r) => {
      acc[r.kind] = (acc[r.kind] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return NextResponse.json({
    ok: true,
    claimed,
    results: summary,
    detail: results.map((r) => ({
      deliveryId: r.deliveryId,
      kind: r.kind,
      attempts: r.attempts,
      ...(r.reason ? { reason: r.reason.slice(0, 200) } : {}),
    })),
  });
}
