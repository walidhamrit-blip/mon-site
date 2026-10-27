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
    /if \(result\.products\.length > 0\) \{ const fetchedAt = Date\.now\(\); catalogCache = \{ result, fetchedAt \};/,
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

/* --------------------- Vitrine branchée sur FazerCards ------------------ */

const store = read("src/lib/digital-store.ts");
const types = read("src/lib/digital-types.ts");
const dialog = read("src/components/digital-buy-dialog.tsx");
const detailsPage = read("src/app/(site)/codes/[slug]/page.tsx");

test("le catalogue public vient du fournisseur quand la clé est configurée", () => {
  const flat = code(store);
  assert.match(flat, /async function getLiveCatalog\(\): Promise<DigitalProduct\[\] \| null>/);
  assert.match(flat, /if \(!fazercardsConfigured\(\)\) return null;/);
  assert.match(flat, /getFazercardsDigitalCatalog\(\{ noSync: true \}\)/);
  // L'admin reste sur la base : une fiche fournisseur n'est pas éditable.
  assert.match(flat, /if \(!publicOnly\) return getStoredCatalog\(\{ publicOnly: false \}\);/);
  // Le build ne dépend jamais de l'API tierce.
  assert.match(flat, /NEXT_PHASE === "phase-production-build"/);
});

test("les fiches converties portent leur fournisseur", () => {
  assert.match(code(types), /export type DigitalSupplier = "fazercards" \| "reloadly";/);
  assert.match(code(types), /supplier\?: DigitalSupplier;/);
  // Les fiches de la base sont explicitement Reloadly.
  assert.match(code(store), /supplier: "reloadly"/);
  assert.match(code(catalog), /supplier: "fazercards"/);
});

test("le dialogue d'achat route vers la caisse du bon fournisseur", () => {
  const flat = code(dialog);
  assert.match(flat, /const isFazercards = product\.supplier === "fazercards";/);
  assert.match(flat, /isFazercards \? "\/api\/fazercards\/checkout" : "\/api\/digital\/checkout"/);
  // Champs acheteur (player_id…) saisis avant l'encaissement.
  assert.match(flat, /requiredFields/);
  assert.match(flat, /fields: buyerFields/);
});

test("les fiches produit ne sont plus pré-générées au build", () => {
  assert.match(code(detailsPage), /export async function generateStaticParams\(\): Promise<\{ slug: string \}\[\]> \{ return \[\]; \}/);
  assert.match(code(detailsPage), /export const revalidate = 60;/);
});

test("l'API catalogue public n'expose jamais le coût d'achat", () => {
  const route = read("src/app/api/fazercards/catalog/route.ts");
  const flat = code(route);
  assert.match(flat, /getFazercardsDigitalCatalog\(\{ force \}\)/);
  assert.doesNotMatch(flat, /supplierCostUsd/, "le coût fournisseur reste interne");
  assert.match(flat, /supplier_not_configured/);
});

test("la synchro du catalogue est bornée (parallélisme + plafond)", () => {
  const flat = code(catalog);
  assert.match(flat, /FAZERCARDS_CATALOG_CONCURRENCY/);
  assert.match(flat, /FAZERCARDS_CATALOG_MAX_CATEGORIES/);
  assert.match(flat, /async function mapWithConcurrency<T>/);
  assert.match(flat, /await mapWithConcurrency\(topups\.items\.slice\(0, limit\), concurrency/);
});

/* -------------------- Catalogue réel : défauts observés --------------- */

test("les titres utilisent les types du domaine (pas les clés fournisseur)", () => {
  const flat = code(catalog);
  // Le mappeur reçoit `game_topup` / `software_key` : ces clés doivent exister.
  assert.match(flat, /titleFor\("game_topup"/);
  assert.match(flat, /titleFor\("software_key"/);
  assert.match(flat, /game_topup:? \{ ar:/);
  assert.match(flat, /software_key:? \{ ar:/);
  // Les anciennes clés (`topup`, `game_key`) donnaient « Digital Product ».
  assert.doesNotMatch(flat, /(?<![_a-z])topup: \{ ar:/);
});

test("aucun nom de fournisseur dans les textes publics", () => {
  // Uniquement les descriptions RÉELLES (gabarits `...`), pas les types.
  const texts = catalog.match(/description(?:Ar|En): `[^`]*`/g) ?? [];
  assert.ok(texts.length > 0, "descriptions introuvables");
  for (const text of texts) {
    assert.doesNotMatch(text, /FazerCards/i, `fuite de marque fournisseur : ${text}`);
  }
});

test("la caisse refuse une facture sous le minimum crypto", () => {
  const flat = code(orders);
  assert.match(flat, /const minOrderUsd = fazercardsMinOrderUsd\(\);/);
  assert.match(flat, /"below_minimum"/);
  const dialogFlat = code(dialog);
  assert.match(dialogFlat, /MIN_CRYPTO_INVOICE_USD/);
  assert.match(dialogFlat, /belowMinimum/);
  assert.match(dialogFlat, /disabled=\{busy \|\| !selected \|\| belowMinimum \|\| aboveLimit\}/);
});

test("le plafond d'achat est refusé AVANT l'encaissement", () => {
  const flat = code(orders);
  assert.match(flat, /const maxOrderUsd = fazercardsMaxOrderUsd\(\);/);
  assert.match(flat, /"above_limit"/);
  // La caisse doit refuser, pas laisser livrer en manuel après paiement.
  assert.ok(
    flat.indexOf('"above_limit"') < flat.indexOf("createInvoice("),
    "le plafond doit être vérifié avant la création de la facture",
  );
  const dialogFlat = code(dialog);
  assert.match(dialogFlat, /aboveLimit/);
  assert.match(dialogFlat, /!selected \|\| belowMinimum \|\| aboveLimit/);
});

/* ------------- Catalogue persisté (rendu de page sans synchro) ---------- */

const cronRoute = read("src/app/api/cron/fazercards-catalog/route.ts");
const storeFile = read("src/lib/fazercards-catalog-store.ts");
const vercelJson = read("vercel.json");

test("le catalogue est persisté en base (copie partagée)", () => {
  const flat = code(storeFile);
  assert.match(flat, /FAZERCARDS_CATALOG_SETTING_KEY = "fazercards:catalog"/);
  assert.match(flat, /export async function readStoredFazercardsCatalog\(/);
  assert.match(flat, /export async function writeStoredFazercardsCatalog\(/);
  assert.match(flat, /onConflictDoUpdate/);
  // Une synchro vide ne doit jamais écraser la copie valide.
  assert.match(flat, /if \(result\.products\.length === 0\) return false;/);
});

test("une instance neuve lit la base avant de synchroniser", () => {
  const flat = code(catalog);
  assert.match(flat, /const stored = await readStoredFazercardsCatalog\(\);/);
  assert.match(flat, /await writeStoredFazercardsCatalog\(result, fetchedAt\)/);
});

test("le rendu des pages ne synchronise jamais (sinon timeout -> 500)", () => {
  assert.match(
    code(store),
    /getFazercardsDigitalCatalog\(\{ noSync: true \}\)/,
    "la vitrine doit lire la copie persistée",
  );
  const flat = code(catalog);
  // noSync sert la copie périmée immédiatement, en planifiant le
  // rafraîchissement APRÈS la réponse (jamais pendant).
  assert.match(flat, /if \(options\.noSync\) \{ scheduleBackgroundRefresh\(ttlMs\); return snapshot\(cache, \{ cached: true, stale: true \}\); \}/);
  // …et échoue proprement s'il n'y a aucune copie (repli catalogue historique).
  assert.match(flat, /Catalogue FazerCards indisponible \(aucune copie en cache\)/);
});

test("le cron reste compatible avec le plan Hobby (une fois par jour)", () => {
  assert.match(code(cronRoute), /export const maxDuration = 60;/);
  assert.match(code(cronRoute), /getFazercardsCatalog\(\{ force: true \}\)/);
  assert.match(code(cronRoute), /CRON_SECRET/);
  assert.match(vercelJson, /"path": "\/api\/cron\/fazercards-catalog"/);
  // ⚠️ Un cron plus fréquent qu'une fois par jour fait ÉCHOUER le déploiement
  // Vercel sur le plan Hobby (constaté : build rejeté avec *\/10).
  assert.match(vercelJson, /"0 4 \* \* \*"/);
  assert.doesNotMatch(vercelJson, /"\*\/10 /);
});

test("le catalogue se rafraîchit après la réponse (after), jamais dedans", () => {
  const flat = code(catalog);
  assert.match(flat, /import \{ after \} from "next\/server"/);
  assert.match(flat, /function scheduleBackgroundRefresh\(ttlMs: number\): void/);
  assert.match(flat, /after\(async \(\) => \{/);
  // Le rendu planifie le rafraîchissement ET sert la copie immédiatement.
  assert.match(flat, /scheduleBackgroundRefresh\(ttlMs\); return snapshot\(cache, \{ cached: true, stale: true \}\);/);
});

test("une synchro réussie invalide le cache des pages du catalogue", () => {
  const flat = code(catalog);
  assert.match(flat, /import \{ revalidatePath \} from "next\/cache"/);
  assert.match(flat, /function revalidateCatalogPages\(\): void/);
  assert.match(flat, /revalidatePath\("\/codes", "layout"\)/);
  // Appelée juste après l'écriture de la copie partagée.
  assert.match(
    flat,
    /await writeStoredFazercardsCatalog\(result, fetchedAt\); revalidateCatalogPages\(\);/,
  );
});

test("le catalogue applique le barème dégressif, plus une marge unique", () => {
  const flat = code(catalog);
  assert.match(flat, /import \{ marginTierFor, retailPriceForCost \} from "@\/lib\/fazercards-pricing"/);
  // Les trois familles (top-up, carte cadeau, clé) passent par le barème.
  assert.equal(
    (flat.match(/priceUsd: retailPriceForCost\(cost\)\.priceUsd,/g) ?? []).length,
    3,
  );
  assert.doesNotMatch(flat, /DEFAULT_MARGIN/);
});

test("un paiement sur une chaîne coûteuse est signalé sans être refusé", () => {
  const flat = code(read("src/app/api/payments/ipn/route.ts"));
  assert.match(flat, /import \{ isHighCostNetwork \} from "@\/lib\/payment-networks"/);
  assert.match(flat, /if \(isHighCostNetwork\(payCurrency\)\) \{/);
  // Le client a payé : on ne refuse jamais, on avertit l'exploitant.
  const block = flat.slice(
    flat.indexOf("if (isHighCostNetwork(payCurrency))"),
    flat.indexOf("const claimed"),
  );
  assert.match(block, /console\.warn/);
  assert.doesNotMatch(block, /NextResponse\.json/);
});

test("le tunnel d'achat oriente vers les réseaux à frais minimes", () => {
  const flat = code(read("src/components/digital-buy-dialog.tsx"));
  assert.match(flat, /recommendedNetworksLabel\(\)/);
  assert.match(flat, /import \{ recommendedNetworksLabel \} from "@\/lib\/payment-networks"/);
});

test("la livraison lit l'extracteur partagé et distingue une recharge", () => {
  const flat = code(read("src/lib/fazercards-orders.ts"));
  assert.match(
    flat,
    /import \{\s*classifyFazercardsDelivery,\s*extractFazercardsCodes,\s*redactFazercardsPayload,\s*\} from "@\/lib\/fazercards-extract"/,
  );
  // L'extraction travaille sur le payload, pas sur l'enveloppe.
  assert.match(flat, /extractFazercardsCodes\(orderDetail\.order\.payload\)/);
  // Plus d'ancien extracteur local (il ignorait `payload.keys`).
  assert.doesNotMatch(flat, /function extractFazercardsCodes/);
  assert.match(flat, /if \(verdict === "topup_completed"\) \{/);
  assert.match(flat, /sendDigitalTopupDeliveredEmail\(/);
});

test("un échec d'extraction journalise une réponse masquée", () => {
  const flat = code(read("src/lib/fazercards-orders.ts"));
  assert.match(flat, /redactFazercardsPayload\(orderDetail\.order\.payload \?\? \{\}\)/);
  // La clé ne doit jamais être écrite en clair dans les logs.
  assert.doesNotMatch(flat, /console\.warn\([^)]*orderDetail\.order\.payload\)/);
});

test("l'admin peut clôturer une recharge sans inventer de code", () => {
  const orders = code(read("src/lib/digital-orders.ts"));
  assert.match(orders, /options: \{ withoutCodes\?: boolean \} = \{\}/);
  assert.match(orders, /if \(order\.kind !== "game_topup"\) \{/);
  const actions = code(read("src/app/admin/actions.ts"));
  assert.match(actions, /export async function closeDigitalOrderWithoutCodeAction/);
  const table = code(read("src/app/admin/(panel)/digital/orders/digital-orders-table.tsx"));
  assert.match(table, /closeDigitalOrderWithoutCodeAction/);
});
