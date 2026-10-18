// Client NOWPayments — côté serveur uniquement.
// Documentation : https://nowpayments.io/documentation
//
// La clé API ne quitte jamais le serveur : toutes les requêtes vers
// NOWPayments partent d'ici (routes API), jamais du navigateur.

import { createHmac, timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";

const PROD_API = "https://api.nowpayments.io/v1";
const SANDBOX_API = "https://api-sandbox.nowpayments.io/v1";

/** Clé API du marchand (Settings → API keys dans le tableau NOWPayments). */
export function nowPaymentsApiKey(): string {
  return process.env.NOWPAYMENTS_API_KEY?.trim() ?? "";
}

/** Vrai si l'intégration est prête (clé API renseignée). */
export function nowPaymentsConfigured(): boolean {
  return nowPaymentsApiKey().length > 0;
}

/** Clé secrète utilisée pour vérifier les signatures IPN. */
export function nowPaymentsIpnSecret(): string {
  return (
    process.env.NOWPAYMENTS_IPN_SECRET?.trim() || nowPaymentsApiKey()
  );
}

export function nowPaymentsApiBase(): string {
  return process.env.NOWPAYMENTS_SANDBOX === "true"
    ? SANDBOX_API
    : PROD_API;
}

/** Devise fiat de facturation (NOWPayments ne supporte pas la Livre libyenne). */
export function nowPaymentsFiatCurrency(): string {
  return (process.env.NOWPAYMENTS_CURRENCY?.trim() || "usd").toLowerCase();
}

/* ---------------- Création de paiement ---------------- */

export interface CreatePaymentInput {
  /** Montant dans la devise fiat (ex. 310 pour 310 USD). */
  priceAmount: number;
  priceCurrency?: string;
  /** Référence interne de la commande (notre `ref`). */
  orderId: string;
  orderDescription: string;
  ipnCallbackUrl?: string;
  successUrl?: string;
  cancelUrl?: string;
}

export interface CreatedPayment {
  payment_id: string;
  payment_status: string;
  payment_url: string;
  pay_address: string;
  pay_currency: string;
  pay_amount: number;
  price_amount: number;
  price_currency: string;
  order_id: string;
  order_description?: string;
  purchase_id?: string;
}

/**
 * Crée un paiement et renvoie la page de paiement hébergée par
 * NOWPayments (payment_url) vers laquelle le client est redirigé.
 */
export async function createPayment(
  input: CreatePaymentInput,
): Promise<CreatedPayment> {
  const apiKey = nowPaymentsApiKey();
  if (!apiKey) throw new Error("NOWPAYMENTS_API_KEY manquant");

  const response = await fetch(`${nowPaymentsApiBase()}/payment`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      price_amount: input.priceAmount,
      price_currency: input.priceCurrency ?? nowPaymentsFiatCurrency(),
      order_id: input.orderId,
      order_description: input.orderDescription,
      ...(input.ipnCallbackUrl ? { ipn_callback_url: input.ipnCallbackUrl } : {}),
      ...(input.successUrl ? { success_url: input.successUrl } : {}),
      ...(input.cancelUrl ? { cancel_url: input.cancelUrl } : {}),
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `NOWPayments create payment ${response.status} — ${detail.slice(0, 300)}`,
    );
  }

  return (await response.json()) as CreatedPayment;
}

/* ---------------- Statut d'un paiement ---------------- */

export interface PaymentStatusResponse {
  payment_id: string;
  payment_status: string;
  pay_address?: string;
  pay_currency?: string;
  pay_amount?: number;
  actually_paid?: string;
  order_id?: string;
  price_amount?: number;
  price_currency?: string;
  updated_at?: string;
}

// GET /v1/payment/{id} exige un jeton JWT en plus de la clé API.
// Le JWT est obtenu via POST /v1/auth (email + mot de passe du compte)
// et mis en cache ~4 minutes. Sans ces identifiants, on tente quand même
// avec la seule clé API (fonctionne sur certains comptes).
let jwtCache: { token: string; expiresAt: number } | null = null;

async function nowPaymentsJwt(): Promise<string | null> {
  const email = process.env.NOWPAYMENTS_EMAIL?.trim();
  const password = process.env.NOWPAYMENTS_PASSWORD?.trim();
  if (!email || !password) return null;

  if (jwtCache && jwtCache.expiresAt > Date.now()) return jwtCache.token;

  try {
    const response = await fetch(`${nowPaymentsApiBase()}/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { token?: string };
    if (!data.token) return null;
    jwtCache = { token: data.token, expiresAt: Date.now() + 4 * 60 * 1000 };
    return data.token;
  } catch {
    return null;
  }
}

/** Interroge NOWPayments pour l'état réel d'un paiement. */
export async function getPayment(
  paymentId: string,
): Promise<PaymentStatusResponse | null> {
  const apiKey = nowPaymentsApiKey();
  if (!apiKey || !paymentId) return null;

  try {
    const token = await nowPaymentsJwt();
    const response = await fetch(
      `${nowPaymentsApiBase()}/payment/${encodeURIComponent(paymentId)}`,
      {
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!response.ok) return null;
    return (await response.json()) as PaymentStatusResponse;
  } catch {
    return null;
  }
}

/* ---------------- Vérification des IPN ---------------- */

/** Trie récursivement les clés d'un objet (exigé par NOWPayments). */
function sortKeysDeep<T>(value: T): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>;
    return Object.keys(source)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortKeysDeep(source[key]);
        return acc;
      }, {});
  }
  return value;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  return timingSafeEqual(bufA, bufB);
}

/**
 * Vérifie la signature HMAC-SHA512 d'une notification IPN.
 * NOWPayments hache le corps JSON dont les clés sont triées
 * alphabétiquement (y compris les objets imbriqués), avec la clé
 * secrète IPN. On teste aussi le corps brut tel quel en repli.
 */
export function verifyIpnSignature(
  rawBody: string,
  signature: string | null,
): boolean {
  const secret = nowPaymentsIpnSecret();
  if (!secret || !signature) return false;

  const candidates: string[] = [rawBody];
  try {
    const parsed: unknown = JSON.parse(rawBody);
    candidates.unshift(JSON.stringify(sortKeysDeep(parsed)));
  } catch {
    /* corps non JSON — le repli brut reste testé */
  }

  const expected = signature.trim().toLowerCase();
  return candidates.some((candidate) => {
    const hash = createHmac("sha512", secret)
      .update(candidate, "utf8")
      .digest("hex")
      .toLowerCase();
    return constantTimeEqual(hash, expected);
  });
}

/* ---------------- Statuts ---------------- */

/** Statuts NOWPayments considérés comme « paiement reçu » (fonds crédités). */
const PAID_STATUSES = new Set(["finished", "confirmed", "completed"]);
const FAILED_STATUSES = new Set(["failed", "expired", "refunded"]);

export type OrderStatus = "pending" | "paid" | "failed" | "expired";

export function isPaidStatus(status: string): boolean {
  return PAID_STATUSES.has(status.trim().toLowerCase());
}

export function isFailedStatus(status: string): boolean {
  return FAILED_STATUSES.has(status.trim().toLowerCase());
}

/** Traduit un statut IPN brut en statut de commande interne. */
export function orderStatusFromIpn(status: string): OrderStatus {
  const value = status.trim().toLowerCase();
  if (isPaidStatus(value)) return "paid";
  if (value === "expired") return "expired";
  if (value === "failed" || value === "refunded") return "failed";
  return "pending";
}

/** Label affichable d'un statut de commande. */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "En attente",
  paid: "Payé",
  failed: "Échoué",
  expired: "Expiré",
};
