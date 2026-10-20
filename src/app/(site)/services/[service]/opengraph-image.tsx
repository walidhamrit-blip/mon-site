import { notFound } from "next/navigation";
import { getSiteDataCached } from "@/lib/store";
import { OG_SIZE, buildServiceOgImage } from "@/lib/og-image";
import { findService, resolveServiceLanding } from "@/lib/services";

export const runtime = "nodejs";
export const alt = "خدمة رقمية سريعة من نخبة — Nukhba open service";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ service: string }>;
}) {
  const { service: serviceId } = await params;
  const { config } = await getSiteDataCached();
  const service = findService(config.standaloneServices, serviceId);
  if (!service) notFound();
  return buildServiceOgImage(service, resolveServiceLanding(service), config);
}
