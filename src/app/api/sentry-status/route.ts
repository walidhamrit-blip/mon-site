/**
 * Diagnostic temporaire Sentry — PREVIEW UNIQUEMENT.
 *
 * Ne renvoie aucun secret : uniquement des booléens, l'environnement, le
 * commit et l'identifiant de l'événement de test. Sert à distinguer :
 *   - une variable `SENTRY_DSN` absente du déploiement ;
 *   - un SDK non initialisé ;
 *   - un envoi réussi mais invisible dans le mauvais projet/environnement.
 *
 * À supprimer une fois la vérification faite.
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  if (process.env.VERCEL_ENV === "production") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const dsnConfigured = Boolean(process.env.SENTRY_DSN);
  const publicDsnConfigured = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);
  const base = {
    dsnConfigured,
    publicDsnConfigured,
    environment: process.env.VERCEL_ENV ?? null,
    release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
  };

  if (!dsnConfigured) {
    return NextResponse.json({
      ...base,
      clientInitialized: false,
      eventId: null,
      flushed: false,
      hint: "SENTRY_DSN absente de ce déploiement : ajoutez-la pour Preview puis redeployez.",
    });
  }

  const Sentry = await import("@sentry/nextjs");
  const client = Sentry.getClient();

  if (!client) {
    return NextResponse.json({
      ...base,
      clientInitialized: false,
      eventId: null,
      flushed: false,
      hint: "DSN présente mais SDK non initialisé : vérifiez les logs du déploiement.",
    });
  }

  const eventId = Sentry.captureException(
    new Error("Vérification Sentry — diagnostic serveur (preview), à ignorer"),
  );
  const flushed = await Sentry.flush(5000);

  return NextResponse.json({
    ...base,
    clientInitialized: true,
    eventId: eventId ?? null,
    flushed,
  });
}
