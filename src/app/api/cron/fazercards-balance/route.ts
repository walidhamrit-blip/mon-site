import { NextResponse } from "next/server";
import { checkFazercardsBalance } from "@/lib/fazercards-balance";
import { fazercardsConfigured } from "@/lib/fazercards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Un appel solde + un e-mail : largement sous la limite. */
export const maxDuration = 30;

/**
 * Garde-fou de solde du fournisseur (cron Vercel).
 *
 * Pourquoi : la caisse encaisse le client PUIS achète le code. Si le solde
 * du compte fournisseur ne couvre pas le plafond de vente configuré, une
 * vente peut être encaissée sans pouvoir être honorée (livraison manuelle,
 * remboursement). Ce passage compare solde et plafond et alerte l'équipe,
 * avec le montant de recharge conseillé.
 *
 * ⚠️ Ce passage s'exécute MÊME si `FAZERCARDS_API_KEY` est absente. Avant,
 * la route répondait 503 sans rien envoyer : l'incident le plus grave
 * (boutique digitale sans fournisseur, aucun achat possible) était le seul à
 * ne produire AUCUN e-mail. `checkFazercardsBalance` produit maintenant une
 * évaluation `unknown` (`key_missing`) qui déclenche l'alerte habituelle.
 *
 * Ne fait AUCUN achat, aucun virement : lecture seule + e-mail interne.
 * Protégé par `CRON_SECRET` (obligatoire ici — l'alerte contient des données
 * financières internes).
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

  const configured = fazercardsConfigured();
  const dryRun = new URL(req.url).searchParams.get("dry") === "1";

  try {
    const report = await checkFazercardsBalance({ dryRun, fresh: true });
    if (report.decision !== "silent") {
      console.info("[fazercards][solde]", JSON.stringify(report));
    }
    // `configured: false` reste visible dans la réponse : le diagnostic ne
    // doit pas laisser croire que le fournisseur est opérationnel.
    return NextResponse.json({ ok: true, dryRun, configured, ...report });
  } catch (error) {
    console.error(
      "[fazercards][solde] échec :",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json({ ok: false, error: "balance_check_failed" }, { status: 500 });
  }
}
