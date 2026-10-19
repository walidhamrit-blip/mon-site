import type { Metadata } from "next";
import { getSiteDataCached } from "@/lib/store";
import {
  breadcrumbJsonLd,
  demoJsonLd,
  demoSeoMeta,
  pageMetadata,
} from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { notFound } from "next/navigation";
import { DemoViewer } from "./demo-viewer";

export async function generateStaticParams() {
  const { content } = await getSiteDataCached();
  return content.demos.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { config, content } = await getSiteDataCached();
  const demo = content.demos.find((d) => d.slug === slug);
  if (!demo) {
    return pageMetadata(config, {
      path: `/demos/${slug}`,
      title: "معرض غير موجود",
      description: "هذا المعرض غير متاح حالياً.",
      noindex: true,
    });
  }

  // Champs SEO personnalisés depuis l'admin (arabe par défaut) ; s'ils sont
  // vides, repli automatique sur le titre et la description du projet.
  const seo = demoSeoMeta(demo, "ar");

  return pageMetadata(config, {
    path: `/demos/${demo.slug}`,
    title: seo.title,
    description: seo.description,
    // L'image OG/Twitter est générée dynamiquement par
    // opengraph-image.tsx / twitter-image.tsx (carte brandée 1200×630).
    image: false,
    keywords: [demo.sectorAr, demo.sectorEn, "تصميم مواقع طرابلس", "نخبة"],
  });
}

export default async function DemoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { config, content } = await getSiteDataCached();
  const demo = content.demos.find((d) => d.slug === slug);
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
      <DemoViewer demo={demo} allDemos={content.demos} />
    </>
  );
}
