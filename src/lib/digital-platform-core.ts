// Noyau PUR de la « plateforme » affichée sur les fiches de recharge.
//
// Une recharge crédite un compte de JEU : le client doit saisir l'identifiant
// de son compte dans CE jeu-là (incident réel : identifiant 8 Ball Pool collé
// dans une recharge AFK Journey). La fiche doit donc dire explicitement sur
// quelle plateforme la recharge s'applique et quel identifiant est demandé.
//
// FazerCards ne publie pas de champ « plateforme » pour les recharges : on
// déduit la famille de plateforme du nom de la catégorie quand elle y figure
// (« Free Fire (Mobile) », « … PC », « … PlayStation »), sinon on affiche le
// nom du jeu tel quel. Aucune invention : pas de détection → nom du jeu.

/**
 * Classification locale des clés de champ, identique à celle de
 * `fazercards-player-id-core.ts`. Elle est dupliquée volontairement : ce
 * module reste sans import (donc importable par `node --test` tel quel) et
 * `scripts/digital-platform.test.mjs` vérifie que les deux classifient les
 * mêmes clés de la même façon — toute divergence casse le test.
 */
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

/** Vrai si la clé désigne un compte de joueur (mêmes règles que la caisse). */
export function isPlayerAccountKey(key: string): boolean {
  const normalized = (key ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!normalized) return false;
  if (NON_ID_KEYS.has(normalized)) return false;
  return (
    ID_KEYS.has(normalized) ||
    normalized.endsWith("userid") ||
    normalized.endsWith("playerid")
  );
}

export interface PlatformFamily {
  key: string;
  labelFr: string;
  labelEn: string;
  labelAr: string;
}

/**
 * Familles reconnues, de la plus spécifique à la plus générale : « Mobile »
 * avant « PC » (un nom de catégorie ne contient en pratique qu'une famille,
 * mais l'ordre rend le résultat déterministe).
 */
export const PLATFORM_FAMILIES: (PlatformFamily & { pattern: RegExp })[] = [
  {
    key: "playstation",
    labelFr: "PlayStation",
    labelEn: "PlayStation",
    labelAr: "بلايستيشن",
    pattern: /\b(playstation|psn|ps4|ps5)\b/i,
  },
  {
    key: "xbox",
    labelFr: "Xbox",
    labelEn: "Xbox",
    labelAr: "إكس بوكس",
    pattern: /\b(xbox|microsoft store)\b/i,
  },
  {
    key: "nintendo",
    labelFr: "Nintendo Switch",
    labelEn: "Nintendo Switch",
    labelAr: "نينتندو سويتش",
    pattern: /\b(nintendo|switch|eshop|e-shop)\b/i,
  },
  {
    key: "steam",
    labelFr: "Steam",
    labelEn: "Steam",
    labelAr: "ستيم",
    pattern: /\b(steam)\b/i,
  },
  {
    key: "epic",
    labelFr: "Epic Games",
    labelEn: "Epic Games",
    labelAr: "إيبك غيمز",
    pattern: /\b(epic games|epic)\b/i,
  },
  {
    key: "mobile",
    labelFr: "Mobile",
    labelEn: "Mobile",
    labelAr: "الهاتف المحمول",
    pattern: /\b(mobile|android|ios|iphone|ipad)\b/i,
  },
  {
    key: "pc",
    labelFr: "PC",
    labelEn: "PC",
    labelAr: "الحاسوب",
    pattern: /\b(pc|windows)\b/i,
  },
];

/** Famille de plateforme détectée dans un nom de catégorie (ou `null`). */
export function detectGamePlatform(name: string): PlatformFamily | null {
  const value = (name ?? "").trim();
  if (!value) return null;
  for (const family of PLATFORM_FAMILIES) {
    if (family.pattern.test(value)) {
      const { pattern: _pattern, ...rest } = family;
      return rest;
    }
  }
  return null;
}

export interface GamePlatformSummary {
  /** Libellé de plateforme à afficher (famille détectée, sinon nom du jeu). */
  platform: { fr: string; en: string; ar: string; detected: boolean };
  /** Libellés des identifiants que le client doit saisir (ex. « Player ID »). */
  accountFields: string[];
}

/**
 * Résumé affiché sur la fiche d'une recharge.
 *
 * `fields` provient du fournisseur (champs dynamiques d'une offre) : on ne
 * retient que les champs qui désignent vraiment un compte de joueur
 * (`hasPlayerIdField`), pour ne pas présenter « server_id » comme un
 * identifiant de compte.
 */
export function gamePlatformSummary(input: {
  name: string;
  platform?: string | null;
  fields?: { key: string; label: string }[] | null;
}): GamePlatformSummary {
  const name = (input.name ?? "").trim();
  const family = detectGamePlatform(name) ?? detectGamePlatform(input.platform ?? "");
  const fallback = (input.platform ?? "").trim() || name || "—";

  const accountFields = Array.from(
    new Set(
      (input.fields ?? [])
        .filter((field) => field && typeof field.key === "string")
        .filter((field) => isPlayerAccountKey(field.key))
        .map((field) => (field.label ?? "").trim() || field.key.trim())
        .filter(Boolean),
    ),
  );

  return {
    platform: family
      ? {
          fr: family.labelFr,
          en: family.labelEn,
          ar: family.labelAr,
          detected: true,
        }
      : { fr: fallback, en: fallback, ar: fallback, detected: false },
    accountFields,
  };
}
