#!/usr/bin/env node
/**
 * Garde-fou « boutique en panne ».
 *
 * Incident réel (29/10/2026) : le quota de calcul Neon était épuisé, la base
 * suspendue. Le site a continué à afficher 8 fiches de démonstration comme
 * si c'était le catalogue, le sitemap les a publiées, et le formulaire de
 * contact répondait 500 **sans envoyer d'e-mail** — les demandes clients
 * étaient perdues. Le diagnostic lui-même était illisible (« Failed query »).
 *
 * Ces tests vérifient le câblage des quatre correctifs, sans base ni réseau.
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

const store = read("src/lib/digital-store.ts");
const sitemap = read("src/app/sitemap.ts");
const leadRoute = read("src/app/api/lead/route.ts");
const healthRoute = read("src/app/api/health/route.ts");
const codesPage = read("src/app/(site)/codes/page.tsx");
const mailer = read("src/lib/mailer.ts");
const notice = read("src/components/store-status-notice.tsx");

test("l'état dégradé est exposé, avec la cause et l'horodatage", () => {
  const flat = code(store);
  assert.match(flat, /export interface DigitalCatalogStatus/);
  assert.match(flat, /degraded: boolean;/);
  assert.match(flat, /export function digitalCatalogStatus\(\): DigitalCatalogStatus/);
  // La cause remonte : sans elle, on ne sait pas si c'est la base ou le fournisseur.
  assert.match(flat, /message: catalogFailure\.message/);
  assert.match(flat, /since: new Date\(catalogFailure\.at\)\.toISOString\(\)/);
});

test("sans DATABASE_URL, une lecture en échec n'est PAS une panne", () => {
  // En CI et au build, il n'y a pas de base : le repli sur les fiches codées
  // en dur est le fonctionnement normal. Afficher un bandeau serait faux.
  const flat = code(store);
  assert.match(flat, /export function databaseConfigured\(\): boolean \{ return Boolean\(process\.env\.DATABASE_URL\?\.trim\(\)\); \}/);
  assert.match(flat, /function recordCatalogFailure\(error: unknown\): void \{ if \(!databaseConfigured\(\)\) return;/);
});

test("la lecture du catalogue enregistre la panne et l'efface au retour", () => {
  const flat = code(store);
  assert.match(flat, /recordCatalogFailure\(error\);/);
  assert.match(flat, /clearCatalogFailure\(\);/);
});

test("le catalogue public est mémorisé brièvement, jamais un repli de panne", () => {
  const flat = code(store);
  assert.match(flat, /const PUBLIC_CATALOG_TTL_MS = 120_000;/);
  // Un repli dû à une panne ne doit pas rester 2 minutes en cache : dès que
  // la base revient, la page doit le voir.
  assert.match(flat, /if \(live \|\| !digitalCatalogStatus\(\)\.degraded\) \{ publicCatalogCache = \{ products, at: now \}; \}/);
  // Toute écriture admin invalide le mémo.
  assert.match(flat, /export async function upsertDigitalProduct[\s\S]*clearPublicCatalogCache\(\)/);
  assert.match(flat, /export async function deleteDigitalProduct[\s\S]*clearPublicCatalogCache\(\)/);
});

test("le sitemap retire les fiches produit pendant une panne", () => {
  const flat = code(sitemap);
  // La lecture d'abord (c'est elle qui enregistre la panne), le verdict ensuite.
  assert.match(flat, /const catalog = await getDigitalCatalog\(\{ publicOnly: true \}\);/);
  assert.match(flat, /const digitalProducts = \(digitalCatalogStatus\(\)\.degraded \? \[\] : catalog\)/);
});

test("le formulaire de contact n'échoue plus avant d'avoir envoyé l'e-mail", () => {
  const flat = code(leadRoute);
  // L'insertion est isolée : son échec n'empêche plus la notification.
  assert.match(flat, /"\[lead\] enregistrement impossible \(la demande sera transmise par e-mail\) :"/);
  assert.match(flat, /let saved = false;/);
  // L'e-mail part dans tous les cas.
  assert.match(flat, /let notified = false;/);
  assert.match(flat, /notified = outcome\.notification\.ok;/);
  // On ne répond « échec » que si RIEN n'a été conservé.
  assert.match(flat, /if \(!saved && !notified\) \{/);
  assert.match(flat, /fallback: "whatsapp"/);
  assert.match(flat, /return NextResponse\.json\(\{ ok: true, saved \}\);/);
});

test("/api/health explique la panne au lieu de la cacher", () => {
  const flat = code(healthRoute);
  // Drizzle renvoie « Failed query » ; la cause réelle est dans `cause`.
  assert.match(flat, /function describeError\(error: unknown\): string \{/);
  assert.match(flat, /current = node\.cause;/);
  // La route est publique : aucun identifiant de connexion ne doit sortir.
  // (assertion sur la source brute : le nettoyage de commentaires coupe les « // »)
  assert.match(healthRoute, /function redact\(text: string\): string \{/);
  assert.match(healthRoute, /"postgresql:\/\/\*\*\*"/);
  assert.match(healthRoute, /\$1=\*\*\*/);
  // Une phrase actionnable par cause probable.
  assert.match(flat, /function databaseHint\(message: string\): string \{/);
  assert.match(flat, /Base suspendue \(quota de calcul épuisé \?\)/);
  assert.match(flat, /hint: databaseHint\(detail\)/);
  // L'état de la vitrine et une liste de problèmes lisibles.
  // Déduit de la sonde SQL, pas d'un état mémorisé : chaque route Next est
  // un bundle séparé, la mémoire de `digital-store` n'y est pas partagée.
  assert.match(flat, /degraded: database\.urlConfigured && !database\.connected,/);
  assert.match(flat, /const warnings: string\[\] = \[\];/);
  assert.match(flat, /catalog,/);
  assert.match(flat, /warnings, \}, \{ status: ok \? 200 : 500 \}/);
});

