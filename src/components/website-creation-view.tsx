"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { useSiteConfig, useSiteContent } from "./site-provider";
import { marketLabels, resolveMarket } from "@/lib/market";
import { Pricing } from "./sections/pricing";
import { DemosGallery } from "./sections/demos-gallery";
import { Process } from "./sections/process";
import { CTAForm } from "./sections/cta-form";
import { FAQ } from "./sections/faq";

export function WebsiteCreationView() {
  const { locale } = useI18n();
  const { hero } = useSiteContent();
  const config = useSiteConfig();
  const ar = locale === "ar";
  const market = marketLabels(resolveMarket(config.market), locale);
  return <>
    <section className="site-container px-4 py-12 sm:px-6 lg:px-8">
      <nav aria-label={ar ? "مسار التنقل" : "Breadcrumb"} className="mb-6 text-sm text-[var(--muted-foreground)]"><Link href="/">{ar ? "الرئيسية" : "Home"}</Link> / <span aria-current="page">{ar ? "إنشاء المواقع" : "Website creation"}</span></nav>
      <p className="text-sm font-bold text-[var(--accent)]">{market.place}</p>
      <h1 className="mt-3 max-w-4xl text-4xl font-black leading-tight sm:text-5xl">{ar ? "إنشاء مواقع ومتاجر إلكترونية لنشاطك" : "Website & online store creation for your business"}</h1>
      <p className="mt-5 max-w-3xl text-base leading-8 text-[var(--muted-foreground)]">{ar ? hero.subtitleAr : hero.subtitleEn}</p>
      <nav aria-label={ar ? "خطوات مشروعك" : "Your project journey"} className="mt-7 flex flex-wrap gap-3">
        {[["#pricing", ar ? "١. العروض" : "1. Offers"], ["#demos", ar ? "٢. النماذج" : "2. Examples"], ["#website-process", ar ? "٣. الخطوات" : "3. Process"], ["#lead-form", ar ? "٤. طلب عرض" : "4. Get a quote"]].map(([href,label]) => <Link key={href} href={href} className="rounded-full border border-[var(--border)] bg-[var(--card)] px-5 py-3 text-sm font-bold hover:border-[var(--accent)]">{label}</Link>)}
      </nav>
      <div className="mt-7 flex flex-wrap gap-x-5 gap-y-3 text-sm font-bold text-[var(--accent)]">
        {[["/services", ar ? "خدمات وتعديلات حسب الطلب" : "Individual services & improvements"], ["/abonnements", ar ? "الصيانة والاشتراكات" : "Maintenance & subscriptions"], ["/sectors", ar ? "حلول حسب نشاطك" : "Solutions by industry"]].map(([href,label]) => <Link key={href} href={href} className="underline underline-offset-4">{label}</Link>)}
      </div>
    </section>
    <Pricing />
    <DemosGallery />
    <div id="website-process"><Process /></div>
    <CTAForm />
    <FAQ />
  </>;
}
