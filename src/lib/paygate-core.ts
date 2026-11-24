// Noyau PUR de la passerelle Carte Bancaire → USDC Polygon (PayGate.to).
//
// Rôle : permettre à un client de payer par Visa, Mastercard, Apple Pay,
// Google Pay ou SEPA sans compte crypto, tandis que l'agence encaisse
// directement et sans garde intermédiaire des USDC (Polygon) sur son propre
// portefeuille non-custodial (0x…), sans KYB ni société enregistrée.
//
// Ce module ne dépend ni de Next.js ni de la base de données : toutes ses
// fonctions sont pures et testables par `node --test`.

import {
  createHmac,
  createPublicKey,
  timingSafeEqual,
  verify as rsaVerify,
  type KeyObject,
} from "node:crypto";
import { Buffer } from "node:buffer";
import { DEFAULT_SITE_ORIGIN } from "./site-identity";

/**
 * Clé publique RSA officielle publiée par PayGate.to ("v1") pour signer les
 * callbacks de confirmation (`X-PayGate-Signature` / `X-PayGate-Key-Id`).
 * Source : https://github.com/paygate-to/paygate-node/blob/main/src/keys.ts
 */
export const PAYGATE_CALLBACK_PUBLIC_KEY_V1 =
  "-----BEGIN PUBLIC KEY-----\n" +
  "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsSTZxO5ze2B2QdkfYUuI\n" +
  "1KgBKcwuKfYq35ktaJFH0m3EfUQhn+6qgTsYHedF/49uFm6UP20tm3/mhwVfcTIa\n" +
  "vdfZhBtcQhyRAa4RDvHlrobZ0y/no99uPqOMLwOCgSRE6LPOpz2hOBM0/p1MX9UV\n" +
  "NiR7XuWDP+JPWEaI0agBK0hEzaEC1foyHv+QgjrM4Mt/1oXl0PDFbP5hVIg6rc7j\n" +
  "q8c4+cyC/iEPWraWnFipBDHA01svSkUoAB8WxlFDwaJ2dh5k1hRlYH2fbZOaGqIh\n" +
  "g1Vxb9qrSEEAZh/PxAtK7NkksvxyPa5eRQpCAyO7LJ2xKOuZ8iFJnI4+iJ76IHRR\n" +
  "TwIDAQAB\n" +
  "-----END PUBLIC KEY-----\n";

/** Paramètres réservés ajoutés par PayGate.to dans la query du callback. */
export const PAYGATE_RESERVED_PARAMS = [
  "value_coin",
  "coin",
  "txid_in",
  "txid_out",
  "address_in",
  "value_forwarded_coin",
  "address_out",
  "pending",
] as const;

/**
 * Adresses des contrats jetons USDC / USDT sur Polygon & Ethereum que des
 * utilisateurs copient parfois par erreur à la place de leur propre wallet :
 * envoyer des fonds dessus les brûlerait définitivement.
 */
const FORBIDDEN_TOKEN_CONTRACTS = new Set([
  "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359", // USDC natif Polygon
  "0x2791bca1f2de4661ed88a30c99a7a9449aa84174", // USDC.e Polygon
  "0xc2132d05d31c914a87c6611c10748aeb04b58e8f", // USDT Polygon
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC Ethereum
  "0xdac17f958d2ee523a2206206994597c13d831ec7", // USDT Ethereum
  "0x0000000000000000000000000000000000000000", // Adresse nulle
]);

export const DEFAULT_PAYGATE_API_DOMAIN = "api.paygate.to";
export const DEFAULT_PAYGATE_CHECKOUT_DOMAIN = "checkout.paygate.sbs";

/**
 * Stratégie d'évitement des blocages antivirus / filtres DNS côté client :
 * - `"self"` (défaut recommandé, zéro configuration DNS) : le client ouvre
 *   uniquement une page hébergée sur VOTRE domaine (`/pay/card/[ref]`), puis
 *   notre serveur résout l'URL du processeur agréé (MoonPay, Wert, Guardarian,
 *   Ramp, Stripe…) et y redirige directement le navigateur sans JAMAIS passer
 *   par `*.paygate.to` ni `*.paygate.sbs`.
 * - `"custom_domain"` : sous-domaine personnalisé relié à un Cloudflare Worker
 *   (ex. `pay.votredomaine.com`), masquant 100 % des pages multi-fournisseurs et
 *   widgets embarqués sous votre propre nom de domaine.
 * - `"direct"` : ouverture directe du domaine amont PayGate (déconseillé : peut
 *   déclencher des alertes Avast / Kaspersky / Bitdefender chez certains clients).
 */
export const PAYGATE_CLOAK_MODES = ["self", "custom_domain", "direct"] as const;
export type PayGateCloakMode = (typeof PAYGATE_CLOAK_MODES)[number];

export interface PayGateConfigData {
  /** Interrupteur global : fermé par défaut tant que le wallet n'est pas saisi. */
  enabled: boolean;
  /** Portefeuille EVM personnel (0x…) qui reçoit les USDC sur Polygon. */
  usdcPolygonWallet: string;
  /** Montant minimum en USD pour proposer le paiement par carte (défaut : 15 $). */
  minOrderUsd: number;
  /** Majoration (%) appliquée au paiement par carte pour absorber les frais processeur. */
  feePercent: number;
  /**
   * Part minimale du total USD de base (entre 0,50 et 1,00) qui doit arriver en
   * stablecoin pour valider automatiquement la commande (défaut : 0,80 = 80 %).
   */
  minReceivedRatio: number;
  /** Vide = sélection multi-fournisseurs, sinon ID fournisseur (`wert`, `moonpay`…). */
  provider: string;
  /** Mode anti-blocage antivirus côté client (`"self"` par défaut). */
  cloakMode: PayGateCloakMode;
  /** Domaine API PayGate ou endpoint dédié anti-DDoS (défaut : `api.paygate.to`). */
  apiDomain: string;
  /** Sous-domaine personnalisé (ex. `pay.votredomaine.com`) ou domaine amont de secours. */
  checkoutDomain: string;
}