test("la boutique affiche un bandeau au lieu d'un faux catalogue", () => {
  const flat = code(codesPage);
  assert.match(flat, /const status = digitalCatalogStatus\(\);/);
  assert.match(flat, /const degraded = status\.degraded;/);
  assert.match(flat, /\{degraded && \( <StoreUnavailableNotice ar=\{ar\} phone=\{config\.phone\} \/> \)\}/);
  // La grille n'est pas rendue : elle contiendrait les fiches de démonstration.
  assert.match(flat, /\{!degraded && <DigitalCatalog products=\{products\} \/>\}/);
  // Et le balisage n'annonce pas ces fiches comme le catalogue.
  assert.match(flat, /const itemList = degraded \? null :/);
  assert.match(flat, /\.\.\.\(itemList \? \{ mainEntity: itemList \} : \{\}\)/);
});

test("le bandeau et la page d'attente sont rendus côté serveur", () => {
  // Aucun "use client" : le message doit s'afficher même si l'hydratation
  // échoue, et sans JavaScript l'information reste lisible.
  assert.doesNotMatch(notice, /"use client"/);
  assert.match(notice, /export function StoreUnavailableNotice\(/);
  assert.match(notice, /export function StoreUnavailableProduct\(/);
  // Le seul recours pendant une panne complète : WhatsApp.
  assert.match(notice, /whatsappLink\(phone, message\)/);
});

test("les e-mails transactionnels acceptent une adresse de réponse", () => {
  const flat = code(mailer);
  assert.match(flat, /export function mailReplyTo\(\): string \| null \{/);
  assert.match(flat, /const explicit = process\.env\.EMAIL_REPLY_TO\?\.trim\(\);/);
  // Aucune valeur par défaut inventée : une adresse inexistante est pire
  // qu'aucune adresse (rejet 550).
  assert.match(flat, /return explicit \|\| null;/);
  assert.match(flat, /reply_to: message\.replyTo \|\| mailReplyTo\(\)/);
  assert.match(flat, /replyTo: message\.replyTo \|\| mailReplyTo\(\) \|\| undefined,/);
  assert.match(flat, /replyTo: mailReplyTo\(\),/);
});
