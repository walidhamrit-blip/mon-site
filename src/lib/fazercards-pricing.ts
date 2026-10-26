/**
 * Politique de prix du catalogue FazerCards.
 *
 * ⚠️ Pourquoi une marge DÉGRESSIVE et un plancher de gain.
 *
 * Une marge unique (8 % à l'origine) ignore la structure réelle des coûts :
 * la commission de la passerelle est un pourcentage (~1,5 % chez
 * NOWPayments, plus la conversion), mais les frais de réseau blockchain et
 * le retrait sont des montants FIXES (~0,10 à 1,50 $ selon la chaîne). Sur
 * un article vendu 0,81 $, ces frais fixes dépassaient la marge : la vente
 * se soldait par une PERTE.
 *
 * D'où deux garde-fous, appliqués ensemble :
 *  - la marge en pourcentage DÉCROÎT quand le montant augmente (les gros
 *    paniers supportent une marge relative plus faible, la concurrence y est
 *    plus dure et les frais fixes y sont négligeables) ;
 *  - un PLANCHER de gain en dollars garantit que même un petit article
 *    rapporte de quoi couvrir les frais fixes.
 *
 * Le prix retenu est le PLUS ÉLEVÉ des deux calculs, arrondi au centime
 * SUPÉRIEUR : on ne vend jamais à perte, et jamais sous le plancher.
 */

/**
 * Prix de vente plancher, en dollars.
 *
 * Aucun article n'est affiché en dessous : sous ce seuil, les frais fixes
 * (réseau, passerelle, retrait) dévorent le montant, et le client se
 * retrouve à payer surtout des frais. Les articles très bon marché du
 * fournisseur restent donc au catalogue — simplement pas à 0,60 $.
 *
 * Cette valeur est ALIGNÉE sur `MIN_CRYPTO_INVOICE_USD` (1,50 $) : un prix
 * public inférieur au minimum de facture produisait un bouton « Acheter »
 * qui échouait systématiquement (`below_minimum`).
 */
export const MIN_RETAIL_USD = 1.5;

/** Tranche de marge, bornée par le COÛT fournisseur (pas le prix de vente). */
export interface MarginTier {
  /** Borne haute du coût fournisseur, exclue (`null` = dernière tranche). */
  maxCostUsd: number | null;
  /** Marge nette visée, en pourcentage du prix de vente. */
  marginPercent: number;
  /** Gain minimal en dollars, quel que soit le pourcentage. */
  minProfitUsd: number;
}

/**
 * Barème en vigueur (validé avec l'exploitant).
 *
 * | Coût fournisseur | Marge | Gain plancher |
 * | ---------------- | ----- | ------------- |
 * | < 5 $            | 20 %  | 0,45 $        |
 * | 5 – 20 $         | 15 %  | 1,00 $        |
 * | 20 – 60 $        | 12 %  | 2,50 $        |
 * | ≥ 60 $           | 10 %  | —             |
 */
export const MARGIN_TIERS: readonly MarginTier[] = [
  { maxCostUsd: 5, marginPercent: 20, minProfitUsd: 0.45 },
  { maxCostUsd: 20, marginPercent: 15, minProfitUsd: 1 },
  { maxCostUsd: 60, marginPercent: 12, minProfitUsd: 2.5 },
  { maxCostUsd: null, marginPercent: 10, minProfitUsd: 0 },
];

/** Tranche applicable à un coût fournisseur donné (en dollars). */
export function marginTierFor(costUsd: number): MarginTier {
  for (const tier of MARGIN_TIERS) {
    if (tier.maxCostUsd === null || costUsd < tier.maxCostUsd) return tier;
  }
  // Inatteignable : la dernière tranche est ouverte (`maxCostUsd: null`).
  return MARGIN_TIERS[MARGIN_TIERS.length - 1];
}

/** Arrondit au centime SUPÉRIEUR (jamais vers le bas : on perdrait de l'argent). */
function ceilToCent(value: number): number {
  return Math.ceil(value * 100 - 1e-9) / 100;
}

export interface RetailPrice {
  /** Prix de vente public, en dollars. */
  priceUsd: number;
  /** Marge en pourcentage appliquée à la tranche. */
  marginPercent: number;
  /** Gain plancher de la tranche. */
  minProfitUsd: number;
  /** Vrai si c'est le plancher (et non le pourcentage) qui a fixé le prix. */
  floorApplied: boolean;
}

/**
 * Calcule le prix de vente d'un article à partir de son coût fournisseur.
 *
 * `price = max(cost / (1 - marge), cost + plancher, MIN_RETAIL_USD)`,
 * arrondi au centime supérieur. Un coût absent ou nul renvoie 0 : l'appelant écarte alors
 * l'offre plutôt que d'afficher un prix inventé.
 */
export function retailPriceForCost(costUsd: number | null | undefined): RetailPrice {
  if (costUsd == null || !Number.isFinite(costUsd) || costUsd <= 0) {
    return { priceUsd: 0, marginPercent: 0, minProfitUsd: 0, floorApplied: false };
  }
  const tier = marginTierFor(costUsd);
  const byPercent = costUsd / (1 - tier.marginPercent / 100);
  const byFloor = costUsd + tier.minProfitUsd;
  const floorApplied = byFloor > byPercent;
  const computed = Math.max(byPercent, byFloor);
  // Le prix public ne descend jamais sous MIN_RETAIL_USD : en dessous, la
  // vente ne paie pas les frais fixes, quel que soit le barème.
  return {
    priceUsd: ceilToCent(Math.max(computed, MIN_RETAIL_USD)),
    marginPercent: tier.marginPercent,
    minProfitUsd: tier.minProfitUsd,
    floorApplied,
  };
}

/** Marge réellement dégagée, en pourcentage du prix de vente. */
export function effectiveMarginPercent(priceUsd: number, costUsd: number): number {
  if (!Number.isFinite(priceUsd) || priceUsd <= 0) return 0;
  return ((priceUsd - costUsd) / priceUsd) * 100;
}
