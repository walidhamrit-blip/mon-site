import type { Metadata } from "next";
import { getSiteDataCached } from "@/lib/store";
import { absoluteUrl, breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { UpcomingShowcaseView } from "@/components/upcoming-showcase-view";

export async function generateMetadata(): Promise<Metadata> {
  const { config } = await getSiteDataCached();
  return pageMetadata(config, {
    path: "/apps",
    title: "تطبيقاتنا الذكية للجوال والويب — قيد التحضير وقريباً",
    description:
      "تطبيقات الجوال والويب من نخبة في طرابلس قريباً وقيد التحضير — حلول ذكية للمتاجر والعيادات والمطاعم على iOS وAndroid والويب مع تسجيل للإطلاق المبكر.",
    keywords: [
      "تطبيقات جوال ليبيا",
      "برمجة تطبيقات طرابلس",
      "تطبيقات متاجر وعيادات",
      "Nukhba mobile apps Libya",
    ],
  });
}

export default async function AppsPage() {
  const { config, content } = await getSiteDataCached();
  const page = content.appsPage;

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${absoluteUrl(config, "/apps")}#collection`,
    name: `${page.titleAr} — ${page.statusBadgeAr}`,
    url: absoluteUrl(config, "/apps"),
    inLanguage: ["ar-LY", "en"],
    isPartOf: { "@id": absoluteUrl(config, "#website") },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: page.items.length,
      itemListElement: page.items.map((item, idx) => ({
        "@type": "ListItem",
        position: idx + 1,
        url: `${absoluteUrl(config, "/apps")}#${item.slug}`,
        name: item.titleAr,
        description: item.descriptionAr,
        image: item.image,
      })),
    },
  };

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(config, [
            { name: "الرئيسية", path: "/" },
            { name: "تطبيقاتنا", path: "/apps" },
          ]),
          collectionSchema,
        ]}
      />
      <UpcomingShowcaseView kind="apps" />
    </>
  );
}
