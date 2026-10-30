// Virements NOWPayments (payouts) — brique manquante pour refinancer le solde
// du fournisseur sans intervention humaine.
//
// ⚠️ Ce module DÉPLACE DE L'ARGENT RÉEL. Il n'est appelé que par
// `fazercards-autotopup.ts`, lui-même verrouillé par
// `FAZERCARDS_AUTOTOPUP_ENABLED` (désactivé par défaut) et par le cron
// `?execute=1`. Toute nouvelle fonction doit rester sans effet de bord :
// les seules fonctions qui créent ou valident un virement sont
// `createPayout()` et `verifyPayout()`.
//
// Authentification, telle que documentée par NOWPayments :
//   • `POST /v1/auth` (e-mail + mot de passe) → jeton JWT valable ~5 minutes ;
//   • virements : `x-api-key` + `Authorization: Bearer <JWT>` ;
//   • devis de frais et minimums : `x-api-key` seul.

import { nowPaymentsApiBase, nowPaymentsApiKey, nowPaymentsConfigured, sanitizeSecret } from "./nowpayments";

/** Durée de vie du jeton JWT NOWPayments (~5 min) : on garde une marge. */
const JWT_TTL_MS = 4 * 60 * 1000;

export class NowPaymentsPayoutError extends Error {
  readonly status: number | null;
  readonly body: string;

  constructor(message: string, status: number | null, body = "") {
    super(message);
    this.name = "NowPaymentsPayoutError";
    this.status = status;
    this.body = body;
  }
}

export function isNowPaymentsPayoutError(error: unknown): error is NowPaymentsPayoutError {
  return error instanceof NowPaymentsPayoutError;
}

export function nowPaymentsPayoutErrorMessage(error: unknown): string {
  if (isNowPaymentsPayoutError(error)) {
    return error.status ? `${error.message} (HTTP ${error.status})` : error.message;
  }
  return error instanceof Error ? error.message : String(error);
}

/* ------------------------------ Configuration ------------------------------ */

/** Devise du virement. FazerCards crédite en USDT : on envoie de l'USDT. */
export function nowPaymentsPayoutCurrency(): string {
  return sanitizeSecret(process.env.NOWPAYMENTS_PAYOUT_CURRENCY).toLowerCase() || "usdttrc20";
}

/** Secret TOTP du compte (si la 2FA des virements est en mode application). */
export function nowPaymentsPayoutTotpSecret(): string {
  return sanitizeSecret(process.env.NOWPAYMENTS_PAYOUT_TOTP_SECRET).toUpperCase();
}

function payoutCredentials(): { email: string; password: string } | null {
  const email = process.env.NOWPAYMENTS_EMAIL?.trim() ?? "";
  const password = process.env.NOWPAYMENTS_PASSWORD?.trim() ?? "";
  if (!email || !password) return null;
  return { email, password };
}

/**
 * Un virement exige un jeton JWT, donc l'e-mail et le mot de passe du compte
 * en plus de la clé API. Sans ces identifiants, la recharge automatique ne
 * peut pas fonctionner (le reste de la boutique, si).
 */
export function nowPaymentsPayoutConfigured(): boolean {
  return nowPaymentsConfigured() && payoutCredentials() !== null;
}

/* ------------------------------ Requêtes ------------------------------ */

async function payoutRequest<T>(options: {
  path: string;
  method?: "GET" | "POST";
  body?: unknown;
  jwt?: string;
  timeoutMs?: number;
}): Promise<T> {
  const apiKey = nowPaymentsApiKey();
  if (!apiKey) {
    throw new NowPaymentsPayoutError("NOWPAYMENTS_API_KEY manquant", null);
  }

  const headers: Record<string, string> = {
    "x-api-key": apiKey,
    Accept: "application/json",
  };
  if (options.jwt) headers.Authorization = `Bearer ${options.jwt}`;
  if (options.body) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(`${nowPaymentsApiBase()}${options.path}`, {
      method: options.method ?? "GET",
      headers,
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      cache: "no-store",
      signal: AbortSignal.timeout(options.timeoutMs ?? 20000),
    });
  } catch (error) {
    throw new NowPaymentsPayoutError(
      `NOWPayments injoignable — ${error instanceof Error ? error.message : String(error)}`,
      null,
    );
  }

  const raw = await response.text().catch(() => "");
  if (!response.ok) {
    throw new NowPaymentsPayoutError(
      `NOWPayments ${options.method ?? "GET"} ${options.path} → ${response.status}`,
      response.status,
      raw.slice(0, 500),
    );
  }
  if (!raw.trim()) return {} as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new NowPaymentsPayoutError(
      `Réponse NOWPayments illisible (${options.path})`,
      response.status,
      raw.slice(0, 300),
    );
  }
}

/* ------------------------------ Jeton JWT ------------------------------ */

interface JwtCacheEntry {
  token: string;
  fetchedAt: number;
}

let jwtCache: JwtCacheEntry | null = null;

/** Vide le cache (après un 401, ou depuis l'administration). */
export function invalidateNowPaymentsJwtCache(): void {
  jwtCache = null;
}

async function payoutJwt(): Promise<string> {
  if (jwtCache && Date.now() - jwtCache.fetchedAt < JWT_TTL_MS) return jwtCache.token;

  const credentials = payoutCredentials();
  if (!credentials) {
    throw new NowPaymentsPayoutError(
      "NOWPAYMENTS_EMAIL / NOWPAYMENTS_PASSWORD manquants — un virement exige un jeton JWT",
      null,
    );
  }

  const payload = await payoutRequest<{ token?: string }>({
    method: "POST",
    path: "/auth",
    body: { email: credentials.email, password: credentials.password },
    timeoutMs: 15000,
  });
  if (!payload.token) {
    throw new NowPaymentsPayoutError("NOWPayments n'a pas renvoyé de jeton JWT", null);
  }
  jwtCache = { token: payload.token, fetchedAt: Date.now() };
  return payload.token;
}

