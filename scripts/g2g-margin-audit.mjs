#!/usr/bin/env node
/**
 * Audit de marge G2G — rejoue les calculs de docs/audit-marges-g2g-2026-11-17.md.
 *
 *   node scripts/g2g-margin-audit.mjs            # tableau Markdown
 *   node scripts/g2g-margin-audit.mjs --json     # sortie machine
 *
 * Lit docs/data/g2g-margin-audit-2026-11-17.json (prix relevés + barème de
 * frais). Aucun réseau, aucun secret : tout est dans le fichier de données.
 *
 * Modèle de frais (3 couches, toutes prélevées côté vendeur) :
 *
 *   1. commission sur la vente           → crédit vendeur = P × (1 − c)
 *   2. frais de retrait (%, + fixe)      → sur le lot retiré, pas sur la vente
 *   3. frais de réseau crypto (fixe)     → par retrait
 *
 * Les frais fixes (2 et 3) ne se diluent pas sur une vente isolée : ils se
 * répartissent sur le LOT de retrait. C'est pour cela que le taux effectif
 * dépend du montant retiré à la fois, et qu'un petit panier ne peut pas être
 * rentable sur G2G (même logique que les frais fixes NOWPayments du site).
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const data = JSON.parse(
  readFileSync(`${root}/docs/data/g2g-margin-audit-2026-11-17.json`, "utf8"),
);

const round2 = (value) => Math.round(value * 100) / 100;
/** Formatage français : virgule décimale, comme le reste de la documentation. */
const num = (value) => round2(value).toFixed(2).replace(".", ",");
const pct = (value) => `${value >= 0 ? "+" : ""}${num(value)} %`;
const usd = (value) => num(value);

/**
 * Part des frais FIXES (retrait + réseau) rapportée au volume de vente, en
 * fraction. En mode « lot », ces frais sont répartis au prorata du volume
 * vendu avant retrait ; en mode « isolé », ils tombent entièrement sur la
 * vente.
 */
export function fixedFeeShare(scenario) {
  const creditPerBatch = scenario.batchUsd * (1 - scenario.commissionPct / 100);
  const fixedTotal = scenario.withdrawalFixedUsd + scenario.networkUsd;
  return creditPerBatch > 0 ? fixedTotal / creditPerBatch : 0;
}

/** Taux de prélèvement total effectif (fraction du prix de vente), frais fixes compris. */
export function effectiveTakeRate(scenario) {
  const c = scenario.commissionPct / 100;
  const w = scenario.withdrawalPct / 100 + fixedFeeShare(scenario);
  return 1 - (1 - c) * (1 - w);
}

/**
 * Net encaissé sur une vente de `salePrice`.
 *
 * @param mode `batch` — les frais fixes du retrait sont répartis sur tout le
 *   lot (`scenario.batchUsd`) : cas réel d'un vendeur qui accumule plusieurs
 *   ventes avant de retirer. Le net reste alors proportionnel au prix.
 * @param mode `solo` — la vente paie à elle seule les frais fixes du retrait.
 *   C'est le pire cas, et le seul honnête pour une petite commande isolée.
 */
export function netPayout(salePrice, scenario, mode = "batch") {
  const credit = salePrice * (1 - scenario.commissionPct / 100);
  const withdrawn = credit * (1 - scenario.withdrawalPct / 100);
  if (mode === "solo") {
    return withdrawn - (scenario.withdrawalFixedUsd + scenario.networkUsd);
  }
  // Part fixe au prorata du volume : (frais fixes / volume du lot) × prix.
  const fixedTotal = scenario.withdrawalFixedUsd + scenario.networkUsd;
  const prorata = scenario.batchUsd > 0 ? fixedTotal * (salePrice / scenario.batchUsd) : fixedTotal;
  return withdrawn - prorata;
}

/** Marge nette en % du revenu net (convention de `evaluateG2gMargin`). */
export function netMarginPercent(salePrice, costUsd, scenario, mode = "batch") {
  const net = netPayout(salePrice, scenario, mode);
  if (net <= 0) return -100;
  return ((net - costUsd) / net) * 100;
}

/**
 * Prix de vente nécessaire pour atteindre une marge nette cible.
 *
 * En mode `solo`, les frais fixes s'ajoutent au coût : le prix explose sur les
 * petits montants — c'est exactement le mur économique des cartes à 10 $. En
 * mode `batch`, la part fixe est déjà incluse dans le taux effectif.
 */
