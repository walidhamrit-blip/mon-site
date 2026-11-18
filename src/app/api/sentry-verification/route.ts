/**
 * Vérification temporaire de l'intégration Sentry — PREVIEW UNIQUEMENT.
 *
 * Cette route lève volontairement une erreur pour vérifier que le hook
 * `onRequestError` la transmet bien à Sentry (pile, route, commit).
 * En production, elle répond 404 : aucun bruit possible si elle est oubliée.
 *
 * À supprimer une fois la vérification faite.
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  if (process.env.VERCEL_ENV === "production") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  throw new Error(
    "Vérification Sentry — erreur serveur volontaire (preview), à ignorer",
  );
}
