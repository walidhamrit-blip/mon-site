import type { MetadataRoute } from "next";
import { getSiteData } from "@/lib/store";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { config, content } = await getSiteData();
  const base = config.url;
  const routes = ["", "/demos", "/pricing", "/contact"];
  const now = new Date();

  const demoRoutes = content.demos.map((d) => ({
    url: `${base}/demos/${d.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [
    ...routes.map((r) => ({
      url: `${base}${r}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: r === "" ? 1 : 0.8,
    })),
    ...demoRoutes,
  ];
}
