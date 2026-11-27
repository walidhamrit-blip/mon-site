import type { Metadata } from "next";
import { pageLocale } from "@/lib/locale-server";
import type { LocalePageProps } from "@/lib/locale";
import { localizedAbsoluteUrl } from "@/lib/locale";
import { getSiteDataCached } from "@/lib/store";
import { absoluteUrl, breadcrumbJsonLd, pageMetadata, siteLocale } from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { ContactClient } from "./contact-client";
import { WEBSITE_BASE_PRICE_USD } from "@/lib/website-offer";

export async function generateMetadata({ searchParams }: LocalePageProps): Promise<Metadata> {
  const { config } = await getSiteDataCached();
  const locale = await pageLocale(config, searchParams);
  return pageMetadata(config, {
    locale,
    path: "/contact",
    title:
      locale === "ar"
        ? "تواصل مع نخبة في {city} — واتساب وعرض سعر مجاني"
        : "Contact Nukhba ({cityEn}) — Free Quote & WhatsApp",
    description:
      locale === "ar"
        ? `تواصل مباشرة عبر واتساب أو الهاتف أو البريد في {city}: عرض سعر مجاني لتصميم موقعك أو متجرك بـ${WEBSITE_BASE_PRICE_USD}$ ودعم فوري لطلبات البطاقات والأكواد الرقمية.`
        : `Message Nukhba in {cityEn} on WhatsApp, phone or email: get a free quote for your $${WEBSITE_BASE_PRICE_USD} website or online store and fast support for digital code orders.`,
    keywords: [
      "تواصل وكالة تصميم مواقع {city}",
      "شركة ويب {country} واتساب",
      "طلب عرض سعر موقع إلكتروني {country}",
      "web agency {cityEn} contact",
      "web design quote {cityEn} WhatsApp",
    ],
  });
}

export default async function ContactPage({ searchParams }: LocalePageProps) {
  const { config } = await getSiteDataCached();
  const locale = await pageLocale(config, searchParams);
  const ar = locale === "ar";
  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(config, [
            { name: ar ? "الرئيسية" : "Home", path: "/" },
            { name: ar ? "تواصل معنا" : "Contact Us", path: "/contact" },
          ], locale),
          {
            "@context": "https://schema.org",
            "@type": "ContactPage",
            "@id": `${localizedAbsoluteUrl(config.url, "/contact", locale, siteLocale(config))}#contactpage`,
            name: ar ? "تواصل مع نخبة" : "Contact Nukhba",
            url: localizedAbsoluteUrl(config.url, "/contact", locale, siteLocale(config)),
            description: ar
              ? "واتساب، هاتف وبريد إلكتروني — استشارة مجانية لمشروع موقعك في طرابلس."
              : "WhatsApp, phone and email — free consultation for your website, online store or digital order.",
            inLanguage: locale,
            isPartOf: { "@id": absoluteUrl(config, "#website") },
          },
        ]}
      />
      <ContactClient />
    </>
  );
}
