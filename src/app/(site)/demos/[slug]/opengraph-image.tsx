import { notFound } from "next/navigation";
import { getAllKnownDemos, getSiteDataCached } from "@/lib/store";
import { OG_SIZE, buildDemoOgImage } from "@/lib/og-image";

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
  const demo = getAllKnownDemos(content).find((d) => d.slug === slug);
  if (!demo) notFound();
  return buildDemoOgImage(demo, config);
}
