#!/usr/bin/env node
/**
 * Garde-fou de la plomberie de tests.
 *
 * Incident réel : quatre fichiers `scripts/*.test.mjs` (compliance,
 * whatsapp-enquiry, admin-visuals, subscription-plans) n'étaient exécutés par
 * AUCUN workflow, parce que les listes de fichiers étaient recopiées dans huit
 * scripts npm. Ces tests ne protégeaient donc rien.
 *
 * Ce fichier empêche la dérive de revenir, quel que soit le nombre de scripts
 * ajoutés. Contrairement aux autres garde-fous du dépôt, il lit des
 * déclarations (package.json, workflow) et non du code applicatif : c'est de
 * la configuration, pas du comportement.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const pkg = JSON.parse(readFileSync(`${root}/package.json`, "utf8"));
const testFiles = readdirSync(`${root}/scripts`).filter((f) => f.endsWith(".test.mjs"));

test("un script `test` unique exécute la suite par découverte", () => {
  assert.equal(
    pkg.scripts.test,
    "node --test",
    "`npm test` doit découvrir les fichiers (node --test), pas recopier une liste",
  );
});

test("chaque fichier de test figure dans au moins un script nommé", () => {
  // `npm test` couvre tout ; cette assertion garantit en plus qu'une exécution
  // ciblée (`npm run test:seo`, `test:digital`…) n'oublie personne.
  const named = Object.entries(pkg.scripts)
    .filter(([name]) => name !== "test")
    .map(([, command]) => command)
    .join(" ");
  const missing = testFiles.filter((file) => !named.includes(file));
  assert.deepEqual(
    missing,
    [],
    `Ajouter à un script test:* : ${missing.join(", ")}`,
  );
});

test("la CI exécute le lint, les types et la suite complète", () => {
  const ci = readFileSync(`${root}/.github/workflows/ci.yml`, "utf8");
  assert.match(ci, /run: npm run lint/, "npm run lint doit être dans la CI");
  assert.match(ci, /run: npm run typecheck/);
  assert.match(ci, /run: npm test/, "npm test doit être dans la CI");
});

test("le lint reste bloquant pour les erreurs", () => {
  assert.match(pkg.scripts.lint, /eslint/);
  // Un `|| true` viderait le contrôle de son sens.
  assert.doesNotMatch(pkg.scripts.lint, /\|\|\s*true/);
});
