// Classification d'un site du portfolio : chaque projet est rattaché à
// une formule tarifaire (« vitrine », « vitrine-plus », « boutique »…)
// qui détermine son modèle, son prix de personnalisation et son total.
//
// Le propriétaire peut modifier ces informations projet par projet dans
// /admin/content, et les tarifs des catégories dans /admin/settings.
// Ce module est volontairement sans dépendance serveur : il est utilisé
// par les pages publiques, le panneau admin et les composants clients.

import type { Demo } from "@/lib/site-types";

/** Forme minimale d'une formule tarifaire (config ou base de données). */
export interface ClassificationPlan {
  id: string;
  name: string;
  nameEn: string;
  price: number;
  priceUsd?: number | null;
  /** Pourcentage du modèle utilisé pour calculer les frais de personnalisation. */
  customizationPercent?: number | null;
}

export interface PlanPriceBreakdown {
  /** Prix du modèle seul, en USD. */
  modelPriceUsd: number | null;
  /** Équivalent indicatif du modèle en LYD. */
  modelPriceLyd: number;
  /** Pourcentage des frais de personnalisation, si tarif proportionnel. */
  customizationPercent: number | null;
  /** Frais de personnalisation additionnels, null = devis requis. */
  customizationUsd: number | null;
  /** Équivalent indicatif des frais en LYD, null si taux indisponible. */
  customizationLyd: number | null;
  /** Total du projet, null tant que le tarif de personnalisation est inconnu. */
  totalPriceUsd: number | null;
  /** Total indicatif en LYD, null tant que le tarif n'est pas complet. */
  totalPriceLyd: number | null;
}

export interface DemoClassification extends PlanPriceBreakdown {
  /** Numéro affiché : « Catégorie 3 ». */
  tier: number;
  planId: string;
  name: string;
  nameEn: string;
  /** Prix de référence USD du modèle de la catégorie (null si non configuré). */
  categoryPriceUsd: number | null;
  /** Alias historique : prix du modèle (hors personnalisation). */
  priceUsd: number | null;
  /** Alias historique : prix LYD du modèle (hors personnalisation). */
  priceLyd: number;
  /** true = le prix du modèle a été personnalisé pour ce projet précis. */
  customPrice: boolean;
}

/**
 * Construit un récapitulatif de prix. Le prix en LYD de la personnalisation
 * suit le taux indicatif déjà utilisé pour le modèle de la formule.
 */
export function resolvePlanPriceBreakdown(
  plan: ClassificationPlan,
  modelPriceUsd: number | null | undefined = plan.priceUsd,
  modelPriceLyd: number = plan.price,
): PlanPriceBreakdown {
  const safeModelUsd =
    typeof modelPriceUsd === "number" && Number.isFinite(modelPriceUsd) && modelPriceUsd > 0
      ? modelPriceUsd
      : null;
  const safeModelLyd =
    Number.isFinite(modelPriceLyd) && modelPriceLyd >= 0 ? modelPriceLyd : 0;
  const customizationPercent =
    typeof plan.customizationPercent === "number" &&
    Number.isFinite(plan.customizationPercent) &&
    plan.customizationPercent >= 0 &&
    plan.customizationPercent <= 100
      ? plan.customizationPercent
      : null;
  const customizationUsd =
    customizationPercent == null || safeModelUsd == null
      ? null
      : Math.round(safeModelUsd * (customizationPercent / 100) * 100) / 100;
  const usdToLyd =
    typeof plan.priceUsd === "number" && plan.priceUsd > 0 && plan.price > 0
      ? plan.price / plan.priceUsd
      : null;
  const customizationLyd =
    customizationUsd == null
      ? null
      : customizationUsd === 0
        ? 0
        : customizationPercent != null
          ? Math.round(safeModelLyd * (customizationPercent / 100))
          : usdToLyd == null
            ? null
            : Math.round(customizationUsd * usdToLyd);
  const totalPriceUsd =
    safeModelUsd == null || customizationUsd == null
      ? null
      : Math.round((safeModelUsd + customizationUsd) * 100) / 100;
  const totalPriceLyd =
    totalPriceUsd == null || customizationLyd == null
      ? null
      : safeModelLyd + customizationLyd;

  return {
    modelPriceUsd: safeModelUsd,
    modelPriceLyd: safeModelLyd,
    customizationPercent,
    customizationUsd,
    customizationLyd,
    totalPriceUsd,
    totalPriceLyd,
  };
}

