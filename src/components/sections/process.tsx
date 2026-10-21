"use client";
import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { useSectionHeading, useSiteContent } from "@/components/site-provider";
import { SectionHeading } from "@/components/section-heading";

/**
 * Processus en 5 étapes — frise horizontale sur grand écran, liste verticale
 * sur mobile. Les numéros, durées et cartes partagent désormais le même
 * gabarit que le reste du site (rayons, ombres, typographie).
 */
export function Process() {
  const { locale } = useI18n();
  const { process: processSteps } = useSiteContent();
  const heading = useSectionHeading("process");

  return (
    <section className="section section-muted">
      <div className="site-container px-4 sm:px-6 lg:px-8">
        <SectionHeading
          align="center"
          eyebrow={locale === "ar" ? "العملية" : "Process"}
          title={heading.title}
          lead={heading.subtitle}
          note={
            heading.note ? (
              <span className="chip mx-auto mt-1">
                <span aria-hidden="true">⏱</span>
                {heading.note}
              </span>
            ) : undefined
          }
        />

        <div className="relative mt-12">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-[26px] hidden h-px bg-gradient-to-r from-transparent via-[var(--accent)]/35 to-transparent lg:block"
          />

          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {processSteps.map((step, i) => (
              <motion.li
                key={step.num}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ delay: i * 0.06, duration: 0.5 }}
                className="card-surface relative p-6"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="relative z-10 grid h-11 w-11 place-items-center rounded-full bg-[var(--primary)] text-[13px] font-black text-[var(--primary-foreground)] ring-4 ring-[var(--background)]">
                    {step.num}
                  </span>
                  <span className="rounded-full bg-[var(--accent)]/12 px-2.5 py-1 text-[11px] font-bold text-[var(--accent)]">
                    {locale === "ar" ? step.durationAr : step.durationEn}
                  </span>
                </div>
                <h3 className="mt-4 text-[15.5px] font-black leading-tight">
                  {locale === "ar" ? step.titleAr : step.titleEn}
                </h3>
                <p className="mt-2 text-[13px] leading-6 text-[var(--muted-foreground)]">
                  {locale === "ar" ? step.descAr : step.descEn}
                </p>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
