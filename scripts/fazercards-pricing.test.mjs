#!/usr/bin/env node
/**
 * Barème de prix et politique réseaux du catalogue FazerCards.
 *
 * Ces tests importent DIRECTEMENT les modules TypeScript (Node 22 sait
 * retirer les types) : on vérifie le calcul réel, pas la forme du code.
 *
 * Enjeu : une erreur de calcul ici ne se voit pas — elle se paie. Une marge
 * trop faible et l'on vend à perte sur les petits articles ; un arrondi vers
 * le bas suffit à effacer le gain.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MARGIN_TIERS,
  MIN_RETAIL_USD,
  effectiveMarginPercent,
  marginTierFor,
  retailPriceForCost,
} from "../src/lib/fazercards-pricing.ts";
import {
  HIGH_COST_NETWORKS,
  LOW_COST_NETWORKS,
  isHighCostNetwork,
  isLowCostNetwork,
  paymentNetworkLabel,
  recommendedNetworksLabel,
} from "../src/lib/payment-networks.ts";

/* ------------------------------- Barème -------------------------------- */

test("le barème est celui validé : 20 / 15 / 12 / 10 %", () => {
  assert.deepEqual(
    MARGIN_TIERS.map((tier) => tier.marginPercent),
    [20, 15, 12, 10],
  );
  assert.deepEqual(
    MARGIN_TIERS.map((tier) => tier.minProfitUsd),
    [0.45, 1, 2.5, 0],
  );
});

test("chaque coût tombe dans la bonne tranche", () => {
  const cases = [
    [0.01, 20],
    [4.99, 20],
    [5, 15],
    [19.99, 15],
    [20, 12],
    [59.99, 12],
    [60, 10],
    [999, 10],
  ];
  for (const [cost, expected] of cases) {
    assert.equal(
      marginTierFor(cost).marginPercent,
      expected,
      `coût ${cost} → tranche ${expected} %`,
    );
  }
});

test("le prix applique le pourcentage tant qu'il dépasse le plancher", () => {
  const cases = [
    { cost: 3.73, price: 4.67, floor: false },
    { cost: 14.89, price: 17.52, floor: false },
    { cost: 50.07, price: 56.9, floor: false },
    { cost: 200.26, price: 222.52, floor: false },
  ];
  for (const item of cases) {
    const result = retailPriceForCost(item.cost);
    assert.equal(result.priceUsd, item.price, `coût ${item.cost}`);
    assert.equal(result.floorApplied, item.floor);
  }
});

test("le plancher de gain prend le dessus sur les petits articles", () => {
  // Coûts dont « coût + plancher » dépasse à la fois le pourcentage ET le
  // prix public plancher (1,50 $) : le plancher de gain décide.
  const cases = [
    { cost: 1.2, min: 0.45 },
    { cost: 1.4, min: 0.45 },
  ];
  for (const item of cases) {
    const result = retailPriceForCost(item.cost);
    assert.equal(result.floorApplied, true, `plancher attendu pour ${item.cost}`);
    assert.equal(
      result.priceUsd,
      item.cost === 1.2 ? 1.65 : 1.85,
      `coût ${item.cost}`,
    );
    assert.ok(
      result.priceUsd - item.cost >= result.minProfitUsd - 1e-9,
      "le gain doit atteindre le plancher",
    );
    assert.equal(result.minProfitUsd, item.min);
  }
  // Sous 1,50 $ de prix calculé, c'est le prix public plancher qui s'applique.
  assert.equal(retailPriceForCost(0.75).priceUsd, 1.5);
  assert.equal(retailPriceForCost(1).priceUsd, 1.5);
});

test("le prix n'est jamais inférieur au coût, ni sous le plancher", () => {
  for (let cost = 0.05; cost <= 300; cost += 0.37) {
    const rounded = Math.round(cost * 100) / 100;
    const { priceUsd, minProfitUsd } = retailPriceForCost(rounded);
    assert.ok(priceUsd > rounded, `coût ${rounded} vendu à ${priceUsd}`);
    assert.ok(
      priceUsd - rounded >= minProfitUsd - 1e-9,
      `plancher non atteint à ${rounded}`,
    );
  }
});

test("l'arrondi se fait au centime SUPÉRIEUR", () => {
  // 14,89 / 0,85 = 17,5176… : arrondi bas = 17,51 (marge perdue).
  assert.equal(retailPriceForCost(14.89).priceUsd, 17.52);
  // 2,03 / 0,8 = 2,5375 → 2,54
  assert.equal(retailPriceForCost(2.03).priceUsd, 2.54);
  for (let cost = 0.5; cost <= 80; cost += 0.13) {
    const { priceUsd } = retailPriceForCost(Math.round(cost * 100) / 100);
    assert.ok(
      Math.abs(priceUsd * 100 - Math.round(priceUsd * 100)) < 1e-6,
      `prix non centésimal : ${priceUsd}`,
    );
  }
});

