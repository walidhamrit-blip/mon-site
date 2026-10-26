#!/usr/bin/env node
/**
 * Garde-fous de l'intégration FazerCards :
 *   1. catalogue mis en cache (fraîcheur bornée, synchro à vol unique,
 *      repli sur le dernier catalogue connu, jamais écrasé par une
 *      synchronisation vide) ;
 *   2. routage de la livraison : une commande du catalogue FazerCards
 *      (`fzr-…`) est achetée chez FazerCards, une commande historique
 *      reste livrée chez Reloadly ;
 *   3. la caisse FazerCards transmet le vrai `category_id` et les champs
 *      acheteur (player_id…) au lieu de les perdre.
 *
 * Ces tests lisent la source : ils vérifient le câblage, pas le réseau.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

function read(relativePath) {
  return readFileSync(`${root}/${relativePath}`, "utf8");
}

/** Retire commentaires et espaces pour ne comparer que le code exécuté. */
function code(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^[ \t]*\/\/.*$/gm, " ")
    .replace(/\s+/g, " ");
}

function bodyOf(source, functionName) {
  const flat = code(source);
  const start = flat.indexOf(`export async function ${functionName}`);
  const fallback =
    start === -1 ? flat.indexOf(`export function ${functionName}`) : start;
  assert.notEqual(fallback, -1, `fonction ${functionName} introuvable`);
  const nextExport = flat.indexOf("export ", fallback + 1);
  return flat.slice(fallback, nextExport === -1 ? flat.length : nextExport);
}

const catalog = read("src/lib/fazercards-catalog.ts");
const orders = read("src/lib/fazercards-orders.ts");
const digitalOrders = read("src/lib/digital-orders.ts");
const ipn = read("src/app/api/payments/ipn/route.ts");
const checkout = read("src/app/api/fazercards/checkout/route.ts");
const envExample = read(".env.example");

/* ----------------------------- Cache catalogue --------------------------- */

