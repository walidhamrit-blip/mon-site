// Client FazerCards — côté serveur uniquement.
// Documentation : https://reseller.fazercards.com/en/docs
// Spécification OpenAPI : https://api.fzr.cards/public/docs/openapi.json
//
// FazerCards est un fournisseur direct de codes digitaux (top-ups, cartes
// cadeaux, clés jeux, Steam wallet/gifts, Telegram, services manuels).
// L'authentification se fait par clé API simple (X-API-Key ou Bearer).
// Toutes les requêtes partent du serveur, jamais du navigateur.
//
// ⚠️ La clé API ne quitte JAMAIS le serveur et n'est jamais exposée au
// navigateur. Elle est stockée uniquement dans FAZERCARDS_API_KEY.
//
// Environnement : une seule base URL (pas de sandbox séparé chez FazerCards).
//   https://api.fzr.cards/api/v2
//
// Conventions des réponses :
//   • Succès : { ok: true, ... }
//   • Erreur : { ok: false, error: "message humain", code?: "code_machine" }
//   • Les identifiants publics : commandes ord-…, transactions tx-…

import { sanitizeSecret } from "@/lib/nowpayments";

const FAZERCARDS_BASE = "https://api.fzr.cards/api/v2";

/** Plafond de sécurité d'un achat automatique (USD), surchargeable. */
const DEFAULT_MAX_ORDER_USD = 300;

function envNumber(name: string, fallback: number): number {
  const value = Number(sanitizeSecret(process.env[name]));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Plafond d'un achat automatique : au-delà, livraison manuelle. */
export function fazercardsMaxOrderUsd(): number {
  return envNumber("FAZERCARDS_MAX_ORDER_USD", DEFAULT_MAX_ORDER_USD);
}

export function fazercardsApiKey(): string {
  return sanitizeSecret(process.env.FAZERCARDS_API_KEY);
}

export function fazercardsApiBase(): string {
  const override = process.env.FAZERCARDS_API_BASE?.trim();
  return override ? override.replace(/\/+$/, "") : FAZERCARDS_BASE;
}

/** Vrai si la clé API est présente (l'intégration peut être testée). */
export function fazercardsConfigured(): boolean {
  return fazercardsApiKey().length > 0;
}

/* ------------------------------ Erreurs ------------------------------ */

export class FazercardsError extends Error {
  readonly status: number | null;
  readonly body: string;
  readonly code: string | null;

  constructor(message: string, status: number | null, body = "", code: string | null = null) {
    super(message);
    this.name = "FazercardsError";
    this.status = status;
    this.body = body;
    this.code = code;
  }
}

export function isFazercardsError(error: unknown): error is FazercardsError {
  return error instanceof FazercardsError;
}

export function fazercardsErrorMessage(error: unknown): string {
  if (isFazercardsError(error)) {
    if (error.code) return `${error.message} (${error.code})`;
    return error.message;
  }
  return error instanceof Error ? error.message : String(error);
}

/* ------------------------------ Requêtes ------------------------------ */

interface FazercardsRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
  idempotencyKey?: string;
  timeoutMs?: number;
}

/**
 * Requête authentifiée vers l'API FazerCards.
 *
 * Gère :
 *   • l'en-tête X-API-Key (ou Authorization: Bearer) ;
 *   • l'en-tête Idempotency-Key sur les créations de commande ;
 *   • le détourage des réponses { ok: false } en FazercardsError ;
 *   • le retry avec backoff sur HTTP 429 (rate limit) ;
 *   • les erreurs réseau / timeout.
 */
