/**
 * Message d'erreur base de données lisible par un administrateur.
 *
 * Drizzle enveloppe les erreurs PostgreSQL dans `DrizzleQueryError`, dont le
 * `message` ne contient que la requête SQL (« Failed query: select … params:
 * 200 »). La vraie cause (« column … does not exist ») est dans `cause`.
 * Afficher le SQL entier noie l'information utile : on privilégie la cause,
 * et on tronque la requête quand il faut la montrer.
 */
const MAX_QUERY_CHARS = 240;

export function describeDbError(error: unknown): string {
  const cause =
    error && typeof error === "object" && "cause" in error
      ? (error as { cause?: unknown }).cause
      : undefined;
  const causeMessage = cause instanceof Error ? cause.message : "";

  const raw = error instanceof Error ? error.message : String(error);
  // « Failed query: <sql> » → on isole la requête pour pouvoir la tronquer.
  const failedQuery = raw.match(/Failed query:\s*([\s\S]*)/i);
  const query = failedQuery ? failedQuery[1] : "";
  const shortQuery = query
    ? query.length > MAX_QUERY_CHARS
      ? `${query.slice(0, MAX_QUERY_CHARS)}…`
      : query
    : "";

  if (causeMessage) {
    return shortQuery ? `${causeMessage} (requête : ${shortQuery})` : causeMessage;
  }
  if (shortQuery) return `Requête refusée : ${shortQuery}`;
  return raw;
}
