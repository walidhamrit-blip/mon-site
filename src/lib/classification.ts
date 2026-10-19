// Classification d'un site du portfolio : chaque projet est rattaché à
// une formule tarifaire (« vitrine », « vitrine-plus », « boutique »…)
// qui détermine sa catégorie (1, 2, 3…) et son prix.
//
// Le propriétaire peut modifier ces informations projet par projet dans
// /admin/content, et les prix des catégories dans /admin/settings.
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
}

export interface DemoClassification {
  /** Numéro affiché : « Catégorie 3 ». */
  tier: number;
  planId: string;
  name: string;
  nameEn: string;
  /** Prix de référence USD de la catégorie (null si non configuré). */
  categoryPriceUsd: number | null;
  /** Prix final du projet en USD (catégorie ou prix personnalisé). */
  priceUsd: number | null;
  /** Prix final du projet en Livre libyenne. */
  priceLyd: number;
  /** true = le prix a été personnalisé pour ce projet précis. */
  customPrice: boolean;
}

/**
 * Résout la classification d'un projet.
 *
 * Ordre de priorité :
 *  1. la formule choisie (`planId`) ;
 *  2. sinon la catégorie (`categoryTier`) → formule à cette position ;
 *  3. sinon la première formule disponible.
 *
 * Le prix suit la catégorie, sauf si `demo.priceUsd` est renseigné
 * (prix propre au projet).
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

  const custom =
    typeof demo.priceUsd === "number" &&
    Number.isFinite(demo.priceUsd) &&
    demo.priceUsd > 0;

  const categoryPriceUsd =
    typeof plan.priceUsd === "number" && plan.priceUsd > 0 ? plan.priceUsd : null;

  const priceUsd = custom ? (demo.priceUsd as number) : categoryPriceUsd;

  // Conversion indicative dans la devise locale, au même taux que la
  // catégorie (ex. boutique : 880 $ ↔ 4 290 د.ل).
  const priceLyd = custom
    ? categoryPriceUsd
      ? Math.round((plan.price * (demo.priceUsd as number)) / categoryPriceUsd)
      : plan.price
    : plan.price;

  return {
    tier,
    planId: plan.id,
    name: plan.name,
    nameEn: plan.nameEn,
    categoryPriceUsd,
    priceUsd,
    priceLyd,
    customPrice: custom,
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
