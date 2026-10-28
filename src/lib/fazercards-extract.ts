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

/**
 * Clés dont le NOM ressemble à un code mais qui n'en sont pas : identifiants
 * techniques, statuts, monnaies, montants. Sans cette liste, la règle
 * générique ci-dessous confondrait `order_id`, `key_id` ou `code_status`
 * avec un code livré — et livrerait au client un identifiant de commande.
 */
const NON_CODE_KEYS = [
  "orderid",
  "order_id",
  "id",
  "keyid",
  "key_id",
  "cardid",
  "card_id",
  "offerid",
  "offer_id",
  "categoryid",
  "category_id",
  "gameid",
  "game_id",
  "productid",
  "product_id",
  "idempotencykey",
  "idempotency_key",
  "transactionid",
  "transaction_id",
  "codestatus",
  "code_status",
  "statuscode",
  "status_code",
  "errorcode",
  "error_code",
  "currency",
  "amount",
  "price",
  "priceusd",
  "price_usd",
  "status",
  "kind",
  "type",
  "createdat",
  "created_at",
  "updatedat",
  "updated_at",
] as const;

/**
 * Règle GÉNÉRIQUE : le nom de la clé annonce-t-il un code ?
 *
 * Le fournisseur ne documente pas la forme de `order.payload` (schéma
 * `additionalProperties: true`). Une liste blanche fermée suffisait pour les
 * clés de jeu (`keys[]`) mais pas pour les cartes cadeaux : une commande
 * `completed` restait sans code, donc sans e-mail au client. On accepte donc
 * tout nom contenant code / serial / voucher / pin / key / token / redeem,
 * en excluant la liste `NON_CODE_KEYS`.
 */
function keySuggestsCode(key: string): boolean {
  const lower = key.toLowerCase().replace(/[\s-]/g, "");
  if ((NON_CODE_KEYS as readonly string[]).includes(lower)) return false;
  return /code|serial|voucher|pin|key|token|redeem|activation/.test(lower);
}

/**
 * Un code délivré ressemble-t-il vraiment à un code ?
 *
 * Les chaînes courtes (« ok », « usd ») et les phrases sont écartées : un
 * code fait au moins 6 caractères et contient un chiffre ou un tiret. Cette
 * contrainte ne s'applique qu'à la règle générique — la liste blanche
 * explicite reste seule juge pour les champs connus.
 */
function looksLikeDeliveredCode(value: string): boolean {
  const text = value.trim();
  if (text.length < 6) return false;
  if (!/[0-9]/.test(text) && !text.includes("-")) return false;
  return !LOOKALIKE_VALUES.has(text.toLowerCase());
}

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
        const text = asText(entry);
        const code = looksLikeDeliveredCode(text) ? codeFromEntry(entry) : null;
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

  for (const [key, nested] of Object.entries(value)) {
    // 1) Le NOM de la clé annonce un code : on prend la valeur telle quelle
    //    (c'est le cas des payloads non documentés — cartes cadeaux).
    if (keySuggestsCode(key) && (typeof nested === "string" || typeof nested === "number")) {
      const text = asText(nested);
      if (looksLikeDeliveredCode(text)) {
        out.push({
          cardNumber: text,
          pinCode: pickNullable(value, PIN_FIELDS),
          redemptionUrl: pickNullable(value, URL_FIELDS),
        });
        continue;
      }
    }
    // 2) Sinon on descend dans les structures imbriquées.
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

/**
 * Extrait les codes d'une COMMANDE fournisseur complète.
 *
 * ⚠️ Pourquoi ne pas se limiter à `order.payload` : la réponse
 * `GET /orders/:id` est non documentée (`additionalProperties: true`) et les
 * cartes cadeaux placent leurs codes ailleurs que les clés de jeu. Se
 * restreindre à `payload` produisait exactement l'incident du 29/10/2026 :
 * commande `completed` chez le fournisseur, zéro code extrait, aucun e-mail
 * au client, et une commande qui tourne en « livraison en cours » sans fin.
 *
 * On analyse donc l'objet `order` entier (payload compris). Les identifiants
 * techniques sont écartés par `NON_CODE_KEYS`.
 */
export function extractFazercardsCodesFromOrder(order: unknown): ExtractedCode[] {
  if (!isDict(order)) return extractFazercardsCodes(order);

  const result: ExtractedCode[] = [];
  const push = (code: ExtractedCode | null): void => {
    if (!code) return;
    if (!result.some((item) => item.cardNumber === code.cardNumber)) result.push(code);
  };

  // 1) Le payload documenté (le plus probable).
  for (const code of extractFazercardsCodes(order.payload)) push(code);

  // 2) Le reste de la commande : c'est là que la carte cadeau peut se cacher.
  if (result.length === 0) {
    for (const code of extractFazercardsCodes(order)) push(code);
  }

  return result;
}

/**
 * Décrit la STRUCTURE d'une réponse fournisseur, sans aucune valeur.
 *
 * Sert au diagnostic admin (et au motif de livraison manuelle) : « où sont
 * les champs ? » se répond en une ligne, sans jamais écrire un code en clair
 * ni dans les logs ni dans l'interface.
 */
export function describeFazercardsPayload(value: unknown, depth = 0, prefix = ""): string[] {
  if (depth > 4) return [`${prefix}: …`];
  if (Array.isArray(value)) {
    if (value.length === 0) return [`${prefix}: []`];
    const first = value[0];
    const shape = isDict(first)
      ? `{${Object.keys(first).slice(0, 8).join(",")}}`
      : typeof first;
    return [`${prefix}[${value.length}] ${shape}`];
  }
  if (!isDict(value)) return [];
  const lines: string[] = [];
  for (const [key, nested] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isDict(nested) || Array.isArray(nested)) {
      lines.push(...describeFazercardsPayload(nested, depth + 1, path));
    } else {
      const text = asText(nested);
      lines.push(`${path}: ${typeof nested}${text ? ` (${text.length}c)` : ""}`);
    }
  }
  return lines.slice(0, 40);
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
