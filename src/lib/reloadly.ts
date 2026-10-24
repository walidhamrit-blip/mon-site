// Client Reloadly — côté serveur uniquement.
// Documentation : https://docs.reloadly.com (Gift Cards API).
//
// Reloadly est le fournisseur qui permet de VENDRE À LA COMMANDE : le
// client paie d'abord (NOWPayments), puis notre serveur achète le code
// chez Reloadly avec le solde du compte marchand et livre le code au
// client. Aucun stock n'est acheté à l'avance.
//
// ⚠️ Les identifiants « client id / client secret » ne quittent JAMAIS le
// serveur et ne sont jamais exposés au navigateur. Toutes les requêtes
// partent d'ici (routes API / actions serveur), jamais du client.
//
// Environnements (ils ne sont PAS interchangeables) :
//   • sandbox : https://giftcards-sandbox.reloadly.com (identifiants TEST)
//   • live    : https://giftcards.reloadly.com         (identifiants LIVE)
// Un jeton émis pour un environnement est refusé par l'autre
// (« Service not enabled within domain »).

import { sanitizeSecret } from "@/lib/nowpayments";

export type ReloadlyMode = "sandbox" | "live";

const LIVE_GIFTCARDS = "https://giftcards.reloadly.com";
const SANDBOX_GIFTCARDS = "https://giftcards-sandbox.reloadly.com";
const AUTH_ENDPOINT = "https://auth.reloadly.com/oauth/token";

export const GIFTCARDS_ACCEPT_V1 = "application/com.reloadly.giftcards-v1+json";
export const GIFTCARDS_ACCEPT_V2 = "application/com.reloadly.giftcards-v2+json";

/** Plafond de sécurité d'un achat automatique (USD), surchargeable. */
const DEFAULT_MAX_ORDER_USD = 300;

