import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/components/theme-provider";
import { SiteProvider } from "@/components/site-provider";
import { getSiteData } from "@/lib/store";
import { siteConfig } from "@/lib/config";
import { THEME_BOOT_SCRIPT, themeCss } from "@/lib/themes";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: "نخبة — مواقع فاخرة لشركات طرابلس | Nukhba — Premium Sites Tripoli",
    template: "%s | نخبة Nukhba",
  },
  description:
    "نصمم مواقع فاخرة وسريعة لشركات طرابلس — تسليم في 7 أيام، Next.js 90+ Lighthouse، تخصيص كامل، ودعم واتساب. اطلب عرضك المجاني.",
  alternates: {
    languages: {
      ar: `${siteConfig.url}/ar`,
      en: `${siteConfig.url}/en`,
    },
  },
  openGraph: {
    title: "نخبة — مواقع فاخرة لشركات طرابلس",
    description: "موقعك الاحترافي جاهز في أيام — تصميم نخبوي، سرعة تذهل، وتخصيص بلا حدود.",
    url: siteConfig.url,
    siteName: "نخبة Nukhba",
    locale: "ar_LY",
    type: "website",
    images: [{ url: "/og.jpg", width: 1200, height: 630 }],
  },
  robots: { index: true, follow: true },
  verification: { google: "placeholder" },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { config, content } = await getSiteData();

  const localBusiness = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "نخبة - Nukhba Premium Web Agency",
    url: config.url,
    telephone: config.phone,
    address: {
      "@type": "PostalAddress",
      streetAddress: config.address,
      addressLocality: "Tripoli",
      addressCountry: "LY",
    },
    description: "وكالة تصميم مواقع فاخرة في طرابلس - تسليم 7 أيام",
    priceRange: "$$",
    areaServed: "Tripoli",
  };

  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@400;600;700&display=swap"
        />
        {/* Palettes des 8 thèmes (clair + sombre) — générées depuis src/lib/themes.ts */}
        <style dangerouslySetInnerHTML={{ __html: themeCss() }} />
        {/* Applique thème + mode avant le premier rendu (aucun clignotement) */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body
        className="antialiased"
        style={{ fontFamily: "var(--font-cairo), var(--font-inter), system-ui" }}
      >
        <ThemeProvider>
          <I18nProvider>
            <SiteProvider config={config} content={content}>
              {children}
            </SiteProvider>
          </I18nProvider>
        </ThemeProvider>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusiness) }}
        />
      </body>
    </html>
  );
}
