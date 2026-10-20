import type { Faq } from "./site-types";

/**
 * Blog / guides éditoriaux bilingues (`/blog`, `/blog/[slug]`).
 *
 * Objectif GEO + SEO : capter les requêtes informationnelles à forte intention
 * en Libye (« كم تكلفة تصميم موقع في ليبيا », « comment choisir une agence à
 * Tripoli », « هل يظهر موقعي في ChatGPT ») et fournir aux moteurs de réponse
 * des passages courts, datés, chiffrés et citables.
 *
 * Le contenu éditorial vit dans `src/lib/blog-articles.ts` ; ce fichier expose
 * le modèle, les helpers de lecture et les générateurs de données structurées.
 */

export interface ArticleSection {
  /** Ancre stable utilisée par le sommaire. */
  id: string;
  headingAr: string;
  headingEn: string;
  paragraphsAr: string[];
  paragraphsEn: string[];
  bulletsAr?: string[];
  bulletsEn?: string[];
  /** Encadré « à retenir » affiché après la section. */
  calloutAr?: string;
  calloutEn?: string;
}

export interface ArticleKeyFact {
  labelAr: string;
  labelEn: string;
  valueAr: string;
  valueEn: string;
}

export interface BlogArticle {
  slug: string;
  /** Titre SEO (le suffixe « | نخبة Nukhba » est ajouté par le template). */
  titleAr: string;
  titleEn: string;
  /** `h1` affiché sur la page. */
  h1Ar: string;
  h1En: string;
  /** Meta description calibrée (~150-165 caractères). */
  descriptionAr: string;
  descriptionEn: string;
  /** Accroche courte affichée sur le hub /blog. */
  excerptAr: string;
  excerptEn: string;
  /** Réponse directe placée en tête d'article (answer-first, citable par un LLM). */
  answerAr: string;
  answerEn: string;
  categoryAr: string;
  categoryEn: string;
  /** Date ISO (AAAA-MM-JJ). */
  publishedAt: string;
  updatedAt: string;
  readingMinutes: number;
  authorAr: string;
  authorEn: string;
  keywordsAr: string[];
  keywordsEn: string[];
  keyFacts: ArticleKeyFact[];
  sections: ArticleSection[];
  faqs: Faq[];
  /** Affiche le tableau tarifaire synchronisé avec /admin → Réglages. */
  includePricing?: boolean;
  /** Identifiants de services à la carte à mettre en avant. */
  relatedServices?: string[];
  /** Identifiants de secteurs (/sectors/[sector]) à lier. */
  relatedSectors?: string[];
}

/** URL canonique relative d'un article. */
export function articlePath(slug: string): string {
  return `/blog/${slug}`;
}

/** Retrouve un article par slug. */
export function findArticle(
  articles: ReadonlyArray<BlogArticle>,
  slug: string,
): BlogArticle | null {
  return articles.find((article) => article.slug === slug) ?? null;
}

