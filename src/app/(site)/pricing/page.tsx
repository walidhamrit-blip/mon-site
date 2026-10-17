"use client";
import { Pricing } from "@/components/sections/pricing";
import { FAQ } from "@/components/sections/faq";
import { useI18n } from "@/lib/i18n";

export default function PricingPage() {
  const { locale } = useI18n();
  return (
    <div className="pt-[96px]">
      <section className="py-10 bg-[var(--secondary)]/30 border-b border-[var(--border)]">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-[720px]">
          <h1 className="text-[38px] lg:text-[52px] font-black leading-none tracking-tight">
            {locale === "ar" ? "باقات واضحة — بلا مفاجآت" : "Clear plans — no surprises"}
          </h1>
          <p className="mt-3 opacity-60">
            {locale === "ar" ? "اختر ما يناسب مرحلتك — ويمكنك الترقية لاحقاً بسهولة. كل الأسعار قابلة للتعديل في config.ts" : "Pick your stage — upgrade anytime. All prices editable in config.ts"}
          </p>
        </div>
      </section>
      <Pricing />

      <section className="py-10">
        <div className="mx-auto max-w-[960px] px-4 sm:px-6 lg:px-8">
          <div className="rounded-[24px] bg-[var(--card)] border border-[var(--border)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--secondary)]">
                  <tr>
                    <th className="text-start p-4">{locale === "ar" ? "الميزة" : "Feature"}</th>
                    <th className="p-4 text-center">الواجهة</th>
                    <th className="p-4 text-center bg-[var(--accent)] text-black">الواجهة بلس</th>
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
