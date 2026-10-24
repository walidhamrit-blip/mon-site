import type { Metadata } from "next";
import Link from "next/link";
import { getSiteDataCached } from "@/lib/store";
import { absoluteUrl, breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { sectorSeo, sectorIds } from "@/lib/sectors";

export async function generateMetadata(): Promise<Metadata> {
  const { config } = await getSiteDataCached();
  return pageMetadata(config, {
    path: "/sectors",
    title: "تصميم مواقع حسب القطاع في {city} — نخبة",
    description:
      "اختر قطاعك: عيادات، مطاعم، عطور، مفروشات، ألعاب، إلكترونيات، مواد بناء، قرطاسية، أطقم صحية — مواقع مخصصة في طرابلس مع حجز وبيع أونلاين.",
    keywords: ["تصميم مواقع قطاعات {city}", "شركة تصميم مواقع {country}", "قطاعات نخبة"],
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

      <div className="pt-6">
        <section className="section-tight border-b border-[var(--border)] bg-[var(--secondary)]/35">
          <div className="site-container px-4 sm:px-6 lg:px-8">
            <h1 className="text-[36px] lg:text-[44px] font-black tracking-tight leading-none">
              تصميم مواقع حسب قطاعك في طرابلس
            </h1>
            <p className="mt-3 opacity-60 max-w-[60ch]">
              كل قطاع له لغته، ألوانه ووظائفه — اختر نشاطك واكتشف مواقع حقيقية أنجزناها في نفس مجالك مع أسعار واضحة وخدمات مخصصة.
            </p>
          </div>
        </section>

        <section className="py-10">
          <div className="site-container px-4 sm:px-6 lg:px-8">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {sectorIds.map((id) => {
                const sector = sectorSeo[id];
                const demosInSector = content.demos.filter((d) => d.sector === id);
                return (
                  <Link
                    key={id}
                    href={`/sectors/${id}`}
                    className="group rounded-[22px] overflow-hidden bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)]/50 hover:shadow-lg transition-all p-6 flex flex-col"
                  >
                    <div className="text-xs font-bold tracking-widest text-[var(--accent)] uppercase">
                      {sector.labelEn}
                    </div>
                    <h2 className="mt-2 text-[18px] font-black leading-tight group-hover:text-[var(--accent)] transition-colors">
                      {sector.h1Ar}
                    </h2>
                    <p className="mt-2 text-sm opacity-60 line-clamp-3">{sector.descriptionAr}</p>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-[var(--secondary)] border border-[var(--border)]">
                        {demosInSector.length} مشروع{demosInSector.length !== 1 ? "" : ""} · {demosInSector.length} site{demosInSector.length > 1 ? "s" : ""}
                      </span>
                      <span className="text-sm font-bold text-[var(--accent)] group-hover:underline">اكتشف ←</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
