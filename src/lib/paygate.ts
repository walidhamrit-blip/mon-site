// Client serveur de la passerelle Carte Bancaire → USDC Polygon (PayGate.to).
//
// Fonctionne 100 % sur Vercel Serverless (requêtes HTTPS sortantes courtes +
// webhook GET signé RSA-SHA256 entrant), sans daemon, sans VPS, et sans KYB :
// PayGate.to encaisse le client en Fiat (Visa, Mastercard, Apple Pay, Google
// Pay, SEPA) via son agrégateur et transfère automatiquement les USDC (Polygon)
// directement vers le portefeuille non-custodial du marchand (`0x…`).

import { createHmac } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { orders, paygatePayments, type Order, type PayGatePayment } from "@/db/schema";
import {
  DEFAULT_PAYGATE_API_DOMAIN,
  FALLBACK_PAYGATE_RAW_PROVIDERS,
  buildFirstPartyPayGateUrl,
  buildPayGateCallbackUrl,
  buildPayGateCheckoutUrl,
  calculatePayGateCardQuote,
  extractProcessorRedirectUrl,
  formatPayGateAmount,
  isPayGateSharedDomain,
  isUsdStablecoinTicker,
  normalizePayGateConfig,
  normalizePayGateProvider,
  normalizePayGateProviders,
  payGateEncode,
  payGateKeepEncoded,
  payGateReady,
  publicPayGateOption,
  resolveEffectiveCloakMode,
  signPayGateCheckoutToken,
  verifyPayGateCheckoutToken,
  type PayGateCardQuote,
  type PayGateConfigData,
  type PayGateProviderOption,
  type PublicPayGateOption,
} from "@/lib/paygate-core";
import { getSiteData } from "@/lib/store";
import {
  claimProviderBudget,
  claimProviderSync,
  releaseProviderSync,
} from "@/lib/provider-budget";
import { enqueueDelivery, runDeliveryQueue } from "@/lib/delivery-queue";
import { sendPaymentConfirmedEmail } from "@/lib/order-emails";

export class PayGateError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = "PayGateError";
    this.code = code;
    this.status = status;
  }
}

export function isPayGateError(error: unknown): error is PayGateError {
  return error instanceof PayGateError;
}

/**
 * Fusionne la configuration enregistrée dans `/admin/settings` avec les
 * éventuelles variables d'environnement (`PAYGATE_USDC_POLYGON_WALLET`, etc.),
 * puis re-normalise strictement (un wallet invalide ou contrat USDC est
 * systématiquement rejeté).
 */
export function mergePayGateConfigWithEnv(
  stored: Partial<PayGateConfigData> | null | undefined,
): PayGateConfigData {
  const base = normalizePayGateConfig(stored);
  const envWallet = process.env.PAYGATE_USDC_POLYGON_WALLET?.trim() || "";
  const envEnabledRaw = process.env.PAYGATE_ENABLED?.trim().toLowerCase();
  const envMin = process.env.PAYGATE_MIN_ORDER_USD?.trim();
  const envFee = process.env.PAYGATE_FEE_PERCENT?.trim();
  const envRatio = process.env.PAYGATE_MIN_RECEIVED_RATIO?.trim();
  const envProvider = process.env.PAYGATE_PROVIDER?.trim();
  const envCloak = process.env.PAYGATE_CLOAK_MODE?.trim().toLowerCase();
  const envApi = process.env.PAYGATE_API_DOMAIN?.trim();
  const envCheckout = process.env.PAYGATE_CHECKOUT_DOMAIN?.trim();

  const wallet = base.usdcPolygonWallet || envWallet;
  let enabled = base.enabled;
  if (envEnabledRaw === "1" || envEnabledRaw === "true") {
    enabled = true;
  } else if (envEnabledRaw === "0" || envEnabledRaw === "false") {
    enabled = false;
  } else if (!stored?.usdcPolygonWallet && envWallet) {
    // Si le wallet est fourni par variable d'environnement sans surcharge off,
    // on considère la passerelle activée.
    enabled = true;
  }

  return normalizePayGateConfig({
    enabled,
    usdcPolygonWallet: wallet,
    minOrderUsd: envMin ? Number(envMin) : base.minOrderUsd,
    feePercent: envFee ? Number(envFee) : base.feePercent,
    minReceivedRatio: envRatio ? Number(envRatio) : base.minReceivedRatio,
    provider: envProvider !== undefined ? envProvider : base.provider,
    cloakMode: envCloak || base.cloakMode,
    apiDomain: envApi || base.apiDomain,
    checkoutDomain: envCheckout || base.checkoutDomain,
  });
}

