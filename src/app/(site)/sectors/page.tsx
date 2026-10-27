import type { Metadata } from "next";
import { getSiteDataCached } from "@/lib/store";
import { absoluteUrl, breadcrumbJsonLd, pageMetadata, siteLocale } from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { sectorSeo, sectorIds } from "@/lib/sectors";
import { SectorsHubView } from "@/components/sectors-hub-view";

export async function generateMetadata(): Promise<Metadata> {
  const { config } = await getSiteDataCached();
  const locale = siteLocale(config);
  return pageMetadata(config, {
    path: "/sectors",
    title:
      locale === "ar"
        ? "تصميم مواقع حسب القطاع في {city} — نخبة"
        : "Websites designed for your sector in {cityEn} — Nukhba",
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

export default async function SectorsIndexPage() {
  const { config, content } = await getSiteDataCached();

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${absoluteUrl(config, "/sectors")}#collection`,
    name: "قطاعات تصميم المواقع — نخبة",
    alternateName: "Website Design by Sector — Nukhba",
    description: "تصفح خدمات نخبة حسب قطاع نشاطك في طرابلس",
    url: absoluteUrl(config, "/sectors"),
    inLanguage: ["en", "ar"],
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
          url: absoluteUrl(config, `/sectors/${id}`),
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
          ]),
          collectionSchema,
        ]}
      />

      <SectorsHubView sectors={sectors} demoCounts={demoCounts} />
    </>
  );
}
