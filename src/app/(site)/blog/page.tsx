import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getSiteDataCached } from "@/lib/store";
import { breadcrumbJsonLd, faqJsonLd, pageMetadata, webPageJsonLd } from "@/lib/seo";
import { blogCollectionJsonLd, formatArticleDate, sortArticles } from "@/lib/blog";
import { blogArticles } from "@/lib/blog-articles";
import { JsonLd } from "@/components/json-ld";
import { ArticleCard } from "@/components/article-card";

const HUB_FAQS = [
  {
    qAr: "ما الذي تنشره مدونة نخبة؟",
    qEn: "What does the Nukhba blog publish?",
    aAr: "أدلة عملية بالعربية والإنجليزية لرواد الأعمال في ليبيا: تكلفة المواقع، اختيار الوكالة، إطلاق متجر إلكتروني، الظهور في محركات الذكاء الاصطناعي، ومواقع القطاعات.",
    aEn: "Practical Arabic and English guides for business owners in Libya: website costs, choosing an agency, launching an online store, AI search visibility and sector-specific sites.",
  },
  {
    qAr: "هل المحتوى مجاني بالكامل؟",
    qEn: "Is the content completely free?",
    aAr: "نعم، دون تسجيل أو بريد إلكتروني. الأسعار المذكورة هي أسعار نخبة المعلنة، وتُحدَّث عند تغيّرها.",
    aEn: "Yes, with no sign-up or email required. Quoted prices are Nukhba's published rates and are updated when they change.",
  },
  {
    qAr: "هل يمكن إعادة نشر المقالات؟",
    qEn: "Can the articles be republished?",
    aAr: "يمكن الاقتباس مع رابط إلى الصفحة الأصلية. لا نسمح بإعادة النشر الكامل دون إذن كتابي.",
    aEn: "Quoting with a link to the original page is welcome. Full republication requires written permission.",
  },
];

export async function generateMetadata(): Promise<Metadata> {
  const { config } = await getSiteDataCached();
  return pageMetadata(config, {
    path: "/blog",
    title: "مدونة نخبة — أدلة عملية لرواد الأعمال في ليبيا",
    description:
      "أدلة عملية بالعربية والإنجليزية: تكلفة تصميم موقع في ليبيا، اختيار وكالة في طرابلس، إطلاق متجر إلكتروني، والظهور في ChatGPT وGoogle AI — بأرقام واقعية.",
    keywords: [
      "مدونة تصميم مواقع ليبيا",
      "أدلة تسويق رقمي طرابلس",
      "تكلفة موقع ليبيا",
      "web design blog Libya",
      "business guides Tripoli",
    ],
  });
}

