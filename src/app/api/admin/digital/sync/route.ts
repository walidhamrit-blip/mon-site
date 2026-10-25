import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminAuthenticated } from "@/lib/auth";
import { analyseDigitalSync } from "@/lib/digital-sync";
import { isReloadlyError, reloadlyErrorMessage, reloadlyMode } from "@/lib/reloadly";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Analyse du catalogue Reloadly — réservé à l'admin.
 *
 * Compare les produits du fournisseur (marques/pays demandés) aux fiches
 * locales et renvoie une PROPOSITION : produits à relier, montants manquants,
 * montants à désactiver et prix calculés depuis la marge nette.
 *
 * Aucune écriture, aucun achat : lecture seule chez le fournisseur.
 */
const schema = z.object({
  marginPercent: z.coerce.number().min(0).max(50),
  paymentFeePercent: z.coerce.number().min(0).max(20).default(1),
  brands: z.array(z.string().max(60)).max(20).default([]),
  countries: z.array(z.string().max(10)).max(20).default([]),
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

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_input",
        message: parsed.error.issues.map((issue) => issue.message).join(", "),
      },
      { status: 400 },
    );
  }

  try {
    const analysis = await analyseDigitalSync(parsed.data);
    return NextResponse.json({
      ok: true,
      mode: reloadlyMode(),
      scanned: analysis.scanned,
      skipped: analysis.skipped,
      errors: analysis.errors,
      proposals: analysis.proposals,
    });
  } catch (error) {
    console.error(
      "[admin][digital][sync] analyse impossible :",
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
