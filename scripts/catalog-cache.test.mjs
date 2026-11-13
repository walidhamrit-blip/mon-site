// Tests du cache de rendu (point 2 : TTFB / quota Neon).
//
// Deux familles d'assertions, sans base ni serveur :
//   1. le noyau PUR (`cache-tags.ts`) : tags, TTL et plan d'invalidation ;
//   2. le CÂBLAGE (lecture de source) : les pages catalogue et l'API lisent
//      bien le cache partagé, et le chemin panier/stock reste, lui, en temps
//      réel — c'est la contrepartie indispensable du cache.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  CACHE_TAGS,
  DIGITAL_CATALOG_REVALIDATE_SECONDS,
  SITE_DATA_REVALIDATE_SECONDS,
  invalidationPlan,
} from "../src/lib/cache-tags.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(`${root}/${path}`, "utf8");
/** Retire commentaires et espaces pour ne comparer que le code exécuté. */
const code = (source) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^[ \t]*\/\/.*$/gm, " ")
    .replace(/\s+/g, " ");

const catalogCache = read("src/lib/catalog-cache.ts");
const cacheInvalidate = read("src/lib/cache-invalidate.ts");
const digitalStore = read("src/lib/digital-store.ts");
const siteStore = read("src/lib/store.ts");
const codesPage = read("src/app/(site)/codes/page.tsx");
const productPage = read("src/app/(site)/codes/[slug]/page.tsx");
const categoryPage = read("src/app/(site)/codes/category/[kind]/page.tsx");
const homePage = read("src/app/(site)/page.tsx");
const productsApi = read("src/app/api/digital/products/route.ts");
const ordersLib = read("src/lib/digital-orders.ts");
const fazercardsOrders = read("src/lib/fazercards-orders.ts");

/* ------------------------------- Noyau pur ------------------------------- */

test("les tags décrivent des données, pas des pages", () => {
  assert.equal(CACHE_TAGS.site, "site-data");
  assert.equal(CACHE_TAGS.catalog, "digital-catalog");
});

test("les durées de vie restent courtes (borne de sécurité)", () => {
  // Le prix affiché ne doit jamais dater de plus d'une minute.
  assert.ok(DIGITAL_CATALOG_REVALIDATE_SECONDS <= 60);
  assert.ok(SITE_DATA_REVALIDATE_SECONDS <= 300);
});

test("le plan d'invalidation couvre tags ET chemins", () => {
  const catalog = invalidationPlan("catalog");
  assert.deepEqual(catalog.tags, ["digital-catalog"]);
  assert.ok(catalog.paths.includes("/codes"));

  const site = invalidationPlan("site");
  assert.deepEqual(site.tags, ["site-data"]);

  // Une écriture de configuration peut changer devise, marché, WhatsApp :
  // le catalogue est donc invalidé aussi (les deux tags).
  const both = invalidationPlan("both");
  assert.deepEqual([...both.tags].sort(), ["digital-catalog", "site-data"]);
  assert.ok(both.paths.includes("/codes/[slug]"));
});

/* ------------------------------ Câblage --------------------------------- */

