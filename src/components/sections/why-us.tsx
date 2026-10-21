"use client";
import { motion } from "framer-motion";
import { ArrowUpRight, Zap, Palette, SlidersHorizontal, Search, Headset } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSectionHeading, useSiteContent } from "@/components/site-provider";
import { SectionHeading } from "@/components/section-heading";

const icons: Record<string, typeof Zap> = {
  zap: Zap,
  palette: Palette,
  sliders: SlidersHorizontal,
  search: Search,
  headset: Headset,
};

export function WhyUs() {
  const { locale } = useI18n();
  const { whyUs } = useSiteContent();
  const heading = useSectionHeading("why");

  return (
    <section className="section">
      <div className="site-container px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow={locale === "ar" ? "قيمنا" : "Why us"}
          title={heading.title}
          lead={heading.subtitle}
          aside={
            <span className="chip chip-accent">
              {locale === "ar" ? "مصمم للموبايل أولاً · سريع كالبرق" : "Mobile-first · Lightning fast"}
            </span>
          }
        />

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {whyUs.map((item, i) => {
            const Icon = icons[item.icon] ?? Zap;
            return (
              <motion.article
                key={item.titleAr}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ delay: i * 0.05, duration: 0.5 }}
                className="card-surface card-interactive group p-6"
              >
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--secondary)] text-[var(--foreground)] transition-colors group-hover:bg-[var(--accent)] group-hover:text-[var(--accent-foreground)]">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-[16px] font-black tracking-tight">
                  {locale === "ar" ? item.titleAr : item.titleEn}
                </h3>
                <p className="mt-2 text-[13.5px] leading-6 text-[var(--muted-foreground)]">
                  {locale === "ar" ? item.descAr : item.descEn}
                </p>
              </motion.article>
            );
          })}

          {/* Sixième tuile : passage à l'action — complète la grille 3 × 2
              sans laisser de case vide quand il y a cinq valeurs. */}
          <motion.a
            href="/contact"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ delay: whyUs.length * 0.05, duration: 0.5 }}
            className="group relative flex flex-col justify-between overflow-hidden rounded-[var(--radius-lg)] bg-[var(--primary)] p-6 text-[var(--primary-foreground)]"
          >
            <span
              aria-hidden="true"
              className="absolute -end-10 -top-10 h-32 w-32 rounded-full bg-[var(--accent)]/25 blur-2xl transition-transform duration-500 group-hover:scale-125"
            />
            <span className="relative text-[15px] font-black leading-snug">
              {locale === "ar" ? "لديك سؤال قبل البدء؟" : "A question before we start?"}
            </span>
            <span className="relative mt-4 text-[13px] opacity-70">
              {locale === "ar"
                ? "استشارة مجانية في دقائق — بدون التزام."
                : "A free consultation in minutes — no commitment."}
            </span>
            <span className="relative mt-5 inline-flex items-center gap-2 text-[13px] font-bold text-[var(--accent)]">
              {locale === "ar" ? "تحدث معنا" : "Talk to us"}
              <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
            </span>
          </motion.a>
        </div>
      </div>
    </section>
  );
}
