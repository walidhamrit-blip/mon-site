import type { Metadata } from "next";
import { getAllKnownDemos, getSiteDataCached } from "@/lib/store";
import { absoluteUrl, breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { DemosClient } from "./demos-client";

export async function generateMetadata(): Promise<Metadata> {
  const { config } = await getSiteDataCached();
  return pageMetadata(config, {
    path: "/demos",
    title: "معارض الأعمال الحية — مواقع حقيقية صمّمتها نخبة في {city}",
    description:
      "تصفّح مواقع حقيقية أنجزتها وكالة نخبة: متاجر إلكترونية، مطاعم، عيادات، شركات عقارية وتقنية في طرابلس وليبيا — جرّب كل موقع مباشرة وخصّصه على هويتك.",
    keywords: [
      "أمثلة تصميم مواقع {country}",
      "معارض أعمال وكالة ويب {city}",
      "نماذج متاجر إلكترونية {country}",
      "web design portfolio {cityEn}",
    ],
  });
}

export default async function DemosPage() {
  const { config, content } = await getSiteDataCached();
  const allDemos = getAllKnownDemos(content);

  // CollectionPage + ItemList : chaque réalisation est listée avec son
  // URL canonique — facilite la découverte par Google et les assistants IA.
  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${absoluteUrl(config, "/demos")}#collection`,
    name: "معارض الأعمال الحية — نخبة",
    url: absoluteUrl(config, "/demos"),
    inLanguage: ["ar-LY", "en"],
    isPartOf: { "@id": absoluteUrl(config, "#website") },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: allDemos.length,
      itemListElement: allDemos.map((d, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: absoluteUrl(config, `/demos/${d.slug}`),
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
          ]),
          collectionSchema,
        ]}
      />
      <DemosClient />
    </>
  );
}
