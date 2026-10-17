import type { MetadataRoute } from "next";
import { demos } from "@/lib/content";
import { siteConfig } from "@/lib/config";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.url;
  const routes = ["", "/demos", "/pricing", "/contact"];
  const now = new Date();

  const demoRoutes = demos.map((d) => ({
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
