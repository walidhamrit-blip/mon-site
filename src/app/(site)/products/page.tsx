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
    path: "/products",
    title:
      locale === "ar"
        ? "منتجاتنا الرقمية وبرامجنا السحابية — قريباً في {city}"
        : "Our Digital Products & Cloud Software — Coming Soon in {cityEn}",
    description:
      locale === "ar"
        ? "المنتجات الرقمية والبرامج الجاهزة من نخبة قريباً — أنظمة نقاط البيع وإدارة المخزون والفوترة السحابية وقوالب الأعمال للشركات في طرابلس وليبيا."
        : "Nukhba digital products and ready-to-use software — POS systems, inventory management, cloud invoicing and business templates for companies in Tripoli and Libya.",
    keywords: [
      "برامج محاسبة ومخازن {country}",
      "نظام نقاط بيع {city}",
      "منتجات رقمية وبرامج سحابية",
      "Nukhba software & digital products",
      "POS software {cityEn}",
      "inventory software Libya",
    ],
  });
}

export default async function ProductsPage() {
  const { config, content } = await getSiteDataCached();
  const page = content.productsPage;
  const locale = siteLocale(config);

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${absoluteUrl(config, "/products")}#collection`,
    name:
      locale === "ar"
        ? `${page.titleAr} — ${page.statusBadgeAr}`
        : `${page.titleEn} — ${page.statusBadgeEn}`,
    url: absoluteUrl(config, "/products"),
    inLanguage: ["en", "ar"],
    isPartOf: { "@id": absoluteUrl(config, "#website") },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: page.items.length,
      itemListElement: page.items.map((item, idx) => ({
        "@type": "ListItem",
        position: idx + 1,
        url: `${absoluteUrl(config, "/products")}#${item.slug}`,
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
            {
              name:
                locale === "ar"
                  ? "منتجاتنا الرقمية وبرامجنا"
                  : "Our digital products & software",
              path: "/products",
            },
          ]),
          collectionSchema,
        ]}
      />
      <UpcomingShowcaseView kind="products" />
    </>
  );
}
