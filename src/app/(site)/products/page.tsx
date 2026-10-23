import type { Metadata } from "next";
import { getSiteDataCached } from "@/lib/store";
import { absoluteUrl, breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { UpcomingShowcaseView } from "@/components/upcoming-showcase-view";

export async function generateMetadata(): Promise<Metadata> {
  const { config } = await getSiteDataCached();
  return pageMetadata(config, {
    path: "/products",
    title: "منتجاتنا الرقمية وبرامجنا السحابية — قريباً في {city}",
    description:
      "المنتجات الرقمية والبرامج الجاهزة من نخبة قريباً — أنظمة نقاط البيع وإدارة المخزون والفوترة السحابية وقوالب الأعمال للشركات في طرابلس وليبيا.",
    keywords: [
      "برامج محاسبة ومخازن {country}",
      "نظام نقاط بيع {city}",
      "منتجات رقمية وبرامج سحابية",
      "Nukhba software & digital products",
    ],
  });
}

export default async function ProductsPage() {
  const { config, content } = await getSiteDataCached();
  const page = content.productsPage;

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${absoluteUrl(config, "/products")}#collection`,
    name: `${page.titleAr} — ${page.statusBadgeAr}`,
    url: absoluteUrl(config, "/products"),
    inLanguage: ["ar-LY", "en"],
    isPartOf: { "@id": absoluteUrl(config, "#website") },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: page.items.length,
      itemListElement: page.items.map((item, idx) => ({
        "@type": "ListItem",
        position: idx + 1,
        url: `${absoluteUrl(config, "/products")}#${item.slug}`,
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
            { name: "منتجاتنا الرقمية وبرامجنا", path: "/products" },
          ]),
          collectionSchema,
        ]}
      />
      <UpcomingShowcaseView kind="products" />
    </>
  );
}
