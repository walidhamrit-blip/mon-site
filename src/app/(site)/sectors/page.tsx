import type { Metadata } from "next";
import { pageLocale } from "@/lib/locale-server";
import type { LocalePageProps } from "@/lib/locale";
import { localizedAbsoluteUrl } from "@/lib/locale";
import { getSiteDataCached } from "@/lib/store";
import { absoluteUrl, breadcrumbJsonLd, pageMetadata, siteLocale } from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { sectorSeo, sectorIds } from "@/lib/sectors";
import { SectorsHubView } from "@/components/sectors-hub-view";

export async function generateMetadata({ searchParams }: LocalePageProps): Promise<Metadata> {
  const { config } = await getSiteDataCached();
  const locale = await pageLocale(config, searchParams);
  return pageMetadata(config, {
    locale,
    path: "/sectors",
    title:
      locale === "ar"
        ? "تصميم مواقع حسب القطاع في {city}"
        : "Websites by Sector in {cityEn}",
    description:
      locale === "ar"
        ? "اختر قطاعك: عيادات، مطاعم، عطور، مفروشات، ألعاب، إلكترونيات، مواد بناء، قرطاسية، أطقم صحية — مواقع مخصصة في طرابلس مع حجز وبيع أونلاين."
        : "Pick your sector: clinics, restaurants, perfumes, furniture, toys, electronics, building supplies, stationery — custom websites in Tripoli with booking and online sales.",
    keywords: [
      "تصميم مواقع قطاعات {city}",
      "شركة تصميم مواقع {country}",
      "قطاعات نخبة",
      "sector websites {cityEn}",
    ],
  });
}

export default async function SectorsIndexPage({ searchParams }: LocalePageProps) {
  const { config, content } = await getSiteDataCached();
  const locale = await pageLocale(config, searchParams);

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${localizedAbsoluteUrl(config.url, "/sectors", locale, siteLocale(config))}#collection`,
    name: "قطاعات تصميم المواقع — نخبة",
    alternateName: "Website Design by Sector — Nukhba",
    description: "تصفح خدمات نخبة حسب قطاع نشاطك في طرابلس",
    url: localizedAbsoluteUrl(config.url, "/sectors", locale, siteLocale(config)),
    inLanguage: locale,
    isPartOf: { "@id": absoluteUrl(config, "#website") },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: sectorIds.length,
      itemListElement: sectorIds.map((id, i) => {
        const s = sectorSeo[id];
        const count = content.demos.filter((d) => d.sector === id).length;
        return {
          "@type": "ListItem",
          position: i + 1,
          url: localizedAbsoluteUrl(config.url, `/sectors/${id}`, locale, siteLocale(config)),
          name: s.titleAr,
          description: s.descriptionAr,
          numberOfItems: count,
        };
      }),
    },
  };

  const sectors = sectorIds
    .map((id) => sectorSeo[id])
    .filter((sector): sector is NonNullable<typeof sector> => Boolean(sector));
  const demoCounts = Object.fromEntries(
    sectorIds.map((id) => [id, content.demos.filter((d) => d.sector === id).length]),
  );

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(config, [
            { name: "الرئيسية", path: "/" },
            { name: "القطاعات", path: "/sectors" },
          ], locale),
          collectionSchema,
        ]}
      />

      <SectorsHubView sectors={sectors} demoCounts={demoCounts} />
    </>
  );
}
