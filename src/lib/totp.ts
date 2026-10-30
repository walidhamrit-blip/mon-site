// Génération de codes TOTP (RFC 6238) — utilisée UNIQUEMENT pour valider
// automatiquement un virement NOWPayments.
//
// Pourquoi ce fichier : NOWPayments exige par défaut un code 2FA pour chaque
// payout (envoyé par e-mail, valable une heure). Une automatisation complète
// suppose donc que le compte soit passé en 2FA applicative (TOTP) et que le
// secret soit fourni au serveur via `NOWPAYMENTS_PAYOUT_TOTP_SECRET`.
//
// ⚠️ Ce secret vaut un accès aux virements : il ne doit vivre que dans les
// variables d'environnement (Vercel), jamais dans le dépôt ni en base.

import { createHmac } from "node:crypto";

/** Alphabet Base32 (RFC 4648), sans les caractères de bourrage. */
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Décode un secret Base32 (tolère espaces, tirets, minuscules, « = »). */
export function decodeBase32(input: string): Buffer {
  const cleaned = input
    .toUpperCase()
    .replace(/[\s\-=]/g, "")
    .replace(/^OTPAUTH:\/\/[^?]*\?SECRET=/i, "");
  if (!cleaned) throw new Error("secret TOTP vide");

  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of cleaned) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) throw new Error(`secret TOTP invalide : caractère « ${char} »`);
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export interface TotpOptions {
  /** Horodatage (ms). Défaut : maintenant. */
  at?: number;
  /** Période (secondes). Défaut : 30 — valeur NOWPayments/Google Authenticator. */
  stepSeconds?: number;
  /** Nombre de chiffres. Défaut : 6. */
  digits?: number;
}

/**
 * Code TOTP à 6 chiffres pour l'instant donné.
 *
 * Implémentation minimale HMAC-SHA1 (celle qu'utilisent les applications
 * d'authentification). Pas de dépendance externe : le dépôt n'en a aucune
 * pour la crypto, et ce fichier reste lisible/auditable.
 */
export function generateTotp(secret: string, options: TotpOptions = {}): string {
  const key = decodeBase32(secret);
  const stepSeconds = options.stepSeconds ?? 30;
  const digits = options.digits ?? 6;
  const counter = Math.floor((options.at ?? Date.now()) / 1000 / stepSeconds);

  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  counterBuffer.writeUInt32BE(counter % 2 ** 32, 4);

  const digest = createHmac("sha1", key).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return String(binary % 10 ** digits).padStart(digits, "0");
}

/** Vrai si la chaîne ressemble à un secret Base32 exploitable. */
export function isValidTotpSecret(secret: string | null | undefined): boolean {
  const cleaned = (secret ?? "").toUpperCase().replace(/[\s\-=]/g, "");
  if (cleaned.length < 16) return false;
  return /^[A-Z2-7]+$/.test(cleaned);
}
