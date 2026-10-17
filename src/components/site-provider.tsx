"use client";
import { createContext, useContext, type ReactNode } from "react";
import { siteConfig } from "@/lib/config";
import { demos as defaultDemos, faqs as defaultFaqs, testimonials as defaultTestimonials } from "@/lib/content";
import type { SiteContent } from "@/lib/site-types";

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
