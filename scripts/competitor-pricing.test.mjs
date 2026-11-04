#!/usr/bin/env node
/**
 * Alignement des prix sur le marché — tests du calcul réel.
 *
 * Enjeu : cette formule décide des prix affichés ET facturés. Une erreur ici
 * ne se voit pas dans un écran : elle se paie en marge (prix sous le plancher)
 * ou en conversion (prix au-dessus du marché). Les tests couvrent les trois
 * issues possibles — aligné, ajusté, bloqué — et les garde-fous.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_ALIGNMENT_OPTIONS,
  alignPrice,
  applyCompetitorPricing,
  floorPriceUsd,
  netMarginUsd,
  summariseAlignment,
} from "../src/lib/competitor-pricing.ts";
import {
  MARKET_BENCHMARKS,
  benchmarkForDenomination,
  faceNumber,
  platformKey,
} from "../src/lib/competitor-prices.ts";
import {
  OWN_DIGITAL_PRODUCTS,
  STEAM_ACCOUNT_TOPUP,
  steamTopupCostUsd,
  withOwnProducts,
} from "../src/lib/digital-own-products.ts";

/** Politique historique : marché sous le plancher → prix inchangé. */
const NO_FALLBACK = { ...DEFAULT_ALIGNMENT_OPTIONS, blockedMarginPercent: 0 };

const reseller = (usd) => ({
  usd,
  channel: "Eneba",
  observedAt: "2026-11-03",
  confidence: "reseller",
});
const official = (usd) => ({
  usd,
  channel: "Valeur faciale",
  observedAt: "permanent",
  confidence: "official",
});

test("plancher : commission incluse sur le prix final, jamais sous le coût", () => {
  // (42,63 + 1 + 0,50) / (1 − 1,5 %) = 44,80
  assert.equal(floorPriceUsd(42.63, DEFAULT_ALIGNMENT_OPTIONS), 44.8);
  // Un coût nul ou absent ne produit aucun plancher (l'appelant signale « no_cost »).
  assert.equal(floorPriceUsd(0, DEFAULT_ALIGNMENT_OPTIONS), 0);
  assert.equal(floorPriceUsd(Number.NaN, DEFAULT_ALIGNMENT_OPTIONS), 0);
});

test("référence revendeur : le prix descend à −1,5 % sous le marché", () => {
  const result = alignPrice({
    currentUsd: 50.5,
    costUsd: 42.63,
    benchmark: reseller(45.93),
  });
  assert.equal(result.status, "lowered");
  assert.equal(result.targetUsd, 45.24); // 45,93 × 0,985
  assert.equal(result.recommendedUsd, 45.24);
  assert.ok(result.recommendedUsd >= result.floorUsd);
  // Marge nette toujours positive au prix recommandé.
  assert.ok(result.netMarginUsd > 0);
});

test("marché sous le plancher : aucun prix appliqué, statut « bloqué »", () => {
  // Steam 50 : coût 49,25, marché 51,39 → cible 50,62 < plancher 51,52.
  const result = alignPrice(
    {
      currentUsd: 55.97,
      costUsd: 49.25,
      benchmark: reseller(51.39),
    },
    NO_FALLBACK,
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.recommendedUsd, null);
  assert.equal(result.floorUsd, 51.52);
  assert.ok(result.targetUsd < result.floorUsd);
});

test("valeur faciale = plafond : on ne relève jamais un prix vers elle", () => {
  const result = alignPrice({
    currentUsd: 47.33,
    costUsd: 41.65,
    benchmark: official(50),
  });
  assert.equal(result.status, "aligned");
  assert.equal(result.recommendedUsd, null);
});

test("au-dessus de la valeur faciale et sous le plancher : bloqué (pas de baisse possible)", () => {
  // Google Play 50 : coût 48,18 → plancher 50,43 > plafond officiel 50.
  const result = alignPrice(
    {
      currentUsd: 54.75,
      costUsd: 48.18,
      benchmark: official(50),
    },
    NO_FALLBACK,
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.recommendedUsd, null);
  assert.ok(result.currentVsBenchmarkPercent > 0, "le prix courant est bien au-dessus du marché");
});

test("marché sous le plancher + marge de repli : prix = coût + 1 %", () => {
  // Décision du 4 novembre : plutôt que de rester 10 à 20 % au-dessus du
  // marché, on applique coût + 1 % — même si la commission rend la vente
  // déficitaire (c'est assumé et affiché dans l'admin).
  const result = alignPrice({
    currentUsd: 55.97,
    costUsd: 49.25,
    benchmark: reseller(51.39),
  });
  assert.equal(result.status, "cost_margin");
  assert.equal(result.recommendedUsd, 49.74); // 49,25 × 1,01
  assert.ok(result.recommendedUsd < result.floorUsd, "le repli reste sous le plancher");
  assert.ok(result.netMarginUsd < 0, "la commission n'est pas couverte : marge négative");
  // Le prix de repli reste sous le marché, donc sous la concurrence.
  assert.ok(result.recommendedUsd < result.benchmark.usd);
});

