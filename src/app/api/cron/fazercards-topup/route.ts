import { NextResponse } from "next/server";
import { runFazercardsAutotopup } from "@/lib/fazercards-autotopup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Facture fournisseur + devis de frais + virement : deux appels réseau lents. */
export const maxDuration = 60;

/**
 * Recharge automatique du solde fournisseur (cron Vercel).
 *
 * Deux garde-fous cumulés :
 *   • sans `?execute=1`, ce passage est une SIMULATION (aucune facture, aucun
 *     virement) — c'est le défaut, y compris pour le cron planifié ;
 *   • même avec `?execute=1`, rien ne part si `FAZERCARDS_AUTOTOPUP_ENABLED`
 *     n'est pas à `true` (voir `runFazercardsAutotopup`).
 *
 * Le cron planifié (`vercel.json`) appelle donc la simulation : l'activation
 * réelle est une décision explicite (variable d'environnement + URL dédiée).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ ok: false, error: "cron_not_configured" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const execute = new URL(req.url).searchParams.get("execute") === "1";

  try {
    const report = await runFazercardsAutotopup({ execute });
    if (report.action !== "wait" || report.error) {
      console.info("[fazercards][recharge]", JSON.stringify(report));
    }
    return NextResponse.json({ ...report, executeRequested: execute });
  } catch (error) {
    console.error(
      "[fazercards][recharge] échec :",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json({ ok: false, error: "autotopup_failed" }, { status: 500 });
  }
}