/* ------------------------------ Lectures ------------------------------ */

/** Nombre lu dans une réponse pouvant être un nombre ou une chaîne. */
function toNumber(value: unknown): number | null {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
}

/**
 * Solde disponible en custody pour une devise (ex. `usdttrc20`).
 * C'est le SEUL argent qu'un payout peut envoyer : les ventes y arrivent
 * tant qu'aucune adresse de règlement externe n'est configurée.
 */
export async function getCustodyBalance(currency = nowPaymentsPayoutCurrency()): Promise<number | null> {
  const jwt = await payoutJwt();
  const payload = await payoutRequest<Record<string, unknown>>({
    path: "/balance",
    jwt,
  });
  const entry = payload[currency] ?? payload[currency.toUpperCase()];
  if (entry == null) {
    // Forme alternative : { balances: { usdttrc20: "12.5" } }
    const nested = payload.balances as Record<string, unknown> | undefined;
    const fromNested = nested?.[currency];
    return toNumber(fromNested);
  }
  if (typeof entry === "object") {
    return toNumber((entry as Record<string, unknown>).amount);
  }
  return toNumber(entry);
}

export interface PayoutFeeQuote {
  currency: string;
  amountUsd: number;
  /** Frais réseau estimés, dans la devise envoyée (≈ USD pour un stablecoin). */
  feeUsd: number | null;
}

/** Devis du frais réseau d'un virement — aucun argent ne bouge. */
export async function getPayoutFee(
  amount: number,
  currency = nowPaymentsPayoutCurrency(),
): Promise<PayoutFeeQuote> {
  const query = new URLSearchParams({ currency, amount: String(amount) });
  const payload = await payoutRequest<Record<string, unknown>>({
    path: `/payout/fee?${query.toString()}`,
  });
  const direct = toNumber(payload.fee);
  if (direct != null) return { currency, amountUsd: amount, feeUsd: direct };

  const perCurrency = payload[currency];
  if (perCurrency != null && typeof perCurrency === "object") {
    const fee = toNumber((perCurrency as Record<string, unknown>).fee);
    if (fee != null) return { currency, amountUsd: amount, feeUsd: fee };
  }
  return { currency, amountUsd: amount, feeUsd: toNumber(perCurrency) };
}

/** Montant minimal accepté par NOWPayments pour cette devise (indicatif). */
export async function getMinPayoutAmount(currency = nowPaymentsPayoutCurrency()): Promise<number | null> {
  const payload = await payoutRequest<Record<string, unknown>>({
    path: `/payout-withdrawal/min-amount/${encodeURIComponent(currency)}`,
  });
  return (
    toNumber(payload.min_amount) ??
    toNumber(payload.result) ??
    toNumber(payload.minAmount) ??
    toNumber(payload.amount)
  );
}

export interface CreatedPayout {
  id: string;
  status: string;
  /** Vrai si aucun code 2FA n'est requis (2FA désactivée sur le compte). */
  awaitingVerification: boolean;
}

/**
 * Crée le virement. `amount` est le montant **effectivement débité** du solde
 * custody : les frais réseau s'y ajoutent côté destinataire, d'où la marge de
 * sécurité appliquée par l'appelant.
 */
export async function createPayout(input: {
  address: string;
  amount: number;
  currency?: string;
  /** Identifiant unique côté marchand : évite un doublon en cas de rejeu. */
  uniqueId?: string;
  ipnCallbackUrl?: string;
}): Promise<CreatedPayout> {
  const currency = input.currency ?? nowPaymentsPayoutCurrency();
  const jwt = await payoutJwt();
  const payload = await payoutRequest<Record<string, unknown>>({
    method: "POST",
    path: "/payout",
    jwt,
    timeoutMs: 25000,
    body: {
      ...(input.ipnCallbackUrl ? { ipn_callback_url: input.ipnCallbackUrl } : {}),
      withdrawals: [
        {
          address: input.address,
          currency,
          amount: Number(input.amount.toFixed(6)),
          ...(input.uniqueId ? { unique_id: input.uniqueId } : {}),
        },
      ],
    },
  });

  const id = String(payload.id ?? payload.withdrawal_id ?? payload.batch_withdrawal_id ?? "");
  if (!id) {
    throw new NowPaymentsPayoutError(
      "NOWPayments n'a pas renvoyé d'identifiant de virement",
      null,
      JSON.stringify(payload).slice(0, 300),
    );
  }
  const status = String(payload.status ?? "waiting");
  return { id, status, awaitingVerification: status === "waiting" };
}

/** Valide le virement avec un code 2FA (TOTP ou code reçu par e-mail). */
export async function verifyPayout(payoutId: string, code: string): Promise<{ status: string }> {
  const jwt = await payoutJwt();
  const payload = await payoutRequest<Record<string, unknown>>({
    method: "POST",
    path: `/payout/${encodeURIComponent(payoutId)}/verify`,
    jwt,
    body: { verification_code: code },
  });
  return { status: String(payload.status ?? "processing") };
}

export interface PayoutStatus {
  id: string;
  status: string;
}

export async function getPayoutStatus(payoutId: string): Promise<PayoutStatus> {
  const jwt = await payoutJwt();
  const payload = await payoutRequest<Record<string, unknown>>({
    path: `/payout/${encodeURIComponent(payoutId)}`,
    jwt,
  });
  return { id: String(payload.id ?? payoutId), status: String(payload.status ?? "unknown") };
}
