"use client";

import Link from "next/link";
import { ArrowUpRight, Code2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSiteConfig } from "@/components/site-provider";

/** The homepage introduces both businesses; project-specific copy lives on /creation-sites. */
export function Hero() {
  const config = useSiteConfig();
  const { locale } = useI18n();
  const ar = locale === "ar";
  return (
    <section className="home-intro relative isolate overflow-hidden px-4 py-16 text-center sm:py-24">
      <div aria-hidden="true" className="home-intro-grid pointer-events-none absolute inset-0 -z-10" />
      <div className="mx-auto max-w-4xl">
        <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-bold text-white/80"><Code2 className="h-4 w-4" />{config.name} · {ar ? "خدمات ومنتجات رقمية" : "Digital services & products"}</p>
        <h1 className="text-[clamp(2rem,1.3rem+3vw,3.8rem)] font-black leading-[1.25] tracking-tight text-balance">
          {ar ? "مواقع احترافية ومنتجات رقمية،" : "Professional websites & digital products,"}{" "}
          <span className="text-[#ffc77d]">{ar ? "في مكان واحد." : "in one place."}</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-white/75">{ar ? "أنشئ موقعاً لنشاطك، أو اختر بطاقات الهدايا ومفاتيح الألعاب والبرامج وشحن الألعاب من متجرنا الرقمي." : "Build a website for your business, or explore gift cards, game and software keys, and top-ups in our digital store."}</p>
        <p className="mt-3 text-sm leading-7 text-white/60">{ar ? "مواقع وبرامج · بطاقات رقمية · شحن الألعاب" : "Websites & software · Digital gift cards · Game top-ups"}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/creation-sites" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#ffb45b] px-7 text-sm font-black text-[#231333] transition-colors hover:bg-[#ffc77d]">{ar ? "أريد إنشاء موقع" : "I need a website"}<ArrowUpRight className="h-4 w-4 rtl:rotate-[-90deg]" /></Link>
          <Link href="/codes" className="inline-flex min-h-12 items-center rounded-full border border-white/30 px-7 text-sm font-bold text-white transition-colors hover:bg-white/10">{ar ? "تصفّح المتجر الرقمي" : "Explore digital store"}</Link>
        </div>
      </div>
    </section>
  );
}
