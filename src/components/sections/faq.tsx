"use client";
import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSectionHeading, useSiteContent } from "@/components/site-provider";

export function FAQ() {
  const { faqs } = useSiteContent();
  const heading = useSectionHeading("faq");
  const { locale } = useI18n();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="py-16 lg:py-20 bg-[var(--secondary)]/40">
      <div className="mx-auto max-w-[960px] px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-[640px] mx-auto">
          <div className="inline-flex items-center gap-2 text-sm font-semibold tracking-[0.12em] text-[var(--accent)] justify-center w-full">
            <span className="h-px w-8 bg-[var(--accent)]" />
            {locale === "ar" ? "الأسئلة الشائعة" : "FAQ"}
            <span className="h-px w-8 bg-[var(--accent)]" />
          </div>
          <h2 className="mt-3 text-[28px] lg:text-[38px] font-black tracking-tight">
            {heading.title}
          </h2>
          <p className="mt-2 opacity-60">{heading.subtitle}</p>
        </div>

        <div className="mt-8 rounded-[24px] bg-[var(--card)] border border-[var(--border)] overflow-hidden divide-y divide-[var(--border)]">
          {faqs.map((item, idx) => {
            const isOpen = open === idx;
            return (
              <div key={idx} className="group">
                <button
                  onClick={() => setOpen(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between gap-4 px-6 py-5 text-start hover:bg-[var(--secondary)]/50 transition-colors cursor-pointer"
                  aria-expanded={isOpen}
                  aria-controls={`faq-panel-${idx}`}
                  id={`faq-trigger-${idx}`}
                >
                  <span className="font-bold text-[15px] leading-6">{locale === "ar" ? item.qAr : item.qEn}</span>
                  <span className={`h-8 w-8 rounded-full grid place-items-center flex-shrink-0 border transition-colors ${isOpen ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]" : "bg-[var(--secondary)] border-[var(--border)]"}`}>
                    {isOpen ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  </span>
                </button>
                {/* Réponse TOUJOURS présente dans le DOM (important : le
                    schéma FAQPage JSON-LD décrit les 7 Q/R — elles doivent
                    donc exister dans le HTML initial pour Google et les
                    crawlers IA). L'ouverture est animée en CSS pur. */}
                <div
                  id={`faq-panel-${idx}`}
                  role="region"
                  aria-labelledby={`faq-trigger-${idx}`}
                  className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="px-6 pb-5 text-sm leading-7 opacity-70">
                      {locale === "ar" ? item.aAr : item.aEn}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 text-center text-sm opacity-60">
          {locale === "ar" ? "لم تجد جوابك؟ " : "Didn't find answer? "}
          <a href="/contact" className="font-bold underline decoration-[var(--accent)] underline-offset-4">
            {locale === "ar" ? "راسلنا" : "Contact us"}
          </a>
        </div>
      </div>
    </section>
  );
}
