/**
 * Partie pure de la vérification d'identifiant joueur (aucun import Next ni
 * fournisseur) : elle est ainsi testable directement avec `node --test`.
 */

/** Clés normalisées (minuscules, sans séparateur) qui désignent un compte. */
const ID_KEYS = new Set([
  "id",
  "uid",
  "userid",
  "playerid",
  "accountid",
  "account",
  "playeruid",
  "gameuid",
  "memberid",
]);

/**
 * Clés qui contiennent « id » sans être l'identifiant du compte.
 * ⚠️ `server_id` était reconnu comme un identifiant joueur avec une simple
 * recherche de sous-chaîne : on compare donc des clés NORMALISÉES, pas des
 * fragments.
 */
const NON_ID_KEYS = new Set([
  "serverid",
  "zoneid",
  "regionid",
  "realmid",
  "shardid",
  "orderid",
  "productid",
  "categoryid",
]);

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Vrai si les champs exigés comportent un identifiant de compte joueur. */
export function hasPlayerIdField(fields: { key: string }[]): boolean {
  return fields.some((field) => {
    const key = normalizeKey(field.key);
    if (NON_ID_KEYS.has(key)) return false;
    return ID_KEYS.has(key) || key.endsWith("userid") || key.endsWith("playerid");
  });
}
