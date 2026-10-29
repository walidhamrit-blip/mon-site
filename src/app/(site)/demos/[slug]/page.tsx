import type { Metadata } from "next";
import { getAllKnownDemos, getSiteDataCached } from "@/lib/store";
import {
  breadcrumbJsonLd,
  demoJsonLd,
  demoSeoMeta,
  pageMetadata,
  siteLocale,
} from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { notFound } from "next/navigation";
import { DemoViewer } from "./demo-viewer";
import { DemoDetails } from "./demo-details";

export async function generateStaticParams() {
  const { content } = await getSiteDataCached();
  return getAllKnownDemos(content).map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { config, content } = await getSiteDataCached();
  const allDemos = getAllKnownDemos(content);
  const demo = allDemos.find((d) => d.slug === slug);
  if (!demo) {
    return pageMetadata(config, {
      path: `/demos/${slug}`,
      title: "معرض غير موجود",
      description: "هذا المعرض غير متاح حالياً.",
      noindex: true,
    });
  }

  const locale = siteLocale(config);
  const seo = demoSeoMeta(demo, locale);

  return pageMetadata(config, {
    path: `/demos/${demo.slug}`,
    title: seo.title,
    description: seo.description,
    image: false,
    keywords:
      locale === "ar"
        ? [demo.sectorAr, demo.sectorEn, "تصميم مواقع {city}", "نخبة"]
        : [demo.sectorEn, demo.sectorAr, "web design {cityEn}", "Nukhba"],
  });
}

export default async function DemoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { config, content } = await getSiteDataCached();
  const allDemos = getAllKnownDemos(content);
  const demo = allDemos.find((d) => d.slug === slug);
  if (!demo) notFound();

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(config, [
            { name: "الرئيسية", path: "/" },
            { name: "المعارض", path: "/demos" },
            { name: demo.title, path: `/demos/${demo.slug}` },
          ]),
          demoJsonLd(config, demo),
        ]}
      />
      <DemoViewer demo={demo} allDemos={allDemos} />
      {/* Contenu éditorial visible (contexte secteur + formule) : la
          visionneuse plein écran seule laissait la fiche quasi vide
          pour les moteurs (article sr-only uniquement). */}
      <DemoDetails demo={demo} config={config} />
    </>
  );
}
