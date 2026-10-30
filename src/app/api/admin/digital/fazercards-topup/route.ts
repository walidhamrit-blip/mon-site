import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminAuthenticated } from "@/lib/auth";
import {
  getFazercardsAutotopupStatus,
  runFazercardsAutotopup,
  verifyFazercardsAutotopupPayout,
} from "@/lib/fazercards-autotopup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Recharge du solde fournisseur — réservé à l'administration.
 *
 * `GET`  : état complet (configuration, prérequis, facture en attente,
 *          historique) — aucune donnée de solde, déjà affichée ailleurs.
 * `POST` : `simulate` (défaut), `execute` (argent réel, double verrou
 *          `FAZERCARDS_AUTOTOPUP_ENABLED`) ou `verify` (code 2FA du virement
 *          en attente, quand la 2FA arrive par e-mail).
 */

const schema = z.object({
  action: z.enum(["simulate", "execute", "verify"]).default("simulate"),
  code: z.string().max(12).optional(),
});

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, status: await getFazercardsAutotopupStatus() });
}

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

  if (parsed.data.action === "verify") {
    const result = await verifyFazercardsAutotopupPayout(parsed.data.code ?? "");
    return NextResponse.json(
      { ...result, status: await getFazercardsAutotopupStatus() },
      { status: result.ok ? 200 : 400 },
    );
  }

  const report = await runFazercardsAutotopup({ execute: parsed.data.action === "execute" });
  return NextResponse.json({
    ok: report.ok,
    report,
    status: await getFazercardsAutotopupStatus(),
  });
}
