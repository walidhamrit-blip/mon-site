#!/usr/bin/env node
/**
 * Garde-fou des frontières d'erreur.
 *
 * Constat du 18/11/2026 : le dépôt ne contenait aucun `error.tsx`,
 * `global-error.tsx` ni `instrumentation.ts`. Une exception affichait donc la
 * page générique de Next, sans marque, sans reprise et sans trace exploitable.
 *
 * Ces tests vérifient des déclarations (fichiers, exports, absence de fuite de
 * message technique) — pas le rendu React, qui reste couvert par le build.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(join(root, path), "utf8");

const siteError = "src/app/(site)/error.tsx";
const adminError = "src/app/admin/(panel)/error.tsx";
const globalError = "src/app/global-error.tsx";
const loading = "src/app/loading.tsx";
const instrumentation = "src/instrumentation.ts";

test("les frontières d'erreur existent et sont des composants client", () => {
  for (const path of [siteError, adminError, globalError]) {
    assert.ok(existsSync(join(root, path)), `${path} manquant`);
    assert.match(read(path), /^"use client";/m, `${path} doit être client`);
  }
});

test("global-error remplace le layout racine avec un document complet", () => {
  const source = read(globalError);
  assert.match(source, /<html\b/, "global-error doit rendre <html>");
  assert.match(source, /<body\b/, "global-error doit rendre <body>");
  assert.match(source, /lang=/, "global-error doit déclarer la langue");
  assert.match(source, /dir=/, "global-error doit déclarer la direction");
});

test("les erreurs publiques proposent une reprise et un retour", () => {
  const source = read(siteError);
  assert.match(source, /onClick=\{reset\}/, "error.tsx doit appeler reset");
  assert.match(source, /href="\/"/, "error.tsx doit proposer l'accueil");
  assert.match(source, /href="\/contact"/, "error.tsx doit proposer le contact");
  assert.match(source, /digest/, "error.tsx doit afficher le digest");
  assert.doesNotMatch(
    source,
    /error\.message/,
    "error.tsx ne doit jamais rendre le message technique",
  );
});

test("l'erreur admin ne ressemble pas à une déconnexion", () => {
  const source = read(adminError);
  assert.match(source, /onClick=\{reset\}/);
  assert.match(source, /toujours connecté/i);
  assert.doesNotMatch(source, /error\.message/);
});

test("l'état de chargement est annoncé aux lecteurs d'écran", () => {
  const source = read(loading);
  assert.match(source, /role="status"/);
  assert.match(source, /aria-busy="true"/);
  assert.match(source, /aria-live="polite"/);
});

test("onRequestError journalise un JSON structuré sans en-têtes", () => {
  const source = read(instrumentation);
  assert.match(source, /export async function onRequestError/);
  assert.match(source, /console\.error\(JSON\.stringify\(payload\)\)/);
  assert.match(source, /level: "error"/);
  assert.match(source, /routePath/);
  assert.match(source, /digest/);
  assert.doesNotMatch(
    source,
    /request\.headers/,
    "ne jamais journaliser les en-têtes (cookies, jetons)",
  );
});
