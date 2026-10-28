#!/usr/bin/env node
/**
 * Priorisation de la vitrine `/codes`.
 *
 * On verrouille ici la règle commerciale demandée : les articles les plus
 * demandés d'abord, et — à demande égale — les zones que nos clients peuvent
 * réellement utiliser en payant en USDT (Golfe, Levant, Maghreb) avant les
 * autres. Le classement doit être identique côté serveur et côté navigateur,
 * sinon React casse l'hydratation : d'où le tri TOTAL (score, titre, slug).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(`${root}/${path}`, "utf8");

const priority = await import("../src/lib/digital-priority.ts");

/** Fiche minimale, du même genre que ce que renvoie l'adaptateur. */
const product = (overrides = {}) => ({
  slug: "fzr-x",
  kind: "gift_card",
  platform: "Steam",
  titleEn: "Gift Card",
  titleAr: "بطاقة هدايا",
  regions: ["GLOBAL"],
  denominations: [],
  ...overrides,
});

/* ------------------------------ Demande ------------------------------ */

test("les têtes d'affiche passent devant les petits titres", () => {
  const pubg = product({
    slug: "fzr-topup-pubg-mobile-fast",
    kind: "game_topup",
    platform: "PUBG Mobile (Fast)",
    titleEn: "Game Top-Up — PUBG Mobile (Fast)",
    regions: ["GLOBAL"],
  });
  const obscur = product({
    slug: "fzr-topup-astral-guardians",
    kind: "game_topup",
    platform: "Astral Guardians: Cyber Fantasy",
    titleEn: "Game Top-Up — Astral Guardians: Cyber Fantasy",
    regions: ["GLOBAL"],
  });
  assert.ok(
    priority.digitalDemandScore(pubg) > priority.digitalDemandScore(obscur),
    "PUBG Mobile doit passer avant un jeu de niche",
  );
});

test("PlayStation et Steam dominent les cartes cadeaux secondaires", () => {
  const ps = product({ platform: "PlayStation", titleEn: "Gift Card — PlayStation (US)" });
  const amazon = product({ platform: "Amazon", titleEn: "Gift Card — Amazon (US)" });
  const airbnb = product({ platform: "Airbnb", titleEn: "Gift Card — Airbnb (US)" });
  assert.ok(priority.digitalDemandScore(ps) > priority.digitalDemandScore(amazon));
  assert.ok(priority.digitalDemandScore(amazon) > priority.digitalDemandScore(airbnb));
});

test("une recharge de jeu passe avant une clé de jeu de niche", () => {
  const topup = product({
    kind: "game_topup",
    platform: "Free Fire (MENA)",
    titleEn: "Game Top-Up — Free Fire (MENA)",
    regions: ["MENA"],
  });
  const cle = product({
    kind: "software_key",
    platform: "Steam",
    titleEn: "Game Key — Abyssus (CIS)",
    regions: ["CIS"],
  });
  assert.ok(priority.digitalDemandScore(topup) > priority.digitalDemandScore(cle));
});

test("un homonyme plus court ne vole pas les points du jeu vedette", () => {
  const mlbb = product({
    kind: "game_topup",
    platform: "Mobile Legends (Global)",
    titleEn: "Game Top-Up — Mobile Legends (Global)",
  });
  const adventure = product({
    kind: "game_topup",
    platform: "Mobile Legends: Adventure",
    titleEn: "Game Top-Up — Mobile Legends: Adventure",
  });
  assert.ok(
    priority.digitalDemandScore(mlbb) > priority.digitalDemandScore(adventure) + 50,
    "« Mobile Legends: Adventure » est un autre jeu et doit chuter",
  );
});

test("une carte secondaire ne profite pas du nom d'une grande marque", () => {
  // « Halo Infinite (Xbox, Halo Credits) » reste une fiche de niche : elle ne
  // doit pas passer pour une carte Xbox.
  const xbox = product({ platform: "Xbox", titleEn: "Gift Card — Xbox" });
  const halo = product({
    platform: "Halo Infinite (Xbox, Halo Credits)",
    titleEn: "Gift Card — Halo Infinite (Xbox, Halo Credits)",
  });
  assert.ok(priority.digitalDemandScore(xbox) > priority.digitalDemandScore(halo) + 50);
});

test("la zone se lit dans le libellé du produit", () => {
  assert.equal(priority.zoneFromPlatform("PlayStation (SA)"), "SA");
  assert.equal(priority.zoneFromPlatform("Free Fire (MENA)"), "MENA");
  assert.equal(priority.zoneFromPlatform("Steam Wallet (Global)"), "GLOBAL");
  assert.equal(priority.zoneFromPlatform("Xbox Game Pass (EU)"), "EU");
  // Les parenthèses de livraison ne sont pas des zones.
  assert.equal(priority.zoneFromPlatform("PUBG Mobile (Auto)"), null);
  assert.equal(priority.zoneFromPlatform("PUBG Mobile (Fast)"), null);
  assert.equal(priority.zoneFromPlatform("Steam"), null);
});

