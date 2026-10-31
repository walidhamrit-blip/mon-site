"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import { HomeLegacyAnchors } from "../home-legacy-anchors";
import { Hero } from "./hero";
import { HomeGateway } from "./home-gateway";
import { useI18n } from "@/lib/i18n";
import { useSiteConfig } from "@/components/site-provider";
import { homeFaqs, storeCategories } from "@/lib/site-hierarchy";
import { marketLabels, resolveMarket } from "@/lib/market";

/** Short orientation page. Detailed web sections are on /creation-sites. */
export function HomeSections({ storeShowcase }: { storeShowcase?: ReactNode }) {
  const { locale } = useI18n();
  const config = useSiteConfig();
  const ar = locale === "ar";
  const place = marketLabels(resolveMarket(config.market), locale);
  return (
    <>
      <HomeLegacyAnchors />
      <Hero />
      <HomeGateway />
      <section className="gaming-store-section border-y border-[var(--border)] bg-[var(--secondary)]/30">
        <div className="site-container px-4 py-12 sm:px-6 lg:px-8">
          <p className="gaming-kicker">{ar ? "المتجر الرقمي" : "DIGITAL STORE"}</p>
          <h2 className="text-2xl font-black">{ar ? "اختر فئة من المتجر الرقمي" : "Explore the digital store"}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted-foreground)]">{ar ? "اختر حسب حاجتك. راجع المنصة والمنطقة وشروط التفعيل في صفحة كل منتج قبل الطلب." : "Shop by what you need. Check each product’s platform, region and activation requirements before ordering."}</p>
          <nav aria-label={ar ? "فئات المنتجات" : "Product categories"} className="mt-6 flex flex-wrap gap-3">
            {storeCategories.map((category) => <Link key={category.kind} href={category.kind === "all" ? "/codes" : `/codes?kind=${category.kind}`} className="rounded-full border border-[var(--border)] bg-[var(--card)] px-5 py-3 text-sm font-bold hover:border-[var(--accent)]">{ar ? category.ar : category.en}</Link>)}
          </nav>
        </div>
        {storeShowcase}
      </section>
      <section className="site-container px-4 py-14 sm:px-6 lg:px-8">
        <div className="gaming-project-panel grid gap-8 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-6 sm:p-10 md:grid-cols-2">
          <div>
            <p className="text-xs font-bold text-[var(--accent)]">{ar ? "لنشاطك التجاري" : "For your business"}</p>
            <h2 className="mt-3 text-3xl font-black">{ar ? "موقع يعرّف بك، أو متجر يبيع لك." : "A website that introduces you. A store that sells for you."}</h2>
            <p className="mt-4 text-sm leading-7 text-[var(--muted-foreground)]">{ar ? `خدمات إنشاء المواقع في ${place.place} وعن بُعد. اختر عرضاً، شاهد أمثلة ثم ناقش متطلبات مشروعك معنا.` : `Website creation in ${place.place} and remotely. Explore offers, see examples, then discuss your project requirements with us.`}</p>
          </div>
          <div className="flex flex-col justify-center gap-3">
            {[
              ["/creation-sites", ar ? "اكتشف عروض إنشاء المواقع" : "Explore website creation"],
              ["/demos", ar ? "شاهد نماذج المواقع" : "View website examples"],
              ["/pricing", ar ? "راجع الباقات والأسعار" : "Review plans & prices"],
              ["/creation-sites#lead-form", ar ? "اطلب عرض سعر لمشروعك" : "Request a project quote"],
            ].map(([href, label]) => <Link key={href} href={href} className="flex items-center justify-between gap-3 rounded-xl bg-[var(--secondary)] px-5 py-4 text-sm font-bold hover:text-[var(--accent)]">{label}<ArrowUpRight className="h-4 w-4 rtl:rotate-[-90deg]" /></Link>)}
          </div>
        </div>
      </section>
      <section className="gaming-support-section border-t border-[var(--border)] bg-[var(--secondary)]/30">
        <div className="site-container px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-black">{ar ? "كيف نساعدك؟" : "How can we help?"}</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              [ar ? "مساران واضحان" : "Two clear paths", ar ? "شراء منتج رقمي أو بدء مشروع موقع — لكل طلب خطواته الخاصة." : "Buy a digital product or start a website project, each with its own clear steps."],
              [ar ? "تفاصيل قبل الطلب" : "Details before you order", ar ? "راجع نطاق المشروع، أو منطقة المنتج وتعليمات تفعيله، قبل اتخاذ قرارك." : "Review project scope, or product region and activation details, before making your choice."],
              [ar ? "تواصل مباشر" : "Direct support", ar ? "تواصل معنا عبر صفحة الاتصال أو واتساب لأي سؤال قبل الطلب." : "Reach us through the contact page or WhatsApp with questions before ordering."],
            ].map(([title, text]) => <div key={title} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6"><CheckCircle2 className="mb-4 h-6 w-6 text-[var(--accent)]" /><h3 className="font-black">{title}</h3><p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">{text}</p></div>)}
          </div>
          <h2 className="mb-5 mt-12 text-2xl font-black">{ar ? "أسئلة قبل أن تبدأ" : "Before you start"}</h2>
          <div className="max-w-3xl space-y-3">
            {homeFaqs.map((faq) => <details key={faq.qEn} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5"><summary className="cursor-pointer font-bold">{ar ? faq.qAr : faq.qEn}</summary><p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">{ar ? faq.aAr : faq.aEn}</p></details>)}
          </div>
          <Link href="/contact" className="mt-6 inline-flex rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-bold text-[var(--accent-foreground)]">{ar ? "تحدث معنا" : "Talk to us"}</Link>
        </div>
      </section>
    </>
  );
}
