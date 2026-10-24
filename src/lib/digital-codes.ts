// Chiffrement des codes livrés (AES-256-GCM) — serveur uniquement.
//
// Les numéros de carte / PIN ne sont JAMAIS stockés en clair : seul le
// serveur peut les relire, avec la clé dérivée de DIGITAL_CODES_SECRET
// (ou, à défaut, SESSION_SECRET).

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { Buffer } from "node:buffer";
import type { GiftCardCode } from "@/lib/reloadly";

/**
 * Clé AES-256 des codes livrés : dérivée de `DIGITAL_CODES_SECRET`
 * (préféré) ou, à défaut, de `SESSION_SECRET`. Sans secret, on refuse
 * d'acheter — un code acheté doit pouvoir être relu.
 */
export function digitalCodesKey(): Buffer | null {
  const secret =
    process.env.DIGITAL_CODES_SECRET?.trim() ||
    process.env.SESSION_SECRET?.trim() ||
    "";
  if (!secret) return null;
  return createHash("sha256").update(`nukhba-digital-codes:${secret}`).digest();
}

/** Chiffre les codes (AES-256-GCM, format `iv.tag.chiffré`, base64url). */
export function encryptDigitalCodes(codes: GiftCardCode[], key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(codes), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

/** Déchiffre les codes ; `null` si la charge est illisible. */
export function decryptDigitalCodes(payload: string | null, key: Buffer | null): GiftCardCode[] {
  if (!payload || !key) return [];
  const parts = payload.split(".");
  if (parts.length !== 3) return [];
  try {
    const [iv, tag, data] = parts.map((part) => Buffer.from(part, "base64url"));
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
    const parsed = JSON.parse(plaintext.toString("utf8")) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is GiftCardCode =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof (item as GiftCardCode).cardNumber === "string",
    );
  } catch {
    return [];
  }
}

