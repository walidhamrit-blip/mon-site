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

/* ---------------------------- Décision d'achat --------------------------- */

/**
 * Décision issue de la vérification d'identifiant, partagée par le tunnel
 * d'achat et la caisse serveur — une seule règle, donc aucun contournement
 * possible.
 *
 *  - `allow` : identifiant existant, ou jeu non vérifiable MAIS client qui a
 *    explicitement certifié que l'identifiant est le sien ;
 *  - `block` : le fournisseur a vérifié et l'identifiant n'existe pas ;
 *  - `require_confirmation` : le fournisseur ne sait pas vérifier ce jeu —
 *    on n'empêche pas la vente, mais elle exige une confirmation explicite.
 *
 * ⚠️ Avant, `checked: false` laissait passer l'achat en silence : un
 * identifiant bidon sur un jeu non vérifiable ouvrait directement la page de
 * paiement (constaté en production sur « Game Top-Up — 8 Ball Pool »).
 */
export type PlayerIdGate = "allow" | "block" | "require_confirmation";

export function playerIdGate(input: {
  /** Vrai si le fournisseur a réellement pu vérifier l'identifiant. */
  checked: boolean;
  /** Pertinent seulement si `checked`. */
  valid: boolean;
  /** Le client a-t-il certifié l'identifiant (jeu non vérifiable) ? */
  confirmed?: boolean;
}): PlayerIdGate {
  if (!input.checked) {
    return input.confirmed === true ? "allow" : "require_confirmation";
  }
  return input.valid ? "allow" : "block";
}