async function fazercardsRequest<T>(options: FazercardsRequestOptions): Promise<T> {
  const apiKey = fazercardsApiKey();
  if (!apiKey) {
    throw new FazercardsError(
      "FAZERCARDS_API_KEY manquant — configurez la variable d'environnement",
      null,
    );
  }

  const url = `${fazercardsApiBase()}${options.path}`;
  const headers: Record<string, string> = {
    "X-API-Key": apiKey,
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
  };
  const idempotencyKey = options.idempotencyKey;
  if (idempotencyKey) {
    headers["Idempotency-Key"] = idempotencyKey;
  }

  let response: Response;
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    attempts += 1;
    try {
      response = await fetch(url, {
        method: options.method ?? "GET",
        headers,
        ...(options.body ? { body: JSON.stringify(options.body) } : {}),
        cache: "no-store",
        signal: AbortSignal.timeout(options.timeoutMs ?? 20000),
      });
    } catch (error) {
      throw new FazercardsError(
        `FazerCards injoignable — ${error instanceof Error ? error.message : String(error)}`,
        null,
      );
    }

    const raw = await response.text().catch(() => "");

    // Rate limit : retry avec backoff + jitter.
    if (response.status === 429 && attempts < maxAttempts) {
      const retryAfter = response.headers.get("Retry-After");
      const baseMs = retryAfter ? Number(retryAfter) * 1000 : 500 * attempts;
      const jitter = Math.floor(Math.random() * 300);
      await new Promise((resolve) =>
        setTimeout(resolve, baseMs + jitter),
      );
      continue;
    }

    if (!response.ok) {
      let code: string | null = null;
      let message = `FazerCards ${options.method ?? "GET"} ${options.path} → ${response.status}`;
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (typeof parsed.error === "string") message = parsed.error;
        if (typeof parsed.code === "string") code = parsed.code;
      } catch {
        // Corps non JSON : on garde le message par défaut.
      }
      throw new FazercardsError(message, response.status, raw.slice(0, 600), code);
    }

    if (!raw.trim()) return {} as T;
    try {
      return JSON.parse(raw) as T;
    } catch {
      throw new FazercardsError(
        `Réponse FazerCards illisible (${options.path})`,
        response.status,
        raw.slice(0, 300),
      );
    }
  }

  throw new FazercardsError(
    `FazerCards ${options.path} — trop de tentatives (429)`,
    429,
  );
}

/* ------------------------------ Types ------------------------------ */

export interface FazercardsAccount {
  ok: true;
  login: string;
  email: string;
  plan: string;
  planExpiresAt: string;
  planAutoRenew: boolean;
  subscriptionActive: boolean;
  summary: { totalSpent: string; totalOrders: number };
  createdAt: string;
  lastActiveAt: string | null;
}

export interface FazercardsBalance {
  ok: true;
  balance: string;
  currency: "USD";
}

export interface FazercardsTransaction {
  id: string; // tx…
  type: "credit" | "debit";
  status: "completed" | "processing" | "cancelled";
  amount: string;
  balanceBefore: string;
  balanceAfter: string;
  note: string | null;
  createdAt: string;
}

export interface FazercardsTransactionsList {
  ok: true;
  items: FazercardsTransaction[];
  total: number;
  page: number;
  limit: number;
}

export interface FazercardsOrder {
  id: string; // ord-…
  kind: string;
  status: string;
  created_at: string;
  payload?: Record<string, unknown>;
}

export interface FazercardsOrdersList {
  ok: true;
  items: FazercardsOrder[];
  total: number;
  page: number;
  limit: number;
}

/* ------------------------------ Compte / Solde ------------------------------ */

/** Profil du compte revendeur lié à la clé API. */
export async function fazercardsMe(): Promise<FazercardsAccount> {
  return fazercardsRequest<FazercardsAccount>({ path: "/me" });
}

/** Solde du portefeuille USD. */
export async function fazercardsBalance(
  options: { timeoutMs?: number } = {},
): Promise<FazercardsBalance> {
  return fazercardsRequest<FazercardsBalance>({
    path: "/balance",
    ...(options.timeoutMs ? { timeoutMs: options.timeoutMs } : {}),
  });
}

/** Historique des transactions du portefeuille. */
export async function fazercardsTransactions(
  page = 1,
  limit = 20,
): Promise<FazercardsTransactionsList> {
  return fazercardsRequest<FazercardsTransactionsList>(
    { path: `/transactions?page=${Math.max(1, page)}&limit=${Math.min(100, Math.max(1, limit))}` },
  );
}

/* ------------------------------ Commandes ------------------------------ */

