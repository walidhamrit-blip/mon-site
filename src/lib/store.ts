import { cache } from "react";
import { eq } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { settings } from "@/db/schema";
import { siteConfig } from "@/lib/config";
import { ensureDemoSeoFields } from "@/lib/ai/seo-generator";
import {
  demos as defaultDemos,
  faqs as defaultFaqs,
  testimonials as defaultTestimonials,
  heroContent as defaultHero,
  servicesRibbonContent as defaultRibbon,
  defaultWhyUs,
  defaultProcess,
  defaultSectionHeadings,
  defaultHomeLayout,
  defaultAppsPage,
  defaultProductsPage,
} from "@/lib/content";
import {
  BUILTIN_SECTION_IDS,
  SECTION_HEADING_IDS,
  collectAllDemos,
  type CustomSiteSection,
  type Demo,
  type Faq,
  type HeroContent,
  type HomeLayoutConfig,
  type HomeSectionEntry,
  type ProcessStep,
  type RibbonContent,
  type SectionHeading,
  type SectionHeadings,
  type ShowcasePageConfig,
  type SiteContent,
  type Testimonial,
  type UpcomingCatalogItem,
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
const KEY_LAYOUT = "content_layout";
const KEY_APPS_PAGE = "content_apps_page";
const KEY_PRODUCTS_PAGE = "content_products_page";

export interface SiteData {
  config: typeof siteConfig;
  content: SiteContent;
}

/**
 * Retourne l'ensemble dédoublonné des sites connus du portfolio principal
 * et des sections personnalisées actives, afin que `/demos/[slug]` et
 * `/sitemap.xml` résolvent aussi tout site créé dans une section dédiée.
 */
export const getAllKnownDemos = collectAllDemos;

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
        const fallback =
          defaultPlans.find(
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

/**
 * Si la clé existe explicitement en base (`hasKey`), on respecte la liste
 * enregistrée (y compris vide `[]` lorsque l'administrateur a supprimé tous
 * les éléments d'une section). Sinon on retombe sur les valeurs par défaut.
 */
function resolveStoredList<T>(
  map: Map<string, unknown>,
  key: string,
  fallback: readonly unknown[],
): T[] {
  if (map.has(key) && Array.isArray(map.get(key))) {
    return map.get(key) as T[];
  }
  return fallback as T[];
}

function mergeObject<T extends object>(defaults: T, value: unknown): T {
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaults;
  return { ...defaults, ...(value as Partial<T>) };
}

function resolveHero(value: unknown): HeroContent {
  const merged = mergeObject(defaultHero, value);
  return {
    ...merged,
    chipsAr: Array.isArray(merged.chipsAr) ? merged.chipsAr : defaultHero.chipsAr,
    chipsEn: Array.isArray(merged.chipsEn) ? merged.chipsEn : defaultHero.chipsEn,
  };
}

function resolveRibbon(map: Map<string, unknown>): RibbonContent {
  if (!map.has(KEY_RIBBON)) return defaultRibbon;
  const merged = mergeObject(defaultRibbon, map.get(KEY_RIBBON));
  return {
    ...merged,
    items: Array.isArray(merged.items) ? merged.items : defaultRibbon.items,
  };
}

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

function backfillClassification(base: Demo, stored: Demo): Demo {
  return {
    ...stored,
    planId: stored.planId ?? base.planId,
    categoryTier: stored.categoryTier ?? base.categoryTier,
    priceUsd: stored.priceUsd !== undefined ? stored.priceUsd : base.priceUsd,
  };
}

/**
 * Résout la galerie des sites :
 * - Si `content_demos` n'a jamais été enregistré en base, retourne les démos par défaut.
 * - Si `content_demos` a été enregistré par l'administrateur, respecte exactement
 *   les ajouts ET les suppressions (sans réinjecter les sites supprimés).
 */
function resolveDemos(map: Map<string, unknown>, fallback: readonly unknown[]): Demo[] {
  const defaults = (fallback as Demo[]).map((d) => ensureDemoSeoFields(d));
  if (!map.has(KEY_DEMOS)) return defaults;

  const value = map.get(KEY_DEMOS);
  if (!Array.isArray(value)) return defaults;

  const stored = (value as Demo[]).filter(
    (d) => !(LEGACY_PLACEHOLDER_SLUGS.has(d.slug) && (!d.previewUrl || d.previewUrl === "#")),
  );

  return stored.map((item) => {
    const base = defaults.find(
      (def) =>
        def.slug === item.slug ||
        (Boolean(def.previewUrl) && def.previewUrl === item.previewUrl),
    );
    const merged = base ? backfillClassification(base, item) : item;
    return ensureDemoSeoFields(merged);
  });
}

function resolveLayout(value: unknown): HomeLayoutConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      entries: defaultHomeLayout.entries.map((e) => ({ ...e })),
      customSections: [],
    };
  }
  const raw = value as Partial<HomeLayoutConfig>;
  const customSections: CustomSiteSection[] = Array.isArray(raw.customSections)
    ? raw.customSections.map((sec) => ({
        ...sec,
        variant: sec.variant === "cards" ? "cards" : "interactive",
        sites: Array.isArray(sec.sites)
          ? sec.sites.map((site) => ensureDemoSeoFields(site))
          : [],
      }))
    : [];

  const customIds = new Set(customSections.map((s) => s.id));
  const storedEntries: HomeSectionEntry[] = Array.isArray(raw.entries)
    ? raw.entries.filter((entry) => {
        if (entry.kind === "builtin") {
          return (
            Boolean(entry.builtinId) &&
            (BUILTIN_SECTION_IDS as readonly string[]).includes(entry.builtinId!)
          );
        }
        return Boolean(entry.customId) && customIds.has(entry.customId!);
      })
    : [];

  // S'assure que toute section native et toute section personnalisée figurent
  // dans `entries` (même désactivées) pour pouvoir être réactivées depuis l'admin.
  const seenBuiltin = new Set(
    storedEntries
      .filter((e) => e.kind === "builtin" && e.builtinId)
      .map((e) => e.builtinId!),
  );
  for (const builtinId of BUILTIN_SECTION_IDS) {
    if (!seenBuiltin.has(builtinId)) {
      storedEntries.push({
        key: builtinId,
        kind: "builtin",
        builtinId,
        enabled: true,
      });
    }
  }

  const seenCustom = new Set(
    storedEntries
      .filter((e) => e.kind === "custom" && e.customId)
      .map((e) => e.customId!),
  );
  for (const sec of customSections) {
    if (!seenCustom.has(sec.id)) {
      storedEntries.push({
        key: `custom:${sec.id}`,
        kind: "custom",
        customId: sec.id,
        enabled: true,
      });
    }
  }

  return {
    entries: storedEntries,
    customSections,
  };
}

