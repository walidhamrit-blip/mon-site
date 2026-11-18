import { NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { g2gDeliveries } from "@/db/schema";
import { isAdminAuthenticated } from "@/lib/auth";
import { g2gDeliveryStats } from "@/lib/g2g-delivery";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function rowToPublic(row: {
  id: number;
  createdAt: Date;
  updatedAt: Date;
  deliveryId: string;
  orderId: string;
  offerId: string;
  requestedQty: number;
  decision: string;
  status: string;
  unitPriceUsd: string | null;
  supplierCostUsd: string | null;
  netMarginPercent: string | null;
  supplierOrderRef: string | null;
  attempts: number;
  nextAttemptAt: Date | null;
  deliveryAttempts: number;
  deliveryClaimedAt: Date | null;
  detail: string | null;
}) {
  return {
    id: row.id,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
    deliveryId: row.deliveryId,
    orderId: row.orderId,
    offerId: row.offerId,
    requestedQty: row.requestedQty,
    decision: row.decision,
    status: row.status,
    unitPriceUsd: row.unitPriceUsd,
    supplierCostUsd: row.supplierCostUsd,
    netMarginPercent: row.netMarginPercent,
    supplierOrderRef: row.supplierOrderRef,
    attempts: row.attempts,
    nextAttemptAt: row.nextAttemptAt?.toISOString() ?? null,
    deliveryAttempts: row.deliveryAttempts,
    deliveryClaimedAt: row.deliveryClaimedAt?.toISOString() ?? null,
    detail: row.detail,
  };
}

/**
 * Liste des livraisons G2G (admin uniquement).
 *
 * Retourne les livraisons avec leurs statuts, triées par date de création
 * décroissante. Permet de filtrer par `status` via le query param.
 *
 * Aucun code produit ni secret n'est retourné : seuls les montants, les
 * statuts et les références de commande sont exposés.
 */
export async function GET(req: Request) {
  if (!(await isAdminAuthenticated())) {
    return noStoreJson({ ok: false, error: "unauthorized" }, 401);
  }

  const url = new URL(req.url);
  const statusFilter = url.searchParams.get("status")?.trim();
  const limitRaw = url.searchParams.get("limit")?.trim();
  const limit = limitRaw ? Math.min(100, Math.max(1, Number(limitRaw) || 50)) : 50;

  try {
    await ensureSchema();

    const where =
      statusFilter && statusFilter !== "all"
        ? eq(g2gDeliveries.status, statusFilter)
        : undefined;

    const rows = await db
      .select()
      .from(g2gDeliveries)
      .where(where ?? sql`true`)
      .orderBy(desc(g2gDeliveries.createdAt))
      .limit(limit);

    const stats = await g2gDeliveryStats();

    return noStoreJson({
      ok: true,
      stats,
      deliveries: rows.map(rowToPublic),
      count: rows.length,
    });
  } catch (error) {
    console.error("[admin][g2g] liste des livraisons impossible :", error instanceof Error ? error.message : error);
    return noStoreJson(
      { ok: false, error: "db_error", message: "Base de données indisponible." },
      502,
    );
  }
}
