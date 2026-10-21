"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ProjectPreview } from "@/components/project-preview";
import { useInView, useReducedMotion } from "framer-motion";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Maximize2,
  Moon,
  Palette,
  Pause,
  Play,
  Sliders,
  Sun,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSectionHeading, useSiteContent } from "@/components/site-provider";
import { useTheme } from "@/components/theme-provider";
import { ThemePreview } from "@/components/theme-switcher";
import { THEMES } from "@/lib/themes";
import { FullscreenLiveViewer } from "@/components/live-site-frames";
import { demos as fallbackDemos } from "@/lib/content";
import type { Demo } from "@/lib/site-types";

// Studio d'identité compact en largeur contenue (max-w-4xl) :
//   1. bloc « Personnalisation » côte à côte avec un aperçu compact (sans iframe
//      capturant le défilement, afin de préserver un scroll fluide partout) ;
//   2. grille compacte des 8 thèmes prêts à l'emploi (boutons réduits, clair + sombre).

const accents = [
  { name: "ذهبي", nameEn: "Gold", hex: "#C6A664" },
  { name: "أزرق ملكي", nameEn: "Royal blue", hex: "#1E3A8A" },
  { name: "زمردي", nameEn: "Emerald", hex: "#0F766E" },
  { name: "خمري", nameEn: "Wine", hex: "#8B2C2C" },
  { name: "فحمي", nameEn: "Charcoal", hex: "#1A1A1E" },
];

const fonts = [
  { id: "cairo", label: "Cairo", family: "Cairo, system-ui" },
  { id: "plex", label: "IBM Plex", family: "'IBM Plex Sans Arabic', system-ui" },
  { id: "tajawal", label: "Tajawal", family: "Tajawal, system-ui" },
];

const styles = [
  { id: "soft", labelAr: "ناعم", labelEn: "Soft" },
  { id: "sharp", labelAr: "حازم", labelEn: "Sharp" },
  { id: "playful", labelAr: "مرح", labelEn: "Playful" },
];

const BANNER_SLUGS = ["al-manhaj-company", "myphone-tripoli", "hala-perfumes"];
const SLIDE_DURATION = 7000;

