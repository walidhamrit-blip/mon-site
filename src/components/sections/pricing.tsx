"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { CalendarCheck, Check, Sparkles, ArrowUpRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSectionHeading, useSiteConfig } from "@/components/site-provider";
import { SectionHeading } from "@/components/section-heading";
import { ModelPriceBreakdown } from "@/components/model-price-breakdown";
import { ModelPurchaseButton } from "@/components/model-purchase-button";
import { PromoPriceNote } from "@/components/promo-price";
import { resolvePlanPriceBreakdown } from "@/lib/classification";
import { formatUsd } from "@/lib/installments";
import { CURRENT_PROMO, promoActive } from "@/lib/promotion";

export function Pricing() {
  const siteConfig = useSiteConfig();
  const heading = useSectionHeading("pricing");
  const { locale, t } = useI18n();
  const plans = siteConfig.pricing.plans;

  return (
    <section id="pricing" className="section section-muted">
      <div className="site-container px-4 sm:px-6 lg:px-8">
        <SectionHeading
          align="center"
          eyebrow={locale === "ar" ? "الباقات" : "Pricing"}
          title={heading.title}
          lead={heading.subtitle}
          note={
            promoActive(CURRENT_PROMO) ? (
              <span className="chip chip-accent mx-auto mt-1">
                <Sparkles className="h-3.5 w-3.5" />
                {locale === "ar"
                  ? `خصم ${CURRENT_PROMO.percent}% عند الدفع — كوبون ${CURRENT_PROMO.code}`
                  : `${CURRENT_PROMO.percent}% off at checkout — coupon ${CURRENT_PROMO.code}`}
              </span>
            ) : undefined
          }
        />

        <div className="mx-auto mt-12 grid max-w-[1120px] items-start gap-5 lg:grid-cols-3">
          {plans.map((plan, idx) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.08 }}
              className={`relative flex flex-col rounded-[var(--radius-lg)] border p-6 transition-shadow lg:p-7 ${plan.featured ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[var(--shadow-lg)] lg:-mt-3 lg:scale-[1.02]" : "border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-xs)] hover:shadow-[var(--shadow-md)]"}`}
            >
              {plan.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] text-xs font-black flex items-center gap-1.5 shadow">
                  <Sparkles className="h-3.5 w-3.5" />
                  {locale === "ar" ? plan.badge : plan.badgeEn}
                </div>
              )}

              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.14em] opacity-50">
                    {locale === "ar" ? `الفئة ${idx + 1}` : `Category ${idx + 1}`}
                  </div>
                  <h3 className="mt-0.5 text-lg font-black">{locale === "ar" ? plan.name : plan.nameEn}</h3>
                  <p className={`mt-1 text-[13.5px] leading-6 ${plan.featured ? "opacity-70" : "text-[var(--muted-foreground)]"}`}>{locale === "ar" ? plan.description : plan.descriptionEn}</p>
                </div>
                {plan.featured && <span className="h-8 w-8 rounded-full bg-[var(--accent)] grid place-items-center">✦</span>}
              </div>

              <div className="mt-6 rounded-2xl border border-[var(--border)]/70 bg-[var(--secondary)]/35 p-4">
                <ModelPriceBreakdown breakdown={resolvePlanPriceBreakdown(plan)} />
                <div className="mt-2 text-[10px] opacity-55">
                  {locale === "ar" ? t.crypto.lydNoteAr : t.crypto.lydNoteEn}
                </div>
                {/* Prix après coupon : même calcul que le serveur de paiement. */}
                <PromoPriceNote
                  amountUsd={resolvePlanPriceBreakdown(plan).totalPriceUsd}
                  className="mt-2"
                />
              </div>
              <div className="text-xs opacity-60">{locale === "ar" ? plan.period : plan.periodEn}</div>

              <ModelPurchaseButton
                plan={plan}
                className={`mt-6 min-h-11 rounded-full px-4 py-2.5 font-bold inline-flex items-center justify-center gap-2 w-full cursor-pointer transition text-center ${plan.featured ? "bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)]" : "bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90"}`}
              />

              {resolvePlanPriceBreakdown(plan).totalPriceUsd != null && (
                <p className="mt-2 text-center text-[11px] opacity-60">
                  {locale === "ar" ? t.crypto.installmentNoteAr : t.crypto.installmentNoteEn}
                </p>
              )}

              <ul className="mt-6 space-y-2.5">
                {(locale === "ar" ? plan.features : plan.featuresEn).map((f) => (
                  <li key={f} className="flex gap-2.5 text-sm leading-6">
                    <span className={`mt-0.5 h-5 w-5 rounded-full grid place-items-center flex-shrink-0 ${plan.featured ? "bg-white/15 text-white" : "bg-[var(--accent)] text-white"}`}>
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    <span className={plan.featured ? "opacity-90" : "opacity-80"}>{f}</span>
                  </li>
                ))}
              </ul>

              <div className={`mt-6 text-xs pt-4 border-t ${plan.featured ? "opacity-60 border-white/10" : "opacity-50 border-[var(--border)]"}`}>
                {locale === "ar" ? "سنة استضافة + شهادة SSL مجاناً" : "1 year hosting + SSL free"}
              </div>
            </motion.div>
          ))}
        </div>

        {siteConfig.reservation?.enabled && (
          <div className="mt-8 max-w-[760px] mx-auto rounded-[20px] border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-center sm:text-start">
              <div className="flex items-center justify-center sm:justify-start gap-2 text-sm font-black">
                <CalendarCheck className="h-4 w-4 text-[var(--accent)]" />
                {locale === "ar"
                  ? "احجز مكانك في جدول العمل"
                  : "Reserve your place in our queue"}
              </div>
              <p className="mt-1 text-xs opacity-60">
                {locale === "ar"
                  ? `عربون ${formatUsd(siteConfig.reservation?.depositUsd ?? 1)} $ فقط — يُخصم من سعر المشروع ويمنحك أولوية في التنفيذ.`
                  : `Only a $${formatUsd(siteConfig.reservation?.depositUsd ?? 1)} deposit — deducted from the project price and giving you priority.`}
              </p>
            </div>
            <Link
              href="/demos"
              className="h-10 px-5 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] text-xs font-black inline-flex items-center gap-1.5 hover:bg-[var(--accent-hover)] transition-colors flex-shrink-0"
            >
              {locale === "ar" ? "اختر موقعاً واحجز" : "Pick a site & reserve"}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        <div className="mt-8 text-center">
          <p className="text-sm opacity-60">
            {locale === "ar" ? "تحتاج شيئاً مخصصاً؟ " : "Need something custom? "}
            <a href="/contact" className="font-bold underline decoration-[var(--accent)] underline-offset-4">
              {locale === "ar" ? "تحدث معنا" : "Talk to us"}
            </a>
            {" — "}
            {locale === "ar" ? "نصمم باقة على مقاسك" : "we tailor a plan"}
          </p>
        </div>
      </div>

    </section>
  );
}
