#!/usr/bin/env node
/**
 * Garde-fous du pilote G2G OpenAPI v2.
 *
 * Couvre le noyau pur (signatures HMAC, fenêtre de timestamp, décodage de
 * `order.api_delivery`, garde-fou de marge) et le câblage (authentification
 * admin, vérification AVANT lecture du corps, absence d'achat automatique,
 * aucun secret en clair dans le dépôt).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  G2G_MAX_DELIVERY_QTY,
  evaluateG2gMargin,
  g2gApiSignature,
  g2gBuildTestDeliveryEvent,
  g2gCanonicalPath,
  g2gErrorHint,
  g2gRequestHeaders,
  g2gSignaturesEqual,
  g2gWebhookSignature,
  g2gWebhookTestVerdict,
  isG2gTimestampFresh,
  parseG2gDeliveryEvent,
  verifyG2gWebhookSignature,
} from "../src/lib/g2g-core.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(`${root}/${path}`, "utf8");

/* -------------------------- Vecteurs officiels -------------------------- */

// https://docs.g2g.com/verifying-signatures-1237154m0
// ⚠️ Le hash IMPRIMÉ dans cette page (0884a10b…) ne se recalcule PAS avec
// les valeurs de son propre exemple (incohérence de la documentation).
// On valide donc la FORMULE (identique aux exemples JS/Python/PHP) contre
// une implémentation indépendante, et le vecteur webhook ci-dessous, qui
// lui se recalcule exactement.
const API_VECTOR = {
  secretKey: "dJirm8nG5AqQWoh7J5EHw3373Dk95zjRHaQ3gnv99kw",
  apiKey: "b5769724c1cb1d52c58717d3d12ae2fe",
  userId: "100000",
  timestamp: "1653278884000",
  canonicalPath: "/v1/offers/G1650445167989US/inventory_items/ba8551d9-47e3-424a-a809-4f043059eefb",
};

test("signature API = HMAC_SHA256(secretKey, path + apiKey + userId + timestamp)", () => {
  const expected = createHmac("sha256", API_VECTOR.secretKey)
    .update(
      API_VECTOR.canonicalPath +
        API_VECTOR.apiKey +
        API_VECTOR.userId +
        API_VECTOR.timestamp,
      "utf8",
    )
    .digest("hex");
  assert.equal(
    g2gApiSignature(API_VECTOR),
    expected,
  );
  assert.match(g2gApiSignature(API_VECTOR), /^[0-9a-f]{64}$/);
  // Chaque composant entre dans la signature : une clé ou un timestamp
  // différent ne doit jamais produire le même hash.
  assert.notEqual(g2gApiSignature({ ...API_VECTOR, apiKey: "autre" }), expected);
  assert.notEqual(g2gApiSignature({ ...API_VECTOR, userId: "100001" }), expected);
  assert.notEqual(g2gApiSignature({ ...API_VECTOR, timestamp: "1653278884001" }), expected);
  assert.notEqual(g2gApiSignature({ ...API_VECTOR, canonicalPath: "/v2/store" }), expected);
});

// https://docs.g2g.com/message-signature-1237168m0 — vecteur EXACT.
test("signature webhook = vecteur officiel G2G", () => {
  assert.equal(
    g2gWebhookSignature({
      secretToken: "gBW1wXgBNnA",
      webhookUrl: "https://www.your_webhook_url.com",
      userId: "100000",
      timestamp: "1653278884000",
    }),
    "645343db00f974f5dab1f9e9ed8d4846a265e150291009fe40bfbdf437cfa16a",
  );
});

test("chemin canonique : jamais d'hôte, query string conservée", () => {
  assert.equal(g2gCanonicalPath("/v2/store"), "/v2/store");
  assert.equal(
    g2gCanonicalPath("https://open-api.g2g.com/v2/offers/G123?limit=10"),
    "/v2/offers/G123?limit=10",
  );
  assert.equal(g2gCanonicalPath("v2/store"), "/v2/store");
});

/* ----------------------- Vérification des webhooks ----------------------- */

const WEBHOOK = {
  secretToken: "gBW1wXgBNnA",
  webhookUrl: "https://nokhba.net.ly/api/webhooks/g2g",
  userId: "1003177397",
  apiKey: "b5769724c1cb1d52c58717d3d12ae2fe",
  timestamp: "1653278884000",
  now: 1653278884000,
};

