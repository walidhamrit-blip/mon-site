import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Check, Scale, X } from "lucide-react";
import { getSiteDataCached } from "@/lib/store";
import { breadcrumbJsonLd, faqJsonLd, pageMetadata, webPageJsonLd } from "@/lib/seo";
import {
  comparePath,
  comparisonIds,
  comparisonsHubFaqs,
  comparisonsCollectionJsonLd,
  comparisonText,
  getComparison,
} from "@/lib/comparisons";
import { JsonLd } from "@/components/json-ld";
import { Price } from "@/components/price";

/**
 * Hub des comparaisons (/compare) — la page « thème » du cluster SEO.
 *
 * Elle centralise les comparaisons (annonces) et renvoie vers chaque page
 * comparative : un hub + N pages = un silo SEO cohérent, avec des liens
 * internes dans les deux sens.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { config } = await getSiteDataCached();
  return pageMetadata(config, {
    path: "/compare",
    title: "مقارنات صريحة — نخبة مقابل الإعلانات والقوالب والمستقلين",
    description:
      "مقارنات صريحة بين نخبة وإعلانات جوجل وفيسبوك ومنشئات المواقع والمستقلين واشتراكات SEO: التكلفة، السرعة، ملكية العملاء والأثر بعد المشروع.",
    keywords: [
      "مقارنة المواقع",
      "مقارنة إعلانات جوجل",
      "نخبة ضد Wix",
      "مقارنة أسعار تصميم المواقع",
      "website vs ads",
      "web agency comparison",
    ],
  });
}

export default async function CompareHubPage() {
  const { config } = await getSiteDataCached();
  const sitePriceUsd = config.pricing.plans[0]?.priceUsd ?? 300;
  const items = comparisonIds
    .map((id) => getComparison(id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(config, [
            { name: "الرئيسية", path: "/" },
            { name: "المقارنات", path: "/compare" },
          ]),
          webPageJsonLd(config, {
            path: "/compare",
            name: "مقارنات صريحة — نخبة Nukhba",
            description:
              "مقارنات صريحة: إعلانات جوجل وفيسبوك ومنشئات المواقع والمستقلون واشتراكات SEO، مقابل موقع نخبة. التكلفة والملكية والسرعة والأثر بعد المشروع.",
            speakable: ["h1", "#compare-answer"],
            about: "مقارنات تصميم المواقع والإعلانات",
          }),
          comparisonsCollectionJsonLd(config, items),
          faqJsonLd(comparisonsHubFaqs),
        ]}
      />

      <div className="pt-6">
        {/* En-tête */}
        <section className="section-tight border-b border-[var(--border)] bg-[var(--secondary)]/35">
          <div className="site-container px-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
              <Link
                href="/"
                className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 transition-colors hover:border-[var(--accent)]"
              >
                ← الرئيسية
              </Link>
              <span className="rounded-full border border-[var(--accent)]/35 bg-[var(--accent)]/12 px-3 py-1 text-[var(--accent)]">
                <Scale className="me-1 inline h-3 w-3" />
                مقارنات صريحة
              </span>
            </div>

            <h1 className="mt-6 max-w-[26ch] text-[clamp(1.8rem,1.2rem+2.2vw,2.85rem)] font-black leading-[1.08] tracking-[-0.03em] text-balance">
              مقارنة صريحة: نخبة مقابل كل بديل
            </h1>
            <p className="mt-4 max-w-[66ch] text-[15.5px] leading-8 text-[var(--muted-foreground)]">
              لا نبيع الأوهام. في كل مقارنة نضع التكلفة والسرعة وملكية العملاء
              والأثر بعد المشروع — مع الإشارة إلى الحالات التي يكون فيها الخيار الآخر
              منطقياً.
            </p>
            <p dir="ltr" className="mt-2 max-w-[66ch] text-[13px] text-[var(--muted-foreground)]/75">
              No hype: every comparison lays out cost, speed, customer ownership
              and what survives after the project ends.
            </p>

            <div
              id="compare-answer"
              className="mt-7 max-w-[74ch] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow-xs)]"
            >
              <p className="text-sm leading-7 opacity-80">
                <strong>باختصار:</strong> الإعلانات المدفوعة تشتري زيارات مؤقتة،
                ومنشئات المواقع الجاهزة تفرض تجديداً سنوياً، والمستقل
                لا يضمن موعداً ولا دعماً. نخبة تبني أصلاً تملكه: دفعة واحدة
                تبدأ من <Price usd={sitePriceUsd} />، تسليم من 7 أيام، و SEO
                مدمج من اليوم الأول.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/contact"
                className="h-11 px-6 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] inline-flex items-center justify-center text-sm font-bold"
              >
                اطلب عرض سعر مجاني
              </Link>
              <Link
                href="/pricing"
                className="h-11 px-6 rounded-full border border-[var(--border)] bg-[var(--card)] inline-flex items-center justify-center text-sm font-bold hover:bg-[var(--secondary)]"
              >
                شاهد الباقات
              </Link>
            </div>
          </div>
        </section>

        {/* Liste des comparaisons */}
        <section className="py-10 border-b border-[var(--border)]">
          <div className="site-container px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-black">كل المقارنات</h2>
            <p dir="ltr" className="mt-1 text-sm opacity-60">
              {items.length} comparisons — pick the one that matches your question
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {items.map((comparison) => (
                <Link
                  key={comparison.id}
                  href={comparePath(comparison.id)}
                  className="group rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-6 transition-colors hover:border-[var(--accent)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black leading-snug">
                        {comparison.h1Ar}
                      </h3>
                      <p dir="ltr" className="mt-1 text-xs opacity-55">
                        {comparison.competitorEn} vs Nukhba
                      </p>
                    </div>
                    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[var(--border)] text-[var(--accent)] transition-colors group-hover:bg-[var(--accent)] group-hover:text-[var(--accent-foreground)]">
                      <ArrowUpRight className="h-4 w-4" />
                    </span>
                  </div>

                  <p className="mt-3 text-sm opacity-70 leading-6">
                    {comparisonText(comparison.descriptionAr, config.market, "ar")}
                  </p>

                  {/* L'annonce en miniature */}
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-[#C1272D]/10 p-3">
                      <p className="flex items-center gap-1 font-black text-[#C1272D]">
                        <X className="h-3 w-3" />
                        {comparison.competitorAr}
                      </p>
                      <p dir="ltr" className="mt-1 font-black text-[#C1272D]">
                        {comparison.themPriceLabel}
                      </p>
                    </div>
                    <div className="rounded-xl bg-[#0E9F6E]/10 p-3">
                      <p className="flex items-center gap-1 font-black text-[#0E9F6E]">
                        <Check className="h-3 w-3" />
                        نخبة Nukhba
                      </p>
                      <p className="mt-1 font-black text-[#0E9F6E]">
                        {comparison.usPriceLabelAr}
                      </p>
                    </div>
                  </div>

                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-[var(--accent)] group-hover:underline">
                    اقرأ المقارنة كاملة ←
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-10 border-b border-[var(--border)] bg-[var(--secondary)]/20">
          <div className="site-container px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-black">أسئلة شائعة عن المقارنات</h2>
            <div className="mt-6 grid md:grid-cols-2 gap-4">
              {comparisonsHubFaqs.map((faq, index) => (
                <div
                  key={index}
                  className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-6"
                >
                  <h3 className="font-bold">{faq.qAr}</h3>
                  <p dir="ltr" className="mt-1 text-xs opacity-50">
                    {faq.qEn}
                  </p>
                  <p className="mt-3 text-sm opacity-70 leading-6">{faq.aAr}</p>
                  <p dir="ltr" className="mt-1 text-sm opacity-50 leading-6">
                    {faq.aEn}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-10">
          <div className="site-container px-4 sm:px-6 lg:px-8">
            <div className="rounded-[var(--radius-lg)] bg-[var(--primary)] p-8 text-[var(--primary-foreground)] shadow-[var(--shadow-lg)] lg:flex-row lg:items-center lg:justify-between lg:p-10">
              <div>
                <h2 className="text-2xl font-black">
                  قرأت المقارنة؟ احصل على عرض سعر خلال ساعتين
                </h2>
                <p className="mt-2 opacity-70 max-w-[60ch]">
                  أرسل لنا نشاطك وميزانيتك التقريبية، ونرد بعرض سعر مكتوب ومدّة
                  تسليم — دون التزام.
                </p>
              </div>
              <div className="mt-6 lg:mt-0 flex flex-wrap gap-3 shrink-0">
                <Link
                  href="/contact"
                  className="h-11 px-6 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] inline-flex items-center justify-center font-bold"
                >
                  اطلب عرض سعر
                </Link>
                <Link
                  href="/services"
                  className="h-11 px-6 rounded-full bg-white/10 border border-white/20 inline-flex items-center justify-center font-bold hover:bg-white/15"
                >
                  الخدمات السريعة
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
