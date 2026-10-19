"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
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
import { ScaledLiveIframe, FullscreenLiveViewer } from "@/components/live-site-frames";
import { demos as fallbackDemos } from "@/lib/content";
import type { Demo } from "@/lib/site-types";

// Section unique qui fusionne l'ancien « Feel the customization » et
// « Ready-made themes… pick your identity » :
//   1. une bannière défilante avec les pages d'accueil réelles de trois sites
//      (Al-Massa, MyPhone, Toy Store) — vrais iframes, montés à la visite ;
//   2. les réglages d'identité (couleur / police / style) qui habillent
//      directement le cadre de la bannière ;
//   3. la galerie des 8 thèmes prêts à l'emploi (clair + sombre).

const accents = [
  { name: "ذهبي", nameEn: "Gold", hex: "#C6A664" },
  { name: "أزرق ملكي", nameEn: "Royal blue", hex: "#1E3A8A" },
  { name: "زمردي", nameEn: "Emerald", hex: "#0F766E" },
  { name: "خمري", nameEn: "Wine", hex: "#8B2C2C" },
  { name: "فحمي", nameEn: "Charcoal", hex: "#1A1A1E" },
];

const fonts = [
  { id: "cairo", label: "Cairo • عصري", family: "Cairo, system-ui" },
  { id: "plex", label: "IBM Plex • أنيق", family: "'IBM Plex Sans Arabic', system-ui" },
  { id: "tajawal", label: "Tajawal • دافئ", family: "Tajawal, system-ui" },
];

const styles = [
  { id: "soft", labelAr: "ناعم", labelEn: "Soft" },
  { id: "sharp", labelAr: "حازم", labelEn: "Sharp" },
  { id: "playful", labelAr: "مرح", labelEn: "Playful" },
];

/** Les trois pages d'accueil mises en avant dans la bannière. */
const BANNER_SLUGS = ["al-massa-mattresses", "myphone-tripoli", "toy-store-tripoly"];

const SLIDE_DURATION = 7000;

