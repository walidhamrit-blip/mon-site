// Chiffrement du jeton de validation d'une livraison (AES-256-GCM) — serveur.
//
// Pourquoi le conserver, alors que le jeton ne devrait jamais être stocké en
// clair ? Parce que l'admin doit pouvoir RENVOYER le lien de validation : un
// client qui l'a perdu ne doit pas bloquer la recette. Il est donc chiffré
// avec une clé dérivée d'un secret d'environnement (jamais en clair en base),
// exactement comme les codes de cartes livrés (src/lib/digital-codes.ts).
//
// Sans secret configuré, aucun chiffrement : le lien reste valable, il n'est
// simplement pas renvoyable (l'admin le copie à la création).

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { Buffer } from "node:buffer";

function deliveryTokenKey(): Buffer | null {
  const secret =
    process.env.DIGITAL_CODES_SECRET?.trim() || process.env.SESSION_SECRET?.trim() || "";
  if (!secret) return null;
  return createHash("sha256").update(`nukhba-delivery-token:${secret}`).digest();
}

/** Chiffre le jeton (format `iv.tag.chiffré`, base64url). `null` sans secret. */
export function encryptDeliveryToken(token: string): string | null {
  const key = deliveryTokenKey();
  if (!key) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(token, "utf8")),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

/** Déchiffre le jeton ; `null` si la charge est absente ou illisible. */
export function decryptDeliveryToken(payload: string | null | undefined): string | null {
  const key = deliveryTokenKey();
  if (!payload || !key) return null;
  const parts = payload.split(".");
  if (parts.length !== 3) return null;
  try {
    const [iv, tag, data] = parts.map((part) => Buffer.from(part, "base64url"));
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
    const token = plaintext.toString("utf8");
    return token.length >= 16 ? token : null;
  } catch {
    return null;
  }
}