/**
 * Construit un webhook signé. Les `overrides` ne modifient QUE la signature :
 * la vérification, elle, utilise toujours les paramètres légitimes (sinon on
 * testerait « un faux secret accepté par un faux secret »).
 */
function signed(overrides = {}) {
  const { now = WEBHOOK.now, ...signingOverrides } = overrides;
  const signature = g2gWebhookSignature({ ...WEBHOOK, ...signingOverrides });
  return { ...WEBHOOK, now, signature };
}

test("vérifie une signature webhook correcte et refuse toutes les altérations", () => {
  assert.equal(verifyG2gWebhookSignature(signed()), true);
  assert.equal(verifyG2gWebhookSignature(signed({ secretToken: "mauvais" })), false);
  assert.equal(verifyG2gWebhookSignature(signed({ webhookUrl: "https://autre.example/webhook" })), false);
  assert.equal(verifyG2gWebhookSignature(signed({ userId: "1003177398" })), false);
  assert.equal(verifyG2gWebhookSignature(signed({ timestamp: "1653278884001" })), false);
  assert.equal(verifyG2gWebhookSignature({ ...signed(), signature: "" }), false);
  assert.equal(verifyG2gWebhookSignature({ ...signed(), signature: "z".repeat(64) }), false);
});

test("refuse un timestamp périmé (rejeu) ou invalide", () => {
  assert.equal(isG2gTimestampFresh("1653278884000", 1653278884000), true);
  assert.equal(isG2gTimestampFresh("1653278884000", 1653278884000 + 5 * 60 * 1000), true);
  assert.equal(isG2gTimestampFresh("1653278884000", 1653278884000 + 5 * 60 * 1000 + 1), false);
  assert.equal(isG2gTimestampFresh("1653278884000", 1653278884000 - 10 * 60 * 1000), false);
  assert.equal(isG2gTimestampFresh("abc", 1653278884000), false);
  assert.equal(verifyG2gWebhookSignature(signed({ now: 1653278884000 + 10 * 60 * 1000 })), false);
});

test("comparaison à temps constant : formes non hexadécimales refusées", () => {
  assert.equal(g2gSignaturesEqual("A".repeat(64), "a".repeat(64)), true);
  assert.equal(g2gSignaturesEqual("a".repeat(63), "a".repeat(64)), false);
  assert.equal(g2gSignaturesEqual("", ""), false);
});

/* ------------------------- Événements de livraison ------------------------- */

const GIFT_CARD_EVENT = {
  id: "341a6ae1-34da-486e-b984-91a6f44cea07",
  event_happened_at: 1661162789441,
  event_type: "order.api_delivery",
  payload: {
    order_id: "1637925438960TE5T-1",
    seller_id: "600001",
    buyer_id: "600002",
    offer_id: "G1650423467624TE",
    purchased_qty: 5,
    undelivered_qty: 3,
    delivery_summary: {
      delivery_id: "D1662278209721",
      delivery_mode: "normal",
      requested_qty: 4,
      requested_at: 1662278209721,
      expired_at: 1662279124000,
    },
  },
};

test("décode order.api_delivery sans conserver de donnée acheteur", () => {
  const parsed = parseG2gDeliveryEvent(GIFT_CARD_EVENT);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.event, {
    eventId: "341a6ae1-34da-486e-b984-91a6f44cea07",
    eventType: "order.api_delivery",
    orderId: "1637925438960TE5T-1",
    offerId: "G1650423467624TE",
    sellerId: "600001",
    deliveryId: "D1662278209721",
    requestedQty: 4,
    expiredAt: 1662279124000,
    deliveryMethodCode: "",
  });
});

