import { notFound } from "next/navigation";
import { getSiteDataCached } from "@/lib/store";
import { OG_SIZE, buildArticleOgImage } from "@/lib/og-image";
import { findArticle } from "@/lib/blog";
import { blogArticles } from "@/lib/blog-articles";

export const runtime = "nodejs";
export const alt = "دليل عملي من مدونة نخبة — Nukhba guide";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = findArticle(blogArticles, slug);
  if (!article) notFound();
  const { config } = await getSiteDataCached();
  return buildArticleOgImage(article, config);
}
