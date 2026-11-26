/**
 * Prototype isolé ; aucun appelant de production et aucune connexion réseau.
 * Requiert la table de test dédiée décrite dans docs. Une insertion durable
 * n'autorise pas à elle seule un POST : contrôles de commande, expiration,
 * concurrence, résultat distant et sécurité restent à concevoir et valider.
 */
export const RESERVE_DISPATCH_SQL = `
  INSERT INTO g2g_dispatch_reservation_prototype
    (order_id, delivery_id, supplier_order_id, quantity, expires_at)
  SELECT $1, $2, $3, $4, $5::timestamptz
  WHERE $5::timestamptz > clock_timestamp()
  ON CONFLICT (order_id, delivery_id) DO NOTHING
  RETURNING order_id
`;

type SqlExecutor = { query: (sql: string, params: unknown[]) => Promise<{ rows: unknown[] }> };
type Input = { orderId: string; deliveryId: string; supplierOrderId: string; quantity: number; expiresAt: Date };

/**
 * La transaction contenant l'insertion doit être commitée avant tout effet
 * externe ; une erreur ou un résultat de commit incertain impose une revue,
 * jamais un nouvel envoi. Cette fonction ne gère pas elle-même le commit.
 * `not_reserved` regroupe volontairement conflit et échéance passée.
 */
export async function reserveDispatchPrototype(executor: SqlExecutor, input: Input): Promise<"reserved" | "not_reserved"> {
  for (const id of [input.orderId, input.deliveryId, input.supplierOrderId]) {
    if (typeof id !== "string" || !id || id !== id.trim() || /[\x00-\x1f\x7f]/.test(id)) throw new Error("Invalid reservation identifier");
  }
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 100 || !(input.expiresAt instanceof Date) || !Number.isFinite(input.expiresAt.getTime())) throw new Error("Invalid reservation parameters");
  const result = await executor.query(RESERVE_DISPATCH_SQL, [input.orderId, input.deliveryId, input.supplierOrderId, input.quantity, input.expiresAt]);
  return result.rows.length === 1 ? "reserved" : "not_reserved";
}

/**
 * Prototype transactionnel de test uniquement. Le client doit être une
 * connexion exclusive (jamais pool.query) et abandonné après une erreur.
 * Même si la base a validé le COMMIT, une réponse perdue retourne "uncertain".
 * La réservation n'est pas une permission d'envoyer ni un jeton de reprise.
 */
export async function reserveCommittedPrototype(exclusiveClient: SqlExecutor, input: Input): Promise<"committed" | "not_reserved" | "uncertain"> {
  try {
    await exclusiveClient.query("BEGIN", []);
    const result = await reserveDispatchPrototype(exclusiveClient, input);
    await exclusiveClient.query("COMMIT", []);
    return result === "reserved" ? "committed" : "not_reserved";
  } catch {
    try { await exclusiveClient.query("ROLLBACK", []); } catch { /* résultat toujours incertain */ }
    return "uncertain";
  }
}
