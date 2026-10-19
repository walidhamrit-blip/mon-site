"use client";
import { createContext, useContext, type ReactNode } from "react";
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
import { useI18n } from "@/lib/i18n";
import type { SectionHeadingId, SiteContent } from "@/lib/site-types";

// Fournit la configuration et le contenu « vivants » (issus de la base,
// éditables depuis /admin) à tous les composants du site. Les valeurs par
// défaut servent de repli si aucun réglage n'est encore enregistré.

interface SiteContextValue {
  config: typeof siteConfig;
  content: SiteContent;
}

const defaultContent: SiteContent = {
  demos: defaultDemos as unknown as SiteContent["demos"],
  faqs: defaultFaqs as unknown as SiteContent["faqs"],
  testimonials: defaultTestimonials as unknown as SiteContent["testimonials"],
  hero: defaultHero,
  ribbon: defaultRibbon,
  whyUs: defaultWhyUs,
  process: defaultProcess,
  headings: defaultSectionHeadings,
};

const SiteContext = createContext<SiteContextValue>({
  config: siteConfig,
  content: defaultContent,
});

export function SiteProvider({
  config,
  content,
  children,
}: {
  config: typeof siteConfig;
  content: SiteContent;
  children: ReactNode;
}) {
  return (
    <SiteContext.Provider value={{ config, content }}>
      {children}
    </SiteContext.Provider>
  );
}

export function useSiteConfig(): typeof siteConfig {
  return useContext(SiteContext).config;
}

export function useSiteContent(): SiteContent {
  return useContext(SiteContext).content;
}

/**
 * Titre / sous-titre localisé d'une section du site, éditables dans
 * /admin → Contenu → « Titres des sections ». Repli automatique sur les
 * valeurs par défaut si aucun réglage n'a encore été enregistré.
 */
export function useSectionHeading(id: SectionHeadingId) {
  const { headings } = useSiteContent();
  const { locale } = useI18n();
  const heading = headings[id];
  const ar = locale === "ar";
  return {
    title: ar ? heading.titleAr : heading.titleEn,
    subtitle: ar ? heading.subtitleAr : heading.subtitleEn,
    note: ar ? heading.noteAr : heading.noteEn,
  };
}
