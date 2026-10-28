import type { Metadata } from "next";
import { HomeSections } from "@/components/sections/home-sections";
import { getSiteDataCached } from "@/lib/store";
import {
  defaultMetaDescription,
  faqJsonLd,
  howToJsonLd,
  pageMetadata,
  siteLocale,
} from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";

export async function generateMetadata(): Promise<Metadata> {
  const { config } = await getSiteDataCached();
  // L'arabe est la langue principale : le titre suit `siteLocale(config)` et
  // reste modifiable depuis /admin → Réglages. La description (`defaultMetaDescription`)
  // est déjà rédigée en arabe pour la version principale.
  const locale = siteLocale(config);
  return pageMetadata(config, {
    path: "/",
    title:
      locale === "ar"
        ? "تصميم مواقع ومتاجر في {city} — تسليم 7 أيام ودفع بالعملات الرقمية"
        : "Website & Store Design in {cityEn} — 7 Days, Paid in USDT",
    description: defaultMetaDescription(config),
    keywords: [
      "web design agency",
      "website design USD",
      "e-commerce website",
      "pay for a website with USDT",
      "تصميم مواقع",
      "تصميم مواقع {city}",
      "شركة تصميم مواقع {country}",
      "متجر إلكتروني {country}",
      "تصميم متجر إلكتروني {city}",
      "تحسين SEO {country}",
      "وكالة ويب {city}",
      "web design {cityEn}",
      "web design {countryEn}",
      "e-commerce {countryEn}",
      "Nukhba web agency",
      "web design agency worldwide",
    ],
  });
}

export default async function HomePage() {
  const { config, content } = await getSiteDataCached();
  const isSectionEnabled = (id: string) =>
    content.layout.entries.some(
      (e) => e.kind === "builtin" && e.builtinId === id && e.enabled,
    );

  const schemas: Record<string, unknown>[] = [];
  if (isSectionEnabled("faq") && content.faqs.length > 0) {
    schemas.push(faqJsonLd(content.faqs));
  }
  if (isSectionEnabled("process") && content.process.length > 0) {
    schemas.push(howToJsonLd(config, content.process));
  }

  return (
    <>
      {schemas.length > 0 && <JsonLd data={schemas} />}
      <HomeSections />
    </>
  );
}