function envNumber(name: string, fallback: number): number {
  const value = Number(sanitizeSecret(process.env[name]));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Plafond d'un achat automatique : au-delà, validation humaine. */
export function reloadlyMaxOrderUsd(): number {
  return envNumber("RELOADLY_MAX_ORDER_USD", DEFAULT_MAX_ORDER_USD);
}

export function reloadlyClientId(): string {
  return sanitizeSecret(process.env.RELOADLY_CLIENT_ID);
}

export function reloadlyClientSecret(): string {
  return sanitizeSecret(process.env.RELOADLY_CLIENT_SECRET);
}

/**
 * Environnement visé.
 *
 * Par défaut : SANDBOX. C'est un choix de sécurité — un compte marchand
 * mal configuré ne doit jamais dépenser d'argent réel sans que
 * l'exploitant ait explicitement écrit `RELOADLY_SANDBOX=false`.
 */
export function reloadlyMode(): ReloadlyMode {
  const raw = sanitizeSecret(process.env.RELOADLY_SANDBOX).toLowerCase();
  if (["false", "0", "no", "off", "live", "production"].includes(raw)) {
    return "live";
  }
  return "sandbox";
}

/** Base URL Gift Cards de l'environnement courant (surchargeable en test). */
export function reloadlyGiftCardsBase(): string {
  const override = process.env.RELOADLY_API_BASE?.trim();
  if (override) return override.replace(/\/+$/, "");
  return reloadlyMode() === "live" ? LIVE_GIFTCARDS : SANDBOX_GIFTCARDS;
}

/** Audience OAuth du produit Gift Cards (une par environnement). */
export function reloadlyAudience(): string {
  return reloadlyGiftCardsBase();
}

/**
 * Endpoint d'authentification. Surchargeable UNIQUEMENT pour les tests
 * d'intégration internes (`RELOADLY_AUTH_URL`), jamais en production.
 */
export function reloadlyAuthEndpoint(): string {
  const override = process.env.RELOADLY_AUTH_URL?.trim();
  return override || AUTH_ENDPOINT;
}

/** Vrai si les identifiants sont présents (l'intégration peut être testée). */
export function reloadlyConfigured(): boolean {
  return reloadlyClientId().length > 0 && reloadlyClientSecret().length > 0;
}

/** Erreur Reloadly structurée : code HTTP + corps brut (sans secret). */
export class ReloadlyError extends Error {
  readonly status: number | null;
  readonly body: string;

  constructor(message: string, status: number | null, body = "") {
    super(message);
    this.name = "ReloadlyError";
    this.status = status;
    this.body = body;
  }
}

export function isReloadlyError(error: unknown): error is ReloadlyError {
  return error instanceof ReloadlyError;
}

/**
 * Message lisible à partir d'une erreur Reloadly (corps JSON
 * `{message, errorCode, timeStamp}` ou texte brut).
 */
export function reloadlyErrorMessage(error: unknown): string {
  if (isReloadlyError(error)) {
    const body = error.body?.trim();
    if (body) {
      try {
        const parsed = JSON.parse(body) as Record<string, unknown>;
        const message =
          (typeof parsed.message === "string" && parsed.message) ||
          (typeof parsed.error_description === "string" && parsed.error_description) ||
          (typeof parsed.error === "string" && parsed.error) ||
          "";
        const code =
          (typeof parsed.errorCode === "string" && parsed.errorCode) ||
          (typeof parsed.error_code === "string" && parsed.error_code) ||
          "";
        if (message) return code ? `${message} (${code})` : message;
      } catch {
        // Corps non JSON : on le renvoie tronqué.
      }
      return body.slice(0, 300);
    }
    return error.message;
  }
  return error instanceof Error ? error.message : String(error);
}

/* ------------------------------ Jeton OAuth ------------------------------ */

interface TokenCacheEntry {
  token: string;
  expiresAt: number;
}

const tokenCache = new Map<string, TokenCacheEntry>();

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

/**
 * Jeton OAuth client_credentials pour l'environnement courant, mis en
 * cache jusqu'à 5 minutes avant expiration. Reloadly renvoie des jetons
 * très longs (plusieurs semaines) : un cache mémoire suffit.
 */
export async function getReloadlyToken(): Promise<string> {
  const clientId = reloadlyClientId();
  const clientSecret = reloadlyClientSecret();
  if (!clientId || !clientSecret) {
    throw new ReloadlyError("RELOADLY_CLIENT_ID / RELOADLY_CLIENT_SECRET manquants", null);
  }

  const cacheKey = `${reloadlyMode()}:${clientId}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  let response: Response;
  try {
    response = await fetch(reloadlyAuthEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
        audience: reloadlyAudience(),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    throw new ReloadlyError(
      `Reloadly (auth) injoignable — ${error instanceof Error ? error.message : String(error)}`,
      null,
    );
  }

  const body = await response.text().catch(() => "");
  if (!response.ok) {
    throw new ReloadlyError(
      `Reloadly a refusé les identifiants (${response.status})`,
      response.status,
      body.slice(0, 500),
    );
  }

  let data: TokenResponse;
  try {
    data = JSON.parse(body) as TokenResponse;
  } catch {
    throw new ReloadlyError("Réponse d'authentification Reloadly illisible", response.status, body.slice(0, 300));
  }
  if (!data.access_token) {
    throw new ReloadlyError("Reloadly n'a pas renvoyé de jeton", response.status, body.slice(0, 300));
  }

  const lifetimeMs = Math.max(60, (data.expires_in ?? 3600) - 300) * 1000;
  tokenCache.set(cacheKey, { token: data.access_token, expiresAt: Date.now() + lifetimeMs });
  return data.access_token;
}

/** Vide le cache de jetons (tests, changement d'environnement). */
export function resetReloadlyTokenCache(): void {
  tokenCache.clear();
}

/* ---------------------------- Requête authentifiée ---------------------------- */

interface RequestOptions {
  method?: "GET" | "POST";
  path: string;
  body?: unknown;
  accept?: string;
  /** Réponse attendue en texte brut (aucun endpoint actuel, prévu). */
  timeoutMs?: number;
}

async function reloadlyRequest<T>(options: RequestOptions): Promise<T> {
  const token = await getReloadlyToken();
  const url = `${reloadlyGiftCardsBase()}${options.path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: options.accept ?? GIFTCARDS_ACCEPT_V1,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      cache: "no-store",
      signal: AbortSignal.timeout(options.timeoutMs ?? 20000),
    });
  } catch (error) {
    throw new ReloadlyError(
      `Reloadly injoignable — ${error instanceof Error ? error.message : String(error)}`,
      null,
    );
  }

  const raw = await response.text().catch(() => "");
  if (!response.ok) {
    throw new ReloadlyError(
      `Reloadly ${options.method ?? "GET"} ${options.path} → ${response.status}`,
      response.status,
      raw.slice(0, 600),
    );
  }
  if (!raw.trim()) return {} as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new ReloadlyError(
      `Réponse Reloadly illisible (${options.path})`,
      response.status,
      raw.slice(0, 300),
    );
  }
}