export const DEFAULT_PAYGATE_CONFIG: PayGateConfigData = {
  enabled: false,
  usdcPolygonWallet: "",
  minOrderUsd: 15,
  feePercent: 5,
  minReceivedRatio: 0.8,
  provider: "",
  cloakMode: "self",
  apiDomain: DEFAULT_PAYGATE_API_DOMAIN,
  checkoutDomain: DEFAULT_PAYGATE_CHECKOUT_DOMAIN,
};

/**
 * Vrai si le nom d'hôte appartient aux domaines partagés de PayGate susceptibles
 * d'être filtrés par les antivirus grand public (Avast, AVG, Kaspersky, Bitdefender…).
 */
export function isPayGateSharedDomain(hostOrUrl: string): boolean {
  if (!hostOrUrl) return true;
  let host = hostOrUrl.trim().toLowerCase();
  host = host.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  host = host.split("/")[0]?.split(":")[0]?.replace(/\.+$/, "") ?? "";
  if (!host) return true;
  return (
    host === "paygate.to" ||
    host.endsWith(".paygate.to") ||
    host === "paygate.sbs" ||
    host.endsWith(".paygate.sbs") ||
    host === "paygate.one" ||
    host.endsWith(".paygate.one")
  );
}

export function normalizePayGateCloakMode(value: unknown): PayGateCloakMode {
  if (value === "self" || value === "custom_domain" || value === "direct") {
    return value;
  }
  return "self";
}

/**
 * Détermine le mode effectif de protection anti-blocage :
 * - si `cloakMode === "custom_domain"` mais que `checkoutDomain` est encore un
 *   domaine partagé `*.paygate.*`, on bascule automatiquement sur `"self"`
 *   pour ne JAMAIS exposer `*.paygate.*` aux antivirus des clients !
 * - si l'admin a saisi un vrai sous-domaine personnalisé (ex. `pay.votredomaine.com`)
 *   et laissé `cloakMode` en `"custom_domain"`, son sous-domaine est utilisé.
 */
export function resolveEffectiveCloakMode(
  config: Pick<PayGateConfigData, "cloakMode" | "checkoutDomain">,
): PayGateCloakMode {
  const hasCustomDomain =
    Boolean(config.checkoutDomain) && !isPayGateSharedDomain(config.checkoutDomain);
  if (config.cloakMode === "custom_domain") {
    return hasCustomDomain ? "custom_domain" : "self";
  }
  if (config.cloakMode === "direct") {
    return "direct";
  }
  return "self";
}

/** Vue publique minimale envoyée au navigateur (sans jamais exposer le wallet 0x). */
export interface PublicPayGateOption {
  enabled: true;
  minOrderUsd: number;
  feePercent: number;
}

export function isForbiddenTokenContractAddress(address: string): boolean {
  return FORBIDDEN_TOKEN_CONTRACTS.has(address.trim().toLowerCase());
}

/** Vrai uniquement pour une adresse EVM 0x + 40 caractères hexadécimaux valide et non-contrat. */
export function isValidPayGateWallet(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) return false;
  return !isForbiddenTokenContractAddress(trimmed);
}

export function normalizePayGateHost(value: unknown, fallback: string): string {
  if (typeof value !== "string" || !value.trim()) return fallback;
  let host = value.trim().toLowerCase();
  host = host.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  host = host.split("/")[0]?.replace(/\.+$/, "") ?? "";
  if (!/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host)) {
    return fallback;
  }
  return host;
}

export function normalizePayGateProvider(value: unknown): string {
  if (typeof value !== "string") return "";
  const cleaned = value.trim().toLowerCase();
  if (!cleaned || cleaned === "hosted" || cleaned === "multi") return "";
  return /^[a-z0-9_-]{2,40}$/.test(cleaned) ? cleaned : "";
}

/**
 * Normalise une configuration PayGate issue de la base ou d'un formulaire.
 * Si le portefeuille 0x est absent ou invalide, `enabled` est forcé à `false`
 * afin qu'aucun client ne puisse ouvrir une page de paiement mal configurée.
 */
export function normalizePayGateConfig(raw: unknown): PayGateConfigData {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_PAYGATE_CONFIG };
  }
  const src = raw as Record<string, unknown>;
  const rawWallet = typeof src.usdcPolygonWallet === "string" ? src.usdcPolygonWallet.trim() : "";
  const validWallet = isValidPayGateWallet(rawWallet) ? rawWallet : "";

  const minRaw = Number(src.minOrderUsd);
  const minOrderUsd =
    Number.isFinite(minRaw) && minRaw >= 1 && minRaw <= 10_000
      ? Math.round(minRaw * 100) / 100
      : DEFAULT_PAYGATE_CONFIG.minOrderUsd;

  const feeRaw = Number(src.feePercent);
  const feePercent =
    Number.isFinite(feeRaw) && feeRaw >= 0 && feeRaw <= 50
      ? Math.round(feeRaw * 100) / 100
      : DEFAULT_PAYGATE_CONFIG.feePercent;

  const ratioRaw = Number(src.minReceivedRatio);
  const minReceivedRatio =
    Number.isFinite(ratioRaw) && ratioRaw >= 0.5 && ratioRaw <= 1
      ? Math.round(ratioRaw * 100) / 100
      : DEFAULT_PAYGATE_CONFIG.minReceivedRatio;

  const checkoutDomain = normalizePayGateHost(
    src.checkoutDomain,
    DEFAULT_PAYGATE_CHECKOUT_DOMAIN,
  );
  // Si un sous-domaine personnalisé (hors *.paygate.*) a été configuré et qu'aucun
  // cloakMode explicite n'a été choisi, on active d'office "custom_domain".
  const defaultCloak: PayGateCloakMode = !isPayGateSharedDomain(checkoutDomain)
    ? "custom_domain"
    : "self";

  return {
    enabled: src.enabled === true && validWallet.length > 0,
    usdcPolygonWallet: validWallet,
    minOrderUsd,
    feePercent,
    minReceivedRatio,
    provider: normalizePayGateProvider(src.provider),
    cloakMode:
      src.cloakMode !== undefined
        ? normalizePayGateCloakMode(src.cloakMode)
        : defaultCloak,
    apiDomain: normalizePayGateHost(src.apiDomain, DEFAULT_PAYGATE_API_DOMAIN),
    checkoutDomain,
  };
}

