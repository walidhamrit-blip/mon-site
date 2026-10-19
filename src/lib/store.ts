import { cache } from "react";
import { eq } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { settings } from "@/db/schema";
import { siteConfig } from "@/lib/config";
import {
  demos as defaultDemos,
  faqs as defaultFaqs,
  testimonials as defaultTestimonials,
  heroContent as defaultHero,
  servicesRibbonContent as defaultRibbon,
  defaultWhyUs,
  defaultProcess,
  defaultSectionHeadings,
} from "@/lib/content";
import {
  SECTION_HEADING_IDS,
  type Demo,
  type Faq,
  type HeroContent,
  type ProcessStep,
  type RibbonContent,
  type SectionHeading,
  type SectionHeadings,
  type SiteConfigData,
  type SiteContent,
  type Testimonial,
  type WhyUsItem,
} from "@/lib/site-types";

// Accès aux données « vivantes » du site (configuration + contenu éditables
// depuis le panneau d'administration). Toutes les lectures sont protégées :
// en cas d'indisponibilité de la base, on retombe proprement sur les
// valeurs par défaut codées dans src/lib/config.ts et src/lib/content.ts.

const KEY_CONFIG = "site_config";
const KEY_DEMOS = "content_demos";
const KEY_FAQS = "content_faqs";
const KEY_TESTIMONIALS = "content_testimonials";
const KEY_HERO = "content_hero";
const KEY_RIBBON = "content_ribbon";
const KEY_WHY_US = "content_why_us";
const KEY_PROCESS = "content_process";
const KEY_HEADINGS = "content_headings";

export interface SiteData {
  config: typeof siteConfig;
  content: SiteContent;
}

/** Fusionne une configuration enregistrée par-dessus les valeurs par défaut. */
export function mergeConfig(override: unknown): typeof siteConfig {
  if (!override || typeof override !== "object") return siteConfig;
  const o = override as Record<string, unknown>;
  const base = siteConfig as unknown as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...base };
  for (const key of Object.keys(o)) {
    const value = o[key];
    if (value === undefined) continue;
    const baseValue = base[key];

    // Remplace les anciennes valeurs par défaut persistées, sans modifier
    // un domaine personnalisé configuré par le propriétaire du site.
    const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
    const isOldDefaultDomain = key === "domain" && normalized === "nukhba.ly";
    const isOldDefaultUrl =
      key === "url" && normalized.replace(/\/+$/, "") === "https://nukhba.ly";
    if (isOldDefaultDomain || isOldDefaultUrl) {
      merged[key] = baseValue;
      continue;
    }

    if (
      key === "pricing" &&
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      baseValue !== null &&
      typeof baseValue === "object" &&
      !Array.isArray(baseValue)
    ) {
      const basePricing = baseValue as Record<string, unknown>;
      const storedPricing = value as Record<string, unknown>;
      const defaultPlans = Array.isArray(basePricing.plans) ? basePricing.plans : [];
      const storedPlans = Array.isArray(storedPricing.plans) ? storedPricing.plans : [];
      const mergedPlans = storedPlans.map((storedPlan, index) => {
        if (!storedPlan || typeof storedPlan !== "object" || Array.isArray(storedPlan)) {
          return storedPlan;
        }
        const plan = storedPlan as Record<string, unknown>;
        const fallback = defaultPlans.find(
          (candidate) =>
            candidate &&
            typeof candidate === "object" &&
            !Array.isArray(candidate) &&
            (candidate as Record<string, unknown>).id === plan.id,
        ) ?? defaultPlans[index];
        if (!fallback || typeof fallback !== "object" || Array.isArray(fallback)) return plan;
        const defaults = fallback as Record<string, unknown>;
        return {
          ...defaults,
          ...plan,
          // Les anciennes sauvegardes (avant le paiement crypto) n'ont
          // pas la clé du tout → on garde le prix par défaut. Un `null`
          // explicite vient du formulaire admin (« Prix USD » vidé) : la
          // formule n'est volontairement plus payable en crypto.
          ...(!("priceUsd" in plan) && defaults.priceUsd !== undefined
            ? { priceUsd: defaults.priceUsd }
            : {}),
        };
      });
      merged[key] = {
        ...(basePricing as object),
        ...(storedPricing as object),
        plans: storedPlans.length > 0 ? mergedPlans : defaultPlans,
      };
    } else if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      baseValue !== null &&
      typeof baseValue === "object" &&
      !Array.isArray(baseValue)
    ) {
      merged[key] = { ...(baseValue as object), ...(value as object) };
    } else {
      merged[key] = value;
    }
  }
  return merged as unknown as typeof siteConfig;
}

function asList<T>(value: unknown, fallback: readonly unknown[]): T[] {
  if (Array.isArray(value) && value.length > 0) return value as T[];
  return fallback as T[];
}

/** Fusionne un objet enregistré par-dessus ses valeurs par défaut. */
function mergeObject<T extends object>(defaults: T, value: unknown): T {
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaults;
  return { ...defaults, ...(value as Partial<T>) };
}

/** Textes du Hero : fusion champ par champ + repli sur les pastilles par défaut. */
function resolveHero(value: unknown): HeroContent {
  const merged = mergeObject(defaultHero, value);
  return {
    ...merged,
    chipsAr:
      Array.isArray(merged.chipsAr) && merged.chipsAr.length > 0
        ? merged.chipsAr
        : defaultHero.chipsAr,
    chipsEn:
      Array.isArray(merged.chipsEn) && merged.chipsEn.length > 0
        ? merged.chipsEn
        : defaultHero.chipsEn,
  };
}