/* ------------------------------- Solde du compte ------------------------------- */

export interface ReloadlyBalance {
  balance: number;
  currencyCode: string;
  currencyName: string;
  updatedAt: string | null;
}

export async function reloadlyBalance(): Promise<ReloadlyBalance> {
  const data = await reloadlyRequest<{
    balance?: number;
    currencyCode?: string;
    currencyName?: string;
    updatedAt?: string;
  }>({ path: "/accounts/balance" });
  return {
    balance: Number(data.balance ?? 0),
    currencyCode: String(data.currencyCode ?? ""),
    currencyName: String(data.currencyName ?? ""),
    updatedAt: data.updatedAt ?? null,
  };
}

/* --------------------------------- Catalogue --------------------------------- */

export interface ReloadlyGiftCardProduct {
  productId: number;
  productName: string;
  countryCode: string;
  currencyCode: string;
  brandName: string;
  denominationType: "FIXED" | "RANGE" | string;
  /** Valeurs faciales fixes (unitPrice à transmettre à la commande). */
  fixedDenominations: number[];
  minDenomination: number | null;
  maxDenomination: number | null;
  senderFeePercentage: number;
  discountPercentage: number;
  logoUrls: string[];
  redeemInstruction: string;
  global: boolean;
  status: string;
}

function toNumber(value: unknown): number | null {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

/** Normalise un produit tel que renvoyé par `GET /products`. */
export function normalizeGiftCardProduct(raw: Record<string, unknown>): ReloadlyGiftCardProduct {
  const country = (raw.country ?? {}) as Record<string, unknown>;
  const brand = (raw.brand ?? {}) as Record<string, unknown>;
  const redeem = (raw.redeemInstruction ?? {}) as Record<string, unknown>;
  const fixed = Array.isArray(raw.fixedRecipientDenominations)
    ? raw.fixedRecipientDenominations
        .map((value) => toNumber(value))
        .filter((value): value is number => value != null && value > 0)
    : [];

  return {
    productId: Number(raw.productId ?? 0),
    productName: String(raw.productName ?? ""),
    countryCode: String(raw.countryCode ?? country.isoName ?? "").toUpperCase(),
    currencyCode: String(raw.recipientCurrencyCode ?? "").toUpperCase(),
    brandName: String(brand.brandName ?? ""),
    denominationType: String(raw.denominationType ?? "").toUpperCase(),
    fixedDenominations: fixed,
    minDenomination:
      toNumber(raw.minRecipientDenomination) ?? toNumber(raw.minrecipientDenomination),
    maxDenomination:
      toNumber(raw.maxRecipientDenomination) ?? toNumber(raw.maxrecipientDenomination),
    senderFeePercentage: toNumber(raw.senderFeePercentage) ?? 0,
    discountPercentage: toNumber(raw.discountPercentage) ?? 0,
    logoUrls: toStringArray(raw.logoUrls),
    redeemInstruction: String(redeem.concise ?? redeem.verbose ?? ""),
    global: raw.global === true,
    status: String(raw.status ?? ""),
  };
}

export interface ListProductsInput {
  productName?: string;
  countryCode?: string;
  page?: number;
  size?: number;
}

/**
 * Recherche des produits cadeaux (utile pour retrouver l'ID Reloadly d'une
 * fiche du catalogue). Ne commande rien : lecture seule.
 */
export async function listGiftCardProducts(
  input: ListProductsInput = {},
): Promise<{ products: ReloadlyGiftCardProduct[]; total: number }> {
  const params = new URLSearchParams();
  params.set("page", String(Math.max(1, input.page ?? 1)));
  params.set("size", String(Math.min(200, Math.max(1, input.size ?? 20))));
  if (input.productName?.trim()) params.set("productName", input.productName.trim());
  if (input.countryCode?.trim()) params.set("countryCode", input.countryCode.trim().toUpperCase());

  const data = await reloadlyRequest<{ content?: Record<string, unknown>[]; totalElements?: number }>({
    path: `/products?${params.toString()}`,
  });
  const list = Array.isArray(data.content) ? data.content : [];
  return {
    products: list.map((item) => normalizeGiftCardProduct(item)),
    total: Number(data.totalElements ?? list.length),
  };
}

/** Détail d'un produit cadeau (prix, dénominations, instructions). */
export async function getGiftCardProduct(productId: number): Promise<ReloadlyGiftCardProduct> {
  if (!Number.isInteger(productId) || productId <= 0) {
    throw new ReloadlyError(`Identifiant produit Reloadly invalide : ${productId}`, null);
  }
  const data = await reloadlyRequest<Record<string, unknown>>({ path: `/products/${productId}` });
  return normalizeGiftCardProduct(data);
}

/* --------------------------------- Commandes --------------------------------- */

export type GiftCardOrderKind = "success" | "pending" | "failed" | "unknown";

/**
 * Classe le statut brut d'une transaction Reloadly.
 *  • SUCCESSFUL            → code disponible immédiatement
 *  • PENDING / PROCESSING  → achat accepté, code pas encore émis
 *  • FAILED / REFUNDED     → achat non abouti
 */
export function giftCardStatusKind(status: string | null | undefined): GiftCardOrderKind {
  const value = (status ?? "").trim().toUpperCase();
  if (value === "SUCCESSFUL") return "success";
  if (value === "PENDING" || value === "PROCESSING") return "pending";
  if (value === "FAILED" || value === "REFUNDED") return "failed";
  return "unknown";
}

export interface CreateGiftCardOrderInput {
  productId: number;
  /** Nombre de cartes (1 à 10). */
  quantity: number;
  /** Valeur faciale unitaire dans la devise du produit. */
  unitPrice: number;
  /** Référence unique et stable = clé d'idempotence chez Reloadly. */
  customIdentifier: string;
  senderName: string;
  recipientEmail?: string;
  /** Produits exigeant un identifiant utilisateur (rare). */
  productAdditionalUserId?: string;
}

export interface GiftCardOrderResult {
  transactionId: string;
  status: string;
  kind: GiftCardOrderKind;
  customIdentifier: string;
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  currencyCode: string;
  recipientEmail: string | null;
  transactionCreatedTime: string | null;
  /** Réponse normalisée, journalisable (aucun code carte dedans). */
  raw: Record<string, unknown>;
}

function normalizeOrder(raw: Record<string, unknown>): GiftCardOrderResult {
  const product = (raw.product ?? {}) as Record<string, unknown>;
  const status = String(raw.status ?? "");
  return {
    transactionId: String(raw.transactionId ?? ""),
    status,
    kind: giftCardStatusKind(status),
    customIdentifier: String(raw.customIdentifier ?? ""),
    productId: Number(product.productId ?? 0),
    productName: String(product.productName ?? ""),
    quantity: Number(product.quantity ?? 0),
    unitPrice: Number(product.unitPrice ?? 0),
    totalPrice: Number(product.totalPrice ?? 0),
    currencyCode: String(product.currencyCode ?? "").toUpperCase(),
    recipientEmail:
      typeof raw.recipientEmail === "string" ? raw.recipientEmail : null,
    transactionCreatedTime:
      typeof raw.transactionCreatedTime === "string" ? raw.transactionCreatedTime : null,
    raw,
  };
}

/**
 * Achète un code cadeau (dépense réelle du solde Reloadly en mode live).
 *
 * `customIdentifier` sert de clé d'idempotence : réutiliser la même
 * référence pour un achat déjà effectué est refusé par Reloadly. C'est ce
 * qui empêche un double débit si un webhook est rejoué — l'appelant ne
 * doit donc PAS changer la référence entre deux tentatives.
 */
export async function createGiftCardOrder(
  input: CreateGiftCardOrderInput,
): Promise<GiftCardOrderResult> {
  if (!Number.isInteger(input.productId) || input.productId <= 0) {
    throw new ReloadlyError("productId Reloadly requis", null);
  }
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 10) {
    throw new ReloadlyError("Quantité hors limites (1 à 10)", null);
  }
  if (!Number.isFinite(input.unitPrice) || input.unitPrice <= 0) {
    throw new ReloadlyError("Valeur faciale invalide", null);
  }

  const body: Record<string, unknown> = {
    productId: input.productId,
    quantity: input.quantity,
    unitPrice: input.unitPrice,
    customIdentifier: input.customIdentifier,
    senderName: input.senderName.slice(0, 120),
    ...(input.recipientEmail ? { recipientEmail: input.recipientEmail } : {}),
    ...(input.productAdditionalUserId
      ? { productAdditionalRequirements: { userId: input.productAdditionalUserId } }
      : {}),
    preOrder: false,
  };

  const data = await reloadlyRequest<Record<string, unknown>>({
    method: "POST",
    path: "/orders",
    body,
    timeoutMs: 30000,
  });
  return normalizeOrder(data);
}

