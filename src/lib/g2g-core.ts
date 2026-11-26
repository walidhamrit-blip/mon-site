/**
 * Noyau PUR de l'intégration G2G OpenAPI v2.
 *
 * Aucun accès réseau, aucun `process.env`, aucune dépendance Next.js :
 * ce fichier est directement testable par `node --test` (Node >= 22 retire
 * les annotations de type). Il concentre les parties où une erreur coûte
 * cher : signatures HMAC, fenêtre d'horodatage, décodage d'un événement
 * `order.api_delivery` et garde-fou de marge.
 *
 * Références officielles :
 *   https://docs.g2g.com/authentication-intro-1237152m0
 *   https://docs.g2g.com/verifying-signatures-1237154m0
 *   https://docs.g2g.com/message-signature-1237168m0
 *   https://docs.g2g.com/order-api-delivery-18583502e0
 *
 * ⚠️ Les secrets (`G2G_SECRET_KEY`, `G2G_WEBHOOK_SECRET_TOKEN`) ne doivent
 * jamais apparaître dans un log, une réponse HTTP ou ce fichier.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export const G2G_API_BASE = "https://open-api.g2g.com";

/** Le timestamp G2G (millisecondes) expire au bout de 5 minutes. */
export const G2G_TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;

/** Quantité maximale de codes livrables en un seul appel `POST /delivery`. */
export const G2G_MAX_DELIVERY_QTY = 100;

/**
 * Chemin canonique signé pour les appels SORTANTS : uniquement le chemin
 * (et l'éventuelle query string), jamais le schéma ni l'hôte.
 *
 * Exemple : `/v2/orders/123-1/delivery`.
 */
export function g2gCanonicalPath(raw: string): string {
  const value = (raw ?? "").trim();
  if (!value) return "";
  if (!value.startsWith("/") && !/^https?:\/\//i.test(value)) {
    return `/${value}`;
  }
  try {
    const url = new URL(value, G2G_API_BASE);
    return `${url.pathname}${url.search}`;
  } catch {
    return value.startsWith("/") ? value : `/${value}`;
  }
}

/**
 * Signature des requêtes sortantes :
 * `HMAC_SHA256(secretKey, canonicalPath + apiKey + userId + timestamp)`.
 * `secretKey` est la clé HMAC, PAS une donnée concaténée.
 */
export function g2gApiSignature(input: {
  secretKey: string;
  canonicalPath: string;
  apiKey: string;
  userId: string;
  timestamp: string | number;
}): string {
  const canonicalString =
    input.canonicalPath + input.apiKey + input.userId + String(input.timestamp);
  return createHmac("sha256", input.secretKey)
    .update(canonicalString, "utf8")
    .digest("hex");
}

/**
 * Type de contenu exigé par G2G.
 *
 * ⚠️ G2G le réclame sur **CHAQUE** requête, y compris un `GET` sans corps :
 * sans cet en-tête, l'API renvoie
 * « The request was unacceptable, often due to missing a required parameter.
 * Invalid Header 'Content-Type' ». Tous les exemples `curl` de la
 * documentation officielle le portent, quelle que soit la méthode.
 */
export const G2G_CONTENT_TYPE = "application/json";

/**
 * En-têtes complets d'une requête SORTANTE signée.
 *
 * Factorisé ici (noyau pur) pour rester testable sans réseau et pour qu'un
 * futur appelant ne puisse pas oublier `Content-Type` — l'erreur renvoyée
 * par G2G dans ce cas ne cite pas le nom de notre configuration mais celui
 * de l'en-tête, ce qui rend le diagnostic contre-intuitif côté admin.
 *
 * `Content-Type` est donc posé **inconditionnellement**, même sans corps.
 */