/**
 * Résout la classification d'un projet.
 *
 * Ordre de priorité :
 *  1. la formule choisie (`planId`) ;
 *  2. sinon la catégorie (`categoryTier`) → formule à cette position ;
 *  3. sinon la première formule disponible.
 *
 * Le prix du modèle suit la catégorie, sauf si `demo.priceUsd` est
 * renseigné (prix du modèle propre à ce projet). La personnalisation est
 * ensuite ajoutée au montant du modèle, selon le tarif de la catégorie.
 */
export function resolveDemoClassification(
  demo: Pick<Demo, "planId" | "categoryTier" | "priceUsd">,
  plans: readonly ClassificationPlan[],
): DemoClassification | null {
  if (plans.length === 0) return null;

  let index = -1;
  if (demo.planId) {
    index = plans.findIndex((plan) => plan.id === demo.planId);
  }
  if (index < 0 && typeof demo.categoryTier === "number" && demo.categoryTier > 0) {
    index = Math.min(plans.length - 1, Math.floor(demo.categoryTier) - 1);
  }
  if (index < 0) index = 0;

  const plan = plans[index];
  const tier =
    typeof demo.categoryTier === "number" && demo.categoryTier > 0
      ? Math.floor(demo.categoryTier)
      : index + 1;

  const customPrice =
    typeof demo.priceUsd === "number" &&
    Number.isFinite(demo.priceUsd) &&
    demo.priceUsd > 0;

  const categoryPriceUsd =
    typeof plan.priceUsd === "number" && plan.priceUsd > 0 ? plan.priceUsd : null;
  const modelPriceUsd = customPrice ? (demo.priceUsd as number) : categoryPriceUsd;

  // Conversion indicative dans la devise locale au taux de la catégorie.
  const modelPriceLyd = customPrice
    ? categoryPriceUsd
      ? Math.round((plan.price * (demo.priceUsd as number)) / categoryPriceUsd)
      : plan.price
    : plan.price;
  const breakdown = resolvePlanPriceBreakdown(plan, modelPriceUsd, modelPriceLyd);

  return {
    tier,
    planId: plan.id,
    name: plan.name,
    nameEn: plan.nameEn,
    categoryPriceUsd,
    // Compatibilité avec les consommateurs existants : ces deux champs
    // restent le prix du modèle seul, pas le total incluant la personnalisation.
    priceUsd: modelPriceUsd,
    priceLyd: modelPriceLyd,
    customPrice,
    ...breakdown,
  };
}

/** « 4 290 » — séparateur de milliers, sans décimales superflues. */
export function formatLyd(amount: number): string {
  return amount.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

/**
 * Libellé de la devise locale (Livre libyenne) affiché avec les montants
 * LYD (équivalents indicatifs). La devise PRINCIPALE du site est le dollar —
 * voir `formatMainPrice` dans `src/lib/installments.ts`.
 */
export function lydLabel(locale: "ar" | "en" | string): string {
  return locale === "ar" ? "د.ل" : "LYD";
}

/**
 * Texte alternatif de l'image d'un projet.
 *
 * Les champs `imageAltAr` / `imageAltEn` (éditables dans /admin/content ou
 * proposés par l'assistant SEO IA) sont prioritaires ; sinon on retombe sur
 * le titre du projet, déjà descriptif et localisé.
 */
export function demoImageAlt(demo: Demo, locale: "ar" | "en" | string): string {
  const ar = locale === "ar";
  const custom = ar ? demo.imageAltAr?.trim() : demo.imageAltEn?.trim();
  if (custom) return custom;
  return ar ? demo.title : demo.titleEn;
}