/** Liste des commandes du compte. */
export async function fazercardsOrders(
  page = 1,
  limit = 20,
): Promise<FazercardsOrdersList> {
  return fazercardsRequest<FazercardsOrdersList>(
    { path: `/orders?page=${Math.max(1, page)}&limit=${Math.min(100, Math.max(1, limit))}` },
  );
}

/** Détail d'une commande par son identifiant public (ord-…). */
export interface FazercardsOrderDetail {
  ok: true;
  order: FazercardsOrder;
}

export async function fazercardsOrder(
  orderId: string,
): Promise<FazercardsOrderDetail> {
  return fazercardsRequest<FazercardsOrderDetail>({ path: `/orders/${encodeURIComponent(orderId)}` });
}

/* ------------------------------ Top-ups (recharges jeux) ------------------------------ */

export interface FazercardsTopupCategory {
  category_id: string;
  name: string;
  note?: string;
}

export interface FazercardsTopupList {
  ok: true;
  kind: "topup";
  items: FazercardsTopupCategory[];
  meta: { total: number; limit: number; next_cursor: string | null; has_more: boolean };
}

export interface FazercardsTopupOffer {
  offer_id: string;
  name: string;
  price_usd: string;
}

export interface FazercardsTopupField {
  key: string;
  label: string;
  type: string;
}

export interface FazercardsTopupOffers {
  ok: true;
  kind: "topup";
  category_id: string;
  name: string;
  offers: FazercardsTopupOffer[];
  fields: FazercardsTopupField[];
}

export interface FazercardsTopupOrderInput {
  category_id: string;
  offer_id: string;
  fields: Record<string, string | number>;
  idempotencyKey?: string;
}

export interface FazercardsOrderResponse {
  ok: true;
  order: { id: string; kind: string; status: string };
}

/** Liste des catégories de top-ups disponibles. */
export async function fazercardsTopups(limit = 50): Promise<FazercardsTopupList> {
  return fazercardsRequest<FazercardsTopupList>({ path: `/topups?limit=${Math.max(1, Math.min(100, limit))}` });
}

/** Offres et champs acheteur pour une catégorie de top-up. */
export async function fazercardsTopupOffers(
  categoryId: string,
): Promise<FazercardsTopupOffers> {
  return fazercardsRequest<FazercardsTopupOffers>(
    { path: `/topups/offers?category_id=${encodeURIComponent(categoryId)}` },
  );
}

/** Passe une commande de top-up de jeu. */
export async function fazercardsTopupOrder(
  input: FazercardsTopupOrderInput,
): Promise<FazercardsOrderResponse> {
  return fazercardsRequest<FazercardsOrderResponse>({
    method: "POST",
    path: "/topups/order",
    body: {
      category_id: input.category_id,
      offer_id: input.offer_id,
      fields: input.fields,
    },
    idempotencyKey: input.idempotencyKey,
    timeoutMs: 30000,
  });
}

/** Valide un Player ID avant de passer commande (top-ups qui le supportent). */
export interface FazercardsValidateIdItem {
  category_id: string;
  name: string;
  fields: FazercardsTopupField[];
}

export interface FazercardsValidateIdList {
  ok: true;
  kind: "topup";
  items: FazercardsValidateIdItem[];
}

export interface FazercardsValidateIdInput {
  category_id: string;
  fields: Record<string, string | number>;
  idempotencyKey?: string;
}

export interface FazercardsValidateIdResult {
  ok: true;
  category_id: string;
  valid: boolean;
  player_name: string;
  region?: string;
}

/** Liste des jeux supportant la validation d'ID joueur. */
export async function fazercardsValidateIdList(): Promise<FazercardsValidateIdList> {
  return fazercardsRequest<FazercardsValidateIdList>({ path: "/topups/validate-id" });
}

/** Valide un Player ID avant achat. */
export async function fazercardsValidateId(
  input: FazercardsValidateIdInput,
): Promise<FazercardsValidateIdResult> {
  return fazercardsRequest<FazercardsValidateIdResult>({
    method: "POST",
    path: "/topups/validate-id",
    body: { category_id: input.category_id, fields: input.fields },
    idempotencyKey: input.idempotencyKey,
  });
}

