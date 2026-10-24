// Classification d'un site du portfolio : chaque projet est rattaché à
// une formule tarifaire (« vitrine », « vitrine-plus », « boutique »…)
// qui détermine son modèle, son prix de personnalisation et son total.
//
// Devise unique du site : le dollar américain (USD), réglable en USDT
// au paiement crypto (1 USD = 1 USDT). Aucun équivalent en devise
// locale n'est calculé ni affiché — l'affichage est international.
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
  priceUsd?: number | null;
  /** Pourcentage du modèle utilisé pour calculer les frais de personnalisation. */
  customizationPercent?: number | null;
}

export interface PlanPriceBreakdown {
  /** Prix du modèle seul, en USD. */
  modelPriceUsd: number | null;
  /** Pourcentage des frais de personnalisation, si tarif proportionnel. */
  customizationPercent: number | null;
  /** Frais de personnalisation additionnels, null = devis requis. */
  customizationUsd: number | null;
  /** Total du projet, null tant que le tarif de personnalisation est inconnu. */
  totalPriceUsd: number | null;
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
  /** true = le prix du modèle a été personnalisé pour ce projet précis. */
  customPrice: boolean;
}

/** Construit un récapitulatif de prix, en USD uniquement. */
export function resolvePlanPriceBreakdown(
  plan: ClassificationPlan,
  modelPriceUsd: number | null | undefined = plan.priceUsd,
): PlanPriceBreakdown {
  const safeModelUsd =
    typeof modelPriceUsd === "number" && Number.isFinite(modelPriceUsd) && modelPriceUsd > 0
      ? modelPriceUsd
      : null;
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
  const totalPriceUsd =
    safeModelUsd == null || customizationUsd == null
      ? null
      : Math.round((safeModelUsd + customizationUsd) * 100) / 100;

  return {
    modelPriceUsd: safeModelUsd,
    customizationPercent,
    customizationUsd,
    totalPriceUsd,
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
  const breakdown = resolvePlanPriceBreakdown(plan, modelPriceUsd);

  return {
    tier,
    planId: plan.id,
    name: plan.name,
    nameEn: plan.nameEn,
    categoryPriceUsd,
    // Compatibilité avec les consommateurs existants : ce champ reste le
    // prix du modèle seul, pas le total incluant la personnalisation.
    priceUsd: modelPriceUsd,
    customPrice,
    ...breakdown,
  };
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