export function payGateReady(config: PayGateConfigData | null | undefined): boolean {
  if (!config) return false;
  return config.enabled === true && isValidPayGateWallet(config.usdcPolygonWallet);
}

export function publicPayGateOption(
  config: PayGateConfigData | null | undefined,
): PublicPayGateOption | null {
  if (!payGateReady(config) || !config) return null;
  return {
    enabled: true,
    minOrderUsd: config.minOrderUsd,
    feePercent: config.feePercent,
  };
}

/* ---------------------------- Calcul du devis ---------------------------- */

export interface PayGateCardQuote {
  /** Prix catalogue de la commande (en USD). */
  baseUsd: number;
  /** Majoration appliquée au paiement par carte (%). */
  feePercent: number;
  /** Frais en USD ajoutés au montant carte. */
  feeUsd: number;
  /** Montant total présenté sur la page carte (en USD). */
  billedUsd: number;
  /** Plancher en stablecoin USD requis au callback pour libérer la commande. */
  minAcceptableUsd: number;
}

export function calculatePayGateCardQuote(
  baseAmountUsd: number,
  config: Pick<PayGateConfigData, "feePercent" | "minReceivedRatio">,
): PayGateCardQuote | null {
  if (!Number.isFinite(baseAmountUsd) || baseAmountUsd <= 0) return null;
  const baseUsd = Math.round(baseAmountUsd * 100) / 100;
  const feePercent =
    Number.isFinite(config.feePercent) && config.feePercent >= 0
      ? Math.round(config.feePercent * 100) / 100
      : 0;
  const ratio =
    Number.isFinite(config.minReceivedRatio) &&
    config.minReceivedRatio >= 0.5 &&
    config.minReceivedRatio <= 1
      ? config.minReceivedRatio
      : DEFAULT_PAYGATE_CONFIG.minReceivedRatio;

  const billedUsd = Math.round(baseUsd * (1 + feePercent / 100) * 100) / 100;
  const feeUsd = Math.round((billedUsd - baseUsd) * 100) / 100;
  const minAcceptableUsd = Math.round(baseUsd * ratio * 100) / 100;

  return {
    baseUsd,
    feePercent,
    feeUsd,
    billedUsd,
    minAcceptableUsd,
  };
}

/* --------------------- Encodage URL compatible PayGate -------------------- */

/** `encodeURIComponent` strict façon `rawurlencode` PHP (utilisé par le SDK PayGate). */
export function payGateEncode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}

/**
 * `address_in` et `ipn_token` sont renvoyés déjà encodés en `%XX` par
 * PayGate.to : on les conserve tels quels s'ils ne contiennent que des
 * caractères sûrs + séquences `%XX`, sinon on les encode (évite à la fois
 * le double-encodage et toute injection de paramètre `&`).
 */
export function payGateKeepEncoded(value: string): string {
  return /%[0-9A-Fa-f]{2}/.test(value) &&
    /^(?:[A-Za-z0-9._~-]|%[0-9A-Fa-f]{2})+$/.test(value)
    ? value
    : payGateEncode(value);
}

export function formatPayGateAmount(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Montant PayGate invalide.");
  }
  return amount.toFixed(2).replace(/\.?0+$/, "");
}

export interface BuildPayGateCheckoutUrlInput {
  addressIn: string;
  amountUsd: number;
  customerEmail: string;
  currency?: string;
  checkoutDomain?: string;
  provider?: string;
  accentColor?: string;
  logoUrl?: string;
}

/**
 * Construit l'URL de paiement hébergée vers laquelle rediriger le client :
 * - `pay.php` (multi-fournisseurs adapté au pays du client, recommandé) ;
 * - `process-payment.php` si un fournisseur unique est forcé.
 */
export function buildPayGateCheckoutUrl(input: BuildPayGateCheckoutUrlInput): string {
  const addressIn = input.addressIn.trim();
  if (!addressIn) throw new Error("address_in manquant.");
  const email = input.customerEmail.trim();
  if (!email || !email.includes("@")) throw new Error("E-mail client requis pour PayGate.");

  const host = normalizePayGateHost(input.checkoutDomain, DEFAULT_PAYGATE_CHECKOUT_DOMAIN);
  const currency = (input.currency ?? "USD").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error(`Devise ISO invalide : ${currency}`);

  const amount = formatPayGateAmount(input.amountUsd);
  const provider = normalizePayGateProvider(input.provider);

  if (provider) {
    const parts = [
      `address=${payGateKeepEncoded(addressIn)}`,
      `amount=${payGateEncode(amount)}`,
      `provider=${payGateEncode(provider)}`,
      `email=${payGateEncode(email)}`,
      `currency=${payGateEncode(currency)}`,
    ];
    return `https://${host}/process-payment.php?${parts.join("&")}`;
  }

  const parts = [
    `address=${payGateKeepEncoded(addressIn)}`,
    `amount=${payGateEncode(amount)}`,
    `email=${payGateEncode(email)}`,
    `currency=${payGateEncode(currency)}`,
  ];
  // Si l'hôte est un domaine personnalisé (ex. pay.votredomaine.com), on passe
  // `domain=` à `pay.php` afin que tous les liens internes générés par PayGate
  // restent sur ce domaine personnalisé au lieu de pointer vers checkout.paygate.*
  if (!isPayGateSharedDomain(host)) {
    parts.push(`domain=${payGateEncode(host)}`);
  }
  if (input.logoUrl && /^https:\/\/[^\s]+$/i.test(input.logoUrl.trim())) {
    parts.push(`logo=${payGateEncode(input.logoUrl.trim())}`);
  }
  if (input.accentColor && /^#[0-9a-fA-F]{6}$/.test(input.accentColor.trim())) {
    parts.push(`theme=${payGateEncode(input.accentColor.trim())}`);
    parts.push(`button=${payGateEncode(input.accentColor.trim())}`);
  }
  return `https://${host}/pay.php?${parts.join("&")}`;
}