/* ------------------------------ Cartes cadeaux ------------------------------ */

export interface FazercardsGiftCardCategory {
  category_id: string;
  name: string;
}

export interface FazercardsGiftCardList {
  ok: true;
  kind: "gift_card";
  items: FazercardsGiftCardCategory[];
  meta: { total: number; limit: number; next_cursor: string | null; has_more: boolean };
}

export interface FazercardsGiftCardOffer {
  card_id: string;
  name: string;
  price_usd: string;
  stock: number;
  min_order_quantity: number;
  max_order_quantity: number;
}

export interface FazercardsGiftCardCards {
  ok: true;
  kind: "gift_card";
  category_id: string;
  name: string;
  offers: FazercardsGiftCardOffer[];
}

export interface FazercardsGiftCardOrderInput {
  category_id: string;
  card_id: string;
  quantity: number;
  idempotencyKey?: string;
}

/** Liste des catégories de cartes cadeaux. */
export async function fazercardsGiftCards(limit = 50): Promise<FazercardsGiftCardList> {
  return fazercardsRequest<FazercardsGiftCardList>({ path: `/giftcards?limit=${Math.max(1, Math.min(100, limit))}` });
}

/** Offres (dénominations) dans une catégorie de carte cadeau. */
export async function fazercardsGiftCardCards(
  categoryId: string,
): Promise<FazercardsGiftCardCards> {
  return fazercardsRequest<FazercardsGiftCardCards>(
    { path: `/giftcards/cards?category_id=${encodeURIComponent(categoryId)}` },
  );
}

/** Passe une commande de carte cadeau. */
export async function fazercardsGiftCardOrder(
  input: FazercardsGiftCardOrderInput,
): Promise<FazercardsOrderResponse> {
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 100) {
    throw new FazercardsError("Quantité hors limites (1 à 100)", null);
  }
  return fazercardsRequest<FazercardsOrderResponse>({
    method: "POST",
    path: "/giftcards/order",
    body: {
      category_id: input.category_id,
      card_id: input.card_id,
      quantity: input.quantity,
    },
    idempotencyKey: input.idempotencyKey,
    timeoutMs: 30000,
  });
}

/* ------------------------------ Clés de jeux ------------------------------ */

export interface FazercardsGameKeyCategory {
  game_id: string;
  name: string;
  region: string;
  platform: string;
  region_restriction: boolean;
}

export interface FazercardsGameKeyList {
  ok: true;
  kind: "game_key";
  items: FazercardsGameKeyCategory[];
  meta: { total: number; limit: number; next_cursor: string | null; has_more: boolean };
}

export interface FazercardsGameKeySku {
  key_id: string;
  name: string;
  price_usd: string;
  stock: number;
  min_order_quantity: number;
  max_order_quantity: number;
}

export interface FazercardsGameKeyKeys {
  ok: true;
  kind: "game_key";
  game_id: string;
  GameName: string;
  region: string;
  platform: string;
  region_restriction: boolean;
  keys: FazercardsGameKeySku[];
}

export interface FazercardsGameKeyRegionRestriction {
  ok: true;
  kind: "game_key";
  game_id: string;
  region_type: string;
  has_availability: boolean;
  available: { code: string; name: string }[];
  unavailable: { code: string; name: string }[];
}

export interface FazercardsGameKeyOrderInput {
  game_id: string;
  key_id: string;
  quantity: number;
  idempotencyKey?: string;
}

/** Liste des catégories de clés de jeux. */
export async function fazercardsGameKeys(limit = 50): Promise<FazercardsGameKeyList> {
  return fazercardsRequest<FazercardsGameKeyList>({ path: `/gamekeys?limit=${Math.max(1, Math.min(100, limit))}` });
}

/** SKU (clés) pour un jeu donné. */
export async function fazercardsGameKeyKeys(gameId: string): Promise<FazercardsGameKeyKeys> {
  return fazercardsRequest<FazercardsGameKeyKeys>(
    { path: `/gamekeys/keys?game_id=${encodeURIComponent(gameId)}` },
  );
}