test("à jeu égal, la déclinaison MENA passe devant une zone hors périmètre", () => {
  const mena = product({
    kind: "game_topup",
    platform: "Free Fire (MENA)",
    titleEn: "Game Top-Up — Free Fire (MENA)",
    regions: ["GLOBAL"],
  });
  const bd = product({
    kind: "game_topup",
    platform: "Free Fire (BD)",
    titleEn: "Game Top-Up — Free Fire (BD)",
    regions: ["GLOBAL"],
  });
  assert.ok(priority.digitalDemandScore(mena) > priority.digitalDemandScore(bd));
  assert.equal(priority.sortByDemand([bd, mena])[0].platform, "Free Fire (MENA)");
});

/* --------------------------- Zones crypto --------------------------- */

test("les zones prioritaires sont le global, le Golfe et le Maghreb", () => {
  assert.equal(priority.CRYPTO_REGIONS[0], "GLOBAL");
  for (const zone of ["SA", "AE", "KW", "QA", "OM", "BH", "LB", "EG", "TR", "LY"]) {
    assert.ok(priority.isCryptoRegion(zone), `${zone} doit être prioritaire`);
  }
  // Zones hors périmètre : aucun bonus.
  for (const zone of ["ZA", "JP", "KR", "UY", "VN"]) {
    assert.equal(priority.isCryptoRegion(zone), false, `${zone} ne doit pas être prioritaire`);
  }
});

test("à demande égale, la zone payable en USDT passe devant", () => {
  const saoudien = product({
    slug: "fzr-giftcard-steam-wallet-sa",
    platform: "Steam Wallet (SA)",
    titleEn: "Gift Card — Steam Wallet (SA)",
    regions: ["SA"],
  });
  const sudAfricain = product({
    slug: "fzr-giftcard-steam-wallet-za",
    platform: "Steam Wallet (ZA)",
    titleEn: "Gift Card — Steam Wallet (ZA)",
    regions: ["ZA"],
  });
  assert.ok(
    priority.digitalDemandScore(saoudien) > priority.digitalDemandScore(sudAfricain),
  );

  const ordered = priority.sortByDemand([sudAfricain, saoudien]);
  assert.equal(ordered[0].slug, "fzr-giftcard-steam-wallet-sa");
});

test("le rail des régions met les zones USDT en tête, puis les volumes", () => {
  const rail = priority.sortRegionsForRail([
    { value: "ZA", count: 30 },
    { value: "JP", count: 25 },
    { value: "TR", count: 3 },
    { value: "GLOBAL", count: 1 },
    { value: "SA", count: 9 },
  ]);
  assert.deepEqual(
    rail.map((item) => item.value),
    // Zones USDT dans l'ordre de priorité, puis les autres au volume :
    // ZA (30 fiches) avant JP (25).
    ["GLOBAL", "SA", "TR", "ZA", "JP"],
  );
});

/* ----------------------------- Stabilité ----------------------------- */

test("le tri est total et ne modifie pas l'entrée", () => {
  const rows = [
    product({ slug: "a", platform: "Steam Wallet (ZA)", regions: ["ZA"] }),
    product({ slug: "b", platform: "Steam Wallet (SA)", regions: ["SA"] }),
    product({ slug: "c", platform: "Astral Guardians", titleEn: "Astral Guardians" }),
  ];
  const snapshot = rows.map((row) => row.slug);
  const first = priority.sortByDemand(rows).map((row) => row.slug);
  const second = priority.sortByDemand(rows).map((row) => row.slug);
  assert.deepEqual(first, second, "deux appels doivent donner le même ordre");
  assert.deepEqual(rows.map((row) => row.slug), snapshot, "l'entrée ne doit pas bouger");
  // Steam Wallet SA (demande forte + zone prioritaire) en tête.
  assert.equal(first[0], "b");
});

test("une marque déclinée en 41 pays n'occupe pas toute la première ligne", () => {
  const rows = [
    product({ slug: "ps-sa", platform: "PlayStation (SA)", titleEn: "Gift Card — PlayStation (SA)", regions: ["SA"] }),
    product({ slug: "ps-ae", platform: "PlayStation (AE)", titleEn: "Gift Card — PlayStation (AE)", regions: ["AE"] }),
    product({ slug: "ps-kw", platform: "PlayStation (KW)", titleEn: "Gift Card — PlayStation (KW)", regions: ["KW"] }),
    product({ slug: "steam", platform: "Steam Wallet (Global)", titleEn: "Gift Card — Steam Wallet (Global)" }),
    product({
      slug: "pubg",
      kind: "game_topup",
      platform: "PUBG Mobile (Fast)",
      titleEn: "Game Top-Up — PUBG Mobile (Fast)",
    }),
  ];
  const ordered = priority.sortByDemand(rows);
  const firstThreeBrands = ordered.slice(0, 3).map((row) => priority.brandKeyFor(row));
  assert.equal(new Set(firstThreeBrands).size, 3, "trois marques différentes sur la première ligne");
  // PlayStation reste devant, mais une seule fois au premier tour.
  assert.equal(firstThreeBrands.filter((key) => key === "playstation").length, 1);
});

