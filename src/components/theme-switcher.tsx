"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Palette, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "./theme-provider";
import { THEMES, type SiteTheme } from "@/lib/themes";

/** Miniature d'un thème : sa version claire et sa version sombre côte à côte. */
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
      <div className="w-1/2 p-1.5" style={{ background: p.background }}>
        <div
          className="h-1 w-4/5 rounded-full"
          style={{ background: p.foreground, opacity: 0.9 }}
        />
        <div
          className="mt-1.5 h-2 w-7 rounded-full"
          style={{ background: p.accent }}
        />
        <div
          className="mt-1.5 h-1 w-3/5 rounded-full"
          style={{ background: p["muted-foreground"], opacity: 0.5 }}
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

/** Bouton + liste déroulante de sélection du thème (barre supérieure). */
export function ThemeSwitcher() {
  const { locale } = useI18n();
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
        aria-label={locale === "ar" ? "الثيمات والألوان" : "Themes & colors"}
        aria-expanded={open}
        className="h-9 w-9 rounded-full bg-[var(--secondary)] grid place-items-center hover:bg-[var(--muted)] transition-colors cursor-pointer relative"
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
        <div className="absolute top-full end-0 mt-2.5 z-50 w-[272px] max-w-[calc(100vw-2rem)] rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-2xl p-2.5">
          <div className="flex items-center justify-between px-1.5 pb-2">
            <div className="text-[11px] font-black opacity-60">
              {locale === "ar" ? "ثيمات الموقع" : "Site themes"}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={locale === "ar" ? "إغلاق" : "Close"}
              className="h-6 w-6 rounded-full bg-[var(--secondary)] grid place-items-center cursor-pointer hover:bg-[var(--muted)]"
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
                  className={`flex items-center gap-2 text-start rounded-xl border px-2 py-1.5 transition-colors cursor-pointer ${
                    active
                      ? "border-[var(--accent)] bg-[var(--secondary)]"
                      : "border-[var(--border)] hover:border-[var(--accent)]/60 hover:bg-[var(--secondary)]/60"
                  }`}
                >
                  <ThemePreview theme={t} compact className="h-5 w-7 shrink-0" />
                  <span className="min-w-0 flex-1 text-[11px] font-bold truncate">
                    {locale === "ar" ? t.labelAr : t.labelEn}
                  </span>
                  {active && (
                    <Check className="h-3 w-3 text-[var(--accent)] flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
          <p className="mt-2 px-1.5 pb-0.5 text-[10.5px] opacity-55 leading-relaxed">
            {locale === "ar"
              ? "الوضع الفاتح/الداكن يُختار بزر منفصل في الشريط العلوي."
              : "Light / dark mode is controlled by its own button in the top bar."}
          </p>
        </div>
      )}
    </div>
  );
}

/** Liste compacte des thèmes (menu mobile). */
export function ThemeList() {
  const { locale } = useI18n();
  const { palette, setPalette } = useTheme();

  return (
    <div className="grid grid-cols-2 gap-1.5">
      {THEMES.map((t) => {
        const active = t.id === palette;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => setPalette(t.id)}
            aria-pressed={active}
            className={`flex items-center gap-2 text-start rounded-xl border px-2.5 py-1.5 transition-colors cursor-pointer ${
              active
                ? "border-[var(--accent)] bg-[var(--secondary)]"
                : "border-[var(--border)] hover:border-[var(--accent)]/60"
            }`}
          >
            <ThemePreview theme={t} compact className="h-5 w-7 shrink-0" />
            <span className="min-w-0 flex-1 text-[11px] font-bold truncate">
              {locale === "ar" ? t.labelAr : t.labelEn}
            </span>
            {active && <Check className="h-3 w-3 text-[var(--accent)] flex-shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}
