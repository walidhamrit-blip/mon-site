import { notFound } from "next/navigation";
import { getSiteDataCached } from "@/lib/store";
import { OG_SIZE, buildDemoOgImage } from "@/lib/og-image";

// Image Open Graph générée dynamiquement par fiche réalisation (1200×630),
// mise en cache statiquement au build via les slugs de generateStaticParams.
export const runtime = "nodejs";
export const alt = "معرض موقع حي من إنجاز وكالة نخبة — Nukhba live demo";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { config, content } = await getSiteDataCached();
  const demo = content.demos.find((d) => d.slug === slug);
  if (!demo) notFound();
  return buildDemoOgImage(demo, config);
}