export function priceForMargin(costUsd, targetMarginPercent, scenario, mode = "batch") {
  const target = targetMarginPercent / 100;
  if (target >= 1) return Infinity;

  if (mode === "solo") {
    const netRatio = (1 - scenario.commissionPct / 100) * (1 - scenario.withdrawalPct / 100);
    if (netRatio <= 0) return Infinity;
    return (costUsd / (1 - target) + scenario.withdrawalFixedUsd + scenario.networkUsd) / netRatio;
  }

  const take = effectiveTakeRate(scenario);
  if (take >= 1) return Infinity;
  // net = P × (1 − take) et l'on veut (net − coût)/net = cible
  // ⇒ net = coût/(1 − cible) ⇒ P = coût / ((1 − cible) × (1 − take))
  return costUsd / ((1 - target) * (1 - take));
}

/** Coût fournisseur maximal pour tenir une marge cible à un prix donné. */
export function maxCostForMargin(salePrice, targetMarginPercent, scenario, mode = "batch") {
  const net = netPayout(salePrice, scenario, mode);
  return net * (1 - targetMarginPercent / 100);
}

/**
 * Taux unique à déclarer dans `G2G_FEE_PERCENT` pour que `evaluateG2gMargin()`
 * reproduise le net réel de cette vente.
 *
 * Le code n'a qu'un pourcentage : c'est une approximation, et la valeur dépend
 * du montant. On la calcule donc par produit, puis on retient une valeur
 * prudente (le maximum), pour que l'automatisation ne surestime jamais la marge.
 */
export function feePercentForPrice(salePrice, scenario, mode = "batch") {
  const net = netPayout(salePrice, scenario, mode);
  if (salePrice <= 0) return 100;
  return (1 - net / salePrice) * 100;
}

/* ------------------------------- Rendu ------------------------------- */

const products = data.products
  .map((product) => {
    const prices = [...product.pricesUsd].sort((a, b) => a - b);
    const thirdLowest = prices.length >= 3 ? prices[2] : prices[prices.length - 1];
    return { ...product, sorted: prices, thirdLowest };
  })
  .sort((a, b) => a.family.localeCompare(b.family) || a.faceValueUsd - b.faceValueUsd);

const rows = [];
for (const scenario of data.scenarios) {
  const take = effectiveTakeRate(scenario) * 100;
  for (const product of products) {
    const net = netPayout(product.thirdLowest, scenario);
    const netSolo = netPayout(product.thirdLowest, scenario, "solo");
    rows.push({
      scenario: scenario.id,
      product: product.id,
      family: product.family,
      label: product.label,
      faceValueUsd: product.faceValueUsd,
      supplierCostUsd: product.supplierCostUsd,
      costs: product.sorted,
      thirdLowest: product.thirdLowest,
      effectiveTakePercent: round2(take),
      netPayoutUsd: round2(net),
      netSoloUsd: round2(netSolo),
      marginUsd: round2(net - product.supplierCostUsd),
      marginPercent: round2(netMarginPercent(product.thirdLowest, product.supplierCostUsd, scenario)),
      marginSoloPercent: round2(
        netMarginPercent(product.thirdLowest, product.supplierCostUsd, scenario, "solo"),
      ),
      priceFor8: round2(priceForMargin(product.supplierCostUsd, 8, scenario)),
      priceFor12: round2(priceForMargin(product.supplierCostUsd, 12, scenario)),
      priceFor15: round2(priceForMargin(product.supplierCostUsd, 15, scenario)),
      priceFor12Solo: round2(priceForMargin(product.supplierCostUsd, 12, scenario, "solo")),
      maxCost8: round2(maxCostForMargin(product.thirdLowest, 8, scenario)),
      maxCost12: round2(maxCostForMargin(product.thirdLowest, 12, scenario)),
      maxCost15: round2(maxCostForMargin(product.thirdLowest, 15, scenario)),
      // Vrai si le prix conseillé reste sous le 3ᵉ vendeur (donc visible en tête de liste).
      competitive: Math.max(product.thirdLowest * 0.99, priceForMargin(product.supplierCostUsd, 12, scenario)) <= product.thirdLowest * 1.001,
      feePercentEquivalent: round2(feePercentForPrice(product.thirdLowest, scenario)),
      soloTakePercent: round2(feePercentForPrice(product.thirdLowest, scenario, "solo")),
      // Prix conseillé : rester 1 % sous le 3ᵉ vendeur, sans jamais descendre
      // sous le prix qui garantit la marge cible. On retient le plus HAUT des deux.
      recommendedPrice: round2(
        Math.max(
          product.thirdLowest * 0.99,
          priceForMargin(product.supplierCostUsd, 12, scenario),
        ),
      ),
      note: product.note ?? null,
      costSource: product.costSource,
    });
  }
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2));
  process.exit(0);
}

