"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Smartphone,
  Monitor,
  ArrowUpRight,
  Sparkles,
  ExternalLink,
  Maximize2,
  Minimize2,
  RotateCw,
  Globe,
  Eye,
  Image as ImageIcon,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { sectors } from "@/lib/content";
import { useSiteContent } from "@/components/site-provider";
import type { Demo } from "@/lib/site-types";
import Link from "next/link";

function isRealUrl(url?: string): boolean {
  return Boolean(url && url !== "#" && /^https?:\/\//i.test(url.trim()));
}

function formatHost(url: string, fallbackSlug: string): string {
  if (!isRealUrl(url)) return `nukhba.ly/${fallbackSlug}`;
  try {
    const parsed = new URL(url);
    return parsed.host + (parsed.pathname !== "/" ? parsed.pathname : "");
  } catch {
    return url;
  }
}

export function DemosGallery() {
  const { demos } = useSiteContent();
  const { locale, t } = useI18n();
  const [filter, setFilter] = useState("all");
  const [mode, setMode] = useState<"mobile" | "desktop">("desktop");
  const [active, setActive] = useState<string | null>(demos[0]?.slug ?? null);
  const [previewMode, setPreviewMode] = useState<"live" | "cover">("live");
  const [iframeLoading, setIframeLoading] = useState(true);
  const [iframeKey, setIframeKey] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  const filtered = filter === "all" ? demos : demos.filter((d) => d.sector === filter);
  const activeDemo: Demo = demos.find((d) => d.slug === active) || demos[0];
  const hasLiveUrl = isRealUrl(activeDemo?.previewUrl);

  useEffect(() => {
    setIframeLoading(true);
    setPreviewMode(isRealUrl(activeDemo?.previewUrl) ? "live" : "cover");
  }, [activeDemo?.slug, activeDemo?.previewUrl]);

  if (!activeDemo) return null;

  const reloadIframe = () => {
    setIframeLoading(true);
    setIframeKey((k) => k + 1);
  };

  return (
    <section id="demos" className="py-16 lg:py-24">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 text-sm font-semibold tracking-[0.12em] text-[var(--accent)]">
              <span className="h-px w-8 bg-[var(--accent)]" />
              {locale === "ar" ? "المعارض والأعمال الحية" : "LIVE SHOWCASES & REAL WORK"}
            </div>
            <h2 className="mt-3 text-[32px] lg:text-[44px] font-black tracking-tight leading-none">
              {t.demos.title}
            </h2>
            <p className="mt-3 opacity-60 max-w-[54ch]">
              {locale === "ar"
                ? "تصفّح مواقع عملائنا الحقيقية مباشرةً من داخل المتصفح أو افتحها بالكامل لتعيش التجربة الفعلية"
                : "Browse our real client websites live inside the interactive preview or open them in full to experience our work firsthand"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 p-1 rounded-full bg-[var(--secondary)] border border-[var(--border)]">
              <button
                onClick={() => setMode("desktop")}
                className={`h-8 px-4 rounded-full text-sm font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                  mode === "desktop"
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "hover:bg-[var(--card)]"
                }`}
              >
                <Monitor className="h-3.5 w-3.5" /> {locale === "ar" ? "حاسوب" : "Desktop"}
              </button>
              <button
                onClick={() => setMode("mobile")}
                className={`h-8 px-4 rounded-full text-sm font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                  mode === "mobile"
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "hover:bg-[var(--card)]"
                }`}
              >
                <Smartphone className="h-3.5 w-3.5" /> {locale === "ar" ? "هاتف" : "Mobile"}
              </button>
            </div>
            <Link
              href="/demos"
              className="h-9 px-5 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] inline-flex items-center gap-1.5 text-sm font-bold hover:bg-[var(--accent-hover)]"
            >
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
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors cursor-pointer ${
                filter === s.id
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]"
                  : "bg-[var(--card)] border-[var(--border)] hover:bg-[var(--secondary)]"
              }`}
            >
              {locale === "ar" ? s.labelAr : s.labelEn}
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-[1.35fr_0.75fr] gap-6">
          {/* Preview Stage */}
          <div className="rounded-[24px] bg-[var(--card)] border border-[var(--border)] overflow-hidden p-4 sm:p-6 flex flex-col justify-between">
            {/* Browser Top Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400 flex-shrink-0" />
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-400 flex-shrink-0" />
                <span className="h-2.5 w-2.5 rounded-full bg-green-400 flex-shrink-0" />

                <div className="ms-2 flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--secondary)] border border-[var(--border)] text-xs min-w-0 max-w-full">
                  {hasLiveUrl ? (
                    <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold flex-shrink-0">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      {locale === "ar" ? "موقع حقيقي حي" : "LIVE SITE"}
                    </span>
                  ) : (
                    <Globe className="h-3.5 w-3.5 opacity-50 flex-shrink-0" />
                  )}
                  <span className="opacity-70 truncate" dir="ltr">
                    {formatHost(activeDemo.previewUrl, activeDemo.slug)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {hasLiveUrl && (
                  <>
                    <div className="inline-flex items-center rounded-full bg-[var(--secondary)] border border-[var(--border)] p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setPreviewMode("live")}
                        className={`px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1 transition-colors cursor-pointer ${
                          previewMode === "live"
                            ? "bg-[var(--accent)] text-black"
                            : "opacity-70 hover:opacity-100"
                        }`}
                      >
                        <Eye className="h-3 w-3" />
                        {locale === "ar" ? "تصفح تفاعلي" : "Interactive"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewMode("cover")}
                        className={`px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1 transition-colors cursor-pointer ${
                          previewMode === "cover"
                            ? "bg-[var(--accent)] text-black"
                            : "opacity-70 hover:opacity-100"
                        }`}
                      >
                        <ImageIcon className="h-3 w-3" />
                        {locale === "ar" ? "بطاقة" : "Card"}
                      </button>
                    </div>
                    {previewMode === "live" && (
                      <button
                        type="button"
                        onClick={reloadIframe}
                        title={locale === "ar" ? "إعادة تحميل الموقع" : "Reload website"}
                        className="h-7 w-7 rounded-full bg-[var(--secondary)] border border-[var(--border)] grid place-items-center hover:border-[var(--accent)] transition-colors cursor-pointer"
                      >
                        <RotateCw className={`h-3.5 w-3.5 ${iframeLoading ? "animate-spin" : ""}`} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setFullscreen(true)}
                      title={locale === "ar" ? "تكبير الشاشة" : "Fullscreen preview"}
                      className="h-7 px-2.5 rounded-full bg-[var(--secondary)] border border-[var(--border)] inline-flex items-center gap-1 text-xs font-semibold hover:border-[var(--accent)] transition-colors cursor-pointer"
                    >
                      <Maximize2 className="h-3 w-3" />
                      <span className="hidden sm:inline">
                        {locale === "ar" ? "ملء الشاشة" : "Fullscreen"}
                      </span>
                    </button>
                  </>
                )}
                <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] font-bold">
                  {locale === "ar" ? activeDemo.sectorAr : activeDemo.sectorEn}
                </span>
              </div>
            </div>

            {/* Device Frame */}
            <div
              className={`mx-auto w-full bg-black rounded-[18px] p-2 sm:p-3 shadow-xl transition-all duration-500 ${
                mode === "mobile" ? "max-w-[360px]" : "max-w-full"
              }`}
            >
              <div
                className={`bg-white rounded-[14px] overflow-hidden relative ${
                  mode === "mobile" ? "aspect-[9/16] max-h-[580px]" : "aspect-[16/10] min-h-[360px] sm:min-h-[460px]"
                }`}
              >
                {hasLiveUrl && previewMode === "live" ? (
                  <>
                    {iframeLoading && (
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-zinc-950/90 text-white p-6 text-center">
                        <img
                          src={activeDemo.image}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover opacity-25 blur-sm"
                        />
                        <div className="relative z-10 flex flex-col items-center">
                          <div className="h-10 w-10 rounded-full border-3 border-[var(--accent)] border-t-transparent animate-spin mb-3" />
                          <div className="text-sm font-bold">
                            {locale === "ar"
                              ? `جارٍ فتح الموقع الحقيقي: ${activeDemo.title}...`
                              : `Loading live website: ${activeDemo.titleEn}...`}
                          </div>
                          <div className="text-xs opacity-70 mt-1" dir="ltr">
                            {activeDemo.previewUrl}
                          </div>
                        </div>
                      </div>
                    )}
                    <iframe
                      key={`${activeDemo.slug}-${iframeKey}`}
                      src={activeDemo.previewUrl}
                      title={locale === "ar" ? activeDemo.title : activeDemo.titleEn}
                      className="w-full h-full border-0 bg-white"
                      loading="eager"
                      onLoad={() => setIframeLoading(false)}
                      allow="clipboard-write; fullscreen"
                    />
                  </>
                ) : (
                  <>
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
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                    <div className="absolute bottom-0 inset-x-0 p-4 sm:p-6 text-white">
                      <div className="inline-flex px-3 py-1 rounded-full bg-white/20 backdrop-blur text-xs font-semibold">
                        {locale === "ar" ? activeDemo.sectorAr : activeDemo.sectorEn}
                      </div>
                      <h3 className="mt-2 text-xl sm:text-2xl font-black">
                        {locale === "ar" ? activeDemo.title : activeDemo.titleEn}
                      </h3>
                      <p className="text-sm opacity-85 line-clamp-2">
                        {locale === "ar" ? activeDemo.description : activeDemo.descriptionEn}
                      </p>
                      <div className="mt-3 flex gap-2 flex-wrap">
                        {(locale === "ar" ? activeDemo.features : activeDemo.featuresEn).map((f) => (
                          <span
                            key={f}
                            className="px-2.5 py-1 rounded-full bg-white text-black text-xs font-bold"
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                {mode === "mobile" && (
                  <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 h-1 w-10 bg-black/50 rounded-full z-20" />
                )}
              </div>
            </div>

            {/* Stage Footer Actions */}
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-sm min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold">
                    {locale === "ar" ? activeDemo.title : activeDemo.titleEn}
                  </span>
                  {hasLiveUrl && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold">
                      {locale === "ar" ? "✓ تصفح حقيقي مباشر" : "✓ Real Interactive Site"}
                    </span>
                  )}
                </div>
                <p className="opacity-60 text-xs sm:text-sm line-clamp-1 mt-0.5">
                  {locale === "ar" ? activeDemo.description : activeDemo.descriptionEn}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                {hasLiveUrl && (
                  <a
                    href={activeDemo.previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-9 px-4 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] inline-flex items-center gap-1.5 text-xs sm:text-sm font-black hover:bg-[var(--accent-hover)] transition-colors shadow-sm"
                  >
                    {locale === "ar" ? "زيارة الموقع الكامل" : "Visit Real Website"}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                <Link
                  href={`/demos/${activeDemo.slug}`}
                  className="h-9 px-4 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] inline-flex items-center gap-1 text-xs sm:text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  {locale === "ar" ? "تفاصيل المشروع" : t.demos.viewDemo}
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-2 gap-4 auto-rows-max">
            {filtered.map((d) => {
              const dIsLive = isRealUrl(d.previewUrl);
              return (
                <button
                  key={d.slug}
                  onClick={() => setActive(d.slug)}
                  className={`group text-start rounded-[20px] overflow-hidden border-2 bg-[var(--card)] transition-all cursor-pointer ${
                    active === d.slug
                      ? "border-[var(--accent)] shadow-lg"
                      : "border-[var(--border)] hover:border-[var(--accent)]/50"
                  }`}
                >
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <img
                      src={d.image}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" />
                    {dIsLive && (
                      <div className="absolute top-2 start-2">
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-black inline-flex items-center gap-1 shadow">
                          <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                          {locale === "ar" ? "موقع حقيقي حي" : "LIVE SITE"}
                        </span>
                      </div>
                    )}
                    <div className="absolute bottom-2 start-2 end-2 flex items-center justify-between">
                      <span className="px-2 py-1 rounded-full bg-white text-black text-[11px] font-bold">
                        {locale === "ar" ? d.sectorAr : d.sectorEn}
                      </span>
                      {active === d.slug && (
                        <span className="h-6 w-6 rounded-full bg-[var(--accent)] text-black grid place-items-center">
                          <Sparkles className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="text-sm font-bold leading-tight">
                      {locale === "ar" ? d.title : d.titleEn}
                    </div>
                    <div className="text-xs opacity-60 line-clamp-1 mt-0.5">
                      {locale === "ar" ? d.description : d.descriptionEn}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Fullscreen Live Browser Modal */}
      {fullscreen && hasLiveUrl && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
          <div className="h-14 px-4 border-b border-white/10 flex items-center justify-between gap-3 bg-zinc-950 text-white">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setFullscreen(false)}
                className="h-9 px-3.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Minimize2 className="h-3.5 w-3.5" />
                {locale === "ar" ? "إغلاق ملء الشاشة" : "Exit Fullscreen"}
              </button>
              <span className="font-bold text-sm truncate hidden sm:inline">
                {locale === "ar" ? activeDemo.title : activeDemo.titleEn}
              </span>
              <span
                className="text-xs px-3 py-1 rounded-full bg-white/5 border border-white/10 text-zinc-400 truncate hidden md:inline"
                dir="ltr"
              >
                {activeDemo.previewUrl}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1 p-1 rounded-full bg-white/5 border border-white/10">
                <button
                  type="button"
                  onClick={() => setMode("desktop")}
                  className={`h-7 px-3 rounded-full text-xs font-semibold flex items-center gap-1 cursor-pointer ${
                    mode === "desktop" ? "bg-[var(--accent)] text-black" : "text-zinc-300"
                  }`}
                >
                  <Monitor className="h-3.5 w-3.5" /> {locale === "ar" ? "حاسوب" : "Desktop"}
                </button>
                <button
                  type="button"
                  onClick={() => setMode("mobile")}
                  className={`h-7 px-3 rounded-full text-xs font-semibold flex items-center gap-1 cursor-pointer ${
                    mode === "mobile" ? "bg-[var(--accent)] text-black" : "text-zinc-300"
                  }`}
                >
                  <Smartphone className="h-3.5 w-3.5" /> {locale === "ar" ? "هاتف" : "Mobile"}
                </button>
              </div>

              <a
                href={activeDemo.previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="h-9 px-4 rounded-full bg-[var(--accent)] text-black text-xs font-black inline-flex items-center gap-1.5 hover:opacity-90"
              >
                {locale === "ar" ? "فتح في نافذة جديدة" : "Open in New Tab"}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center p-0 sm:p-4 overflow-hidden">
            <div
              className={`bg-white h-full overflow-hidden shadow-2xl transition-all duration-300 ${
                mode === "mobile"
                  ? "w-[390px] max-w-full rounded-[24px] border-4 border-zinc-800"
                  : "w-full rounded-none sm:rounded-[16px]"
              }`}
            >
              <iframe
                src={activeDemo.previewUrl}
                title={locale === "ar" ? activeDemo.title : activeDemo.titleEn}
                className="w-full h-full border-0 bg-white"
                allow="clipboard-write; fullscreen"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
