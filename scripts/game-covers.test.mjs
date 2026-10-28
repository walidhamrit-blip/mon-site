#!/usr/bin/env node
/**
 * Vitrine `/codes` — organisation « boutique » et jaquettes de jeux.
 *
 * Deux garanties verrouillées ici :
 *   1. chaque jaquette déclarée existe réellement dans `public/game-covers`
 *      (une entrée sans fichier afficherait une image cassée sur la carte) ;
 *   2. la page garde la structure demandée : barre de filtres collante,
 *      rail de facettes écrit en propriétés LOGIQUES (à gauche en anglais,
 *      à droite en arabe), et grille de 4 cartes par ligne en grand écran.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(`${root}/${path}`, "utf8");
const code = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");

const covers = await import("../src/lib/game-covers.ts");

/* ----------------------------- Jaquettes ----------------------------- */

test("chaque jaquette déclarée existe dans /public/game-covers", () => {
  assert.ok(covers.GAME_COVERS.length >= 20, "registre de jaquettes trop pauvre");
  for (const cover of covers.GAME_COVERS) {
    assert.match(cover.file, /^\/game-covers\/[a-z0-9-]+\.jpg$/, cover.file);
    const onDisk = `${root}/public${cover.file}`;
    assert.ok(existsSync(onDisk), `fichier manquant : ${cover.file}`);
    assert.ok(cover.keys.length > 0, `aucune clé pour ${cover.file}`);
  }
});

test("une clé de jeu trouve sa jaquette (slug et titre du fournisseur)", () => {
  assert.equal(
    covers.gameCoverFor({
      slug: "fzr-gamekey-7-days-to-die",
      titleEn: "Game Key — 7 Days to Die",
    }),
    "/game-covers/7-days-to-die.jpg",
  );
  assert.equal(
    covers.gameCoverFor({
      slug: "fzr-gamekey-age-of-mythology-retold",
      titleEn: "Game Key — Age of Mythology: Retold",
    }),
    "/game-covers/age-of-mythology-retold.jpg",
  );
  // La clé la plus longue gagne : « age of mythology retold » n'est pas
  // capté par une entrée plus courte.
  assert.equal(
    covers.gameCoverFor({ titleEn: "Age of Mythology Retold" }),
    "/game-covers/age-of-mythology-retold.jpg",
  );
});

test("les mots sont comparés en entier (pas de faux positif)", () => {
  // « trust » contient « rust », « oldest » contient « elden ».
  assert.equal(covers.gameCoverFor({ titleEn: "Trust Oldest" }), null);
  assert.equal(covers.gameCoverFor({ titleEn: "Game Key — Totally Unknown Game" }), null);
  assert.equal(covers.gameCoverFor({}), null);
});

test("les fiches réelles du catalogue retombent sur une couverture connue", () => {
  // Slugs/titres tels que produits par l'adaptateur FazerCards.
  const cases = [
    ["fzr-giftcard-steam-wallet-us", "Gift Card — Steam Wallet (US)", "brand-steam"],
    ["fzr-giftcard-playstation-us", "Gift Card — PlayStation (US)", "brand-playstation"],
    ["fzr-giftcard-xbox-game-pass-eu", "Gift Card — Xbox Game Pass (EU)", "brand-xbox"],
    ["fzr-topup-free-fire-mena", "Game Top-Up — Free Fire (MENA)", "free-fire"],
    ["fzr-topup-pubg-mobile-fast", "Game Top-Up — PUBG Mobile (Fast)", "pubg-mobile"],
    ["fzr-topup-genshin-impact", "Game Top-Up — Genshin Impact", "genshin-impact"],
    ["fzr-gamekey-elden-ring", "Game Key — Elden Ring", "elden-ring"],
    ["fzr-gamekey-7-days-to-die", "Game Key — 7 Days to Die", "7-days-to-die"],
  ];
  for (const [slug, titleEn, expected] of cases) {
    assert.equal(
      covers.gameCoverFor({ slug, titleEn }),
      `/game-covers/${expected}.jpg`,
      `${titleEn} → ${expected}`,
    );
  }
  // Un jeu inconnu n'hérite JAMAIS de la couverture d'un autre.
  assert.equal(covers.gameCoverFor({ slug: "fzr-topup-zzz-unknown", titleEn: "Zzz Unknown" }), null);
});

