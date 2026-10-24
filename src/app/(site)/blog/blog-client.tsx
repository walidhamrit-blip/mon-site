"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Bitcoin } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { CRYPTO_GUIDE_PATH, CRYPTO_GUIDE_SLUG } from "@/lib/blog";
import { ArticleCard } from "@/components/article-card";

export interface BlogCardLite {
  slug: string;
  categoryAr: string;
  categoryEn: string;
  titleAr: string;
  titleEn: string;
  excerptAr: string;
  excerptEn: string;
  updatedAt: string;
  readingMinutes: number;
}

const HUB_FAQS = [
  {
    qAr: "ما الذي تنشره مدونة نخبة؟",
    qEn: "What does the Nukhba blog publish?",
    aAr: "أدلة عملية بالإنجليزية والعربية لأصحاب الأعمال حول العالم — أولها دليل الدفع بـ USDT بالصور، ثم تكلفة المواقع بالدولار، اختيار الوكالة، إطلاق متجر إلكتروني، والظهور في محركات الذكاء الاصطناعي.",
    aEn: "Practical English and Arabic guides for business owners worldwide — starting with the USDT photo payment guide, then website costs in USD, choosing an agency, launching an online store, and AI search visibility.",
  },
  {
    qAr: "هل المحتوى مجاني بالكامل؟",
    qEn: "Is the content completely free?",
    aAr: "نعم، دون تسجيل أو بريد إلكتروني. الأسعار المذكورة هي أسعار نخبة المعلنة بالدولار، وتُحدَّث عند تغيّرها.",
    aEn: "Yes, with no sign-up or email required. Quoted prices are Nukhba's published USD rates and are updated when they change.",
  },
  {
    qAr: "هل يمكن إعادة نشر المقالات؟",
    qEn: "Can the articles be republished?",
    aAr: "يمكن الاقتباس مع رابط إلى الصفحة الأصلية. لا نسمح بإعادة النشر الكامل دون إذن كتابي.",
    aEn: "Quoting with a link to the original page is welcome. Full republication requires written permission.",
  },
];

/**
 * Hub des guides — rendu localisé (le serveur ne fournit que les données
 * et les métadonnées). Le guide crypto USDT est mis en premier, en grand,
 * avec sa photo de démonstration.
 */
