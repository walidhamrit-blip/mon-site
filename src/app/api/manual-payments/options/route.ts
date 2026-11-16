import { NextResponse } from "next/server";
import { getSiteData } from "@/lib/store";
import { siteConfig } from "@/lib/config";
import { publicManualPaymentOptions } from "@/lib/manual-payment-public";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPTIONS_LIMIT = {
  windowMs: 10 * 60 * 1000,
  max: 240,
  prefix: "manual-payment-options",
} as const;

/**
 * Méthodes de paiement manuel réellement proposables (Skrill / Neteller /
 * Airtm / D17 / Volet / WebMoney / Kashy).
 *
 * L'interface client ne peut pas lire la configuration serveur : cette route
 * lui donne uniquement ce qu'il faut pour afficher le compte à créditer, la
 * devise, le taux et la majoration. Aucun compte désactivé ou vide n'est
 * exposé, et aucun autre champ de configuration n'est renvoyé.
 */
export async function GET(req: Request) {
  const decision = checkRateLimit(OPTIONS_LIMIT, req);
  if (!decision.allow) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", retryAfterSec: decision.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(decision.retryAfterSec) } },
    );
  }

  try {
    const { config } = await getSiteData();
    return NextResponse.json(
      { ok: true, options: publicManualPaymentOptions(config.manualPayments) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    // La configuration livrée par défaut est FERMÉE : l'échec de lecture ne
    // peut donc jamais exposer un moyen non configuré. Le tunnel de paiement
    // doit rester utilisable (le client garde la crypto), d'où le repli.
    console.error(
      "[manual-payment] configuration illisible, repli sur les valeurs par défaut :",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { ok: true, options: publicManualPaymentOptions(siteConfig.manualPayments) },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
