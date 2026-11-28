"use client";

import "@/app/globals.css";
import "@/app/gaming.css";
import "@/app/universes.css";

import type { ReactNode } from "react";
import type { SiteData } from "@/lib/store";
import { siteConfig } from "@/lib/config";
import { ThemeProvider, type ThemeMode } from "./theme-provider";
import { I18nProvider } from "@/lib/i18n";
import { SiteProvider } from "./site-provider";
import { CurrencyProvider } from "./currency-provider";
import { MotionProvider } from "./motion-provider";
import type { Locale } from "@/lib/locale";

/** Same provider tree, behind a split point: /tg never renders/downloads it. */
export default function WebsiteProviders({
  config, content, defaultMode, defaultPalette, primaryLocale, urlLocale, children,
}: SiteData & {
  defaultMode: ThemeMode;
  defaultPalette: string;
  primaryLocale: Locale;
  urlLocale: Locale | null;
  children: ReactNode;
}) {
  return (
    <ThemeProvider defaultMode={defaultMode} defaultPalette={defaultPalette}>
      <I18nProvider defaultLocale={primaryLocale} urlLocale={urlLocale}>
        <SiteProvider config={config} content={content}>
          <CurrencyProvider
            rates={config.currency?.rates ?? siteConfig.currency.rates}
            enabled={[...(config.currency?.enabled ?? siteConfig.currency.enabled)]}
          >
            <MotionProvider>{children}</MotionProvider>
          </CurrencyProvider>
        </SiteProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
