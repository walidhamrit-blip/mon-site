// Références et jetons de suivi des commandes — côté serveur uniquement.
//
// La référence (`NKH-…` / `RSV-…`) reste l'identifiant lisible de la
// commande. Le jeton de suivi est un secret séparé : il autorise la
// consultation publique du statut et la relance d'une tranche. Seul son
// SHA-256 est conservé en base ; le jeton en clair n'existe que dans les
// URLs de retour NOWPayments et dans la réponse de création.

import { Buffer } from "node:buffer";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Référence de commande à forte entropie (96 bits, hexadécimal). */
export function newOrderReference(prefix: "NKH" | "RSV"): string {
  return `${prefix}-${randomBytes(12).toString("hex").toUpperCase()}`;
}

export interface TrackingToken {
  /** Jeton en clair, à transmettre une seule fois au client. */
  token: string;
  /** Empreinte à stocker en base (`orders.tracking_token_hash`). */
  hash: string;
}

/** Crée un jeton de suivi (256 bits) et son empreinte SHA-256. */
export function createTrackingToken(): TrackingToken {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashTrackingToken(token) };
}

export function hashTrackingToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/** Vérifie un jeton présenté par le client contre l'empreinte stockée. */
export function verifyTrackingToken(
  token: string | null | undefined,
  expectedHash: string | null | undefined,
): boolean {
  if (!token?.trim() || !expectedHash?.trim()) return false;
  return constantTimeEqual(
    hashTrackingToken(token.trim()),
    expectedHash.trim().toLowerCase(),
  );
}

export type TrackingAccess = "granted" | "legacy" | "denied";

/**
 * Niveau d'accès au suivi public d'une commande :
 * - `granted` : jeton valide (commandes créées avec cette protection) ;
 * - `legacy`  : commande antérieure sans empreinte — accès minimisé
 *   conservé pour ne pas casser les liens déjà envoyés ;
 * - `denied`  : empreinte présente mais jeton absent/incorrect.
 */
export function trackingAccess(
  expectedHash: string | null | undefined,
  token: string | null | undefined,
): TrackingAccess {
  if (!expectedHash?.trim()) return "legacy";
  return verifyTrackingToken(token, expectedHash) ? "granted" : "denied";
}

/** Extrait le jeton d'une requête (en-tête dédié, Bearer, ou `?t=`). */
export function trackingTokenFromRequest(req: Request): string | null {
  const dedicated = req.headers.get("x-order-tracking-token")?.trim();
  if (dedicated) return dedicated;

  const authorization = req.headers.get("authorization")?.trim();
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    const bearer = authorization.slice(7).trim();
    if (bearer) return bearer;
  }

  try {
    const params = new URL(req.url).searchParams;
    return params.get("t")?.trim() || params.get("token")?.trim() || null;
  } catch {
    return null;
  }
}

/** Query-string des pages de retour (`ref`, plus `t` si jeton disponible). */
export function trackingQuery(ref: string, token?: string | null): string {
  const params = new URLSearchParams({ ref });
  if (token?.trim()) params.set("t", token.trim());
  return params.toString();
}

/** Masque un e-mail pour l'affichage public : `w***@example.com`. */
export function maskEmail(email: string | null | undefined): string | null {
  const value = email?.trim();
  if (!value) return null;
  const at = value.lastIndexOf("@");
  if (at <= 0 || at === value.length - 1) return "***";
  return `${value[0]}***@${value.slice(at + 1)}`;
}