const out = [];
out.push(`# Audit de marge G2G — calculs reproductibles\n`);
out.push(`Données : \`docs/data/g2g-margin-audit-2026-11-17.json\`. Relevé du ${data.observedAt}.\n`);
out.push(`Prix de référence = **3ᵉ prix le plus bas** de la place de marché : c'est le prix à`);
out.push(`ne pas dépasser pour apparaître dans les trois premières offres.\n`);

out.push(`## Taux de prélèvement effectif (tout compris)\n`);
out.push(`| Scénario | Commission | Retrait | Fixes | Taux effectif |`);
out.push(`| --- | ---: | ---: | ---: | ---: |`);
for (const scenario of data.scenarios) {
  const fixed = scenario.withdrawalFixedUsd + scenario.networkUsd;
  out.push(
    `| ${scenario.label} | ${num(scenario.commissionPct)} % | ${num(scenario.withdrawalPct)} % | ` +
      `${usd(fixed)} $ / lot de ${usd(scenario.batchUsd)} $ | **${num(effectiveTakeRate(scenario) * 100)} %** |`,
  );
}
out.push(``);

for (const scenario of data.scenarios) {
  const scoped = rows.filter((r) => r.scenario === scenario.id);
  out.push(`## ${scenario.label}\n`);
  out.push(`| Produit | Valeur | Coût FazerCards | 3 prix G2G | 3ᵉ prix | Net encaissé | Marge | % | Verdict |`);
  out.push(`| --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | --- |`);
  for (const row of scoped) {
    const prices = row.costs.map((p) => `${usd(p)}`);
    const verdict = row.marginUsd <= 0 ? "❌ perte" : row.marginPercent < 5 ? "⚠️ faible" : "✅";
    out.push(
      `| ${row.label} | ${usd(row.faceValueUsd)} $ | ${usd(row.supplierCostUsd)} $ | ` +
        `${prices.join(" · ")} | ${usd(row.thirdLowest)} $ | ${usd(row.netPayoutUsd)} $ | ` +
        `**${row.marginUsd >= 0 ? "+" : ""}${usd(row.marginUsd)} $** | ${pct(row.marginPercent)} | ${verdict} |`,
    );
  }
  out.push(``);
  out.push(`### Prix conseillé (marge nette ≥ 12 %, 1 % sous le 3ᵉ vendeur)\n`);
  out.push(`| Produit | Prix conseillé | Sous le 3ᵉ vendeur ? | Coût max à 12 % | \`G2G_FEE_PERCENT\` équivalent |`);
  out.push(`| --- | ---: | :---: | ---: | ---: |`);
  for (const row of scoped) {
    out.push(
      `| ${row.label} | **${usd(row.recommendedPrice)} $** | ` +
        `${row.competitive ? "oui" : "NON — hors marché"} | ${usd(row.maxCost12)} $ | ` +
        `${num(row.feePercentEquivalent)} % |`,
    );
  }
  out.push(``);
  const equivalents = scoped.map((r) => r.feePercentEquivalent).sort((a, b) => a - b);
  const flatRecommended = Math.ceil(equivalents[equivalents.length - 1] * 2) / 2;
  // Le code ne prend qu'un pourcentage : c'est la valeur à déployer pour que
  // `evaluateG2gMargin()` voie le net réel de ce scénario.
  out.push(`**\`G2G_FEE_PERCENT\` équivalent pour ce scénario : ${num(flatRecommended)} %**`);
  out.push(`(fourchette ${num(equivalents[0])} % – ${num(equivalents[equivalents.length - 1])} %, arrondie au demi-point supérieur).\n`);
}

console.log(out.join("\n"));