/** Disponibilité par pays pour un jeu à restriction régionale. */
export async function fazercardsGameKeyRegionRestriction(
  gameId: string,
): Promise<FazercardsGameKeyRegionRestriction> {
  return fazercardsRequest<FazercardsGameKeyRegionRestriction>(
    { path: `/gamekeys/region-restriction?game_id=${encodeURIComponent(gameId)}` },
  );
}

/** Passe une commande de clé de jeu. */
export async function fazercardsGameKeyOrder(
  input: FazercardsGameKeyOrderInput,
): Promise<FazercardsOrderResponse> {
  if (!Number.isInteger(input.quantity) || input.quantity < 1) {
    throw new FazercardsError("Quantité invalide", null);
  }
  return fazercardsRequest<FazercardsOrderResponse>({
    method: "POST",
    path: "/gamekeys/order",
    body: {
      game_id: input.game_id,
      key_id: input.key_id,
      quantity: input.quantity,
    },
    idempotencyKey: input.idempotencyKey,
    timeoutMs: 30000,
  });
}

/* ------------------------------ Steam Top-up ------------------------------ */

export interface FazercardsSteamRates {
  ok: true;
  base: "USD";
  rates: { USD: number; RUB: number; UAH: number; KZT: number };
  updated_at: string;
}

export interface FazercardsSteamCheckLoginInput {
  steamLogin: string;
}

export interface FazercardsSteamCheckLoginResult {
  ok: true;
  can_refill: boolean;
}

export interface FazercardsSteamTopupOrderInput {
  steamLogin: string;
  currency: "USD" | "RUB" | "UAH" | "KZT";
  amount: number | string;
  idempotencyKey?: string;
}

/** Taux de change Steam wallet (USD de base). */
export async function fazercardsSteamTopupRates(): Promise<FazercardsSteamRates> {
  return fazercardsRequest<FazercardsSteamRates>({ path: "/steam-topup/rates" });
}

/** Taux Steam publics (sans clé API). */
export async function fazercardsSteamTopupPublicRates(): Promise<FazercardsSteamRates> {
  return fazercardsRequest<FazercardsSteamRates>({ path: "/steam-topup/public-rates" });
}

/** Vérifie qu'un login Steam peut être rechargé. */
export async function fazercardsSteamCheckLogin(
  input: FazercardsSteamCheckLoginInput,
): Promise<FazercardsSteamCheckLoginResult> {
  return fazercardsRequest<FazercardsSteamCheckLoginResult>({
    method: "POST",
    path: "/steam-topup/check-login",
    body: { steamLogin: input.steamLogin },
  });
}

/** Commande une recharge Steam wallet. */
export async function fazercardsSteamTopupOrder(
  input: FazercardsSteamTopupOrderInput,
): Promise<FazercardsOrderResponse> {
  return fazercardsRequest<FazercardsOrderResponse>({
    method: "POST",
    path: "/steam-topup/order",
    body: {
      steamLogin: input.steamLogin,
      currency: input.currency,
      amount: input.amount,
    },
    idempotencyKey: input.idempotencyKey,
    timeoutMs: 30000,
  });
}

/* ------------------------------ Steam Gifts ------------------------------ */

export interface FazercardsSteamGiftGame {
  name: string;
  appid: number;
}

export interface FazercardsSteamGiftGames {
  ok: true;
  games: FazercardsSteamGiftGame[];
  meta: { total: number; returned: number; truncated: boolean };
}

export interface FazercardsSteamGiftOffer {
  sub_id: number;
  name: string;
  regions: { region: string; price: string }[];
}

export interface FazercardsSteamGiftGameDetail {
  ok: true;
  appid: number;
  offers: FazercardsSteamGiftOffer[];
}

export interface FazercardsSteamGiftOrderInput {
  invite_url: string;
  sub_id: number;
  app_id: number;
  region: string;
  idempotencyKey?: string;
}

