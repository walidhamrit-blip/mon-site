"use client";
import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSectionHeading, useSiteContent } from "@/components/site-provider";

export function Testimonials() {
  const { testimonials } = useSiteContent();
  const heading = useSectionHeading("testimonials");
  const { locale, t } = useI18n();
  return (
    <section className="py-16 lg:py-20">
      <div className="site-container px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 text-sm font-semibold tracking-[0.12em] text-[var(--accent)]">
              <span className="h-px w-8 bg-[var(--accent)]" />
              {locale === "ar" ? "آراء العملاء" : "TESTIMONIALS"}
            </div>
            <h2 className="mt-3 text-[30px] lg:text-[42px] font-black tracking-tight leading-none">
              {heading.title}
            </h2>
            <p className="mt-3 opacity-60">{heading.subtitle}</p>
          </div>
          <div className="hidden lg:flex items-center gap-2 text-sm">
            <span className="flex">
              {[1,2,3,4,5].map(i=> <Star key={i} className="h-4 w-4 fill-[var(--accent)] text-[var(--accent)]" />)}
            </span>
            <span className="font-bold">4.9/5</span>
            <span className="opacity-60">{locale === "ar" ? "من 86 تقييم" : "from 86 reviews"}</span>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((item, i) => (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="rounded-[24px] bg-[var(--card)] border border-[var(--border)] p-6 flex flex-col hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center gap-3">
                <img loading="lazy" decoding="async" src={item.image} alt="" className="h-12 w-12 rounded-full object-cover" />
                <div>
                  <div className="font-bold text-sm leading-none">{locale === "ar" ? item.name : item.nameEn}</div>
                  <div className="text-xs opacity-60 mt-1">{locale === "ar" ? item.role : item.roleEn}</div>
                </div>
                <span className="ms-auto flex">
                  {Array.from({ length: item.rating }).map((_, idx) => (
                    <Star key={idx} className="h-3.5 w-3.5 fill-[var(--accent)] text-[var(--accent)]" />
                  ))}
                </span>
              </div>

              <Quote className="mt-5 h-6 w-6 opacity-10" />
              <p className="mt-2 text-[15px] leading-7">“{locale === "ar" ? item.text : item.textEn}”</p>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-[var(--secondary)] p-3 border border-[var(--border)]">
                  <div className="text-xs opacity-60">{t.testimonials.before}</div>
                  <div className="text-sm font-bold mt-1">{locale === "ar" ? item.beforeAfter.before : item.beforeAfterEn.before}</div>
                </div>
                <div className="rounded-xl bg-[var(--accent)] text-[var(--accent-foreground)] p-3">
                  <div className="text-xs opacity-80">{t.testimonials.after}</div>
                  <div className="text-sm font-bold mt-1">{locale === "ar" ? item.beforeAfter.after : item.beforeAfterEn.after}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