export async function resolveLivePayGateConfig(): Promise<PayGateConfigData> {
  try {
    const { config } = await getSiteData();
    return mergePayGateConfigWithEnv(config.paygate);
  } catch {
    return mergePayGateConfigWithEnv(null);
  }
}

export async function getPublicPayGateOption(): Promise<PublicPayGateOption | null> {
  const config = await resolveLivePayGateConfig();
  return publicPayGateOption(config);
}

/**
 * Secret HMAC dédié aux jetons d'URL de callback PayGate (`?order=…&token=…`).
 * Utilise `PAYGATE_CALLBACK_SECRET` s'il fait >= 32 caractères, sinon dérive
 * une clé dédiée (séparation de domaine) depuis `SESSION_SECRET` / `DIGITAL_CODES_SECRET`.
 */
export function payGateCallbackSecret(): string {
  const dedicated = process.env.PAYGATE_CALLBACK_SECRET?.trim() ?? "";
  if (dedicated.length >= 32) return dedicated;

  const baseMaterial =
    process.env.DIGITAL_CODES_SECRET?.trim() ||
    process.env.SESSION_SECRET?.trim() ||
    "";
  if (baseMaterial.length >= 16) {
    return createHmac("sha256", baseMaterial)
      .update("nukhba:paygate-callback-hmac:v1")
      .digest("hex");
  }

  if (process.env.NODE_ENV !== "production") {
    return "dev-only-paygate-callback-secret-not-for-prod-0123456789";
  }

  throw new PayGateError(
    "paygate_secret_missing",
    503,
    "Aucun secret serveur configuré (PAYGATE_CALLBACK_SECRET ou SESSION_SECRET requis).",
  );
}

export interface CreatedPayGateSession {
  orderRef: string;
  checkoutUrl: string;
  callbackUrl: string;
  addressIn: string;
  polygonAddressIn: string;
  ipnToken: string;
  quote: PayGateCardQuote;
}

interface WalletApiResponse {
  address_in?: string;
  polygon_address_in?: string;
  callback_url?: string;
  ipn_token?: string;
  status?: string;
  message?: string;
}

/**
 * Crée une session de paiement par carte chez PayGate.to :
 *  1. Vérifie que la passerelle est active et que le montant atteint `minOrderUsd` ;
 *  2. Appelle `GET /control/wallet.php` pour allouer une adresse Polygon temporaire
 *     unique rattachée à notre callback signé ;
 *  3. Enregistre la session dans `paygate_payments` (nécessaire pour vérifier la
 *     signature RSA-SHA256 au retour) ;
 *  4. Retourne l'URL hébergée `checkout.paygate.to/pay.php` prête à ouvrir.
 */