/** Liste des jeux Steam cadeaux (catalogue lourd, rate-limited). */
export async function fazercardsSteamGiftGames(limit = 100): Promise<FazercardsSteamGiftGames> {
  return fazercardsRequest<FazercardsSteamGiftGames>(
    { path: `/steam-gifts/games?limit=${Math.max(1, Math.min(1000, limit))}` },
  );
}

/** Offres régionales pour un jeu Steam (appid). */
export async function fazercardsSteamGiftGameDetail(
  appId: number,
): Promise<FazercardsSteamGiftGameDetail> {
  return fazercardsRequest<FazercardsSteamGiftGameDetail>(
    { path: `/steam-gifts/games/${appId}` },
  );
}

/** Commande un cadeau Steam. */
export async function fazercardsSteamGiftOrder(
  input: FazercardsSteamGiftOrderInput,
): Promise<FazercardsOrderResponse> {
  return fazercardsRequest<FazercardsOrderResponse>({
    method: "POST",
    path: "/steam-gifts/order",
    body: {
      invite_url: input.invite_url,
      sub_id: input.sub_id,
      app_id: input.app_id,
      region: input.region,
    },
    idempotencyKey: input.idempotencyKey,
    timeoutMs: 30000,
  });
}

/* ------------------------------ Telegram ------------------------------ */

export interface FazercardsTelegramStars {
  ok: true;
  kind: "telegram_stars";
  price_per_star: string;
  min_amount: number;
  max_amount: number;
  rates_updated_at: string;
}

export interface FazercardsTelegramPremiumPlan {
  months: 3 | 6 | 12;
  price_usd: string;
}

export interface FazercardsTelegramPremium {
  ok: true;
  kind: "telegram_premium";
  plans: FazercardsTelegramPremiumPlan[];
  rates_updated_at: string;
}

export interface FazercardsTelegramStarsBuyInput {
  telegram_username: string;
  quantity: number; // 50–10000
  idempotencyKey?: string;
}

export interface FazercardsTelegramPremiumBuyInput {
  telegram_username: string;
  months: 3 | 6 | 12;
  idempotencyKey?: string;
}

/** Devis Telegram Stars. */
export async function fazercardsTelegramStars(): Promise<FazercardsTelegramStars> {
  return fazercardsRequest<FazercardsTelegramStars>({ path: "/telegram/stars" });
}

/** Devis Telegram Premium. */
export async function fazercardsTelegramPremium(): Promise<FazercardsTelegramPremium> {
  return fazercardsRequest<FazercardsTelegramPremium>({ path: "/telegram/premium" });
}

/** Achète des Telegram Stars. */
export async function fazercardsTelegramStarsBuy(
  input: FazercardsTelegramStarsBuyInput,
): Promise<FazercardsOrderResponse> {
  if (!Number.isInteger(input.quantity) || input.quantity < 50 || input.quantity > 10000) {
    throw new FazercardsError("Quantité hors limites (50 à 10000)", null);
  }
  return fazercardsRequest<FazercardsOrderResponse>({
    method: "POST",
    path: "/telegram/stars/buy",
    body: { telegram_username: input.telegram_username, quantity: input.quantity },
    idempotencyKey: input.idempotencyKey,
    timeoutMs: 30000,
  });
}

/** Achète un abonnement Telegram Premium. */
export async function fazercardsTelegramPremiumBuy(
  input: FazercardsTelegramPremiumBuyInput,
): Promise<FazercardsOrderResponse> {
  return fazercardsRequest<FazercardsOrderResponse>({
    method: "POST",
    path: "/telegram/premium/buy",
    body: { telegram_username: input.telegram_username, months: input.months },
    idempotencyKey: input.idempotencyKey,
    timeoutMs: 30000,
  });
}

/* ------------------------------ Services manuels ------------------------------ */

export interface FazercardsManualService {
  id: string;
  name: string;
  kind: string;
  chat: boolean;
  info: string;
}

export interface FazercardsManualServiceList {
  ok: true;
  items: FazercardsManualService[];
}

export interface FazercardsManualOffer {
  id: string;
  name: string;
  price_usd: string;
  delivery_minutes: number;
}

