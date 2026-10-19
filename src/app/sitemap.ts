import type { MetadataRoute } from "next";
import { getSiteDataCached } from "@/lib/store";

// Date stable pour l'instance du serveur (évite de faire varier le sitemap
// à chaque requête — un lastModified qui change sans raison dévalorise le signal).
const BUILD_DATE = new Date();

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { config, content } = await getSiteDataCached();
  const base = config.url.replace(/\/+$/, "");

  const mainRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: BUILD_DATE, changeFrequency: "weekly", priority: 1 },
    {
      url: `${base}/demos`,
      lastModified: BUILD_DATE,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${base}/sectors`,
      lastModified: BUILD_DATE,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${base}/pricing`,
      lastModified: BUILD_DATE,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${base}/contact`,
      lastModified: BUILD_DATE,
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];

  // Pages sectorielles automatiques — 10 secteurs (medical, restaurant…)
  const { sectorIds } = await import("@/lib/sectors");
  const sectorRoutes: MetadataRoute.Sitemap = sectorIds.map((id) => ({
    url: `${base}/sectors/${id}`,
    lastModified: BUILD_DATE,
    changeFrequency: "weekly",
    priority: 0.75,
  }));

  const demoRoutes: MetadataRoute.Sitemap = content.demos.map((d) => ({
    url: `${base}/demos/${d.slug}`,
    lastModified: BUILD_DATE,
    changeFrequency: "weekly",
    priority: 0.7,
    // Image sitemap : aide Google Images et les contextualiseurs IA à
    // découvrir les visuels des réalisations.
    images: d.image ? [d.image] : undefined,
  }));

  return [...mainRoutes, ...sectorRoutes, ...demoRoutes];
}
