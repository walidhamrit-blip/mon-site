"use client";
import { motion } from "framer-motion";
import { Zap, Palette, SlidersHorizontal, Search, Headset } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { whyUs } from "@/lib/content";

const icons: Record<string, any> = {
  zap: Zap,
  palette: Palette,
  sliders: SlidersHorizontal,
  search: Search,
  headset: Headset,
};

export function WhyUs() {
  const { locale, t } = useI18n();
  return (
    <section className="py-16 lg:py-20 bg-[var(--secondary)]/50">
      <div className="site-container px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
          <div>
            <div className="inline-flex items-center gap-2 text-sm font-semibold tracking-[0.12em] text-[var(--accent)]">
              <span className="h-px w-8 bg-[var(--accent)]" />
              {locale === "ar" ? "قيمنا" : "WHY US"}
            </div>
            <h2 className="mt-3 text-[32px] lg:text-[42px] font-black tracking-tight leading-none">{t.why.title}</h2>
            <p className="mt-3 text-[17px] opacity-60 max-w-[50ch]">{t.why.subtitle}</p>
          </div>
          <div className="hidden lg:block text-sm opacity-40">
            {locale === "ar" ? "مصمم للموبايل أولاً • سريع كالبرق" : "Mobile-first • Lightning fast"}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {whyUs.map((item, i) => {
            const Icon = icons[item.icon] || Zap;
            return (
              <motion.div
                key={item.titleAr}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                whileHover={{ y: -6 }}
                className="group relative rounded-[20px] bg-[var(--card)] border border-[var(--border)] p-6 overflow-hidden hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] transition-all"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative">
                  <div className="h-11 w-11 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] grid place-items-center group-hover:bg-[var(--accent)] group-hover:text-[var(--accent-foreground)] transition-colors">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 font-black text-[17px]">{locale === "ar" ? item.titleAr : item.titleEn}</h3>
                  <p className="mt-2 text-sm leading-6 opacity-60">{locale === "ar" ? item.descAr : item.descEn}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
