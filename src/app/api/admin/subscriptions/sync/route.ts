import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { enforceSameOrigin } from "@/lib/csrf";
import { syncSubscriptionPlans } from "@/lib/subscriptions";

export const dynamic = "force-dynamic";

/**
 * Crée / met à jour les plans d'abonnement chez NOWPayments.
 * Réservé à l'administration et protégé contre les requêtes cross-site.
 */
export async function POST(req: Request) {
  if (!enforceSameOrigin(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const report = await syncSubscriptionPlans(req);
    return NextResponse.json({ ok: report.failed.length === 0, ...report });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: "sync_failed", detail: message.slice(0, 300) },
      { status: 500 },
    );
  }
}