test("un coût absent ou nul ne produit pas de prix inventé", () => {
  for (const value of [null, undefined, 0, -3, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(retailPriceForCost(value).priceUsd, 0, `valeur ${value}`);
  }
});

test("la marge effective dépasse le barème quand le plancher s'applique", () => {
  const cost = 0.75;
  const { priceUsd, marginPercent } = retailPriceForCost(cost);
  assert.ok(
    effectiveMarginPercent(priceUsd, cost) > marginPercent,
    "le plancher doit améliorer la marge des petits articles",
  );
  // Et sur un gros article, la marge effective reste proche du barème.
  const big = retailPriceForCost(200.26);
  const margin = effectiveMarginPercent(big.priceUsd, 200.26);
  // L'arrondi au centime supérieur peut dépasser très légèrement le barème.
  assert.ok(margin >= 9.9 && margin < 10.1, `marge ${margin} hors barème`);
});

test("les articles sous 2 $ restent au catalogue, à 1,50 $ minimum", () => {
  // Aligné sur MIN_CRYPTO_INVOICE_USD : sous ce prix, la commande serait
  // refusée (below_minimum) et le bouton « Acheter » ne servirait à rien.
  assert.equal(MIN_RETAIL_USD, 1.5);
  for (const cost of [0.05, 0.3, 0.5, 0.75, 0.99]) {
    const { priceUsd } = retailPriceForCost(cost);
    assert.equal(priceUsd, 1.5, `coût ${cost} → ${priceUsd}, attendu 1,50 $`);
  }
  for (const cost of [0.05, 0.3, 0.5, 0.75, 0.99, 1.4, 1.9]) {
    const { priceUsd } = retailPriceForCost(cost);
    assert.ok(priceUsd >= 1.5, `coût ${cost} → ${priceUsd} sous le plancher public`);
    assert.ok(priceUsd > cost + 0.4, `coût ${cost} → ${priceUsd} : marge insuffisante`);
  }
  // Au-delà du plancher public, le barème reprend ses droits.
  assert.equal(retailPriceForCost(1.4).priceUsd, 1.85);
  assert.equal(retailPriceForCost(1.9).priceUsd, 2.38);
  assert.equal(retailPriceForCost(2.4).priceUsd, 3);
});

/* ------------------------------ Réseaux -------------------------------- */

test("les chaînes à frais élevés sont détectées", () => {
  for (const ticker of [
    "usdttrc20",
    "trx",
    "usdterc20",
    "eth",
    "btc",
    "usdteth",
  ]) {
    assert.equal(isHighCostNetwork(ticker), true, `${ticker} doit être coûteux`);
    assert.equal(isLowCostNetwork(ticker), false, `${ticker} n'est pas en liste blanche`);
  }
});

test("les sept réseaux retenus sont reconnus", () => {
  for (const ticker of [
    "usdtbsc",
    "usdtsol",
    "usdtton",
    "usdtmatic",
    "usdtarb",
    "usdtavax",
    "usdtapt",
  ]) {
    assert.equal(isLowCostNetwork(ticker), true, `${ticker} doit être en liste blanche`);
    assert.equal(isHighCostNetwork(ticker), false, `${ticker} ne doit pas être coûteux`);
  }
});

test("le ticker TON n'est pas confondu avec Tron", () => {
  assert.equal(isLowCostNetwork("usdtton"), true);
  assert.equal(isHighCostNetwork("usdtton"), false);
  assert.equal(isHighCostNetwork("usdttrc20"), true);
});

test("le libellé affiché est lisible, avec repli sur le ticker", () => {
  assert.equal(paymentNetworkLabel("usdtbsc"), "BNB Smart Chain (BEP-20)");
  assert.equal(paymentNetworkLabel("usdttrc20"), "Tron (TRC-20)");
  assert.equal(paymentNetworkLabel("doge"), "DOGE");
  assert.equal(paymentNetworkLabel(null), "—");
});

test("le message client cite les réseaux recommandés", () => {
  const label = recommendedNetworksLabel();
  for (const network of LOW_COST_NETWORKS) {
    assert.ok(label.includes(network.label), `${network.label} manquant`);
  }
  for (const network of HIGH_COST_NETWORKS) {
    assert.ok(!label.includes(network.label), `${network.label} ne doit pas être proposé`);
  }
});

test("la liste blanche et la liste noire ne se chevauchent pas", () => {
  const low = new Set(LOW_COST_NETWORKS.map((network) => network.id));
  for (const network of HIGH_COST_NETWORKS) {
    assert.ok(!low.has(network.id), `${network.id} présent dans les deux listes`);
  }
  // Les fragments aussi : un fragment partagé rendrait la détection ambiguë.
  const fragments = new Set(LOW_COST_NETWORKS.flatMap((network) => network.matches));
  for (const network of HIGH_COST_NETWORKS) {
    for (const fragment of network.matches) {
      assert.ok(!fragments.has(fragment), `fragment ambigu : ${fragment}`);
    }
  }
});