export interface FazercardsManualServiceOffers {
  ok: true;
  manual_service_id: string;
  category: FazercardsManualService;
  items: FazercardsManualOffer[];
  info: string;
}

export interface FazercardsManualOrderInput {
  manual_service_id: string;
  product_id: string;
  fields?: Record<string, string | number>;
  idempotencyKey?: string;
}

export interface FazercardsManualOrderResponse {
  ok: true;
  order_id: string;
  kind: string;
  status: string;
  category_id: string;
  category_name: string;
  product_id: string;
  product_name: string;
  price_usd: string;
  deadline_at: string | null;
  chat_required: boolean;
  chat_status: string;
}

/** Liste des catégories de services manuels. */
export async function fazercardsManualServices(): Promise<FazercardsManualServiceList> {
  return fazercardsRequest<FazercardsManualServiceList>({ path: "/manual-services" });
}

/** Offres d'un service manuel. */
export async function fazercardsManualServiceOffers(
  manualServiceId: string,
): Promise<FazercardsManualServiceOffers> {
  return fazercardsRequest<FazercardsManualServiceOffers>(
    { path: `/manual-services/${encodeURIComponent(manualServiceId)}/offers` },
  );
}

/** Passe une commande de service manuel. */
export async function fazercardsManualOrder(
  input: FazercardsManualOrderInput,
): Promise<FazercardsManualOrderResponse> {
  return fazercardsRequest<FazercardsManualOrderResponse>({
    method: "POST",
    path: "/manual-services/order",
    body: {
      manual_service_id: input.manual_service_id,
      product_id: input.product_id,
      ...(input.fields ? { fields: input.fields } : {}),
    },
    idempotencyKey: input.idempotencyKey,
    timeoutMs: 30000,
  });
}

/* ------------------------------ Abonnement revendeur ------------------------------ */

export interface FazercardsSubscription {
  ok: true;
  plan: string;
  planExpiresAt: string;
  planAutoRenew: boolean;
  subscriptionActive: boolean;
  currency: "USD";
}

export interface FazercardsSubscriptionPlan {
  plan: "bronze" | "silver" | "gold";
  priceUsd: string;
}

export interface FazercardsSubscriptionPlans {
  ok: true;
  currency: "USD";
  plans: FazercardsSubscriptionPlan[];
}

export interface FazercardsActivationQuote {
  ok: true;
  plan: string;
  listPriceUsd: string;
  chargedAmountUsd: string;
  firstPurchase: boolean;
  currency: "USD";
}

export interface FazercardsSubscriptionActivateInput {
  plan: "bronze" | "silver" | "gold";
}

export interface FazercardsSubscriptionAutoRenewInput {
  planAutoRenew: boolean;
}

/** Abonnement actuel. */
export async function fazercardsSubscription(): Promise<FazercardsSubscription> {
  return fazercardsRequest<FazercardsSubscription>({ path: "/subscription" });
}

/** Plans disponibles (bronze/silver/gold). */
export async function fazercardsSubscriptionPlans(): Promise<FazercardsSubscriptionPlans> {
  return fazercardsRequest<FazercardsSubscriptionPlans>({ path: "/subscription/plans" });
}

/** Devis d'activation avant premier achat. */
export async function fazercardsActivationQuote(plan: string): Promise<FazercardsActivationQuote> {
  return fazercardsRequest<FazercardsActivationQuote>(
    { path: `/subscription/activation-quote?plan=${encodeURIComponent(plan)}` },
  );
}

/** Active l'abonnement depuis le solde USD. */
export async function fazercardsSubscriptionActivate(
  input: FazercardsSubscriptionActivateInput,
): Promise<FazercardsSubscription> {
  return fazercardsRequest<FazercardsSubscription>({
    method: "POST",
    path: "/subscription/activate-from-balance",
    body: { plan: input.plan },
  });
}

/** Active/désactive le renouvellement automatique. */
export async function fazercardsSubscriptionAutoRenew(
  input: FazercardsSubscriptionAutoRenewInput,
): Promise<FazercardsSubscription> {
  return fazercardsRequest<FazercardsSubscription>({
    method: "PATCH",
    path: "/subscription/auto-renew",
    body: { planAutoRenew: input.planAutoRenew },
  });
}

