import { NextResponse } from "next/server";
import { syncG2gStockAndPrice } from "@/lib/g2g-stock-price";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** La synchro enchaîne un appel par offre activée : borné par maxDuration. */
export const maxDuration = 60;

/**
 * Synchronisation stock & prix des offres G2G (cron Vercel, une fois par jour).
 *
 * Pourquoi une route dédiée : cette synchro enchaîne un appel G2G + un
 * appel FazerCards par offre activée. Dans le rendu d'une page, cela
 * dépasserait le temps d'exécution d'une fonction serverless.
 *
 * Déclenchée par `vercel.json` (quotidien) et protégée par `CRON_SECRET`.
 *
 * Garanties :
 *  - Aucun achat n'est déclenché ici : seule la quantité `api_qty` est
 *    ajustée sur l'offre G2G.
 *  - Une offre dont le stock est nul ou la marge insuffisante est coupée
 *    (`api_qty = 0`) : plus de commande automatique tant que le problème
 *    persiste.
 *  - Une panne sur une offre ne bloque pas les autres : chaque offre est
 *    traitée indépendamment.
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

  const { processed, updated, skipped, results } = await syncG2gStockAndPrice();

  return NextResponse.json({
    ok: true,
    processed,
    updated,
    skipped,
    results: results.map((r) => ({
      offerId: r.offerId,
      kind: r.kind,
      ...(r.apiQty !== undefined ? { apiQty: r.apiQty } : {}),
      reason: r.reason.slice(0, 300),
    })),
  });
}
