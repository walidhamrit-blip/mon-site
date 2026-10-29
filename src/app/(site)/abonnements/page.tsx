import type { Metadata } from "next";
import Link from "next/link";
import { getSiteDataCached } from "@/lib/store";
import { absoluteUrl, pageMetadata, siteLocale } from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import {
  SUBSCRIPTION_GRACE_DAYS,
  SUBSCRIPTION_PLANS,
} from "@/lib/subscription-plans";
import { AbonnementsClient } from "./abonnements-client";

export async function generateMetadata(): Promise<Metadata> {
  const { config } = await getSiteDataCached();
  const locale = siteLocale(config);
  return pageMetadata(config, {
    path: "/abonnements",
    title:
      locale === "ar"
        ? "اشتراكات شهرية وسنوية للمواقع — نخبة"
        : "Monthly & Yearly Website Subscriptions — Nukhba",
    description:
      locale === "ar"
        ? "اشترك شهرياً أو سنوياً في باقات الواجهة والمتجر، وادفع بالعملات الرقمية عبر NOWPayments. تُجدَّد الاشتراكات تلقائياً عبر رابط دفع يصلك بالبريد الإلكتروني."
        : "Subscribe monthly or yearly to Vitrine and Boutique plans and pay in crypto via NOWPayments. Renewals are automatic via a payment link sent by email.",
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
export default async function AbonnementsPage() {
  const { config } = await getSiteDataCached();
  const locale = siteLocale(config);
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

  const tiers = [
    {
      name: ar ? "الواجهة" : "Vitrine",
      monthly: 10,
      annual: 69,
      note: ar
        ? "موقع واجهة من 5 صفحات، نموذج تواصل وواتساب."
        : "5-page showcase site, contact form and WhatsApp.",
    },
    {
      name: ar ? "الواجهة بلس" : "Vitrine+",
      monthly: 12,
      annual: 89,
      note: ar
        ? "حتى 10 صفحات، مدونة، حجز أو حجز مواعيد وخرائط."
        : "Up to 10 pages, blog, booking and maps.",
    },
    {
      name: ar ? "المتجر / الحجز" : "Boutique",
      monthly: 25,
      annual: 199,
      note: ar
        ? "متجر أو نظام حجز كامل مع لوحة إدارة وإشعارات."
        : "Full store or booking system with dashboard and notifications.",
    },
  ];

  const faqs = ar
    ? [
        {
          q: "ما الفرق بين الاشتراك والدفعة الواحدة؟",
          a: "الاشتراك يوزّع تكلفة الموقع والاستضافة والصيانة على دفعات شهرية أو سنوية؛ الدفعة الواحدة تشتري النموذج والتخصيص نهائياً. الاشتراك مناسب من يريد بداية أخفّ والتزاماً شهرياً، والدفعة الواحدة من يفضّل تملكاً كاملاً بلا تجديد.",
        },
        {
          q: "كيف يتم التجديد؟",
          a: `يُرسل رابط دفع جديد قبل انتهاء الدورة، ويُجدَّد الاشتراك تلقائياً بعد الدفع. إذا تعذّر الدفع، يبقى الموقع عاملاً مدة سماح ${SUBSCRIPTION_GRACE_DAYS} أيام قبل التعليق.`,
        },
        {
          q: "هل يمكن إلغاء الاشتراك؟",
          a: "نعم، يمكنك إيقاف التجديد في أي وقت قبل تاريخ الاستحقاق. يبقى الموقع عاملاً حتى نهاية الدورة المدفوعة، دون غرامة إلغاء.",
        },
        {
          q: "هل الأسعار بالدولار؟",
          a: "نعم، كل الأسعار بالدولار الأمريكي (1 دولار = 1 USDT)، وتُدفع بالعملات الرقمية عبر NOWPayments، دون رسوم مخفية.",
        },
        {
          q: "هل يشمل الاشتراك الاستضافة والدومين؟",
          a: "الاشتراك يشمل الاستضافة السريعة وشهادة SSL والتحديثات الأمنية. الدومين يبقى باسمك، ونساعدك في ربطه مجاناً.",
        },
      ]
    : [
        {
          q: "How is a subscription different from a one-off payment?",
          a: "A subscription spreads the website, hosting and maintenance cost over monthly or yearly payments. A one-off payment buys the model and customization outright. Choose the subscription for a lighter start with a monthly commitment.",
        },
        {
          q: "How does renewal work?",
          a: `We send a new payment link before the period ends and renew automatically once paid. If payment fails, the site keeps running for a ${SUBSCRIPTION_GRACE_DAYS}-day grace period before suspension.`,
        },
        {
          q: "Can I cancel?",
          a: "Yes — you can stop auto-renewal at any time before the renewal date. The site keeps running until the end of the paid period, with no cancellation fee.",
        },
        {
          q: "Are prices in USD?",
          a: "Yes. Every price is in US dollars (1 USD = 1 USDT), paid in crypto via NOWPayments, with no hidden fees.",
        },
        {
          q: "Does the subscription include hosting and the domain?",
          a: "It includes fast hosting, SSL and security updates. The domain stays in your name and we connect it for free.",
        },
      ];

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${absoluteUrl(config, "/abonnements")}#faq`,
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
                ? "الأسعار بالدولار الأمريكي وتُدفع بنفس المبلغ بـ USDT عبر NOWPayments. الاشتراك السنوي يوفّر نحو شهرين مقارنة بالدفع الشهري."
                : "Prices are in US dollars and paid 1:1 in USDT via NOWPayments. The yearly plan saves about two months compared with paying monthly."}
            </p>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-[14px]">
                <thead>
                  <tr className="text-start text-[12px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                    <th className="border-b border-[var(--border)] px-3 py-2 text-start">
                      {ar ? "الباقة" : "Plan"}
                    </th>
                    <th className="border-b border-[var(--border)] px-3 py-2 text-start">
                      {ar ? "شهرياً" : "Monthly"}
                    </th>
                    <th className="border-b border-[var(--border)] px-3 py-2 text-start">
                      {ar ? "سنوياً" : "Yearly"}
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
              {ar ? " — أو قارن الباقات الكاملة في " : " — or compare the full plans on "}
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
