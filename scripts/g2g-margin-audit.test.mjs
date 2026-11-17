#!/usr/bin/env node
/**
 * Verrouille l'arithmétique de l'audit de marge G2G.
 *
 * Ces tests ne vérifient pas des prix (ils changent) mais la FORMULE : si
 * quelqu'un « simplifie » un jour le calcul, la marge affichée à
 * l'exploitant deviendrait fausse sans que rien ne casse ailleurs.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  effectiveTakeRate,
  feePercentForPrice,
  fixedFeeShare,
  maxCostForMargin,
  netMarginPercent,
  netPayout,
  priceForMargin,
} from "../scripts/g2g-margin-audit.mjs";

/** Scénario de référence : ce qui est réellement facturé aujourd'hui. */
const REALISTE = {
  commissionPct: 4.99,
  withdrawalPct: 4.99,
  withdrawalFixedUsd: 0.99,
  networkUsd: 1.0,
  batchUsd: 400,
};

/** Fin de la promotion 4,99 % → tarif « Other Service » rang Normal. */
const SANS_PROMO = { ...REALISTE, commissionPct: 9.99 };

test("le taux effectif additionne commission, retrait et part fixe", () => {
  const take = effectiveTakeRate(REALISTE);
  // 1 − (1 − 0,0499) × (1 − 0,0499 − partFixe)
  assert.ok(take > 0.0499 * 2, "le taux doit être supérieur à la somme des deux %");
  assert.ok(take < 0.15, "et rester sous 15 % dans le cas nominal");
  // Sans aucun frais, le taux est nul.
  assert.equal(
    effectiveTakeRate({ ...REALISTE, commissionPct: 0, withdrawalPct: 0, withdrawalFixedUsd: 0, networkUsd: 0 }),
    0,
  );
});

test("une commission plus élevée ne peut jamais améliorer le net", () => {
  const withPromo = netPayout(50, REALISTE);
  const withoutPromo = netPayout(50, SANS_PROMO);
  assert.ok(withoutPromo < withPromo);
  // 5 points de commission en moins, soit 2,375 $ sur une vente de 50 $.
  assert.equal(Math.round((withPromo - withoutPromo) * 100) / 100, 2.38);
});

test("les frais fixes se diluent avec le lot de retrait, pas avec la vente", () => {
  const small = fixedFeeShare({ ...REALISTE, batchUsd: 100 });
  const large = fixedFeeShare({ ...REALISTE, batchUsd: 1000 });
  assert.ok(small > large * 9, "un lot dix fois plus gros divise la part fixe par ~10");
});

test("en mode isolé, une petite vente paie tous les frais fixes", () => {
  const batched = netPayout(10, REALISTE, "batch");
  const solo = netPayout(10, REALISTE, "solo");
  assert.ok(solo < batched);
  // 10 $ ne couvrent plus 1,99 $ de frais fixes + 9,7 % de prélèvements.
  assert.ok(solo < 8, "le net d'une vente isolée de 10 $ doit rester sous 8 $");
});

test("le prix pour une marge cible reproduit bien cette marge", () => {
  for (const target of [5, 8, 12, 15]) {
    for (const cost of [4, 9.63, 42.63, 98.98]) {
      const price = priceForMargin(cost, target, REALISTE);
      const realised = netMarginPercent(price, cost, REALISTE);
      assert.ok(
        Math.abs(realised - target) < 0.01,
        `cible ${target} % : obtenu ${realised.toFixed(3)} % pour un coût de ${cost} $`,
      );
    }
  }
});

test("le prix pour une marge cible reste supérieur au coût fournisseur", () => {
  for (const cost of [1, 10, 50, 100]) {
    const price = priceForMargin(cost, 12, REALISTE);
    assert.ok(price > cost, "vendre sous le coût ne peut pas dégager de marge");
    assert.ok(Number.isFinite(price));
  }
});

test("le coût maximal à marge cible est cohérent avec le prix", () => {
  const price = 50.4;
  const maxCost = maxCostForMargin(price, 12, REALISTE);
  assert.ok(
    Math.abs(netMarginPercent(price, maxCost, REALISTE) - 12) < 0.01,
    "payer exactement le coût max doit donner la marge cible",
  );
  assert.ok(maxCost < netPayout(price, REALISTE));
});

test("le pourcentage équivalent reproduit le net du modèle complet", () => {
  // C'est la valeur que le code applique : un seul % sur le prix de vente.
  for (const price of [9.9, 24.92, 50.4, 141.76]) {
    const fee = feePercentForPrice(price, REALISTE);
    const netFromCode = price * (1 - fee / 100);
    assert.ok(
      Math.abs(netFromCode - netPayout(price, REALISTE)) < 0.005,
      `à ${price} $, le % équivalent doit redonner le net réel`,
    );
  }
});

test("un prix nul ou négatif ne produit jamais de marge", () => {
  assert.equal(netMarginPercent(0, 10, REALISTE), -100);
  assert.ok(netPayout(0, REALISTE) <= 0);
  assert.equal(feePercentForPrice(0, REALISTE), 100);
});

test("sans promotion, le prélèvement franchit le seuil qui rend le catalogue perdant", () => {
  const takeWithPromo = effectiveTakeRate(REALISTE) * 100;
  const takeWithoutPromo = effectiveTakeRate(SANS_PROMO) * 100;
  assert.ok(takeWithoutPromo > 14, "hors promo, le prélèvement dépasse 14 %");
  assert.ok(takeWithoutPromo - takeWithPromo > 4, "l'écart de 5 points de commission est déterminant");
});
