import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { getPhoneCardLydQuote } from "@/lib/phone-card-rate";
import { readPhoneCardAvailability } from "@/lib/phone-card-availability";
import { PHONE_CARD_DISABLED_ERROR } from "@/lib/phone-card-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QUOTE_LIMIT = {
  windowMs: 10 * 60 * 1000,
  max: 120,
  prefix: "phone-card-quote",
} as const;

/** Devis indicatif LYD ; le checkout refait intégralement ce calcul côté serveur. */
export async function GET(req: Request) {
  const decision = checkRateLimit(QUOTE_LIMIT, req);
  if (!decision.allow) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", retryAfterSec: decision.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(decision.retryAfterSec) } },
    );
  }

  const availability = await readPhoneCardAvailability();
  if (availability !== "enabled") {
    return NextResponse.json(
      {
        ok: false,
        error: availability === "disabled" ? PHONE_CARD_DISABLED_ERROR : "phone_card_availability_unavailable",
        message: availability === "disabled"
          ? "Le paiement manuel par carte / solde téléphonique est temporairement désactivé. Le paiement crypto reste disponible."
          : "Disponibilité du paiement manuel invérifiable. Réessayez plus tard ou choisissez la crypto.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const amount = Number(new URL(req.url).searchParams.get("amount"));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
    return NextResponse.json(
      { ok: false, error: "invalid_amount", message: "Montant USDT invalide." },
      { status: 400 },
    );
  }

  const quote = await getPhoneCardLydQuote(amount);
  if (!quote) {
    return NextResponse.json(
      {
        ok: false,
        error: "rate_unavailable",
        message: "Le taux du marché parallèle n’est pas configuré ou est momentanément indisponible.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(
    { ok: true, quote },
    { headers: { "Cache-Control": "no-store" } },
  );
}
