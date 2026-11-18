/**
 * Sentry — runtime Node.js (serveur).
 *
 * Sans `SENTRY_DSN`, `enabled: false` : le SDK ne s'initialise pas, n'ouvre
 * aucune connexion et n'ajoute aucun poids au chemin critique. Le build et le
 * site restent strictement identiques à l'état sans Sentry.
 *
 * `tracesSampleRate: 0.1` : 10 % des transactions suffisent pour voir les
 * régressions de latence sans consommer le quota. Aucune session replay.
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
  // Les erreurs attendues (redirection Next, contrôle de flux React) ne sont
  // pas des pannes : le SDK les filtre déjà, on garde ce garde-fou explicite.
  beforeSend: (event) => scrubSentryEvent(event),
  beforeSendTransaction: (event) => scrubSentryEvent(event),
});
