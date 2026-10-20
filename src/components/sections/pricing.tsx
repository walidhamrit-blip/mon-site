"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { CalendarCheck, Check, Sparkles, ArrowUpRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSectionHeading, useSiteConfig } from "@/components/site-provider";
import { ModelPriceBreakdown } from "@/components/model-price-breakdown";
import { ModelPurchaseButton } from "@/components/model-purchase-button";
import { resolvePlanPriceBreakdown } from "@/lib/classification";
import { formatUsd } from "@/lib/installments";
import { CURRENT_PROMO, promoActive } from "@/lib/promotion";

export function Pricing() {
  const siteConfig = useSiteConfig();
  const heading = useSectionHeading("pricing");
  const { locale, t } = useI18n();
  const plans = siteConfig.pricing.plans;

  return (
    <section id="pricing" className="py-16 lg:py-24 bg-[var(--secondary)]/40">
      <div className="site-container px-4 sm:px-6 lg:px-8">
        <div className="max-w-[760px] mx-auto text-center">
          <div className="inline-flex items-center gap-2 text-sm font-semibold tracking-[0.12em] text-[var(--accent)]">
            <span className="h-px w-8 bg-[var(--accent)]" />
            {locale === "ar" ? "الباقات" : "PRICING"}
            <span className="h-px w-8 bg-[var(--accent)]" />
          </div>
          <h2 className="mt-3 text-[30px] lg:text-[42px] font-black tracking-tight leading-none">
            {heading.title}
          </h2>
          <p className="mt-3 opacity-60">{heading.subtitle}</p>
          {heading.note && <p className="mt-2 text-xs opacity-50">{heading.note}</p>}
          {promoActive(CURRENT_PROMO) && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-4 py-1.5 text-xs font-bold">
              <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
              {locale === "ar"
                ? `خصم ${CURRENT_PROMO.percent}% عند الدفع — كوبون ${CURRENT_PROMO.code}`
                : `${CURRENT_PROMO.percent}% off at checkout — coupon ${CURRENT_PROMO.code}`}
            </div>
          )}
        </div>

        <div className="mt-10 grid lg:grid-cols-3 gap-6 max-w-[1100px] mx-auto items-start">
          {plans.map((plan, idx) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.08 }}
              className={`relative rounded-[24px] border p-6 lg:p-7 flex flex-col ${plan.featured ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)] shadow-[0_20px_50px_rgba(0,0,0,0.15)] lg:scale-[1.03] lg:-mt-2" : "bg-[var(--card)] border-[var(--border)]"}`}
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
                  <p className={`text-sm mt-1 ${plan.featured ? "opacity-70" : "opacity-60"}`}>{locale === "ar" ? plan.description : plan.descriptionEn}</p>
                </div>
                {plan.featured && <span className="h-8 w-8 rounded-full bg-[var(--accent)] grid place-items-center">✦</span>}
              </div>

              <div className="mt-6 rounded-2xl border border-[var(--border)]/70 bg-[var(--secondary)]/35 p-4">
                <ModelPriceBreakdown
                  breakdown={resolvePlanPriceBreakdown(plan)}
                  currency={locale === "ar" ? siteConfig.pricing.currency : siteConfig.pricing.currencyEn}
                />
                <div className="mt-2 text-[10px] opacity-55">
                  {locale === "ar" ? t.crypto.lydNoteAr : t.crypto.lydNoteEn}
                </div>
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