test("ignore les autres événements et refuse les payloads incomplets", () => {
  assert.deepEqual(parseG2gDeliveryEvent({ event_type: "order.created", payload: {} }), {
    ok: false,
    reason: "unsupported_event",
    eventType: "order.created",
  });
  assert.equal(parseG2gDeliveryEvent(null).ok, false);
  assert.equal(parseG2gDeliveryEvent({}).ok, false);
  const noDeliveryId = structuredClone(GIFT_CARD_EVENT);
  delete noDeliveryId.payload.delivery_summary.delivery_id;
  assert.equal(parseG2gDeliveryEvent(noDeliveryId).reason, "missing_fields");
  const tooMany = structuredClone(GIFT_CARD_EVENT);
  tooMany.payload.delivery_summary.requested_qty = G2G_MAX_DELIVERY_QTY + 1;
  assert.equal(parseG2gDeliveryEvent(tooMany).reason, "invalid_quantity");
});

/* ------------------------------ Garde-fou de marge ------------------------------ */

test("marge : accepte une vente rentable, refuse marge faible, plafond et devise", () => {
  const base = {
    unitPrice: 3,
    saleCurrency: "USD",
    costUsd: 2,
    feePercent: 10,
    minMarginPercent: 12,
    maxCostUsd: 25,
    requestedQty: 1,
  };
  const good = evaluateG2gMargin(base);
  assert.equal(good.ok, true);
  assert.equal(good.netRevenueUsd, 2.7);
  assert.equal(good.totalCostUsd, 2);
  assert.equal(good.netMarginPercent, 25.93);

  assert.equal(evaluateG2gMargin({ ...base, costUsd: 2.6 }).reason, "margin");
  assert.equal(evaluateG2gMargin({ ...base, requestedQty: 20, maxCostUsd: 25 }).reason, "cap");
  assert.equal(evaluateG2gMargin({ ...base, saleCurrency: "MYR" }).reason, "currency");
  assert.equal(evaluateG2gMargin({ ...base, unitPrice: 0 }).reason, "invalid");
  assert.equal(evaluateG2gMargin({ ...base, requestedQty: 0 }).reason, "invalid");
});

/* -------------------------------- Câblage -------------------------------- */

test("le webhook vérifie la signature AVANT de lire le corps", () => {
  const route = read("src/app/api/webhooks/g2g/route.ts");
  assert.ok(route.indexOf("verifyG2gWebhookSignature") < route.indexOf("JSON.parse(rawBody)"));
  assert.match(route, /invalid_signature/);
  assert.match(route, /reserveWebhookEvent/);
  assert.match(route, /provider: "g2g"/);
  // Phase 1 : aucun achat fournisseur, aucune livraison G2G.
  assert.doesNotMatch(route, /fazercardsGiftCardOrder|fazercardsGameKeyOrder|g2gDeliverCodes/);
  assert.match(route, /dry_run: true/);
});

test("ouvrir l'URL du webhook dans un navigateur explique le 405 au lieu d'une page vide", () => {
  const route = read("src/app/api/webhooks/g2g/route.ts");
  const start = route.indexOf("export async function GET()");
  assert.ok(start > 0, "handler GET absent");
  const body = route.slice(start, route.indexOf("export async function POST"));
  // Le GET doit RESTER en 405 : c'est la preuve que la route est déployée
  // (une route inexistante renvoie 404), mais avec un corps explicatif.
  assert.match(body, /method_not_allowed/);
  assert.match(body, /405/);
  assert.match(body, /Allow: "POST"/);
  // Et surtout : aucune donnée de configuration ni secret dans cette réponse.
  assert.doesNotMatch(body, /webhookSecretToken|secretKey|cfg\.|g2gConfig/);
});

test("le diagnostic admin exige une session admin et ne renvoie aucun secret", () => {
  const route = read("src/app/api/admin/g2g/route.ts");
  assert.match(route, /isAdminAuthenticated\(\)/);
  assert.match(route, /"Cache-Control": "no-store"/);
  assert.doesNotMatch(route, /g2gConfig\(\)\.secretKey|secretKey,/);
  assert.match(route, /g2gConfigStatus\(\)/);
});