export function IdentityStudio() {
  const { locale, t } = useI18n();
  const ar = locale === "ar";
  const { demos } = useSiteContent();
  const customizerHeading = useSectionHeading("identityCustomizer");
  const themesHeading = useSectionHeading("identityThemes");
  const { palette, setPalette, mode, toggle } = useTheme();

  const [accent, setAccent] = useState(accents[0]);
  const [font, setFont] = useState(fonts[0]);
  const [style, setStyle] = useState(styles[0]);

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [fullscreen, setFullscreen] = useState<Demo | null>(null);

  const reducedMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.2 });

  const slides = useMemo<Demo[]>(() => {
    const source = (demos.length ? demos : fallbackDemos) as unknown as Demo[];
    const picked = BANNER_SLUGS.map((slug) => source.find((d) => d.slug === slug)).filter(
      (d): d is Demo => Boolean(d),
    );
    return picked.length ? picked : source.slice(0, 3);
  }, [demos]);

  const count = slides.length;
  const current = slides[index % Math.max(count, 1)];
  const playing =
    count > 1 && !paused && !hovered && !reducedMotion && inView && pageVisible;

  useEffect(() => {
    const update = () => setPageVisible(!document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const target = (index + 1) % count;
    const timer = window.setTimeout(() => {
      setIndex(target);
    }, SLIDE_DURATION);
    return () => window.clearTimeout(timer);
  }, [playing, count, index]);

  if (count === 0 || !current) return null;

  const radius = style.id === "sharp" ? 6 : style.id === "playful" ? 22 : 16;
  const goTo = (next: number) => {
    setPaused(true);
    setIndex((next + count) % count);
  };

  return (
    <section id="themes" className="py-6 sm:py-8 touch-pan-y">
      <div
        ref={ref}
        className="mx-auto w-full max-w-4xl px-5 sm:px-6 space-y-3.5 sm:space-y-4"
      >
        {/* ---------- 1. Personnalisation compacte (largeur contenue, scroll libre) ---------- */}
        <div className="card-surface p-3.5 sm:p-5">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,310px)] items-center">
            {/* Contrôles compacts */}
            <div className="min-w-0 space-y-2.5">
              <div>
                <span
                  className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em]"
                  style={{ color: accent.hex }}
                >
                  <Sliders className="h-3 w-3" />
                  {ar ? "تخصيص مباشر" : "LIVE CUSTOMIZER"}
                </span>
                <h2 className="mt-1 text-base sm:text-lg font-black leading-snug tracking-tight">
                  {customizerHeading.title}
                </h2>
                <p className="mt-0.5 text-xs text-[var(--muted-foreground)] line-clamp-1">
                  {customizerHeading.subtitle}
                </p>
              </div>

              <div className="space-y-2 pt-0.5">
                {/* Couleur */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold text-[var(--muted-foreground)] min-w-[68px]">
                    {t.customizer.accent}
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {accents.map((a) => (
                      <button
                        key={a.hex}
                        type="button"
                        onClick={() => setAccent(a)}
                        aria-label={ar ? a.name : a.nameEn}
                        aria-pressed={accent.hex === a.hex}
                        className={`h-5 w-5 rounded-full transition-transform cursor-pointer ${
                          accent.hex === a.hex
                            ? "scale-110 ring-2 ring-[var(--foreground)] ring-offset-2 ring-offset-[var(--card)]"
                            : "opacity-80 hover:scale-105 hover:opacity-100"
                        }`}
                        style={{ background: a.hex }}
                      />
                    ))}
                  </div>
                </div>

                {/* Police */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold text-[var(--muted-foreground)] min-w-[68px]">
                    {t.customizer.font}
                  </span>
                  {fonts.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFont(f)}
                      aria-pressed={font.id === f.id}
                      className={`h-6 px-2.5 rounded-full text-[11px] font-semibold border transition-colors cursor-pointer ${
                        font.id === f.id
                          ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]"
                          : "bg-[var(--secondary)] text-[var(--foreground)] border-[var(--border)] hover:border-[var(--accent)]"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Style + bouton d'action compact */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold text-[var(--muted-foreground)] min-w-[68px]">
                      {t.customizer.style}
                    </span>
                    {styles.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setStyle(s)}
                        aria-pressed={style.id === s.id}
                        className={`h-6 px-2.5 rounded-full text-[11px] font-semibold border transition-colors cursor-pointer ${
                          style.id === s.id
                            ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]"
                            : "bg-[var(--secondary)] text-[var(--foreground)] border-[var(--border)] hover:border-[var(--accent)]"
                        }`}
                      >
                        {ar ? s.labelAr : s.labelEn}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      document.getElementById("lead-form")?.scrollIntoView({ behavior: "smooth" })
                    }
                    className="h-6 px-2.5 rounded-full text-[11px] font-bold text-white inline-flex items-center gap-1 cursor-pointer shadow-xs"
                    style={{ background: accent.hex }}
                  >
                    {ar ? "اطلب الآن" : "Order now"}
                  </button>
                </div>
              </div>
            </div>

            {/* Aperçu compact contenu (aucune iframe dans le flux de défilement) */}
            <div
              role="region"
              aria-roledescription={ar ? "عرض شرائح" : "carousel"}
              aria-label={ar ? "معاينة التخصيص" : "Customization preview"}
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
              className="mx-auto w-full max-w-[300px] sm:max-w-[310px] border bg-zinc-950 p-1.5 text-white shadow-md transition-all"
              style={{
                borderRadius: radius,
                fontFamily: font.family,
                borderColor: `${accent.hex}66`,
              }}
            >
              {/* Barre miniature */}
              <div className="flex items-center justify-between gap-1.5 px-1.5 pb-1.5" dir="ltr">
                <div className="flex items-center gap-1 min-w-0">
                  <span className="h-2 w-2 rounded-full bg-red-400 shrink-0" />
                  <span className="h-2 w-2 rounded-full bg-yellow-400 shrink-0" />
                  <span className="h-2 w-2 rounded-full bg-green-400 shrink-0" />
                  <span className="ms-1 truncate max-w-[125px] rounded-full bg-white/10 px-2 py-0.5 text-[9.5px] text-white/80">
                    {current.previewUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setPaused((p) => !p)}
                    aria-label={
                      paused
                        ? ar
                          ? "تشغيل العرض التلقائي"
                          : "Play slideshow"
                        : ar
                          ? "إيقاف العرض التلقائي"
                          : "Pause slideshow"
                    }
                    className="grid h-5 w-5 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 cursor-pointer"
                  >
                    {paused ? <Play className="h-2.5 w-2.5" /> : <Pause className="h-2.5 w-2.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => goTo(index - 1)}
                    aria-label={ar ? "الشريحة السابقة" : "Previous slide"}
                    className="grid h-5 w-5 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 cursor-pointer"
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => goTo(index + 1)}
                    aria-label={ar ? "الشريحة التالية" : "Next slide"}
                    className="grid h-5 w-5 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 cursor-pointer"
                  >
                    <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* Visuel statique sans capture du scroll */}
              <div
                className="relative overflow-hidden bg-white"
                style={{ borderRadius: Math.max(radius - 4, 4) }}
              >
                <div
                  dir="ltr"
                  className="pointer-events-none select-none flex transition-transform duration-500 ease-out"
                  style={{ transform: `translateX(-${(index % count) * 100}%)` }}
                >
                  {slides.map((demo, i) => (
                    <div
                      key={demo.slug}
                      className="w-full shrink-0"
                      aria-hidden={i !== index % count}
                    >
                      <div className="relative aspect-[16/10] bg-white overflow-hidden">
                        <ProjectPreview demo={demo} mode="desktop" priority={i === 0} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Légende et petits boutons */}
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-2.5 py-2 text-white">
                  <div className="min-w-0">
                    <span
                      className="inline-block rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none text-white"
                      style={{ background: accent.hex }}
                    >
                      {ar ? current.sectorAr : current.sectorEn}
                    </span>
                    <div className="mt-0.5 truncate text-xs font-bold leading-tight">
                      {ar ? current.title : current.titleEn}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setFullscreen(current)}
                      aria-label={ar ? "ملء الشاشة" : "Fullscreen"}
                      className="inline-flex h-6 items-center gap-1 rounded-full border border-white/25 bg-white/15 px-2 text-[10px] font-bold text-white backdrop-blur hover:bg-white/25 cursor-pointer"
                    >
                      <Maximize2 className="h-2.5 w-2.5" />
                      {ar ? "معاينة" : "Preview"}
                    </button>
                    <a
                      href={current.previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-6 items-center gap-1 rounded-full px-2 text-[10px] font-bold text-white"
                      style={{ background: accent.hex }}
                    >
                      {ar ? "زيارة" : "Visit"}
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                </div>

                <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-black/15">
                  {playing && (
                    <div
                      key={index % count}
                      className="banner-progress h-full"
                      style={{ background: accent.hex, animationDuration: `${SLIDE_DURATION}ms` }}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ---------- 2. Section Thèmes compacte + boutons réduits ---------- */}
        <div className="card-surface p-3.5 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Palette className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                <h3 className="text-base sm:text-lg font-black leading-snug tracking-tight truncate">
                  {themesHeading.title}
                </h3>
              </div>
              <p className="mt-0.5 text-xs text-[var(--muted-foreground)] line-clamp-1">
                {themesHeading.subtitle}
              </p>
            </div>

            <button
              type="button"
              onClick={toggle}
              className="h-7 px-2.5 rounded-full bg-[var(--secondary)] border border-[var(--border)] text-[var(--foreground)] inline-flex items-center gap-1.5 text-[11px] font-bold hover:border-[var(--accent)] transition-colors cursor-pointer shrink-0"
            >
              {mode === "dark" ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
              <span>
                {mode === "dark"
                  ? ar
                    ? "الوضع الفاتح"
                    : "Light mode"
                  : ar
                    ? "الوضع الداكن"
                    : "Dark mode"}
              </span>
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {THEMES.map((theme) => {
              const active = theme.id === palette;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => setPalette(theme.id)}
                  aria-pressed={active}
                  title={ar ? theme.descAr : theme.descEn}
                  className={`group flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-start transition-all cursor-pointer ${
                    active
                      ? "border-[var(--accent)] bg-[var(--secondary)] shadow-xs"
                      : "border-[var(--border)] bg-[var(--background)]/60 hover:border-[var(--accent)]/60 hover:bg-[var(--secondary)]/60"
                  }`}
                >
                  <ThemePreview theme={theme} compact className="h-6 w-8 shrink-0" />
                  <span className="min-w-0 flex-1 text-[11.5px] font-bold leading-tight truncate">
                    {ar ? theme.labelAr : theme.labelEn}
                  </span>
                  {active && (
                    <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-[var(--accent-foreground)]">
                      <Check className="h-2.5 w-2.5" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <p className="mt-2.5 flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)]">
            <Palette className="h-3 w-3 shrink-0 text-[var(--accent)]" />
            <span className="line-clamp-1">{t.themes.note}</span>
          </p>
        </div>
      </div>

      {fullscreen && (
        <FullscreenLiveViewer
          demo={fullscreen}
          initialMode="desktop"
          onClose={() => setFullscreen(null)}
        />
      )}
    </section>
  );
}
