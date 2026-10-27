import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSiteDataCached } from "@/lib/store";
import { whatsappLink } from "@/lib/utils";
import {
  absoluteUrl,
  breadcrumbJsonLd,
  pageMetadata,
  siteLocale,
  webPageJsonLd,
} from "@/lib/seo";
import {
  findService,
  resolveServiceLanding,
  serviceFaqJsonLd,
  serviceJsonLd,
  servicePath,
} from "@/lib/services";
import { getSectorSeo, sectorIds } from "@/lib/sectors";
import { JsonLd } from "@/components/json-ld";
import { ServiceDetailView } from "@/components/service-detail-view";

export async function generateStaticParams() {
  const { config } = await getSiteDataCached();
  return config.standaloneServices.map((service) => ({ service: service.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ service: string }>;
}): Promise<Metadata> {
  const { service: serviceId } = await params;
  const { config } = await getSiteDataCached();
  const service = findService(config.standaloneServices, serviceId);
  if (!service) {
    return pageMetadata(config, {
      path: servicePath(serviceId),
      title: "خدمة غير موجودة",
      description: "هذه الخدمة غير متاحة حالياً.",
      noindex: true,
    });
  }
  const landing = resolveServiceLanding(service);
  // Métadonnées dans la langue principale du site (/admin) : une seule
  // version servie par URL, alignée sur le HTML initial.
  const locale = siteLocale(config);
  return pageMetadata(config, {
    path: servicePath(service.id),
    title: locale === "ar" ? landing.titleAr : landing.titleEn,
    description: locale === "ar" ? landing.descriptionAr : landing.descriptionEn,
    image: false, // opengraph-image.tsx génère la carte 1200×630 de la page.
    keywords: [...landing.keywordsAr, ...landing.keywordsEn, service.titleAr, service.titleEn],
  });
}

export default async function ServicePage({
  params,
}: {
  params: Promise<{ service: string }>;
}) {
  const { service: serviceId } = await params;
  const { config, content } = await getSiteDataCached();
  const service = findService(config.standaloneServices, serviceId);
  if (!service) notFound();

  const landing = resolveServiceLanding(service);
  const others = config.standaloneServices.filter((candidate) => candidate.id !== service.id);
  const relatedSectors = (landing.relatedSectors ?? [])
    .map((id) => getSectorSeo(id))
    .filter((sector): sector is NonNullable<typeof sector> => Boolean(sector))
    .map((sector) => ({
      id: sector.id,
      labelAr: sector.labelAr,
      labelEn: sector.labelEn,
    }));
  const relatedDemos = content.demos
    .filter((demo) => (landing.relatedSectors ?? []).includes(demo.sector))
    .slice(0, 3)
    .map((demo) => ({
      slug: demo.slug,
      title: demo.title,
      titleEn: demo.titleEn,
      description: demo.description,
      descriptionEn: demo.descriptionEn,
      sectorAr: demo.sectorAr,
      sectorEn: demo.sectorEn,
    }));
  const sectorLinks = sectorIds
    .map((id) => getSectorSeo(id))
    .filter((sector): sector is NonNullable<typeof sector> => Boolean(sector))
    .slice(0, 6)
    .map((sector) => ({
      id: sector.id,
      labelAr: sector.labelAr,
      labelEn: sector.labelEn,
    }));

  const whatsappUrl = whatsappLink(
    config.whatsapp,
    `مرحبا نخبة 👋 أريد طلب خدمة: ${service.titleAr} (تبدأ من ${service.priceFromUsd}$)`,
  );
  const canonical = absoluteUrl(config, servicePath(service.id));

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(config, [
            { name: "الرئيسية", path: "/" },
            { name: "الخدمات", path: "/services" },
            { name: service.titleAr, path: servicePath(service.id) },
          ]),
          webPageJsonLd(config, {
            path: servicePath(service.id),
            name: landing.titleAr,
            description: landing.answerAr,
            speakable: ["h1", "#service-answer"],
            about: `${service.titleEn} — Tripoli, Libya`,
          }),
          serviceJsonLd(config, service, landing),
          serviceFaqJsonLd(landing),
        ]}
      />

      <ServiceDetailView
        service={service}
        landing={landing}
        relatedSectors={relatedSectors}
        relatedDemos={relatedDemos}
        others={others}
        sectorLinks={sectorLinks}
        whatsappUrl={whatsappUrl}
        canonical={canonical}
      />
    </>
  );
}
