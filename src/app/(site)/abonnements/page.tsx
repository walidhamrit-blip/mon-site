import type { Metadata } from "next";
import { pageLocale } from "@/lib/locale-server";
import type { LocalePageProps } from "@/lib/locale";
import { localizedAbsoluteUrl } from "@/lib/locale";
import { LocalizedLink as Link } from "@/components/localized-link";
import { getSiteDataCachedShared as getSiteDataCached } from "@/lib/catalog-cache";
import { absoluteUrl, pageMetadata, siteLocale } from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import {
  SUBSCRIPTION_GRACE_DAYS,
  SUBSCRIPTION_PLANS,
  maintenanceTiers,
} from "@/lib/subscription-plans";
import { AbonnementsClient } from "./abonnements-client";
import { WEBSITE_BASE_PRICE_USD } from "@/lib/website-offer";

export async function generateMetadata({ searchParams }: LocalePageProps): Promise<Metadata> {
  const { config } = await getSiteDataCached();
  const locale = await pageLocale(config, searchParams);
  return pageMetadata(config, {
    locale,
    path: "/abonnements",
    title:
      locale === "ar"
        ? "اشتراكات صيانة مواقع اختيارية — نخبة"
        : "Optional Website Maintenance Subscriptions — Nukhba",
    description: locale === "ar"
      ? "اشتراكات صيانة اختيارية لموقع موجود. إنشاء الموقع والوظائف الإضافية منفصلة. يتطلب التجديد دفع الفاتورة؛ لا يوجد خصم تلقائي من محفظتك."
      : "Optional maintenance for an existing website. Website creation and new modules are separate. Renewal requires paying the invoice; no automatic wallet debit.",
    keywords: [
      "اشتراك موقع شهري",
      "دفع بالعملات الرقمية",
      "subscription website Libya",
    ],
  });
}

/**
 * Page des abonnements.
 *
 * Le tunnel de souscription est un composant client, mais l'essentiel du
 * contenu (prix, fonctionnement, FAQ) est rendu **côté serveur** : cette page
 * ne comptait que ~250 mots, ce qui la rendait inéligible à un bon classement
 * sur « اشتراك موقع » alors qu'elle porte une offre commerciale réelle.
 */