export default async function BlogPage() {
  const { config } = await getSiteDataCached();
  const articles = sortArticles(blogArticles);

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(config, [
            { name: "الرئيسية", path: "/" },
            { name: "المدونة", path: "/blog" },
          ]),
          webPageJsonLd(config, {
            path: "/blog",
            name: "مدونة نخبة — أدلة عملية لرواد الأعمال في ليبيا",
            description:
              "أدلة عملية بالعربية والإنجليزية حول تصميم المواقع، المتاجر الإلكترونية، الظهور في محركات الذكاء الاصطناعي وأسعار السوق الليبي.",
            speakable: ["h1", "#blog-answer"],
            about: "أدلة تصميم وتطوير الويب في ليبيا",
          }),
          blogCollectionJsonLd(config, articles),
          faqJsonLd(HUB_FAQS),
        ]}
      />

      <div className="pt-6">
        {/* Hero */}
        <section className="section-tight border-b border-[var(--border)] bg-[var(--secondary)]/35">
          <div className="site-container px-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
              <Link
                href="/"
                className="px-3 py-1 rounded-full bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)]"
              >
                ← الرئيسية
              </Link>
              <span className="px-3 py-1 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)]">
                مدونة نخبة · Nukhba guides
              </span>
            </div>

            <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start lg:gap-12">
              <div>
                <h1 className="max-w-[24ch] text-[clamp(1.8rem,1.2rem+2.2vw,2.85rem)] font-black leading-[1.06] tracking-[-0.03em] text-balance">
                  أدلة عملية لرواد الأعمال في ليبيا
                </h1>
                <p className="mt-4 max-w-[58ch] text-[15.5px] leading-8 text-[var(--muted-foreground)]">
                  ما تدفعه فعلاً لموقع، كيف تختار من يبنيه، وكيف يظهر بينك وبين
                  منافسك في إجابات الذكاء الاصطناعي — بأرقام من السوق الليبي، لا
                  نصائح عامة.
                </p>
                <p className="mt-2 max-w-[58ch] text-[13px] text-[var(--muted-foreground)]/75" dir="ltr">
                  Practical, number-driven guides for Libyan business owners — in
                  Arabic and English.
                </p>
              </div>

              {/* Encadré « en bref » : il servait de pavé sous le titre et
                  laissait la moitié gauche du hero vide. En colonne, il devient
                  un vrai point d'entrée (réponse courte + accès direct). */}
              <div
                id="blog-answer"
                className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow-xs)] lg:mt-2"
              >
                <span className="section-eyebrow">باختصار</span>
                <p className="mt-2 text-[13.5px] leading-7 text-[var(--foreground)]/80">
                  المدونة تجمع {articles.length} أدلة مجانية حول تكلفة المواقع في
                  ليبيا (من 300 دولار)، اختيار وكالة في طرابلس، إطلاق متجر
                  إلكتروني بالدفع عند الاستلام، والظهور في ChatGPT وPerplexity
                  وGoogle AI — وكلها مبنية على أسعار ودلائل تسليم حقيقية.
                </p>
                <Link
                  href="#guides"
                  className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-full bg-[var(--primary)] px-5 text-[12.5px] font-bold text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
                >
                  تصفّح الأدلة
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Liste des articles */}
        <section id="guides" className="section-tight scroll-mt-28">
          <div className="site-container px-4 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between gap-4 mb-8">
              <h2 className="text-2xl lg:text-3xl font-black">
                كل الأدلة — {articles.length} مقالات
              </h2>
              <span className="text-sm opacity-50 hidden sm:block">
                الأحدث أولاً · Newest first
              </span>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {articles.map((article) => (
                <ArticleCard
                  key={article.slug}
                  slug={article.slug}
                  categoryAr={article.categoryAr}
                  categoryEn={article.categoryEn}
                  titleAr={article.titleAr}
                  titleEn={article.titleEn}
                  excerptAr={article.excerptAr}
                  excerptEn={article.excerptEn}
                  updatedAt={article.updatedAt}
                  readingMinutes={article.readingMinutes}
                />
              ))}
            </div>
          </div>
        </section>

        {/* FAQ du hub */}
        <section className="section-tight border-y border-[var(--border)] bg-[var(--secondary)]/25">
          <div className="site-container px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-black">عن المدونة</h2>
            <p className="mt-1 text-sm opacity-55">About the blog</p>
            <div className="mt-6 grid md:grid-cols-3 gap-4">
              {HUB_FAQS.map((faq) => (
                <div
                  key={faq.qAr}
                  className="card-surface p-6"
                >
                  <h3 className="font-bold leading-6">{faq.qAr}</h3>
                  <p className="mt-1 text-xs opacity-45" dir="ltr">
                    {faq.qEn}
                  </p>
                  <p className="mt-3 text-sm leading-6 opacity-70">{faq.aAr}</p>
                  <p className="mt-1 text-xs leading-5 opacity-40" dir="ltr">
                    {faq.aEn}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Maillage */}
        <section className="py-10">
          <div className="site-container px-4 sm:px-6 lg:px-8">
            <h2 className="text-sm font-bold opacity-60">استكشف أيضاً</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/services" className="px-4 py-2 rounded-full bg-[var(--card)] border border-[var(--border)] text-sm font-medium hover:border-[var(--accent)]">
                الخدمات السريعة
              </Link>
              <Link href="/pricing" className="px-4 py-2 rounded-full bg-[var(--card)] border border-[var(--border)] text-sm font-medium hover:border-[var(--accent)]">
                الباقات والأسعار
              </Link>
              <Link href="/sectors" className="px-4 py-2 rounded-full bg-[var(--card)] border border-[var(--border)] text-sm font-medium hover:border-[var(--accent)]">
                مواقع حسب القطاع
              </Link>
              <Link href="/demos" className="px-4 py-2 rounded-full bg-[var(--card)] border border-[var(--border)] text-sm font-medium hover:border-[var(--accent)]">
                معارض الأعمال الحية
              </Link>
              <Link href="/contact" className="px-4 py-2 rounded-full bg-[var(--card)] border border-[var(--border)] text-sm font-medium hover:border-[var(--accent)]">
                تواصل معنا
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