export async function createPayGateCardSession(input: {
  orderRef: string;
  baseAmountUsd: number;
  customerEmail: string;
  baseOrigin: string;
  locale?: string | null;
  accentColor?: string;
  config?: PayGateConfigData;
}): Promise<CreatedPayGateSession> {
  const config = input.config ?? (await resolveLivePayGateConfig());
  if (!payGateReady(config)) {
    throw new PayGateError(
      "paygate_disabled",
      503,
      "Le paiement par carte bancaire est actuellement désactivé.",
    );
  }

  const email = input.customerEmail.trim();
  if (!email || !email.includes("@")) {
    throw new PayGateError(
      "email_required",
      400,
      "Une adresse e-mail valide est requise pour payer par carte bancaire.",
    );
  }

  if (!Number.isFinite(input.baseAmountUsd) || input.baseAmountUsd <= 0) {
    throw new PayGateError("invalid_amount", 400, "Montant de commande invalide.");
  }

  if (input.baseAmountUsd + 1e-6 < config.minOrderUsd) {
    throw new PayGateError(
      "below_paygate_minimum",
      400,
      `Le paiement par carte bancaire est disponible à partir de ${config.minOrderUsd.toFixed(2)} $.`,
    );
  }

  const quote = calculatePayGateCardQuote(input.baseAmountUsd, config);
  if (!quote) {
    throw new PayGateError("invalid_amount", 400, "Impossible de calculer le montant carte.");
  }

  const secret = payGateCallbackSecret();
  const orderRef = input.orderRef.trim().toUpperCase();
  const callbackUrl = buildPayGateCallbackUrl(input.baseOrigin, orderRef, secret);

  const walletEndpoint =
    `https://${config.apiDomain}/control/wallet.php` +
    `?address=${payGateEncode(config.usdcPolygonWallet)}` +
    `&callback=${payGateEncode(callbackUrl)}`;

  let res: Response;
  try {
    res = await fetch(walletEndpoint, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "Nukhba-PayGate/1.0",
      },
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
  } catch (error) {
    throw new PayGateError(
      "paygate_unreachable",
      502,
      `Impossible de joindre PayGate.to : ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (res.status >= 300 && res.status < 400) {
    throw new PayGateError(
      "paygate_redirect",
      502,
      `PayGate.to a renvoyé une redirection inattendue (HTTP ${res.status}).`,
    );
  }

  const rawText = await res.text();
  let payload: WalletApiResponse | null = null;
  try {
    payload = rawText ? (JSON.parse(rawText) as WalletApiResponse) : null;
  } catch {
    payload = null;
  }

  if (
    !res.ok ||
    !payload ||
    typeof payload.address_in !== "string" ||
    !payload.address_in.trim() ||
    typeof payload.polygon_address_in !== "string" ||
    !payload.polygon_address_in.trim() ||
    typeof payload.ipn_token !== "string" ||
    !payload.ipn_token.trim()
  ) {
    const detail = payload?.message || rawText.slice(0, 180) || `HTTP ${res.status}`;
    throw new PayGateError(
      "paygate_wallet_failed",
      502,
      `PayGate.to a refusé la création de session (${detail}).`,
    );
  }

  const effectiveCloakMode = resolveEffectiveCloakMode(config);
  const checkoutToken = signPayGateCheckoutToken(orderRef, secret);
  const checkoutUrl =
    effectiveCloakMode === "self"
      ? buildFirstPartyPayGateUrl({
          baseOrigin: input.baseOrigin,
          orderRef,
          checkoutToken,
          locale: input.locale,
        })
      : buildPayGateCheckoutUrl({
          addressIn: payload.address_in,
          amountUsd: quote.billedUsd,
          customerEmail: email,
          currency: "USD",
          checkoutDomain: config.checkoutDomain,
          provider: config.provider,
          accentColor: input.accentColor,
        });

  await ensureSchema();
  const now = new Date();
  await db
    .insert(paygatePayments)
    .values({
      orderRef,
      merchantWallet: config.usdcPolygonWallet,
      addressIn: payload.address_in.trim(),
      polygonAddressIn: payload.polygon_address_in.trim(),
      ipnToken: payload.ipn_token.trim(),
      callbackUrl,
      checkoutUrl,
      baseAmountUsd: quote.baseUsd.toFixed(2),
      feePercent: quote.feePercent.toFixed(2),
      billedAmountUsd: quote.billedUsd.toFixed(2),
      minAcceptableUsd: quote.minAcceptableUsd.toFixed(2),
      provider: config.provider || null,
      status: "pending",
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: paygatePayments.orderRef,
      set: {
        merchantWallet: config.usdcPolygonWallet,
        addressIn: payload.address_in.trim(),
        polygonAddressIn: payload.polygon_address_in.trim(),
        ipnToken: payload.ipn_token.trim(),
        callbackUrl,
        checkoutUrl,
        baseAmountUsd: quote.baseUsd.toFixed(2),
        feePercent: quote.feePercent.toFixed(2),
        billedAmountUsd: quote.billedUsd.toFixed(2),
        minAcceptableUsd: quote.minAcceptableUsd.toFixed(2),
        provider: config.provider || null,
        status: "pending",
        updatedAt: now,
      },
    });

  return {
    orderRef,
    checkoutUrl,
    callbackUrl,
    addressIn: payload.address_in.trim(),
    polygonAddressIn: payload.polygon_address_in.trim(),
    ipnToken: payload.ipn_token.trim(),
    quote,
  };
}

export interface PayGateRemoteStatus {
  paid: boolean;
  status: string;
  valueCoin: string;
  txidOut: string;
  coin: string;
}

/**
 * Vérification ponctuelle (`payment-status.php`) en cas de callback retardé.
 * Protégée en amont par `claimProviderSync` + `claimProviderBudget` pour ne
 * jamais saturer l'API PayGate.to.
 */
export async function checkPayGatePaymentStatus(
  ipnToken: string,
  apiDomain = DEFAULT_PAYGATE_API_DOMAIN,
): Promise<PayGateRemoteStatus | null> {
  const token = ipnToken.trim();
  if (!token) return null;
  const url =
    `https://${apiDomain}/control/payment-status.php` +
    `?ipn_token=${payGateKeepEncoded(token)}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "Nukhba-PayGate/1.0",
      },
      redirect: "manual",
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    const status = String(data.status ?? "unpaid").trim().toLowerCase();
    return {
      paid: status === "paid",
      status,
      valueCoin: String(data.value_coin ?? "").trim(),
      txidOut: String(data.txid_out ?? "").trim(),
      coin: String(data.coin ?? "").trim().toLowerCase(),
    };
  } catch {
    return null;
  }
}

export async function getPayGatePaymentByOrderRef(
  orderRef: string,
): Promise<PayGatePayment | null> {
  const clean = orderRef.trim().toUpperCase();
  if (!clean) return null;
  await ensureSchema();
  const [row] = await db
    .select()
    .from(paygatePayments)
    .where(eq(paygatePayments.orderRef, clean))
    .limit(1);
  return row ?? null;
}

/**
 * Réconcilie une commande PayGate en attente lors du suivi client (fallback si
 * le webhook a subi une coupure réseau passagère). Respecte strictement le
 * throttle par commande et le budget global d'appels sortants.
 */
export async function reconcilePayGateOrder(order: Order): Promise<Order> {
  if (order.paymentMethod !== "paygate" || order.status === "paid") {
    return order;
  }

  const syncClaim = await claimProviderSync(order.ref, {
    lastSyncAt: order.lastProviderSyncAt ?? null,
    since: order.createdAt ?? null,
  });
  if (!syncClaim.sync) return order;

  const budget = claimProviderBudget();
  if (!budget.allow) {
    releaseProviderSync(order.ref);
    return order;
  }

  let session: PayGatePayment | null = null;
  let remote: PayGateRemoteStatus | null = null;
  try {
    session = await getPayGatePaymentByOrderRef(order.ref);
    if (!session || !session.ipnToken) return order;

    const config = await resolveLivePayGateConfig();
    remote = await checkPayGatePaymentStatus(session.ipnToken, config.apiDomain);
  } finally {
    releaseProviderSync(order.ref);
  }
  if (!session || !remote || !remote.paid) return order;

  const received = Number(remote.valueCoin);
  const minAcceptable = Number(session.minAcceptableUsd);
  if (
    !isUsdStablecoinTicker(remote.coin) ||
    !Number.isFinite(received) ||
    received + 0.01 < minAcceptable
  ) {
    await db
      .update(paygatePayments)
      .set({
        status: "underpaid",
        valueCoin: remote.valueCoin || null,
        coin: remote.coin || null,
        txidOut: remote.txidOut || null,
        lastDetail: `Statut distant payé mais montant/pièce hors seuil (${remote.valueCoin} ${remote.coin}).`,
        updatedAt: new Date(),
      })
      .where(eq(paygatePayments.orderRef, order.ref))
      .catch(() => null);
    return order;
  }

  const now = new Date();
  await db
    .update(paygatePayments)
    .set({
      status: "paid",
      valueCoin: remote.valueCoin,
      coin: remote.coin,
      txidOut: remote.txidOut || null,
      paidAt: session.paidAt ?? now,
      lastDetail: "Confirmé via payment-status.php (réconciliation).",
      updatedAt: now,
    })
    .where(eq(paygatePayments.orderRef, order.ref));

  const claimed = await db
    .update(orders)
    .set({
      status: "paid",
      ipnStatus: "finished",
      paymentId: remote.txidOut || session.polygonAddressIn,
      payAddress: session.polygonAddressIn,
      payCurrency: remote.coin,
      payAmount: remote.valueCoin,
      updatedAt: now,
    })
    .where(and(eq(orders.id, order.id), eq(orders.status, order.status)))
    .returning();

  const winner = claimed[0];
  if (!winner) {
    const [fresh] = await db.select().from(orders).where(eq(orders.id, order.id)).limit(1);
    return fresh ?? order;
  }

  const { config: siteCfg } = await getSiteData();
  await sendPaymentConfirmedEmail(winner, siteCfg.name, siteCfg.url, siteCfg.email).catch(
    (err) =>
      console.warn(
        "[paygate][reconcile] e-mail confirmation impossible :",
        err instanceof Error ? err.message : err,
      ),
  );

  if (winner.digitalOrderId || winner.kind === "digital") {
    await enqueueDelivery({ id: winner.digitalOrderId, ref: winner.ref }).catch((err) =>
      console.error(
        "[paygate][reconcile] mise en file impossible :",
        err instanceof Error ? err.message : err,
      ),
    );
    await runDeliveryQueue({ limit: 1 }).catch((err) =>
      console.error(
        "[paygate][reconcile] exécution file impossible :",
        err instanceof Error ? err.message : err,
      ),
    );
  }

  return winner;
}

/* ----------- Passerelle Anti-Blocage Antivirus & Redirection Serveur ------ */

let cachedRawProviders: {
  fetchedAt: number;
  rows: ReadonlyArray<Record<string, unknown>>;
} | null = null;
const PROVIDER_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Récupère côté serveur la liste à jour des processeurs carte actifs chez
 * PayGate (`/control/provider-status/`), mise en cache 5 minutes avec repli
 * résilient en cas d'indisponibilité temporaire.
 */
export async function fetchPayGateActiveProviders(
  billedUsd: number,
  config?: PayGateConfigData,
  buyerCountry?: string | null,
): Promise<PayGateProviderOption[]> {
  const cfg = config ?? (await resolveLivePayGateConfig());
  const now = Date.now();

  if (!cachedRawProviders || now - cachedRawProviders.fetchedAt > PROVIDER_CACHE_TTL_MS) {
    try {
      const res = await fetch(`https://${cfg.apiDomain}/control/provider-status/`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "Nukhba-PayGate/1.0",
        },
        redirect: "manual",
        signal: AbortSignal.timeout(4_500),
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json().catch(() => null)) as {
          providers?: Array<Record<string, unknown>>;
        } | null;
        if (data && Array.isArray(data.providers) && data.providers.length > 0) {
          cachedRawProviders = { fetchedAt: now, rows: data.providers };
        }
      }
    } catch {
      /* On conserve l'ancien cache ou la liste de secours ci-dessous */
    }
  }

  const sourceRows = cachedRawProviders?.rows ?? FALLBACK_PAYGATE_RAW_PROVIDERS;
  const normalized = normalizePayGateProviders(sourceRows, billedUsd, { buyerCountry });
  return normalized.length > 0
    ? normalized
    : normalizePayGateProviders(FALLBACK_PAYGATE_RAW_PROVIDERS, billedUsd, { buyerCountry });
}

