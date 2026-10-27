import { NextResponse } from "next/server";
import { resumeStaleDigitalOrders } from "@/lib/digital-resume";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Un balayage enchaîne plusieurs livraisons fournisseur. */
export const maxDuration = 60;

/**
 * Reprise automatique des commandes de codes bloquées (cron Vercel).
 *
 * Filet de sécurité : l'IPN NOWPayments livre en général la commande dans
 * les secondes, et la page de suivi du client relance la livraison si le
 * webhook s'est perdu. Cette route couvre le dernier cas — commande payée,
 * client parti, fournisseur muet (`processing`) ou webhook jamais reçu.
 *
 * Protégée par `CRON_SECRET` : sans secret configuré, la route refuse de
 * tourner (aucune livraison déclenchable par un tiers). `?dry=1` produit le
 * diagnostic sans rien acheter.
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

  const dryRun = new URL(req.url).searchParams.get("dry") === "1";

  try {
    const report = await resumeStaleDigitalOrders({ dryRun });
    if (report.attempted > 0 || report.manual > 0 || report.errors > 0) {
      console.info("[digital][reprise]", JSON.stringify(report));
    }
    return NextResponse.json({
      ok: true,
      dryRun,
      ...report,
      // Le détail reste borné : un rapport de plusieurs mégaoctets ne sert à rien.
      results: report.results.slice(0, 30),
    });
  } catch (error) {
    console.error(
      "[digital][reprise] échec :",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json({ ok: false, error: "resume_failed" }, { status: 500 });
  }
}
