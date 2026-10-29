import type { MetadataRoute } from "next";
import { getAllKnownDemos, getSiteDataCached } from "@/lib/store";
import { blogArticles } from "@/lib/blog-articles";
import { getDemoCapturedAt, getDemoPreviewImages } from "@/lib/preview-manifest";
import { getDigitalCatalog } from "@/lib/digital-store";
import { comparisonIds } from "@/lib/comparisons";
import { lowestPriceUsd } from "@/lib/digital-types";

/**
 * Le sitemap est rendu **à chaque requête**, jamais pré-généré au build.
 *
 * `revalidate = 60` ne suffisait pas : le rendu initial a lieu pendant le
 * build, où `getLiveCatalog()` renvoie volontairement `null` (un build ne doit
 * pas dépendre du fournisseur). Le fichier partait donc en production avec les
 * 10 fiches « seed » ; la revalidation ISR le laissait ensuite en place tant
 * qu'aucun rendu périmé n'était demandé, et les ~390 fiches réellement en
 * vente n'étaient jamais soumises à Google. Constat de production du
 * 29/10/2026 : 62 URLs au sitemap pour 399 produits affichés sur /codes.
 *
 * Le rendu par requête aligne le sitemap sur ce que la boutique sert
 * vraiment. Le coût est négligeable : un fichier de quelques dizaines de Ko,
 * lu par les moteurs quelques fois par jour.
 */
export const dynamic = "force-dynamic";

/**
 * Sitemap — uniquement des URLs canoniques et des dates RÉELLES.
 *
 * Constat de l'audit : toutes les entrées portaient `lastModified = now`
 * (date du build ou du démarrage du serveur). Google ignore une date qui
 * change à chaque crawl ; pire, cela lui apprend à ne plus faire confiance
 * au sitemap. On ne déclare donc une date que lorsqu'elle est vérifiable
 * (date de mise à jour d'un article, date de capture d'une réalisation) et
 * on omet le champ pour les pages institutionnelles.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { config, content } = await getSiteDataCached();
  const base = config.url.replace(/\/+$/, "");

  const mainRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/codes`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/demos`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/services`, changeFrequency: "weekly", priority: 0.85 },
    { url: `${base}/pricing`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/sectors`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/blog`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/compare`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/products`, changeFrequency: "weekly", priority: 0.75 },
    { url: `${base}/apps`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/abonnements`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/contact`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/badge`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/remboursement`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/conditions`, changeFrequency: "yearly", priority: 0.3 },
  ];

  const { sectorIds } = await import("@/lib/sectors");
  const sectorRoutes: MetadataRoute.Sitemap = sectorIds.map((id) => ({
    url: `${base}/sectors/${id}`,
    changeFrequency: "weekly",
    priority: 0.75,
  }));

  const serviceRoutes: MetadataRoute.Sitemap = config.standaloneServices.map((service) => ({
    url: `${base}/services/${service.id}`,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  const articleRoutes: MetadataRoute.Sitemap = blogArticles.map((article) => ({
    url: `${base}/blog/${article.slug}`,
    lastModified: new Date(article.updatedAt),
    changeFrequency: "monthly",
    priority: 0.75,
  }));

  // Pages comparatives automatiques (/compare/[slug]) — une entrée par
  // comparaison déclarée dans src/lib/comparisons.ts.
  const comparisonRoutes: MetadataRoute.Sitemap = comparisonIds.map((id) => ({
    url: `${base}/compare/${id}`,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  // Images : captures locales Playwright (desktop + mobile) quand elles
  // existent — stables, rapides et servies par notre propre domaine. À défaut,
  // on retombe sur l'image externe du portfolio. La date de capture n'est
  // déclarée que si elle existe réellement.
  const demoRoutes: MetadataRoute.Sitemap = getAllKnownDemos(content).map((d) => {
    const localPreviews = getDemoPreviewImages(d).map((path) => `${base}${path}`);
    const fallback = d.image && !d.image.includes("&") ? [d.image] : [];
    const images = localPreviews.length > 0 ? localPreviews : fallback;
    const capturedAt = getDemoCapturedAt(d);
    return {
      url: `${base}/demos/${d.slug}`,
      ...(capturedAt ? { lastModified: capturedAt } : {}),
      changeFrequency: "weekly",
      priority: 0.7,
      ...(images.length > 0 ? { images } : {}),
    };
  });

  // Catalogue digital : une entrée par fiche publiée (codes logiciels,
  // cartes cadeaux gaming, recharges). L'image est déclarée : elle est
  // éligible à Google Images, un canal important pour ce type de produit.
  const digitalProducts = (await getDigitalCatalog({ publicOnly: true })).filter(
    // On ne soumet au crawl que les fiches qui ont un contenu transactionnel
    // réel : vendables, ou au moins dotées d'un prix. Une fiche vide
    // « bientôt disponible » reste accessible par le rayon, mais n'est pas
    // poussée dans le sitemap (budget de crawl et signal de qualité).
    (product) => product.status === "available" || lowestPriceUsd(product) != null,
  );
  const digitalRoutes: MetadataRoute.Sitemap = digitalProducts.map((product) => {
    const image = product.image
      ? product.image.startsWith("http")
        ? product.image
        : `${base}${product.image}`
      : null;
    return {
      url: `${base}/codes/${product.slug}`,
      changeFrequency: "weekly",
      priority: lowestPriceUsd(product) != null ? 0.75 : 0.5,
      ...(image ? { images: [image] } : {}),
    };
  });

  return [
    ...mainRoutes,
    ...sectorRoutes,
    ...serviceRoutes,
    ...articleRoutes,
    ...demoRoutes,
    ...digitalRoutes,
    ...comparisonRoutes,
  ];
}
