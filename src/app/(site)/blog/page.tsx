import type { Metadata } from "next";
import { getSiteDataCached } from "@/lib/store";
import {
  breadcrumbJsonLd,
  faqJsonLd,
  pageMetadata,
  siteLocale,
  webPageJsonLd,
} from "@/lib/seo";
import { blogCollectionJsonLd, CRYPTO_GUIDE_SLUG, sortArticles } from "@/lib/blog";
import { blogArticles } from "@/lib/blog-articles";
import { JsonLd } from "@/components/json-ld";
import { BlogClient } from "./blog-client";

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

export async function generateMetadata(): Promise<Metadata> {
  const { config } = await getSiteDataCached();
  // Titre et description dans la langue principale du site (arabe par défaut).
  const locale = siteLocale(config);
  return pageMetadata(config, {
    path: "/blog",
    title:
      locale === "ar"
        ? "أدلة نخبة — الدفع بـ USDT، تكلفة المواقع وخطة النمو"
        : "Nukhba Guides — Pay with USDT, Website Costs & Growth Playbooks",
    description:
      locale === "ar"
        ? "أدلة عملية بالعربية والإنجليزية: الدفع بالعملات الرقمية USDT خطوة بخطوة بالصور، تكلفة المواقع الحقيقية بالدولار، اختيار الوكالة، إطلاق متجر، والظهور في محركات الذكاء الاصطناعي."
        : "Practical guides in English and Arabic: pay with crypto (USDT) step by step with photos, real website costs in USD, choosing an agency, launching a store, and AI search visibility.",
    keywords: [
      "how to pay with USDT",
      "website cost 2026 USD",
      "crypto payment guide",
      "web design guides",
      "AI search visibility GEO",
      "دليل الدفع بالكريبتو",
      "تكلفة تصميم موقع",
      "مدونة تصميم مواقع {country}",
      "أدلة تسويق رقمي {city}",
      "تكلفة موقع {country}",
      "web design blog {countryEn}",
      "business guides {cityEn}",
    ],
  });
}

export default async function BlogPage() {
  const { config } = await getSiteDataCached();
  // Guide crypto en premier, puis le reste du plus récent au plus ancien.
  const sorted = sortArticles(blogArticles);
  const articles = [
    ...sorted.filter((a) => a.slug === CRYPTO_GUIDE_SLUG),
    ...sorted.filter((a) => a.slug !== CRYPTO_GUIDE_SLUG),
  ].map((article) => ({
    slug: article.slug,
    categoryAr: article.categoryAr,
    categoryEn: article.categoryEn,
    titleAr: article.titleAr,
    titleEn: article.titleEn,
    excerptAr: article.excerptAr,
    excerptEn: article.excerptEn,
    updatedAt: article.updatedAt,
    readingMinutes: article.readingMinutes,
  }));

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(config, [
            { name: "Home", path: "/" },
            { name: "Guides", path: "/blog" },
          ]),
          webPageJsonLd(config, {
            path: "/blog",
            name: "Nukhba Guides — Crypto Payments, Website Costs & Growth",
            description:
              "Practical English and Arabic guides: the USDT photo payment guide first, then USD website pricing, agency selection, e-commerce launch and AI search visibility.",
            speakable: ["h1", "#blog-answer"],
            about: "Website, e-commerce and crypto payment guides",
          }),
          blogCollectionJsonLd(config, blogArticles),
          faqJsonLd(HUB_FAQS),
        ]}
      />
      <BlogClient articles={articles} />
    </>
  );
}
