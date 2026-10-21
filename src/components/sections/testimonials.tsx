"use client";
import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSectionHeading, useSiteContent } from "@/components/site-provider";
import { SectionHeading } from "@/components/section-heading";

/**
 * Avis clients.
 *
 * Les photos venaient d'un domaine externe (`item.image`) : elles
 * s'affichaient en icône « image cassée » dès que le CDN était bloqué ou
 * lent. On affiche désormais un monogramme local (initiale du client +
 * dégradé déterministe), toujours net, sans requête réseau.
 */
const TONES = [
  "from-[#C6A664] to-[#8C7138]",
  "from-[#4F6D7A] to-[#243943]",
  "from-[#8C6A7A] to-[#4A3441]",
  "from-[#5C7A5A] to-[#2F4730]",
];

function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase();
}

export function Testimonials() {
  const { testimonials } = useSiteContent();
  const heading = useSectionHeading("testimonials");
  const { locale, t } = useI18n();
  const ar = locale === "ar";

  return (
    <section className="section">
      <div className="site-container px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow={ar ? "آراء العملاء" : "Testimonials"}
          title={heading.title}
          lead={heading.subtitle}
          aside={
            <div className="flex items-center gap-3 rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-2">
              <span className="flex text-[var(--accent)]">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className="h-4 w-4 fill-current" />
                ))}
              </span>
              <span className="text-sm font-black">4.9/5</span>
              <span className="text-[12px] text-[var(--muted-foreground)]">
                {ar ? "من 86 تقييم" : "86 reviews"}
              </span>
            </div>
          }
        />

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {testimonials.map((item, i) => (
            <motion.figure
              key={item.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: i * 0.06, duration: 0.5 }}
              className="card-surface card-interactive flex flex-col p-6"
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br ${TONES[i % TONES.length]} text-[15px] font-black text-white`}
                >
                  {initial(ar ? item.name : item.nameEn)}
                </span>
                <figcaption className="min-w-0">
                  <div className="truncate text-[14px] font-bold leading-tight">
                    {ar ? item.name : item.nameEn}
                  </div>
                  <div className="mt-1 truncate text-[12px] text-[var(--muted-foreground)]">
                    {ar ? item.role : item.roleEn}
                  </div>
                </figcaption>
                <span className="ms-auto flex shrink-0 text-[var(--accent)]" aria-label={`${item.rating}/5`}>
                  {Array.from({ length: item.rating }).map((_, idx) => (
                    <Star key={idx} className="h-3.5 w-3.5 fill-current" />
                  ))}
                </span>
              </div>

              <Quote aria-hidden="true" className="mt-5 h-5 w-5 text-[var(--accent)]/40" />
              <blockquote className="mt-2 flex-1 text-[14.5px] leading-7 text-[var(--foreground)]/85">
                {ar ? item.text : item.textEn}
              </blockquote>

              <div className="mt-5 grid grid-cols-2 gap-2.5">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--secondary)]/60 p-3">
                  <div className="text-[10.5px] uppercase tracking-wider text-[var(--muted-foreground)]">
                    {t.testimonials.before}
                  </div>
                  <div className="mt-1 text-[12.5px] font-bold leading-snug">
                    {ar ? item.beforeAfter.before : item.beforeAfterEn.before}
                  </div>
                </div>
                <div className="rounded-xl bg-[var(--accent)] p-3 text-[var(--accent-foreground)]">
                  <div className="text-[10.5px] uppercase tracking-wider opacity-80">
                    {t.testimonials.after}
                  </div>
                  <div className="mt-1 text-[12.5px] font-bold leading-snug">
                    {ar ? item.beforeAfter.after : item.beforeAfterEn.after}
                  </div>
                </div>
              </div>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}
