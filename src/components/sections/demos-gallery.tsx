"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Smartphone,
  Monitor,
  ArrowUpRight,
  Sparkles,
  ExternalLink,
  Maximize2,
  RotateCw,
  Globe,
  Play,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { sectors } from "@/lib/content";
import { useSectionHeading, useSiteConfig, useSiteContent } from "@/components/site-provider";
import type { CustomSiteSection, Demo } from "@/lib/site-types";
import {
  isRealUrl,
  ScaledLiveIframe,
  FullscreenLiveViewer,
} from "@/components/live-site-frames";
import Link from "next/link";
import { ProjectPreview } from "@/components/project-preview";
import { ReservationButton } from "@/components/reservation-dialog";
import { demoImageAlt, formatLyd, lydLabel, resolveDemoClassification } from "@/lib/classification";
import { formatMainPrice, formatUsd } from "@/lib/installments";

function formatHost(url: string, fallbackSlug: string, domain: string): string {
  if (!isRealUrl(url)) return `${domain}/${fallbackSlug}`;
  try {
    const parsed = new URL(url);
    return parsed.host + (parsed.pathname !== "/" ? parsed.pathname : "");
  } catch {
    return url;
  }
}

interface InteractiveShowcaseProps {
  sectionId: string;
  badgeAr: string;
  badgeEn: string;
  title: string;
  subtitle: string;
  items: Demo[];
  showSectorFilters?: boolean;
  showAllDemosButton?: boolean;
  variant?: "interactive" | "cards";
}