export function g2gRequestHeaders(input: {
  apiKey: string;
  secretKey: string;
  userId: string;
  /** Chemin canonique signé, ex. `/v2/store`. */
  canonicalPath: string;
  /** Horodatage en millisecondes (identique à celui de la signature). */
  timestamp: string | number;
  /** Surcharge exceptionnelle du type de contenu (défaut : `application/json`). */
  contentType?: string;
}): Record<string, string> {
  const timestamp = String(input.timestamp);
  return {
    "g2g-api-key": input.apiKey,
    "g2g-userid": input.userId,
    "g2g-timestamp": timestamp,
    "g2g-signature": g2gApiSignature({
      secretKey: input.secretKey,
      canonicalPath: input.canonicalPath,
      apiKey: input.apiKey,
      userId: input.userId,
      timestamp,
    }),
    Accept: "application/json",
    "Content-Type": input.contentType ?? G2G_CONTENT_TYPE,
  };
}

/**
 * Signature des webhooks ENTRANTS, selon l'exemple de code officiel :
 * `HMAC_SHA256(webhookSecretToken, webhookUrl + userId + timestamp)`.
 *
 * `webhookUrl` doit être STRICTEMENT identique à l'URL saisie dans le
 * tableau G2G → API Integration → Webhook → Callback URL (casse, slash
 * final et query compris). `apiKey` n'apparaît pas dans l'exemple Python
 * de la doc ; la variante `webhookUrl + apiKey + userId + timestamp` est
 * fournie séparément par `g2gWebhookSignatureVariants` pour absorber une
 * éventuelle différence d'implémentation côté G2G sans affaiblir le
 * contrôle (les deux variantes exigent le même secret token).
 */
export function g2gWebhookSignature(input: {
  secretToken: string;
  webhookUrl: string;
  userId: string;
  timestamp: string | number;
}): string {
  const canonicalString =
    input.webhookUrl + input.userId + String(input.timestamp);
  return createHmac("sha256", input.secretToken)
    .update(canonicalString, "utf8")
    .digest("hex");
}

/** Candidats de signature webhook (forme documentée + variante avec apiKey). */
export function g2gWebhookSignatureVariants(input: {
  secretToken: string;
  webhookUrl: string;
  userId: string;
  timestamp: string | number;
  apiKey?: string;
}): string[] {
  const documented = g2gWebhookSignature(input);
  if (!input.apiKey) return [documented];
  const withApiKey = createHmac("sha256", input.secretToken)
    .update(
      input.webhookUrl + input.apiKey + input.userId + String(input.timestamp),
      "utf8",
    )
    .digest("hex");
  return [documented, withApiKey];
}

