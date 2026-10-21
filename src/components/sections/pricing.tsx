"use client";
import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CalendarCheck, Check, Sparkles, ArrowUpRight, Bitcoin } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSectionHeading, useSiteConfig } from "@/components/site-provider";
import { SectionHeading } from "@/components/section-heading";
import { CheckoutDialog } from "@/components/checkout-dialog";
import { formatLyd, lydLabel } from "@/lib/classification";
import { formatMainPrice, formatUsd } from "@/lib/installments";
import { CURRENT_PROMO, promoActive } from "@/lib/promotion";
import type { PricingPlan } from "@/lib/config";

export function Pricing() {
  const siteConfig = useSiteConfig();
  const heading = useSectionHeading("pricing");
  const { locale, t } = useI18n();
  const plans = siteConfig.pricing.plans;
  const [checkoutPlan, setCheckoutPlan] = useState<PricingPlan | null>(null);

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

              {/* Prix principal en DOLLAR (toutes langues) — le montant en
                  Livre libyenne reste affiché en équivalent indicatif. */}
              <div className="mt-6 flex items-baseline gap-2">
                {(plan.priceUsd ?? 0) > 0 ? (
                  <>
                    <span className="text-[36px] font-black tracking-tight leading-none" dir="ltr">
                      {formatMainPrice(plan.priceUsd ?? 0, locale === "ar" ? siteConfig.pricing.currency : siteConfig.pricing.currencyEn)}
                    </span>
                    {plan.originalPrice != null && plan.originalPrice > 0 && plan.price > 0 && (
                      <span className="ms-2 text-sm line-through opacity-40" dir="ltr">
                        {formatMainPrice(
                          Math.round((plan.originalPrice * (plan.priceUsd ?? 0)) / plan.price),
                          locale === "ar" ? siteConfig.pricing.currency : siteConfig.pricing.currencyEn,
                        )}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-[36px] font-black tracking-tight leading-none">{formatLyd(plan.price)}</span>
                    <span className="text-sm opacity-60">{lydLabel(locale)}</span>
                    {plan.originalPrice != null && plan.originalPrice > 0 && (
                      <span className="ms-2 text-sm line-through opacity-40">{formatLyd(plan.originalPrice)}</span>
                    )}
                  </>
                )}
              </div>
              <div className="text-xs opacity-60">{locale === "ar" ? plan.period : plan.periodEn}</div>

              {(plan.priceUsd ?? 0) > 0 && (
                <div
                  className={`mt-2.5 self-start inline-flex items-baseline gap-1.5 rounded-full px-3 py-1 ${
                    plan.featured ? "bg-white/10" : "bg-[var(--accent)]/10"
                  }`}
                >
                  <span className="text-sm font-bold opacity-80" dir="ltr">
                    ≈ {formatLyd(plan.price)} {lydLabel(locale)}
                  </span>
                  <span className="text-[11px] opacity-70">
                    {locale === "ar" ? t.crypto.lydNoteAr : t.crypto.lydNoteEn}
                  </span>
                </div>
              )}

              {(plan.priceUsd ?? 0) > 0 ? (
                <button
                  onClick={() => setCheckoutPlan(plan)}
                  className={`mt-6 h-11 rounded-full font-bold inline-flex items-center justify-center gap-2 w-full cursor-pointer transition ${plan.featured ? "bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)]" : "bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90"}`}
                >
                  <Bitcoin className="h-4 w-4" />
                  {locale === "ar" ? t.crypto.payWithCrypto : t.crypto.payWithCrypto}
                </button>
              ) : (
                <button
                  onClick={() => document.getElementById("lead-form")?.scrollIntoView({ behavior: "smooth" })}
                  className={`mt-6 h-11 rounded-full font-bold inline-flex items-center justify-center gap-2 w-full cursor-pointer transition ${plan.featured ? "bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)]" : "bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90"}`}
                >
                  {locale === "ar" ? plan.cta : plan.ctaEn}
                  <ArrowUpRight className="h-4 w-4" />
                </button>
              )}

              {(plan.priceUsd ?? 0) > 0 && (
                <p className="mt-2 text-center text-[11px] opacity-60">
                  {locale === "ar" ? t.crypto.installmentNoteAr : t.crypto.installmentNoteEn}
                </p>
              )}

              {(plan.priceUsd ?? 0) > 0 && (
                <button
                  onClick={() => document.getElementById("lead-form")?.scrollIntoView({ behavior: "smooth" })}
                  className="mt-2 w-full text-xs opacity-60 hover:opacity-100 underline underline-offset-4 decoration-[var(--accent)] transition cursor-pointer"
                >
                  {locale === "ar" ? t.crypto.orQuote : t.crypto.orQuote}
                </button>
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

      {/* Monté conditionnellement : l'état du dialogue
          repart à zéro à chaque ouverture. */}
      {checkoutPlan && (
        <CheckoutDialog plan={checkoutPlan} onClose={() => setCheckoutPlan(null)} />
      )}
    </section>
  );
}
