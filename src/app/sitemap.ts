import type { MetadataRoute } from "next";
import { getAllKnownDemos, getSiteDataCached } from "@/lib/store";
import { blogArticles } from "@/lib/blog-articles";
import { getDemoCapturedAt, getDemoPreviewImages } from "@/lib/preview-manifest";
import { getDigitalCatalog } from "@/lib/digital-store";

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
      url: `${base}/blog`,
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
    {
      url: `${base}/badge`,
      lastModified: BUILD_DATE,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${base}/remboursement`,
      lastModified: BUILD_DATE,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${base}/conditions`,
      lastModified: BUILD_DATE,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${base}/codes`,
      lastModified: BUILD_DATE,
      changeFrequency: "weekly",
      priority: 0.8,
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

  const articleRoutes: MetadataRoute.Sitemap = blogArticles.map((article) => ({
    url: `${base}/blog/${article.slug}`,
    lastModified: new Date(article.updatedAt),
    changeFrequency: "monthly",
    priority: 0.75,
  }));

  // Images : captures locales Playwright (desktop + mobile) quand elles
  // existent — stables, rapides et servies par notre propre domaine. À défaut,
  // on retombe sur l'image externe du portfolio.
  const demoRoutes: MetadataRoute.Sitemap = getAllKnownDemos(content).map((d) => {
    const localPreviews = getDemoPreviewImages(d).map((path) => `${base}${path}`);
    const fallback = d.image && !d.image.includes("&") ? [d.image] : [];
    const images = localPreviews.length > 0 ? localPreviews : fallback;
    return {
      url: `${base}/demos/${d.slug}`,
      lastModified: getDemoCapturedAt(d) ?? BUILD_DATE,
      changeFrequency: "weekly",
      priority: 0.7,
      ...(images.length > 0 ? { images } : {}),
    };
  });

  // Catalogue digital : une entrée par fiche publiée (codes logiciels,
  // cartes cadeaux gaming, recharges).
  const digitalProducts = await getDigitalCatalog({ publicOnly: true });
  const digitalRoutes: MetadataRoute.Sitemap = digitalProducts.map((product) => ({
    url: `${base}/codes/${product.slug}`,
    lastModified: BUILD_DATE,
    changeFrequency: "weekly",
    priority: 0.75,
  }));

  return [
    ...mainRoutes,
    ...sectorRoutes,
    ...serviceRoutes,
    ...articleRoutes,
    ...demoRoutes,
    ...digitalRoutes,
  ];
}
