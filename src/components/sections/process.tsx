"use client";
import { motion } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSectionHeading, useSiteContent } from "@/components/site-provider";
import { SectionHeading } from "@/components/section-heading";
import { LocalizedLink as Link } from "@/components/localized-link";

/**
 * Processus de création d'un site — frise horizontale sur très grand écran,
 * grille de cartes sur mobile et tablette. Le nombre de colonnes suit le
 * nombre d'étapes réellement configurées dans /admin → Contenu : au-delà de
 * cinq étapes, une seule rangée donnerait des cartes illisibles, on repasse
 * sur deux rangées en dessous de 2xl.
 *
 * Les numéros, durées et cartes partagent le même gabarit que le reste du
 * site (rayons, ombres, typographie).
 */
export function Process() {
  const { locale } = useI18n();
  const { process: processSteps } = useSiteContent();
  const heading = useSectionHeading("process");
  const gridClass =
    processSteps.length >= 6
      ? "sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6"
      : processSteps.length === 5
        ? "sm:grid-cols-2 lg:grid-cols-5"
        : processSteps.length === 4
          ? "sm:grid-cols-2 lg:grid-cols-4"
          : "sm:grid-cols-2 lg:grid-cols-3";
  // Le filet horizontal ne relie les pastilles que lorsque la frise tient
  // sur une seule rangée.
  const lineClass = processSteps.length >= 6 ? "2xl:block" : "lg:block";

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
            className={`absolute inset-x-0 top-[26px] hidden h-px bg-gradient-to-r from-transparent via-[var(--accent)]/35 to-transparent ${lineClass}`}
          />

          <ol className={`grid gap-4 ${gridClass}`}>
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

        {/* Rassurance paiement : dès le paiement, le client reçoit un site
            exemple en ligne qu'on personnalise ensuite pour sa boutique. */}
        <div className="mx-auto mt-8 max-w-3xl">
          <p className="flex items-start gap-3 rounded-2xl border border-[#0B6B3A]/35 bg-[#0B6B3A]/10 p-5 text-sm font-bold leading-6">
            <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#0B6B3A]" aria-hidden="true" />
            <span>
              {locale === "ar"
                ? "فور الدفع، يصلك موقع مثال مباشر على الإنترنت. ثم نقوم بتخصيصه لمتجرك: ألوانك، شعارك، منتجاتك."
                : "As soon as you pay, you receive a live example website. Then we customize it for your shop: your colors, your logo, your products."}
            </span>
          </p>
          <p className="mt-4 text-center text-sm">
            <Link href="/demos" className="font-bold text-[var(--accent)] hover:underline">
              {locale === "ar" ? "شاهد أمثلة مواقع تم تسليمها ↗" : "See example websites already delivered ↗"}
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
