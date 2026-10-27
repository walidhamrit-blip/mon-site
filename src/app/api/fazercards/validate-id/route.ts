import { NextResponse } from "next/server";
import { z } from "zod";
import { getFazercardsCatalog } from "@/lib/fazercards-catalog";
import { checkFazercardsPlayerId } from "@/lib/fazercards-player-id";
import { checkRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/csrf";

/**
 * Vérifie un identifiant joueur AVANT le paiement.
 *
 * Le tunnel d'achat appelle cette route pendant la saisie : si le fournisseur
 * sait vérifier le jeu, on affiche le **pseudo du joueur** (« Compte : Jean »)
 * pour que le client confirme visuellement qu'il crédite bien SON compte. Un
 * identifiant d'un autre jeu est ainsi repéré avant la facture.
 *
 * Une recharge de jeu livrée est irréversible : c'est la seule protection
 * possible côté client.
 *
 * La route est publique (aucune donnée sensible : ni solde, ni code), mais
 * limitée en débit pour ne pas servir de relais vers le fournisseur.
 */

export const runtime = "nodejs";
export const maxDuration = 15;

const schema = z.object({
  productSlug: z.string().min(1).max(120),
  fields: z.record(z.string(), z.union([z.string(), z.number()])),
});

const LIMIT = {
  windowMs: 5 * 60 * 1000,
  max: 40,
  minIntervalMs: 400,
  prefix: "fazercards-validate-id",
} as const;

export async function POST(request: Request) {
  if (!enforceSameOrigin(request)) {
    return NextResponse.json(
      { ok: false, error: "csrf", message: "Origine non autorisée." },
      { status: 403 },
    );
  }

  const decision = checkRateLimit(LIMIT, request);
  if (!decision.allow) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", retryAfterSec: decision.retryAfterSec },
      {
        status: 429,
        headers: { "Retry-After": String(Math.max(1, decision.retryAfterSec)) },
      },
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Requête invalide." }, { status: 400 });
  }

  try {
    // Catalogue brut : c'est lui qui porte le `category_id` FazerCards.
    const { products } = await getFazercardsCatalog({ noSync: true });
    const product = products.find((item) => item.slug === parsed.data.productSlug);
    if (!product) {
      return NextResponse.json({ ok: false, error: "Produit introuvable." }, { status: 404 });
    }

    const fields = Object.fromEntries(
      Object.entries(parsed.data.fields).map(([key, value]) => [key, String(value).trim()]),
    );

    const check = await checkFazercardsPlayerId({
      categoryId: product.categoryId,
      fields,
    });

    return NextResponse.json({
      ok: true,
      // `checked: false` = le fournisseur ne sait pas vérifier ce jeu :
      // le tunnel n'affiche alors pas de confirmation, et ne bloque rien.
      checked: check.checked,
      valid: check.valid,
      ...(check.playerName ? { playerName: check.playerName } : {}),
      ...(check.region ? { region: check.region } : {}),
      ...(check.reason ? { reason: check.reason } : {}),
    });
  } catch (error) {
    console.warn(
      "[fazercards][validate-id] échec :",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { ok: true, checked: false, valid: false, reason: "vérification impossible" },
      { status: 200 },
    );
  }
}