test("le classement réel du catalogue met les recharges MENA en tête", () => {
  // Noms de plateformes tels que renvoyés par /api/digital/products.
  const rows = [
    ["PlayStation (SA)", "gift_card", "Gift Card — PlayStation (SA)", ["SA"]],
    ["Steam Wallet (Global)", "gift_card", "Gift Card — Steam Wallet (Global)", ["GLOBAL"]],
    ["PUBG Mobile (Fast)", "game_topup", "Game Top-Up — PUBG Mobile (Fast)", ["GLOBAL"]],
    ["Free Fire (MENA)", "game_topup", "Game Top-Up — Free Fire (MENA)", ["MENA"]],
    ["Mobile Legends (Global)", "game_topup", "Game Top-Up — Mobile Legends (Global)", ["GLOBAL"]],
    ["Amazon (SA)", "gift_card", "Gift Card — Amazon (SA)", ["SA"]],
    ["Airbnb (US)", "gift_card", "Gift Card — Airbnb (US)", ["US"]],
    ["Azur Lane", "game_topup", "Game Top-Up — Azur Lane", ["GLOBAL"]],
    ["Astral Guardians: Cyber Fantasy", "game_topup", "Game Top-Up — Astral Guardians: Cyber Fantasy", ["GLOBAL"]],
    ["8 Ball Pool", "game_topup", "Game Top-Up — 8 Ball Pool", ["GLOBAL"]],
  ].map(([platform, kind, titleEn, regions]) =>
    product({ slug: platform.toLowerCase().replace(/[^a-z0-9]+/g, "-"), platform, kind, titleEn, regions }),
  );

  const ordered = priority.sortByDemand(rows);
  const topSix = ordered.slice(0, 6).map((row) => row.platform);

  for (const expected of ["PUBG Mobile (Fast)", "Free Fire (MENA)", "PlayStation (SA)"]) {
    assert.ok(topSix.includes(expected), `${expected} doit être dans les 6 premières cartes`);
  }
  // Les petits titres restent derrière.
  const positions = ordered.map((row) => row.platform);
  assert.ok(
    positions.indexOf("Astral Guardians: Cyber Fantasy") > positions.indexOf("Amazon (SA)"),
    "un jeu de niche ne doit pas passer devant une grande marque",
  );
});

test("topDemandSlugs renvoie des slugs uniques", () => {
  const rows = Array.from({ length: 20 }, (_, index) =>
    product({ slug: `p-${index}`, platform: index === 0 ? "PUBG Mobile" : "Steam" }),
  );
  const top = priority.topDemandSlugs(rows, 8);
  assert.equal(top.length, 8);
  assert.equal(new Set(top).size, 8);
  assert.equal(top[0], "p-0", "PUBG Mobile doit sortir en premier");
});

/* --------------------------- Câblage UI --------------------------- */

const catalogComponent = read("src/components/digital-catalog.tsx");
const page = read("src/app/(site)/codes/page.tsx");

test("la vitrine s'ouvre sur l'ordre « les plus demandés »", () => {
  assert.match(catalogComponent, /type SortId = "popular"/);
  assert.match(catalogComponent, /useState<SortId>\("popular"\)/);
  // Les deux sélecteurs (barre collante + tiroir mobile) proposent l'option.
  assert.equal(
    (catalogComponent.match(/<option value="popular">/g) ?? []).length,
    2,
    "l'option doit exister dans les deux sélecteurs de tri",
  );
  assert.doesNotMatch(catalogComponent, /value="featured"/, "ancien tri sans effet");
  // Le serveur envoie déjà la liste triée : le HTML et le JSON-LD suivent.
  assert.match(page, /sortByDemand\(await getDigitalCatalog/);
});

test("les familles sont présentées dans l'ordre de la demande", () => {
  // Recharges et cartes d'abord : c'est ce que la région achète.
  const order = catalogComponent.match(/const FAMILY_ORDER: DigitalKind\[\] = \[([^\]]*)\]/);
  assert.ok(order, "FAMILY_ORDER introuvable");
  const families = order[1].match(/"[a-z_]+"/g) ?? [];
  assert.deepEqual(families, ['"game_topup"', '"gift_card"', '"software_key"', '"subscription_code"']);
});

test("les zones prioritaires sont signalées dans le rail", () => {
  assert.match(catalogComponent, /isCryptoRegion\(item\.value\) \? "USDT" : undefined/);
  assert.match(catalogComponent, /sortRegionsForRail\(/);
});
