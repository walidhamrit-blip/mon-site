import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Clock,
  MessageCircle,
  Scale,
  ShieldCheck,
  X,
} from "lucide-react";
import { getSiteDataCached } from "@/lib/store";
import { whatsappLink } from "@/lib/utils";
import { breadcrumbJsonLd, pageMetadata, webPageJsonLd } from "@/lib/seo";
import {
  comparePath,
  comparisonCriteriaJsonLd,
  comparisonFaqJsonLd,
  comparisonIds,
  comparisonServiceJsonLd,
  getComparison,
  relatedComparisons,
} from "@/lib/comparisons";
import { JsonLd } from "@/components/json-ld";
import { Price } from "@/components/price";
import { findService } from "@/lib/services";

/**
 * Page comparative (/compare/[slug]) — l'« annonce » SEO du site.
 *
 * La page est entièrement dérivée de `src/lib/comparisons.ts` : ajouter une
 * comparaison dans ce fichier suffit à publier une nouvelle page (avec son
 * Open Graph, ses schémas, son sitemap et ses liens). Aucun câblage ici.
 */
export async function generateStaticParams() {
  return comparisonIds.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const comparison = getComparison(slug);
  const { config } = await getSiteDataCached();
  if (!comparison) {
    return pageMetadata(config, {
      path: comparePath(slug),
      title: "مقارنة غير موجودة",
      description: "هذه المقارنة غير متاحة حالياً.",
      noindex: true,
    });
  }
  return pageMetadata(config, {
    path: comparePath(comparison.id),
    title: comparison.titleAr,
    description: comparison.descriptionAr,
    // opengraph-image.tsx génère la carte « annonce » 1200×630 de la page.
    image: false,
    keywords: [
      ...comparison.keywordsAr,
      ...comparison.keywordsEn,
      comparison.competitorAr,
      comparison.competitorEn,
    ],
  });
}

