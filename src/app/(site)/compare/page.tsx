import type { Metadata } from "next";
import { getSiteDataCached } from "@/lib/store";
import { breadcrumbJsonLd, faqJsonLd, pageMetadata, siteLocale, webPageJsonLd } from "@/lib/seo";
import {
  comparisonIds,
  comparisonsHubFaqs,
  comparisonsCollectionJsonLd,
  getComparison,
  resolveComparisonTokens,
} from "@/lib/comparisons";
import { JsonLd } from "@/components/json-ld";
import { ComparisonHubView } from "@/components/comparison-hub-view";

/**
 * Hub des comparaisons (/compare) — la page « thème » du cluster SEO.
 *
 * Elle centralise les comparaisons (annonces) et renvoie vers chaque page
 * comparative : un hub + N pages = un silo SEO cohérent, avec des liens
 * internes dans les deux sens.
 *
 * Le rendu visible est un composant **client** : la page suit la langue du
 * site (arabe / anglais) sans rechargement.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { config } = await getSiteDataCached();
  // Métadonnées dans la langue principale du site (/admin → Apparence),
  // alignées sur le HTML initial rendu.
  const locale = siteLocale(config);

  return pageMetadata(config, {
    path: "/compare",
    title:
      locale === "ar"
        ? "مقارنات صريحة — نخبة مقابل الإعلانات والقوالب والمستقلين"
        : "Honest comparisons: Nukhba vs ads, builders, freelancers",
    description:
      locale === "ar"
        ? "مقارنات صريحة بين نخبة وإعلانات جوجل وفيسبوك ومنشئات المواقع والمستقلين واشتراكات SEO: التكلفة، السرعة، ملكية العملاء والأثر بعد المشروع."
        : "Honest side-by-side comparisons: Google Ads, Facebook ads, website builders, freelancers and SEO retainers vs a Nukhba site — cost, speed, ownership.",
    keywords: [
      "مقارنة المواقع",
      "مقارنة إعلانات جوجل",
      "نخبة ضد Wix",
      "مقارنة أسعار تصميم المواقع",
      "website vs ads",
      "web agency comparison",
    ],
  });
}

export default async function CompareHubPage() {
  const { config } = await getSiteDataCached();
  const sitePriceUsd = config.pricing.plans[0]?.priceUsd ?? 300;
  // Les jetons de marché ({city}, {cityEn}…) sont résolus ici : le
  // composant client reçoit du texte prêt à afficher.
  const items = comparisonIds
    .map((id) => getComparison(id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((item) => resolveComparisonTokens(item, config.market));

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(config, [
            { name: "الرئيسية", path: "/" },
            { name: "المقارنات", path: "/compare" },
          ]),
          webPageJsonLd(config, {
            path: "/compare",
            name: "مقارنات صريحة — نخبة Nukhba",
            description:
              "مقارنات صريحة: إعلانات جوجل وفيسبوك ومنشئات المواقع والمستقلون واشتراكات SEO، مقابل موقع نخبة. التكلفة والملكية والسرعة والأثر بعد المشروع.",
            speakable: ["h1", "#compare-answer"],
            about: "مقارنات تصميم المواقع والإعلانات",
          }),
          comparisonsCollectionJsonLd(config, items),
          faqJsonLd(comparisonsHubFaqs),
        ]}
      />

      <ComparisonHubView
        items={items}
        faqs={comparisonsHubFaqs}
        sitePriceUsd={sitePriceUsd}
      />
    </>
  );
}
