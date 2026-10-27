import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSiteDataCached } from "@/lib/store";
import { breadcrumbJsonLd, pageMetadata, siteLocale } from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import {
  getSectorSeo,
  getDemosForSector,
  sectorCollectionJsonLd,
  sectorFaqJsonLd,
  sectorIds,
} from "@/lib/sectors";
import { resolveDemoClassification } from "@/lib/classification";
import { SectorDetailView } from "@/components/sector-detail-view";

export async function generateStaticParams() {
  return sectorIds.map((sector) => ({ sector }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sector: string }>;
}): Promise<Metadata> {
  const { sector: sectorId } = await params;
  const sector = getSectorSeo(sectorId);
  if (!sector) return {};
  const { config } = await getSiteDataCached();
  // Métadonnées dans la langue principale du site (/admin).
  const locale = siteLocale(config);
  return pageMetadata(config, {
    path: `/sectors/${sector.id}`,
    title: locale === "ar" ? sector.titleAr : sector.titleEn,
    description: locale === "ar" ? sector.descriptionAr : sector.descriptionEn,
    // opengraph-image.tsx génère une carte 1200×630 propre au secteur.
    image: false,
    keywords: [...sector.keywordsAr, ...sector.keywordsEn, sector.labelAr, sector.labelEn],
  });
}

export default async function SectorPage({
  params,
}: {
  params: Promise<{ sector: string }>;
}) {
  const { sector: sectorId } = await params;
  const sector = getSectorSeo(sectorId);
  if (!sector) notFound();

  const { config, content } = await getSiteDataCached();
  const demosInSector = getDemosForSector(content.demos, sectorId);

  // Fonctionnalités réellement livrées dans ce secteur (agrégées depuis
  // les fiches réalisations, dédupliquées) + prix d'entrée constaté :
  // contenu factuel propre à chaque secteur, sans texte générique.
  const sectorFeaturesAr = [...new Set(demosInSector.flatMap((d) => d.features))].slice(0, 10);
  const sectorFeaturesEn = [...new Set(demosInSector.flatMap((d) => d.featuresEn))].slice(0, 10);
  const sectorPricesUsd = demosInSector
    .map((d) => resolveDemoClassification(d, config.pricing.plans)?.priceUsd)
    .filter((p): p is number => typeof p === "number" && p > 0);
  const sectorPriceFromUsd =
    sectorPricesUsd.length > 0 ? Math.min(...sectorPricesUsd) : null;

  // Tarification de chaque réalisation (catégorie, prix, personnalisation)
  // calculée côté serveur : le composant client ne fait qu'afficher.
  const demoPlans = Object.fromEntries(
    demosInSector.map((demo) => {
      const cls = resolveDemoClassification(demo, config.pricing.plans);
      return [
        demo.slug,
        cls
          ? {
              tier: cls.tier,
              nameEn: cls.nameEn,
              priceUsd: cls.priceUsd ?? null,
              customizationPercent: cls.customizationPercent ?? null,
              customizationUsd: cls.customizationUsd ?? null,
              totalPriceUsd: cls.totalPriceUsd ?? null,
            }
          : null,
      ];
    }),
  );

  const otherSectors = sectorIds
    .filter((id) => id !== sector.id)
    .slice(0, 8)
    .map((id) => getSectorSeo(id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((item) => ({ id: item.id, labelAr: item.labelAr, labelEn: item.labelEn }));

  const collectionLd = sectorCollectionJsonLd(config, sector, demosInSector);
  const faqLd = sectorFaqJsonLd(sector);

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(config, [
            { name: "الرئيسية", path: "/" },
            { name: "القطاعات", path: "/sectors" },
            { name: sector.labelAr, path: `/sectors/${sector.id}` },
          ]),
          collectionLd,
          faqLd,
        ]}
      />

      <SectorDetailView
        sector={sector}
        demos={demosInSector}
        featuresAr={sectorFeaturesAr}
        featuresEn={sectorFeaturesEn}
        priceFromUsd={sectorPriceFromUsd}
        otherSectors={otherSectors}
        demoPlans={demoPlans}
      />
    </>
  );
}
