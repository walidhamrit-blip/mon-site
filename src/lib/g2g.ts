// Client G2G OpenAPI v2 — CÔTÉ SERVEUR UNIQUEMENT.
//
// Documentation : https://docs.g2g.com/llms.txt
// Base prod     : https://open-api.g2g.com
//
// Authentification (4 en-têtes sur CHAQUE requête) :
//   g2g-api-key    : clé publique générée dans g2g.com → Avatar → API Integration
//   g2g-userid     : Seller ID du compte (ex. 1003177397)
//   g2g-timestamp  : Date.now() en millisecondes (valable 5 minutes)
//   g2g-signature  : HMAC_SHA256(secretKey, path + apiKey + userId + timestamp)
//
// ⚠️ `G2G_SECRET_KEY` n'est affichée qu'UNE SEULE FOIS par G2G. Elle ne doit
// jamais être collée dans un chat, un ticket, un log, un fichier versionné
// ni une réponse HTTP. Toutes les requêtes partent du serveur.
//
// Ce module est VOLONTAIREMENT en lecture + écriture d'offre uniquement :
// aucun achat fournisseur n'est déclenché ici. Voir
// `src/app/api/webhooks/g2g/route.ts` et `docs/g2g-pilot.md`.

import { sanitizeSecret } from "@/lib/nowpayments";
import {
  G2G_API_BASE,
  g2gApiSignature,
  g2gCanonicalPath,
} from "@/lib/g2g-core";

export interface G2gConfig {
  apiKey: string;
  secretKey: string;
  userId: string;
  webhookSecretToken: string;
  /** URL EXACTE déclarée dans G2G → Webhook → Callback URL. */
  webhookUrl: string;
  apiBase: string;
}

function env(name: string): string {
  return sanitizeSecret(process.env[name]);
}

export function g2gConfig(): G2gConfig {
  const base = process.env.G2G_API_BASE?.trim();
  return {
    apiKey: env("G2G_API_KEY"),
    secretKey: env("G2G_SECRET_KEY"),
    userId: env("G2G_USER_ID"),
    webhookSecretToken: env("G2G_WEBHOOK_SECRET_TOKEN"),
    // Pas de normalisation : la signature porte sur la chaîne EXACTE.
    webhookUrl: env("G2G_WEBHOOK_URL"),
    apiBase: (base || G2G_API_BASE).replace(/\/+$/, ""),
  };
}

/** Vrai si les 3 identifiants nécessaires aux appels sortants sont présents. */
export function g2gConfigured(): boolean {
  const cfg = g2gConfig();
  return Boolean(cfg.apiKey && cfg.secretKey && cfg.userId);
}

/** Vrai si la réception signée des webhooks est configurable. */
export function g2gWebhookConfigured(): boolean {
  const cfg = g2gConfig();
  return Boolean(cfg.webhookSecretToken && cfg.webhookUrl && cfg.userId);
}

/**
 * État « secrets présents ? » destiné à l'admin : uniquement des booléens,
 * jamais la moindre valeur, longueur ou extrémité de clé.
 */
export function g2gConfigStatus(): {
  apiKey: boolean;
  secretKey: boolean;
  userId: boolean;
  webhookSecretToken: boolean;
  webhookUrl: boolean;
  webhookUrlIsHttps: boolean;
  apiConfigured: boolean;
  webhookConfigured: boolean;
} {
  const cfg = g2gConfig();
  let webhookUrlIsHttps = false;
  try {
    webhookUrlIsHttps = new URL(cfg.webhookUrl).protocol === "https:";
  } catch {
    webhookUrlIsHttps = false;
  }
  return {
    apiKey: Boolean(cfg.apiKey),
    secretKey: Boolean(cfg.secretKey),
    userId: Boolean(cfg.userId),
    webhookSecretToken: Boolean(cfg.webhookSecretToken),
    webhookUrl: Boolean(cfg.webhookUrl),
    webhookUrlIsHttps,
    apiConfigured: g2gConfigured(),
    webhookConfigured: g2gWebhookConfigured(),
  };
}

/* ------------------------------- Erreurs ------------------------------- */

export class G2gError extends Error {
  readonly status: number | null;
  readonly code: string | null;

  constructor(message: string, status: number | null = null, code: string | null = null) {
    super(message);
    this.name = "G2gError";
    this.status = status;
    this.code = code;
  }
}

export function isG2gError(error: unknown): error is G2gError {
  return error instanceof G2gError;
}

export function g2gErrorMessage(error: unknown): string {
  if (isG2gError(error)) {
    return error.code ? `${error.message} (${error.code})` : error.message;
  }
  return error instanceof Error ? error.message : String(error);
}

/* ------------------------------- Requêtes ------------------------------- */

interface G2gRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  /** Chemin commençant par `/v2/…` (ou URL complète de la base prod). */
  path: string;
  body?: unknown;
  timeoutMs?: number;
}

