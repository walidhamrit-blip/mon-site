"use client";
import Link from "next/link";
import { Pricing } from "@/components/sections/pricing";
import { FAQ } from "@/components/sections/faq";
import { useI18n } from "@/lib/i18n";
import { CRYPTO_GUIDE_PATH } from "@/lib/blog";

export function PricingClient() {
  const { locale, t } = useI18n();
  const ar = locale === "ar";
  const p = t.pricingTable;
  const pick = <T,>(arValue: T, enValue: T): T => (ar ? arValue : enValue);

  /**
   * Tableau comparatif des formules : chaque ligne existe en arabe et en
   * anglais, la page affiche la version de la langue active.
   */
  const rows: ReadonlyArray<readonly [string, string, string, string]> = ar
    ? [
        [p.rowPagesAr, "5", "10", "∞"],
        [p.rowBlogAr, "—", "✓", "✓"],
        [p.rowBookingAr, "—", p.bookingAr, p.fullStoreAr],
        [p.rowLanguagesAr, "—", "✓", "✓"],
        [p.rowSeoAr, p.seoBasicAr, p.seoAdvancedAr, p.seoAdvancedPlusAr],
        [p.rowSupportAr, p.daysAr.replace("{count}", "30"), p.daysAr.replace("{count}", "60"), p.daysAr.replace("{count}", "90")],
      ]
    : [
        [p.rowPagesEn, "5", "10", "∞"],
        [p.rowBlogEn, "—", "✓", "✓"],
        [p.rowBookingEn, "—", p.bookingEn, p.fullStoreEn],
        [p.rowLanguagesEn, "—", "✓", "✓"],
        [p.rowSeoEn, p.seoBasicEn, p.seoAdvancedEn, p.seoAdvancedPlusEn],
        [p.rowSupportEn, p.daysEn.replace("{count}", "30"), p.daysEn.replace("{count}", "60"), p.daysEn.replace("{count}", "90")],
      ];

  return (
    <div className="pt-2">
      <section className="pb-[calc(var(--section-y)*0.55)] border-b border-[var(--border)] bg-[var(--secondary)]/35">
        <div className="site-container px-4 text-center sm:px-6 lg:px-8">
          <span className="section-eyebrow is-centered justify-center">
            {locale === "ar" ? "الأسعار" : "Pricing"}
          </span>
          <h1 className="section-title mx-auto max-w-[20ch]">
            {locale === "ar" ? "باقات واضحة — بلا مفاجآت" : "Clear plans — no surprises"}
          </h1>
          <p className="section-lead mx-auto">
            {locale === "ar"
              ? "اختر نموذج الموقع، ثم راجع تكلفة التخصيص كبند منفصل. الإجمالي النهائي يظهر قبل الدفع؛ وإذا كان التخصيص يحتاج تقديراً، نرسل عرضاً مكتوباً للموافقة أولاً. الدفع الكامل أو 2–3 أقساط بالعملات الرقمية."
              : "Choose a website model, then review its separate customization fee. The full total appears before checkout; if customization needs scoping, approve a written quote first. Pay in full or in 2–3 crypto installments."}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Link
              href={CRYPTO_GUIDE_PATH}
              className="inline-flex max-w-full items-center justify-center rounded-full border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-4 py-2 text-center text-[12.5px] font-bold leading-snug text-[color-mix(in_srgb,var(--accent)_72%,var(--foreground))] transition-colors hover:bg-[var(--accent)]/15"
            >
              {locale === "ar"
                ? "دليل الدفع بالكريبتو خطوة بخطوة — بالصور"
                : "Step-by-step crypto payment guide — with photos"}
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
                    <th className="text-start p-4">{pick(p.featureAr, p.featureEn)}</th>
                    <th className="p-4 text-center">{pick(p.websiteAr, p.websiteEn)}</th>
                    <th className="p-4 text-center bg-[var(--accent)] text-[var(--accent-foreground)]">
                      {pick(p.websitePlusAr, p.websitePlusEn)}
                    </th>
                    <th className="p-4 text-center">{pick(p.storeAr, p.storeEn)}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {rows.map((row) => (
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
