import type { MetadataRoute } from "next";
import { getAllKnownDemos, getSiteDataCached } from "@/lib/store";

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
      url: `${base}/apps`,
      lastModified: BUILD_DATE,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${base}/products`,
      lastModified: BUILD_DATE,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${base}/sectors`,
      lastModified: BUILD_DATE,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${base}/services`,
      lastModified: BUILD_DATE,
      changeFrequency: "weekly",
      priority: 0.85,
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

  const { sectorIds } = await import("@/lib/sectors");
  const sectorRoutes: MetadataRoute.Sitemap = sectorIds.map((id) => ({
    url: `${base}/sectors/${id}`,
    lastModified: BUILD_DATE,
    changeFrequency: "weekly",
    priority: 0.75,
  }));

  const serviceRoutes: MetadataRoute.Sitemap = config.standaloneServices.map((service) => ({
    url: `${base}/services/${service.id}`,
    lastModified: BUILD_DATE,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  const demoRoutes: MetadataRoute.Sitemap = getAllKnownDemos(content).map((d) => ({
    url: `${base}/demos/${d.slug}`,
    lastModified: BUILD_DATE,
    changeFrequency: "weekly",
    priority: 0.7,
    images: d.image && !d.image.includes("&") ? [d.image] : undefined,
  }));

  return [...mainRoutes, ...sectorRoutes, ...serviceRoutes, ...demoRoutes];
}