test("le client G2G signe chaque requête et ne journalise jamais le corps", () => {
  const client = read("src/lib/g2g.ts");
  for (const header of ["g2g-api-key", "g2g-userid", "g2g-timestamp", "g2g-signature"]) {
    assert.ok(client.includes(header), `en-tête manquant : ${header}`);
  }
  assert.match(client, /g2gRequestHeaders/);
  assert.match(client, /\/v2\/store/);
  assert.doesNotMatch(client, /console\.log\(.*raw/);
});

/* ------------------------------------------------------------------ *
 * Régression : `Content-Type` doit être envoyé sur CHAQUE requête.
 *
 * Sans lui, G2G répond « The request was unacceptable, often due to
 * missing a required parameter. Invalid Header 'Content-Type' » dès le
 * premier `GET /v2/store`, alors que la signature est pourtant correcte.
 * ------------------------------------------------------------------ */

test("chaque requête G2G porte Content-Type: application/json, corps ou non", () => {
  const headers = g2gRequestHeaders({
    ...API_VECTOR,
    timestamp: "1653278884000",
  });
  assert.equal(headers["Content-Type"], "application/json");
  // ⚠️ Mesuré sur l'API réelle (16/11/2026) : la variante
  // `application/json; charset=utf-8` est REFUSÉE (400, « Invalid Header
  // 'Content-Type' »), alors qu'elle est plus correcte en HTTP. La valeur
  // doit rester EXACTEMENT `application/json` — ne jamais l'enrichir.
  assert.equal(headers["Content-Type"], "application/json");
  assert.doesNotMatch(headers["Content-Type"], /charset/i);
  // ⚠️ Mesuré également : l'en-tête utilisateur est `g2g-userid` (sans
  // tirets). Avec `g2g-user-id`, G2G répond « Missing Header
  // 'g2g-user-id' » — il nomme la forme reçue, pas celle attendue.
  assert.ok(headers["g2g-userid"], "g2g-userid doit être présent");
  assert.equal(headers["g2g-user-id"], undefined);
  // Le test porte sur l'absence de corps : c'est le cas `GET /v2/store`.
  assert.equal(headers.Accept, "application/json");
  for (const header of ["g2g-api-key", "g2g-userid", "g2g-timestamp", "g2g-signature"]) {
    assert.ok(headers[header], `en-tête manquant : ${header}`);
  }
  // La signature reste celle du vecteur officiel (le refactoring ne l'a pas
  // altérée) et n'inclut ni Content-Type ni Accept.
  assert.equal(
    headers["g2g-signature"],
    createHmac("sha256", API_VECTOR.secretKey)
      .update(
        API_VECTOR.canonicalPath +
          API_VECTOR.apiKey +
          API_VECTOR.userId +
          API_VECTOR.timestamp,
        "utf8",
      )
      .digest("hex"),
  );
  assert.equal(headers["g2g-timestamp"], API_VECTOR.timestamp);
});

test("le client n'envoie plus Content-Type uniquement quand il y a un corps", () => {
  const client = read("src/lib/g2g.ts");
  // L'ancien code conditionnait l'en-tête à `options.body !== undefined`,
  // ce qui privait tous les GET (dont /v2/store) de Content-Type.
  assert.doesNotMatch(client, /options\.body !== undefined \? .*Content-Type/);
  assert.doesNotMatch(client, /if \(options\.body[^)]*\) headers\["Content-Type"\]/);
});

test("le script de vérification locale envoie aussi Content-Type sur le GET", () => {
  const script = read("scripts/g2g-check.mjs");
  // Le bloc d'appel réel : on extrait les en-têtes pour vérifier le GET nu.
  const call = script.slice(script.indexOf("await fetch(`${base}${path}`"));
  assert.match(call, /Accept: "application\/json"/);
  assert.match(call, /"Content-Type": "application\/json"/);
});

test("le diagnostic d'en-têtes reste en lecture seule et couvre les 2 hypothèses", () => {
  const client = read("src/lib/g2g.ts");
  const start = client.indexOf("/* ---------------- Diagnostic d'en-têtes");
  const end = client.indexOf("export async function g2gGetOffer");
  assert.ok(start > 0 && end > start, "bloc de diagnostic introuvable");
  const block = client.slice(start, end);
  // Strictement lecture seule : un GET /v2/store, aucune écriture.
  assert.match(block, /method: "GET"/);
  assert.doesNotMatch(block, /"POST"|"PATCH"|"DELETE"|g2gPatchOffer|g2gDeliverCodes/);
  assert.match(block, /\/v2\/store/);
  // Les deux hypothèses qui s'opposent (doc vs implémentations publiques).
  assert.match(block, /baseline/);
  assert.match(block, /no_content_type/);
  // Côté route, la session admin est vérifiée avant de lancer la sonde.
  // `lastIndexOf` cible l'appel dans le handler, pas l'import en tête de fichier.
  const route = read("src/app/api/admin/g2g/route.ts");
  assert.ok(route.indexOf("isAdminAuthenticated()") < route.lastIndexOf("g2gProbeStore"));
});

