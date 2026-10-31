"use client";

import Link from "next/link";
import { ArrowUpRight, Code2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSiteContent } from "@/components/site-provider";

/** Centered introduction; editable copy continues to come from the admin. */
export function Hero() {
  const { hero } = useSiteContent();
  const { locale } = useI18n();
  const ar = locale === "ar";
  return (
    <section className="home-intro relative isolate overflow-hidden px-4 py-16 text-center sm:py-24">
      <div aria-hidden="true" className="home-intro-grid pointer-events-none absolute inset-0 -z-10" />
      <div className="mx-auto max-w-4xl">
        <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-bold text-white/80"><Code2 className="h-4 w-4" />{ar ? hero.badgeAr : hero.badgeEn}</p>
        <h1 className="text-[clamp(2rem,1.3rem+3vw,3.8rem)] font-black leading-[1.25] tracking-tight text-balance">
          {ar ? hero.title1Ar : hero.title1En}{" "}
          <span className="text-[#ffc77d]">{ar ? hero.title2Ar : hero.title2En}</span>{" "}
          {ar ? hero.title3Ar : hero.title3En}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-white/75">{ar ? hero.subtitleAr : hero.subtitleEn}</p>
        <p className="mt-3 text-sm leading-7 text-white/60">{ar ? "مواقع وبرامج · بطاقات رقمية · شحن الألعاب" : "Websites & software · Digital gift cards · Game top-ups"}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/#lead-form" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#ffb45b] px-7 text-sm font-black text-[#231333] transition-colors hover:bg-[#ffc77d]">{ar ? hero.ctaPrimaryAr : hero.ctaPrimaryEn}<ArrowUpRight className="h-4 w-4 rtl:rotate-[-90deg]" /></Link>
          <Link href="/codes" className="inline-flex min-h-12 items-center rounded-full border border-white/30 px-7 text-sm font-bold text-white transition-colors hover:bg-white/10">{ar ? "تصفّح المتجر الرقمي" : "Explore digital store"}</Link>
        </div>
      </div>
    </section>
  );
}
