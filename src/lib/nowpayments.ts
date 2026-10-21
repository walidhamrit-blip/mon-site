// Client NOWPayments — côté serveur uniquement.
// Documentation : https://nowpayments.io/documentation
//
// La clé API ne quitte jamais le serveur : toutes les requêtes vers
// NOWPayments partent d'ici (routes API), jamais du navigateur.

import { createHmac, timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";

const PROD_API = "https://api.nowpayments.io/v1";
const SANDBOX_API = "https://api-sandbox.nowpayments.io/v1";

/**
 * Assainit un secret copié-collé depuis un tableau de bord : retire les
 * guillemets englobants (« "… », « '… »), les espaces et les retours à la
 * ligne. Une clé NOWPayments ne contient aucun de ces caractères — ils ne
 * peuvent provenir que d'un copier-coller malpropre, cause classique d'un
 * refus « Invalid api key » (403) alors que la clé semble correcte.
 */
export function sanitizeSecret(value: string | undefined | null): string {
  let cleaned = (value ?? "").trim();
  while (
    cleaned.length >= 2 &&
    ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
      (cleaned.startsWith("'") && cleaned.endsWith("'")))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned.replace(/\s+/g, "");
}

/** Clé API du marchand (Settings → API keys dans le tableau NOWPayments). */
export function nowPaymentsApiKey(): string {
  return sanitizeSecret(process.env.NOWPAYMENTS_API_KEY);
}

/** Vrai si l'intégration est prête (clé API renseignée). */
export function nowPaymentsConfigured(): boolean {
  return nowPaymentsApiKey().length > 0;
}

/** Clé secrète utilisée pour vérifier les signatures IPN. */
export function nowPaymentsIpnSecret(): string {
  return sanitizeSecret(process.env.NOWPAYMENTS_IPN_SECRET) || nowPaymentsApiKey();
}

/**
 * Vrai si l'API sandbox est visée. Valeur assainie : « true », « 1 » et
 * « yes » (casse et guillemets indifférents) activent le bac à sable.
 * ⚠️ Les clés sandbox et production sont séparées et NON interchangeables :
 * une clé de production envoyée à l'API sandbox (et inversement) est
 * refusée avec `403 · INVALID_API_KEY`.
 */
export function nowPaymentsSandbox(): boolean {
  const raw = sanitizeSecret(process.env.NOWPAYMENTS_SANDBOX).toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

export function nowPaymentsApiBase(): string {
  // Repli serveur (tests d'intégration / proxy interne) — non exposée
  // au navigateur ; jamais renseignée en production.
  const override = process.env.NOWPAYMENTS_API_BASE?.trim();
  if (override) return override.replace(/\/+$/, "");
  return nowPaymentsSandbox() ? SANDBOX_API : PROD_API;
}

/** Devise fiat de facturation (NOWPayments ne supporte pas la Livre libyenne). */
export function nowPaymentsFiatCurrency(): string {
  return (process.env.NOWPAYMENTS_CURRENCY?.trim() || "usd").toLowerCase();
}

/* ------------- Validation réelle de la clé API ------------- */

export interface NowPaymentsApiKeyCheck {
  /** true = clé acceptée ; false = clé refusée/absente ; null = injoignable. */
  valid: boolean | null;
  /** Code HTTP renvoyé par NOWPayments (null si non applicable). */
  status: number | null;
  /** Corps exact du refus NOWPayments (ou erreur réseau), sans aucun secret. */
  error: string | null;
}

/**
 * Teste la clé API en réel via `GET /currencies` (endpoint authentifié,
 * sans créer de facture ni de paiement). C'est le seul moyen de distinguer
 * « passerelle joignable » (`GET /status` est public et ne dit rien sur la
 * clé) de « clé acceptée par CET environnement » (sandbox ou production).
 */
export async function checkNowPaymentsApiKey(): Promise<NowPaymentsApiKeyCheck> {
  const apiKey = nowPaymentsApiKey();
  if (!apiKey) {
    return { valid: false, status: null, error: "NOWPAYMENTS_API_KEY manquant" };
  }
  try {
    const response = await fetch(`${nowPaymentsApiBase()}/currencies`, {
      method: "GET",
      headers: { "x-api-key": apiKey },
      cache: "no-store",
      signal: AbortSignal.timeout(7000),
    });
    if (response.ok) return { valid: true, status: response.status, error: null };
    const body = (await response.text().catch(() => "")).slice(0, 300);
    return {
      valid: false,
      status: response.status,
      error: body || `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      valid: null,
      status: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/* ------------- Erreurs structurées (cause exacte) ------------- */

/**
 * Erreur NOWPayments enrichie : porte le code HTTP et le corps brut
 * renvoyé par la passerelle, pour afficher la cause exacte dans le
 * dialogue de paiement et dans les réponses `/api/payments/create`.
 */
export class NowPaymentsError extends Error {
  /** Code HTTP renvoyé par NOWPayments (null = erreur réseau/timeout). */
  readonly status: number | null;
  /** Corps brut de la réponse NOWPayments (le message d'erreur réel). */
  readonly body: string;

  constructor(message: string, status: number | null, body = "") {
    super(message);
    this.name = "NowPaymentsError";
    this.status = status;
    this.body = body;
  }
}

export function isNowPaymentsError(error: unknown): error is NowPaymentsError {
  return error instanceof NowPaymentsError;
}

/* ------------- Création de facture (page de paiement hébergée) ------------- */

export interface CreateInvoiceInput {
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

export interface CreatedInvoice {
  /** Identifiant NOWPayments de la facture (le « iid » de l'URL). */
  id: string | number;
  order_id?: string;
  order_description?: string;
  price_amount?: number;
  price_currency?: string;
  /** URL de la page de paiement hébergée par NOWPayments. */
  invoice_url: string;
  ipn_callback_url?: string;
  success_url?: string;
  cancel_url?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Crée une facture NOWPayments : le client est redirigé vers la page
 * hébergée `invoice_url`, y choisit sa cryptomonnaie et paie.
 *
 * C'est volontairement l'endpoint `/invoice` (et non `/payment`) :
 *  - `/payment` exige une `pay_currency` fixée d'avance et ne fournit
 *    AUCUNE page hébergée ni URL de retour — la création échouait avec
 *    un simple montant fiat + URLs de succès ;
 *  - `/invoice` accepte `success_url`/`cancel_url`/`ipn_callback_url`
 *    et renvoie `invoice_url`, la page où le client paie.
 *
 * Le `payment_id` proprement dit n'existe qu'une fois le paiement
 * engagé par le client : il nous parvient via l'IPN (voir
 * /api/payments/ipn), qui l'enregistre sur la commande.
 */
export async function createInvoice(
  input: CreateInvoiceInput,
): Promise<CreatedInvoice> {
  const apiKey = nowPaymentsApiKey();
  if (!apiKey) {
    throw new NowPaymentsError("NOWPAYMENTS_API_KEY manquant", null);
  }

  let response: Response;
  try {
    response = await fetch(`${nowPaymentsApiBase()}/invoice`, {
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
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new NowPaymentsError(
      `NOWPayments injoignable — ${detail}`,
      null,
      detail,
    );
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new NowPaymentsError(
      `NOWPayments create invoice ${response.status} — ${detail.slice(0, 300)}`,
      response.status,
      detail.slice(0, 300),
    );
  }

  const invoice = (await response.json()) as CreatedInvoice;
  if (!invoice.invoice_url) {
    throw new NowPaymentsError(
      "NOWPayments n'a pas renvoyé invoice_url",
      response.status,
      JSON.stringify(invoice).slice(0, 300),
    );
  }
  return invoice;
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

/**
 * Statuts NOWPayments considérés comme « paiement terminé ».
 * `confirmed` et `sending` restent volontairement `pending` côté site :
 * la blockchain a confirmé le dépôt, mais NOWPayments n'a pas encore
 * terminé le règlement vers le marchand (`finished`).
 */
const PAID_STATUSES = new Set(["finished", "completed"]);
const FAILED_STATUSES = new Set(["failed", "expired", "refunded"]);

export type OrderStatus = "pending" | "paid" | "failed" | "expired";

const ORDER_STATUSES = new Set<string>([
  "pending",
  "paid",
  "failed",
  "expired",
]);

function normalizeOrderStatus(status: string): OrderStatus {
  const value = status.trim().toLowerCase();
  return ORDER_STATUSES.has(value) ? (value as OrderStatus) : "pending";
}

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

/**
 * Résout une transition sans jamais dégrader silencieusement une
 * commande déjà payée sur une notification tardive/désordonnée.
 *
 * - `paid` est terminal, sauf remboursement explicite (`refunded`) ;
 * - un vrai `finished` peut faire passer `pending`, `failed` ou
 *   `expired` à `paid` (fonds effectivement reçus) ;
 * - `failed`/`expired` ne reviennent pas à `pending` tout seuls : seule
 *   la création explicite d'une nouvelle facture relance la commande.
 */
export function nextOrderStatus(
  currentStatus: string,
  rawStatus: string,
): OrderStatus {
  const current = normalizeOrderStatus(currentStatus);
  const raw = rawStatus.trim().toLowerCase();
  const incoming = orderStatusFromIpn(raw);

  if (current === "paid") {
    return raw === "refunded" ? "failed" : "paid";
  }
  if (incoming === "paid") return "paid";
  if (current === "failed" || current === "expired") return current;
  return incoming;
}

/* ----------- Contrôle montant/devise avant « paid » ----------- */

function numericValue(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export interface PaidAmountValidation {
  ok: boolean;
  /** Code machine de l'écart, destiné aux journaux. */
  reason: string | null;
}

/**
 * Vérifie qu'un statut « terminé » correspond bien au montant et à la
 * devise facturés pour CETTE commande. La signature IPN prouve l'origine
 * de la notification ; ce contrôle évite de valider une commande sur un
 * paiement d'un autre montant (ou sous-payé) rattaché par erreur.
 */
export function validatePaidAmount(
  expected: { amountUsd: string | number; currency: string },
  payload: {
    price_amount?: unknown;
    price_currency?: unknown;
    pay_amount?: unknown;
    actually_paid?: unknown;
  },
): PaidAmountValidation {
  const expectedAmount = numericValue(expected.amountUsd);
  if (expectedAmount === null || expectedAmount <= 0) {
    return { ok: false, reason: "expected_amount_invalid" };
  }

  const reportedAmount = numericValue(payload.price_amount);
  if (reportedAmount === null) {
    return { ok: false, reason: "missing_price_amount" };
  }
  const tolerance = Math.max(0.01, expectedAmount * 0.001);
  if (Math.abs(reportedAmount - expectedAmount) > tolerance) {
    return { ok: false, reason: "price_amount_mismatch" };
  }

  const reportedCurrency =
    typeof payload.price_currency === "string"
      ? payload.price_currency.trim().toLowerCase()
      : "";
  if (!reportedCurrency) {
    return { ok: false, reason: "missing_price_currency" };
  }
  if (reportedCurrency !== expected.currency.trim().toLowerCase()) {
    return { ok: false, reason: "price_currency_mismatch" };
  }

  // Quand les deux montants crypto sont fournis, le montant réellement
  // reçu doit couvrir le montant demandé (1 % de tolérance d'arrondi).
  const payAmount = numericValue(payload.pay_amount);
  const actuallyPaid = numericValue(payload.actually_paid);
  if (payAmount !== null && payAmount > 0 && actuallyPaid !== null) {
    if (actuallyPaid < payAmount * 0.99) {
      return { ok: false, reason: "actually_paid_insufficient" };
    }
  }

  return { ok: true, reason: null };
}

/** Label affichable d'un statut de commande. */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "En attente",
  paid: "Payé",
  failed: "Échoué",
  expired: "Expiré",
};

/* ---------------- Abonnements (plans & abonnés) ---------------- */

export interface CreateSubscriptionPlanInput {
  title: string;
  /** Durée d'un cycle en jours (30 = mensuel, 365 = annuel). */
  intervalDay: number;
  /** Montant par cycle, en fiat (ex. 10 pour 10 USD). */
  amount: number;
  currency?: string;
  ipnCallbackUrl?: string;
  successUrl?: string;
  cancelUrl?: string;
  partiallyPaidUrl?: string;
}

export interface SubscriptionPlanRecord {
  id: string | number;
  title?: string;
  interval_day?: string | number;
  amount?: number | string;
  currency?: string;
  ipn_callback_url?: string;
  success_url?: string;
  cancel_url?: string;
  partially_paid_url?: string;
}

/**
 * En-têtes d'authentification des endpoints « abonnements ». La clé API
 * suffit pour la lecture ; la création et la modification d'un plan
 * acceptent aussi un jeton JWT (identifiants e-mail/mot de passe), envoyé
 * en `Authorization: Bearer` quand il est disponible.
 */
async function subscriptionHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "x-api-key": nowPaymentsApiKey(),
    "Content-Type": "application/json",
  };
  const jwt = await nowPaymentsJwt();
  if (jwt) headers.Authorization = `Bearer ${jwt}`;
  return headers;
}

async function nowPaymentsSubscriptionRequest<T>(
  method: "GET" | "POST" | "PATCH",
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  if (!nowPaymentsApiKey()) {
    throw new NowPaymentsError("NOWPAYMENTS_API_KEY manquant", null);
  }

  let response: Response;
  try {
    response = await fetch(`${nowPaymentsApiBase()}${path}`, {
      method,
      headers: await subscriptionHeaders(),
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new NowPaymentsError(
      `NOWPayments injoignable — ${detail}`,
      null,
      detail,
    );
  }

  const text = await response.text().catch(() => "");
  if (!response.ok) {
    throw new NowPaymentsError(
      `NOWPayments ${method} ${path} ${response.status} — ${text.slice(0, 300)}`,
      response.status,
      text.slice(0, 300),
    );
  }
  try {
    return (text ? JSON.parse(text) : {}) as T;
  } catch {
    throw new NowPaymentsError(
      `NOWPayments ${path} : réponse non JSON`,
      response.status,
      text.slice(0, 300),
    );
  }
}

/** Crée un plan d'abonnement chez NOWPayments (`POST /v1/subscriptions/plans`). */
export function createSubscriptionPlan(
  input: CreateSubscriptionPlanInput,
): Promise<SubscriptionPlanRecord> {
  return nowPaymentsSubscriptionRequest<SubscriptionPlanRecord>(
    "POST",
    "/subscriptions/plans",
    {
      title: input.title,
      interval_day: input.intervalDay,
      amount: input.amount,
      currency: input.currency ?? nowPaymentsFiatCurrency(),
      ...(input.ipnCallbackUrl ? { ipn_callback_url: input.ipnCallbackUrl } : {}),
      ...(input.successUrl ? { success_url: input.successUrl } : {}),
      ...(input.cancelUrl ? { cancel_url: input.cancelUrl } : {}),
      ...(input.partiallyPaidUrl
        ? { partially_paid_url: input.partiallyPaidUrl }
        : {}),
    },
  );
}

/**
 * Modifie le montant ou l'intervalle d'un plan. Les nouveaux montants ne
 * touchent que les prochains cycles ; les abonnés déjà payés ne sont pas
 * affectés (règle NOWPayments).
 */
export function updateSubscriptionPlan(
  planId: string,
  input: { amount?: number; intervalDay?: number; title?: string },
): Promise<SubscriptionPlanRecord> {
  return nowPaymentsSubscriptionRequest<SubscriptionPlanRecord>(
    "PATCH",
    `/subscriptions/plans/${encodeURIComponent(planId)}`,
    {
      ...(input.amount !== undefined ? { amount: input.amount } : {}),
      ...(input.intervalDay !== undefined
        ? { interval_day: input.intervalDay }
        : {}),
      ...(input.title ? { title: input.title } : {}),
    },
  );
}

/** Lit un plan (`GET /v1/subscriptions/plans/{id}`). Utile pour vérifier une synchro. */
export function getSubscriptionPlanRemote(
  planId: string,
): Promise<SubscriptionPlanRecord> {
  return nowPaymentsSubscriptionRequest<SubscriptionPlanRecord>(
    "GET",
    `/subscriptions/plans/${encodeURIComponent(planId)}`,
  );
}

export interface CreatedSubscription {
  id: string | number;
  subscription_plan_id?: string | number;
  email?: string;
  status?: string;
  [key: string]: unknown;
}

/**
 * Ajoute un client à un plan (`POST /v1/subscriptions`). NOWPayments envoie
 * au client le lien de facture de la première échéance par e-mail.
 */
export function createSubscription(input: {
  planId: string;
  email: string;
}): Promise<CreatedSubscription> {
  return nowPaymentsSubscriptionRequest<CreatedSubscription>(
    "POST",
    "/subscriptions",
    { subscription_plan_id: input.planId, email: input.email },
  );
}
