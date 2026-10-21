"use client";
import Link from "next/link";
import { Pricing } from "@/components/sections/pricing";
import { FAQ } from "@/components/sections/faq";
import { useI18n } from "@/lib/i18n";
import { CURRENT_PROMO } from "@/lib/promotion";

export function PricingClient() {
  const { locale } = useI18n();
  return (
    <div className="pt-[calc(var(--header-h)+1.5rem)]">
      <section className="section-tight border-b border-[var(--border)] bg-[var(--secondary)]/35">
        <div className="site-container px-4 text-center sm:px-6 lg:px-8">
          <span className="section-eyebrow is-centered justify-center">
            {locale === "ar" ? "الأسعار" : "Pricing"}
          </span>
          <h1 className="section-title mx-auto max-w-[20ch]">
            {locale === "ar" ? "باقات واضحة — بلا مفاجآت" : "Clear plans — no surprises"}
          </h1>
          <p className="section-lead mx-auto">
            {locale === "ar"
              ? "اختر ما يناسب مرحلتك — الأسعار بالدولار (مع مكافئ تقديري بالدينار الليبي)، ويمكنك الدفع كاملاً أو على 2-3 أقساط بالعملات الرقمية عبر NOWPayments."
              : "Pick your stage — prices in USD (with an indicative LYD equivalent), pay in full or in 2–3 crypto installments via NOWPayments."}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Link
              href="/demos"
              className="inline-flex max-w-full items-center justify-center rounded-full border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-4 py-2 text-center text-[12.5px] font-bold leading-snug text-[color-mix(in_srgb,var(--accent)_72%,var(--foreground))] transition-colors hover:bg-[var(--accent)]/15"
            >
              {locale === "ar"
                ? `خصم ${CURRENT_PROMO.percent}% بكوبون ${CURRENT_PROMO.code}`
                : `${CURRENT_PROMO.percent}% off with coupon ${CURRENT_PROMO.code}`}
            </Link>
            <Link
              href="/services"
              className="inline-flex max-w-full items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-center text-[12.5px] font-bold leading-snug transition-colors hover:border-[var(--accent)]/60"
            >
              {locale === "ar"
                ? "خدمات مفتوحة — إعادة تصميم، إضافة قسم، شرائح، تصميم"
                : "Open services — restyle, add a section, slides, design"}
            </Link>
          </div>
        </div>
      </section>
      <Pricing />

      <section className="section-tight">
        <div className="site-container px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[960px] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-xs)]">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--secondary)]">
                  <tr>
                    <th className="text-start p-4">{locale === "ar" ? "الميزة" : "Feature"}</th>
                    <th className="p-4 text-center">الواجهة</th>
                    <th className="p-4 text-center bg-[var(--accent)] text-[var(--accent-foreground)]">الواجهة بلس</th>
                    <th className="p-4 text-center">المتجر</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {[
                    ["صفحات", "5", "10", "∞"],
                    ["مدونة", "—", "✓", "✓"],
                    ["حجز / متجر", "—", "حجز", "متجر كامل"],
                    ["لغتين", "—", "✓", "✓"],
                    ["SEO", "أساسي", "متقدم", "متقدم+"],
                    ["دعم", "30 يوم", "60 يوم", "90 يوم"],
                  ].map((row) => (
                    <tr key={row[0]}>
                      <td className="p-4 font-semibold">{row[0]}</td>
                      <td className="p-4 text-center">{row[1]}</td>
                      <td className="p-4 text-center font-bold bg-[var(--accent)]/10">{row[2]}</td>
                      <td className="p-4 text-center">{row[3]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <FAQ />
    </div>
  );
}