export interface GiftCardCode {
  cardNumber: string;
  pinCode: string | null;
  redemptionUrl: string | null;
}

/** Normalise la réponse « cartes » (v1/v2) en une liste de codes. */
export function normalizeGiftCardCodes(raw: unknown): GiftCardCode[] {
  // v1 renvoie un objet, v2 un tableau — certaines réponses enveloppent la
  // liste (`{ cards: [...] }`). Les trois formes sont acceptées.
  const unwrapped =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? ((raw as Record<string, unknown>).cards ??
        (raw as Record<string, unknown>).data ??
        raw)
      : raw;
  const list = Array.isArray(unwrapped) ? unwrapped : unwrapped ? [unwrapped] : [];
  const codes: GiftCardCode[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const cardNumber = record.cardNumber ?? record.card_number ?? record.code;
    if (cardNumber == null || String(cardNumber).trim() === "") continue;
    const pin = record.pinCode ?? record.pin_code ?? record.pin;
    const url = record.redemptionUrl ?? record.redemption_url;
    codes.push({
      cardNumber: String(cardNumber).trim(),
      pinCode: pin == null || String(pin).trim() === "" ? null : String(pin).trim(),
      redemptionUrl:
        url == null || String(url).trim() === "" ? null : String(url).trim(),
    });
  }
  return codes;
}

