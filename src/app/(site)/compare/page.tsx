import type { Metadata } from "next";
import { pageLocale } from "@/lib/locale-server";
import type { LocalePageProps } from "@/lib/locale";
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
export async function generateMetadata({ searchParams }: LocalePageProps): Promise<Metadata> {
  const { config } = await getSiteDataCached();
  // Métadonnées dans la langue principale du site (/admin → Apparence),
  // alignées sur le HTML initial rendu.
  const locale = await pageLocale(config, searchParams);

  return pageMetadata(config, {
    locale,
    path: "/compare",
    title:
      locale === "ar"
        ? "مقارنات صريحة: نخبة مقابل البدائل"
        : "Honest Comparisons: Nukhba vs the Alternatives",
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

export default async function CompareHubPage({ searchParams }: LocalePageProps) {
  const { config } = await getSiteDataCached();
  const locale = await pageLocale(config, searchParams);
  const sitePriceUsd = config.pricing.plans[0]?.priceUsd ?? 300;
  // Les jetons de marché ({city}, {cityEn}…) sont résolus ici : le
  // composant client reçoit du texte prêt à afficher.
  const items = comparisonIds
    .map((id) => getComparison(id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((item) => resolveComparisonTokens(item, config.market));

  const ar = locale === "ar";
  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(config, [
            { name: ar ? "الرئيسية" : "Home", path: "/" },
            { name: ar ? "المقارنات" : "Comparisons", path: "/compare" },
          ], locale),
          webPageJsonLd(config, {
            path: "/compare",
            locale,
            name: ar ? "مقارنات صريحة — نخبة" : "Honest Comparisons — Nukhba",
            description: ar
              ? "مقارنات صريحة: إعلانات جوجل وفيسبوك ومنشئات المواقع والمستقلون واشتراكات SEO، مقابل موقع نخبة. التكلفة والملكية والسرعة والأثر بعد المشروع."
              : "Honest side-by-side comparisons: Google Ads, Facebook ads, website builders, freelancers and SEO retainers vs a custom Nukhba site.",
            speakable: ["h1", "#compare-answer"],
            about: ar ? "مقارنات تصميم المواقع والإعلانات" : "Website design and marketing comparisons",
          }),
          comparisonsCollectionJsonLd(config, items, locale),
          faqJsonLd(comparisonsHubFaqs, config.market, locale),
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
