import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./gaming.css";
import { I18nProvider, type Locale } from "@/lib/i18n";
import { ThemeProvider, type ThemeMode } from "@/components/theme-provider";
import { SiteProvider } from "@/components/site-provider";
import { CurrencyProvider } from "@/components/currency-provider";
import { getSiteDataCached } from "@/lib/store";
import { siteConfig } from "@/lib/config";
import { resolveThemeId, DEFAULT_THEME_ID, themeBootScript, themeCss } from "@/lib/themes";
import { JsonLd } from "@/components/json-ld";
import {
  googleSiteVerification,
  defaultMetaDescription,
  localBusinessJsonLd,
  ogLocale,
  offerCatalogJsonLd,
  organizationJsonLd,
  serpTitle,
  siteLocale,
  websiteJsonLd,
} from "@/lib/seo";
import { marketLabels, resolveMarket } from "@/lib/market";

/**
 * Métadonnéesracine — générées depuis la configuration VIVANTE
 * (/admin → Réglages), et plus depuis les valeurs codées en dur.
 *
 * Conséquence directe de la portée mondiale : le marché (ville, pays,
 * langue, devise) et le positionnement international se reflètent dans le
 * titre, la description et les mots-clés de la page d'accueil. Changer de
 * marché dans l'admin met donc à jour le SEO racine, sans redéploiement.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { config } = await getSiteDataCached();
  const market = resolveMarket(config.market);
  const labels = marketLabels(market, "ar");
  const labelsEn = marketLabels(market, "en");
  const globalReach = Boolean(config.market?.globalReach) || market.id === "global";
  const baseUrl = config.url || siteConfig.url;

  // Langue de référence : celle du marché (arabe pour la Libye) sauf choix
  // explicite dans /admin. Le HTML initial, les métadonnées et les données
  // structurées doivent parler la même langue — sinon Google reçoit un
  // signal contradictoire (cas historique : <html lang="en"> avec une
  // description arabe).
  const locale = siteLocale(config);
  const title = serpTitle(
    globalReach
      ? locale === "ar"
        ? `تصميم مواقع ومتاجر إلكترونية في ${labels.city} وللعالم`
        : `Web Design, E-Commerce & Digital Store in ${labelsEn.city}`
      : locale === "ar"
        ? `تصميم مواقع ومتاجر إلكترونية في ${labels.city}`
        : `Web Design & E-Commerce in ${labelsEn.city}`,
    locale,
  );
  const description = defaultMetaDescription(config, locale);

  return {
    metadataBase: new URL(baseUrl),
    // Pas de `template` : chaque page fournit un titre déjà complet et borné
    // (`serpTitle`). Un template global ajoutait la marque une seconde fois
    // et poussait la plupart des titres au-delà de 60 caractères.
    title,
    description,
    keywords: [
      `تصميم مواقع ${labels.city}`,
      `شركة تصميم مواقع ${labels.country}`,
      `متجر إلكتروني ${labels.country}`,
      `تصميم متجر إلكتروني ${labels.city}`,
      "حجز مواعيد أونلاين",
      `تحسين SEO ${labels.country}`,
      `وكالة ويب ${labels.city}`,
      `web design ${labelsEn.city}`,
      `web design ${labelsEn.country}`,
      `e-commerce ${labelsEn.country}`,
      "Nukhba web agency",
      `création site web ${labelsEn.city}`,
      "premium website design",
      "online booking website",
      "pay with USDT website",
      ...(globalReach
        ? ["web design agency worldwide", "international web design", "تصميم مواقع عالمي"]
        : []),
    ],
    authors: [{ name: "نخبة Nukhba", url: baseUrl }],
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
      title,
      description,
      url: baseUrl,
      siteName: "نخبة Nukhba",
      locale: locale === "ar" ? ogLocale(market.locale) : "en_US",
      alternateLocale: locale === "ar" ? ["en_US"] : [ogLocale(market.locale)],
      type: "website",
      images: [
        {
          url: "/og.jpg",
          width: 1376,
          height: 768,
          alt:
            locale === "ar"
              ? `نخبة — وكالة تصميم مواقع ومتجر أكواد رقمية في ${labels.city}`
              : `Nukhba — web design agency and digital store in ${labelsEn.city}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
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
    // pages. Le code n'est valide que pour le domaine qu'il a été émis
    // pour : dès que le domaine change, il faut en demander un nouveau
    // (GOOGLE_SITE_VERIFICATION). La vérification fichier historique
    // (public/googleaf….html) reste active en complément.
    verification: { google: googleSiteVerification(config.domain) },
  };
}

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
  };
  // Même résolution que les métadonnées : HTML, `<html lang>` et contenu
  // initial ne peuvent pas diverger.
  const defaultLocale: Locale = siteLocale(config);
  const defaultMode: ThemeMode = appearance.mode === "dark" ? "dark" : "light";
  const defaultPalette = resolveThemeId(appearance.themeId) ?? DEFAULT_THEME_ID;

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
              <CurrencyProvider
                rates={config.currency?.rates ?? siteConfig.currency.rates}
                enabled={[...(config.currency?.enabled ?? siteConfig.currency.enabled)]}
              >
                {children}
              </CurrencyProvider>
            </SiteProvider>
          </I18nProvider>
        </ThemeProvider>

        <JsonLd data={structuredData} />
      </body>
    </html>
  );
}