test("une panne de clés et une panne d'en-têtes ne sont jamais confondues", () => {
  // 400 + en-tête refusé => défaut de CODE, les clés n'y sont pour rien.
  assert.equal(
    g2gErrorHint({
      status: 400,
      message:
        "The request was unacceptable, often due to missing a required parameter. Invalid Header 'Content-Type'.",
    }),
    "headers",
  );
  // 401 => paire de clés désynchronisée (régénérer les DEUX ensemble).
  assert.equal(g2gErrorHint({ status: 401, message: "invalid signature" }), "signature");
  assert.equal(g2gErrorHint({ status: 401, message: "" }), "signature");
  // Une clé refusée signalée en 400 ne doit pas être rangée dans « headers ».
  assert.equal(g2gErrorHint({ status: 400, message: "Invalid api key" }), "signature");
  assert.equal(g2gErrorHint({ status: 403, message: "" }), "permissions");
  assert.equal(g2gErrorHint({ status: 429, message: "" }), "rate_limit");
  assert.equal(g2gErrorHint({ status: 503, message: "" }), "upstream");
  // Pas de statut = on n'a jamais joint G2G.
  assert.equal(g2gErrorHint({ status: null, message: "G2G injoignable" }), "network");
});

test("la route renvoie le SHA déployé pour distinguer « pas déployé » de « ne marche pas »", () => {
  const route = read("src/app/api/admin/g2g/route.ts");
  assert.match(route, /VERCEL_GIT_COMMIT_SHA/);
});

test("schéma et DDL créent la table de mapping désactivée par défaut", () => {
  const schema = read("src/db/schema.ts");
  const ddl = read("src/db/index.ts");
  assert.match(schema, /g2gOfferMappings/);
  assert.match(ddl, /CREATE TABLE IF NOT EXISTS g2g_offer_mappings/);
  assert.match(ddl, /enabled boolean NOT NULL DEFAULT false/);
});

/* ------------------------------------------------------------------ *
 * Événement de test du webhook (bouton admin).
 *
 * En phase 1, `api_qty = 0` interdit toute commande réelle : G2G
 * n'émet donc jamais d'événement spontanément. Sans bouton de test, la
 * première exécution du webhook aurait lieu le jour où un vrai client
 * paie. Le piège à éviter : un événement de test que NOTRE propre
 * parseur refuserait, ce qui ferait croire à une panne de signature.
 * ------------------------------------------------------------------ */

test("l'événement de test est accepté par notre propre parseur", () => {
  const sellerId = "1003177397";
  const timestamp = 1763323200000;
  const event = g2gBuildTestDeliveryEvent({
    sellerId,
    offerId: "G1793906316865GE",
    timestamp,
  });

  const parsed = parseG2gDeliveryEvent(event);
  assert.equal(parsed.ok, true, "l'événement de test doit être décodable");
  assert.equal(parsed.event.eventType, "order.api_delivery");
  assert.equal(parsed.event.offerId, "G1793906316865GE");
  assert.equal(parsed.event.sellerId, sellerId);
  assert.equal(parsed.event.requestedQty, 1);

  // Traçable et non rejouable : l'identifiant change à chaque envoi.
  assert.equal(parsed.event.deliveryId, `TESTD${timestamp}`);
  assert.match(parsed.event.deliveryId, /^TESTD/);

  // Surtout pas de donnée acheteur réelle ni de code.
  assert.equal(parsed.event.expiredAt, 0);
  const serialized = JSON.stringify(event);
  for (const secret of ["G2G_SECRET_KEY", "g2g-signature", "webhookSecretToken"]) {
    assert.doesNotMatch(serialized, new RegExp(secret));
  }
});