export default async function ComparisonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const comparison = getComparison(slug);
  if (!comparison) notFound();

  const { config } = await getSiteDataCached();

  // Prix vivants : le site part du modèle le moins cher, les services à la
  // carte du service le moins cher. Ils sont pilotables depuis /admin.
  const sitePriceUsd = config.pricing.plans[0]?.priceUsd ?? 300;
  const servicePriceUsd = config.standaloneServices.reduce(
    (min, service) => Math.min(min, service.priceFromUsd),
    Number.POSITIVE_INFINITY,
  );
  const lowestServiceUsd = Number.isFinite(servicePriceUsd) ? servicePriceUsd : 15;

  const related = relatedComparisons(comparison.id);
  const relatedServices = comparison.relatedServices
    .map((id) => findService(config.standaloneServices, id))
    .filter((service): service is NonNullable<typeof service> => Boolean(service));

  const whatsappUrl = whatsappLink(
    config.whatsapp,
    `مرحبا نخبة 👋 قرأت مقارنة «${comparison.h1Ar}» وأريد عرض سعر لموقعي.`,
  );

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(config, [
            { name: "الرئيسية", path: "/" },
            { name: "المقارنات", path: "/compare" },
            { name: comparison.h1Ar, path: comparePath(comparison.id) },
          ]),
          webPageJsonLd(config, {
            path: comparePath(comparison.id),
            name: comparison.h1Ar,
            description: comparison.answerAr,
            speakable: ["h1", "#compare-answer"],
            about: `${comparison.competitorEn} — Nukhba comparison`,
          }),
          comparisonServiceJsonLd(config, comparison, sitePriceUsd),
          comparisonCriteriaJsonLd(config, comparison),
          comparisonFaqJsonLd(comparison),
        ]}
      />

      <div className="pt-6">
        {/* ── En-tête ─────────────────────────────────────────────────── */}
        <section className="section-tight border-b border-[var(--border)] bg-[var(--secondary)]/35">
          <div className="site-container px-4 sm:px-6 lg:px-8">
            <nav
              aria-label="مسار التصفح"
              className="flex flex-wrap items-center gap-2 text-xs font-bold"
            >
              <Link
                href="/compare"
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)]"
              >
                <ArrowLeft className="h-3 w-3" />
                كل المقارنات
              </Link>
              <span className="rounded-full border border-[var(--accent)]/35 bg-[var(--accent)]/12 px-3 py-1 text-[var(--accent)]">
                <Scale className="me-1 inline h-3 w-3" />
                مقارنة صريحة
              </span>
            </nav>

            <h1 className="mt-6 max-w-[28ch] text-[clamp(1.8rem,1.2rem+2.2vw,2.85rem)] font-black leading-[1.08] tracking-[-0.03em] text-balance">
              {comparison.h1Ar}
            </h1>
            <p className="mt-4 max-w-[66ch] text-[15.5px] leading-8 text-[var(--muted-foreground)]">
              {comparison.subtitleAr}
            </p>
            <p
              dir="ltr"
              className="mt-2 max-w-[66ch] text-[13px] text-[var(--muted-foreground)]/75"
            >
              {comparison.subtitleEn}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/contact"
                className="h-11 px-6 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] inline-flex items-center justify-center text-sm font-bold"
              >
                {comparison.ctaAr}
              </Link>
              <Link
                href="/pricing"
                className="h-11 px-6 rounded-full border border-[var(--border)] bg-[var(--card)] inline-flex items-center justify-center text-sm font-bold hover:bg-[var(--secondary)]"
              >
                شاهد الباقات والأسعار
              </Link>
            </div>
          </div>
        </section>

        {/* ── L'annonce : deux colonnes (rouge / vert) ─────────────────── */}
        <section className="py-10 border-b border-[var(--border)]">
          <div className="site-container px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 gap-4">
              {/* Colonne rouge — l'alternative */}
              <div className="rounded-[var(--radius-lg)] bg-[#C1272D] text-white p-6 sm:p-8 flex flex-col">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-white/20">
                    <X className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-lg font-black leading-tight">
                      {comparison.competitorAr}
                    </p>
                    <p dir="ltr" className="text-xs opacity-80">
                      {comparison.competitorEn}
                    </p>
                  </div>
                </div>

                <p dir="ltr" className="mt-6 text-[clamp(2rem,1.4rem+2.4vw,3rem)] font-black leading-none">
                  {comparison.themPriceLabel}
                </p>
                <p className="mt-2 text-xs opacity-85">{comparison.themPriceAr}</p>

                <ul className="mt-6 space-y-3 text-sm leading-6">
                  {comparison.themPoints.map((point) => (
                    <li key={point.textEn} className="flex gap-2.5">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/20">
                        <X className="h-3 w-3" />
                      </span>
                      <span>{point.textAr}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Colonne verte — نخبة */}
              <div className="rounded-[var(--radius-lg)] bg-[#0E9F6E] text-white p-6 sm:p-8 flex flex-col">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-white/20">
                    <Check className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-lg font-black leading-tight">
                      نخبة Nukhba
                    </p>
                    <p dir="ltr" className="text-xs opacity-85">
                      Premium Web Agency
                    </p>
                  </div>
                </div>

                <p className="mt-6 text-[clamp(2rem,1.4rem+2.4vw,3rem)] font-black leading-none">
                  {comparison.usPriceLabelAr}
                </p>
                <p className="mt-2 text-xs opacity-90">
                  {comparison.usPriceNoteAr} — موقع من <Price usd={sitePriceUsd} compact />{" "}
                  · خدمات من <Price usd={lowestServiceUsd} compact />
                </p>

                <ul className="mt-6 space-y-3 text-sm leading-6">
                  {comparison.usPoints.map((point) => (
                    <li key={point.textEn} className="flex gap-2.5">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/25">
                        <Check className="h-3 w-3" />
                      </span>
                      <span>{point.textAr}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/contact"
                  className="mt-7 h-11 px-6 rounded-full bg-white text-[#0E9F6E] inline-flex items-center justify-center text-sm font-black hover:bg-white/90"
                >
                  {comparison.ctaAr}
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── Réponse directe (GEO / assistants IA) ────────────────────── */}
        <section className="py-10 border-b border-[var(--border)]">
          <div className="site-container px-4 sm:px-6 lg:px-8">
            <div
              id="compare-answer"
              className="max-w-[78ch] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow-xs)]"
            >
              <h2 className="text-lg font-black">باختصار — الجواب المباشر</h2>
              <p className="mt-3 text-[15px] leading-8 opacity-80">{comparison.answerAr}</p>
              <p dir="ltr" className="mt-3 text-[13px] leading-6 opacity-60">
                {comparison.answerEn}
              </p>
            </div>
          </div>
        </section>

        {/* ── Tableau comparatif ligne par ligne ──────────────────────── */}
        <section className="py-10 border-b border-[var(--border)]">
          <div className="site-container px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-black">المقارنة التفصيلية</h2>
            <p dir="ltr" className="mt-1 text-sm opacity-60">
              {comparison.competitorEn} vs Nukhba — line by line
            </p>

            <div className="mt-6 overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border)]">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="bg-[var(--secondary)]/60">
                    <th className="text-start p-4 font-black w-[26%]">المعيار</th>
                    <th className="text-start p-4 font-black text-[#C1272D] w-[37%]">
                      {comparison.competitorAr}
                    </th>
                    <th className="text-start p-4 font-black text-[#0E9F6E] w-[37%]">
                      نخبة Nukhba
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.criteria.map((criterion) => (
                    <tr key={criterion.labelEn} className="border-t border-[var(--border)] align-top">
                      <th scope="row" className="text-start p-4 font-bold">
                        {criterion.labelAr}
                        <span dir="ltr" className="block text-[11px] font-normal opacity-50">
                          {criterion.labelEn}
                        </span>
                      </th>
                      <td className="p-4 opacity-75">
                        <span className="flex gap-2">
                          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#C1272D]/12 text-[#C1272D]">
                            <X className="h-3 w-3" />
                          </span>
                          <span>
                            {criterion.themAr ?? "غير متوفر ضمن الخدمة"}
                            {criterion.themEn ? (
                              <span dir="ltr" className="block text-[11px] opacity-50">
                                {criterion.themEn}
                              </span>
                            ) : null}
                          </span>
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="flex gap-2">
                          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#0E9F6E]/12 text-[#0E9F6E]">
                            <Check className="h-3 w-3" />
                          </span>
                          <span>
                            {criterion.usAr}
                            <span dir="ltr" className="block text-[11px] opacity-50">
                              {criterion.usEn}
                            </span>
                          </span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── متى تختار أي خيار (صراحة تحريرية) ───────────────────────── */}
        <section className="py-10 border-b border-[var(--border)] bg-[var(--secondary)]/20">
          <div className="site-container px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-black">متى يكون كل خيار منطقياً؟</h2>
            <p dir="ltr" className="mt-1 text-sm opacity-60">
              When each option actually makes sense
            </p>

            <div className="mt-6 grid md:grid-cols-2 gap-4">
              <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-6">
                <h3 className="flex items-center gap-2 font-black">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-[#C1272D]/12 text-[#C1272D]">
                    <X className="h-4 w-4" />
                  </span>
                  اختر {comparison.competitorAr} إذا
                </h3>
                <ul className="mt-4 space-y-2.5 text-sm opacity-80">
                  {comparison.chooseThemAr.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#C1272D]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-[var(--radius-lg)] border border-[#0E9F6E]/35 bg-[#0E9F6E]/8 p-6">
                <h3 className="flex items-center gap-2 font-black">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-[#0E9F6E]/15 text-[#0E9F6E]">
                    <Check className="h-4 w-4" />
                  </span>
                  اختر نخبة إذا
                </h3>
                <ul className="mt-4 space-y-2.5 text-sm opacity-80">
                  {comparison.chooseUsAr.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0E9F6E]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────────── */}
        <section className="py-10 border-b border-[var(--border)]">
          <div className="site-container px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-black">
              أسئلة شائعة — {comparison.h1Ar}
            </h2>
            <p dir="ltr" className="mt-1 text-sm opacity-60">
              FAQ — {comparison.competitorEn} vs Nukhba
            </p>
            <div className="mt-6 grid md:grid-cols-2 gap-4">
              {comparison.faqs.map((faq, index) => (
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

        {/* ── CTA + maillage interne ───────────────────────────────────── */}
        <section className="py-10">
          <div className="site-container px-4 sm:px-6 lg:px-8">
            <div className="rounded-[var(--radius-lg)] bg-[var(--primary)] p-8 text-[var(--primary-foreground)] shadow-[var(--shadow-lg)] lg:flex-row lg:items-center lg:justify-between lg:p-10">
              <div>
                <h2 className="text-2xl font-black">خلاصة المقارنة</h2>
                <p className="mt-2 opacity-70 max-w-[60ch]">
                  {comparison.usPriceNoteAr} — نموذج من <Price usd={sitePriceUsd} />{" "}
                  مع تحسين SEO وبيانات منظمة، أو خدمة واحدة من{" "}
                  <Price usd={lowestServiceUsd} />. الاستشارة مجانية والسعر مكتوب
                  قبل البدء.
                </p>
                <ul className="mt-4 flex flex-wrap gap-4 text-sm opacity-85">
                  <li className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    تسليم من 7 أيام
                  </li>
                  <li className="flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4" />
                    ملكية كاملة للملفات
                  </li>
                  <li className="flex items-center gap-1.5">
                    <MessageCircle className="h-4 w-4" />
                    رد خلال ساعتين
                  </li>
                </ul>
              </div>
              <div className="mt-6 lg:mt-0 flex flex-wrap gap-3 shrink-0">
                <Link
                  href="/contact"
                  className="h-11 px-6 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] inline-flex items-center justify-center font-bold"
                >
                  اطلب عرض سعر مجاني
                </Link>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-11 px-6 rounded-full bg-white/10 border border-white/20 inline-flex items-center justify-center font-bold hover:bg-white/15"
                >
                  واتساب الآن
                </a>
              </div>
            </div>

            {/* Comparaisons liées */}
            {related.length > 0 && (
              <div className="mt-10">
                <h3 className="text-sm font-bold opacity-60">مقارنات أخرى</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {related.map((item) => (
                    <Link
                      key={item.id}
                      href={comparePath(item.id)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--card)] border border-[var(--border)] text-sm font-medium hover:border-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors"
                    >
                      {item.competitorAr}
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Services liés */}
            {relatedServices.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-bold opacity-60">الخدمات المرتبطة</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {relatedServices.map((service) => (
                    <Link
                      key={service.id}
                      href={`/services/${service.id}`}
                      className="px-4 py-2 rounded-full bg-[var(--card)] border border-[var(--border)] text-sm font-medium hover:border-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors"
                    >
                      {service.titleAr}
                    </Link>
                  ))}
                  <Link
                    href="/pricing"
                    className="px-4 py-2 rounded-full bg-[var(--card)] border border-[var(--border)] text-sm font-bold text-[var(--accent)] hover:border-[var(--accent)] transition-colors"
                  >
                    كل الباقات
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