async function resolveSingleProviderHop(input: {
  upstreamHost: string;
  addressIn: string;
  billedUsd: number;
  providerId: string;
  customerEmail: string;
  buyerCountry: string;
  buyerIp: string;
  userAgent: string;
  acceptLanguage: string;
}): Promise<string | null> {
  let nextUrl =
    `https://${input.upstreamHost}/process-payment.php` +
    `?address=${payGateKeepEncoded(input.addressIn)}` +
    `&amount=${payGateEncode(formatPayGateAmount(input.billedUsd))}` +
    `&provider=${payGateEncode(input.providerId)}` +
    `&email=${payGateEncode(input.customerEmail)}` +
    `&currency=USD`;

  for (let hop = 0; hop < 3; hop++) {
    const headers: Record<string, string> = {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "PGTO-IPCountry": input.buyerCountry || "XX",
      "User-Agent":
        input.userAgent ||
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
    };
    if (input.acceptLanguage) {
      headers["Accept-Language"] = input.acceptLanguage;
    }
    if (input.buyerIp) {
      headers["X-Forwarded-For"] = input.buyerIp;
      headers["X-Real-IP"] = input.buyerIp;
    }

    let res: Response;
    try {
      res = await fetch(nextUrl, {
        method: "GET",
        headers,
        redirect: "manual",
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      });
    } catch {
      return null;
    }

    const location = res.headers.get("location");
    const htmlBody =
      res.status >= 200 && res.status < 300 ? (await res.text().catch(() => "")).slice(0, 65_536) : "";

    const extracted = extractProcessorRedirectUrl({
      status: res.status,
      locationHeader: location,
      htmlBody,
      currentUrl: nextUrl,
    });

    if (extracted.kind === "external_processor") {
      return extracted.url;
    }
    if (extracted.kind === "paygate_hop") {
      nextUrl = extracted.url;
      continue;
    }
    return null;
  }

  return null;
}

