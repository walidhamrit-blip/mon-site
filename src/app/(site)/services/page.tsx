import type { Metadata } from "next";
import { getSiteDataCached } from "@/lib/store";
import { breadcrumbJsonLd, faqJsonLd, pageMetadata, siteLocale, webPageJsonLd } from "@/lib/seo";
import {
  resolveServiceLanding,
  servicesCollectionJsonLd,
  servicesHubFaqs,
  type ServiceLike,
} from "@/lib/services";
import { JsonLd } from "@/components/json-ld";
import { ServicesHubView } from "@/components/services-hub-view";
import { comparisonIds, getComparison, resolveComparisonTokens } from "@/lib/comparisons";
import { formatMainPrice } from "@/lib/installments";

/** Prix « à partir de » d'un service, lu dans la configuration vivante. */
function startingPrice(
  services: ReadonlyArray<ServiceLike>,
  id: string,
  fallback: number,
): number {
  return services.find((service) => service.id === id)?.priceFromUsd ?? fallback;
}

export async function generateMetadata(): Promise<Metadata> {
  const { config } = await getSiteDataCached();
  const services: ReadonlyArray<ServiceLike> = config.standaloneServices;
  const price = (id: string, fallback: number) =>
    formatMainPrice(startingPrice(services, id, fallback), "$");

  // La langue des métadonnées suit la langue principale du site
  // (/admin → Réglages) : une seule version servie par URL, cohérente avec
  // le HTML initial.
  const locale = siteLocale(config);

  const titleAr = "خدمات رقمية سريعة في {city} — هوية، عروض، صفحات هبوط";
  const titleEn = "Fast digital services in {cityEn} — identity, decks, landing pages";
  const descriptionAr =
    `خدمات نخبة الرقمية في طرابلس بأسعار معلنة: إعادة تصميم موقع من ${price("restyle", 49)}، ` +
    `إضافة قسم من ${price("add-section", 19)}، عرض تقديمي من ${price("slides", 29)}، ` +
    `هوية بصرية من ${price("branding", 39)}، صفحة هبوط من ${price("landing", 59)}، ` +
    `وإصلاح موقع من ${price("fix-optimize", 15)}.`;
  const descriptionEn =
    `Nukhba digital services in Tripoli at published prices: site restyle from ${price("restyle", 49)}, ` +
    `new section from ${price("add-section", 19)}, decks from ${price("slides", 29)}, ` +
    `branding from ${price("branding", 39)}, landing page from ${price("landing", 59)}, ` +
    `fix from ${price("fix-optimize", 15)}.`;

  return pageMetadata(config, {
    path: "/services",
    title: locale === "ar" ? titleAr : titleEn,
    description: locale === "ar" ? descriptionAr : descriptionEn,
    keywords: [
      "خدمات رقمية {city}",
      "إعادة تصميم موقع {country}",
      "تصميم هوية بصرية",
      "صفحة هبوط {country}",
      "إصلاح موقع {city}",
      "digital services {cityEn}",
      "open services {cityEn}",
    ],
  });
}

export default async function ServicesPage() {
  const { config } = await getSiteDataCached();
  const services: ReadonlyArray<ServiceLike> = config.standaloneServices;
  const lowestPrice = services.reduce(
    (min, service) => Math.min(min, service.priceFromUsd),
    Number.POSITIVE_INFINITY,
  );
  // Comparaisons affichées en haut de page (bandeau « pas sûr entre deux
  // options ? ») : même source de données que les pages /compare.
  const comparisons = comparisonIds
    .map((id) => getComparison(id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((item) => resolveComparisonTokens(item, config.market));

  const webPage = webPageJsonLd(config, {
    path: "/services",
    name: "خدمات نخبة الرقمية السريعة — أسعار معلنة وتسليم سريع",
    description:
      `خدمات رقمية à la carte في طرابلس: إعادة تصميم موقع، إضافة قسم، عروض تقديمية، هوية بصرية، صفحة هبوط، وإصلاح وتحسين — بأسعار تبدأ من ${Number.isFinite(lowestPrice) ? lowestPrice : 15} دولاراً.`,
    speakable: ["h1", "#services-answer"],
    about: "خدمات تصميم وتطوير الويب في طرابلس، ليبيا",
  });

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(config, [
            { name: "الرئيسية", path: "/" },
            { name: "الخدمات", path: "/services" },
          ]),
          webPage,
          servicesCollectionJsonLd(config, services),
          faqJsonLd(servicesHubFaqs),
        ]}
      />

      <ServicesHubView
        services={services}
        comparisons={comparisons}
        faqs={servicesHubFaqs}
      />
    </>
  );
}
