import type { Metadata } from "next";
import { pageLocale } from "@/lib/locale-server";
import type { LocalePageProps } from "@/lib/locale";
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
import { lowestServicePrice, serviceStartingPrice } from "@/lib/service-pricing";

export async function generateMetadata({ searchParams }: LocalePageProps): Promise<Metadata> {
  const { config } = await getSiteDataCached();
  const services: ReadonlyArray<ServiceLike> = config.standaloneServices;
  const price = (id: string, fallback: number) =>
    formatMainPrice(serviceStartingPrice(services, id, fallback), "$");

  // La langue des métadonnées suit la langue principale du site
  // (/admin → Réglages) : une seule version servie par URL, cohérente avec
  // le HTML initial.
  const locale = await pageLocale(config, searchParams);

  const titleAr = "خدمات رقمية سريعة بأسعار معلنة في {city}";
  const titleEn = "Fast Digital Services at Fixed Prices — {cityEn}";
  const descriptionAr =
    `خدمات نخبة الرقمية في طرابلس بأسعار معلنة: إعادة تصميم موقع من ${price("restyle", 49)}، ` +
    `إضافة قسم من ${price("add-section", 19)}، عرض تقديمي من ${price("slides", 29)}، ` +
    `هوية بصرية من ${price("branding", 39)}، صفحة هبوط من ${price("landing", 59)}، ` +
    `وإصلاح موقع من ${price("fix-optimize", 90)}.`;
  const descriptionEn =
    `Nukhba digital services in Tripoli at published prices: site restyle from ${price("restyle", 49)}, ` +
    `new section from ${price("add-section", 19)}, decks from ${price("slides", 29)}, ` +
    `branding from ${price("branding", 39)}, landing page from ${price("landing", 59)}, ` +
    `fix from ${price("fix-optimize", 90)}.`;

  return pageMetadata(config, {
    locale,
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

export default async function ServicesPage({ searchParams }: LocalePageProps) {
  const { config } = await getSiteDataCached();
  const locale = await pageLocale(config, searchParams);
  const services: ReadonlyArray<ServiceLike> = config.standaloneServices;
  // Comparaisons affichées en haut de page (bandeau « pas sûr entre deux
  // options ? ») : même source de données que les pages /compare.
  const comparisons = comparisonIds
    .map((id) => getComparison(id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((item) =>
      resolveComparisonTokens(item, config.market, config.standaloneServices),
    );

  const ar = locale === "ar";
  const minUsd = lowestServicePrice(services, 19);
  const webPage = webPageJsonLd(config, {
    path: "/services",
    locale,
    name: ar
      ? "خدمات نخبة الرقمية السريعة — أسعار معلنة وتسليم سريع"
      : "Nukhba Open Digital Services — Published USD Prices",
    description: ar
      ? `خدمات رقمية حسب الطلب في طرابلس: إعادة تصميم موقع، إضافة قسم، عروض تقديمية، هوية بصرية، صفحة هبوط، وإصلاح وتحسين — بأسعار تبدأ من ${minUsd} دولاراً.`
      : `On-demand digital services in Tripoli: website restyle, new sections, pitch decks, brand identity, landing pages and site optimization — starting at $${minUsd}.`,
    speakable: ["h1", "#services-answer"],
    about: ar ? "خدمات تصميم وتطوير الويب في طرابلس، ليبيا" : "Web design and digital services in Tripoli, Libya",
  });

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(config, [
            { name: ar ? "الرئيسية" : "Home", path: "/" },
            { name: ar ? "الخدمات" : "Services", path: "/services" },
          ], locale),
          webPage,
          servicesCollectionJsonLd(config, services, locale),
          faqJsonLd(servicesHubFaqs, config.market, locale),
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
