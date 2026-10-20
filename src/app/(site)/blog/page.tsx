import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, BookOpen, Calendar, Clock } from "lucide-react";
import { getSiteDataCached } from "@/lib/store";
import { breadcrumbJsonLd, faqJsonLd, pageMetadata, webPageJsonLd } from "@/lib/seo";
import { blogCollectionJsonLd, formatArticleDate, sortArticles } from "@/lib/blog";
import { blogArticles } from "@/lib/blog-articles";
import { JsonLd } from "@/components/json-ld";

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

      <div className="pt-[96px]">
        {/* Hero */}
        <section className="py-12 bg-[var(--secondary)]/30 border-b border-[var(--border)]">
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

            <h1 className="mt-6 text-[32px] lg:text-[44px] font-black tracking-tight leading-tight max-w-[24ch]">
              أدلة عملية لرواد الأعمال في ليبيا
            </h1>
            <p className="mt-3 text-lg opacity-70 max-w-[66ch] leading-relaxed">
              ما تدفعه فعلاً لموقع، كيف تختار من يبنيه، وكيف يظهر بينك وبين منافسك في
              إجابات الذكاء الاصطناعي — بأرقام من السوق الليبي، لا نصائح عامة.
            </p>
            <p className="mt-2 text-sm opacity-50 max-w-[66ch]" dir="ltr">
              Practical, number-driven guides for Libyan business owners — in Arabic
              and English.
            </p>

            <div
              id="blog-answer"
              className="mt-6 rounded-2xl bg-[var(--card)] border border-[var(--border)] p-5 max-w-[70ch]"
            >
              <p className="text-sm leading-7 opacity-80">
                <strong>باختصار:</strong> المدونة تجمع {articles.length} أدلة مجانية
                حول تكلفة المواقع في ليبيا (من 300 دولار)، اختيار وكالة في طرابلس،
                إطلاق متجر إلكتروني بالدفع عند الاستلام، والظهور في ChatGPT وPerplexity
                وGoogle AI — وكلها مبنية على أسعار ودلائل تسليم حقيقية.
              </p>
            </div>
          </div>
        </section>

        {/* Liste des articles */}
        <section className="py-12">
          <div className="site-container px-4 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between gap-4 mb-8">
              <h2 className="text-2xl lg:text-3xl font-black">
                كل الأدلة — {articles.length} مقالات
              </h2>
              <span className="text-sm opacity-50 hidden sm:block">
                الأحدث أولاً · Newest first
              </span>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {articles.map((article) => (
                <article
                  key={article.slug}
                  className="group rounded-[24px] bg-[var(--card)] border border-[var(--border)] p-6 flex flex-col hover:border-[var(--accent)]/50 hover:shadow-xl transition-all"
                >
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                    <span className="px-2.5 py-1 rounded-full bg-[var(--accent)]/12 text-[var(--accent)]">
                      {article.categoryAr}
                    </span>
                    <span className="inline-flex items-center gap-1 opacity-50">
                      <Calendar className="h-3 w-3" />
                      {formatArticleDate(article.updatedAt, "ar")}
                    </span>
                    <span className="inline-flex items-center gap-1 opacity-50">
                      <Clock className="h-3 w-3" />
                      {article.readingMinutes} د
                    </span>
                  </div>

                  <h3 className="mt-4 text-xl font-black leading-snug">
                    <Link
                      href={`/blog/${article.slug}`}
                      className="hover:text-[var(--accent)] transition-colors"
                    >
                      {article.titleAr}
                    </Link>
                  </h3>
                  <p className="mt-1 text-xs opacity-45" dir="ltr">
                    {article.titleEn}
                  </p>
                  <p className="mt-3 text-sm leading-6 opacity-70">{article.excerptAr}</p>
                  <p className="mt-1 text-xs leading-5 opacity-45" dir="ltr">
                    {article.excerptEn}
                  </p>

                  <div className="mt-auto pt-5 flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 text-xs opacity-50">
                      <BookOpen className="h-3.5 w-3.5" />
                      {article.sections.length} أقسام · {article.faqs.length} أسئلة
                    </span>
                    <Link
                      href={`/blog/${article.slug}`}
                      className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--accent)] hover:underline"
                    >
                      اقرأ الدليل
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ du hub */}
        <section className="py-12 bg-[var(--secondary)]/25 border-y border-[var(--border)]">
          <div className="site-container px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-black">عن المدونة</h2>
            <p className="mt-1 text-sm opacity-55">About the blog</p>
            <div className="mt-6 grid md:grid-cols-3 gap-4">
              {HUB_FAQS.map((faq) => (
                <div
                  key={faq.qAr}
                  className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-6"
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
