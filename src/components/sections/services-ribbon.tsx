"use client";

import { useState } from "react";
import { Pause, Play, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSiteContent } from "@/components/site-provider";

export function ServicesRibbon() {
  const { ribbon } = useSiteContent();
  const { locale } = useI18n();
  const [paused, setPaused] = useState(false);
  const ar = locale === "ar";
  const items = ribbon.items;

  return (
    <section className="services-ribbon relative overflow-hidden border-y border-[var(--accent)]/30" aria-label={ar ? "خدماتنا ومميزاتنا" : "Our services & strengths"} data-paused={paused}>
      <div className="site-container flex items-center justify-between px-4 pt-4 sm:px-6 lg:px-8">
        <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
          <Sparkles className="h-3.5 w-3.5" />
          {ar ? ribbon.taglineAr : ribbon.taglineEn}
        </p>
        <button type="button" onClick={() => setPaused(!paused)} className="ribbon-pause grid h-8 w-8 cursor-pointer place-items-center rounded-full border border-[var(--accent)]/30 text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/10" aria-label={paused ? (ar ? "تشغيل شريط الخدمات" : "Play services ribbon") : (ar ? "إيقاف شريط الخدمات" : "Pause services ribbon")}>
          {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
        </button>
      </div>
      <div className="ribbon-window overflow-hidden py-5 sm:py-6" dir="ltr">
        <div className="ribbon-track flex w-max" style={{ animationDirection: ar ? "reverse" : "normal" }}>
          {[0, 1].map((copy) => (
            <ul key={copy} aria-hidden={copy === 1 ? true : undefined} className="ribbon-group flex shrink-0 items-center" dir={ar ? "rtl" : "ltr"}>
              {items.map((service, index) => (
                <li key={`${service.en}-${index}`} className="flex shrink-0 items-center gap-7 pe-7 text-lg font-semibold sm:gap-10 sm:pe-10 sm:text-2xl">
                  <span>{ar ? service.ar : service.en}</span>
                  <span aria-hidden="true" className="text-sm text-[var(--accent)]">✦</span>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}
