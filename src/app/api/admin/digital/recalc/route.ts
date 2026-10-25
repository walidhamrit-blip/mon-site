import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminAuthenticated } from "@/lib/auth";
import { analyseCatalogRecalc } from "@/lib/digital-audit";
import { isReloadlyError, reloadlyErrorMessage } from "@/lib/reloadly";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Audit + recalcul global du catalogue — réservé à l'admin.
 *
 * Lecture seule chez Reloadly (une requête par produit, mutualisée) : on
 * renvoie, montant par montant, l'ancien prix, le prix recalculé (marge de la
 * fiche + arrondi au pas de 0,50), le coût réel et les anomalies constatées.
 * Aucune écriture : l'application passe par `applyCatalogRecalcAction`.
 */
const schema = z.object({
  paymentFeePercent: z.coerce.number().min(0).max(20).default(1),
});

export async function POST(req: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_input", message: "Frais de paiement invalides." },
      { status: 400 },
    );
  }

  try {
    const analysis = await analyseCatalogRecalc(parsed.data.paymentFeePercent);
    return NextResponse.json({ ok: true, ...analysis });
  } catch (error) {
    console.error(
      "[admin][digital][recalc] analyse impossible :",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      {
        ok: false,
        error: "analyse_failed",
        message: reloadlyErrorMessage(error),
        status: isReloadlyError(error) ? error.status : null,
      },
      { status: 502 },
    );
  }
}
