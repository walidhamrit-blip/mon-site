// Chiffrement des codes livrés (AES-256-GCM) — serveur uniquement.
//
// Les numéros de carte / PIN ne sont JAMAIS stockés en clair.
//
// ── Trousseau de clés (key ring) ──────────────────────────────────────────
//
// La clé qui chiffre les données ne doit pas être la clé de session. Sinon le
// geste d'incident « renouveler SESSION_SECRET pour invalider les sessions
// admin » détruit définitivement tous les codes stockés — y compris ceux dont
// le client a perdu l'e-mail.
//
// Mais on ne peut pas changer de clé d'un coup : les codes déjà en base ont
// été chiffrés avec la clé historique dérivée de SESSION_SECRET. On déchiffre
// donc avec un TROUSSEAU, dans cet ordre :
//
//   1. DIGITAL_CODES_SECRET            → clé courante (chiffrement + lecture) ;
//   2. DIGITAL_CODES_SECRET_PREVIOUS   → anciennes clés, LECTURE SEULE
//      (liste séparée par des virgules) ;
//   3. repli historique dérivé de SESSION_SECRET (lecture seule).
//
// Le chiffrement utilise TOUJOURS la première clé ; le déchiffrement essaie
// chaque clé jusqu'à ce que le tag GCM soit valide. Conséquences :
//
//   - définir DIGITAL_CODES_SECRET ne casse rien : les anciens codes restent
//     lisibles par le repli, les nouveaux sont chiffrés avec la clé dédiée ;
//   - une rotation se fait sans interruption : l'ancienne valeur passe dans
//     DIGITAL_CODES_SECRET_PREVIOUS, `npm run codes:rotate` ré-chiffre les
//     lignes, puis on retire l'ancienne valeur ;
//   - quand `codes:rotate` annonce 0 ligne à migrer, définir
//     DIGITAL_CODES_DROP_LEGACY_FALLBACK=true supprime le repli de session.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { Buffer } from "node:buffer";
import type { GiftCardCode } from "@/lib/reloadly";

const CODES_KEY_PREFIX = "nukhba-digital-codes:";

/** Dérive la clé AES-256 d'un secret (séparation de domaine par préfixe). */
export function deriveCodesKey(secret: string): Buffer {
  return createHash("sha256").update(`${CODES_KEY_PREFIX}${secret}`).digest();
}

function dedupe(keys: Buffer[]): Buffer[] {
  const seen = new Set<string>();
  const out: Buffer[] = [];
  for (const key of keys) {
    const id = key.toString("hex");
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(key);
  }
  return out;
}