/** Articles triés du plus récent au plus ancien. */
export function sortArticles(articles: ReadonlyArray<BlogArticle>): BlogArticle[] {
  return [...articles].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

/** Articles liés : même catégorie ou services/secteurs partagés, sinon récents. */
export function relatedArticles(
  articles: ReadonlyArray<BlogArticle>,
  current: BlogArticle,
  limit = 3,
): BlogArticle[] {
  const scored = articles
    .filter((article) => article.slug !== current.slug)
    .map((article) => {
      let score = 0;
      if (article.categoryAr === current.categoryAr) score += 3;
      score += (article.relatedServices ?? []).filter((id) =>
        (current.relatedServices ?? []).includes(id),
      ).length;
      score += (article.relatedSectors ?? []).filter((id) =>
        (current.relatedSectors ?? []).includes(id),
      ).length;
      return { article, score };
    })
    .sort(
      (a, b) =>
        b.score - a.score || b.article.publishedAt.localeCompare(a.article.publishedAt),
    );
  return scored.slice(0, limit).map((entry) => entry.article);
}

/** Nombre de mots approximatif d'un article (AR + EN), pour `wordCount`. */
export function articleWordCount(article: BlogArticle): number {
  const parts: string[] = [
    article.titleAr,
    article.titleEn,
    article.answerAr,
    article.answerEn,
    article.descriptionAr,
    article.descriptionEn,
  ];
  for (const section of article.sections) {
    parts.push(
      section.headingAr,
      section.headingEn,
      ...section.paragraphsAr,
      ...section.paragraphsEn,
      ...(section.bulletsAr ?? []),
      ...(section.bulletsEn ?? []),
    );
  }
  for (const faq of article.faqs) {
    parts.push(faq.qAr, faq.qEn, faq.aAr, faq.aEn);
  }
  return parts.join(" ").split(/\s+/).filter(Boolean).length;
}

type SeoConfig = { url: string; name: string; nameAr: string };

/**
 * `BlogPosting` — schéma principal d'un guide. Inclut les dates (fraîcheur
 * valorisée par Google et les LLM), la section, les mots-clés et `speakable`
 * pour que la réponse directe puisse être lue / reprise telle quelle.
 */
export function articleJsonLd(
  config: SeoConfig,
  article: BlogArticle,
  options: { image?: string } = {},
) {
  const base = config.url.replace(/\/+$/, "");
  const url = `${base}${articlePath(article.slug)}`;
  const publisherId = `${base}/#organization`;
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${url}#article`,
    headline: article.titleAr,
    alternateHeadline: article.titleEn,
    name: article.h1Ar,
    description: article.descriptionAr,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    isPartOf: { "@id": `${base}/#website` },
    inLanguage: ["ar-LY", "en"],
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    articleSection: article.categoryAr,
    keywords: [...article.keywordsAr, ...article.keywordsEn].join(", "),
    wordCount: articleWordCount(article),
    timeRequired: `PT${article.readingMinutes}M`,
    author: { "@id": publisherId },
    publisher: { "@id": publisherId },
    image: options.image
      ? [options.image]
      : [`${base}/og.jpg`],
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: ["h1", "#article-answer"],
    },
    about: article.relatedSectors?.length
      ? article.relatedSectors.map((sector) => ({
          "@type": "Thing",
          name: sector,
        }))
      : [{ "@type": "Thing", name: article.categoryAr }],
  };
}

/** `FAQPage` de l'article — uniquement si les Q/R sont visibles sur la page. */
export function articleFaqJsonLd(article: BlogArticle) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: ["ar-LY", "en"],
    mainEntity: article.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.qAr,
      alternateName: faq.qEn,
      acceptedAnswer: {
        "@type": "Answer",
        text: `${faq.aAr} — ${faq.aEn}`,
      },
    })),
  };
}

/** `CollectionPage` + `ItemList` du hub /blog (ordre antéchronologique). */
export function blogCollectionJsonLd(
  config: SeoConfig,
  articles: ReadonlyArray<BlogArticle>,
) {
  const base = config.url.replace(/\/+$/, "");
  const url = `${base}/blog`;
  const sorted = sortArticles(articles);
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${url}#collection`,
    name: "مدونة نخبة — أدلة تصميم المواقع والتسويق الرقمي في ليبيا",
    description:
      "أدلة عملية بالعربية والإنجليزية لرواد الأعمال في ليبيا: تكلفة الموقع، اختيار الوكالة، المتاجر الإلكترونية، الظهور في الذكاء الاصطناعي وسرعة المواقع.",
    url,
    inLanguage: ["ar-LY", "en"],
    isPartOf: { "@id": `${base}/#website` },
    numberOfItems: sorted.length,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: sorted.length,
      itemListElement: sorted.map((article, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${base}${articlePath(article.slug)}`,
        name: article.titleAr,
        description: article.descriptionAr,
      })),
    },
  };
}

const MONTHS_AR = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

const MONTHS_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * Formate une date ISO (`AAAA-MM-JJ`) sans dépendre d'ICU : le rendu reste
 * identique entre le serveur, le build et les tests.
 */
export function formatArticleDate(iso: string, locale: "ar" | "en" = "ar"): string {
  const [year, month, day] = iso.split("-").map((part) => Number.parseInt(part, 10));
  if (!year || !month || !day) return iso;
  const months = locale === "ar" ? MONTHS_AR : MONTHS_EN;
  const monthName = months[month - 1] ?? String(month);
  return locale === "ar" ? `${day} ${monthName} ${year}` : `${day} ${monthName} ${year}`;
}
