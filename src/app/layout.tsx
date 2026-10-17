import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Cairo, IBM_Plex_Sans_Arabic, Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/components/theme-provider";
import { SiteProvider } from "@/components/site-provider";
import { getSiteData } from "@/lib/store";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-cairo",
  display: "swap",
});

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-ar",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-playfair",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://nukhba.ly"),
  title: {
    default: "نخبة — مواقع فاخرة لشركات طرابلس | Nukhba — Premium Sites Tripoli",
    template: "%s | نخبة Nukhba",
  },
  description:
    "نصمم مواقع فاخرة وسريعة لشركات طرابلس — تسليم في 7 أيام، Next.js 90+ Lighthouse، تخصيص كامل، ودعم واتساب. اطلب عرضك المجاني.",
  alternates: {
    languages: {
      ar: "https://nukhba.ly/ar",
      en: "https://nukhba.ly/en",
    },
  },
  openGraph: {
    title: "نخبة — مواقع فاخرة لشركات طرابلس",
    description: "موقعك الاحترافي جاهز في أيام — تصميم نخبوي، سرعة تذهل، وتخصيص بلا حدود.",
    url: "https://nukhba.ly",
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
      <body
        className={`${cairo.variable} ${plexArabic.variable} ${playfair.variable} ${inter.variable} antialiased`}
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
