/**
 * Instrumentation serveur (convention Next.js 16).
 *
 * `onRequestError` est appelé pour toute erreur de rendu, de route ou de
 * Server Action. Sans ce hook, une exception serveur ne laisse qu'une ligne
 * générique dans les logs Vercel, sans route, sans type et sans digest.
 *
 * On journalise un JSON sur une seule ligne, facile à filtrer dans Vercel :
 *   level, source, timestamp, method, path, router, routePath, routeType,
 *   error.name, error.message, error.digest, error.stack (tronquée).
 *
 * On ne journalise JAMAIS les en-têtes, les cookies ni la query string :
 * ils peuvent contenir un jeton de session ou une référence de paiement.
 *
 * La remontée centralisée (Sentry) se branchera ici en C-04, sans changer
 * les appelants.
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
}