export default async function AbonnementsPage({ searchParams }: LocalePageProps) {
  const { config } = await getSiteDataCached();
  const locale = await pageLocale(config, searchParams);
  const ar = locale === "ar";
  const plans = SUBSCRIPTION_PLANS.map((plan) => ({
    id: plan.id,
    tier: plan.tier,
    cycle: plan.cycle,
    name: plan.name,
    nameEn: plan.nameEn,
    priceUsd: plan.priceUsd,
    intervalDay: plan.intervalDay,
  }));

  const tiers = maintenanceTiers().map(tier => ({
    name: ar ? tier.name : tier.nameEn,
    monthly: tier.monthly.priceUsd,
    annual: tier.annual.priceUsd,
    note: ar ? tier.noteAr : tier.noteEn,
  }));

  const faqs = ar
    ? [
        {
          q: "ما الفرق بين الاشتراك والدفعة الواحدة؟",
          a: `اشتراكات الصيانة خدمات اختيارية منفصلة وليست فئات لتسعير التصميم. الموقع الثابت بسعر ${WEBSITE_BASE_PRICE_USD} دولاراً يشمل لغة واحدة وتخصيص المحتوى الأولي. نشر Vercel وفق أهلية وحدود الخطة؛ الدومين والتكاليف الخارجية منفصلة. الاشتراكات القائمة تحتفظ بشروطها المتفق عليها.`,

        },
        {
          q: "كيف يتم التجديد؟",
          a: `يُرسل رابط دفع جديد قبل انتهاء الدورة، ويُجدَّد الاشتراك بعد الدفع؛ لا يوجد خصم تلقائي من المحفظة. إذا تعذّر الدفع، تستمر خدمات الصيانة لفترة سماح ${SUBSCRIPTION_GRACE_DAYS} أيام قبل تعليقها وفق الاتفاق؛ لا تتغير ملكية ملفات الموقع.`,
        },
        {
          q: "هل يمكن إلغاء الاشتراك؟",
          a: "نعم، يمكنك إيقاف التجديد في أي وقت قبل تاريخ الاستحقاق. تستمر خدمات الصيانة حتى نهاية الدورة المدفوعة، دون غرامة إلغاء؛ الاستضافة تخضع لشروطها المنفصلة.",
        },
        {
          q: "هل الأسعار بالدولار؟",
          a: "نعم، كل الأسعار بالدولار الأمريكي (1 دولار = 1 USDT)، وتُدفع بالعملات الرقمية عبر NOWPayments، دون رسوم مخفية.",
        },
        {
          q: "هل يشمل الاشتراك الاستضافة والدومين؟",
          a: "الصيانة تخص موقعاً موجوداً وفق نطاق مكتوب. الاستضافة والتكاليف الخارجية وربط الدومين تحدد قبل الاشتراك؛ شراء الدومين ليس مشمولاً تلقائياً. الاتفاقات القائمة تحتفظ بشروطها.",
        },
      ]
    : [
        {
          q: "How is a subscription different from a one-off payment?",
          a: `Maintenance subscriptions are separate optional services, not website price categories. The $${WEBSITE_BASE_PRICE_USD} static website includes one language and initial personalization. Vercel deployment depends on plan eligibility and limits; custom domains and external recurring costs are separate. Existing subscriptions retain their agreed terms.`,
        },
        {
          q: "How does renewal work?",
          a: `We send a new payment link before the period ends and renew once paid; there is no automatic wallet debit. If payment fails, maintenance continues for a ${SUBSCRIPTION_GRACE_DAYS}-day grace period before those services are suspended according to the agreement; ownership of website files is unchanged.`,
        },
        {
          q: "Can I cancel?",
          a: "Yes — you can stop renewal at any time before the renewal date. Maintenance continues until the end of the paid period, with no cancellation fee; hosting retains its separate terms.",
        },
        {
          q: "Are prices in USD?",
          a: "Yes. Every price is in US dollars (1 USD = 1 USDT), paid in crypto via NOWPayments, with no hidden fees.",
        },
        {
          q: "Does the subscription include hosting and the domain?",
          a: "Maintenance covers an existing site within a written scope. Hosting, external costs and domain setup are confirmed before subscribing; domain purchase is not automatically included. Existing agreements retain their terms.",
        },
      ];

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${localizedAbsoluteUrl(config.url, "/abonnements", locale, siteLocale(config))}#faq`,
    inLanguage: ar ? "ar" : "en",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: { "@type": "Answer", text: faq.a },
    })),
  };

  return (
    <>
      <JsonLd data={faqSchema} />
      <main className="pt-6 min-h-[70vh]">
        <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8 py-10">
          <AbonnementsClient plans={plans} graceDays={SUBSCRIPTION_GRACE_DAYS} />

          <section className="mt-14 border-t border-[var(--border)] pt-10">
            <h2 className="text-2xl font-black">
              {ar ? "مقارنة الأسعار: شهري أم سنوي؟" : "Price comparison: monthly or yearly?"}
            </h2>
            <p className="mt-2 max-w-[70ch] text-[14px] leading-7 text-[var(--muted-foreground)]">
              {ar
                ? "الأسعار بالدولار الأمريكي وتُدفع بنفس المبلغ بـ USDT عبر NOWPayments. قارن المبلغ السنوي الكامل بالمبلغ الشهري؛ التوفير يختلف حسب خطة الصيانة."
                : "Prices are in US dollars and paid 1:1 in USDT via NOWPayments. Compare the full annual charge with the monthly charge; savings vary by maintenance plan."}
            </p>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-[14px]">
                <thead>
                  <tr className="text-start text-[12px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                    <th className="border-b border-[var(--border)] px-3 py-2 text-start">
                      {ar ? "الباقة" : "Plan"}
                    </th>
                    <th className="border-b border-[var(--border)] px-3 py-2 text-start">
                      {ar ? "شهرياً (30 يوماً)" : "Monthly (30 days)"}
                    </th>
                    <th className="border-b border-[var(--border)] px-3 py-2 text-start">
                      {ar ? "سنوياً (365 يوماً)" : "Yearly (365 days)"}
                    </th>
                    <th className="border-b border-[var(--border)] px-3 py-2 text-start">
                      {ar ? "ما تشمله" : "What it includes"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tiers.map((tier) => (
                    <tr key={tier.name} className="align-top">
                      <td className="border-b border-[var(--border)] px-3 py-3 font-black">
                        {tier.name}
                      </td>
                      <td className="border-b border-[var(--border)] px-3 py-3" dir="ltr">
                        ${tier.monthly}
                      </td>
                      <td className="border-b border-[var(--border)] px-3 py-3" dir="ltr">
                        ${tier.annual}
                      </td>
                      <td className="border-b border-[var(--border)] px-3 py-3 text-[13px] leading-6 text-[var(--muted-foreground)]">
                        {tier.note}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-12 border-t border-[var(--border)] pt-10">
            <h2 className="text-2xl font-black">
              {ar ? "أسئلة شائعة عن الاشتراكات" : "Subscription FAQ"}
            </h2>
            <div className="mt-5 divide-y divide-[var(--border)] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)]">
              {faqs.map((faq) => (
                <details key={faq.q} className="p-4">
                  <summary className="cursor-pointer list-none text-[14px] font-black leading-6">
                    {faq.q}
                  </summary>
                  <p className="mt-2 text-[13px] leading-7 text-[var(--muted-foreground)]">
                    {faq.a}
                  </p>
                </details>
              ))}
            </div>
            <p className="mt-5 text-[13px] text-[var(--muted-foreground)]">
              {ar ? "لديك سؤال آخر؟ " : "Still have questions? "}
              <Link href="/contact" className="font-bold text-[var(--accent)] hover:underline">
                {ar ? "تواصل معنا" : "Talk to us"}
              </Link>
              {ar ? " — أو شاهد عرض الموقع الأساسي في " : " — or see the base website offer on "}
              <Link href="/pricing" className="font-bold text-[var(--accent)] hover:underline">
                {ar ? "صفحة الأسعار" : "the pricing page"}
              </Link>
              .
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
