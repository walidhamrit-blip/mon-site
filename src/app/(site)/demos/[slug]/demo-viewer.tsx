"use client";

import { useState } from "react";
import Link from "next/link";
import type { Demo } from "@/lib/site-types";
import { useI18n } from "@/lib/i18n";
import { useSiteConfig } from "@/components/site-provider";
import { isRealUrl, FullscreenLiveViewer } from "@/components/live-site-frames";
import {
  ArrowUpRight,
  Check,
  Smartphone,
  Monitor,
  Sparkles,
} from "lucide-react";

export function DemoViewer({ demo, allDemos }: { demo: Demo; allDemos: Demo[] }) {
  const { locale } = useI18n();
  const config = useSiteConfig();
  const hasLiveUrl = isRealUrl(demo.previewUrl);
  const [mode, setMode] = useState<"desktop" | "mobile">("desktop");

  // Si la démo possède une vraie URL (ex: https://al-manhaj-company.vercel.app/),
  // on l'ouvre directement en plein écran intégral avec le choix des 2 vues (Desktop / Mobile),
  // sans aucun arrière-plan de l'ancien site.
  if (hasLiveUrl) {
    return <FullscreenLiveViewer demo={demo} initialMode="desktop" backHref="/demos" />;
  }

  const title = locale === "ar" ? demo.title : demo.titleEn;
  const sectorLabel = locale === "ar" ? demo.sectorAr : demo.sectorEn;
  const description = locale === "ar" ? demo.description : demo.descriptionEn;
  const features = locale === "ar" ? demo.features : demo.featuresEn;
  const whatsappNumber = (config.whatsapp || "218912345678").replace(/\D/g, "");
  const otherDemos = allDemos.filter((d) => d.slug !== demo.slug).slice(0, 3);

  return (
    <div className="pt-[96px]">
      <section className="py-8">
        <div className="site-container px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link
              href="/demos"
              className="inline-flex items-center gap-1.5 text-sm font-medium opacity-70 hover:opacity-100"
            >
              {locale === "ar" ? "← الرجوع لكل المعارض" : "← Back to all demos"}
            </Link>

            <div className="flex items-center gap-1 p-1 rounded-full bg-[var(--secondary)] border border-[var(--border)]">
              <button
                type="button"
                onClick={() => setMode("desktop")}
                className={`h-8 px-4 rounded-full text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                  mode === "desktop"
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "hover:bg-[var(--card)]"
                }`}
              >
                <Monitor className="h-3.5 w-3.5" /> {locale === "ar" ? "حاسوب" : "Desktop"}
              </button>
              <button
                type="button"
                onClick={() => setMode("mobile")}
                className={`h-8 px-4 rounded-full text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                  mode === "mobile"
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "hover:bg-[var(--card)]"
                }`}
              >
                <Smartphone className="h-3.5 w-3.5" /> {locale === "ar" ? "هاتف" : "Mobile"}
              </button>
            </div>
          </div>

          <div className="mt-5 grid lg:grid-cols-[1.2fr_0.8fr] gap-8 items-start">
            <div className="rounded-[24px] overflow-hidden bg-zinc-950 p-3 shadow-2xl">
              <div
                className={`mx-auto rounded-[16px] overflow-hidden bg-white relative transition-all duration-300 ${
                  mode === "mobile" ? "max-w-[340px] aspect-[9/16]" : "w-full aspect-[16/11]"
                }`}
              >
                <img loading="lazy" decoding="async" src={demo.image} alt={title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
                <div className="absolute bottom-0 p-6 text-white">
                  <span className="px-3 py-1 rounded-full bg-[var(--accent)] text-black text-xs font-bold">
                    {sectorLabel}
                  </span>
                  <h1 className="mt-2 text-2xl sm:text-3xl font-black">{title}</h1>
                  <p className="opacity-85 text-sm mt-1">{description}</p>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 mt-3 text-white/70 text-xs">
                <Monitor className="h-4 w-4" />
                {locale === "ar"
                  ? "متجاوب 100% — موبايل وحاسوب"
                  : "100% Responsive — Mobile & Desktop"}
                <Smartphone className="h-4 w-4" />
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-[24px] bg-[var(--card)] border border-[var(--border)] p-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--accent)] text-black text-xs font-bold">
                  <Sparkles className="h-3.5 w-3.5" />
                  {locale === "ar" ? "معرض حي — قابل للتخصيص" : "Live Demo — Customizable"}
                </div>
                <h2 className="mt-3 text-2xl font-black">
                  {title} — {sectorLabel}
                </h2>
                <p className="mt-2 opacity-70 leading-7 text-sm">{description}</p>

                <ul className="mt-4 space-y-2">
                  {features.map((f) => (
                    <li key={f} className="flex gap-2 text-sm">
                      <span className="h-5 w-5 rounded-full bg-green-500 text-white grid place-items-center flex-shrink-0">
                        <Check className="h-3 w-3" />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <Link
                    href="/contact"
                    className="h-11 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] grid place-items-center font-bold text-sm hover:opacity-90"
                  >
                    {locale === "ar" ? "اطلب مثل هذا" : "Request Similar"}
                  </Link>
                  <a
                    href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
                      locale === "ar" ? `أريد معرض ${demo.title}` : `I want a site like ${demo.titleEn}`,
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-11 rounded-full bg-[#25D366] text-white grid place-items-center font-bold text-sm"
                  >
                    {locale === "ar" ? "واتساب" : "WhatsApp"}
                  </a>
                </div>
              </div>

              {otherDemos.length > 0 && (
                <div className="rounded-[24px] bg-[var(--card)] border border-[var(--border)] p-5">
                  <div className="text-xs font-bold uppercase tracking-wider opacity-60 mb-3">
                    {locale === "ar" ? "معارض أخرى" : "Other Showcases"}
                  </div>
                  <div className="space-y-2.5">
                    {otherDemos.map((item) => (
                      <Link
                        key={item.slug}
                        href={`/demos/${item.slug}`}
                        className="flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--secondary)] transition-colors"
                      >
                        <img loading="lazy" decoding="async"
                          src={item.image}
                          alt=""
                          className="h-12 w-16 rounded-lg object-cover flex-shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold truncate">
                            {locale === "ar" ? item.title : item.titleEn}
                          </div>
                          <div className="text-xs opacity-60 truncate">
                            {locale === "ar" ? item.sectorAr : item.sectorEn}
                          </div>
                        </div>
                        <ArrowUpRight className="h-4 w-4 opacity-50 flex-shrink-0" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
