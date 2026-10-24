import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { I18nProvider, type Locale } from "@/lib/i18n";
import { ThemeProvider, type ThemeMode } from "@/components/theme-provider";
import { SiteProvider } from "@/components/site-provider";
import { getSiteDataCached } from "@/lib/store";
import { siteConfig } from "@/lib/config";
import { isThemeId, themeBootScript, themeCss } from "@/lib/themes";
import { JsonLd } from "@/components/json-ld";
import {
  DEFAULT_META_DESCRIPTION,
  GOOGLE_SITE_VERIFICATION,
  localBusinessJsonLd,
  offerCatalogJsonLd,
  organizationJsonLd,
  websiteJsonLd,
} from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default:
      "Nukhba نخبة — Premium Web Agency | Websites, E-Commerce & Booking Worldwide",
    template: "%s | Nukhba نخبة",
  },
  description: DEFAULT_META_DESCRIPTION,
  keywords: [
    "web design agency",
    "premium website design",
    "e-commerce website development",
    "online booking website",
    "pay with USDT website",
    "Nukhba web agency",
    "تصميم مواقع",
    "متجر إلكتروني",
    "حجز مواعيد أونلاين",
    "web design Tripoli",
    "web design Libya",
    "création site web",
  ],
  authors: [{ name: "Nukhba نخبة", url: siteConfig.url }],
  creator: "Nukhba نخبة",
  publisher: "Nukhba نخبة",
  category: "technology",
  applicationName: "Nukhba نخبة",
  alternates: {
    // Canonique racine : les pages internes surchargent avec leur propre URL.
    // Les langues sont gérées côté client (pas d'URL /ar /en réelles) : on ne
    // déclare donc pas de hreflang pointant vers des redirections — Google
    // pénaliserait des alternates sans page canonique distincte.
    canonical: "/",
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Nukhba — Premium websites for businesses worldwide",
    description:
      "Your professional website ready in days — premium design, striking speed, unlimited customization. USD pricing, payable in USDT.",
    url: siteConfig.url,
    siteName: "Nukhba نخبة",
    locale: "en_US",
    alternateLocale: ["ar"],
    type: "website",
    images: [
      {
        url: "/og.jpg",
        width: 1376,
        height: 768,
        alt: "Nukhba — premium web design agency for clients worldwide",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Nukhba — Premium websites for businesses worldwide",
    description:
      "Your professional website ready in days — premium design, striking speed, unlimited customization. USD pricing, payable in USDT.",
    images: ["/og.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  // Vérification Google Search Console : balise meta émise sur toutes les
  // pages (code par défaut en dur — cf. src/lib/seo.ts — surchargeable via
  // GOOGLE_SITE_VERIFICATION). La vérification fichier historique
  // (public/googleaf….html) reste active en complément.
  verification: { google: GOOGLE_SITE_VERIFICATION },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FCFCF9" },
    { media: "(prefers-color-scheme: dark)", color: "#08080A" },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { config, content } = await getSiteDataCached();

  // Apparence principale du site (choisie dans /admin → Réglages) :
  // langue principale, thème principal et mode clair/sombre servent de
  // défaut à tous les visiteurs (un visiteur peut toujours basculer).
  const appearance = {
    themeId: String(config.appearance?.themeId ?? siteConfig.appearance.themeId),
    mode: String(config.appearance?.mode ?? siteConfig.appearance.mode),
    defaultLocale: String(
      config.appearance?.defaultLocale ?? siteConfig.appearance.defaultLocale,
    ),
  };
  const defaultLocale: Locale = appearance.defaultLocale === "en" ? "en" : "ar";
  const defaultMode: ThemeMode = appearance.mode === "dark" ? "dark" : "light";
  const defaultPalette = isThemeId(appearance.themeId)
    ? appearance.themeId
    : siteConfig.appearance.themeId;

  // Données structurées globales servies dans le HTML initial (sans JS requis) :
  // Organization + WebSite + ProfessionalService (SEO local + avis) +
  // catalogue d'offres tarifaires. Le schéma FAQPage n'est injecté que sur
  // les pages qui affichent réellement <FAQ /> (/ et /pricing).
  const structuredData = [
    organizationJsonLd(config),
    websiteJsonLd(config),
    localBusinessJsonLd(config, content.testimonials),
    offerCatalogJsonLd(config),
  ];

  return (
    <html
      lang={defaultLocale}
      dir={defaultLocale === "ar" ? "rtl" : "ltr"}
      suppressHydrationWarning
    >
      <head>
        {/* Police principale auto-hébergée : préchargée pour éviter tout
            scintillement, et plus aucune requête vers un tiers. */}
        <link
          rel="preload"
          href="/fonts/cairo-arabic-var.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        {/* Découverte automatique pour les moteurs et agents IA (llmstxt.org) */}
        <link
          rel="alternate"
          type="text/markdown"
          href="/llms.txt"
          title="Nukhba AI summary (llmstxt.org)"
        />
        <link
          rel="alternate"
          type="text/markdown"
          href="/llms-full.txt"
          title="Nukhba full AI knowledge base (AR/EN)"
        />
        {/* Palettes des 8 thèmes (clair + sombre) — générées depuis src/lib/themes.ts */}
        <style dangerouslySetInnerHTML={{ __html: themeCss() }} />
        {/* Applique thème + mode avant le premier rendu (aucun clignotement).
            À défaut de choix mémorisé du visiteur, l'apparence principale
            choisie dans /admin → Réglages est appliquée. */}
        <script
          dangerouslySetInnerHTML={{
            __html: themeBootScript({ mode: defaultMode, palette: defaultPalette }),
          }}
        />
      </head>
      <body
        className="antialiased"
        style={{ fontFamily: "var(--font-cairo), var(--font-plex-ar), system-ui" }}
      >
        <ThemeProvider defaultMode={defaultMode} defaultPalette={defaultPalette}>
          <I18nProvider defaultLocale={defaultLocale}>
            <SiteProvider config={config} content={content}>
              {children}
            </SiteProvider>
          </I18nProvider>
        </ThemeProvider>

        <JsonLd data={structuredData} />
      </body>
    </html>
  );
}