/**
 * Résout côté serveur l'URL HTTPS directe du processeur agréé (Wert, MoonPay,
 * Guardarian, Ramp, Transak, Mercuryo…) pour une commande donnée, afin que le
 * navigateur du client ne contacte JAMAIS `*.paygate.to` ni `*.paygate.sbs`.
 */
export async function resolvePayGateProcessorRedirect(input: {
  orderRef: string;
  checkoutToken: string;
  requestedProvider?: string | null;
  buyerCountry?: string | null;
  buyerIp?: string | null;
  userAgent?: string | null;
  acceptLanguage?: string | null;
}): Promise<
  | { ok: true; redirectUrl: string; providerId: string }
  | { ok: false; code: "forbidden" | "not_found" | "already_paid" | "provider_unavailable" }
> {
  const ref = input.orderRef.trim().toUpperCase();
  const secret = payGateCallbackSecret();
  if (!verifyPayGateCheckoutToken(ref, input.checkoutToken, secret)) {
    return { ok: false, code: "forbidden" };
  }

  await ensureSchema();
  const [order] = await db.select().from(orders).where(eq(orders.ref, ref)).limit(1);
  if (!order || order.paymentMethod !== "paygate") {
    return { ok: false, code: "not_found" };
  }
  if (order.status === "paid") {
    return { ok: false, code: "already_paid" };
  }

  const [session] = await db
    .select()
    .from(paygatePayments)
    .where(eq(paygatePayments.orderRef, ref))
    .limit(1);
  if (!session || session.status === "paid") {
    return { ok: false, code: session ? "already_paid" : "not_found" };
  }

  const config = await resolveLivePayGateConfig();
  const billedUsd = Number(session.billedAmountUsd);
  const customerEmail = (order.email ?? "").trim();
  if (!customerEmail || !Number.isFinite(billedUsd) || billedUsd <= 0) {
    return { ok: false, code: "not_found" };
  }

  // Si l'admin a configuré un vrai sous-domaine personnalisé Cloudflare
  // (ex. pay.votredomaine.com), ce sous-domaine n'est PAS partagé avec PayGate :
  // on peut y router directement n'importe quel processeur (y compris widgets embarqués).
  if (!isPayGateSharedDomain(config.checkoutDomain)) {
    const chosen =
      normalizePayGateProvider(input.requestedProvider) ||
      normalizePayGateProvider(config.provider);
    const customUrl = buildPayGateCheckoutUrl({
      addressIn: session.addressIn,
      amountUsd: billedUsd,
      customerEmail,
      currency: "USD",
      checkoutDomain: config.checkoutDomain,
      provider: chosen || undefined,
    });
    return { ok: true, redirectUrl: customUrl, providerId: chosen || "hosted" };
  }

  // Mode "self" (zéro config DNS) : résolution serveur -> redirection directe
  // vers le domaine officiel du processeur (wert.io, moonpay.com, guardarian.com…).
  const country = (input.buyerCountry ?? "XX").trim().toUpperCase().slice(0, 2) || "XX";
  const ip = (input.buyerIp ?? "").split(",")[0]?.trim() ?? "";

  const explicitProvider = normalizePayGateProvider(input.requestedProvider);

  let candidates: string[];
  if (explicitProvider) {
    candidates = [explicitProvider];
  } else if (config.provider) {
    candidates = [config.provider];
  } else {
    const active = await fetchPayGateActiveProviders(billedUsd, config, country);
    const eligibleIds = active.filter((p) => p.eligible).map((p) => p.id);
    candidates = (eligibleIds.length > 0 ? eligibleIds : active.map((p) => p.id)).slice(0, 6);
  }

  for (const providerId of candidates) {
    const redirectUrl = await resolveSingleProviderHop({
      upstreamHost: config.apiDomain || DEFAULT_PAYGATE_API_DOMAIN,
      addressIn: session.addressIn,
      billedUsd,
      providerId,
      customerEmail,
      buyerCountry: country,
      buyerIp: ip,
      userAgent: input.userAgent ?? "",
      acceptLanguage: input.acceptLanguage ?? "",
    });
    if (redirectUrl) {
      return { ok: true, redirectUrl, providerId };
    }
  }

  return { ok: false, code: "provider_unavailable" };
}
