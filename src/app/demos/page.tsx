"use client";
import { useState } from "react";
import Link from "next/link";
import { demos, sectors } from "@/lib/content";
import { useI18n } from "@/lib/i18n";
import { ArrowUpRight, Search, Monitor, Smartphone } from "lucide-react";

export default function DemosPage() {
  const { locale } = useI18n();
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");

  const filtered = demos.filter((d) => {
    const matchesSector = filter === "all" || d.sector === filter;
    const matchesQ =
      !q ||
      (locale === "ar" ? d.title : d.titleEn).toLowerCase().includes(q.toLowerCase()) ||
      (locale === "ar" ? d.description : d.descriptionEn).toLowerCase().includes(q.toLowerCase());
    return matchesSector && matchesQ;
  });

  return (
    <div className="pt-[96px]">
      <section className="py-10 bg-[var(--secondary)]/30 border-b border-[var(--border)]">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div>
              <h1 className="text-[36px] lg:text-[48px] font-black tracking-tight leading-none">
                {locale === "ar" ? "كل المعارض الحية" : "All Live Demos"}
              </h1>
              <p className="mt-3 opacity-60 max-w-[56ch]">
                {locale === "ar"
                  ? "اختر قطاعك وشاهد موقعاً حقيقياً — كل معرض قابل للتخصيص الكامل على هويتك"
                  : "Pick your sector and see a real site — every demo fully customizable to your brand"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-40" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={locale === "ar" ? "ابحث عن مطعم، عيادة..." : "Search restaurant, clinic..."}
                  className="h-10 ps-9 pe-4 rounded-full border border-[var(--border)] bg-[var(--card)] text-sm w-[260px] outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {sectors.map((s) => (
              <button
                key={s.id}
                onClick={() => setFilter(s.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium border cursor-pointer ${filter === s.id ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]" : "bg-[var(--card)] border-[var(--border)] hover:bg-[var(--secondary)]"}`}
              >
                {locale === "ar" ? s.labelAr : s.labelEn}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="py-10">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((d) => (
              <Link
                key={d.slug}
                href={`/demos/${d.slug}`}
                className="group rounded-[22px] overflow-hidden bg-[var(--card)] border border-[var(--border)] hover:shadow-xl hover:border-[var(--accent)]/40 transition-all"
              >
                <div className="relative aspect-[16/11] overflow-hidden">
                  <img src={d.image} alt="" className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute top-3 start-3 flex gap-2">
                    <span className="px-2.5 py-1 rounded-full bg-white text-black text-xs font-bold">{locale === "ar" ? d.sectorAr : d.sectorEn}</span>
                  </div>
                  <div className="absolute bottom-3 start-3 end-3 flex items-center justify-between text-white">
                    <div className="flex gap-1">
                      <span className="h-7 w-7 rounded-full bg-white/20 backdrop-blur grid place-items-center"><Monitor className="h-3.5 w-3.5" /></span>
                      <span className="h-7 w-7 rounded-full bg-white/20 backdrop-blur grid place-items-center"><Smartphone className="h-3.5 w-3.5" /></span>
                    </div>
                    <span className="h-8 w-8 rounded-full bg-[var(--accent)] grid place-items-center text-black"><ArrowUpRight className="h-4 w-4" /></span>
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="font-black text-[16px]">{locale === "ar" ? d.title : d.titleEn}</h3>
                  <p className="text-sm opacity-60 mt-1 line-clamp-2">{locale === "ar" ? d.description : d.descriptionEn}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(locale === "ar" ? d.features : d.featuresEn).map((f) => (
                      <span key={f} className="px-2.5 py-1 rounded-full bg-[var(--secondary)] border border-[var(--border)] text-xs font-medium">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-16 opacity-60">
              {locale === "ar" ? "لا توجد نتائج — جرّب فلتراً آخر" : "No results — try another filter"}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
