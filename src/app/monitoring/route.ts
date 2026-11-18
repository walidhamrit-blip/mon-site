/**
 * Tunnel Sentry — `POST /monitoring`.
 *
 * Le navigateur envoie ses événements ici, sur notre propre domaine, au lieu
 * d'appeler directement `*.ingest.sentry.io` : les bloqueurs de publicité ne
 * peuvent pas le distinguer d'une requête applicative.
 *
 * La route n'est pas un proxy ouvert : `createSentryTunnelRoute` n'accepte
 * que les DSN explicitement autorisés (les nôtres) et ne transmet pas les
 * en-têtes de la requête entrante.
 *
 * Sans `SENTRY_DSN`, la route répond 404 : tant que Sentry n'est pas
 * configuré, rien n'indique qu'un tunnel existe.
 */
import { createSentryTunnelRoute } from "@sentry/nextjs/tunnel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedDsns = [process.env.SENTRY_DSN, process.env.NEXT_PUBLIC_SENTRY_DSN].filter(
  (dsn): dsn is string => typeof dsn === "string" && dsn.length > 0,
);

const tunnel = createSentryTunnelRoute({ allowedDsns });

export async function POST(request: Request): Promise<Response> {
  if (!process.env.SENTRY_DSN) {
    return new Response("Not found", { status: 404 });
  }
  return tunnel.POST(request);
}