test("garde-fou : une variation supérieure au seuil n'est pas appliquée", () => {
  const result = alignPrice({
    currentUsd: 10,
    costUsd: 5,
    benchmark: reseller(100),
  });
  assert.equal(result.status, "step_blocked");
  assert.equal(result.recommendedUsd, null);
});

test("les états incomplets ont leur propre statut (jamais de prix inventé)", () => {
  assert.equal(
    alignPrice({ currentUsd: 10, costUsd: 5, benchmark: null }).status,
    "no_benchmark",
  );
  assert.equal(
    alignPrice({ currentUsd: 10, costUsd: null, benchmark: reseller(12) }).status,
    "no_cost",
  );
  assert.equal(
    alignPrice(
      { currentUsd: 10, costUsd: 5, benchmark: reseller(12) },
      { ...DEFAULT_ALIGNMENT_OPTIONS, enabled: false },
    ).status,
    "disabled",
  );
});

test("marge nette : commission en pourcentage + frais fixes déduits", () => {
  // 45,24 − 42,63 − (45,24 × 1,5 % = 0,68) − 1,00 = 0,93
  assert.equal(netMarginUsd(45.24, 42.63, DEFAULT_ALIGNMENT_OPTIONS), 0.93);
  assert.equal(netMarginUsd(10, null, DEFAULT_ALIGNMENT_OPTIONS), null);
});

test("application au catalogue : seul le prix change, la fiche reste intacte", () => {
  const product = {
    id: "playstation-us",
    platform: "PlayStation",
    title: "PlayStation Store",
    denominations: [
      { id: "ps-50", label: "50 $", faceValue: "50 USD", priceUsd: 50.5, supplierCostUsd: 42.63, available: true },
      { id: "ps-25", label: "25 $", faceValue: "25 USD", priceUsd: 25.9, supplierCostUsd: 21.81, available: true },
    ],
  };
  const [aligned] = applyCompetitorPricing([product], DEFAULT_ALIGNMENT_OPTIONS);
  // PSN 50 : 45,93 (G2A) × 0,985 = 45,24
  assert.equal(aligned.denominations[0].priceUsd, 45.24);
  // PSN 25 : 23,29 (Eneba) × 0,985 = 22,94, sous le plancher 23,66 → repli
  // coût + 1 % (21,81 × 1,01 = 22,03), donc sous le marché.
  assert.equal(aligned.denominations[1].priceUsd, 22.03);
  assert.equal(Object.keys(aligned.denominations[0]).sort().join(","), Object.keys(product.denominations[0]).sort().join(","));
  assert.equal(aligned.title, product.title);
});

test("fiche verrouillée : aucun prix touché", () => {
  const product = {
    id: "steam-wallet",
    platform: "Steam",
    denominations: [{ faceValue: "50 USD", priceUsd: 55, supplierCostUsd: 49.25 }],
  };
  const [aligned] = applyCompetitorPricing([product], {
    ...DEFAULT_ALIGNMENT_OPTIONS,
    lockedProductIds: ["steam-wallet"],
  });
  assert.equal(aligned.denominations[0].priceUsd, 55);
});

test("résumé d'alignement : chaque montant dans une seule catégorie", () => {
  const results = [
    alignPrice({ currentUsd: 45.24, costUsd: 42.63, benchmark: reseller(45.93) }),
    alignPrice({ currentUsd: 55.97, costUsd: 49.25, benchmark: reseller(51.39) }),
    alignPrice({ currentUsd: 47.33, costUsd: 41.65, benchmark: official(50) }),
    alignPrice({ currentUsd: 10, costUsd: 5, benchmark: null }),
  ];
  const summary = summariseAlignment(results);
  assert.equal(summary.total, 4);
  assert.equal(summary.aligned, 2); // 45,24 est déjà la cible ; 47,33 sous le plafond
  assert.equal(summary.lowered, 0);
  assert.equal(summary.costMargin, 1); // Steam 50 : repli coût + 1 %
  assert.equal(summary.blocked, 0);
  assert.equal(summary.noBenchmark, 1);
  assert.equal(summary.unprofitableAtMarket, 1);
  assert.equal(
    summary.total,
    summary.aligned +
      summary.lowered +
      summary.raised +
      summary.blocked +
      summary.costMargin +
      summary.stepBlocked +
      summary.noBenchmark +
      summary.noCost +
      summary.locked,
  );
});

test("recharge Steam : coût sous la valeur faciale (remise fournisseur)", () => {
  // Remise Bronze 2,5 % : 10 USDT crédités coûtent 9,75 $, pas 10,01 $ comme
  // la carte cadeau — c'est toute l'économie de cette ligne.
  assert.equal(steamTopupCostUsd(10), 9.75);
  assert.equal(steamTopupCostUsd(5), 4.88);
  assert.ok(steamTopupCostUsd(50) < 50);
});

