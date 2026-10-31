"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Palette, Star, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "./theme-provider";
import { THEMES, THEME_COUNT, themeRankLabel, type SiteTheme } from "@/lib/themes";

/**
 * Miniature d'un thème : sa version claire et sa version sombre côte à côte.
 * Aucune image n'est chargée — les couleurs viennent de la palette elle-même,
 * donc la miniature reflète toujours le thème réellement appliqué.
 */
export function ThemePreview({
  theme,
  compact = false,
  className = "",
}: {
  theme: SiteTheme;
  compact?: boolean;
  className?: string;
}) {
  if (compact) {
    const chipHalf = (mode: "light" | "dark") => {
      const p = theme[mode];
      return (
        <span
          className="flex w-1/2 flex-col justify-between p-1"
          style={{ background: p.background }}
        >
          <span
            className="block h-1 w-3/4 rounded-full"
            style={{ background: p.foreground, opacity: 0.85 }}
          />
          <span
            className="block h-1.5 w-4/5 rounded-full"
            style={{ background: p.accent }}
          />
        </span>
      );
    };

    return (
      <span
        className={`inline-flex overflow-hidden rounded-md border ${className}`}
        style={{ borderColor: theme.light.border, background: theme.light.background }}
        aria-hidden="true"
      >
        {chipHalf("light")}
        {chipHalf("dark")}
      </span>
    );
  }

  const half = (mode: "light" | "dark") => {
    const p = theme[mode];
    return (
      <div
        className="flex w-1/2 flex-col justify-between p-2.5"
        style={{ background: p.background }}
      >
        <div className="flex items-center justify-between gap-1">
          <span
            className="block h-1.5 w-1/2 rounded-full"
            style={{ background: p.foreground, opacity: 0.9 }}
          />
          <span
            className="block h-2 w-2 rounded-full"
            style={{ background: p.accent }}
          />
        </div>
        <div className="flex items-end gap-1">
          <span
            className="block h-3 w-3 rounded-sm"
            style={{ background: p.primary }}
          />
          <span
            className="block h-2 w-5 rounded-sm"
            style={{ background: p.muted }}
          />
          <span
            className="block h-2 w-4 rounded-sm"
            style={{ background: p.accent }}
          />
        </div>
        <span
          className="block h-1 w-2/3 rounded-full"
          style={{ background: p["muted-foreground"], opacity: 0.55 }}
        />
      </div>
    );
  };

  return (
    <div
      className={`flex overflow-hidden rounded-lg border ${className}`}
      style={{ borderColor: theme.light.border, background: theme.light.background }}
      aria-hidden="true"
    >
      {half("light")}
      {half("dark")}
    </div>
  );
}