export interface G2gEnvelope<T> {
  request_id?: string;
  /** `20000001` = succès. Toute autre valeur est une erreur métier. */
  code: string;
  message?: string;
  warning?: string;
  payload: T;
}

/**
 * Requête signée vers G2G. Le corps de la réponse n'est JAMAIS journalisé
 * (il peut contenir des données de commande) : seuls `code` et `message`
 * remontent dans les erreurs.
 */
export async function g2gRequest<T>(
  options: G2gRequestOptions,
): Promise<G2gEnvelope<T>> {
  const cfg = g2gConfig();
  if (!g2gConfigured()) {
    throw new G2gError(
      "G2G non configuré : renseigner G2G_API_KEY, G2G_SECRET_KEY et G2G_USER_ID côté serveur.",
    );
  }

  const canonicalPath = g2gCanonicalPath(options.path);
  if (!canonicalPath.startsWith("/v2/")) {
    throw new G2gError("Chemin G2G invalide : attendu /v2/…");
  }

  const timestamp = String(Date.now());
  const headers: Record<string, string> = {
    "g2g-api-key": cfg.apiKey,
    "g2g-userid": cfg.userId,
    "g2g-timestamp": timestamp,
    "g2g-signature": g2gApiSignature({
      secretKey: cfg.secretKey,
      canonicalPath,
      apiKey: cfg.apiKey,
      userId: cfg.userId,
      timestamp,
    }),
    Accept: "application/json",
  };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(`${cfg.apiBase}${canonicalPath}`, {
      method: options.method ?? "GET",
      headers,
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      cache: "no-store",
      signal: AbortSignal.timeout(options.timeoutMs ?? 20000),
    });
  } catch (error) {
    throw new G2gError(
      `G2G injoignable — ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const raw = await response.text().catch(() => "");
  let parsed: Record<string, unknown> = {};
  try {
    parsed = raw.trim() ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    throw new G2gError("Réponse G2G illisible (JSON attendu).", response.status);
  }

  const code = typeof parsed.code === "string" ? parsed.code : "";
  const message = typeof parsed.message === "string" ? parsed.message : "";
  if (!response.ok || (code && code !== "20000001")) {
    throw new G2gError(
      message || `G2G ${options.method ?? "GET"} ${canonicalPath} → HTTP ${response.status}`,
      response.status,
      code || null,
    );
  }
  return parsed as unknown as G2gEnvelope<T>;
}

/* -------------------------------- Types -------------------------------- */

export interface G2gStore {
  user_id: string;
  account_status: string;
  seller_status: string;
  selling_currencies: string[] | { currency: string }[];
}

export interface G2gOffer {
  offer_id: string;
  seller_id?: string;
  title?: string;
  status?: string;
  currency?: string;
  unit_price?: number;
  api_qty?: number;
  available_qty?: number;
  min_qty?: number;
  delivery_type?: string[];
  code_label?: string;
}

export interface G2gDeliveryAck {
  delivery_id?: string;
}

/* ------------------------------ Endpoints ------------------------------ */

/** Premier test à faire avec une clé neuve : lecture seule du compte vendeur. */
export async function g2gGetStore(): Promise<G2gEnvelope<G2gStore>> {
  return g2gRequest<G2gStore>({ path: "/v2/store", timeoutMs: 12000 });
}

/** Lecture d'une offre (prix, devise, `api_qty`, format de code attendu). */
export async function g2gGetOffer(offerId: string): Promise<G2gEnvelope<G2gOffer>> {
  return g2gRequest<G2gOffer>({
    path: `/v2/offers/${encodeURIComponent(offerId)}`,
    timeoutMs: 12000,
  });
}

/**
 * Met à jour le stock virtuel `api_qty` (et/ou le prix) d'une offre.
 * À n'utiliser qu'après validation du pilote : `api_qty > 0` rend l'offre
 * achetable et déclenche les webhooks `order.api_delivery`.
 */
export async function g2gPatchOffer(
  offerId: string,
  patch: { api_qty?: number; unit_price?: number; low_stock_alert_qty?: number },
): Promise<G2gEnvelope<G2gOffer>> {
  return g2gRequest<G2gOffer>({
    method: "PATCH",
    path: `/v2/offers/${encodeURIComponent(offerId)}`,
    body: patch,
  });
}

/** Livraison des codes à l'acheteur (phase 2, non câblée pour l'instant). */
export async function g2gDeliverCodes(input: {
  orderId: string;
  deliveryId: string;
  /** Un code par unité achetée, `reference_id` unique et stable. */
  codes: { content: string; reference_id: string }[];
}): Promise<G2gEnvelope<G2gDeliveryAck>> {
  return g2gRequest<G2gDeliveryAck>({
    method: "POST",
    path: `/v2/orders/${encodeURIComponent(input.orderId)}/delivery`,
    body: {
      delivery_id: input.deliveryId,
      codes: input.codes.map((code) => ({
        content: code.content,
        content_type: "text/plain",
        reference_id: code.reference_id,
      })),
    },
  });
}
