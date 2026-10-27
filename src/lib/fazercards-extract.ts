/**
 * Lecture des codes dans une réponse de commande FazerCards.
 *
 * ⚠️ Pourquoi un module dédié (et pourquoi il a été réécrit).
 *
 * La première version ne connaissait que `payload.codes[]`, `payload.cardNumber`
 * et `payload.code`. Or un **game key** — le seul type du catalogue qui renvoie
 * réellement un code — arrive sous `payload.keys[]`. Résultat observé en
 * production (commande `ord-2492479`, Beyond: Two Souls) : le fournisseur
 * avait livré (statut `completed`) mais l'extraction renvoyait zéro code, et la
 * commande basculait à tort en « livraison manuelle requise ».
 *
 * La lecture est donc volontairement TOLÉRANTE sur la forme, mais STRICTE sur
 * les noms de champs : on ne collecte que des champs d'une liste blanche, pour
 * ne jamais prendre un identifiant de commande, une devise ou un statut pour un
 * code.
 *
 * ⚠️ Une recharge de jeu (`game_topup`) ne renvoie AUCUN code par conception :
 * le crédit est appliqué au compte du joueur. Ce fichier ne doit donc pas être
 * utilisé pour conclure qu'une recharge a échoué — voir
 * `classifyFazercardsDelivery`.
 */

export interface ExtractedCode {
  cardNumber: string;
  pinCode: string | null;
  redemptionUrl: string | null;
}

/** Champs qui portent un code, selon les familles de produits FazerCards. */
const CODE_FIELDS = [
  "cardNumber",
  "card_number",
  "cardnumber",
  "code",
  "voucherCode",
  "voucher_code",
  "key",
  "keyCode",
  "key_code",
  "serial",
  "serialNumber",
  "serial_number",
  "activationKey",
  "activation_key",
  "number",
] as const;

/** Tableaux qui peuvent contenir les codes. */
const CODE_CONTAINERS = [
  "codes",
  "keys",
  "cards",
  "serials",
  "vouchers",
  "items",
] as const;

/** Champs qui portent le PIN / la seconde partie d'un code. */
const PIN_FIELDS = ["pinCode", "pin_code", "pin"] as const;

/** Champs qui portent un lien d'activation. */
const URL_FIELDS = ["redemptionUrl", "redemption_url", "url", "link"] as const;

/** Champs qui trahissent un statut ou une devise : jamais un code. */
const LOOKALIKE_VALUES = new Set([
  "completed",
  "complete",
  "processing",
  "pending",
  "created",
  "cancelled",
  "canceled",
  "failed",
  "refunded",
  "rejected",
  "true",
  "false",
  "null",
  "undefined",
  "usd",
  "eur",
]);

/** Longueur minimale plausible d'un code (écarte « OK », « 1 », « — »). */
const MIN_CODE_LENGTH = 4;

type Dict = Record<string, unknown>;

