#!/usr/bin/env node
/**
 * Garde-fou de cache : le catalogue digital est pré-généré au build.
 *
 * Incident réel (24/10/2026) : une fiche passée en « disponible » dans
 * l'admin restait affichée « bientôt disponible », sans bouton d'achat,
 * parce que `saveDigitalProduct` ne revalidait que `/codes` — jamais
 * `/codes/<slug>`. Ces tests vérifient le câblage de la revalidation et la
 * fenêtre de revalidation des pages publiques, sans dépendre de Next.
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

/** Extrait le corps d'une fonction exportée async, quel que soit son style. */
function bodyOf(source, functionName) {
  const flat = code(source);
  const start = flat.indexOf(`export async function ${functionName}`);
  assert.notEqual(start, -1, `fonction ${functionName} introuvable`);
  const nextExport = flat.indexOf("export ", start + 1);
  return flat.slice(start, nextExport === -1 ? flat.length : nextExport);
}

const actions = read("src/app/admin/actions.ts");
const productPage = read("src/app/(site)/codes/[slug]/page.tsx");
const catalogPage = read("src/app/(site)/codes/page.tsx");

test("enregistrer une fiche revalide /codes ET les fiches /codes/<slug>", () => {
  const body = bodyOf(actions, "saveDigitalProduct");
  assert.match(
    body,
    /revalidatePath\("\/codes", "layout"\)/,
    "/codes doit être revalidé en « layout » pour couvrir /codes/<slug>",
  );
  assert.match(
    body,
    /revalidatePath\(`\/codes\/\$\{parsed\.data\.slug\}`\)/,
    "la fiche modifiée doit être revalidée explicitement",
  );
});

test("supprimer une fiche revalide aussi les fiches /codes/<slug>", () => {
  const body = bodyOf(actions, "deleteDigitalProductAction");
  assert.match(body, /revalidatePath\("\/codes", "layout"\)/);
});

test("la fiche produit se rafraîchit d'elle-même (filet de sécurité)", () => {
  assert.match(code(productPage), /export const revalidate = 60;/);
});

test("la liste du catalogue se rafraîchit d'elle-même", () => {
  assert.match(code(catalogPage), /export const revalidate = 60;/);
});