/** Bandeau de services : les éléments vides retombent sur le catalogue par défaut. */
function resolveRibbon(value: unknown): RibbonContent {
  const merged = mergeObject(defaultRibbon, value);
  return {
    ...merged,
    items:
      Array.isArray(merged.items) && merged.items.length > 0
        ? merged.items
        : defaultRibbon.items,
  };
}

/** Titres de sections : chaque section est fusionnée avec son défaut. */
function resolveHeadings(value: unknown): SectionHeadings {
  const result = { ...defaultSectionHeadings };
  if (!value || typeof value !== "object" || Array.isArray(value)) return result;
  for (const id of SECTION_HEADING_IDS) {
    const stored = (value as Record<string, unknown>)[id];
    if (stored && typeof stored === "object" && !Array.isArray(stored)) {
      result[id] = {
        ...defaultSectionHeadings[id],
        ...(stored as Partial<SectionHeading>),
      };
    }
  }
  return result;
}

const LEGACY_PLACEHOLDER_SLUGS = new Set([
  "al-diwan-restaurant",
  "noor-clinic",
  "dar-property",
  "zay-boutique",
  "itqan-academy",
  "safir-hotel",
]);

/**
 * Complète une démo enregistrée avant l'ajout de la classification :
 * la catégorie et le prix par défaut du projet sont repris du code,
 * sans jamais écraser un choix fait dans l'administration.
 */
function backfillClassification(base: Demo, stored: Demo): Demo {
  return {
    ...stored,
    planId: stored.planId ?? base.planId,
    categoryTier: stored.categoryTier ?? base.categoryTier,
    priceUsd: stored.priceUsd !== undefined ? stored.priceUsd : base.priceUsd,
  };
}

function resolveDemos(value: unknown, fallback: readonly unknown[]): Demo[] {
  const defaults = fallback as Demo[];
  if (!Array.isArray(value) || value.length === 0) return defaults;
  const stored = (value as Demo[]).filter(
    (d) => !(LEGACY_PLACEHOLDER_SLUGS.has(d.slug) && (!d.previewUrl || d.previewUrl === "#")),
  );
  if (stored.length === 0) return defaults;

  const withClassification = stored.map((item) => {
    const base = defaults.find(
      (def) =>
        def.slug === item.slug ||
        (Boolean(def.previewUrl) && def.previewUrl === item.previewUrl),
    );
    return base ? backfillClassification(base, item) : item;
  });

  const missingLiveDefaults = defaults.filter(
    (def) =>
      def.previewUrl &&
      def.previewUrl !== "#" &&
      /^https?:\/\//i.test(def.previewUrl) &&
      !stored.some((s) => s.slug === def.slug || s.previewUrl === def.previewUrl),
  );
  if (missingLiveDefaults.length > 0) {
    return [...missingLiveDefaults, ...withClassification];
  }
  return withClassification;
}

/** Lit configuration + contenu depuis la base (avec repli sur les défauts). */
export async function getSiteData(): Promise<SiteData> {
  try {
    await ensureSchema();
    const rows = await db.select().from(settings);
    const map = new Map<string, unknown>(
      rows.map((r) => [r.key, r.value] as [string, unknown]),
    );
    return {
      config: mergeConfig(map.get(KEY_CONFIG)),
      content: {
        demos: resolveDemos(map.get(KEY_DEMOS), defaultDemos),
        faqs: asList<Faq>(map.get(KEY_FAQS), defaultFaqs),
        testimonials: asList<Testimonial>(
          map.get(KEY_TESTIMONIALS),
          defaultTestimonials,
        ),
        hero: resolveHero(map.get(KEY_HERO)),
        ribbon: resolveRibbon(map.get(KEY_RIBBON)),
        whyUs: asList<WhyUsItem>(map.get(KEY_WHY_US), defaultWhyUs),
        process: asList<ProcessStep>(map.get(KEY_PROCESS), defaultProcess),
        headings: resolveHeadings(map.get(KEY_HEADINGS)),
      },
    };
  } catch (error) {
    console.error(
      "[store] lecture des réglages impossible :",
      error instanceof Error ? error.message : error,
    );
    return {
      config: siteConfig,
      content: {
        demos: defaultDemos as unknown as Demo[],
        faqs: defaultFaqs as unknown as Faq[],
        testimonials: defaultTestimonials as unknown as Testimonial[],
        hero: defaultHero,
        ribbon: defaultRibbon,
        whyUs: defaultWhyUs,
        process: defaultProcess,
        headings: defaultSectionHeadings,
      },
    };
  }
}

/**
 * Version dédupliquée par requête de getSiteData (React `cache`).
 * Une page qui appelle les données dans generateMetadata PUIS dans son
 * composant ne déclenche qu'une seule lecture base — important pour les
 * pages SEO (layout, sitemap, robots, pages internes).
 */
export const getSiteDataCached = cache(getSiteData);

/** Enregistre (ou remplace) une valeur de réglage en base. */
export async function upsertSetting(key: string, value: unknown): Promise<void> {
  await ensureSchema();
  await db
    .insert(settings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value, updatedAt: new Date() },
    });
}

/** Supprime un réglage (le site repasse aux valeurs par défaut). */
export async function deleteSetting(key: string): Promise<void> {
  await ensureSchema();
  await db.delete(settings).where(eq(settings.key, key));
}

export const SETTINGS_KEYS = {
  config: KEY_CONFIG,
  demos: KEY_DEMOS,
  faqs: KEY_FAQS,
  testimonials: KEY_TESTIMONIALS,
  hero: KEY_HERO,
  ribbon: KEY_RIBBON,
  whyUs: KEY_WHY_US,
  process: KEY_PROCESS,
  headings: KEY_HEADINGS,
} as const;
