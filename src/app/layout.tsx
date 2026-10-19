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
  localBusinessJsonLd,
  offerCatalogJsonLd,
  organizationJsonLd,
  websiteJsonLd,
} from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default:
      "تصميم مواقع في طرابلس — نخبة Nukhba | وكالة ويب بريميوم، متاجر وحجز",
    template: "%s | نخبة Nukhba",
  },
  description: DEFAULT_META_DESCRIPTION,
  keywords: [
    "تصميم مواقع طرابلس",
    "شركة تصميم مواقع ليبيا",
    "متجر إلكتروني ليبيا",
    "تصميم متجر إلكتروني طرابلس",
    "حجز مواعيد أونلاين",
    "تحسين SEO ليبيا",
    "وكالة ويب طرابلس",
    "web design Tripoli",
    "web design Libya",
    "e-commerce Libya",
    "Nukhba web agency",
    "création site web Tripoli",
  ],
  authors: [{ name: "نخبة Nukhba", url: siteConfig.url }],
  creator: "نخبة Nukhba",
  publisher: "نخبة Nukhba",
  category: "technology",
  applicationName: "نخبة Nukhba",
  alternates: {
    // Canonique racine : les pages internes surchargent avec leur propre URL.
    // Les langues sont gérées côté client (pas d'URL /ar /en réelles) : on ne
    // déclare donc pas de hreflang pointant vers des redirections — Google
    // pénaliserait des alternates sans page canonique distincte.
    canonical: "/",
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "نخبة — مواقع فاخرة لشركات طرابلس",
    description:
      "موقعك الاحترافي جاهز في أيام — تصميم نخبوي، سرعة تذهل، وتخصيص بلا حدود.",
    url: siteConfig.url,
    siteName: "نخبة Nukhba",
    locale: "ar_LY",
    alternateLocale: ["en_US"],
    type: "website",
    images: [
      {
        url: "/og.jpg",
        width: 1376,
        height: 768,
        alt: "نخبة — وكالة تصميم مواقع فاخرة في طرابلس",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "نخبة — مواقع فاخرة لشركات طرابلس",
    description:
      "موقعك الاحترافي جاهز في أيام — تصميم نخبوي، سرعة تذهل، وتخصيص بلا حدود.",
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
  // La vérification fichier (public/googleaf….html) reste active ; ce meta
  // n'est émis que si un code est fourni via variable d'environnement.
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
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
        {/* Polices : uniquement les graisses réellement utilisées.
            Playfair Display (jamais utilisé) a été retiré ; Tajawal ajouté
            car référencé par le sélecteur de polices du customisateur. */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;900&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=Tajawal:wght@400;500;700&display=swap"
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
        style={{ fontFamily: "var(--font-cairo), var(--font-inter), system-ui" }}
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
