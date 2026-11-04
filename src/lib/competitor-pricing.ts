/**
 * Alignement des prix sur le marché — logique PURE (aucune I/O, testable).
 *
 * Le problème résolu : le barème maison (`fazercards-pricing.ts`) garantit la
 * marge, jamais la compétitivité. Résultat possible : un prix rentable mais
 * au-dessus du marché (PSN 50 $ à 50,50 $ quand Eneba le vend 48,20 $), ou un
 * prix compétitif mais vendu à perte.
 *
 * La formule retenue :
 *
 *     cible   = référence marché × (1 − décote)      [référence revendeur]
 *     cible   = référence marché                      [référence officielle = plafond]
 *     plancher = (coût + frais fixes + profit mini) / (1 − commission %)
 *     prix    = cible SI cible ≥ plancher, SINON aucun changement (statut « bloqué »)
 *
 * Trois propriétés voulues :
 *  1. **On ne vend jamais sous le plancher** — la compétitivité ne finance pas
 *     une perte. Quand le marché est sous le plancher, le produit est signalé
 *     (« bloqué ») : c'est une décision commerciale (bundle, délistage,
 *     renégociation du coût), pas un arrondi silencieux.
 *  2. **On ne monte jamais au-dessus d'un prix officiel** — la valeur faciale
 *     est un plafond, pas une cible : facturer plus cher que la plateforme
 *     elle-même n'est pas défendable.
 *  3. **On ne bouge pas de plus de `maxStepPercent` en une fois** — une
 *     référence erronée (prix cassé chez un revendeur) ne doit pas casser le
 *     catalogue ; le changement est signalé, pas appliqué.
 */

import {
  benchmarkForDenomination,
  type MarketBenchmark,
} from "./competitor-prices.ts";

export interface AlignmentOptions {
  /** Interrupteur général : `false` = aucun prix touché, quel que soit le reste. */
  enabled: boolean;
  /** Décote visée sous la référence revendeur, en pourcentage (1,5 = −1,5 %). */
  undercutPercent: number;
  /** Commission passerelle, en pourcentage du prix de vente. */
  feePercent: number;
  /** Frais fixes par commande (réseau + retrait), en dollars. */
  fixedFeeUsd: number;
  /** Profit minimal en dollars, quel que soit le montant. */
  minProfitUsd: number;
  /** Variation maximale acceptée en une application (garde-fou), en pourcentage. */
  maxStepPercent: number;
  /** Prix public plancher absolu (aligné sur `MIN_RETAIL_USD`). */
  minRetailUsd?: number;
  /**
   * Marge de repli appliquée quand le marché passe sous le plancher, en % du
   * coût (1 = coût + 1 %). `0` = comportement historique (prix inchangé).
   *
   * ⚠️ Ce prix reste SOUS le plancher de rentabilité : la commission
   * (1,5 % + 1,00 $) coûte plus que la marge ajoutée. C'est un choix
   * commercial assumé (rester au niveau du marché) — l'écran d'admin affiche
   * la marge nette réelle, qui est négative sur les petits montants.
   */
  blockedMarginPercent?: number;
  /** Fiches dont le prix est fixé à la main : jamais réalignées. */
  lockedProductIds?: readonly string[];
}

export const DEFAULT_ALIGNMENT_OPTIONS: AlignmentOptions = {
  enabled: true,
  undercutPercent: 1.5,
  // Taux réel du compte NOWPayments (multi-devises, e-mail du 18/10/2026) :
  // 1,4 %. Mono-devise = 0,9 % — voir `siteConfig.pricingAlignment`.
  feePercent: 1.4,
  fixedFeeUsd: 1,
  minProfitUsd: 0.5,
  maxStepPercent: 25,
  minRetailUsd: 1.5,
  blockedMarginPercent: 1,
  lockedProductIds: [],
};