/* ----------- Passerelle First-Party Anti-Antivirus (/pay/card/[ref]) ------ */

/**
 * Jeton HMAC-SHA256 à séparation de domaine (`paygate-checkout-ui:v1:`)
 * autorisant uniquement l'ouverture de la passerelle carte `/pay/card/[ref]`
 * et le déclenchement de la redirection serveur vers le processeur agréé.
 * Ne permet ni de forger un callback webhook, ni de lire un code livré.
 */
export function signPayGateCheckoutToken(orderRef: string, secret: string): string {
  const ref = orderRef.trim().toUpperCase();
  if (!ref) throw new Error("Référence de commande vide.");
  if (!secret || secret.length < 16) throw new Error("Secret PayGate insuffisant.");
  return createHmac("sha256", secret)
    .update(`paygate-checkout-ui:v1:${ref}`)
    .digest("hex")
    .slice(0, 40);
}

export function verifyPayGateCheckoutToken(
  orderRef: string | null | undefined,
  token: string | null | undefined,
  secret: string,
): boolean {
  const ref = (orderRef ?? "").trim().toUpperCase();
  const given = (token ?? "").trim().toLowerCase();
  if (!ref || !given || !secret || secret.length < 16) return false;
  const expected = signPayGateCheckoutToken(ref, secret);
  if (expected.length !== given.length) return false;
  return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(given, "utf8"));
}

/**
 * Construit l'URL de paiement hébergée directement sur VOTRE domaine
 * (`https://votredomaine.com/pay/card/{ref}?k={token}`), garantie à 100 % sans
 * aucun domaine `*.paygate.*` visible côté navigateur ni antivirus client.
 */
export function buildFirstPartyPayGateUrl(input: {
  baseOrigin: string;
  orderRef: string;
  checkoutToken: string;
  locale?: string | null;
}): string {
  const origin = input.baseOrigin.trim().replace(/\/+$/, "");
  if (!/^https?:\/\/[^/\s]+$/i.test(origin)) {
    throw new Error(`Origine invalide : ${input.baseOrigin}`);
  }
  const ref = input.orderRef.trim().toUpperCase();
  const params = [`k=${payGateEncode(input.checkoutToken.trim())}`];
  if (input.locale === "en" || input.locale === "ar") {
    params.push(`lang=${input.locale}`);
  }
  return `${origin}/pay/card/${payGateEncode(ref)}?${params.join("&")}`;
}

export interface PayGateProviderOption {
  id: string;
  name: string;
  minimumUsd: number;
  eligible: boolean;
  methodsLabelEn: string;
  methodsLabelAr: string;
}

const PROVIDER_PRIORITY_ORDER = [
  "wert",
  "guardarian",
  "moonpay",
  "rampnetwork",
  "transak",
  "mercuryo",
  "banxa",
  "topper",
  "alchemypay",
  "unlimit",
  "simplex",
  "revolut",
  "stripe",
  "sardine",
  "robinhood",
  "particle",
];

const PROVIDER_METHODS_HINT: Record<string, { en: string; ar: string }> = {
  wert: {
    en: "Visa · Mastercard · Apple Pay · Google Pay",
    ar: "Visa · Mastercard · Apple Pay · Google Pay",
  },
  guardarian: {
    en: "Visa · Mastercard · Apple Pay · Google Pay · SEPA",
    ar: "Visa · Mastercard · Apple Pay · Google Pay · SEPA",
  },
  moonpay: {
    en: "Visa · Mastercard · Apple Pay · Google Pay · SEPA",
    ar: "Visa · Mastercard · Apple Pay · Google Pay · SEPA",
  },
  rampnetwork: {
    en: "Visa · Mastercard · Apple Pay · Google Pay · Revolut",
    ar: "Visa · Mastercard · Apple Pay · Google Pay · Revolut",
  },
  transak: {
    en: "Visa · Mastercard · Apple Pay · Google Pay · SEPA",
    ar: "Visa · Mastercard · Apple Pay · Google Pay · SEPA",
  },
  mercuryo: {
    en: "Visa · Mastercard · Apple Pay · Google Pay",
    ar: "Visa · Mastercard · Apple Pay · Google Pay",
  },
  banxa: {
    en: "Visa · Mastercard · Apple Pay · Google Pay",
    ar: "Visa · Mastercard · Apple Pay · Google Pay",
  },
  topper: {
    en: "Visa · Mastercard · Apple Pay · Google Pay",
    ar: "Visa · Mastercard · Apple Pay · Google Pay",
  },
  stripe: {
    en: "Visa · Mastercard · Apple Pay · Google Pay (US/Supported)",
    ar: "Visa · Mastercard · Apple Pay · Google Pay",
  },
  revolut: {
    en: "Revolut Pay · Visa · Mastercard",
    ar: "Revolut Pay · Visa · Mastercard",
  },
};