export function IdentityStudio() {
  const { locale, t } = useI18n();
  const ar = locale === "ar";
  const { demos } = useSiteContent();
  const customizerHeading = useSectionHeading("identityCustomizer");
  const themesHeading = useSectionHeading("identityThemes");
  const { palette, setPalette, mode, toggle } = useTheme();

  const [accent, setAccent] = useState(accents[1]);
  const [font, setFont] = useState(fonts[0]);
  const [style, setStyle] = useState(styles[0]);

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [visited, setVisited] = useState<number[]>([0]);
  const [fullscreen, setFullscreen] = useState<Demo | null>(null);

  const reducedMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.15 });

  // Contenu éditables depuis /admin d'abord, repli sur le catalogue statique.
  const slides = useMemo<Demo[]>(() => {
    const source = (demos.length ? demos : fallbackDemos) as unknown as Demo[];
    const picked = BANNER_SLUGS.map((slug) => source.find((d) => d.slug === slug)).filter(
      (d): d is Demo => Boolean(d)
    );
    return picked.length ? picked : source.slice(0, 3);
  }, [demos]);

  const count = slides.length;
  const current = slides[index % Math.max(count, 1)];
  const playing =
    count > 1 && !paused && !hovered && !focused && !reducedMotion && inView && pageVisible;

  useEffect(() => {
    const update = () => setPageVisible(!document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  // Un site n'est chargé (iframe) que lorsque sa diapositive est affichée,
  // puis il reste monté pour que le défilement suivant soit fluide.
  const markVisited = (i: number) => {
    if (count < 2) return;
    const target = ((i % count) + count) % count;
    setVisited((previous) => (previous.includes(target) ? previous : [...previous, target]));
  };

  // Défilement automatique : relancé à chaque diapositive, interrompu dès que
  // le curseur survole la bannière, que la page passe en arrière-plan ou que
  // l'utilisateur préfère un mouvement réduit.
  useEffect(() => {
    if (!playing) return;
    const target = (index + 1) % count;
    const timer = window.setTimeout(() => {
      setIndex(target);
      markVisited(target);
    }, SLIDE_DURATION);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, count, index]);

  if (count === 0 || !current) return null;

  const radius = style.id === "sharp" ? 8 : style.id === "playful" ? 32 : 26;
  const goTo = (next: number) => {
    setPaused(true);
    const target = (next + count) % count;
    setIndex(target);
    markVisited(target);
  };

  return (
    <section
      id="themes"
      className="py-16 lg:py-24 bg-[var(--primary)] text-[var(--primary-foreground)] relative overflow-hidden"
    >
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div
          className="absolute -top-20 -end-20 w-[600px] h-[600px] rounded-full blur-[80px]"
          style={{ background: accent.hex }}
        />
      </div>

      <div ref={ref} className="site-container px-4 sm:px-6 lg:px-8 relative">
        {/* ---------- En-tête ---------- */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
          <div>
            <div
              className="inline-flex items-center gap-2 text-sm font-semibold tracking-[0.12em]"
              style={{ color: accent.hex }}
            >
              <span className="h-px w-8" style={{ background: accent.hex }} />
              {ar ? "المخصص المباشر × ثيمات جاهزة" : "LIVE CUSTOMIZER × READY-MADE THEMES"}
            </div>
            <h2 className="mt-3 text-[30px] lg:text-[42px] font-black tracking-tight leading-none">
              {customizerHeading.title}
            </h2>
            <p className="mt-3 opacity-60 max-w-[60ch]">{customizerHeading.subtitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggle}
              className="h-10 px-4 rounded-full bg-white/10 border border-white/20 text-white inline-flex items-center gap-2 text-xs font-black hover:bg-white/20 transition-colors cursor-pointer"
            >
              {mode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              <span>
                {mode === "dark"
                  ? ar
                    ? "الوضع الداكن — بدّل للفاتح"
                    : "Dark mode — switch to light"
                  : ar
                    ? "الوضع الفاتح — بدّل للداكن"
                    : "Light mode — switch to dark"}
              </span>
            </button>
            <button
              type="button"
              onClick={() =>
                document.getElementById("lead-form")?.scrollIntoView({ behavior: "smooth" })
              }
              className="h-10 px-4 rounded-full text-xs font-black text-white inline-flex items-center gap-1.5 cursor-pointer shadow-md"
              style={{ background: accent.hex }}
            >
              {ar ? "اطلب الآن" : "Order now"}
            </button>
          </div>
        </div>

        {/* ---------- Bannière : 3 pages d'accueil défilantes ---------- */}
        <div
          role="region"
          aria-roledescription={ar ? "عرض شرائح" : "carousel"}
          aria-label={
            ar
              ? "صفحات الاستقبال لثلاثة مواقع حقيقية: الماسة، ماي فون، توي ستور"
              : "Home pages of three real websites: Al-Massa, MyPhone, Toy Store"
          }
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocusCapture={() => setFocused(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
          }}
          className="relative border border-white/15 bg-black/25 p-2 sm:p-3 shadow-2xl"
          style={{ borderRadius: radius, fontFamily: font.family }}
        >
          {/* Barre de navigateur */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 sm:px-2 pb-2">
            <div className="flex items-center gap-2 min-w-0" dir="ltr">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400 flex-shrink-0" />
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-400 flex-shrink-0" />
              <span className="h-2.5 w-2.5 rounded-full bg-green-400 flex-shrink-0" />
              <span
                className="ms-2 text-xs truncate max-w-[42vw] sm:max-w-[320px] rounded-full bg-white/10 px-3 py-1"
                title={current.previewUrl}
              >
                {current.previewUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono opacity-70" dir="ltr">
                {String((index % count) + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
              </span>
              <button
                type="button"
                onClick={() => setPaused((p) => !p)}
                aria-label={
                  paused ? (ar ? "تشغيل العرض التلقائي" : "Play slideshow") : (ar ? "إيقاف العرض التلقائي" : "Pause slideshow")
                }
                className="h-8 w-8 rounded-full bg-white/10 border border-white/20 grid place-items-center text-white hover:bg-white/20 transition-colors cursor-pointer"
              >
                {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => goTo(index - 1)}
                aria-label={ar ? "الشريحة السابقة" : "Previous slide"}
                className="h-8 w-8 rounded-full bg-white/10 border border-white/20 grid place-items-center text-white hover:bg-white/20 transition-colors cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => goTo(index + 1)}
                aria-label={ar ? "الشريحة التالية" : "Next slide"}
                className="h-8 w-8 rounded-full bg-white/10 border border-white/20 grid place-items-center text-white hover:bg-white/20 transition-colors cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Piste défilante */}
          <div className="relative overflow-hidden bg-white" style={{ borderRadius: radius - 6 }}>
            <div
              dir="ltr"
              className="flex transition-transform duration-700 ease-out"
              style={{ transform: `translateX(-${(index % count) * 100}%)` }}
            >
              {slides.map((demo, i) => (
                <div key={demo.slug} className="w-full shrink-0" aria-hidden={i !== index % count}>
                  <div className="relative aspect-[4/3] sm:aspect-[16/9] lg:aspect-[16/8] bg-white overflow-hidden">
                    {/* Image du projet : fond immédiat pendant le chargement du site. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={demo.image}
                      alt={ar ? demo.title : demo.titleEn}
                      loading={i === 0 ? "eager" : "lazy"}
                      decoding="async"
                      className="absolute inset-0 h-full w-full object-cover object-top"
                    />
                    {visited.includes(i) && (
                      <div
                        className={`absolute inset-0 ${
                          i === index % count ? "pointer-events-auto" : "pointer-events-none opacity-90"
                        }`}
                        style={{ fontFamily: font.family }}
                      >
                        <ScaledLiveIframe
                          url={demo.previewUrl}
                          title={ar ? demo.title : demo.titleEn}
                          mode="desktop"
                          interactive={i === index % count}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Légende de la diapositive active */}
            <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6 bg-gradient-to-t from-black/85 via-black/45 to-transparent text-white">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                  <span
                    className="inline-flex px-3 py-1 rounded-full text-[11px] font-black text-white"
                    style={{ background: accent.hex }}
                  >
                    {ar ? current.sectorAr : current.sectorEn}
                  </span>
                  <h3 className="mt-2 text-lg sm:text-2xl font-black leading-tight truncate">
                    {ar ? current.title : current.titleEn}
                  </h3>
                  <p className="mt-1 text-xs sm:text-sm opacity-85 max-w-[70ch] line-clamp-2 hidden sm:block">
                    {ar ? current.description : current.descriptionEn}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFullscreen(current)}
                    className="h-9 px-4 rounded-full bg-white/15 backdrop-blur border border-white/30 text-xs font-bold text-white inline-flex items-center gap-1.5 cursor-pointer hover:bg-white/25 transition-colors"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                    {ar ? "ملء الشاشة" : "Fullscreen"}
                  </button>
                  <a
                    href={current.previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-9 px-4 rounded-full text-xs font-bold text-white inline-flex items-center gap-1.5"
                    style={{ background: accent.hex }}
                  >
                    {ar ? "زيارة الموقع" : "Visit site"}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>

            {/* Barre de progression du défilement automatique */}
            <div className="absolute inset-x-0 top-0 h-1 bg-black/15">
              {playing && (
                <div
                  key={index % count}
                  className="banner-progress h-full"
                  style={{ background: accent.hex, animationDuration: `${SLIDE_DURATION}ms` }}
                />
              )}
            </div>
          </div>

          {/* Points de navigation */}
          <div className="flex items-center justify-center gap-2 pt-3" dir="ltr">
            {slides.map((demo, i) => (
              <button
                key={demo.slug}
                type="button"
                onClick={() => goTo(i)}
                aria-label={ar ? demo.title : demo.titleEn}
                aria-current={i === index % count}
                className="h-2 rounded-full transition-all cursor-pointer"
                style={{
                  width: i === index % count ? 28 : 10,
                  background: i === index % count ? accent.hex : "rgba(255,255,255,0.35)",
                }}
              />
            ))}
          </div>
        </div>

        {/* ---------- Réglages d'identité + thèmes prêts à l'emploi ---------- */}
        <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] items-start">
          {/* Contrôles */}
          <div className="rounded-[24px] bg-white/5 backdrop-blur border border-white/10 p-6 space-y-6">
            <div className="flex items-center gap-2 text-sm font-black">
              <Sliders className="h-4 w-4" style={{ color: accent.hex }} />
              {ar ? "لمسة التخصيص على الإطار" : "Customize the frame"}
            </div>

            <div>
              <div className="text-sm font-bold opacity-80 mb-3">{t.customizer.accent}</div>
              <div className="flex flex-wrap gap-3">
                {accents.map((a) => (
                  <button
                    key={a.hex}
                    type="button"
                    onClick={() => setAccent(a)}
                    className={`h-10 w-10 rounded-full border-2 transition-all cursor-pointer ${
                      accent.hex === a.hex
                        ? "border-white scale-110 shadow-lg"
                        : "border-white/20 hover:scale-105"
                    }`}
                    style={{ background: a.hex }}
                    aria-label={ar ? a.name : a.nameEn}
                  />
                ))}
              </div>
              <p className="mt-2 text-[11px] opacity-55 leading-relaxed">
                {ar
                  ? "معاينة العميل فقط — لتغيير ألوان موقعك بالكامل اختر ثيماً بالأسفل."
                  : "Client preview only — to recolor the whole site, pick a theme below."}
              </p>
            </div>

            <div>
              <div className="text-sm font-bold opacity-80 mb-3">{t.customizer.font}</div>
              <div className="grid gap-2">
                {fonts.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFont(f)}
                    className={`px-4 py-3 rounded-full text-sm font-semibold border transition-colors text-start cursor-pointer ${
                      font.id === f.id
                        ? "bg-white text-black border-white"
                        : "bg-white/10 border-white/20 hover:bg-white/15 text-white"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-sm font-bold opacity-80 mb-3">{t.customizer.style}</div>
              <div className="flex gap-2">
                {styles.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStyle(s)}
                    className={`flex-1 px-3 py-2.5 rounded-full text-sm font-semibold border transition-colors cursor-pointer ${
                      style.id === s.id
                        ? "bg-white text-black border-white"
                        : "bg-white/10 border-white/20 text-white hover:bg-white/15"
                    }`}
                  >
                    {ar ? s.labelAr : s.labelEn}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-white text-black p-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-black">
                  {ar ? "أعجبك ما تراه؟" : "Like what you see?"}
                </div>
                <div className="text-xs opacity-60">
                  {ar ? "نطبق هذا المستوى على نشاطك فوراً" : "We build this quality for your brand"}
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  document.getElementById("lead-form")?.scrollIntoView({ behavior: "smooth" })
                }
                className="h-9 px-4 rounded-full text-white text-sm font-bold cursor-pointer flex-shrink-0"
                style={{ background: accent.hex }}
              >
                {ar ? "اطلب الآن" : "Order now"}
              </button>
            </div>
          </div>

          {/* Thèmes prêts à l'emploi */}
          <div className="rounded-[24px] bg-white/5 backdrop-blur border border-white/10 p-6">
            <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
              <div>
                <div
                  className="inline-flex items-center gap-2 text-sm font-semibold tracking-[0.12em]"
                  style={{ color: accent.hex }}
                >
                  <Palette className="h-4 w-4" />
                  {ar ? "ثيمات جاهزة للشركات" : "READY-MADE BRAND THEMES"}
                </div>
                <h3 className="mt-2 text-2xl lg:text-[28px] font-black tracking-tight leading-none">
                  {themesHeading.title}
                </h3>
                <p className="mt-3 opacity-60 max-w-[64ch] text-sm lg:text-base">
                  {themesHeading.subtitle}
                </p>
              </div>
              <div
                className="inline-flex items-center gap-2 text-xs font-bold rounded-full px-3 py-2 border self-start xl:self-auto"
                style={{ borderColor: `${accent.hex}66`, color: accent.hex }}
              >
                {THEMES.length} {ar ? "ثيمات × وضعان (فاتح / داكن)" : "themes × 2 modes (light / dark)"}
              </div>
            </div>

            <div className="mt-6 grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {THEMES.map((theme, i) => {
                const active = theme.id === palette;
                return (
                  <motion.button
                    key={theme.id}
                    type="button"
                    onClick={() => setPalette(theme.id)}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ duration: 0.4, delay: (i % 4) * 0.05 }}
                    className={`group text-start rounded-[22px] p-3 bg-[var(--card)] text-[var(--foreground)] border transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:shadow-xl ${
                      active ? "shadow-lg" : "hover:border-[var(--accent)]/60"
                    }`}
                    style={{ borderColor: active ? accent.hex : "var(--border)" }}
                  >
                    <ThemePreview theme={theme} className="w-full" />

                    <div className="mt-3 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-black text-[15px] leading-tight truncate">
                          {ar ? theme.labelAr : theme.labelEn}
                        </div>
                        <div className="text-xs opacity-60 mt-1 leading-relaxed">
                          {ar ? theme.descAr : theme.descEn}
                        </div>
                      </div>
                      {active ? (
                        <span
                          className="h-7 w-7 rounded-full grid place-items-center flex-shrink-0 text-white"
                          style={{ background: accent.hex }}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      ) : (
                        <span className="h-7 w-7 rounded-full bg-[var(--secondary)] border border-[var(--border)] grid place-items-center flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Palette className="h-3.5 w-3.5 opacity-70" />
                        </span>
                      )}
                    </div>

                    <div className="mt-3 text-[11px] font-bold">
                      {active ? (
                        <span style={{ color: accent.hex }}>
                          {ar ? "✓ مطبّق الآن" : "✓ Applied now"}
                        </span>
                      ) : (
                        <span className="opacity-55">
                          {ar ? "طبّق هذا الثيم" : "Apply this theme"}
                        </span>
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </div>

            <p className="mt-6 text-sm opacity-60 flex items-center gap-2">
              <Palette className="h-4 w-4 flex-shrink-0" style={{ color: accent.hex }} />
              {t.themes.note}
            </p>
          </div>
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