function isDict(value: unknown): value is Dict {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function asNullableText(value: unknown): string | null {
  const text = asText(value);
  return text === "" ? null : text;
}

function pick(dict: Dict, fields: readonly string[]): string {
  for (const field of fields) {
    const text = asText(dict[field]);
    if (text !== "") return text;
  }
  return "";
}

function pickNullable(dict: Dict, fields: readonly string[]): string | null {
  for (const field of fields) {
    const text = asNullableText(dict[field]);
    if (text !== null) return text;
  }
  return null;
}

/** Un candidat ressemble-t-il à un vrai code ? */
function looksLikeCode(value: string): boolean {
  const text = value.trim();
  if (text.length < MIN_CODE_LENGTH) return false;
  return !LOOKALIKE_VALUES.has(text.toLowerCase());
}

/**
 * Convertit une entrée de tableau en code.
 * Une entrée peut être une simple chaîne (`["9M0TD-…"]`) ou un objet.
 */
function codeFromEntry(entry: unknown): ExtractedCode | null {
  if (typeof entry === "string" || typeof entry === "number") {
    const text = asText(entry);
    if (!looksLikeCode(text)) return null;
    return { cardNumber: text, pinCode: null, redemptionUrl: null };
  }
  if (!isDict(entry)) return null;

  const cardNumber = pick(entry, CODE_FIELDS);
  if (!looksLikeCode(cardNumber)) return null;
  return {
    cardNumber,
    pinCode: pickNullable(entry, PIN_FIELDS),
    redemptionUrl: pickNullable(entry, URL_FIELDS),
  };
}

/**
 * Parcours de secours : cherche les champs de code dans une structure
 * imbriquée inconnue (`payload.result.cards[0].value`…). Profondeur bornée
 * pour ne jamais boucler sur une structure cyclique ou démesurée.
 */
function collectDeep(value: unknown, out: ExtractedCode[], depth: number): void {
  if (depth > 5 || out.length >= 100) return;
  if (Array.isArray(value)) {
    for (const entry of value) {
      // Un tableau de chaînes est un cas fréquent (`keys: ["…", "…"]`).
      if (typeof entry === "string" || typeof entry === "number") {
        const code = codeFromEntry(entry);
        if (code) out.push(code);
      } else {
        collectDeep(entry, out, depth + 1);
      }
    }
    return;
  }
  if (!isDict(value)) return;

  const direct = codeFromEntry(value);
  if (direct) {
    out.push(direct);
    return;
  }
  for (const nested of Object.values(value)) {
    if (isDict(nested) || Array.isArray(nested)) {
      collectDeep(nested, out, depth + 1);
    }
  }
}

/**
 * Extrait les codes d'un `payload` de commande FazerCards.
 *
 * Ne lève jamais : une réponse illisible donne un tableau vide, à charge de
 * l'appelant de décider quoi en faire selon le TYPE de produit.
 */
export function extractFazercardsCodes(payload: unknown): ExtractedCode[] {
  const result: ExtractedCode[] = [];
  const push = (code: ExtractedCode | null): void => {
    if (!code) return;
    if (!result.some((item) => item.cardNumber === code.cardNumber)) {
      result.push(code);
    }
  };

  if (!isDict(payload)) return result;

  // 1) Conteneurs connus (codes, keys, cards, serials, vouchers, items).
  for (const container of CODE_CONTAINERS) {
    const value = payload[container];
    if (Array.isArray(value)) {
      for (const entry of value) push(codeFromEntry(entry));
    } else if (isDict(value)) {
      for (const entry of Object.values(value)) push(codeFromEntry(entry));
    }
  }

  // 2) Champs directs sur le payload.
  push(codeFromEntry(payload));

  // 3) Structure inconnue : parcours profond de secours.
  if (result.length === 0) {
    const deep: ExtractedCode[] = [];
    collectDeep(payload, deep, 0);
    for (const code of deep) push(code);
  }

  return result;
}

export type FazercardsDeliveryKind =
  | "codes"
  | "topup_completed"
  | "processing"
  | "failed";

/**
 * Décide ce que signifie le statut fournisseur pour CE type de produit.
 *
 * C'est le correctif central : une **recharge de jeu** terminée est un succès
 * même sans code (le crédit est sur le compte du joueur). La traiter comme un
 * échec produisait une fausse alerte « livraison manuelle requise » et privait
 * le client de son e-mail de confirmation.
 */
export function classifyFazercardsDelivery(input: {
  kind: string;
  status: string;
  codes: ExtractedCode[];
}): FazercardsDeliveryKind {
  const status = (input.status ?? "").trim().toLowerCase();
  const failedStatuses = ["cancelled", "canceled", "failed", "refunded", "rejected"];

  if (failedStatuses.includes(status)) return "failed";
  if (input.codes.length > 0) return "codes";
  if (status === "completed") {
    // `completed` sans code n'est un succès que pour une recharge (crédit
    // appliqué au compte joueur). Pour une carte ou une clé, un `completed`
    // sans code est anormal : on préfère l'intervention humaine.
    return input.kind === "game_topup" ? "topup_completed" : "processing";
  }
  return "processing";
}

/**
 * Version expurgée d'une réponse fournisseur, pour la journalisation.
 *
 * On garde la STRUCTURE (clés, statut, longueurs) et on masque les valeurs qui
 * ressemblent à un code : un diagnostic ne doit jamais écrire une clé en clair
 * dans les logs.
 */
export function redactFazercardsPayload(payload: unknown, depth = 0): unknown {
  if (depth > 4) return "…";
  if (Array.isArray(payload)) {
    return payload.slice(0, 5).map((entry) => redactFazercardsPayload(entry, depth + 1));
  }
  if (!isDict(payload)) {
    if (typeof payload === "string") {
      return payload.length > 24 ? `<${payload.length} caractères masqués>` : payload;
    }
    return payload;
  }
  const out: Dict = {};
  for (const [key, value] of Object.entries(payload)) {
    const lower = key.toLowerCase();
    const isSecret =
      CODE_FIELDS.some((field) => field.toLowerCase() === lower) ||
      PIN_FIELDS.some((field) => field.toLowerCase() === lower);
    if (isSecret) {
      const text = asText(value);
      out[key] = text ? `<masqué: ${text.length} caractères>` : value;
    } else if (
      // Conteneur de codes (`keys: ["9M0TD-…"]`) : les entrées sont des
      // chaînes brutes, sans nom de champ à reconnaître.
      CODE_CONTAINERS.some((container) => container.toLowerCase() === lower) &&
      Array.isArray(value)
    ) {
      out[key] = value.map((entry) => {
        const text = asText(entry);
        return text ? `<masqué: ${text.length} caractères>` : redactFazercardsPayload(entry, depth + 1);
      });
    } else {
      out[key] = redactFazercardsPayload(value, depth + 1);
    }
  }
  return out;
}