/** Signature marker, then a stable palette position. */
function RankBadge({ theme, tone = "muted" }: { theme: SiteTheme; tone?: "muted" | "accent" }) {
  const { locale } = useI18n();
  const featured = Boolean(theme.featured);
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[9.5px] font-black leading-none ${
        featured
          ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
          : tone === "accent"
            ? "bg-[var(--accent)]/15 text-[var(--accent)]"
            : "bg-[var(--secondary)] text-[var(--muted-foreground)]"
      }`}
    >
      {featured && <Star className="h-2.5 w-2.5" />}
      {themeRankLabel(theme, locale)}
    </span>
  );
}

/**
 * Sélecteur complet des 6 thèmes classés — utilisé sur la page d'accueil
 * (section « studio d'identité »). C'est la version large du sélecteur :
 * grande miniature clair/sombre, secteur de prédilection et classement.
 */
export function ThemeGallery({ className = "" }: { className?: string }) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const { palette, setPalette } = useTheme();

  return (
    <div className={`grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 ${className}`}>
      {THEMES.map((theme) => {
        const active = theme.id === palette;
        return (
          <button
            key={theme.id}
            type="button"
            onClick={() => setPalette(theme.id)}
            aria-pressed={active}
            title={ar ? theme.descAr : theme.descEn}
            className={`group relative cursor-pointer overflow-hidden rounded-2xl border text-start transition-colors ${
              active
                ? "border-[var(--accent)] bg-[var(--secondary)] shadow-xs"
                : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--accent)]/60"
            }`}
          >
            <ThemePreview theme={theme} className="h-20 w-full rounded-none border-0" />
            <div className="p-2.5">
              <div className="flex items-center justify-between gap-1.5">
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-black leading-tight">
                  {ar ? theme.labelAr : theme.labelEn}
                </span>
                <RankBadge theme={theme} />
              </div>
              <p className="mt-1 truncate text-[10.5px] font-semibold text-[var(--muted-foreground)]">
                {ar ? theme.usesAr : theme.usesEn}
              </p>
            </div>
            {active && (
              <span className="absolute top-1.5 end-1.5 grid h-4 w-4 place-items-center rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] shadow-sm">
                <Check className="h-2.5 w-2.5" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Bouton + liste déroulante de sélection du thème (barre supérieure). */
export function ThemeSwitcher() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const { palette, setPalette } = useTheme();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const current = THEMES.find((t) => t.id === palette) ?? THEMES[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={ar ? "لوحات الألعاب" : "Gaming palettes"}
        aria-expanded={open}
        title={ar ? "الثيمات والألوان" : "Themes & colors"}
        className="relative grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-[var(--secondary)] transition-colors hover:bg-[var(--muted)]"
      >
        <span className="relative grid place-items-center">
          <Palette className="h-4 w-4" />
          <span
            className="absolute -bottom-1 -end-1 h-3 w-3 rounded-full border-2 border-[var(--secondary)]"
            style={{ background: current.light.accent }}
          />
        </span>
      </button>

      {open && (
        <div className="absolute top-full end-0 z-50 mt-2.5 w-[330px] max-w-[calc(100vw-2rem)] rounded-2xl border border-[var(--border)] bg-[var(--card)] p-2.5 shadow-2xl">
          <div className="flex items-start justify-between gap-2 px-1 pb-2">
            <div className="min-w-0">
              <div className="text-[11.5px] font-black">
                {ar ? `${THEME_COUNT} لوحات ألعاب` : `${THEME_COUNT} gaming palettes`}
              </div>
              <div className="mt-0.5 text-[10px] leading-relaxed opacity-55">
                {ar
                  ? "ألوان مستوحاة من الألعاب والتقنية، لكل منها وضع فاتح وداكن."
                  : "Gaming-inspired colors, each designed for light and dark mode."}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={ar ? "إغلاق" : "Close"}
              className="grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-full bg-[var(--secondary)] hover:bg-[var(--muted)]"
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {THEMES.map((t) => {
              const active = t.id === palette;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setPalette(t.id);
                    setOpen(false);
                  }}
                  aria-pressed={active}
                  title={ar ? t.usesAr : t.usesEn}
                  className={`flex flex-col gap-1 rounded-xl border px-2 py-1.5 text-start transition-colors cursor-pointer ${
                    active
                      ? "border-[var(--accent)] bg-[var(--secondary)]"
                      : "border-[var(--border)] hover:border-[var(--accent)]/60 hover:bg-[var(--secondary)]/60"
                  }`}
                >
                  <span className="flex w-full items-center gap-1.5">
                    <ThemePreview theme={t} compact className="h-5 w-7 shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-[11px] font-bold">
                      {ar ? t.labelAr : t.labelEn}
                    </span>
                    {active && (
                      <Check className="h-3 w-3 flex-shrink-0 text-[var(--accent)]" />
                    )}
                  </span>
                  <span className="flex w-full items-center justify-between gap-1">
                    <RankBadge theme={t} />
                    <span className="min-w-0 flex-1 truncate text-[9px] font-semibold opacity-50">
                      {ar ? t.labelEn : t.labelAr}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <p className="mt-2 px-1 pb-0.5 text-[10px] leading-relaxed opacity-55">
            {ar
              ? "الوضع الفاتح/الداكن يُختار بزر منفصل في الشريط العلوي — كل ثيم يعمل في الوضعين."
              : "Light / dark mode has its own button in the top bar — every theme works in both."}
          </p>
        </div>
      )}
    </div>
  );
}

/** Liste compacte des 6 thèmes (menu mobile). */
export function ThemeList() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const { palette, setPalette } = useTheme();

  return (
    <div>
      <div className="mb-2.5 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
        <Palette className="h-3.5 w-3.5" />
        {ar ? `${THEME_COUNT} لوحات ألعاب` : `${THEME_COUNT} gaming palettes`}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {THEMES.map((t) => {
          const active = t.id === palette;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setPalette(t.id)}
              aria-pressed={active}
              className={`flex flex-col gap-1 rounded-xl border px-2.5 py-2 text-start transition-colors cursor-pointer ${
                active
                  ? "border-[var(--accent)] bg-[var(--secondary)]"
                  : "border-[var(--border)] hover:border-[var(--accent)]/60"
              }`}
            >
              <span className="flex w-full items-center gap-2">
                <ThemePreview theme={t} compact className="h-5 w-7 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-[11.5px] font-bold">
                  {ar ? t.labelAr : t.labelEn}
                </span>
                {active && (
                  <Check className="h-3 w-3 flex-shrink-0 text-[var(--accent)]" />
                )}
              </span>
              <RankBadge theme={t} />
            </button>
          );
        })}
      </div>
      <p className="mt-2 px-1 text-[10.5px] leading-relaxed text-[var(--muted-foreground)]">
        {ar
          ? "الوضع الفاتح/الداكن يُختار بزر منفصل في الشريط العلوي."
          : "Light / dark mode has its own button in the top bar."}
      </p>
    </div>
  );
}