/** Comparaison à temps constant de deux signatures hexadécimales. */
export function g2gSignaturesEqual(received: string, expected: string): boolean {
  const left = (received ?? "").trim().toLowerCase();
  const right = (expected ?? "").trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(left) || !/^[0-9a-f]{64}$/.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

/** Vrai si le timestamp (ms) est dans la fenêtre de tolérance autour de `now`. */
export function isG2gTimestampFresh(
  timestamp: string | number,
  now: number = Date.now(),
  toleranceMs: number = G2G_TIMESTAMP_TOLERANCE_MS,
): boolean {
  const value = Number(timestamp);
  if (!Number.isFinite(value) || value <= 0) return false;
  return Math.abs(now - value) <= toleranceMs;
}

/**
 * Vérifie l'en-tête `g2g-signature` d'un webhook entrant.
 * Refuse : secret absent, timestamp absent/périmé, signature absente ou
 * différente. Ne journalise jamais la valeur de la signature.
 */
export function verifyG2gWebhookSignature(input: {
  secretToken: string;
  webhookUrl: string;
  userId: string;
  apiKey?: string;
  timestamp: string;
  signature: string;
  now?: number;
  toleranceMs?: number;
}): boolean {
  if (!input.secretToken || !input.webhookUrl || !input.userId) return false;
  if (!isG2gTimestampFresh(input.timestamp, input.now, input.toleranceMs)) {
    return false;
  }
  const candidates = g2gWebhookSignatureVariants({
    secretToken: input.secretToken,
    webhookUrl: input.webhookUrl,
    userId: input.userId,
    timestamp: input.timestamp,
    ...(input.apiKey ? { apiKey: input.apiKey } : {}),
  });
  return candidates.some((expected) =>
    g2gSignaturesEqual(input.signature, expected),
  );
}

/* ------------------------- Diagnostic des erreurs ------------------------- */

/**
 * Famille d'erreur renvoyée par l'API G2G, pour guider le dépannage.
 *
 * Deux pannes très différentes se ressemblent dans le panneau admin :
 *   - `400` = notre requête est malformée (en-tête refusé). C'est un problème
 *     de **code**, indépendant des clés.
 *   - `401` = la paire `G2G_API_KEY` / `G2G_SECRET_KEY` est désynchronisée
 *     (les deux valeurs doivent venir de la MÊME génération) ou l'`user_id`
 *     ne correspond pas. C'est un problème de **configuration** côté G2G.
 *
 * Faute de ce distinguo, on perd des heures à re-générer des clés alors que
 * le défaut est dans le code (ou l'inverse).
 */
export type G2gErrorHint =
  | "network"
  | "headers"
  | "request"
  | "signature"
  | "permissions"
  | "rate_limit"
  | "upstream"
  | null;

export function g2gErrorHint(input: {
  status: number | null;
  code?: string | null;
  message?: string | null;
}): G2gErrorHint {
  const { status } = input;
  const message = (input.message ?? "").toLowerCase();

  if (status === null) return "network";
  if (status === 401) return "signature";
  if (status === 403) return "permissions";
  if (status === 429) return "rate_limit";
  if (status >= 500) return "upstream";

  // Un 400 peut aussi masquer une clé refusée : G2G renvoie parfois
  // « invalid api key » ou « signature » sans passer par un 401.
  if (message.includes("signature") || message.includes("api key")) {
    return "signature";
  }
  if (status === 400) {
    // « Invalid Header 'Content-Type' » et consorts : en-tête refusé.
    if (message.includes("header") || message.includes("content-type")) {
      return "headers";
    }
    return "request";
  }
  return null;
}

/* --------------------------- Événements webhook --------------------------- */

export interface G2gDeliveryEvent {
  /** Identifiant unique de l'événement (`id`), utilisé pour la traçabilité. */
  eventId: string;
  eventType: string;
  orderId: string;
  offerId: string;
  sellerId: string;
  /** `delivery_id` : clé d'idempotence de la livraison. */
  deliveryId: string;
  requestedQty: number;
  expiredAt: number;
  deliveryMethodCode: string;
}

export type G2gEventParseResult =
  | { ok: true; event: G2gDeliveryEvent }
  | {
      ok: false;
      reason:
        | "invalid_payload"
        | "unsupported_event"
        | "missing_fields"
        | "invalid_quantity";
      eventType?: string;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

function integer(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) ? parsed : 0;
}

/**
 * Décode UNIQUEMENT l'événement `order.api_delivery`. Les autres événements
 * sont explicitement ignorés (ils ne doivent jamais déclencher un achat).
 * Aucun code, aucun secret, aucune donnée acheteur n'est conservé ici.
 */
export function parseG2gDeliveryEvent(value: unknown): G2gEventParseResult {
  if (!isRecord(value)) return { ok: false, reason: "invalid_payload" };

  const eventType = text(value.event_type);
  if (!eventType) return { ok: false, reason: "invalid_payload" };
  if (eventType !== "order.api_delivery") {
    return { ok: false, reason: "unsupported_event", eventType };
  }

  const payload = value.payload;
  if (!isRecord(payload)) return { ok: false, reason: "missing_fields" };
  const summary = payload.delivery_summary;
  if (!isRecord(summary)) return { ok: false, reason: "missing_fields" };

  const orderId = text(payload.order_id);
  const offerId = text(payload.offer_id);
  const deliveryId = text(summary.delivery_id);
  const requestedQty = integer(summary.requested_qty);

  if (!orderId || !offerId || !deliveryId) {
    return { ok: false, reason: "missing_fields" };
  }
  if (requestedQty < 1 || requestedQty > G2G_MAX_DELIVERY_QTY) {
    return { ok: false, reason: "invalid_quantity" };
  }

  return {
    ok: true,
    event: {
      eventId: text(value.id) || `${orderId}:${deliveryId}`,
      eventType,
      orderId,
      offerId,
      sellerId: text(payload.seller_id),
      deliveryId,
      requestedQty,
      expiredAt: integer(summary.expired_at),
      deliveryMethodCode: text(summary.delivery_method_code),
    },
  };
}

/* ------------------------------ Garde-fou de marge ------------------------------ */

export interface G2gMarginInput {
  /** Prix de vente unitaire affiché sur l'offre G2G (dans `saleCurrency`). */
  unitPrice: number;
  /** Devise déclarée dans la correspondance (ex. USD, EUR). */
  saleCurrency: string;
  /** Devise réellement lue sur l'offre G2G (doit correspondre à `saleCurrency`). */
  offerCurrency?: string;
  /** Taux explicite : 1 unité de `saleCurrency` = X USD (obligatoire hors USD, 1 pour USD). */
  conversionRateUsd?: number;
  /** Coût forfaitaire de conversion / retrait en USD par livraison (défaut 0). */
  conversionCostUsd?: number;
  /** Coût fournisseur (FazerCards) par unité, en USD. */
  costUsd: number;
  /** Commission G2G + frais de retrait estimés, en pourcentage. */
  feePercent: number;
  /** Marge nette minimale exigée, en pourcentage. */
  minMarginPercent: number;
  /** Plafond d'achat automatique pour la livraison entière, en USD. */
  maxCostUsd: number;
  requestedQty: number;
}

export type G2gMarginVerdict = {
  ok: boolean;
  reason?: "invalid" | "currency" | "quantity" | "cap" | "margin";
  netRevenueUsd: number;
  totalCostUsd: number;
  netMarginPercent: number;
};

/**
 * Refuse par défaut (`fail-closed`) toute livraison automatique dont la
 * rentabilité n'est pas démontrable. Hors USD, un taux `conversionRateUsd`
 * explicite et la concordance `offerCurrency === saleCurrency` sont exigés ;
 * les coûts de conversion (`conversionCostUsd`) sont intégralement déduits
 * du revenu net après commission G2G.
 */
export function evaluateG2gMargin(input: G2gMarginInput): G2gMarginVerdict {
  const empty: G2gMarginVerdict = {
    ok: false,
    reason: "invalid",
    netRevenueUsd: 0,
    totalCostUsd: 0,
    netMarginPercent: 0,
  };

  const { unitPrice, costUsd, feePercent, minMarginPercent, maxCostUsd, requestedQty } = input;
  const conversionCostUsd = input.conversionCostUsd ?? 0;
  if (
    !Number.isFinite(unitPrice) || unitPrice <= 0 ||
    !Number.isFinite(costUsd) || costUsd <= 0 ||
    !Number.isFinite(feePercent) || feePercent < 0 || feePercent >= 100 ||
    !Number.isFinite(minMarginPercent) || minMarginPercent < 0 ||
    !Number.isFinite(maxCostUsd) || maxCostUsd <= 0 ||
    !Number.isFinite(conversionCostUsd) || conversionCostUsd < 0 ||
    !Number.isInteger(requestedQty) || requestedQty < 1 ||
    requestedQty > G2G_MAX_DELIVERY_QTY
  ) {
    return empty;
  }

  const saleCurrency = (input.saleCurrency ?? "").trim().toUpperCase();
  const offerCurrency = (input.offerCurrency ?? input.saleCurrency ?? "").trim().toUpperCase();
  if (
    !/^[A-Z]{3}$/.test(saleCurrency) ||
    !/^[A-Z]{3}$/.test(offerCurrency) ||
    offerCurrency !== saleCurrency
  ) {
    return { ...empty, reason: "currency" };
  }
  if (saleCurrency !== "USD" && input.conversionRateUsd === undefined) {
    return { ...empty, reason: "currency" };
  }
  const conversionRateUsd = input.conversionRateUsd ?? 1;
  if (
    !Number.isFinite(conversionRateUsd) ||
    conversionRateUsd <= 0 ||
    (saleCurrency === "USD" && conversionRateUsd !== 1)
  ) {
    return { ...empty, reason: "currency" };
  }

  const grossRevenueUsd = unitPrice * conversionRateUsd * requestedQty;
  const netRevenueUsd = grossRevenueUsd * (1 - feePercent / 100) - conversionCostUsd;
  const totalCostUsd = costUsd * requestedQty;
  const netMarginPercent = netRevenueUsd > 0
    ? ((netRevenueUsd - totalCostUsd) / netRevenueUsd) * 100
    : -100;

  const verdict: G2gMarginVerdict = {
    ok: true,
    netRevenueUsd: Math.round(netRevenueUsd * 100) / 100,
    totalCostUsd: Math.round(totalCostUsd * 100) / 100,
    netMarginPercent: Math.round(netMarginPercent * 100) / 100,
  };

  if (totalCostUsd > maxCostUsd) return { ...verdict, ok: false, reason: "cap" };
  if (netRevenueUsd <= 0 || netMarginPercent < minMarginPercent) {
    return { ...verdict, ok: false, reason: "margin" };
  }
  return verdict;
}

/* ------------------- Événement de test webhook (admin) ------------------- */

/**
 * Verdict d'un envoi de test `order.api_delivery`.
 *
 * Le texte affiché à l'administrateur vit côté interface (comme `STORE_HINTS`) ;
 * ce classifieur reste pur et testable : il ne fait que nommer la situation
 * pour éviter qu'un `401` (signature) ne soit pris pour une panne réseau.
 */
export type G2gWebhookTestVerdict =
  | "accepted"
  | "duplicate"
  | "bad_signature"
  | "not_configured"
  | "wrong_target"
  | "db_error"
  | "rejected"
  | "unreachable"
  | "unexpected";

/**
 * Construit un événement `order.api_delivery` synthétique, signable puis
 * envoyé à notre propre webhook pour valider toute la chaîne de réception.
 *
 * ⚠️ Strictement sans effet de bord réel : aucun achat fournisseur, aucune
 * écriture d'offre, et `delivery_id` est préfixé `TESTD` pour qu'une telle
 * ligne soit identifiable dans la table `webhook_events`.
 */
export function g2gBuildTestDeliveryEvent(input: {
  sellerId: string;
  offerId: string;
  timestamp: number;
}): Record<string, unknown> {
  const stamp = String(input.timestamp);
  return {
    id: `test-${stamp}`,
    event_happened_at: input.timestamp,
    event_type: "order.api_delivery",
    payload: {
      order_id: `TEST-ORDER-${stamp}`,
      buyer_id: "0",
      seller_id: input.sellerId,
      offer_id: input.offerId,
      purchased_qty: 1,
      delivered_qty: 0,
      undelivered_qty: 1,
      delivery_summary: {
        delivery_id: `TESTD${stamp}`,
        delivery_mode: "normal",
        requested_qty: 1,
        requested_at: input.timestamp,
        expired_at: 0,
        delivery_method_code: "direct_top_up",
      },
    },
  };
}

/**
 * Classe la réponse obtenue après l'envoi d'un événement de test.
 *
 * `httpStatus` vaut `null` quand la requête n'a pas abouti (DNS, TLS,
 * timeout) — on ne confond alors jamais l'injoignabilité avec un rejet.
 */
export function g2gWebhookTestVerdict(input: {
  httpStatus: number | null;
  body?: unknown;
  networkError?: boolean;
}): G2gWebhookTestVerdict {
  if (input.networkError || input.httpStatus === null) return "unreachable";

  const status = input.httpStatus;
  const body = isRecord(input.body) ? input.body : {};
  const error = typeof body.error === "string" ? body.error : "";

  // Le rejet de signature passe AVANT tout : c'est la panne la plus
  // probable (token régénéré côté G2G sans mise à jour côté Vercel).
  if (status === 401 || error === "invalid_signature") return "bad_signature";
  // Deux causes très différentes partagent le statut 503 : il faut les
  // séparer, sinon on cherche une variable manquante alors que c'est la
  // base de données qui est indisponible.
  if (error === "db_unavailable") return "db_error";
  if (status === 503 || error === "not_configured") return "not_configured";

  // Notre webhook répond toujours en 200 sur un POST valide ; un 404/405
  // signifie que `G2G_WEBHOOK_URL` ne pointe pas sur `/api/webhooks/g2g`.
  if (status === 404 || status === 405) return "wrong_target";

  if (status === 200) {
    if (body.duplicate === true) return "duplicate";
    if (body.ok === true || body.dry_run === true) return "accepted";
    return "unexpected";
  }

  if (status >= 400) return "rejected";
  return "unexpected";
}
