/**
 * Instrumentation serveur (convention Next.js 16).
 *
 * `register()` initialise Sentry sur le runtime courant. Sans DSN, le SDK
 * reste désactivé : rien n'est envoyé, rien n'est chargé sur le réseau.
 *
 * `onRequestError` est appelé pour toute erreur de rendu, de route ou de
 * Server Action. Il fait deux choses, dans cet ordre :
 *   1. journalise un JSON sur une seule ligne, facile à filtrer dans Vercel ;
 *   2. transmet l'erreur à Sentry (si un DSN est configuré), avec un filtre
 *      qui retire en-têtes, cookies, corps de requête et query string.
 *
 * On ne journalise JAMAIS les en-têtes, les cookies ni la query string : ils
 * peuvent contenir un jeton de session ou une référence de paiement.
 */
interface RequestInfo {
  path: string;
  method: string;
  headers: { [key: string]: string | string[] | undefined };
}

interface RequestErrorContext {
  routerKind: "Pages Router" | "App Router";
  routePath: string;
  routeType: "render" | "route" | "action" | "middleware";
}

/** Normalise n'importe quelle valeur levée en objet sérialisable. */
function describe(error: unknown): {
  name: string;
  message: string;
  digest?: string;
  stack?: string;
} {
  if (error instanceof Error) {
    const digest = (error as Error & { digest?: string }).digest;
    return {
      name: error.name,
      message: error.message,
      ...(digest ? { digest } : {}),
      ...(error.stack ? { stack: error.stack.slice(0, 4000) } : {}),
    };
  }
  return { name: "NonError", message: String(error).slice(0, 1000) };
}

export async function register(): Promise<void> {
  // Sans DSN, on ne charge même pas le SDK côté serveur : démarrage et
  // cold start restent identiques à l'état sans Sentry.
  if (!process.env.SENTRY_DSN) return;

  try {
    if (process.env.NEXT_RUNTIME === "nodejs") {
      await import("./sentry.server.config");
    }
    if (process.env.NEXT_RUNTIME === "edge") {
      await import("./sentry.edge.config");
    }
  } catch (error) {
    // Une erreur d'initialisation Sentry ne doit jamais empêcher le site de
    // démarrer : on le signale et on continue avec les logs Vercel seuls.
    console.error(
      JSON.stringify({
        level: "warn",
        source: "sentry.register",
        message: describe(error).message,
      }),
    );
  }
}

export async function onRequestError(
  error: unknown,
  request: RequestInfo,
  context: RequestErrorContext,
): Promise<void> {
  const payload = {
    level: "error",
    source: "next.onRequestError",
    timestamp: new Date().toISOString(),
    method: request.method,
    path: request.path,
    router: context.routerKind,
    routePath: context.routePath,
    routeType: context.routeType,
    error: describe(error),
  };

  console.error(JSON.stringify(payload));

  if (!process.env.SENTRY_DSN) return;

  try {
    // Import à la demande : le SDK n'est chargé que lorsqu'une erreur survient,
    // pas au démarrage de chaque fonction.
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureRequestError(error, request, context);
  } catch (reportingError) {
    console.error(
      JSON.stringify({
        level: "warn",
        source: "sentry.captureRequestError",
        message: describe(reportingError).message,
      }),
    );
  }
}