function resolveShowcasePage(
  map: Map<string, unknown>,
  key: string,
  defaults: ShowcasePageConfig,
): ShowcasePageConfig {
  if (!map.has(key)) {
    return {
      ...defaults,
      items: defaults.items.map((item) => ({ ...item })),
    };
  }
  const merged = mergeObject(defaults, map.get(key));
  const rawItems: UpcomingCatalogItem[] = Array.isArray(merged.items)
    ? merged.items
    : defaults.items;
  return {
    ...merged,
    items: rawItems,
  };
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
        demos: resolveDemos(map, defaultDemos),
        faqs: resolveStoredList<Faq>(map, KEY_FAQS, defaultFaqs),
        testimonials: resolveStoredList<Testimonial>(
          map,
          KEY_TESTIMONIALS,
          defaultTestimonials,
        ),
        hero: resolveHero(map.get(KEY_HERO)),
        ribbon: resolveRibbon(map),
        whyUs: resolveStoredList<WhyUsItem>(map, KEY_WHY_US, defaultWhyUs),
        process: resolveStoredList<ProcessStep>(map, KEY_PROCESS, defaultProcess),
        headings: resolveHeadings(map.get(KEY_HEADINGS)),
        layout: resolveLayout(map.get(KEY_LAYOUT)),
        appsPage: resolveShowcasePage(map, KEY_APPS_PAGE, defaultAppsPage),
        productsPage: resolveShowcasePage(map, KEY_PRODUCTS_PAGE, defaultProductsPage),
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
        demos: (defaultDemos as unknown as Demo[]).map((d) => ensureDemoSeoFields(d)),
        faqs: defaultFaqs as unknown as Faq[],
        testimonials: defaultTestimonials as unknown as Testimonial[],
        hero: defaultHero,
        ribbon: defaultRibbon,
        whyUs: defaultWhyUs,
        process: defaultProcess,
        headings: defaultSectionHeadings,
        layout: {
          entries: defaultHomeLayout.entries.map((e) => ({ ...e })),
          customSections: [],
        },
        appsPage: {
          ...defaultAppsPage,
          items: defaultAppsPage.items.map((item) => ({ ...item })),
        },
        productsPage: {
          ...defaultProductsPage,
          items: defaultProductsPage.items.map((item) => ({ ...item })),
        },
      },
    };
  }
}

export const getSiteDataCached = cache(getSiteData);

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
  layout: KEY_LAYOUT,
  appsPage: KEY_APPS_PAGE,
  productsPage: KEY_PRODUCTS_PAGE,
} as const;
