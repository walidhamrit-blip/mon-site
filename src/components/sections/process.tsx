"use client";
import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { processSteps } from "@/lib/content";

export function Process() {
  const { locale, t } = useI18n();
  return (
    <section className="py-16 lg:py-20">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="max-w-[720px] mx-auto text-center">
          <div className="inline-flex items-center gap-2 text-sm font-semibold tracking-[0.12em] text-[var(--accent)]">
            <span className="h-px w-8 bg-[var(--accent)]" />
            {locale === "ar" ? "العملية" : "PROCESS"}
            <span className="h-px w-8 bg-[var(--accent)]" />
          </div>
          <h2 className="mt-3 text-[30px] lg:text-[42px] font-black tracking-tight leading-none">{t.process.title}</h2>
          <p className="mt-3 opacity-60">{t.process.subtitle}</p>
          <div className="mt-4 inline-flex px-4 py-1.5 rounded-full bg-[var(--secondary)] border border-[var(--border)] text-sm font-semibold">
            ⏱ {t.process.total}
          </div>
        </div>

        <div className="mt-10 relative">
          {/* line */}
          <div className="hidden lg:block absolute top-[56px] left-8 right-8 h-px bg-[var(--border)]" />
          <div className="hidden lg:block absolute top-[56px] left-8 h-px bg-[var(--accent)] w-0 motion-safe:animate-[shimmer_2s_ease]" style={{ width: "calc(100% - 64px)" }} />

          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {processSteps.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="relative rounded-[20px] bg-[var(--card)] border border-[var(--border)] p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] grid place-items-center text-sm font-black">
                    {step.num}
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] font-bold">
                    {locale === "ar" ? step.durationAr : step.durationEn}
                  </span>
                </div>
                <h3 className="mt-4 font-black text-[16px] leading-tight">{locale === "ar" ? step.titleAr : step.titleEn}</h3>
                <p className="mt-2 text-sm leading-6 opacity-60">{locale === "ar" ? step.descAr : step.descEn}</p>
                {i < processSteps.length - 1 && (
                  <div className="lg:hidden mt-4 flex justify-center">
                    <span className="h-6 w-px bg-[var(--border)]" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