test("le verdict d'un événement de test distingue signature, config et cible", () => {
  // Accepté en mode « shadow » : c'est le cas nominal.
  assert.equal(
    g2gWebhookTestVerdict({ httpStatus: 200, body: { ok: true, dry_run: true } }),
    "accepted",
  );
  // Rejoué : la chaîne fonctionnait déjà.
  assert.equal(
    g2gWebhookTestVerdict({ httpStatus: 200, body: { ok: true, duplicate: true } }),
    "duplicate",
  );
  // Le piège classique : token régénéré côté G2G sans mise à jour Vercel.
  assert.equal(
    g2gWebhookTestVerdict({ httpStatus: 401, body: { error: "invalid_signature" } }),
    "bad_signature",
  );
  // Variables absentes du déploiement qui répond.
  assert.equal(
    g2gWebhookTestVerdict({ httpStatus: 503, body: { error: "not_configured" } }),
    "not_configured",
  );
  // Même statut 503, cause opposée : la signature était bonne, c'est la base.
  // Les confondre ferait chercher une variable manquante pour rien.
  assert.equal(
    g2gWebhookTestVerdict({ httpStatus: 503, body: { error: "db_unavailable" } }),
    "db_error",
  );
  // L'URL ne pointe pas sur /api/webhooks/g2g.
  assert.equal(g2gWebhookTestVerdict({ httpStatus: 404, body: {} }), "wrong_target");
  assert.equal(g2gWebhookTestVerdict({ httpStatus: 405, body: {} }), "wrong_target");
  // Injoignable : jamais confondu avec un rejet applicatif.
  assert.equal(g2gWebhookTestVerdict({ httpStatus: null, networkError: true }), "unreachable");
  assert.equal(g2gWebhookTestVerdict({ httpStatus: 400, body: { error: "invalid_json" } }), "rejected");
  assert.equal(g2gWebhookTestVerdict({ httpStatus: 200, body: { hello: 1 } }), "unexpected");
});

test("le test du webhook exige un admin et n'expose ni secret ni signature", () => {
  const route = read("src/app/api/admin/g2g/webhook-test/route.ts");
  assert.match(route, /isAdminAuthenticated\(\)/);
  assert.match(route, /export const runtime = "nodejs"/);
  // La cible reste sous contrôle : https imposé en production.
  assert.match(route, /protocol !== "https:"/);
  // Timeout : un test ne doit pas immobiliser la fonction.
  assert.match(route, /AbortSignal\.timeout\(/);
  assert.match(route, /g2gWebhookTestVerdict/);

  // La charge renvoyée au navigateur : des verdicts et des statuts, point.
  const start = route.indexOf("ok: verdict ===");
  assert.notEqual(start, -1, "bloc de réponse du test introuvable");
  const payload = route.slice(start, route.indexOf("\n  });", start));
  assert.match(payload, /verdict,/);
  assert.match(payload, /deliveryId/);
  assert.doesNotMatch(payload, /signature/);
  assert.doesNotMatch(payload, /secretToken|apiKey|secretKey/);

  // Variable absente : seul son NOM est exposé, jamais sa valeur.
  const missingAt = route.indexOf("const missing = [");
  assert.notEqual(missingAt, -1, "bloc « variables manquantes » introuvable");
  const missingBlock = route.slice(
    missingAt,
    route.indexOf("return noStoreJson(", missingAt),
  );
  assert.match(missingBlock, /"G2G_WEBHOOK_SECRET_TOKEN"/);
  assert.doesNotMatch(missingBlock, /: cfg\./);
});

test("aucun secret G2G en clair dans le dépôt", () => {
  const env = read(".env.example");
  for (const key of [
    "G2G_API_KEY",
    "G2G_SECRET_KEY",
    "G2G_USER_ID",
    "G2G_WEBHOOK_SECRET_TOKEN",
    "G2G_WEBHOOK_URL",
  ]) {
    assert.match(env, new RegExp(`^${key}=$`, "m"));
  }
  const panel = read("src/app/admin/(panel)/digital/g2g-panel.tsx");
  assert.match(panel, /Phase 1 — aucun achat automatique/);
  assert.match(panel, /api_qty = 0/);
  assert.match(read("src/app/admin/(panel)/digital/page.tsx"), /<G2gPanel \/>/);
});
