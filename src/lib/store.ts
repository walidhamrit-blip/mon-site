import { eq } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { settings } from "@/db/schema";
import { siteConfig } from "@/lib/config";
import {
  demos as defaultDemos,
  faqs as defaultFaqs,
  testimonials as defaultTestimonials,
} from "@/lib/content";
import type { Demo, Faq, SiteConfigData, SiteContent, Testimonial } from "@/lib/site-types";

// Accès aux données « vivantes » du site (configuration + contenu éditables
// depuis le panneau d'administration). Toutes les lectures sont protégées :
// en cas d'indisponibilité de la base, on retombe proprement sur les
// valeurs par défaut codées dans src/lib/config.ts et src/lib/content.ts.

const KEY_CONFIG = "site_config";
const KEY_DEMOS = "content_demos";
const KEY_FAQS = "content_faqs";
const KEY_TESTIMONIALS = "content_testimonials";

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

const LEGACY_PLACEHOLDER_SLUGS = new Set([
  "al-diwan-restaurant",
  "noor-clinic",
  "dar-property",
  "zay-boutique",
  "itqan-academy",
  "safir-hotel",
]);

function resolveDemos(value: unknown, fallback: readonly unknown[]): Demo[] {
  const defaults = fallback as Demo[];
  if (!Array.isArray(value) || value.length === 0) return defaults;
  const stored = (value as Demo[]).filter(
    (d) => !(LEGACY_PLACEHOLDER_SLUGS.has(d.slug) && (!d.previewUrl || d.previewUrl === "#")),
  );
  if (stored.length === 0) return defaults;
  const missingLiveDefaults = defaults.filter(
    (def) =>
      def.previewUrl &&
      def.previewUrl !== "#" &&
      /^https?:\/\//i.test(def.previewUrl) &&
      !stored.some((s) => s.slug === def.slug || s.previewUrl === def.previewUrl),
  );
  if (missingLiveDefaults.length > 0) {
    return [...missingLiveDefaults, ...stored];
  }
  return stored;
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
      },
    };
  }
}

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
} as const;