function secretList(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

/**
 * Clés utilisables, la première servant au chiffrement.
 *
 * Vide = aucun secret configuré : on refuse alors d'acheter, un code acheté
 * doit pouvoir être relu.
 */
export function digitalCodesKeyRing(): Buffer[] {
  const dedicated = process.env.DIGITAL_CODES_SECRET?.trim() ?? "";
  const session = process.env.SESSION_SECRET?.trim() ?? "";
  const previous = secretList(process.env.DIGITAL_CODES_SECRET_PREVIOUS);
  const dropLegacy = process.env.DIGITAL_CODES_DROP_LEGACY_FALLBACK === "true";

  const ring: Buffer[] = [];
  if (dedicated) {
    ring.push(deriveCodesKey(dedicated));
    for (const old of previous) ring.push(deriveCodesKey(old));
    if (!dropLegacy && session) ring.push(deriveCodesKey(session));
  } else if (session) {
    // Mode historique : la clé de session chiffre encore les données.
    ring.push(deriveCodesKey(session));
    for (const old of previous) ring.push(deriveCodesKey(old));
  }
  return dedupe(ring);
}

/** Clé de chiffrement courante (null si aucun secret). */
export function digitalCodesKey(): Buffer | null {
  return digitalCodesKeyRing()[0] ?? null;
}

/**
 * Origine de la clé courante — sert aux diagnostics (santé, `npm run doctor`)
 * pour signaler que des données sont encore chiffrées par la clé de session.
 */
export function digitalCodesKeySource(): "dedicated" | "session" | "none" {
  if (process.env.DIGITAL_CODES_SECRET?.trim()) return "dedicated";
  if (process.env.SESSION_SECRET?.trim()) return "session";
  return "none";
}

/**
 * État lisible du trousseau, pour les diagnostics (santé, `npm run doctor`).
 *
 * `rotationPending` répond à une seule question : **des données déjà stockées
 * peuvent-elles encore dépendre d'une clé qui n'est pas la clé courante ?**
 * Il est vrai si le repli de session est actif, si des anciennes clés sont
 * déclarées, ou si la clé courante est encore la clé de session.
 *
 * La présence de DIGITAL_CODES_SECRET ne suffit donc pas à conclure : la
 * variable peut avoir été ajoutée après des ventes, auquel cas les lignes
 * antérieures restent sous l'ancienne clé (lecture seule) jusqu'à migration.
 */
export interface DigitalCodesKeyStatus {
  /** Origine de la clé de chiffrement courante. */
  source: "dedicated" | "session" | "none";
  /** Nombre de clés acceptées en lecture (courante + anciennes + repli). */
  keyCount: number;
  /** Vrai s'il peut rester des lignes chiffrées hors de la clé courante. */
  rotationPending: boolean;
  /** Vrai si le repli de session reste autorisé en lecture. */
  legacyFallbackActive: boolean;
}

export function digitalCodesKeyStatus(): DigitalCodesKeyStatus {
  const source = digitalCodesKeySource();
  const keyRing = digitalCodesKeyRing();
  const legacyFallbackActive =
    process.env.DIGITAL_CODES_DROP_LEGACY_FALLBACK?.trim() !== "true" &&
    Boolean(process.env.SESSION_SECRET?.trim());

  return {
    source,
    keyCount: keyRing.length,
    rotationPending:
      source === "session" || (source === "dedicated" && keyRing.length > 1),
    legacyFallbackActive,
  };
}

/**
 * Enveloppe commune `iv.tag.chiffré` (base64url) — format historique conservé
 * à l'identique : les charges déjà en base restent lisibles.
 */
export function encryptEnvelope(plaintext: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

/** Déchiffre une enveloppe avec UNE clé ; `null` si le tag ne correspond pas. */
export function decryptEnvelopeWithKey(payload: string, key: Buffer): string | null {
  const parts = payload.split(".");
  if (parts.length !== 3) return null;
  try {
    const [iv, tag, data] = parts.map((part) => Buffer.from(part, "base64url"));
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** Chiffre les codes avec la clé courante. */
export function encryptDigitalCodes(codes: GiftCardCode[], key: Buffer): string {
  return encryptEnvelope(JSON.stringify(codes), key);
}

/**
 * Déchiffre avec UNE clé ; `null` si la charge est illisible avec celle-ci.
 * Permet à `codes:rotate` d'identifier la clé réellement utilisée.
 */
export function decryptDigitalCodesWithKey(
  payload: string | null,
  key: Buffer,
): GiftCardCode[] | null {
  if (!payload) return null;
  const plaintext = decryptEnvelopeWithKey(payload, key);
  if (plaintext === null) return null;
  try {
    const parsed = JSON.parse(plaintext) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(
      (item): item is GiftCardCode =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof (item as GiftCardCode).cardNumber === "string",
    );
  } catch {
    return null;
  }
}

/**
 * Déchiffre avec une clé ou un trousseau ; `[]` si aucune clé ne convient.
 * L'appel reste compatible avec l'ancienne signature (`Buffer | null`).
 */
export function decryptDigitalCodes(
  payload: string | null,
  keys: Buffer | Buffer[] | null,
): GiftCardCode[] {
  if (!payload || !keys) return [];
  const ring = Array.isArray(keys) ? keys : [keys];
  for (const key of ring) {
    const codes = decryptDigitalCodesWithKey(payload, key);
    if (codes !== null) return codes;
  }
  return [];
}