test("le catalogue expose un cache avec TTL et repli périmé", () => {
  assert.match(catalog, /export async function getFazercardsCatalog\(/);
  assert.match(catalog, /FAZERCARDS_CATALOG_TTL_SECONDS/);
  assert.match(catalog, /FAZERCARDS_CATALOG_MAX_STALE_MINUTES/);
  assert.match(catalog, /export function invalidateFazercardsCatalogCache\(/);
  assert.match(catalog, /export function fazercardsCatalogCacheStatus\(/);
});

test("une seule synchronisation à la fois (vol unique)", () => {
  const body = bodyOf(catalog, "getFazercardsCatalog");
  assert.match(catalog, /let catalogInflight: Promise<FazercardsSyncResult> \| null = null/);
  const refresh = code(catalog).slice(
    code(catalog).indexOf("function refreshFazercardsCatalog"),
    code(catalog).indexOf("function snapshot"),
  );
  assert.match(refresh, /if \(catalogInflight\) return catalogInflight;/);
  assert.match(refresh, /catalogInflight = null;/);
  // Le cache est servi sans appel réseau tant que le TTL n'est pas dépassé.
  assert.match(body, /ageMs < ttlMs/);
  // Repli : un catalogue périmé reste utilisable si le rafraîchissement échoue.
  assert.match(body, /usableStale/);
});

test("une synchronisation vide n'écrase jamais un catalogue valide", () => {
  const flat = code(catalog);
  assert.match(
    flat,
    /if \(result\.products\.length > 0\) \{ catalogCache = \{ result, fetchedAt: Date\.now\(\) \}; \}/,
  );
});

test("la caisse utilise le catalogue en cache, pas une synchro par requête", () => {
  const flat = code(checkout);
  assert.match(flat, /getFazercardsCatalog\(\)/);
  assert.doesNotMatch(flat, /syncFazercardsCatalog\(\)/);
});

test("les variables de cache sont documentées dans .env.example", () => {
  assert.match(envExample, /FAZERCARDS_CATALOG_TTL_SECONDS=600/);
  assert.match(envExample, /FAZERCARDS_CATALOG_MAX_STALE_MINUTES=60/);
});

/* ------------------------------ Routage IPN ------------------------------ */

test("les préfixes de slug identifient le fournisseur", () => {
  const flat = code(catalog);
  assert.match(flat, /FAZERCARDS_SLUG_PREFIXES = \[ "fzr-topup-", "fzr-giftcard-", "fzr-gamekey-", \]/);
  assert.match(flat, /export function isFazercardsProductSlug\(/);
});

test("la livraison route les commandes fzr-… vers FazerCards", () => {
  const body = bodyOf(digitalOrders, "deliverPaidDigitalOrder");
  assert.match(body, /digitalOrderSupplier\(loaded\) === "fazercards"/);
  assert.match(body, /deliverPaidFazercardsOrder\(loaded\.id\)/);
  // Le routage doit précéder les contrôles Reloadly (config, produit relié).
  assert.ok(
    body.indexOf("deliverPaidFazercardsOrder") < body.indexOf("reloadlyConfigured"),
    "le fournisseur doit être choisi AVANT les contrôles Reloadly",
  );
});

test("le fournisseur par défaut reste Reloadly (commandes historiques)", () => {
  const flat = code(digitalOrders);
  assert.match(
    flat,
    /export function digitalOrderSupplier\(order: \{ productSlug\?: string \| null; productId\?: string \| null; \}\): DigitalSupplier \{ return isFazercardsProductRef\(order\.productSlug, order\.productId\) \? "fazercards" : "reloadly"; \}/,
  );
});

test("l'IPN NOWPayments déclenche la livraison quel que soit le fournisseur", () => {
  const flat = code(ipn);
  assert.match(flat, /if \(order\.digitalOrderId\) \{/);
  assert.match(flat, /deliverPaidDigitalOrder\(order\.digitalOrderId\)/);
});

/* ----------------------------- Caisse FazerCards ------------------------- */

test("la caisse mémorise le vrai category_id et les champs acheteur", () => {
  const body = bodyOf(orders, "createFazercardsCheckout");
  assert.match(body, /productId: product\.categoryId/);
  assert.match(body, /productSlug: input\.productId/);
  assert.match(body, /buyerFields/);
  assert.match(body, /buyer_fields_required/);
});

test("l'achat différé relit le category_id et les champs stockés", () => {
  const flat = code(orders);
  assert.match(flat, /const categoryId = order\.productId;/);
  assert.match(flat, /fields: storedBuyerFields\(order\)/);
  // Plus de reconstruction du category_id à partir du slug.
  assert.doesNotMatch(flat, /categoryId\.replace\("fzr-topup-", ""\)/);
});

test("le checkout expose categoryId à l'adaptateur", () => {
  assert.match(code(checkout), /categoryId: p\.categoryId/);
});

/* ------------------------- Suivi public (sécurité) ----------------------- */

test("la route de suivi FazerCards exige le jeton (jamais le seul ref)", () => {
  const route = read("src/app/api/fazercards/orders/[ref]/route.ts");
  const flat = code(route);
  assert.match(flat, /trackingTokenFromRequest\(req\)/);
  assert.match(flat, /getPublicDigitalOrder\(/);
  // Aucun déchiffrement direct : les codes ne sortent que par la couche
  // publique, qui vérifie l'empreinte du jeton.
  assert.doesNotMatch(flat, /decryptDigitalCodes\(/);
  assert.match(flat, /Cache-Control": "no-store"/);
});

/* ------------------- Compatibilité Next 16 (build Vercel) --------------- */

test("les routes dynamiques attendent params : Promise (Next 16)", () => {
  const files = [
    "src/app/api/fazercards/orders/[ref]/route.ts",
    "src/app/api/digital/orders/[ref]/route.ts",
  ];
  for (const file of files) {
    const flat = code(read(file));
    assert.match(
      flat,
      /params: Promise<\{/,
      `${file} : params doit être un Promise (sinon le build Next échoue)`,
    );
    assert.doesNotMatch(
      flat,
      /params: \{ ref: string \} \}/,
      `${file} : signature de params obsolète (Next 15/16)`,
    );
  }
});

/* ------------------------------ Sonde santé ----------------------------- */

test("/api/health expose l'état FazerCards sans le solde", () => {
  const flat = code(read("src/app/api/health/route.ts"));
  assert.match(flat, /checkFazercardsCredentials\(\{ timeoutMs: 6000 \}\)/);
  assert.match(flat, /fazercards,/);
  assert.match(flat, /catalog: fazercardsCatalogCacheStatus\(\)/);
  // Le solde est une donnée financière : jamais dans l'objet renvoyé.
  const block = flat.slice(
    flat.indexOf("const fazercards = {"),
    flat.indexOf("const ok ="),
  );
  assert.ok(block.length > 0, "bloc fazercards introuvable");
  assert.doesNotMatch(block, /balance/, "le solde ne doit pas être exposé");
});

/* ------------- Garde-fou sandbox/live (codes de test vendus) ------------- */

test("aucune vente automatique quand Reloadly est en sandbox et le paiement réel", () => {
  const flat = code(digitalOrders);
  assert.match(flat, /export function reloadlyEnvironmentMismatch\(\): boolean/);
  assert.match(flat, /if \(nowPaymentsSandbox\(\)\) return false;/);
  assert.match(flat, /return reloadlyMode\(\) === "sandbox";/);
  // Caisse : refus AVANT encaissement.
  assert.match(flat, /reloadlyEnvironmentMismatch\(\)\) \{ console\.error\(/);
  assert.match(flat, /"supplier_mode_mismatch"/);
  // Livraison : bascule manuelle, jamais d'achat de code de test.
  assert.match(flat, /aucun code de test n'a été acheté/);
});
