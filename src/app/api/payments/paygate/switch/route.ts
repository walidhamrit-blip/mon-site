import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders, paygatePayments } from "@/db/schema";
import { siteBaseUrl } from "@/lib/site-url";
import { localizedPath } from "@/lib/locale";
import { checkRateLimit } from "@/lib/rate-limit";
import { trackingAccess } from "@/lib/order-tracking";
import { createPayGateCardSession, PayGateError } from "@/lib/paygate";

/**
 * Bascule d'une commande EN ATTENTE vers le paiement par carte.
 *
 * Cas d'usage principal : le bot Telegram a créé une commande avec une
 * facture crypto (NOWPayments) ; le client préfère finalement payer par
 * Visa/Mastercard. Le bouton du bot ouvre cette route avec `ref` + jeton de
 * suivi : la commande existante est reprise — le client ne recommence PAS
 * la caisse à zéro.
 *
 * Sécurité : le jeton de suivi (`?t=`) est vérifié contre son empreinte
 * (`orders.tracking_token_hash`) — seul celui qui a créé la commande (ou
 * ouvert la page de suivi) peut basculer le moyen de paiement. La route est
 * un GET qui répond toujours par une redirection (302) :
 *   - session carte en attente existante → réutilisée (aucune nouvelle
 *     adresse wallet mintée) ;
 *   - sinon `createPayGateCardSession` crée la session et la commande passe
 *     à `paymentMethod = "paygate"` (callback + suivi cohérents) ;
 *   - commande déjà payée / inconnue / passerelle désactivée → retour à la
 *     page de suivi, qui reste la source de vérité.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SWITCH_LIMIT = {
  windowMs: 5 * 60 * 1000,
  max: 12,
  minIntervalMs: 800,
  prefix: "paygate-switch",
} as const;

function redirectBack(
  request: Request,
  ref: string,
  token: string,
  lang: string | null,
  suffix = "",
): NextResponse {
  const base = siteBaseUrl(request);
  const query = `ref=${encodeURIComponent(ref)}&t=${encodeURIComponent(token)}`;
  const back = `${base}${localizedPath(`/codes/commande?${query}`, lang === "en" ? "en" : "ar")}`;
  return NextResponse.redirect(`${back}${suffix}`, {
    status: 302,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

export async function GET(req: Request) {
  const decision = checkRateLimit(SWITCH_LIMIT, req);
  if (!decision.allow) {
    return new NextResponse("Too many requests. Please wait a few seconds.", {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, decision.retryAfterSec)),
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }

  const url = new URL(req.url);
  const ref = (url.searchParams.get("ref") ?? "").trim().toUpperCase();
  const token = (url.searchParams.get("t") ?? "").trim();
  const lang = url.searchParams.get("lang") === "en" ? "en" : null;

  if (!ref || !token) {
    return new NextResponse("Invalid payment switch link.", {
      status: 400,
      headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
    });
  }

  let order: typeof orders.$inferSelect | undefined;
  try {
    [order] = await db.select().from(orders).where(eq(orders.ref, ref)).limit(1);
  } catch {
    // Base indisponible : la page de suivi saura afficher l'état réel.
    return redirectBack(req, ref, token, lang);
  }

  if (!order) {
    return new NextResponse("Payment session not found.", {
      status: 404,
      headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
    });
  }

  // Jeton de suivi : exact (granted) ou commande sans empreinte (legacy,
  // même tolérance que la page de suivi). Empreinte présente + jeton faux → refusé.
  const access = trackingAccess(order.trackingTokenHash, token);
  if (access === "denied") {
    return new NextResponse("Payment session not found.", {
      status: 404,
      headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
    });
  }

  if (order.status !== "pending") {
    // Déjà payée (bouton cliqué deux fois) ou annulée : le suivi raconte tout.
    return redirectBack(req, ref, token, lang, order.status === "paid" ? "&paid=1" : "");
  }

  if (!order.email?.trim()) {
    // La caisse carte exige un e-mail client ; sans lui, impossible ici.
    return redirectBack(req, ref, token, lang, "&payerr=missing_email");
  }

  // Session carte en attente déjà créée (double clic, re-ouverture) → réutiliser
  // son URL telle quelle : aucune nouvelle adresse wallet, aucun montant modifié.
  const [existing] = await db
    .select({ checkoutUrl: paygatePayments.checkoutUrl })
    .from(paygatePayments)
    .where(and(eq(paygatePayments.orderRef, ref), eq(paygatePayments.status, "pending")))
    .limit(1);

  let checkoutUrl = existing?.checkoutUrl ?? null;

  if (!checkoutUrl) {
    try {
      const session = await createPayGateCardSession({
        orderRef: ref,
        baseAmountUsd: Number(order.amountUsd),
        customerEmail: order.email,
        baseOrigin: siteBaseUrl(req),
        locale: lang,
      });
      checkoutUrl = session.checkoutUrl;
    } catch (error) {
      const code = error instanceof PayGateError ? error.code : "unknown";
      console.warn("[paygate][switch] bascule impossible :", code);
      // Passerelle désactivée / injoignable : retour au suivi, la facture
      // crypto y reste disponible (aucune voie morte pour le client).
      return redirectBack(req, ref, token, lang, "&payerr=card_unavailable");
    }
  }

  // Cohérence des routes aval : /pay/card/[ref] et le processeur exigent
  // `paymentMethod = "paygate"` ; le suivi affiche alors le bloc carte.
  if (order.paymentMethod !== "paygate") {
    await db
      .update(orders)
      .set({ paymentMethod: "paygate", updatedAt: new Date() })
      .where(eq(orders.ref, ref))
      .catch(() => undefined);
  }

  return new NextResponse(null, {
    status: 302,
    headers: {
      Location: checkoutUrl,
      "Cache-Control": "no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
