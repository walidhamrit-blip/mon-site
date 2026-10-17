"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Smartphone, Monitor, ArrowUpRight, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { sectors } from "@/lib/content";
import { useSiteContent } from "@/components/site-provider";
import Link from "next/link";

export function DemosGallery() {
  const { demos } = useSiteContent();
  const { locale, t } = useI18n();
  const [filter, setFilter] = useState("all");
  const [mode, setMode] = useState<"mobile" | "desktop">("desktop");
  const [active, setActive] = useState<string | null>(demos[0].slug);

  const filtered = filter === "all" ? demos : demos.filter((d) => d.sector === filter);
  const activeDemo = demos.find((d) => d.slug === active) || demos[0];

  return (
    <section id="demos" className="py-16 lg:py-24">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 text-sm font-semibold tracking-[0.12em] text-[var(--accent)]">
              <span className="h-px w-8 bg-[var(--accent)]" />
              {locale === "ar" ? "المعارض الحية" : "LIVE DEMOS"}
            </div>
            <h2 className="mt-3 text-[32px] lg:text-[44px] font-black tracking-tight leading-none">{t.demos.title}</h2>
            <p className="mt-3 opacity-60 max-w-[48ch]">{t.demos.subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 p-1 rounded-full bg-[var(--secondary)] border border-[var(--border)]">
              <button
                onClick={() => setMode("desktop")}
                className={`h-8 px-4 rounded-full text-sm font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${mode === "desktop" ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "hover:bg-[var(--card)]"}`}
              >
                <Monitor className="h-3.5 w-3.5" /> {locale === "ar" ? "حاسوب" : "Desktop"}
              </button>
              <button
                onClick={() => setMode("mobile")}
                className={`h-8 px-4 rounded-full text-sm font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${mode === "mobile" ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "hover:bg-[var(--card)]"}`}
              >
                <Smartphone className="h-3.5 w-3.5" /> {locale === "ar" ? "هاتف" : "Mobile"}
              </button>
            </div>
            <Link href="/demos" className="h-9 px-5 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] inline-flex items-center gap-1.5 text-sm font-bold hover:bg-[var(--accent-hover)]">
              {t.demos.all} <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          {sectors.map((s) => (
            <button
              key={s.id}
              onClick={() => setFilter(s.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors cursor-pointer ${filter === s.id ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]" : "bg-[var(--card)] border-[var(--border)] hover:bg-[var(--secondary)]"}`}
            >
              {locale === "ar" ? s.labelAr : s.labelEn}
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-[1.35fr_0.75fr] gap-6">
          {/* Preview Stage */}
          <div className="rounded-[24px] bg-[var(--card)] border border-[var(--border)] overflow-hidden p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
                <span className="ms-2 text-xs opacity-60 hidden sm:inline">{activeDemo.title}{locale === "ar" ? "" : ""} • nukhba.ly/{activeDemo.slug}</span>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] font-bold">
                {locale === "ar" ? activeDemo.sectorAr : activeDemo.sectorEn}
              </span>
            </div>

            <div className={`mx-auto bg-black rounded-[18px] p-2 sm:p-3 shadow-xl transition-all duration-500 ${mode === "mobile" ? "max-w-[340px]" : "max-w-full"}`}>
              <div className={`bg-white rounded-[14px] overflow-hidden relative ${mode === "mobile" ? "aspect-[9/16] max-h-[560px]" : "aspect-[16/10]"}`}>
                <AnimatePresence mode="wait">
                  <motion.img
                    key={activeDemo.slug + mode}
                    initial={{ opacity: 0, scale: 1.02 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
                    src={activeDemo.image}
                    alt={locale === "ar" ? activeDemo.title : activeDemo.titleEn}
                    className="w-full h-full object-cover"
                  />
                </AnimatePresence>
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-0 inset-x-0 p-4 sm:p-6 text-white">
                  <div className="inline-flex px-3 py-1 rounded-full bg-white/20 backdrop-blur text-xs font-semibold">
                    {locale === "ar" ? activeDemo.sectorAr : activeDemo.sectorEn}
                  </div>
                  <h3 className="mt-2 text-xl sm:text-2xl font-black">{locale === "ar" ? activeDemo.title : activeDemo.titleEn}</h3>
                  <p className="text-sm opacity-80 line-clamp-1">{locale === "ar" ? activeDemo.description : activeDemo.descriptionEn}</p>
                  <div className="mt-3 flex gap-2 flex-wrap">
                    {(locale === "ar" ? activeDemo.features : activeDemo.featuresEn).map((f) => (
                      <span key={f} className="px-2.5 py-1 rounded-full bg-white text-black text-xs font-bold">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
                {mode === "mobile" && <div className="absolute top-2 left-1/2 -translate-x-1/2 h-1 w-10 bg-black rounded-full" />}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm">
                <span className="font-bold">{locale === "ar" ? activeDemo.title : activeDemo.titleEn}</span>
                <span className="opacity-60"> — {locale === "ar" ? activeDemo.description : activeDemo.descriptionEn}</span>
              </div>
              <Link href={`/demos/${activeDemo.slug}`} className="hidden sm:inline-flex h-8 px-4 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] items-center gap-1 text-sm font-semibold">
                {t.demos.viewDemo} <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-2 gap-4 auto-rows-max">
            {filtered.map((d) => (
              <button
                key={d.slug}
                onClick={() => setActive(d.slug)}
                className={`group text-start rounded-[20px] overflow-hidden border-2 bg-[var(--card)] transition-all cursor-pointer ${active === d.slug ? "border-[var(--accent)] shadow-lg" : "border-[var(--border)] hover:border-[var(--accent)]/50"}`}
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img src={d.image} alt="" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <div className="absolute bottom-2 start-2 end-2 flex items-center justify-between">
                    <span className="px-2 py-1 rounded-full bg-white text-black text-[11px] font-bold">
                      {locale === "ar" ? d.sectorAr : d.sectorEn}
                    </span>
                    {active === d.slug && <span className="h-6 w-6 rounded-full bg-[var(--accent)] grid place-items-center"><Sparkles className="h-3 w-3" /></span>}
                  </div>
                </div>
                <div className="p-3">
                  <div className="text-sm font-bold leading-tight">{locale === "ar" ? d.title : d.titleEn}</div>
                  <div className="text-xs opacity-60 line-clamp-1">{locale === "ar" ? d.description : d.descriptionEn}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