test("le catalogue public passe par unstable_cache, avec tag et TTL", () => {
  const flat = code(catalogCache);
  assert.match(flat, /export const getPublicCatalogCached = unstable_cache\(/);
  assert.match(flat, /tags: \[CACHE_TAGS\.catalog\]/);
  assert.match(flat, /revalidate: DIGITAL_CATALOG_REVALIDATE_SECONDS/);
  // L'état de panne est renvoyé AVEC la donnée : il ne peut pas se
  // désynchroniser d'un snapshot mis en cache.
  assert.match(flat, /degraded: digitalCatalogStatus\(\)\.degraded/);
  assert.match(flat, /export const getSiteDataCachedShared = unstable_cache\(/);
  assert.match(flat, /tags: \[CACHE_TAGS\.site\]/);
});

test("les pages catalogue lisent le cache partagé, pas la base à chaque visite", () => {
  for (const [name, source] of [
    ["/codes", codesPage],
    ["/codes/[slug]", productPage],
    ["/codes/category/[kind]", categoryPage],
    ["/", homePage],
  ]) {
    assert.match(source, /getPublicCatalogCached\(\)/, `${name} doit lire le cache partagé`);
    assert.doesNotMatch(
      source,
      /await getDigitalCatalog\(\{ publicOnly: true \}\)/,
      `${name} ne doit plus appeler getDigitalCatalog directement au rendu`,
    );
  }
  // La fiche produit ne relit plus le catalogue via getDigitalProductBySlug
  // (seul le commentaire d'en-tête en parle encore, pour expliquer le choix).
  assert.doesNotMatch(code(productPage), /getDigitalProductBySlug/);
  assert.match(code(productPage), /async function productFromSharedCatalog\(slug: string\)/);
});

test("l'état de panne affiché reste celui de la lecture", () => {
  // Le bandeau « boutique indisponible » ne doit pas dépendre d'un état lu
  // plus tard (après une éventuelle reprise de la base).
  assert.match(code(codesPage), /const degraded = snapshot\.degraded \|\| status\.degraded;/);
  assert.match(
    code(categoryPage),
    /const degraded = snapshot\.degraded \|\| digitalCatalogStatus\(\)\.degraded;/,
  );
  assert.match(code(homePage), /const degraded = catalogDegraded \|\| digitalCatalogStatus\(\)\.degraded;/);
});

test("le panier revérifie le stock et le prix en base, en temps réel", () => {
  // C'est la contrepartie du cache : la page peut avoir 60 s, jamais la
  // commande. Le checkout relit la fiche ET vérifie la valeur faciale
  // acceptée par le fournisseur avant d'encaisser.
  const flat = code(ordersLib);
  assert.match(flat, /const product = await getDigitalProductBySlug\(input\.productSlug\);/);
  assert.match(flat, /const issue = await supplierPriceIssue\(productId, quote\.reloadlyUnitPrice\);/);

  // Côté FazerCards : disponibilité de la dénomination + quantité maximale
  // + solde fournisseur suffisant, vérifiés à la caisse.
  const fc = code(fazercardsOrders);
  assert.match(fc, /if \(!denomination\.available\) \{/);
  assert.match(fc, /quantity > denomination\.maxOrderQuantity/);
  assert.match(fc, /const balanceStatus = await getFazercardsBalanceStatus\(\);/);
});

test("une écriture du catalogue purge le cache partagé, pas seulement le mémo", () => {
  const flat = code(digitalStore);
  assert.match(flat, /export function clearPublicCatalogCache\(\): void \{/);
  assert.match(flat, /const \{ invalidateCatalogCaches \} = await import\("@\/lib\/cache-invalidate"\);/);
  // Les trois niveaux : mémo instance, cache partagé, HTML.
  assert.match(flat, /publicCatalogCache = null;/);
  assert.match(flat, /invalidateDigitalOverridesCache\(\);/);

  const inval = code(cacheInvalidate);
  assert.match(inval, /export function invalidateCatalogCaches\(\): void \{/);
  assert.match(inval, /invalidateTags\(\[CACHE_TAGS\.catalog\]\);/);
  assert.match(inval, /revalidateCatalogPages\(\);/);
  // `revalidatePath('/codes', 'layout')` couvre /codes/[slug] et les rayons
  // sans énumérer 280 chemins.
  assert.match(inval, /revalidatePath\("\/codes", "layout"\)/);
});

test("une écriture des réglages purge les deux tags et le HTML public", () => {
  const flat = code(siteStore);
  assert.match(flat, /export async function upsertSetting[\s\S]*invalidateSiteCaches\(\)/);
  assert.match(flat, /export async function deleteSetting[\s\S]*invalidateSiteCaches\(\)/);
  assert.match(code(cacheInvalidate), /invalidateTags\(\[CACHE_TAGS\.site, CACHE_TAGS\.catalog\]\)/);
});

test("l'invalidation ne casse jamais une écriture hors requête Next", () => {
  // Cron, script, test : `revalidate*` lève. On journalise et on continue ;
  // les TTL courts servent de filet.
  const flat = code(cacheInvalidate);
  assert.match(flat, /function safe\(operation: \(\) => void, label: string\): void \{/);
  assert.match(flat, /catch \(error\) \{ console\.warn\(/);
  // Server Action d'abord (read-your-own-writes), puis revalidateTag.
  assert.match(flat, /updateTag\(tag\);/);
  assert.match(flat, /revalidateTag\(tag, \{ expire: 0 \}\)/);
});

test("l'API publique du catalogue profite aussi du cache partagé", () => {
  const flat = code(productsApi);
  assert.match(flat, /getPublicCatalogCached\(\)/);
  assert.doesNotMatch(flat, /getDigitalCatalog\(/);
  // En-têtes CDN conservés : la réponse peut être servie sans exécuter la
  // fonction, et elle ne sert jamais à facturer.
  assert.match(flat, /s-maxage=300, stale-while-revalidate=3600/);
});

test("les pages catalogue restent dynamiques (jamais de repli figé au build)", () => {
  // Régression documentée dans l'en-tête de /codes : un rendu statique au
  // build figeait le catalogue de repli (10 fiches au lieu de 280).
  for (const source of [codesPage, productPage, categoryPage]) {
    assert.match(source, /export const dynamic = "force-dynamic";/);
  }
  // La page d'accueil garde son ISR horaire, mais lit le cache de données.
  assert.match(homePage, /export const revalidate = 3600;/);
});