test("l'image enregistrée en admin passe avant la jaquette locale", () => {
  assert.equal(
    covers.productVisual({
      image: "/digital-products/steam-wallet.jpg",
      slug: "fzr-gamekey-minecraft",
    }),
    "/digital-products/steam-wallet.jpg",
  );
  assert.equal(
    covers.productVisual({ image: "  ", slug: "fzr-gamekey-minecraft" }),
    "/game-covers/minecraft.jpg",
  );
  // Visuel admin aux proportions inconnues → cadrage « contain ».
  assert.equal(covers.productVisualFit({ image: "/x.jpg" }), "contain");
  assert.equal(covers.productVisualFit({ image: "" }), "cover");
});

/* ------------------------- Structure de la vitrine ------------------------ */

const catalog = read("src/components/digital-catalog.tsx");

test("la barre de filtres est collante et la grille affiche 4 cartes par ligne", () => {
  assert.match(catalog, /sticky top-0 z-30/);
  assert.match(catalog, /xl:grid-cols-4/);
  assert.match(catalog, /grid-cols-2/);
});

test("le rail est écrit en propriétés logiques (gauche LTR / droite RTL)", () => {
  // Aucun `left`/`right` en dur : uniquement start/end, donc le sens du
  // document place seul le rail à gauche (anglais) ou à droite (arabe).
  const rail = code(catalog).slice(code(catalog).indexOf("lg:grid-cols-[250px"));
  assert.ok(rail.length > 0, "rail introuvable");
  assert.match(catalog, /lg:grid-cols-\[250px_minmax\(0,1fr\)\]/);
  assert.doesNotMatch(catalog, /\bmr-auto\b|\bml-auto\b|\bpl-\d|\bpr-\d/);
});

test("les familles couvrent les futurs codes de logiciels", () => {
  assert.match(catalog, /"software_key"/);
  assert.match(catalog, /DIGITAL_KIND_LABELS\[family\]/);
  // Le rail, les pastilles et l'état actif partagent la même source de libellés.
  assert.ok(
    (code(catalog).match(/DIGITAL_KIND_LABELS\[/g) ?? []).length >= 3,
    "libellés de famille dupliqués en dur",
  );
});

test("chaque carte garde l'avertissement régional avant le clic", () => {
  assert.match(catalog, /<RegionalAlert regions=\{product\.regions\} compact/);
});

/* ---------------------------- next/image ---------------------------- */

/**
 * Panne réelle constatée : `next/image` refuse un `src` absent de
 * `images.localPatterns` (erreur 500 au rendu de la carte) et une `quality`
 * absente de `images.qualities`. Ces deux garde-fous évitent de republier
 * une vitrine sans jaquettes.
 */
test("next/image accepte les jaquettes et les qualités utilisées", () => {
  const config = read("next.config.ts");
  assert.match(
    config,
    /\{ pathname: "\/game-covers\/\*\*" \}/,
    "/game-covers/** doit figurer dans images.localPatterns",
  );

  const declared = (config.match(/qualities:\s*\[([^\]]*)\]/)?.[1] ?? "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter(Number.isFinite);
  const used = [...catalog.matchAll(/quality=\{(\d+)\}/g)].map((match) => Number(match[1]));
  assert.ok(used.length > 0, "aucune qualité utilisée trouvée");
  for (const quality of used) {
    assert.ok(
      declared.includes(quality),
      `qualité ${quality} absente de images.qualities (${declared.join(", ")})`,
    );
  }
});