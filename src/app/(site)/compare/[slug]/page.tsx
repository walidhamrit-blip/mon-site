import type { Metadata } from "next";
import { pageLocale } from "@/lib/locale-server";
import type { LocalePageProps } from "@/lib/locale";
import { notFound } from "next/navigation";
import { getSiteDataCached } from "@/lib/store";
import { breadcrumbJsonLd, pageMetadata, siteLocale, webPageJsonLd } from "@/lib/seo";
import {
  comparePath,
  comparisonCriteriaJsonLd,
  comparisonFaqJsonLd,
  comparisonIds,
  comparisonServiceJsonLd,
  getComparison,
  relatedComparisons,
  resolveComparisonTokens,
} from "@/lib/comparisons";
import { JsonLd } from "@/components/json-ld";
import { ComparisonView } from "@/components/comparison-view";
import { findService } from "@/lib/services";
import { lowestServicePrice } from "@/lib/service-pricing";
import { WEBSITE_BASE_PRICE_USD } from "@/lib/website-offer";

/**
 * Page comparative (/compare/[slug]) — l'« annonce » SEO du site.
 *
 * La page est entièrement dérivée de `src/lib/comparisons.ts` : ajouter une
 * comparaison dans ce fichier suffit à publier une nouvelle page (avec son
 * Open Graph, ses schémas, son sitemap et ses liens). Aucun câblage ici.
 *
 * Le rendu visible est un composant **client** (`ComparisonView`) : la page
 * suit la langue du site (arabe / anglais) sans rechargement. Le serveur ne
 * fournit que les données et les schémas (dans les deux langues).
 */
export async function generateStaticParams() {
  return comparisonIds.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
} & LocalePageProps): Promise<Metadata> {
  const { slug } = await params;
  const comparison = getComparison(slug);
  const { config } = await getSiteDataCached();
  const locale = await pageLocale(config, searchParams);
  if (!comparison) {
    return pageMetadata(config, {
    locale,
      path: comparePath(slug),
      title: "مقارنة غير موجودة — Comparison not found",
      description: "هذه المقارنة غير متاحة حالياً.",
      noindex: true,
    });
  }
  // Les métadonnées suivent la langue principale du site (/admin) : le
  // titre servi est toujours celui de la langue par défaut, comme le HTML
  // initial. Le visiteur peut basculer la langue côté client ensuite.

  return pageMetadata(config, {
    locale,
    path: comparePath(comparison.id),
    title: locale === "ar" ? comparison.titleAr : comparison.titleEn,
    description: locale === "ar" ? comparison.descriptionAr : comparison.descriptionEn,
    // opengraph-image.tsx génère la carte « annonce » 1200×630 de la page.
    image: false,
    keywords: [
      ...comparison.keywordsAr,
      ...comparison.keywordsEn,
      comparison.competitorAr,
      comparison.competitorEn,
    ],
  });
}

export default async function ComparisonPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
} & LocalePageProps) {
  const { slug } = await params;
  const comparison = getComparison(slug);
  if (!comparison) notFound();

  const { config } = await getSiteDataCached();
  const locale = await pageLocale(config, searchParams);

  // Prix vivants : le site part du modèle le moins cher, les services à la
  // carte du service le moins cher. Ils sont pilotables depuis /admin.
  const sitePriceUsd = config.pricing.plans[0]?.priceUsd ?? WEBSITE_BASE_PRICE_USD;
  const lowestServiceUsd = lowestServicePrice(config.standaloneServices, 19);

  // Texte prêt à afficher pour le composant client : jetons de marché
  // ({city}…) ET prix de services ({price:…}) résolus avec la configuration
  // vivante de /admin. Le schéma FAQPage publie la même valeur que le HTML.
  const resolved = resolveComparisonTokens(
    comparison,
    config.market,
    config.standaloneServices,
  );
  const related = relatedComparisons(comparison.id).map((item) =>
    resolveComparisonTokens(item, config.market, config.standaloneServices),
  );
  const relatedServices = comparison.relatedServices
    .map((id) => findService(config.standaloneServices, id))
    .filter((service): service is NonNullable<typeof service> => Boolean(service))
    .map((service) => ({
      id: service.id,
      titleAr: service.titleAr,
      titleEn: service.titleEn,
    }));

  const ar = locale === "ar";
  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(config, [
            { name: ar ? "الرئيسية" : "Home", path: "/" },
            { name: ar ? "المقارنات" : "Comparisons", path: "/compare" },
            { name: ar ? resolved.h1Ar : resolved.h1En, path: comparePath(comparison.id) },
          ], locale),
          webPageJsonLd(config, {
            path: comparePath(comparison.id),
            locale,
            name: ar ? resolved.h1Ar : resolved.h1En,
            description: ar ? resolved.answerAr : resolved.answerEn,
            speakable: ["h1", "#compare-answer"],
            about: ar ? `${resolved.competitorAr} — مقارنة نخبة` : `${resolved.competitorEn} — Nukhba comparison`,
          }),
          comparisonServiceJsonLd(config, comparison, sitePriceUsd, locale),
          comparisonCriteriaJsonLd(config, comparison, locale),
          comparisonFaqJsonLd(resolved, locale),
        ]}
      />

      <ComparisonView
        comparison={resolved}
        related={related}
        relatedServices={relatedServices}
        sitePriceUsd={sitePriceUsd}
        servicePriceUsd={lowestServiceUsd}
        whatsapp={config.whatsapp}
      />
    </>
  );
}
