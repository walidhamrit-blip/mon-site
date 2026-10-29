import type { Metadata } from "next";
import { getSiteDataCached } from "@/lib/store";
import { absoluteUrl, breadcrumbJsonLd, pageMetadata, siteLocale } from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { ContactClient } from "./contact-client";

export async function generateMetadata(): Promise<Metadata> {
  const { config } = await getSiteDataCached();
  const locale = siteLocale(config);
  return pageMetadata(config, {
    path: "/contact",
    title:
      locale === "ar"
        ? "تواصل مع نخبة — وكالة ويب في {city}"
        : "Contact Nukhba — Web Agency in {cityEn}",
    description:
      locale === "ar"
        ? "تواصل مع نخبة في {city}: واتساب، هاتف أو بريد إلكتروني. استشارة مجانية لموقعك أو متجرك الإلكتروني — رد سريع خلال ساعتين في أوقات العمل."
        : "Contact Nukhba in {cityEn}: WhatsApp, phone or email. Free consultation for your website, e-commerce store or digital code order — fast reply, no commitment.",
    keywords: [
      "تواصل وكالة تصميم مواقع {city}",
      "شركة ويب {country} واتساب",
      "web agency {cityEn} contact",
    ],
  });
}

export default async function ContactPage() {
  const { config } = await getSiteDataCached();
  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(config, [
            { name: "الرئيسية", path: "/" },
            { name: "تواصل معنا", path: "/contact" },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "ContactPage",
            "@id": `${absoluteUrl(config, "/contact")}#contactpage`,
            name: "تواصل مع نخبة — Contact Nukhba",
            url: absoluteUrl(config, "/contact"),
            description:
              "واتساب، هاتف وبريد إلكتروني — استشارة مجانية لمشروع موقعك في طرابلس.",
            inLanguage: ["en", "ar"],
            isPartOf: { "@id": absoluteUrl(config, "#website") },
          },
        ]}
      />
      <ContactClient />
    </>
  );
}
