import { NextResponse } from "next/server";
import { z } from "zod";
import {
  creditRequestNotice,
  getClientCreditView,
  requestCreditUse,
} from "@/lib/client-credit-requests";
import { trackingTokenFromRequest } from "@/lib/order-tracking";
import { getSiteData } from "@/lib/store";
import { sendCreditUseRequestNotice } from "@/lib/digital-emails";
import { checkRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/csrf";

/**
 * Solde d'un client, vu depuis SON suivi de commande.
 *
 * `GET`  → solde disponible + état de la demande pour cette commande.
 * `POST` → enregistre une demande d'utilisation (**aucun débit** : l'admin
 *          valide ensuite).
 *
 * Sans jeton de suivi valide : 404, jamais 403 — on ne révèle pas l'existence
 * d'une référence. Le navigateur n'envoie qu'un jeton et une référence : le
 * montant et l'identité du client viennent exclusivement de la base.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REQUEST_LIMIT = {
  windowMs: 10 * 60 * 1000,
  max: 6,
  minIntervalMs: 2000,
  prefix: "credit-request",
} as const;

const requestSchema = z.object({
  note: z.string().max(300).optional(),
});

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function GET(req: Request, context: { params: Promise<{ ref: string }> }) {
  const { ref } = await context.params;
  const token = trackingTokenFromRequest(req);
  try {
    const view = await getClientCreditView(decodeURIComponent(ref ?? ""), token);
    if (!view) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404, headers: NO_STORE });
    }
    return NextResponse.json({ ok: true, credit: view }, { headers: NO_STORE });
  } catch (error) {
    console.error(
      "[credit][suivi] échec :",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503, headers: NO_STORE });
  }
}

export async function POST(req: Request, context: { params: Promise<{ ref: string }> }) {
  if (!enforceSameOrigin(req)) {
    return NextResponse.json(
      { ok: false, error: "csrf", message: "Origine non autorisée." },
      { status: 403, headers: NO_STORE },
    );
  }

  const decision = checkRateLimit(REQUEST_LIMIT, req);
  if (!decision.allow) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", retryAfterSec: decision.retryAfterSec },
      {
        status: 429,
        headers: { ...NO_STORE, "Retry-After": String(Math.max(1, decision.retryAfterSec)) },
      },
    );
  }

  const { ref } = await context.params;
  const token = trackingTokenFromRequest(req);

  let note: string | undefined;
  try {
    const parsed = requestSchema.safeParse(await req.json());
    if (parsed.success) note = parsed.data.note;
  } catch {
    note = undefined;
  }

  try {
    const result = await requestCreditUse(decodeURIComponent(ref ?? ""), token, note);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: "refused", message: result.error },
        { status: 400, headers: NO_STORE },
      );
    }

    // Notification admin : sans elle, la demande attendrait dans un écran que
    // personne ne consulte. Un échec d'e-mail n'annule jamais la demande.
    try {
      const details = await creditRequestNotice(
        decodeURIComponent(ref ?? "").trim().toUpperCase(),
        result.requestId,
      );
      if (details) {
        const { config } = await getSiteData();
        const notice = await sendCreditUseRequestNotice({
          ...details,
          siteName: config.name,
          siteUrl: config.url,
          siteEmail: config.email,
        });
        if (!notice.ok) console.warn("[credit] notification admin non envoyée :", notice.error);
      }
    } catch (error) {
      console.warn(
        "[credit] notification admin impossible :",
        error instanceof Error ? error.message : error,
      );
    }

    return NextResponse.json(
      { ok: true, message: result.message, credit: result.view },
      { headers: NO_STORE },
    );
  } catch (error) {
    console.error("[credit][demande] échec :", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503, headers: NO_STORE });
  }
}
