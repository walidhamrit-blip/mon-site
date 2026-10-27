import type { Metadata } from "next";
import { getSiteDataCached } from "@/lib/store";
import { absoluteUrl, breadcrumbJsonLd, pageMetadata, siteLocale } from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { UpcomingShowcaseView } from "@/components/upcoming-showcase-view";

export async function generateMetadata(): Promise<Metadata> {
  const { config } = await getSiteDataCached();
  // Les métadonnées suivent la langue principale du site (/admin → Réglages).
  const locale = siteLocale(config);
  return pageMetadata(config, {
    path: "/apps",
    title:
      locale === "ar"
        ? "تطبيقاتنا الذكية للجوال والويب — قيد التحضير وقريباً"
        : "Our Smart Apps for Mobile & Web — In Preparation, Coming Soon",
    description:
      locale === "ar"
        ? "تطبيقات الجوال والويب من نخبة في طرابلس قريباً وقيد التحضير — حلول ذكية للمتاجر والعيادات والمطاعم على iOS وAndroid والويب مع تسجيل للإطلاق المبكر."
        : "Nukhba mobile & web apps in Tripoli — in preparation and coming soon: smart solutions for shops, clinics and restaurants on iOS, Android and the web, with early-launch sign-up.",
    keywords: [
      "تطبيقات جوال ليبيا",
      "برمجة تطبيقات طرابلس",
      "تطبيقات متاجر وعيادات",
      "Nukhba mobile apps Libya",
      "web apps Tripoli",
      "Nukhba apps coming soon",
    ],
  });
}

export default async function AppsPage() {
  const { config, content } = await getSiteDataCached();
  const page = content.appsPage;
  const locale = siteLocale(config);

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${absoluteUrl(config, "/apps")}#collection`,
    name:
      locale === "ar"
        ? `${page.titleAr} — ${page.statusBadgeAr}`
        : `${page.titleEn} — ${page.statusBadgeEn}`,
    url: absoluteUrl(config, "/apps"),
    inLanguage: ["en", "ar"],
    isPartOf: { "@id": absoluteUrl(config, "#website") },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: page.items.length,
      itemListElement: page.items.map((item, idx) => ({
        "@type": "ListItem",
        position: idx + 1,
        url: `${absoluteUrl(config, "/apps")}#${item.slug}`,
        name: locale === "ar" ? item.titleAr : item.titleEn,
        description: locale === "ar" ? item.descriptionAr : item.descriptionEn,
        image: item.image,
      })),
    },
  };

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(config, [
            { name: locale === "ar" ? "الرئيسية" : "Home", path: "/" },
            { name: locale === "ar" ? "تطبيقاتنا" : "Our apps", path: "/apps" },
          ]),
          collectionSchema,
        ]}
      />
      <UpcomingShowcaseView kind="apps" />
    </>
  );
}