export const FALLBACK_PAYGATE_RAW_PROVIDERS: ReadonlyArray<Record<string, unknown>> = [
  { id: "wert", provider_name: "Wert", status: "active", minimum_currency: "USD", minimum_amount: 5 },
  { id: "guardarian", provider_name: "Guardarian", status: "active", minimum_currency: "USD", minimum_amount: 15 },
  { id: "moonpay", provider_name: "MoonPay", status: "active", minimum_currency: "USD", minimum_amount: 15 },
  { id: "rampnetwork", provider_name: "Ramp Network", status: "active", minimum_currency: "USD", minimum_amount: 10 },
  { id: "transak", provider_name: "Transak", status: "active", minimum_currency: "USD", minimum_amount: 15 },
  { id: "mercuryo", provider_name: "Mercuryo", status: "active", minimum_currency: "USD", minimum_amount: 15 },
  { id: "banxa", provider_name: "Banxa", status: "active", minimum_currency: "USD", minimum_amount: 20 },
  { id: "topper", provider_name: "Topper", status: "active", minimum_currency: "USD", minimum_amount: 10 },
];

/**
 * Normalise et trie la liste des processeurs carte actifs renvoyée par
 * `/control/provider-status/` selon le montant USD à régler.
 */
export function normalizePayGateProviders(
  rawProviders: ReadonlyArray<Record<string, unknown>>,
  billedUsd: number,
): PayGateProviderOption[] {
  const seen = new Set<string>();
  const out: PayGateProviderOption[] = [];

  for (const row of rawProviders) {
    if (!row || typeof row !== "object") continue;
    const id = normalizePayGateProvider(row.id);
    if (!id || seen.has(id)) continue;
    const status = String(row.status ?? "").trim().toLowerCase();
    if (status !== "active") continue;

    // On écarte les rails purement locaux non-USD (ex. INR UPI, CAD Interac)
    // lorsque minimum_currency n'est ni USD ni EUR, sauf processeurs globaux connus.
    const currency = String(row.minimum_currency ?? "USD").trim().toUpperCase();
    if (currency && currency !== "USD" && currency !== "EUR" && !PROVIDER_METHODS_HINT[id]) {
      continue;
    }

    const rawMin = Number(row.minimum_amount ?? 15);
    const minUsd =
      Number.isFinite(rawMin) && rawMin > 0
        ? Math.round((currency === "EUR" ? rawMin * 1.1 : rawMin) * 100) / 100
        : 15;
    const name = String(row.provider_name ?? id).trim() || id;
    const hint = PROVIDER_METHODS_HINT[id] ?? {
      en: "Visa · Mastercard · Apple Pay · Google Pay",
      ar: "Visa · Mastercard · Apple Pay · Google Pay",
    };

    seen.add(id);
    out.push({
      id,
      name,
      minimumUsd: minUsd,
      eligible: billedUsd + 1e-6 >= minUsd,
      methodsLabelEn: hint.en,
      methodsLabelAr: hint.ar,
    });
  }

  out.sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    const ia = PROVIDER_PRIORITY_ORDER.indexOf(a.id);
    const ib = PROVIDER_PRIORITY_ORDER.indexOf(b.id);
    const ra = ia === -1 ? 999 : ia;
    const rb = ib === -1 ? 999 : ib;
    if (ra !== rb) return ra - rb;
    return a.minimumUsd - b.minimumUsd;
  });

  return out;
}

export type ExtractedProcessorRedirect =
  | { kind: "external_processor"; url: string }
  | { kind: "paygate_hop"; url: string }
  | { kind: "none" };

