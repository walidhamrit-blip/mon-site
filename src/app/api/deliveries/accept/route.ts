import { NextResponse } from "next/server";
import { z } from "zod";
import { acceptDelivery, findDeliveryByRef } from "@/lib/deliveries";
import { checkRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/csrf";
import { getSiteData } from "@/lib/store";
import { sendDeliveryAcceptedEmails } from "@/lib/delivery-notifications";

export const runtime = "nodejs";

const ACCEPT_LIMIT = {
  windowMs: 10 * 60 * 1000,
  max: 10,
  minIntervalMs: 1000,
  prefix: "delivery-accept",
} as const;

const acceptSchema = z.object({
  ref: z.string().min(4).max(64),
  token: z.string().min(16).max(200),
  name: z.string().trim().min(2).max(120),
});

const MESSAGES: Record<string, string> = {
  not_found: "Dossier introuvable. / Record not found.",
  forbidden: "Lien invalide. / Invalid link.",
  invalid_name: "Indiquez le nom de la personne qui valide. / Enter the name of the person accepting.",
  error: "Enregistrement impossible, réessayez. / Could not save, please retry.",
};

/**
 * Valide la recette d'une livraison : horodatage + e-mails (reçu client,
 * notification interne). Protégé par la référence ET le jeton, par
 * l'origine de la requête et par une limite de débit.
 */
export async function POST(req: Request) {
  if (!enforceSameOrigin(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const decision = checkRateLimit(ACCEPT_LIMIT, req);
  if (!decision.allow) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(decision.retryAfterSec ?? 60) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const parsed = acceptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_input",
        message: MESSAGES.invalid_name,
      },
      { status: 400 },
    );
  }

  try {
    const result = await acceptDelivery(parsed.data.ref, parsed.data.token, parsed.data.name);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.code, message: MESSAGES[result.code] ?? MESSAGES.error },
        { status: result.status },
      );
    }

    // Un reçu n'est envoyé qu'une fois : un lien re-cliqué ne doit pas
    // inonder la boîte du client (ni rejouer la notification interne).
    if (!result.alreadyAccepted) {
      // Requêtes séquentielles (et non en parallèle) : une seule connexion
      // doit suffire, y compris sur les petites instances Postgres.
      const { config } = await getSiteData();
      const row = await findDeliveryByRef(parsed.data.ref);
      if (row) {
        const outcome = await sendDeliveryAcceptedEmails(row, {
          name: config.name,
          nameAr: config.nameAr,
          url: config.url,
          email: config.email,
          phone: config.phone,
          whatsapp: config.whatsapp,
        });
        if (outcome.receipt && !outcome.receipt.ok) {
          console.error("[deliveries] reçu client non envoyé :", outcome.receipt.error);
        }
        if (!outcome.notification.ok) {
          console.error("[deliveries] notification interne non envoyée :", outcome.notification.error);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      alreadyAccepted: result.alreadyAccepted ?? false,
      acceptedAt: result.acceptedAt ?? null,
    });
  } catch (error) {
    console.error(
      "[deliveries] validation impossible :",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json({ ok: false, error: "server_error", message: MESSAGES.error }, { status: 500 });
  }
}
