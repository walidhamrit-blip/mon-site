/**
 * Sentry — runtime Edge.
 *
 * Les routes `/api/*` et le middleware peuvent s'exécuter sur Edge. La
 * configuration est volontairement identique au serveur : même DSN, même
 * échantillonnage, mêmes filtres de confidentialité.
 */
import * as Sentry from "@sentry/nextjs";

import { scrubSentryEvent } from "@/lib/sentry-scrub";

const dsn = process.env.SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  // Sentry 11 collecte par défaut en-têtes, cookies, query string et corps de
  // requête. On coupe tout : ces données peuvent contenir un jeton de session,
  // une référence de paiement ou des coordonnées client.
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
    graphQL: { document: false, variables: false },
    genAI: { inputs: false, outputs: false },
  },
  tracesSampleRate: 0.1,
  // Requis pour que `beforeSendTransaction` filtre réellement les URLs.
  traceLifecycle: "static",
  beforeSend: (event) => scrubSentryEvent(event),
  beforeSendTransaction: (event) => scrubSentryEvent(event),
});
