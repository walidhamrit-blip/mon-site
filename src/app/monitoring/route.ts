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

import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedDsns = [process.env.SENTRY_DSN, process.env.NEXT_PUBLIC_SENTRY_DSN].filter(
  (dsn): dsn is string => typeof dsn === "string" && dsn.length > 0,
);

const tunnel = createSentryTunnelRoute({ allowedDsns });

/** Un navigateur normal envoie quelques enveloppes par session, pas 60. */
const TUNNEL_LIMIT = {
  windowMs: 5 * 60_000,
  max: 60,
  minIntervalMs: 500,
  prefix: "sentry-tunnel",
} as const;

const MAX_ENVELOPE_BYTES = 1_000_000;

export async function POST(request: Request): Promise<Response> {
  if (!process.env.SENTRY_DSN) {
    return new Response("Not found", { status: 404 });
  }

  const contentType = request.headers.get("content-type")?.split(";")[0]?.trim();
  if (contentType !== "application/x-sentry-envelope") {
    return new Response("Unsupported media type", { status: 415 });
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_ENVELOPE_BYTES) {
    return new Response("Payload too large", { status: 413 });
  }

  const decision = checkRateLimit(TUNNEL_LIMIT, request);
  if (!decision.allow) {
    return new Response("Too many requests", {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, decision.retryAfterSec)) },
    });
  }

  return tunnel.POST(request);
}
