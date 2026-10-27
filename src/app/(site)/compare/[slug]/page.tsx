import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSiteDataCached } from "@/lib/store";
import { breadcrumbJsonLd, pageMetadata, webPageJsonLd } from "@/lib/seo";
import {
  comparePath,
  comparisonCriteriaJsonLd,
  comparisonFaqJsonLd,
  comparisonIds,
  comparisonServiceJsonLd,
  getComparison,
  relatedComparisons,
} from "@/lib/comparisons";
import { JsonLd } from "@/components/json-ld";
import { ComparisonView } from "@/components/comparison-view";
import { findService } from "@/lib/services";

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
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const comparison = getComparison(slug);
  const { config } = await getSiteDataCached();
  if (!comparison) {
    return pageMetadata(config, {
      path: comparePath(slug),
      title: "مقارنة غير موجودة — Comparison not found",
      description: "هذه المقارنة غير متاحة حالياً.",
      noindex: true,
    });
  }
  return pageMetadata(config, {
    path: comparePath(comparison.id),
    title: comparison.titleAr,
    description: comparison.descriptionAr,
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
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const comparison = getComparison(slug);
  if (!comparison) notFound();

  const { config } = await getSiteDataCached();

  // Prix vivants : le site part du modèle le moins cher, les services à la
  // carte du service le moins cher. Ils sont pilotables depuis /admin.
  const sitePriceUsd = config.pricing.plans[0]?.priceUsd ?? 300;
  const servicePriceUsd = config.standaloneServices.reduce(
    (min, service) => Math.min(min, service.priceFromUsd),
    Number.POSITIVE_INFINITY,
  );
  const lowestServiceUsd = Number.isFinite(servicePriceUsd) ? servicePriceUsd : 15;

  const related = relatedComparisons(comparison.id);
  const relatedServices = comparison.relatedServices
    .map((id) => findService(config.standaloneServices, id))
    .filter((service): service is NonNullable<typeof service> => Boolean(service))
    .map((service) => ({
      id: service.id,
      titleAr: service.titleAr,
      titleEn: service.titleEn,
    }));

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(config, [
            { name: "الرئيسية", path: "/" },
            { name: "المقارنات", path: "/compare" },
            { name: comparison.h1Ar, path: comparePath(comparison.id) },
          ]),
          webPageJsonLd(config, {
            path: comparePath(comparison.id),
            name: comparison.h1Ar,
            description: comparison.answerAr,
            speakable: ["h1", "#compare-answer"],
            about: `${comparison.competitorEn} — Nukhba comparison`,
          }),
          comparisonServiceJsonLd(config, comparison, sitePriceUsd),
          comparisonCriteriaJsonLd(config, comparison),
          comparisonFaqJsonLd(comparison),
        ]}
      />

      <ComparisonView
        comparison={comparison}
        related={related}
        relatedServices={relatedServices}
        sitePriceUsd={sitePriceUsd}
        servicePriceUsd={lowestServiceUsd}
        whatsapp={config.whatsapp}
      />
    </>
  );
}