/**
 * Récupère les codes d'une transaction aboutie.
 * GET /orders/transactions/{transactionId}/cards (Accept v2).
 */
export async function getGiftCardCodes(transactionId: string): Promise<GiftCardCode[]> {
  if (!transactionId?.trim()) {
    throw new ReloadlyError("transactionId Reloadly requis", null);
  }
  const data = await reloadlyRequest<unknown>({
    path: `/orders/transactions/${encodeURIComponent(transactionId.trim())}/cards`,
    accept: GIFTCARDS_ACCEPT_V2,
  });
  return normalizeGiftCardCodes(data);
}

/**
 * Vérification de bout en bout des identifiants : jeton OAuth + solde.
 * N'achète rien. Utilisée par l'admin et par `/api/health`.
 */
export async function checkReloadlyCredentials(): Promise<{
  configured: boolean;
  mode: ReloadlyMode;
  valid: boolean | null;
  balance: ReloadlyBalance | null;
  error: string | null;
}> {
  const mode = reloadlyMode();
  if (!reloadlyConfigured()) {
    return {
      configured: false,
      mode,
      valid: false,
      balance: null,
      error: "RELOADLY_CLIENT_ID / RELOADLY_CLIENT_SECRET manquants",
    };
  }
  try {
    const balance = await reloadlyBalance();
    return { configured: true, mode, valid: true, balance, error: null };
  } catch (error) {
    const detail = reloadlyErrorMessage(error);
    // Le contexte (« Reloadly a refusé les identifiants (401) ») est plus
    // parlant que le seul corps du fournisseur (« Unauthorized »).
    const message =
      isReloadlyError(error) && error.message && !detail.startsWith(error.message)
        ? `${error.message} — ${detail}`
        : detail;
    return {
      configured: true,
      mode,
      valid: isReloadlyError(error) && error.status && error.status >= 400 ? false : null,
      balance: null,
      error: message,
    };
  }
}
