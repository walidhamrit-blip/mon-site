/**
 * Sentry — runtime navigateur (convention Next.js 16).
 *
 * Le SDK n'est chargé que si `NEXT_PUBLIC_SENTRY_DSN` est défini. Next remplace
 * cette variable à la compilation : sans DSN, la condition est fausse, le
 * `import()` dynamique reste dans un chunk jamais téléchargé et le site se
 * comporte exactement comme avant (aucun octet Sentry dans le bundle initial).
 *
 * Le tunnel `/monitoring` fait passer les événements par notre propre domaine
 * pour contourner les bloqueurs de publicité. La route correspondante
 * (`src/app/monitoring/route.ts`) n'accepte que nos DSN.
 */
import { scrubSentryEvent } from "@/lib/sentry-scrub";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  void import("@sentry/nextjs")
    .then((Sentry) => {
      Sentry.init({
        dsn,
        environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
        tracesSampleRate: 0.1,
  // Requis pour que `beforeSendTransaction` filtre réellement les URLs.
  traceLifecycle: "static",
        // Pas d'enregistrement de session : les formulaires contiennent des
        // coordonnées clients et des références de paiement.
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0,
        tunnel: "/monitoring",
        ignoreErrors: [
          "ResizeObserver loop limit exceeded",
          "ResizeObserver loop completed with undelivered notifications",
          "Non-Error promise rejection captured",
        ],
        // Sentry 11 collecte par défaut en-têtes, cookies, query string et
        // corps de requête. On coupe tout : ces données peuvent contenir un
        // jeton de session ou une référence de paiement.
        dataCollection: {
          userInfo: false,
          cookies: false,
          httpHeaders: false,
          httpBodies: [],
          urlQueryParams: false,
          graphQL: { document: false, variables: false },
          genAI: { inputs: false, outputs: false },
        },
        beforeSend: (event) => scrubSentryEvent(event),
        beforeSendTransaction: (event) => scrubSentryEvent(event),
      });
    })
    .catch(() => {
      // Un échec de chargement du SDK ne doit jamais casser la navigation.
    });
}

/**
 * Instrumente les transitions de route sans charger le SDK quand Sentry est
 * désactivé. La signature est celle attendue par Next.js.
 */
export function onRouterTransitionStart(
  href: string,
  navigationType: string,
): void {
  if (!dsn) return;
  void import("@sentry/nextjs").then((Sentry) =>
    Sentry.captureRouterTransitionStart(href, navigationType),
  );
}