export type AlignmentStatus =
  /** Aucun changement nécessaire : déjà au niveau visé. */
  | "aligned"
  /** Prix baissé pour rejoindre le marché. */
  | "lowered"
  /** Prix relevé jusqu'au niveau du marché (référence revendeur seulement). */
  | "raised"
  /** Le marché est sous le plancher de rentabilité : aucun prix ne peut suivre. */
  | "blocked"
  /** Marché sous le plancher : repli sur « coût + marge de repli ». */
  | "cost_margin"
  /** Le changement dépasserait le garde-fou de variation. */
  | "step_blocked"
  /** Aucune référence de marché pour ce montant. */
  | "no_benchmark"
  /** Coût fournisseur inconnu : impossible de garantir la marge. */
  | "no_cost"
  /** Alignement désactivé par la configuration. */
  | "disabled"
  /** Prix verrouillé à la main : l'alignement ne le touche pas. */
  | "locked";

export interface AlignmentResult {
  status: AlignmentStatus;
  /** Prix actuellement au catalogue (ou servi). */
  currentUsd: number;
  /** Référence de marché retenue. */
  benchmark: MarketBenchmark | null;
  /** Prix visé (après décote), avant application du plancher. */
  targetUsd: number | null;
  /** Prix incompressible pour ne pas vendre à perte. */
  floorUsd: number | null;
  /** Prix à appliquer (`null` = ne rien changer). */
  recommendedUsd: number | null;
  /** Écart du prix courant à la référence, en pourcentage (négatif = moins cher). */
  currentVsBenchmarkPercent: number | null;
  /** Écart du prix courant au prix recommandé, en pourcentage. */
  changePercent: number | null;
  /** Marge nette estimée au prix recommandé (ou courant si aucun changement). */
  netMarginUsd: number | null;
  netMarginPercent: number | null;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function isPositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/** Commission + frais fixes applicables à un prix de vente. */
export function sellingCosts(priceUsd: number, options: AlignmentOptions): number {
  if (!Number.isFinite(priceUsd) || priceUsd <= 0) return 0;
  return round2((priceUsd * options.feePercent) / 100 + options.fixedFeeUsd);
}

/**
 * Prix minimal acceptable pour un coût fournisseur donné.
 *
 * Le plancher inclut la commission **sur le prix final** : c'est une équation
 * simple (p = coût + frais + profit + p × commission), pas une approximation.
 */
export function floorPriceUsd(costUsd: number, options: AlignmentOptions): number {
  if (!isPositive(costUsd)) return 0;
  const fee = Math.min(Math.max(options.feePercent, 0), 90) / 100;
  const floor = (costUsd + options.fixedFeeUsd + options.minProfitUsd) / (1 - fee);
  return round2(Math.max(floor, options.minRetailUsd ?? 0));
}

/** Marge nette réelle (après commission et frais fixes) à un prix donné. */
export function netMarginUsd(
  priceUsd: number,
  costUsd: number | null | undefined,
  options: AlignmentOptions,
): number | null {
  if (!isPositive(priceUsd) || !isPositive(costUsd)) return null;
  return round2(priceUsd - costUsd - sellingCosts(priceUsd, options));
}

export interface AlignInput {
  /** Prix affiché aujourd'hui (catalogue ou prix servi). */
  currentUsd: number;
  /** Coût fournisseur en USD (`null` = inconnu). */
  costUsd: number | null | undefined;
  /** Référence de marché (`null` = aucune). */
  benchmark: MarketBenchmark | null;
}

/** Cœur de la formule. Ne lève jamais : tout état inattendu a son statut. */
export function alignPrice(
  input: AlignInput,
  options: AlignmentOptions = DEFAULT_ALIGNMENT_OPTIONS,
): AlignmentResult {
  const currentUsd = isPositive(input.currentUsd) ? round2(input.currentUsd) : 0;
  const benchmark = input.benchmark && isPositive(input.benchmark.usd) ? input.benchmark : null;

  const empty: AlignmentResult = {
    status: "no_benchmark",
    currentUsd,
    benchmark,
    targetUsd: null,
    floorUsd: null,
    recommendedUsd: null,
    currentVsBenchmarkPercent: null,
    changePercent: null,
    netMarginUsd: null,
    netMarginPercent: null,
  };

  if (!options.enabled) return { ...empty, status: "disabled" };
  if (!benchmark) return empty;

  const benchmarkUsd = round2(benchmark.usd);
  const currentVsBenchmarkPercent = currentUsd > 0
    ? round2(((currentUsd - benchmarkUsd) / benchmarkUsd) * 100)
    : null;

  if (!isPositive(input.costUsd)) {
    return { ...empty, status: "no_cost", currentVsBenchmarkPercent };
  }

  const floorUsd = floorPriceUsd(input.costUsd, options);
  const isReseller = benchmark.confidence === "reseller";
  const undercut = Math.min(Math.max(options.undercutPercent, 0), 50);
  const targetUsd = isReseller
    ? round2(benchmarkUsd * (1 - undercut / 100))
    : benchmarkUsd;

  // Le marché est inaccessible sans perte. Deux politiques :
  //  - `blockedMarginPercent` = 0 → on ne touche à rien et on signale ;
  //  - sinon → on applique « coût + marge » : ce n'est pas rentable une fois
  //    la commission payée, mais le prix reste au niveau du marché au lieu
  //    d'être 10 à 20 % plus cher que lui.
  if (targetUsd < floorUsd) {
    const fallbackPercent = Math.min(Math.max(options.blockedMarginPercent ?? 0, 0), 50);
    if (fallbackPercent > 0) {
      const fallbackUsd = round2(
        Math.max(input.costUsd * (1 + fallbackPercent / 100), options.minRetailUsd ?? 0),
      );
      const fallbackChange =
        currentUsd > 0 ? round2(((fallbackUsd - currentUsd) / currentUsd) * 100) : null;
      if (Math.abs(fallbackUsd - currentUsd) <= 0.004) {
        const margin = netMarginUsd(currentUsd, input.costUsd, options);
        return {
          status: "aligned",
          currentUsd,
          benchmark,
          targetUsd,
          floorUsd,
          recommendedUsd: null,
          currentVsBenchmarkPercent,
          changePercent: null,
          netMarginUsd: margin,
          netMarginPercent:
            margin != null && currentUsd > 0 ? round2((margin / currentUsd) * 100) : null,
        };
      }
      if (fallbackChange != null && Math.abs(fallbackChange) > options.maxStepPercent) {
        return {
          status: "step_blocked",
          currentUsd,
          benchmark,
          targetUsd,
          floorUsd,
          recommendedUsd: null,
          currentVsBenchmarkPercent,
          changePercent: fallbackChange,
          netMarginUsd: netMarginUsd(currentUsd, input.costUsd, options),
          netMarginPercent: null,
        };
      }
      const fallbackMargin = netMarginUsd(fallbackUsd, input.costUsd, options);
      return {
        status: "cost_margin",
        currentUsd,
        benchmark,
        targetUsd,
        floorUsd,
        recommendedUsd: fallbackUsd,
        currentVsBenchmarkPercent,
        changePercent: fallbackChange,
        netMarginUsd: fallbackMargin,
        netMarginPercent:
          fallbackMargin != null ? round2((fallbackMargin / fallbackUsd) * 100) : null,
      };
    }
    const margin = netMarginUsd(currentUsd, input.costUsd, options);
    return {
      status: "blocked",
      currentUsd,
      benchmark,
      targetUsd,
      floorUsd,
      recommendedUsd: null,
      currentVsBenchmarkPercent,
      changePercent: null,
      netMarginUsd: margin,
      netMarginPercent:
        margin != null && currentUsd > 0 ? round2((margin / currentUsd) * 100) : null,
    };
  }

  // Référence officielle = plafond : on ne relève jamais vers elle.
  const recommendedUsd = isReseller
    ? Math.max(targetUsd, floorUsd)
    : Math.min(currentUsd, targetUsd);

  if (!isPositive(recommendedUsd) || Math.abs(recommendedUsd - currentUsd) <= 0.004) {
    const margin = netMarginUsd(currentUsd, input.costUsd, options);
    return {
      status: "aligned",
      currentUsd,
      benchmark,
      targetUsd,
      floorUsd,
      recommendedUsd: null,
      currentVsBenchmarkPercent,
      changePercent: null,
      netMarginUsd: margin,
      netMarginPercent:
        margin != null && currentUsd > 0 ? round2((margin / currentUsd) * 100) : null,
    };
  }

  const changePercent = currentUsd > 0
    ? round2(((recommendedUsd - currentUsd) / currentUsd) * 100)
    : null;

  if (changePercent != null && Math.abs(changePercent) > options.maxStepPercent) {
    return {
      status: "step_blocked",
      currentUsd,
      benchmark,
      targetUsd,
      floorUsd,
      recommendedUsd: null,
      currentVsBenchmarkPercent,
      changePercent,
      netMarginUsd: netMarginUsd(currentUsd, input.costUsd, options),
      netMarginPercent: null,
    };
  }

  const margin = netMarginUsd(recommendedUsd, input.costUsd, options);
  return {
    status: recommendedUsd < currentUsd ? "lowered" : "raised",
    currentUsd,
    benchmark,
    targetUsd,
    floorUsd,
    recommendedUsd,
    currentVsBenchmarkPercent,
    changePercent,
    netMarginUsd: margin,
    netMarginPercent: margin != null ? round2((margin / recommendedUsd) * 100) : null,
  };
}

/** Forme minimale d'une dénomination attendue par l'alignement. */
export interface AlignableDenomination {
  faceValue: string;
  faceCurrency?: string | null;
  reloadlyUnitPrice?: number | null;
  priceUsd: number;
  supplierCostUsd?: number | null;
}

export interface AlignableProduct<D extends AlignableDenomination> {
  id?: string;
  platform: string;
  denominations: D[];
}

/**
 * Applique l'alignement à un catalogue entier.
 *
 * Ne modifie QUE `priceUsd` : aucune donnée interne (coût, référence) n'est
 * ajoutée à la fiche, pour que le résultat reste « public » sans filtrage
 * supplémentaire.
 */
export function applyCompetitorPricing<P extends AlignableProduct<D>, D extends AlignableDenomination>(
  products: readonly P[],
  options: AlignmentOptions = DEFAULT_ALIGNMENT_OPTIONS,
): P[] {
  if (!options.enabled) return products as P[];
  const locked = new Set(options.lockedProductIds ?? []);
  return products.map((product) => {
    if (product.id && locked.has(product.id)) return product;
    let changed = false;
    const denominations = product.denominations.map((denomination) => {
      const benchmark = benchmarkForDenomination(product.platform, denomination);
      if (!benchmark) return denomination;
      const result = alignPrice(
        {
          currentUsd: denomination.priceUsd,
          costUsd: denomination.supplierCostUsd,
          benchmark,
        },
        options,
      );
      if (result.recommendedUsd == null) return denomination;
      changed = true;
      return { ...denomination, priceUsd: result.recommendedUsd };
    });
    return changed ? { ...product, denominations } : product;
  });
}

/** Résumé d'alignement d'un catalogue (pour l'écran d'administration). */
export function summariseAlignment(results: readonly AlignmentResult[]): {
  total: number;
  aligned: number;
  lowered: number;
  raised: number;
  blocked: number;
  costMargin: number;
  stepBlocked: number;
  locked: number;
  noBenchmark: number;
  noCost: number;
  /** Nombre de références où le marché est **sous** le plancher de marge. */
  unprofitableAtMarket: number;
} {
  const count = (status: AlignmentStatus) => results.filter((r) => r.status === status).length;
  return {
    total: results.length,
    aligned: count("aligned"),
    lowered: count("lowered"),
    raised: count("raised"),
    blocked: count("blocked"),
    costMargin: count("cost_margin"),
    stepBlocked: count("step_blocked"),
    locked: count("locked"),
    noBenchmark: count("no_benchmark"),
    noCost: count("no_cost"),
    unprofitableAtMarket: count("blocked") + count("cost_margin"),
  };
}
