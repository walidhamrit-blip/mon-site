import { notFound } from "next/navigation";
import { getSiteDataCached } from "@/lib/store";
import { OG_SIZE, buildComparisonOgImage } from "@/lib/og-image";
import { getComparison } from "@/lib/comparisons";

export const runtime = "nodejs";
export const alt = "مقارنة صريحة بين نخبة والبديل — Nukhba comparison";
export const size = OG_SIZE;
export const contentType = "image/png";

/**
 * Carte Open Graph d'une page comparative : l'« annonce » en deux colonnes
 * (rouge = l'alternative, vert = نخبة), générée à partir des mêmes données
 * que la page. Une nouvelle comparaison = une nouvelle carte, sans design.
 */
export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const comparison = getComparison(slug);
  if (!comparison) notFound();
  const { config } = await getSiteDataCached();
  return buildComparisonOgImage(comparison, config);
}
