import {
  WEBSITE_BASE_PRICE_USD,
  WEBSITE_CONTENT_FROM_USD,
  WEBSITE_LANGUAGE_PRICE_USD,
} from "@/lib/website-offer";
import type { Metadata } from "next";
import { pageLocale } from "@/lib/locale-server";
import type { LocalePageProps } from "@/lib/locale";
import { getSiteDataCached } from "@/lib/store";
import {
  breadcrumbJsonLd,
  faqJsonLd,
  pageMetadata,
} from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { PricingClient } from "./pricing-client";

export async function generateMetadata({ searchParams }: LocalePageProps): Promise<Metadata> {
  const { config } = await getSiteDataCached();
  const locale = await pageLocale(config, searchParams);
  return pageMetadata(config, {
    locale,
    path: "/pricing",
    title:
      locale === "ar"
        ? `أسعار تصميم المواقع في {country} — عرض موحد ${WEBSITE_BASE_PRICE_USD}$`
        : `Website & Store Pricing from $${WEBSITE_BASE_PRICE_USD} (USD/USDT)`,
    description:
      locale === "ar"
        ? `موقع مخصص بسعر موحد ${WEBSITE_BASE_PRICE_USD}$ يشمل الكود وتخصيص محتواك الأول مجاناً، مع إضافات واضحة (لغة +${WEBSITE_LANGUAGE_PRICE_USD}$، إدارة محتوى من ${WEBSITE_CONTENT_FROM_USD}$، متجر أو حجز بعرض سعر) ودفع USD أو USDT.`
        : `Custom website base at $${WEBSITE_BASE_PRICE_USD} with source code & free initial setup. Clear add-ons (+$${WEBSITE_LANGUAGE_PRICE_USD} language, CMS from $${WEBSITE_CONTENT_FROM_USD}, store or booking quoted) in USD/USDT.`,
    keywords: [
      "website pricing USD",
      "e-commerce website price",
      "pay for a website with USDT",
      "باقات تصميم مواقع بالدولار",
      "website pricing {countryEn}",
      "أسعار تصميم المواقع {country}",
      "أسعار تصميم المواقع في {city}",
      "تكلفة متجر إلكتروني {city}",
      "باقات تصميم مواقع",
      "website pricing Libya",
    ],
  });
}

export default async function PricingPage({ searchParams }: LocalePageProps) {
  const { config, content } = await getSiteDataCached();
  const locale = await pageLocale(config, searchParams);
  const ar = locale === "ar";
  return (
    <>
      {/* Le catalogue d'offres (#offer-catalog) est déjà injecté par le
          layout racine sur toutes les pages : ne pas le dupliquer ici. */}
      <JsonLd
        data={[
          breadcrumbJsonLd(config, [
            { name: ar ? "الرئيسية" : "Home", path: "/" },
            { name: ar ? "الأسعار" : "Pricing", path: "/pricing" },
          ], locale),
          faqJsonLd(content.faqs, config.market, locale),
        ]}
      />
      <PricingClient />
    </>
  );
}