function classifyCandidateRedirectUrl(
  rawCandidate: string,
  currentUrl?: string,
): ExtractedProcessorRedirect {
  const cleaned = rawCandidate
    .trim()
    .replace(/&amp;/gi, "&")
    .replace(/^['"]+|['"]+$/g, "");
  if (!cleaned || /^(javascript|data|vbscript|mailto):/i.test(cleaned)) {
    return { kind: "none" };
  }
  let resolved: URL;
  try {
    resolved = currentUrl ? new URL(cleaned, currentUrl) : new URL(cleaned);
  } catch {
    return { kind: "none" };
  }
  if (resolved.protocol !== "https:") {
    return { kind: "none" };
  }
  if (isPayGateSharedDomain(resolved.hostname)) {
    return { kind: "paygate_hop", url: resolved.toString() };
  }
  return { kind: "external_processor", url: resolved.toString() };
}

/**
 * Extrait de la réponse de `process-payment.php` l'URL HTTPS finale du
 * processeur agréé (MoonPay, Wert, Guardarian, Ramp, Stripe…), qu'elle soit
 * fournie par un en-tête HTTP `Location` (3xx) ou par une redirection HTML/JS,
 * tout en garantissant qu'aucun domaine `*.paygate.*` n'est renvoyé au client.
 */
export function extractProcessorRedirectUrl(input: {
  status: number;
  locationHeader?: string | null;
  htmlBody?: string | null;
  currentUrl?: string;
}): ExtractedProcessorRedirect {
  if (input.status >= 300 && input.status < 400 && input.locationHeader) {
    return classifyCandidateRedirectUrl(input.locationHeader, input.currentUrl);
  }

  const html = input.htmlBody ?? "";
  if (!html) return { kind: "none" };

  // 1. <meta http-equiv="refresh" content="0;url=https://...">
  const metaMatch =
    /<meta[^>]+http-equiv=["']?refresh["']?[^>]+content=["'][^"']*?\burl=([^"'>\s]+)[^"']*["']/i.exec(
      html,
    ) ??
    /<meta[^>]+content=["'][^"']*?\burl=([^"'>\s]+)[^"']*["'][^>]+http-equiv=["']?refresh["']?/i.exec(
      html,
    );
  if (metaMatch?.[1]) {
    const res = classifyCandidateRedirectUrl(metaMatch[1], input.currentUrl);
    if (res.kind !== "none") return res;
  }

  // 2. Redirections JavaScript courantes : window.location(.href|.replace|.assign)
  const jsPatterns = [
    /(?:window\.)?location\.(?:replace|assign)\(\s*(['"])(https:\/\/[^'"]+)\1\s*\)/i,
    /(?:window\.)?location(?:\.href)?\s*=\s*(['"])(https:\/\/[^'"]+)\1/i,
  ];
  for (const pattern of jsPatterns) {
    const match = pattern.exec(html);
    if (match?.[2]) {
      const res = classifyCandidateRedirectUrl(match[2].replace(/\\\//g, "/"), input.currentUrl);
      if (res.kind !== "none") return res;
    }
  }

  // 3. Widget iframe unique d'un processeur externe (ex. widget.wert.io / buy.moonpay.com)
  const iframeMatch = /<iframe[^>]+src=["'](https:\/\/[^"']+)["']/i.exec(html);
  if (iframeMatch?.[1]) {
    const res = classifyCandidateRedirectUrl(iframeMatch[1], input.currentUrl);
    if (res.kind === "external_processor") return res;
  }

  return { kind: "none" };
}

/**
 * Génère un script Cloudflare Worker officiel prêt à coller pour connecter un
 * sous-domaine personnalisé (ex. `pay.votredomaine.com`) en White-Label complet.
 */
export function generatePayGateCloudflareWorker(input: {
  customCheckoutDomain: string;
  upstreamApiDomain?: string;
  fallbackUrl: string;
}): string {
  const customDomain = normalizePayGateHost(
    input.customCheckoutDomain,
    "pay.votredomaine.com",
  );
  const upstreamHost = normalizePayGateHost(
    input.upstreamApiDomain,
    DEFAULT_PAYGATE_API_DOMAIN,
  );
  let safeFallback: string = DEFAULT_SITE_ORIGIN;
  try {
    const parsed = new URL(input.fallbackUrl.trim());
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      safeFallback = parsed.origin;
    }
  } catch {
    /* garde la valeur par défaut sûre */
  }

  return [
    "// Cloudflare Worker White-Label PayGate.to — généré depuis /admin/settings",
    "// Domaine personnalisé client : " + customDomain,
    "export default {",
    "  async fetch(request) {",
    `    const targetHost = ${JSON.stringify(upstreamHost)};`,
    `    const customDomain = ${JSON.stringify(customDomain)};`,
    `    const fallbackOrigin = ${JSON.stringify(safeFallback)};`,
    "",
    "    const url = new URL(request.url);",
    "    url.hostname = targetHost;",
    "",
    "    if (!url.pathname.includes('process-payment.php') && !url.searchParams.has('domain')) {",
    "      url.search += (url.search ? '&' : '?') + 'domain=' + encodeURIComponent(customDomain);",
    "    }",
    "",
    "    const headers = new Headers(request.headers);",
    "    if (!headers.has('PGTO-IPCountry')) {",
    "      headers.set('PGTO-IPCountry', request.cf?.country || 'XX');",
    "    }",
    "",
    "    const upstreamReq = new Request(url.toString(), {",
    "      method: request.method,",
    "      headers,",
    "      body: request.body ? request.clone().body : null,",
    "      redirect: 'manual',",
    "    });",
    "",
    "    const response = await fetch(upstreamReq);",
    "    if (response.status >= 300 && response.status < 400) {",
    "      const loc = response.headers.get('location');",
    "      if (loc) {",
    "        const rewritten = loc.replace(/https?:\\/\\/(?:checkout|api)\\.paygate\\.(?:to|sbs)/gi, 'https://' + customDomain);",
    "        if (rewritten !== loc) {",
    "          const redirectHeaders = new Headers(response.headers);",
    "          redirectHeaders.set('location', rewritten);",
    "          return new Response(null, { status: response.status, headers: redirectHeaders });",
    "        }",
    "      }",
    "      return response;",
    "    }",
    "",
    "    if (response.status >= 400) {",
    "      return Response.redirect(fallbackOrigin, 302);",
    "    }",
    "",
    "    const outHeaders = new Headers(response.headers);",
    "    outHeaders.set('Access-Control-Allow-Origin', '*');",
    "    return new Response(response.body, {",
    "      status: response.status,",
    "      statusText: response.statusText,",
    "      headers: outHeaders,",
    "    });",
    "  },",
    "};",
    "",
  ].join("\n");
}

/* ---------------- Jeton HMAC d'ordre & Signature RSA Callback ------------- */

/** Jeton HMAC-SHA256 liant de façon infalsifiable une URL de callback à une commande. */
export function signPayGateOrderToken(orderRef: string, secret: string): string {
  const ref = orderRef.trim().toUpperCase();
  if (!ref) throw new Error("Référence de commande vide.");
  if (!secret || secret.length < 16) throw new Error("Secret callback PayGate insuffisant.");
  return createHmac("sha256", secret).update(`paygate-order:${ref}`).digest("hex");
}

export function verifyPayGateOrderToken(
  orderRef: string | null | undefined,
  token: string | null | undefined,
  secret: string,
): boolean {
  const ref = (orderRef ?? "").trim().toUpperCase();
  const given = (token ?? "").trim().toLowerCase();
  if (!ref || !given || !secret || secret.length < 16) return false;
  const expected = signPayGateOrderToken(ref, secret);
  if (expected.length !== given.length) return false;
  return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(given, "utf8"));
}

/** Construit l'URL de callback enregistrée auprès de `wallet.php`. */
export function buildPayGateCallbackUrl(
  baseOrigin: string,
  orderRef: string,
  secret: string,
): string {
  const origin = baseOrigin.trim().replace(/\/+$/, "");
  if (!/^https?:\/\/[^/\s]+$/i.test(origin)) {
    throw new Error(`Origine de callback invalide : ${baseOrigin}`);
  }
  const ref = orderRef.trim().toUpperCase();
  const token = signPayGateOrderToken(ref, secret);
  return `${origin}/api/payments/paygate/callback?order=${payGateEncode(ref)}&token=${payGateEncode(token)}`;
}

export function callbackBaseUrl(url: string): string | null {
  const value = String(url ?? "").trim();
  const cut = value.search(/[?#]/);
  const base = cut === -1 ? value : value.slice(0, cut);
  return /^https?:\/\/[^/\s]+/i.test(base) ? base : null;
}

export function extractRawQuery(requestUrl: string): string {
  let url = String(requestUrl ?? "");
  const hash = url.indexOf("#");
  if (hash !== -1) url = url.slice(0, hash);
  const mark = url.indexOf("?");
  return mark === -1 ? "" : url.slice(mark + 1);
}

const keyCache = new Map<string, KeyObject>();

function resolvePublicKey(keyId: string, customKeys?: Record<string, string>): KeyObject | null {
  const map: Record<string, string> = {
    v1: PAYGATE_CALLBACK_PUBLIC_KEY_V1,
    ...(customKeys ?? {}),
  };
  const pem = map[keyId];
  if (!pem) return null;
  const cacheKey = `${keyId}:${pem.slice(0, 64)}`;
  const cached = keyCache.get(cacheKey);
  if (cached) return cached;
  try {
    const obj = createPublicKey(pem);
    keyCache.set(cacheKey, obj);
    return obj;
  } catch {
    return null;
  }
}

export type PayGateSignatureFailure =
  | "signature_absent"
  | "unknown_key_id"
  | "signature_not_base64"
  | "no_registered_callback"
  | "signature_mismatch";

export interface PayGateSignatureVerification {
  valid: boolean;
  reason: PayGateSignatureFailure | "";
  keyId: string;
}

/**
 * Vérifie la signature RSA-SHA256 de PayGate.to sur `${callbackBase}?${rawQuery}`.
 * Identique au `CallbackVerifier` du SDK officiel `paygate-to`.
 */
export function verifyPayGateCallbackSignature(params: {
  registeredCallbackUrl: string;
  rawQuery: string | null | undefined;
  signature: string | null | undefined;
  keyId?: string | null;
  customKeys?: Record<string, string>;
}): PayGateSignatureVerification {
  const sig = String(params.signature ?? "").trim();
  if (!sig) return { valid: false, reason: "signature_absent", keyId: "" };

  const keyId = String(params.keyId ?? "").trim() || "v1";
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(keyId)) {
    return { valid: false, reason: "unknown_key_id", keyId };
  }

  const key = resolvePublicKey(keyId, params.customKeys);
  if (!key) return { valid: false, reason: "unknown_key_id", keyId };

  const compact = sig.replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(compact) || compact.replace(/=+$/, "").length % 4 === 1) {
    return { valid: false, reason: "signature_not_base64", keyId };
  }

  const base = callbackBaseUrl(params.registeredCallbackUrl);
  if (!base) return { valid: false, reason: "no_registered_callback", keyId };

  const query = String(params.rawQuery ?? "").replace(/^\?/, "");
  const signedMessage = query === "" ? base : `${base}?${query}`;

  let ok = false;
  try {
    ok = rsaVerify(
      "sha256",
      Buffer.from(signedMessage, "utf8"),
      key,
      Buffer.from(compact, "base64"),
    );
  } catch {
    ok = false;
  }

  return ok
    ? { valid: true, reason: "", keyId }
    : { valid: false, reason: "signature_mismatch", keyId };
}

/* --------------------- Décodage des paramètres Callback ------------------- */

function safeDecode(part: string): string {
  const text = part.replace(/\+/g, " ");
  try {
    return decodeURIComponent(text);
  } catch {
    return text.replace(/(%[0-9A-Fa-f]{2})+/g, (run) => {
      try {
        return decodeURIComponent(run);
      } catch {
        return run;
      }
    });
  }
}

export interface ParsedPayGateCallback {
  order: string;
  token: string;
  valueCoin: string;
  coin: string;
  txidIn: string;
  txidOut: string;
  addressIn: string;
  valueForwardedCoin: string;
  addressOutRaw: string;
  pending: boolean;
  all: Record<string, string>;
}

/**
 * Décode la query brute du callback : lorsqu'un paramètre apparaît plusieurs
 * fois, la DERNIÈRE valeur (celle ajoutée par PayGate.to) l'emporte toujours.
 */
export function parsePayGateCallbackQuery(rawQuery: string): ParsedPayGateCallback {
  const params: Record<string, string> = Object.create(null);
  for (const pair of String(rawQuery ?? "").replace(/^\?/, "").split("&")) {
    if (!pair) continue;
    const eq = pair.indexOf("=");
    const name = safeDecode(eq === -1 ? pair : pair.slice(0, eq));
    params[name] = eq === -1 ? "" : safeDecode(pair.slice(eq + 1));
  }
  const get = (k: string) =>
    Object.prototype.hasOwnProperty.call(params, k) ? params[k] : "";
  const pendingRaw = get("pending").trim().toLowerCase();
  const pending =
    pendingRaw !== "" && pendingRaw !== "0" && pendingRaw !== "false";

  return {
    order: get("order").trim().toUpperCase(),
    token: get("token").trim(),
    valueCoin: get("value_coin").trim(),
    coin: get("coin").trim().toLowerCase(),
    txidIn: get("txid_in").trim(),
    txidOut: get("txid_out").trim(),
    addressIn: get("address_in").trim(),
    valueForwardedCoin: get("value_forwarded_coin").trim(),
    addressOutRaw: get("address_out").trim(),
    pending,
    all: { ...params },
  };
}

function plainDecimal(text: string): string | null {
  const match = /^(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(String(text).trim());
  if (!match) return null;
  let int = match[1];
  let frac = match[2] ?? "";
  const exp = match[3] ? parseInt(match[3], 10) : 0;
  if (exp > 0) {
    frac = frac.padEnd(exp, "0");
    int += frac.slice(0, exp);
    frac = frac.slice(exp);
  } else if (exp < 0) {
    int = int.padStart(-exp + 1, "0");
    frac = int.slice(exp) + frac;
    int = int.slice(0, exp);
  }
  const i = int.replace(/^0+/, "") || "0";
  const f = frac.replace(/0+$/, "");
  return f ? `${i}.${f}` : i;
}

function multiplyDecimal(a: string, b: string): string | null {
  const x = plainDecimal(a);
  const y = plainDecimal(b);
  if (!x || !y) return null;
  const [xi, xf = ""] = x.split(".");
  const [yi, yf = ""] = y.split(".");
  const decimals = xf.length + yf.length;
  const digits = (BigInt(xi + xf) * BigInt(yi + yf)).toString().padStart(decimals + 1, "0");
  const int = digits.slice(0, digits.length - decimals).replace(/^0+/, "") || "0";
  const frac = (decimals > 0 ? digits.slice(-decimals) : "").replace(/0+$/, "");
  return frac ? `${int}.${frac}` : int;
}

/**
 * Extrait la part et le montant exact reversés au portefeuille `wallet` dans
 * `address_out` (calcul décimal exact sans virgule flottante).
 */
export function payoutForWallet(
  addressOutRaw: string,
  valueForwardedCoin: string,
  wallet: string,
): { share: number; amountCoin: string } | null {
  if (!addressOutRaw || !wallet.trim()) return null;
  let decoded: unknown;
  try {
    decoded = JSON.parse(
      addressOutRaw.replace(
        /([:\[,]\s*)(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)(?=\s*[,}\]])/g,
        '$1"$2"',
      ),
    );
  } catch {
    return null;
  }
  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) return null;

  const wanted = wallet.trim().toLowerCase();
  for (const [payee, rawShare] of Object.entries(decoded as Record<string, unknown>)) {
    if (payee.trim().toLowerCase() !== wanted) continue;
    const shareStr = typeof rawShare === "string" ? plainDecimal(rawShare) : null;
    if (!shareStr) return null;
    const share = Number(shareStr);
    if (!Number.isFinite(share) || share <= 0) return null;
    const forwarded = plainDecimal(valueForwardedCoin || "0") ?? "0";
    const amountCoin = multiplyDecimal(forwarded, shareStr) ?? "0";
    return { share, amountCoin };
  }
  return null;
}

/** Vrai si le jeton reçu est un stablecoin indexé 1:1 sur l'USD (USDC / USDT). */
export function isUsdStablecoinTicker(coin: string): boolean {
  const normalized = coin.trim().toLowerCase();
  return /(?:^|[_/])(usdc|usdt)(?:\.e)?$/.test(normalized);
}

export interface ValidatePayGateSettlementInput {
  callback: ParsedPayGateCallback;
  expectedPolygonAddressIn: string;
  expectedMerchantWallet: string;
  minAcceptableUsd: number;
}

export type PayGateSettlementDecision =
  | {
      status: "pending";
      reason: string;
    }
  | {
      status: "paid";
      receivedUsd: number;
      merchantPayoutCoin: string;
    }
  | {
      status: "underpaid";
      reason: string;
      receivedUsd: number;
    }
  | {
      status: "rejected";
      reason: string;
      receivedUsd: number;
    };

/**
 * Valide l'ensemble des invariants métier d'un callback PayGate déjà signé :
 *  1. `pending` → attente (ne rien livrer) ;
 *  2. `txid_in` présent ;
 *  3. `address_in` correspond exactement à l'adresse Polygon créée pour CETTE commande ;
 *  4. si `address_out` est fourni, notre wallet marchand reçoit bien >= 90 % du montant transféré ;
 *  5. la pièce reçue est un stablecoin USD (USDC/USDT) et `value_coin >= minAcceptableUsd`.
 */
export function validatePayGateSettlement(
  input: ValidatePayGateSettlementInput,
): PayGateSettlementDecision {
  const { callback } = input;
  if (callback.pending) {
    return { status: "pending", reason: "Transaction signalée comme non confirmée (pending)." };
  }
  if (!callback.txidIn) {
    return { status: "rejected", reason: "txid_in manquant dans le callback.", receivedUsd: 0 };
  }

  const expectedDeposit = input.expectedPolygonAddressIn.trim().toLowerCase();
  if (
    expectedDeposit &&
    callback.addressIn.trim().toLowerCase() !== expectedDeposit
  ) {
    return {
      status: "rejected",
      reason: `address_in inattendue (${callback.addressIn} ≠ ${input.expectedPolygonAddressIn}).`,
      receivedUsd: 0,
    };
  }

  if (!isUsdStablecoinTicker(callback.coin)) {
    return {
      status: "underpaid",
      reason: `Pièce reçue non-stablecoin (${callback.coin || "inconnue"}) — vérification manuelle requise.`,
      receivedUsd: 0,
    };
  }

  const valueCoinNum = Number(plainDecimal(callback.valueCoin) ?? "NaN");
  if (!Number.isFinite(valueCoinNum) || valueCoinNum <= 0) {
    return {
      status: "rejected",
      reason: `Montant value_coin invalide (${callback.valueCoin}).`,
      receivedUsd: 0,
    };
  }

  let merchantPayoutCoin = callback.valueForwardedCoin || callback.valueCoin;
  if (callback.addressOutRaw && input.expectedMerchantWallet.trim()) {
    const payout = payoutForWallet(
      callback.addressOutRaw,
      callback.valueForwardedCoin || callback.valueCoin,
      input.expectedMerchantWallet,
    );
    if (!payout || payout.share < 0.9) {
      return {
        status: "rejected",
        reason: "Le portefeuille marchand configuré ne figure pas à >= 90 % dans address_out.",
        receivedUsd: valueCoinNum,
      };
    }
    merchantPayoutCoin = payout.amountCoin;
  }

  // Tolérance d'arrondi de 0,01 $ sur le seuil minimal calculé.
  if (valueCoinNum + 0.01 < input.minAcceptableUsd) {
    return {
      status: "underpaid",
      reason: `Montant reçu (${valueCoinNum.toFixed(2)} ${callback.coin}) inférieur au seuil attendu (${input.minAcceptableUsd.toFixed(2)} USD).`,
      receivedUsd: valueCoinNum,
    };
  }

  return {
    status: "paid",
    receivedUsd: Math.round(valueCoinNum * 100) / 100,
    merchantPayoutCoin,
  };
}
