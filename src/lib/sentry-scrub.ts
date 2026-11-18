/**
 * Nettoyage des événements avant envoi à Sentry.
 *
 * Un événement Sentry peut contenir l'URL complète de la requête, ses
 * en-têtes (`Cookie`, `Authorization`), ses cookies et le corps du formulaire.
 * Sur ce site, certaines URL portent des jetons d'accès ou des références de
 * paiement, et les formulaires contiennent des coordonnées clients.
 *
 * Règle : on garde le chemin et la méthode, on jette tout le reste.
 * `sendDefaultPii: false` couvre déjà l'adresse IP et les cookies côté SDK,
 * mais ce filtre est notre garantie explicite, indépendante des valeurs par
 * défaut de la bibliothèque.
 */

type ScrubbableRequest = {
  url?: string;
  query_string?: unknown;
  headers?: unknown;
  cookies?: unknown;
  data?: unknown;
  env?: unknown;
};

type ScrubbableBreadcrumb = {
  data?: Record<string, unknown>;
};

type ScrubbableEvent = {
  request?: ScrubbableRequest;
  transaction?: string;
  breadcrumbs?: ScrubbableBreadcrumb[];
};

/** Supprime la query string et le fragment d'une URL http(s). */
export function stripQuery(url: string): string {
  if (!/^https?:\/\//i.test(url)) return url;
  const [withoutFragment] = url.split("#", 1);
  const queryIndex = withoutFragment.indexOf("?");
  return queryIndex === -1 ? withoutFragment : withoutFragment.slice(0, queryIndex);
}

const URL_KEYS = new Set(["url", "from", "to"]);

function scrubBreadcrumb(breadcrumb: ScrubbableBreadcrumb): void {
  if (!breadcrumb.data) return;
  for (const key of URL_KEYS) {
    const value = breadcrumb.data[key];
    if (typeof value === "string") breadcrumb.data[key] = stripQuery(value);
  }
  delete breadcrumb.data.headers;
  delete breadcrumb.data.cookies;
}

/**
 * Retire les données sensibles d'un événement, sans le supprimer.
 * Retourne le même objet pour rester compatible avec `beforeSend`.
 */
export function scrubSentryEvent<T extends ScrubbableEvent>(event: T): T {
  const request = event.request;
  if (request) {
    if (typeof request.url === "string") request.url = stripQuery(request.url);
    delete request.query_string;
    delete request.headers;
    delete request.cookies;
    delete request.data;
    delete request.env;
  }

  if (typeof event.transaction === "string") {
    event.transaction = stripQuery(event.transaction);
  }

  if (Array.isArray(event.breadcrumbs)) {
    for (const breadcrumb of event.breadcrumbs) scrubBreadcrumb(breadcrumb);
  }

  return event;
}
