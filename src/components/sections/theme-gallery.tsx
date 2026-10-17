"use client";
import { motion } from "framer-motion";
import { Check, Moon, Palette, Sun } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/components/theme-provider";
import { ThemePreview } from "@/components/theme-switcher";
import { THEMES } from "@/lib/themes";

// Vitrine des thèmes : lvisitor applique un thème en un clic et voit
// immédiatement le site changer de couleurs. Le mode clair / sombre, lui,
// reste un bouton séparé (dans la barre supérieure ET ici, mais toujours
// indépendant du choix du thème).

export function ThemeGallery() {
  const { locale, t } = useI18n();
  const { palette, setPalette, mode, toggle } = useTheme();

  return (
    <section id="themes" className="py-16 lg:py-24 bg-[var(--secondary)]/40 border-y border-[var(--border)]">
      <div className="site-container px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 text-sm font-semibold tracking-[0.12em] text-[var(--accent)]">
              <span className="h-px w-8 bg-[var(--accent)]" />
              {locale === "ar" ? "ثيمات جاهزة للشركات" : "READY-MADE BRAND THEMES"}
            </div>
            <h2 className="mt-3 text-[32px] lg:text-[44px] font-black tracking-tight leading-none">
              {t.themes.title}
            </h2>
            <p className="mt-3 opacity-60 max-w-[56ch]">{t.themes.subtitle}</p>
          </div>

          {/* Bouton indépendant : mode clair / sombre (rien à voir avec le thème) */}
          <button
            type="button"
            onClick={toggle}
            className="h-11 px-5 rounded-full bg-[var(--card)] border border-[var(--border)] inline-flex items-center gap-2 text-sm font-bold hover:border-[var(--accent)] transition-colors cursor-pointer self-start lg:self-auto"
          >
            {mode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            <span>
              {mode === "dark"
                ? locale === "ar"
                  ? "الوضع الداكن — بدّل للفاتح"
                  : "Dark mode — switch to light"
                : locale === "ar"
                  ? "الوضع الفاتح — بدّل للداكن"
                  : "Light mode — switch to dark"}
            </span>
          </button>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {THEMES.map((theme, i) => {
            const active = theme.id === palette;
            return (
              <motion.button
                key={theme.id}
                type="button"
                onClick={() => setPalette(theme.id)}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.4, delay: (i % 4) * 0.05 }}
                className={`group text-start rounded-[22px] p-3 bg-[var(--card)] border transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:shadow-xl ${
                  active
                    ? "border-[var(--accent)] shadow-lg"
                    : "border-[var(--border)] hover:border-[var(--accent)]/60"
                }`}
              >
                <ThemePreview theme={theme} className="w-full" />

                <div className="mt-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-black text-[15px] leading-tight truncate">
                      {locale === "ar" ? theme.labelAr : theme.labelEn}
                    </div>
                    <div className="text-xs opacity-60 mt-1 leading-relaxed">
                      {locale === "ar" ? theme.descAr : theme.descEn}
                    </div>
                  </div>
                  {active ? (
                    <span className="h-7 w-7 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] grid place-items-center flex-shrink-0">
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
                    <span className="text-[var(--accent)]">
                      {locale === "ar" ? "✓ مطبّق الآن" : "✓ Applied now"}
                    </span>
                  ) : (
                    <span className="opacity-55">
                      {locale === "ar" ? "طبّق هذا الثيم" : "Apply this theme"}
                    </span>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>

        <p className="mt-6 text-sm opacity-60 flex items-center gap-2">
          <Palette className="h-4 w-4 text-[var(--accent)] flex-shrink-0" />
          {t.themes.note}
        </p>
      </div>
    </section>
  );
}
