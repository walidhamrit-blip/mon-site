"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, ExternalLink, Pause, Play } from "lucide-react";
import { useSiteConfig, useSiteContent } from "@/components/site-provider";
import { isRealUrl } from "@/components/live-site-frames";
import { ProjectPreview } from "@/components/project-preview";
import { getProjectPreview } from "@/lib/project-previews";
import { formatLyd, lydLabel, resolveDemoClassification } from "@/lib/classification";
import { formatMainPrice } from "@/lib/installments";
import { useI18n } from "@/lib/i18n";

const SLIDE_DURATION = 8000;

/** Synchronized lightweight previews. Live websites only open on request. */
export function HeroShowcase() {
  const { demos } = useSiteContent();
  const config = useSiteConfig();
  const { locale } = useI18n();
  const ar = locale === "ar";
  const projects = demos.filter((demo) => isRealUrl(demo.previewUrl));
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const reducedMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.2 });
  const currentIndex = index % Math.max(projects.length, 1);
  const project = projects[currentIndex];
  const playing = !paused && !hovered && !focused && !reducedMotion && inView && pageVisible;

  useEffect(() => {
    const update = () => setPageVisible(!document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  useEffect(() => {
    if (!playing || projects.length < 2) return;
    const timer = window.setInterval(() => {
      setIndex((previous) => (previous + 1) % projects.length);
    }, SLIDE_DURATION);
    return () => window.clearInterval(timer);
  }, [playing, projects.length, currentIndex]);

  const nextProject = projects[(currentIndex + 1) % Math.max(projects.length, 1)];
  const nextDesktop = nextProject ? getProjectPreview(nextProject, "desktop").src : "";
  const nextMobile = nextProject ? getProjectPreview(nextProject, "mobile").src : "";

  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (!playing || projects.length < 2 || connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || "")) return;
    // Only the NEXT pair is warmed, after the visible images get a head start.
    const timer = window.setTimeout(() => {
      for (const src of new Set([nextDesktop, nextMobile])) {
        if (!src) continue;
        const image = new window.Image();
        image.fetchPriority = "low";
        image.decoding = "async";
        image.src = src;
      }
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [playing, projects.length, nextDesktop, nextMobile]);

  if (!project) return null;
  const title = ar ? project.title : project.titleEn;
  const classification = resolveDemoClassification(project, config.pricing.plans);
  const step = (direction: number) => {
    setPaused(true);
    setIndex((currentIndex + direction + projects.length) % projects.length);
  };
  const select = (next: number) => {
    setPaused(true);
    setIndex(next);
  };

  return (
    <div
      ref={ref}
      role="region"
      aria-roledescription={ar ? "عرض شرائح" : "carousel"}
      aria-label={ar ? "مواقعنا الحقيقية على الحاسوب والهاتف" : "Our real websites on desktop and mobile"}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
      className="hero-showcase relative mx-auto w-full max-w-[900px]"
    >
      <div className="pointer-events-none absolute inset-[8%] -z-10 rounded-full bg-[var(--accent)]/20 blur-[60px]" />
      <div className="relative pb-[17%]" dir="ltr" aria-hidden="true" inert>
        {/* Static preview: no third-party scripts or iframe downloads. */}
        <div className="relative w-[94%] pt-3">
          <div className="overflow-hidden rounded-[14px] border border-white/15 bg-[#202024] p-[5px] shadow-[0_24px_70px_-18px_rgba(0,0,0,0.35)] sm:rounded-[20px] sm:p-2">
            <div className="flex h-7 items-center gap-1.5 px-2 sm:h-9 sm:px-3">
              <span className="h-2 w-2 rounded-full bg-[#ec7771]" />
              <span className="h-2 w-2 rounded-full bg-[#e8bf64]" />
              <span className="h-2 w-2 rounded-full bg-[#7ebda1]" />
              <div className="mx-3 flex h-5 min-w-0 flex-1 items-center justify-center rounded-md bg-white/5 px-2 text-[9px] text-white/60 sm:text-[11px]">
                <span className="truncate">{project.previewUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
              </div>
            </div>
            <div className="relative aspect-[16/10] overflow-hidden rounded-[8px] bg-white">
              <motion.div
                key={project.slug}
                initial={reducedMotion ? false : { opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.65, ease: "easeOut" }}
                className="absolute inset-0 pointer-events-none"
              >
                <ProjectPreview demo={project} mode="desktop" priority={currentIndex === 0} label />
              </motion.div>
            </div>
          </div>
          <div className="mx-auto h-4 w-[22%] bg-gradient-to-b from-[#757579] to-[#b6b4b0] sm:h-6" />
          <div className="mx-auto h-1.5 w-[40%] rounded-t-[50%] bg-gradient-to-b from-[#d3d0c9] to-[#999792] shadow-lg sm:h-2" />
        </div>

        {/* Larger phone, visible even on small screens. */}
        <div className="absolute bottom-0 right-0 w-[34%] max-w-[270px] rotate-[3deg] rounded-[24px] border border-white/25 bg-[#19191c] p-[5px] shadow-[0_20px_45px_-10px_rgba(0,0,0,0.45)] sm:rounded-[34px] sm:p-[7px]">
          <div className="relative overflow-hidden rounded-[19px] bg-white pt-3 sm:rounded-[27px] sm:pt-4">
            <span className="absolute left-1/2 top-1 z-10 h-1.5 w-[28%] -translate-x-1/2 rounded-full bg-[#19191c] sm:h-2" />
            <div className="relative aspect-[390/693] overflow-hidden">
              <motion.div
                key={project.slug}
                initial={reducedMotion ? false : { opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.65, delay: 0.1 }}
                className="absolute inset-0 pointer-events-none"
              >
                <ProjectPreview demo={project} mode="mobile" priority={currentIndex === 0} label />
              </motion.div>
            </div>
            <div className="flex h-3 items-center justify-center bg-white sm:h-4">
              <span className="h-1 w-[30%] rounded-full bg-[#19191c]" />
            </div>
          </div>
        </div>

        <div className="absolute bottom-[4%] left-1 flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-[10px] font-semibold shadow-sm sm:px-4 sm:text-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {ar ? "حاسوب + هاتف · تصميم متجاوب" : "Desktop + mobile · Responsive"}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
        <div className="min-w-0" aria-live={playing ? "off" : "polite"} aria-atomic="true">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">{ar ? project.sectorAr : project.sectorEn}</p>
          <p className="truncate text-sm font-bold sm:text-base">{title}</p>
          {classification && (
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--muted-foreground)]">
              <span className="font-bold text-[var(--accent)]">
                {ar ? `الفئة ${classification.tier}` : `Category ${classification.tier}`}
              </span>
              <span>{ar ? classification.name : classification.nameEn}</span>
              {classification.priceUsd != null && (
                <span className="font-black text-[var(--foreground)]" dir="ltr">
                  {formatMainPrice(
                    classification.priceUsd,
                    ar ? config.pricing.currency : config.pricing.currencyEn,
                  )}
                </span>
              )}
              <span dir="ltr">
                {formatLyd(classification.priceLyd)}{" "}
                {lydLabel(ar ? "ar" : "en")}
              </span>
            </p>
          )}
        </div>
        <a href={project.previewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-xs font-bold transition-colors hover:border-[var(--accent)]">
          {ar ? "زيارة الموقع" : "Visit site"}<ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {projects.length > 1 && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 font-mono text-[11px] font-bold text-[var(--accent)]" dir="ltr">
              {String(currentIndex + 1).padStart(2, "0")} / {String(projects.length).padStart(2, "0")}
            </span>
            <div className="scroll-x items-center gap-0.5" aria-label={ar ? "اختيار الموقع" : "Choose a website"}>
            {projects.map((demo, i) => (
              <button key={demo.slug} type="button" onClick={() => select(i)} aria-label={ar ? demo.title : demo.titleEn} aria-current={currentIndex === i ? "true" : undefined} className="group grid h-8 w-5 shrink-0 cursor-pointer place-items-center rounded-full">
                <span className={`h-1.5 rounded-full transition-all ${currentIndex === i ? "w-5 bg-[var(--accent)]" : "w-1.5 bg-[var(--muted-foreground)]/35 group-hover:bg-[var(--accent)]"}`} />
              </button>
            ))}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1" dir="ltr">
            <button type="button" onClick={() => step(-1)} aria-label={ar ? "الموقع السابق" : "Previous website"} className="showcase-control"><ArrowLeft className="h-4 w-4" /></button>
            {!reducedMotion && <button type="button" onClick={() => setPaused(!paused)} aria-label={paused ? (ar ? "تشغيل العرض" : "Play slideshow") : (ar ? "إيقاف العرض مؤقتاً" : "Pause slideshow")} className="showcase-control">{paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}</button>}
            <button type="button" onClick={() => step(1)} aria-label={ar ? "الموقع التالي" : "Next website"} className="showcase-control"><ArrowRight className="h-4 w-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
}