function InteractiveShowcase({
  sectionId,
  badgeAr,
  badgeEn,
  title,
  subtitle,
  items,
  showSectorFilters = true,
  showAllDemosButton = true,
  variant = "interactive",
}: InteractiveShowcaseProps) {
  const siteConfig = useSiteConfig();
  const { locale, t } = useI18n();
  const [filter, setFilter] = useState("all");
  const [mode, setMode] = useState<"mobile" | "desktop">("desktop");
  const [active, setActive] = useState<string | null>(items[0]?.slug ?? null);
  const [iframeKey, setIframeKey] = useState(0);
  const [liveSlug, setLiveSlug] = useState<string | null>(null);
  const [fullscreenDemo, setFullscreenDemo] = useState<Demo | null>(null);

  if (items.length === 0) return null;

  const filtered =
    showSectorFilters && filter !== "all"
      ? items.filter((d) => d.sector === filter)
      : items;
  const activeDemo: Demo =
    filtered.find((d) => d.slug === active) ||
    items.find((d) => d.slug === active) ||
    filtered[0] ||
    items[0];
  const hasLiveUrl = isRealUrl(activeDemo?.previewUrl);

  const activeClassification = resolveDemoClassification(
    activeDemo,
    siteConfig.pricing.plans,
  );
  const depositUsd = siteConfig.reservation?.depositUsd ?? 1;

  const reloadIframe = () => {
    setLiveSlug(activeDemo.slug);
    setIframeKey((k) => k + 1);
  };

  if (variant === "cards") {
    return (
      <section id={sectionId} className="py-16 lg:py-24">
        <div className="site-container px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
            <div>
              <div className="inline-flex items-center gap-2 text-sm font-semibold tracking-[0.12em] text-[var(--accent)]">
                <span className="h-px w-8 bg-[var(--accent)]" />
                {locale === "ar" ? badgeAr : badgeEn}
              </div>
              <h2 className="mt-3 text-[32px] lg:text-[44px] font-black tracking-tight leading-none">
                {title}
              </h2>
              {subtitle && <p className="mt-3 opacity-60 max-w-[56ch]">{subtitle}</p>}
            </div>
            {showAllDemosButton && (
              <Link
                href="/demos"
                className="h-9 px-5 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] inline-flex items-center gap-1.5 text-sm font-bold hover:bg-[var(--accent-hover)] self-start lg:self-auto"
              >
                {t.demos.all} <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((d) => {
              const dIsLive = isRealUrl(d.previewUrl);
              const dClassification = resolveDemoClassification(
                d,
                siteConfig.pricing.plans,
              );
              return (
                <div
                  key={d.slug}
                  className="group rounded-[22px] overflow-hidden bg-[var(--card)] border border-[var(--border)] hover:shadow-xl hover:border-[var(--accent)]/45 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="relative aspect-[16/10] overflow-hidden">
                      <ProjectPreview demo={d} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />
                      <div className="absolute top-3 start-3 end-3 flex items-center justify-between gap-2">
                        <span className="px-2.5 py-1 rounded-full bg-white text-black text-xs font-bold truncate">
                          {locale === "ar" ? d.sectorAr : d.sectorEn}
                        </span>
                        {dIsLive && (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-500 text-white text-[11px] font-black inline-flex items-center gap-1 shadow">
                            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                            {locale === "ar" ? "موقع حقيقي حي" : "LIVE SITE"}
                          </span>
                        )}
                      </div>
                      {dClassification && (
                        <div className="absolute bottom-3 start-3 flex items-center gap-1.5">
                          <span className="px-2.5 py-1 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] text-xs font-black">
                            {locale === "ar"
                              ? `الفئة ${dClassification.tier}`
                              : `Category ${dClassification.tier}`}
                          </span>
                          {dClassification.priceUsd != null && (
                            <span
                              className="px-2.5 py-1 rounded-full bg-black/70 text-white text-xs font-bold backdrop-blur"
                              dir="ltr"
                            >
                              {formatMainPrice(
                                dClassification.priceUsd,
                                locale === "ar"
                                  ? siteConfig.pricing.currency
                                  : siteConfig.pricing.currencyEn,
                              )}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="p-5">
                      <h3 className="text-lg font-black leading-snug">
                        {locale === "ar" ? d.title : d.titleEn}
                      </h3>
                      <p className="mt-1.5 text-sm opacity-65 line-clamp-2">
                        {locale === "ar" ? d.description : d.descriptionEn}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {(locale === "ar" ? d.features : d.featuresEn)
                          .slice(0, 4)
                          .map((f) => (
                            <span
                              key={f}
                              className="px-2.5 py-1 rounded-full bg-[var(--secondary)] text-xs font-medium"
                            >
                              {f}
                            </span>
                          ))}
                      </div>
                    </div>
                  </div>

                  <div className="px-5 pb-5 pt-2 flex flex-wrap items-center gap-2 border-t border-[var(--border)]/60">
                    <ReservationButton
                      demo={d}
                      label={
                        locale === "ar"
                          ? `احجز — ${formatUsd(depositUsd)} $`
                          : `Reserve — $${formatUsd(depositUsd)}`
                      }
                      className="h-9 px-4 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] inline-flex items-center gap-1.5 text-xs font-black hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
                    />
                    {dIsLive && (
                      <button
                        type="button"
                        onClick={() => setFullscreenDemo(d)}
                        className="h-9 px-3.5 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] inline-flex items-center gap-1.5 text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer"
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                        {locale === "ar" ? "معاينة حية" : "Live View"}
                      </button>
                    )}
                    <Link
                      href={`/demos/${d.slug}`}
                      className="h-9 px-3.5 rounded-full border border-[var(--border)] bg-[var(--card)] inline-flex items-center gap-1 text-xs font-semibold hover:border-[var(--accent)] ms-auto"
                    >
                      {t.demos.viewDemo} <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {fullscreenDemo && isRealUrl(fullscreenDemo.previewUrl) && (
          <FullscreenLiveViewer
            demo={fullscreenDemo}
            initialMode={mode}
            onClose={() => setFullscreenDemo(null)}
          />
        )}
      </section>
    );
  }

  return (
    <section id={sectionId} className="py-16 lg:py-24">
      <div className="site-container px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 text-sm font-semibold tracking-[0.12em] text-[var(--accent)]">
              <span className="h-px w-8 bg-[var(--accent)]" />
              {locale === "ar" ? badgeAr : badgeEn}
            </div>
            <h2 className="mt-3 text-[32px] lg:text-[44px] font-black tracking-tight leading-none">
              {title}
            </h2>
            {subtitle && <p className="mt-3 opacity-60 max-w-[54ch]">{subtitle}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 p-1 rounded-full bg-[var(--secondary)] border border-[var(--border)]">
              <button
                type="button"
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
                type="button"
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
            {showAllDemosButton && (
              <Link
                href="/demos"
                className="h-9 px-5 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] inline-flex items-center gap-1.5 text-sm font-bold hover:bg-[var(--accent-hover)]"
              >
                {t.demos.all} <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>

        {/* Filters */}
        {showSectorFilters && (
          <div className="flex flex-wrap gap-2 mb-6">
            {sectors.map((s) => (
              <button
                key={s.id}
                type="button"
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
        )}

        <div className="grid lg:grid-cols-[1.35fr_0.75fr] gap-6 items-start">
          {/* Preview Stage */}
          <div className="rounded-[24px] bg-[var(--card)] border border-[var(--border)] overflow-hidden p-4 sm:p-6 lg:sticky lg:top-24">
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
                    {formatHost(activeDemo.previewUrl, activeDemo.slug, siteConfig.domain)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {hasLiveUrl && (
                  <>
                    <button
                      type="button"
                      onClick={reloadIframe}
                      title={locale === "ar" ? "إعادة تحميل الموقع" : "Reload website"}
                      className="h-8 w-8 rounded-full bg-[var(--secondary)] border border-[var(--border)] grid place-items-center hover:border-[var(--accent)] transition-colors cursor-pointer"
                    >
                      <RotateCw className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setFullscreenDemo(activeDemo)}
                      className="h-8 px-3.5 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] inline-flex items-center gap-1.5 text-xs font-black hover:bg-[var(--accent-hover)] transition-colors cursor-pointer shadow-sm"
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                      <span>
                        {locale === "ar"
                          ? "ملء الشاشة (حاسوب / هاتف)"
                          : "Fullscreen (Desktop / Mobile)"}
                      </span>
                    </button>
                  </>
                )}
                <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--secondary)] border border-[var(--border)] font-bold">
                  {locale === "ar" ? activeDemo.sectorAr : activeDemo.sectorEn}
                </span>
              </div>
            </div>

            {/* Device Frame */}
            <div
              dir="ltr"
              className={`mx-auto w-full bg-zinc-950 rounded-[18px] p-2 sm:p-3 shadow-xl transition-all duration-300 ${
                mode === "mobile" ? "max-w-[320px]" : "max-w-full"
              }`}
            >
              <div
                className={`w-full bg-white rounded-[12px] overflow-hidden relative ${
                  mode === "mobile" ? "aspect-[9/16]" : "aspect-[16/10]"
                }`}
              >
                {hasLiveUrl ? (
                  liveSlug === activeDemo.slug ? (
                    <ScaledLiveIframe
                      url={activeDemo.previewUrl}
                      title={locale === "ar" ? activeDemo.title : activeDemo.titleEn}
                      mode={mode}
                      reloadKey={iframeKey}
                    />
                  ) : (
                    <div className="absolute inset-0">
                      <ProjectPreview demo={activeDemo} mode={mode} />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/15">
                        <button
                          type="button"
                          onClick={() => setLiveSlug(activeDemo.slug)}
                          className="inline-flex items-center gap-2 rounded-full bg-[var(--card)] px-5 py-3 text-sm font-bold shadow-xl cursor-pointer hover:bg-[var(--secondary)]"
                        >
                          <Play className="h-4 w-4" />
                          {locale === "ar" ? "تشغيل المعاينة التفاعلية" : "Load interactive preview"}
                        </button>
                      </div>
                    </div>
                  )
                ) : (
                  <div dir={locale === "ar" ? "rtl" : "ltr"} className="w-full h-full relative">
                    <AnimatePresence mode="wait">
                      <motion.img
                        key={activeDemo.slug + mode}
                        initial={{ opacity: 0, scale: 1.02 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.4 }}
                        src={activeDemo.image}
                        alt={demoImageAlt(activeDemo, locale)}
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
                  </div>
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
                {activeClassification && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] font-black">
                      {locale === "ar"
                        ? `الفئة ${activeClassification.tier}`
                        : `Category ${activeClassification.tier}`}
                    </span>
                    <span className="opacity-70">
                      {locale === "ar"
                        ? activeClassification.name
                        : activeClassification.nameEn}
                    </span>
                    {activeClassification.priceUsd != null && (
                      <span className="font-black text-[var(--accent)]" dir="ltr">
                        {formatMainPrice(
                          activeClassification.priceUsd,
                          locale === "ar" ? siteConfig.pricing.currency : siteConfig.pricing.currencyEn,
                        )}
                      </span>
                    )}
                    <span className="opacity-50" dir="ltr">
                      {formatLyd(activeClassification.priceLyd)}{" "}
                      {lydLabel(locale)}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                <ReservationButton
                  demo={activeDemo}
                  label={
                    locale === "ar"
                      ? `احجز مكانك — ${formatUsd(depositUsd)} $`
                      : `Reserve — $${formatUsd(depositUsd)}`
                  }
                  className="h-9 px-4 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] inline-flex items-center gap-1.5 text-xs sm:text-sm font-black hover:bg-[var(--accent-hover)] transition-colors shadow-sm cursor-pointer"
                />
                {hasLiveUrl ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setFullscreenDemo(activeDemo)}
                      className="h-9 px-4 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold hover:opacity-90 transition-opacity cursor-pointer"
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                      {locale === "ar" ? "فتح بملء الشاشة (2 عرض)" : "Fullscreen (2 Views)"}
                    </button>
                    <a
                      href={activeDemo.previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-9 px-4 rounded-full border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold hover:border-[var(--accent)] transition-colors shadow-sm"
                    >
                      {locale === "ar" ? "زيارة الموقع الكامل" : "Visit Real Website"}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </>
                ) : (
                  <Link
                    href={`/demos/${activeDemo.slug}`}
                    className="h-9 px-4 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] inline-flex items-center gap-1 text-xs sm:text-sm font-semibold hover:opacity-90 transition-opacity"
                  >
                    {t.demos.viewDemo} <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-2 gap-4 auto-rows-max">
            {filtered.map((d) => {
              const dIsLive = isRealUrl(d.previewUrl);
              const dClassification = resolveDemoClassification(
                d,
                siteConfig.pricing.plans,
              );
              return (
                <button
                  key={d.slug}
                  type="button"
                  onClick={() => setActive(d.slug)}
                  className={`group text-start rounded-[20px] overflow-hidden border-2 bg-[var(--card)] transition-all cursor-pointer ${
                    activeDemo.slug === d.slug
                      ? "border-[var(--accent)] shadow-lg"
                      : "border-[var(--border)] hover:border-[var(--accent)]/50"
                  }`}
                >
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <ProjectPreview demo={d} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" />
                    {dIsLive && (
                      <div className="absolute top-2 start-2">
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-black inline-flex items-center gap-1 shadow">
                          <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                          {locale === "ar" ? "موقع حقيقي حي" : "LIVE SITE"}
                        </span>
                      </div>
                    )}
                    <div className="absolute bottom-2 start-2 end-2 flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="px-2 py-1 rounded-full bg-white text-black text-[11px] font-bold truncate">
                          {locale === "ar" ? d.sectorAr : d.sectorEn}
                        </span>
                        {dClassification && (
                          <span className="px-2 py-1 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] text-[10px] font-black whitespace-nowrap">
                            {locale === "ar"
                              ? `فئة ${dClassification.tier}`
                              : `Cat. ${dClassification.tier}`}
                          </span>
                        )}
                      </div>
                      {activeDemo.slug === d.slug && (
                        <span className="h-6 w-6 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] grid place-items-center flex-shrink-0">
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

      {fullscreenDemo && isRealUrl(fullscreenDemo.previewUrl) && (
        <FullscreenLiveViewer
          demo={fullscreenDemo}
          initialMode={mode}
          onClose={() => setFullscreenDemo(null)}
        />
      )}
    </section>
  );
}

export function DemosGallery() {
  const { demos } = useSiteContent();
  const heading = useSectionHeading("demos");
  return (
    <InteractiveShowcase
      sectionId="demos"
      badgeAr="المعارض والأعمال الحية"
      badgeEn="LIVE SHOWCASES & REAL WORK"
      title={heading.title}
      subtitle={heading.subtitle}
      items={demos}
      showSectorFilters
      showAllDemosButton
      variant="interactive"
    />
  );
}

export function CustomShowcaseSection({ section }: { section: CustomSiteSection }) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  return (
    <InteractiveShowcase
      sectionId={`section-${section.id}`}
      badgeAr={section.badgeAr || "مجموعة مختارة"}
      badgeEn={section.badgeEn || "CURATED SHOWCASE"}
      title={ar ? section.titleAr : section.titleEn}
      subtitle={ar ? section.subtitleAr : section.subtitleEn}
      items={section.sites}
      showSectorFilters={false}
      showAllDemosButton={false}
      variant={section.variant}
    />
  );
}
