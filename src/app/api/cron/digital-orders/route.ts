import { NextResponse } from "next/server";
import { resumeStaleDigitalOrders } from "@/lib/digital-resume";
import { deliveryQueueStats, runDeliveryQueue } from "@/lib/delivery-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Un balayage enchaîne plusieurs livraisons fournisseur. */
export const maxDuration = 60;

/**
 * Travailleur de la file de livraison + reprise des commandes bloquées
 * (cron Vercel).
 *
 * Deux étages, dans cet ordre :
 *
 *  1. **File de livraison** (`delivery_jobs`) : jobs dont l'heure de retry
 *     est passée — échec transitoire fournisseur, bail expiré d'un worker
 *     tué par la limite serverless, ou `awaiting_codes` à relire. Chaque
 *     job porte sa propre politique de backoff (60 s → 30 min) et son
 *     compteur de tentatives ; l'épuisement déclenche la revue manuelle et
 *     l'alerte Telegram.
 *  2. **Reprise historique** (`resumeStaleDigitalOrders`) : filet de
 *     sécurité pour les commandes payées dont le webhook s'est perdu
 *     avant même la création du job (grâce 15 min, 6 tentatives, 14 jours).
 *
 * ⚠️ Plan Vercel Hobby : un cron ne peut pas être plus fréquent que
 * quotidien. Sur Hobby, ce passage quotidien reste un filet ; la latence
 * réelle des retries est portée par l'IPN (`after()`), le suivi client
 * (sondage 15 s) et `/api/digital/orders/[ref]`. Sur Pro, planifier une
 * exécution toutes les 5 minutes pour des retries en minutes
 * (voir docs/webhooks-resilience.md).
 *
 * Protégée par `CRON_SECRET` : sans secret configuré, la route refuse de
 * tourner. `?dry=1` produit le diagnostic sans rien acheter.
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

  const params = new URL(req.url).searchParams;
  const dryRun = params.get("dry") === "1";
  // `?queue=0` : ne lancer que la reprise historique (diagnostic ciblé).
  const withQueue = params.get("queue") !== "0";

  try {
    let stats: Awaited<ReturnType<typeof deliveryQueueStats>> | null = null;
    let queue: Awaited<ReturnType<typeof runDeliveryQueue>> | null = null;

    if (withQueue) {
      stats = await deliveryQueueStats();
      queue = await runDeliveryQueue({ limit: 5, dryRun });
      if (queue.claimed > 0) {
        console.info("[delivery][file]", JSON.stringify(queue.results));
      }
    }

    const report = await resumeStaleDigitalOrders({ dryRun });
    if (report.attempted > 0 || report.manual > 0 || report.errors > 0) {
      console.info("[digital][reprise]", JSON.stringify(report));
    }

    return NextResponse.json({
      ok: true,
      dryRun,
      ...report,
      queue,
      stats,
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
