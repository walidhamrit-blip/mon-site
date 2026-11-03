import type { Metadata } from "next";
import { pageLocale } from "@/lib/locale-server";
import type { LocalePageProps } from "@/lib/locale";
import { localizedAbsoluteUrl } from "@/lib/locale";
import { getAllKnownDemos, getSiteDataCached } from "@/lib/store";
import {
  absoluteUrl,
  breadcrumbJsonLd,
  pageMetadata,
  siteLocale,
} from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { DemosClient } from "./demos-client";

export async function generateMetadata({ searchParams }: LocalePageProps): Promise<Metadata> {
  const { config } = await getSiteDataCached();
  const locale = await pageLocale(config, searchParams);
  return pageMetadata(config, {
    locale,
    path: "/demos",
    title:
      locale === "ar"
        ? "أعمال حية — مواقع صمّمتها نخبة في {city}"
        : "Live Portfolio — Websites Built by Nukhba",
    description:
      locale === "ar"
        ? "تصفّح مواقع حقيقية أنجزتها وكالة نخبة: متاجر إلكترونية، مطاعم، عيادات، شركات عقارية وتقنية في {city} و{country} — جرّب كل موقع مباشرة وخصّصه على هويتك."
        : "Browse live client websites built by Nukhba: e-commerce stores, restaurants, clinics and tech companies — test each site on desktop and mobile and customise it to your brand.",
    keywords: [
      "أمثلة تصميم مواقع {country}",
      "معارض أعمال وكالة ويب {city}",
      "نماذج متاجر إلكترونية {country}",
      "web design portfolio {cityEn}",
    ],
  });
}

export default async function DemosPage({ searchParams }: LocalePageProps) {
  const { config, content } = await getSiteDataCached();
  const locale = await pageLocale(config, searchParams);
  const allDemos = getAllKnownDemos(content);

  // CollectionPage + ItemList : chaque réalisation est listée avec son
  // URL canonique — facilite la découverte par Google et les assistants IA.
  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${localizedAbsoluteUrl(config.url, "/demos", locale, siteLocale(config))}#collection`,
    name: "معارض الأعمال الحية — نخبة",
    url: localizedAbsoluteUrl(config.url, "/demos", locale, siteLocale(config)),
    inLanguage: locale,
    isPartOf: { "@id": absoluteUrl(config, "#website") },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: allDemos.length,
      itemListElement: allDemos.map((d, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: localizedAbsoluteUrl(config.url, `/demos/${d.slug}`, locale, siteLocale(config)),
        name: d.title,
        image: d.image,
      })),
    },
  };

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(config, [
            { name: "الرئيسية", path: "/" },
            { name: "المعارض", path: "/demos" },
          ], locale),
          collectionSchema,
        ]}
      />
      <DemosClient />
    </>
  );
}
