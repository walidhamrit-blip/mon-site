"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Globe, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { LOCALES, type Locale } from "@/lib/locale";

/**
 * Sélecteur de langue du site.
 *
 * L'arabe est la langue principale (elle est servie en RTL dès le HTML
 * initial) ; l'anglais reste disponible en un clic. Le choix est mémorisé sur
 * l'appareil du visiteur (`nukhba-locale-choice`) et prime sur la langue
 * principale définie dans /admin → Réglages.
 *
 * - `compact` : bouton + liste déroulante, pour la barre supérieure ;
 * - `list` : la même liste affichée d'un bloc, pour le menu mobile.
 */
export function LocaleSwitcher({ variant = "compact" }: { variant?: "compact" | "list" }) {
  const { locale, setLocale } = useI18n();
  const ar = locale === "ar";
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const options = (
    <ul className="space-y-1">
      {LOCALES.map((item) => {
        const active = item.id === locale;
        const primary = item.id === "ar";
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => {
                setLocale(item.id as Locale);
                setOpen(false);
              }}
              aria-current={active ? "true" : undefined}
              lang={item.id}
              dir={item.id === "ar" ? "rtl" : "ltr"}
              className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2 text-[13px] font-semibold transition-colors ${
                active
                  ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                  : "hover:bg-[var(--secondary)]"
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="w-7 shrink-0 text-[12.5px] font-black">{item.short}</span>
                <span className="truncate">{item.label}</span>
                {primary && (
                  <span className="shrink-0 rounded-full bg-[var(--secondary)] px-1.5 py-0.5 text-[9.5px] font-black text-[var(--muted-foreground)]">
                    {ar ? "الرئيسية" : "Main"}
                  </span>
                )}
              </span>
              {active && <Check className="h-3.5 w-3.5 shrink-0" />}
            </button>
          </li>
        );
      })}
    </ul>
  );

  if (variant === "list") {
    return (
      <div>
        <div className="mb-2.5 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
          <Globe className="h-3.5 w-3.5" />
          {ar ? "اللغة" : "Language"}
        </div>
        {options}
      </div>
    );
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ar ? "تغيير اللغة" : "Change language"}
        title={ar ? "لغة الموقع" : "Site language"}
        className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-[var(--secondary)] px-2.5 text-[12.5px] font-semibold transition-colors hover:bg-[var(--muted)]"
      >
        <Globe className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{ar ? "العربية" : "English"}</span>
        <span className="sm:hidden">{ar ? "ع" : "EN"}</span>
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute end-0 top-11 z-50 w-52 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-2 shadow-[var(--shadow-lg)]"
        >
          <div className="flex items-center justify-between px-1.5 pb-1.5">
            <span className="text-[10.5px] font-black uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
              {ar ? "اللغة" : "Language"}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={ar ? "إغلاق" : "Close"}
              className="grid h-5 w-5 cursor-pointer place-items-center rounded-full bg-[var(--secondary)] hover:bg-[var(--muted)]"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
          {options}
          <p className="mt-1.5 px-1 text-[10px] leading-relaxed text-[var(--muted-foreground)]">
            {ar
              ? "العربية هي اللغة الرئيسية — كل الصفحات تعمل في الاتجاهين."
              : "Arabic is the main language — every page works in both directions."}
          </p>
        </div>
      )}
    </div>
  );
}
