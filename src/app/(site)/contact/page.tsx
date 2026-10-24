import type { Metadata } from "next";
import { getSiteDataCached } from "@/lib/store";
import { absoluteUrl, breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { ContactClient } from "./contact-client";

export async function generateMetadata(): Promise<Metadata> {
  const { config } = await getSiteDataCached();
  return pageMetadata(config, {
    path: "/contact",
    title: "تواصل معنا — وكالة نخبة لتصميم المواقع في طرابلس",
    description:
      "تواصل مع نخبة في طرابلس: واتساب، هاتف أو بريد إلكتروني. استشارة مجانية لموقعك أو متجرك الإلكتروني — رد سريع، السبت إلى الخميس 9 صباحاً حتى 6 مساءً.",
    keywords: [
      "تواصل وكالة تصميم مواقع طرابلس",
      "شركة ويب ليبيا واتساب",
      "web agency Tripoli contact",
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