/** Change de plan. */
export async function fazercardsSubscriptionPlan(plan: string): Promise<FazercardsSubscription> {
  return fazercardsRequest<FazercardsSubscription>({
    method: "PATCH",
    path: "/subscription/plan",
    body: { plan },
  });
}

/* ------------------------------ Paiement (rechargement wallet) ------------------------------ */

export interface FazercardsPaymentMethod {
  code: string; // trc20, bep20, ton, aptos, binancepay
  label: string;
  minAmountUsd: number;
  maxAmountUsd: number;
}

export interface FazercardsPaymentMethods {
  ok: true;
  items: FazercardsPaymentMethod[];
}

export interface FazercardsPaymentCreateInput {
  method: string;
  amount: number; // USD
}

export interface FazercardsPayment {
  id: string; // tx…
  network: string;
  amount: string;
  uniqueAmount: string | null;
  address: string;
  memo: string | null;
  binanceId: string | null;
  displayName: string | null;
  status: string;
  verifyAttempts: number;
  expiresAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
}

export interface FazercardsPaymentCreateResponse {
  ok: true;
  payment: FazercardsPayment;
}

export interface FazercardsPaymentGetResponse {
  ok: true;
  payment: FazercardsPayment;
}

export interface FazercardsPaymentVerifyInput {
  binanceOrderId: string;
}

export interface FazercardsPaymentVerifyResponse {
  ok: true;
  payment: FazercardsPayment;
  verifySuccess: boolean;
  message: string;
}

/** Méthodes de paiement crypto activées. */
export async function fazercardsPaymentMethods(): Promise<FazercardsPaymentMethods> {
  return fazercardsRequest<FazercardsPaymentMethods>({ path: "/payments/methods" });
}

/** Crée une facture de rechargement (méthode + montant USD). */
export async function fazercardsPaymentCreate(
  input: FazercardsPaymentCreateInput,
): Promise<FazercardsPaymentCreateResponse> {
  return fazercardsRequest<FazercardsPaymentCreateResponse>({
    method: "POST",
    path: "/payments/create",
    body: { method: input.method, amount: input.amount },
    timeoutMs: 30000,
  });
}

/** Statut d'un paiement. */
export async function fazercardsPaymentGet(paymentId: string): Promise<FazercardsPaymentGetResponse> {
  return fazercardsRequest<FazercardsPaymentGetResponse>({
    path: `/payments/${encodeURIComponent(paymentId)}`,
  });
}

/** Vérifie un paiement Binance Pay (binanceOrderId). */
export async function fazercardsPaymentVerify(
  paymentId: string,
  input: FazercardsPaymentVerifyInput,
): Promise<FazercardsPaymentVerifyResponse> {
  return fazercardsRequest<FazercardsPaymentVerifyResponse>({
    method: "POST",
    path: `/payments/${encodeURIComponent(paymentId)}/verify`,
    body: { binanceOrderId: input.binanceOrderId },
  });
}

/* ------------------------------ Vérification de bout en bout ------------------------------ */

/**
 * Vérifie que les identifiants FazerCards sont valides sans rien acheter.
 * Utilisée par l'admin et par /api/health.
 */
export async function checkFazercardsCredentials(
  options: { timeoutMs?: number } = {},
): Promise<{
  configured: boolean;
  valid: boolean | null;
  balance: FazercardsBalance | null;
  error: string | null;
}> {
  if (!fazercardsConfigured()) {
    return {
      configured: false,
      valid: false,
      balance: null,
      error: "FAZERCARDS_API_KEY manquant",
    };
  }
  try {
    const balance = await fazercardsBalance(options);
    return { configured: true, valid: true, balance, error: null };
  } catch (error) {
    const detail = fazercardsErrorMessage(error);
    return {
      configured: true,
      valid: isFazercardsError(error) && error.status && error.status >= 400 ? false : null,
      balance: null,
      error: detail,
    };
  }
}
