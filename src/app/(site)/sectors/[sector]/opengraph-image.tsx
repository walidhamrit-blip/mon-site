import { notFound } from "next/navigation";
import { getSiteDataCached } from "@/lib/store";
import { OG_SIZE, buildSectorOgImage } from "@/lib/og-image";
import { getDemosForSector, getSectorSeo } from "@/lib/sectors";

export const runtime = "nodejs";
export const alt = "قطاع نخبة — مواقع احترافية في طرابلس، ليبيا";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ sector: string }>;
}) {
  const { sector: sectorId } = await params;
  const sector = getSectorSeo(sectorId);
  if (!sector) notFound();
  const { config, content } = await getSiteDataCached();
  return buildSectorOgImage(
    sector,
    config,
    getDemosForSector(content.demos, sector.id).length,
  );
}
