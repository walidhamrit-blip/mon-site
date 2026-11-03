import type { Metadata } from "next";
import { pageLocale } from "@/lib/locale-server";
import type { LocalePageProps } from "@/lib/locale";
import { localizedAbsoluteUrl } from "@/lib/locale";
import { getSiteDataCached } from "@/lib/store";
import { absoluteUrl, breadcrumbJsonLd, pageMetadata, siteLocale } from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { UpcomingShowcaseView } from "@/components/upcoming-showcase-view";
import { DigitalStoreBanner } from "@/components/digital-store-banner";

export async function generateMetadata({ searchParams }: LocalePageProps): Promise<Metadata> {
  const { config } = await getSiteDataCached();
  // Les métadonnées suivent la langue principale du site (/admin → Réglages).
  const locale = await pageLocale(config, searchParams);
  return pageMetadata(config, {
    locale,
    path: "/apps",
    title:
      locale === "ar"
        ? "تطبيقات نخبة القادمة — iOS وAndroid والويب"
        : "Nukhba Apps — Coming Soon on iOS, Android & Web",
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

export default async function AppsPage({ searchParams }: LocalePageProps) {
  const { config, content } = await getSiteDataCached();
  const page = content.appsPage;
  const locale = await pageLocale(config, searchParams);

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${localizedAbsoluteUrl(config.url, "/apps", locale, siteLocale(config))}#collection`,
    name:
      locale === "ar"
        ? `${page.titleAr} — ${page.statusBadgeAr}`
        : `${page.titleEn} — ${page.statusBadgeEn}`,
    url: localizedAbsoluteUrl(config.url, "/apps", locale, siteLocale(config)),
    inLanguage: locale,
    isPartOf: { "@id": absoluteUrl(config, "#website") },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: page.items.length,
      itemListElement: page.items.map((item, idx) => ({
        "@type": "ListItem",
        position: idx + 1,
        url: `${localizedAbsoluteUrl(config.url, "/apps", locale, siteLocale(config))}#${item.slug}`,
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
          ], locale),
          collectionSchema,
        ]}
      />
      <UpcomingShowcaseView kind="apps" />
      <DigitalStoreBanner locale={locale} />
    </>
  );
}
