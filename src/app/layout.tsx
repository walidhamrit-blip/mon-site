import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./gaming.css";
import "./universes.css";
import { I18nProvider } from "@/lib/i18n";
import { ThemeProvider, type ThemeMode } from "@/components/theme-provider";
import { SiteProvider } from "@/components/site-provider";
import { CurrencyProvider } from "@/components/currency-provider";
import { MotionProvider } from "@/components/motion-provider";
import { getSiteDataCached } from "@/lib/store";
import { siteConfig } from "@/lib/config";
import { resolveThemeId, DEFAULT_THEME_ID, themeBootScript, themeCss } from "@/lib/themes";
import { JsonLd } from "@/components/json-ld";
import {
  googleSiteVerification,
  defaultMetaDescription,
  ogLocale,
  organizationJsonLd,
  serpTitle,
  siteLocale,
  websiteJsonLd,
} from "@/lib/seo";
import { trustpilotVerificationMeta } from "@/lib/trust";
import { marketLabels, resolveMarket } from "@/lib/market";
import { languageAlternates, localizedAbsoluteUrl } from "@/lib/locale";
import { requestLocale } from "@/lib/locale-server";

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
  const globalReach = Boolean(config.market?.globalReach) || market.id === "global";
  const baseUrl = config.url || siteConfig.url;

  // L'URL (`?lang=en`) prime sur la langue de référence et sur toute
  // préférence navigateur. HTML, métadonnées et JSON-LD restent alignés.
  const { locale, isPublic } = await requestLocale(siteLocale(config));
  const defaultLocale = siteLocale(config);
  const labels = marketLabels(market, locale);
  const labelsEn = marketLabels(market, "en");
  const canonical = localizedAbsoluteUrl(baseUrl, "/", locale, defaultLocale);
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
    alternates: {
      // Canonique auto-référente + cluster AR/EN réciproque sur chaque URL.
      canonical,
      ...(isPublic ? { languages: languageAlternates(baseUrl, "/", defaultLocale) } : {}),
    },
    manifest: "/manifest.webmanifest",
    openGraph: {
      title,
      description,
      url: canonical,
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
    },
    robots: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
    // Vérification Google Search Console : balise meta émise sur toutes les
    // pages. Le code n'est valide que pour le domaine qu'il a été émis
    // pour : dès que le domaine change, il faut en demander un nouveau
    // (GOOGLE_SITE_VERIFICATION). La vérification fichier historique
    // (public/googleaf….html) reste active en complément.
    verification: {
      google: googleSiteVerification(config.domain),
      // Vérification de domaine Trustpilot (méta-tag) : indispensable quand
      // l'e-mail du compte Business n'est pas sur le domaine. Silencieux
      // quand TRUSTPILOT_VERIFICATION n'est pas renseignée.
      ...(Object.keys(trustpilotVerificationMeta()).length > 0
        ? { other: trustpilotVerificationMeta() }
        : {}),
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
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
  const primaryLocale = siteLocale(config);
  const { locale: defaultLocale, urlLocale, isPublic } = await requestLocale(primaryLocale);
  const defaultMode: ThemeMode = appearance.mode === "dark" ? "dark" : "light";
  const defaultPalette = resolveThemeId(appearance.themeId) ?? DEFAULT_THEME_ID;

  // Données structurées globales servies dans le HTML initial (sans JS requis) :
  // Organization (la marque mère) + WebSite. Le ProfessionalService et le
  // catalogue des offres web sont émis par le layout public, uniquement hors
  // boutique (voir UniverseShell) ; la boutique déclare son entité `Store`
  // sur /codes. Le schéma FAQPage n'est injecté que sur les pages qui
  // affichent réellement <FAQ /> (/ et /pricing).
  const structuredData = [organizationJsonLd(config), websiteJsonLd(config)];

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
          <I18nProvider defaultLocale={primaryLocale} urlLocale={urlLocale ?? (isPublic ? defaultLocale : null)}>
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

        <JsonLd data={structuredData} />
        {isPublic && (
          <script
            type="speculationrules"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                prefetch: [
                  {
                    where: {
                      and: [
                        { href_matches: "/*" },
                        {
                          not: {
                            href_matches: [
                              "/api/*",
                              "/admin*",
                              "/pay/*",
                              "/livraison*",
                              "/codes/commande*",
                              "/abonnements/suivi*",
                            ],
                          },
                        },
                      ],
                    },
                    eagerness: "conservative",
                  },
                ],
              }),
            }}
          />
        )}
      </body>
    </html>
  );
}
