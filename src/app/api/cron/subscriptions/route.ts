import { NextResponse } from "next/server";
import { getSiteData } from "@/lib/store";
import { sendEmail } from "@/lib/mailer";
import { siteBaseUrl } from "@/lib/site-url";
import { runSubscriptionNotices } from "@/lib/subscriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Relances d'abonnement (avant échéance, en retard, suspendu).
 * Planifiée par Vercel Cron (vercel.json). Vercel envoie
 * `Authorization: Bearer $CRON_SECRET` : sans secret configuré, la route
 * refuse de tourner, et une requête sans le bon secret est rejetée.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ ok: false, error: "cron_not_configured" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const { config } = await getSiteData();
    const report = await runSubscriptionNotices(
      new Date(),
      async (message) => {
        const result = await sendEmail(message);
        return { ok: result.ok, error: result.error };
      },
      siteBaseUrl(req),
      config.name,
    );
    return NextResponse.json({ ok: true, ...report });
  } catch (error) {
    console.error("[cron][abonnements] échec :", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "cron_failed" }, { status: 500 });
  }
}