export function BlogClient({ articles }: { articles: BlogCardLite[] }) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const featured = articles.find((a) => a.slug === CRYPTO_GUIDE_SLUG) ?? articles[0];
  const rest = articles.filter((a) => a.slug !== featured?.slug);

  return (
    <div className="pt-6">
      {/* Hero */}
      <section className="section-tight border-b border-[var(--border)] bg-[var(--secondary)]/35">
        <div className="site-container px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <Link
              href="/"
              className="px-3 py-1 rounded-full bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)]"
            >
              {ar ? "← الرئيسية" : "← Home"}
            </Link>
            <span className="px-3 py-1 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)]">
              {ar ? "مدونة نخبة · Nukhba guides" : "Nukhba guides · مدونة نخبة"}
            </span>
          </div>

          <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start lg:gap-12">
            <div>
              <h1 className="max-w-[24ch] text-[clamp(1.8rem,1.2rem+2.2vw,2.85rem)] font-black leading-[1.06] tracking-[-0.03em] text-balance">
                {ar
                  ? "أدلة عملية لأصحاب الأعمال — أينما كانوا"
                  : "Practical guides for business owners — everywhere"}
              </h1>
              <p className="mt-4 max-w-[58ch] text-[15.5px] leading-8 text-[var(--muted-foreground)]">
                {ar
                  ? "كيف تدفع بالكريبتو بأمان، ماذا تدفع فعلاً لموقعك بالدولار، وكيف تظهر في إجابات الذكاء الاصطناعي — بأرقام حقيقية وخطوات مصوّرة، لا نصائح عامة."
                  : "How to pay safely with crypto, what a website really costs in USD, and how to show up in AI answers — with real numbers and pictured steps, not generic advice."}
              </p>
            </div>

            <div
              id="blog-answer"
              className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow-xs)] lg:mt-2"
            >
              <span className="section-eyebrow">{ar ? "باختصار" : "In short"}</span>
              <p className="mt-2 text-[13.5px] leading-7 text-[var(--foreground)]/80">
                {ar
                  ? `تجمع المدونة ${articles.length} أدلة مجانية — في مقدّمتها دليل الدفع بـ USDT خطوة بخطوة وبالصور (1 دولار = 1 USDT)، ثم تكلفة المواقع من 300 $، اختيار الوكالة، وإطلاق متجر إلكتروني — كلها مبنية على أسعار ومواعيد تسليم حقيقية.`
                  : `The blog collects ${articles.length} free guides — led by the step-by-step USDT photo payment guide (1 USD = 1 USDT), then website costs from $300, choosing an agency, and launching an online store — all built on real prices and delivery times.`}
              </p>
              <Link
                href={CRYPTO_GUIDE_PATH}
                className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-full bg-[var(--primary)] px-5 text-[12.5px] font-bold text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
              >
                <Bitcoin className="h-4 w-4" />
                {ar ? "ابدأ بدليل الدفع المصوّر" : "Start with the photo payment guide"}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Guide mis en premier : paiement crypto avec photo */}
      {featured && (
        <section className="section-tight pb-0">
          <div className="site-container px-4 sm:px-6 lg:px-8">
            <Link
              href={`/blog/${featured.slug}`}
              className="group grid overflow-hidden rounded-[var(--radius-lg)] border border-[var(--accent)]/40 bg-[var(--card)] shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)] lg:grid-cols-2"
            >
              <div className="relative aspect-[16/9] lg:aspect-auto lg:min-h-[320px]">
                <Image
                  src="/guide-crypto/step-2-invoice-usdt.jpg"
                  alt={ar ? "فاتورة دفع USDT على الهاتف مع رمز QR" : "USDT payment invoice on a phone with QR code"}
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  quality={88}
                  priority
                  className="object-cover"
                />
                <span className="absolute top-3 start-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-1 text-[11px] font-black text-[var(--accent-foreground)]">
                  <Bitcoin className="h-3.5 w-3.5" />
                  {ar ? "ابدأ من هنا" : "Start here"}
                </span>
              </div>
              <div className="flex flex-col justify-center p-6 sm:p-8">
                <span className="text-[11px] font-black uppercase tracking-wider text-[var(--accent)]">
                  {ar ? featured.categoryAr : featured.categoryEn} · {featured.readingMinutes} {ar ? "دقائق · بالصور" : "min · with photos"}
                </span>
                <h2 className="mt-2 text-2xl font-black leading-snug group-hover:text-[var(--accent)] transition-colors lg:text-[28px]">
                  {ar ? featured.titleAr : featured.titleEn}
                </h2>
                <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">
                  {ar ? featured.excerptAr : featured.excerptEn}
                </p>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--accent)]">
                  {ar ? "اقرأ الدليل المصوّر" : "Read the photo guide"}
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
                </span>
              </div>
            </Link>
          </div>
        </section>
      )}

      {/* Liste des articles */}
      <section id="guides" className="section-tight scroll-mt-28">
        <div className="site-container px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between gap-4 mb-8">
            <h2 className="text-2xl lg:text-3xl font-black">
              {ar ? `كل الأدلة — ${articles.length} مقالات` : `All guides — ${articles.length} articles`}
            </h2>
            <span className="text-sm opacity-50 hidden sm:block">
              {ar ? "دليل الكريبتو أولاً" : "Crypto guide first"}
            </span>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {featured && (
              <ArticleCard
                slug={featured.slug}
                categoryAr={featured.categoryAr}
                categoryEn={featured.categoryEn}
                titleAr={featured.titleAr}
                titleEn={featured.titleEn}
                excerptAr={featured.excerptAr}
                excerptEn={featured.excerptEn}
                updatedAt={featured.updatedAt}
                readingMinutes={featured.readingMinutes}
              />
            )}
            {rest.map((article) => (
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
          <h2 className="text-2xl font-black">{ar ? "عن المدونة" : "About the blog"}</h2>
          <div className="mt-6 grid md:grid-cols-3 gap-4">
            {HUB_FAQS.map((faq) => (
              <div key={faq.qEn} className="card-surface p-6">
                <h3 className="font-bold leading-6">{ar ? faq.qAr : faq.qEn}</h3>
                <p className="mt-3 text-sm leading-6 opacity-70">{ar ? faq.aAr : faq.aEn}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Maillage */}
      <section className="py-10">
        <div className="site-container px-4 sm:px-6 lg:px-8">
          <h2 className="text-sm font-bold opacity-60">{ar ? "استكشف أيضاً" : "Explore also"}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { href: "/services", ar: "الخدمات السريعة", en: "Open services" },
              { href: "/pricing", ar: "الباقات والأسعار", en: "Plans & pricing" },
              { href: "/sectors", ar: "مواقع حسب القطاع", en: "Sites by sector" },
              { href: "/demos", ar: "معارض الأعمال الحية", en: "Live showcases" },
              { href: "/contact", ar: "تواصل معنا", en: "Contact us" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-4 py-2 rounded-full bg-[var(--card)] border border-[var(--border)] text-sm font-medium hover:border-[var(--accent)]"
              >
                {ar ? link.ar : link.en}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