test("recharge Steam : fiche complète, alignée et non exposée aux coûts", () => {
  assert.equal(STEAM_ACCOUNT_TOPUP.id, "steam-account-topup");
  assert.equal(STEAM_ACCOUNT_TOPUP.kind, "game_topup");
  assert.equal(STEAM_ACCOUNT_TOPUP.status, "coming_soon");
  assert.equal(STEAM_ACCOUNT_TOPUP.fulfillment, "manual");
  // Le montant réclame le login Steam : sans lui, aucune recharge possible.
  const ten = STEAM_ACCOUNT_TOPUP.denominations.find((d) => d.id === "steam-topup-10");
  assert.ok(ten, "la dénomination 10 USDT existe");
  assert.equal(ten.fields?.[0]?.key, "steamLogin");
  assert.equal(ten.supplierCostUsd, 9.75);
  // Alignement : marché 10,75, plancher 11,42 → repli coût + 1 % = 9,85.
  const [aligned] = applyCompetitorPricing([STEAM_ACCOUNT_TOPUP], DEFAULT_ALIGNMENT_OPTIONS);
  const alignedTen = aligned.denominations.find((d) => d.id === "steam-topup-10");
  assert.equal(alignedTen.priceUsd, 9.85);
  assert.ok(alignedTen.priceUsd < 10, "moins cher que la valeur faciale, donc qu'Eneba");
});

test("fiches maison : fusion sans doublon ni écrasement", () => {
  assert.equal(OWN_DIGITAL_PRODUCTS.length, 1);
  const already = { id: "steam-account-topup", platform: "Steam", denominations: [], sortOrder: 99 };
  assert.equal(withOwnProducts([already]).length, 1);
  const merged = withOwnProducts([
    { id: "fzr-a", platform: "Steam", denominations: [], sortOrder: 5 },
  ]);
  assert.equal(merged.length, 2);
  // L'ordre reste celui du catalogue (sortOrder), la fiche maison s'insère.
  assert.deepEqual(merged.map((p) => p.id), ["fzr-a", "steam-account-topup"]);
});

test("clés de plateforme : les libellés du catalogue tombent sur la bonne référence", () => {
  assert.equal(platformKey("PlayStation"), "playstation");
  assert.equal(platformKey("PSN"), "playstation");
  assert.equal(platformKey("Google Play"), "google-play");
  assert.equal(platformKey("Xbox"), "xbox");
  assert.equal(platformKey("Steam"), "steam");
  assert.equal(platformKey("Roblox"), "roblox");
});

test("référence de marché : revendeur d'abord, valeur faciale en plafond, sinon rien", () => {
  const steam50 = benchmarkForDenomination("Steam", { faceValue: "50 USD" });
  assert.equal(steam50.usd, 51.39);
  assert.equal(steam50.confidence, "reseller");

  const xbox50 = benchmarkForDenomination("Xbox", { faceValue: "50 USD" });
  assert.equal(xbox50.usd, 50);
  assert.equal(xbox50.confidence, "official");

  // Robux : pack lu en nombre de Robux, comparé au prix officiel.
  const robux = benchmarkForDenomination("Roblox", { faceValue: "4 500 Robux" });
  assert.equal(robux.usd, 49.99);
  assert.equal(robux.confidence, "official");

  // Une carte en devise étrangère n'est pas comparable au dollar.
  assert.equal(
    benchmarkForDenomination("Google Play", { faceValue: "SAR 70", faceCurrency: "SAR" }),
    null,
  );
  // Un abonnement en mois n'a aucune référence de prix comparable.
  assert.equal(benchmarkForDenomination("Spotify", { faceValue: "12 months" }), null);
});

test("les relevés de marché sont datés et cohérents", () => {
  for (const [key, benchmark] of Object.entries(MARKET_BENCHMARKS)) {
    assert.ok(benchmark.usd > 0, `${key} doit avoir un prix positif`);
    assert.ok(benchmark.channel.length > 0, `${key} doit citer un canal`);
    assert.match(benchmark.observedAt, /^\d{4}-\d{2}-\d{2}$/, `${key} doit être daté`);
    assert.ok(["reseller", "official"].includes(benchmark.confidence));
  }
});

test("faceNumber lit les milliers avec espace et les décimales", () => {
  assert.equal(faceNumber("50 USD"), 50);
  assert.equal(faceNumber("4 500 Robux"), 4500);
  assert.equal(faceNumber("1 700 Robux"), 1700);
  assert.equal(faceNumber("SAR 100"), 100);
  assert.equal(faceNumber("12 months"), 12);
  assert.equal(faceNumber("aucun nombre"), null);
});
