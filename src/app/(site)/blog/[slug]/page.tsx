import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSiteDataCached } from "@/lib/store";
import {
  absoluteUrl,
  breadcrumbJsonLd,
  pageMetadata,
  siteLocale,
  webPageJsonLd,
} from "@/lib/seo";
import {
  articleFaqJsonLd,
  articleJsonLd,
  articlePath,
  findArticle,
  relatedArticles,
} from "@/lib/blog";
import { blogArticles } from "@/lib/blog-articles";
import { getSectorSeo } from "@/lib/sectors";
import { resolveServiceLanding } from "@/lib/services";
import { JsonLd } from "@/components/json-ld";
import { ArticleView } from "./article-view";

export async function generateStaticParams() {
  return blogArticles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { config } = await getSiteDataCached();
  const article = findArticle(blogArticles, slug);
  if (!article) {
    return pageMetadata(config, {
      path: articlePath(slug),
      title: "Guide not found",
      description: "This guide is not available right now.",
      noindex: true,
    });
  }
  // Les métadonnées suivent la langue de référence du site : un titre
  // anglais sur un corps arabe envoie un signal contradictoire à Google et
  // dégrade le taux de clic dans la SERP arabe.
  const locale = siteLocale(config);
  return pageMetadata(config, {
    path: articlePath(article.slug),
    title: locale === "ar" ? article.titleAr : article.titleEn,
    description: locale === "ar" ? article.excerptAr : article.excerptEn,
    // opengraph-image.tsx génère une carte dédiée à l'article.
    image: false,
    keywords: [...article.keywordsAr, ...article.keywordsEn],
  });
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { config, content } = await getSiteDataCached();
  const article = findArticle(blogArticles, slug);
  if (!article) notFound();

  const locale = siteLocale(config);
  const ar = locale === "ar";
  const canonical = absoluteUrl(config, articlePath(article.slug));
  const services = (article.relatedServices ?? [])
    .map((id) => config.standaloneServices.find((service) => service.id === id) ?? null)
    .filter((service): service is NonNullable<typeof service> => Boolean(service))
    .map((service) => {
      const landing = resolveServiceLanding(service);
      return {
        id: service.id,
        titleAr: service.titleAr,
        titleEn: service.titleEn,
        priceFromUsd: service.priceFromUsd,
        deliveryAr: landing.deliveryAr,
        deliveryEn: landing.deliveryEn,
      };
    });
  const sectors = (article.relatedSectors ?? [])
    .map((id) => getSectorSeo(id))
    .filter((sector): sector is NonNullable<typeof sector> => Boolean(sector))
    .map((sector) => ({ id: sector.id, labelAr: sector.labelAr, labelEn: sector.labelEn }));
  const demos = content.demos
    .filter((demo) => (article.relatedSectors ?? []).includes(demo.sector))
    .slice(0, 3)
    .map((demo) => ({ slug: demo.slug, title: demo.title, titleEn: demo.titleEn }));
  const related = relatedArticles(blogArticles, article, 3).map((item) => ({
    slug: item.slug,
    categoryAr: item.categoryAr,
    categoryEn: item.categoryEn,
    titleAr: item.titleAr,
    titleEn: item.titleEn,
    excerptAr: item.excerptAr,
    excerptEn: item.excerptEn,
  }));
  const plans = config.pricing.plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    nameEn: plan.nameEn,
    priceUsd: plan.priceUsd,
    customizationPercent: plan.customizationPercent,
  }));

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(config, [
            { name: ar ? "الرئيسية" : "Home", path: "/" },
            { name: ar ? "الأدلة" : "Guides", path: "/blog" },
            {
              name: ar ? article.titleAr : article.titleEn,
              path: articlePath(article.slug),
            },
          ]),
          webPageJsonLd(config, {
            path: articlePath(article.slug),
            name: ar ? article.titleAr : article.titleEn,
            description: ar ? article.answerAr : article.answerEn,
            speakable: ["h1", "#article-answer"],
            about: ar ? article.categoryAr : article.categoryEn,
            dateModified: article.updatedAt,
          }),
          articleJsonLd(config, article, { locale }),
          articleFaqJsonLd(article),
        ]}
      />
      <ArticleView
        article={article}
        plans={plans}
        services={services}
        sectors={sectors}
        demos={demos}
        related={related}
        whatsapp={config.whatsapp}
        canonical={canonical}
      />
    </>
  );
}
