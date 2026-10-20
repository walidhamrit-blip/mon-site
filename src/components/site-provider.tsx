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
  defaultHomeLayout,
  defaultAppsPage,
  defaultProductsPage,
} from "@/lib/content";
import { useI18n } from "@/lib/i18n";
import type { SectionHeadingId, SiteContent } from "@/lib/site-types";

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
  layout: defaultHomeLayout,
  appsPage: defaultAppsPage,
  productsPage: defaultProductsPage,
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
