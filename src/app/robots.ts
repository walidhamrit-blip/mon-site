import type { MetadataRoute } from "next";
import { getSiteData } from "@/lib/store";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const { config } = await getSiteData();
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/admin"] },
    sitemap: `${config.url}/sitemap.xml`,
  };
}
