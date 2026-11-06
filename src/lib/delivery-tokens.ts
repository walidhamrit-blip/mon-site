// Chiffrement du jeton de validation d'une livraison (AES-256-GCM) — serveur.
//
// Pourquoi le conserver, alors que le jeton ne devrait jamais être stocké en
// clair ? Parce que l'admin doit pouvoir RENVOYER le lien de validation : un
// client qui l'a perdu ne doit pas bloquer la recette. Il est donc chiffré
// avec une clé dérivée d'un secret d'environnement (jamais en clair en base),
// exactement comme les codes de cartes livrés (src/lib/digital-codes.ts).
//
// Même trousseau que les codes : le secret racine est DIGITAL_CODES_SECRET
// (préfixe de dérivation distinct), avec les mêmes replis de lecture. Sans
// secret configuré, aucun chiffrement : le lien reste valable, il n'est
// simplement pas renvoyable (l'admin le copie à la création).

import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { decryptEnvelopeWithKey, encryptEnvelope } from "@/lib/digital-codes";

const TOKEN_KEY_PREFIX = "nukhba-delivery-token:";

/** Dérive la clé d'un secret avec le domaine propre aux jetons de livraison. */
export function deriveDeliveryTokenKey(secret: string): Buffer {
  return createHash("sha256").update(`${TOKEN_KEY_PREFIX}${secret}`).digest();
}

function secretList(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

/**
 * Clés de lecture, la première servant au chiffrement. Vide = chiffrement
 * désactivé (lien de livraison non renvoyable).
 */
export function deliveryTokenKeyRing(): Buffer[] {
  const dedicated = process.env.DIGITAL_CODES_SECRET?.trim() ?? "";
  const session = process.env.SESSION_SECRET?.trim() ?? "";
  const previous = secretList(process.env.DIGITAL_CODES_SECRET_PREVIOUS);
  const dropLegacy = process.env.DIGITAL_CODES_DROP_LEGACY_FALLBACK === "true";

  const secrets: string[] = [];
  if (dedicated) {
    secrets.push(dedicated);
    secrets.push(...previous);
    if (!dropLegacy && session) secrets.push(session);
  } else if (session) {
    secrets.push(session);
    secrets.push(...previous);
  }

  const seen = new Set<string>();
  const ring: Buffer[] = [];
  for (const secret of secrets) {
    const key = deriveDeliveryTokenKey(secret);
    const id = key.toString("hex");
    if (seen.has(id)) continue;
    seen.add(id);
    ring.push(key);
  }
  return ring;
}

/** Clé de chiffrement courante (null si aucun secret). */
export function deliveryTokenKey(): Buffer | null {
  return deliveryTokenKeyRing()[0] ?? null;
}

/** Chiffre le jeton (format `iv.tag.chiffré`, base64url). `null` sans secret. */
export function encryptDeliveryToken(token: string): string | null {
  const key = deliveryTokenKey();
  if (!key) return null;
  return encryptEnvelope(token, key);
}

/** Déchiffre avec UNE clé ; `null` si la charge ne correspond pas. */
export function decryptDeliveryTokenWithKey(
  payload: string | null | undefined,
  key: Buffer,
): string | null {
  if (!payload) return null;
  const token = decryptEnvelopeWithKey(payload, key);
  return token && token.length >= 16 ? token : null;
}

/** Déchiffre le jeton ; `null` si la charge est absente ou illisible. */
export function decryptDeliveryToken(payload: string | null | undefined): string | null {
  if (!payload) return null;
  for (const key of deliveryTokenKeyRing()) {
    const token = decryptDeliveryTokenWithKey(payload, key);
    if (token) return token;
  }
  return null;
}
