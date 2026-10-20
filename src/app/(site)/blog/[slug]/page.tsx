import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Calendar,
  Check,
  Clock,
  List,
  MessageCircle,
  RefreshCw,
  User,
} from "lucide-react";
import { getSiteDataCached } from "@/lib/store";
import {
  absoluteUrl,
  breadcrumbJsonLd,
  pageMetadata,
  webPageJsonLd,
} from "@/lib/seo";
import {
  articleFaqJsonLd,
  articleJsonLd,
  articlePath,
  findArticle,
  formatArticleDate,
  relatedArticles,
} from "@/lib/blog";
import { blogArticles } from "@/lib/blog-articles";
import { getSectorSeo } from "@/lib/sectors";
import { resolveServiceLanding, servicePath } from "@/lib/services";
import { formatLyd, lydLabel, resolvePlanPriceBreakdown } from "@/lib/classification";
import { formatMainPrice } from "@/lib/installments";
import { JsonLd } from "@/components/json-ld";

export async function generateStaticParams() {
  return blogArticles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { config } = await getSiteDataCached();
  const article = findArticle(blogArticles, slug);
  if (!article) {
    return pageMetadata(config, {
      path: articlePath(slug),
      title: "مقال غير موجود",
      description: "هذا المقال غير متاح حالياً.",
      noindex: true,
    });
  }
  return pageMetadata(config, {
    path: articlePath(article.slug),
    title: article.titleAr,
    description: article.descriptionAr,
    // opengraph-image.tsx génère une carte dédiée à l'article.
    image: false,
    keywords: [...article.keywordsAr, ...article.keywordsEn],
  });
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { config, content } = await getSiteDataCached();
  const article = findArticle(blogArticles, slug);
  if (!article) notFound();

  const canonical = absoluteUrl(config, articlePath(article.slug));
  const services = (article.relatedServices ?? [])
    .map((id) => config.standaloneServices.find((service) => service.id === id) ?? null)
    .filter((service): service is NonNullable<typeof service> => Boolean(service));
  const sectors = (article.relatedSectors ?? [])
    .map((id) => getSectorSeo(id))
    .filter((sector): sector is NonNullable<typeof sector> => Boolean(sector));
  const demos = content.demos
    .filter((demo) => (article.relatedSectors ?? []).includes(demo.sector))
    .slice(0, 3);
  const related = relatedArticles(blogArticles, article, 3);
  const lyd = lydLabel("ar");

  const whatsappUrl = `https://wa.me/${config.whatsapp}?text=${encodeURIComponent(
    `مرحبا نخبة 👋 قرأت دليل «${article.h1Ar}» وأريد عرض سعر لمشروعي.`,
  )}`;

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(config, [
            { name: "الرئيسية", path: "/" },
            { name: "المدونة", path: "/blog" },
            { name: article.titleAr, path: articlePath(article.slug) },
          ]),
          webPageJsonLd(config, {
            path: articlePath(article.slug),
            name: article.titleAr,
            description: article.answerAr,
            speakable: ["h1", "#article-answer"],
            about: article.categoryAr,
            dateModified: article.updatedAt,
          }),
          articleJsonLd(config, article),
          articleFaqJsonLd(article),
        ]}
      />

      <div className="pt-[96px]">
        {/* En-tête */}
        <section className="py-12 bg-[var(--secondary)]/30 border-b border-[var(--border)]">
          <div className="site-container px-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
              <Link
                href="/blog"
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)]"
              >
                <ArrowLeft className="h-3 w-3" />
                كل الأدلة
              </Link>
              <span className="px-3 py-1 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)]">
                {article.categoryAr} · {article.categoryEn}
              </span>
            </div>

            <h1 className="mt-6 text-[32px] lg:text-[44px] font-black tracking-tight leading-tight max-w-[26ch]">
              {article.h1Ar}
            </h1>
            <p className="mt-1 text-sm opacity-50 max-w-[62ch]" dir="ltr">
              {article.h1En}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs opacity-60">
              <span className="inline-flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                {article.authorAr}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {formatArticleDate(article.publishedAt, "ar")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" />
                آخر تحديث: {formatArticleDate(article.updatedAt, "ar")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {article.readingMinutes} دقائق قراءة
              </span>
            </div>

            {/* Réponse directe (GEO / speakable) */}
            <div
              id="article-answer"
              className="mt-7 rounded-2xl bg-[var(--card)] border border-[var(--border)] p-6 max-w-[78ch]"
            >
              <p className="text-sm leading-7 opacity-85">
                <strong className="text-[var(--accent)]">باختصار: </strong>
                {article.answerAr}
              </p>
              <p className="mt-3 text-xs leading-6 opacity-50" dir="ltr">
                {article.answerEn}
              </p>
            </div>
          </div>
        </section>

        <div className="site-container px-4 sm:px-6 lg:px-8 py-10 grid lg:grid-cols-[1fr_300px] gap-10 items-start">
          {/* Corps de l'article */}
          <article className="min-w-0">
            {/* Faits clés */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--secondary)]/35 p-5">
              <h2 className="text-sm font-black tracking-wide opacity-70">
                أرقام أساسية · Key facts
              </h2>
              <dl className="mt-4 grid sm:grid-cols-2 gap-x-6 gap-y-3">
                {article.keyFacts.map((fact) => (
                  <div key={fact.labelEn} className="flex items-baseline justify-between gap-3 border-b border-[var(--border)]/60 pb-2">
                    <dt className="text-xs opacity-60">{fact.labelAr}</dt>
                    <dd className="text-sm font-black text-[var(--accent)]" dir="ltr">
                      {fact.valueEn}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            {article.sections.map((section, index) => (
              <section key={section.id} id={section.id} className="mt-10 scroll-mt-28">
                <h2 className="text-2xl font-black leading-snug">
                  <span className="text-[var(--accent)]/50 me-2">{String(index + 1).padStart(2, "0")}</span>
                  {section.headingAr}
                </h2>
                <p className="mt-1 text-xs font-bold opacity-40" dir="ltr">
                  {section.headingEn}
                </p>

                {section.paragraphsAr.map((paragraph) => (
                  <p key={paragraph.slice(0, 40)} className="mt-4 text-[15px] leading-8 opacity-80">
                    {paragraph}
                  </p>
                ))}

                {section.bulletsAr && section.bulletsAr.length > 0 && (
                  <ul className="mt-4 space-y-2">
                    {section.bulletsAr.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-2.5 text-sm leading-7">
                        <Check className="h-4 w-4 mt-1.5 shrink-0 text-[var(--accent)]" />
                        <span className="opacity-80">{bullet}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {section.bulletsEn && section.bulletsEn.length > 0 && (
                  <ul className="mt-3 space-y-1 text-xs opacity-40" dir="ltr">
                    {section.bulletsEn.map((bullet) => (
                      <li key={bullet}>· {bullet}</li>
                    ))}
                  </ul>
                )}

                {section.calloutAr && (
                  <aside className="mt-5 rounded-xl border-s-4 border-[var(--accent)] bg-[var(--accent)]/8 px-5 py-4">
                    <p className="text-sm leading-7 font-medium">{section.calloutAr}</p>
                    {section.calloutEn && (
                      <p className="mt-1 text-xs leading-5 opacity-50" dir="ltr">
                        {section.calloutEn}
                      </p>
                    )}
                  </aside>
                )}
              </section>
            ))}

            {/* Tableau tarifaire live */}
            {article.includePricing && (
              <section id="pricing-live" className="mt-12 scroll-mt-28">
                <h2 className="text-2xl font-black">الأسعار الحالية — محدثة من لوحة الإدارة</h2>
                <p className="mt-1 text-xs font-bold opacity-40" dir="ltr">
                  Current pricing, synced with the admin panel
                </p>
                <div className="mt-5 overflow-x-auto rounded-2xl border border-[var(--border)]">
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--secondary)]/60 text-xs uppercase tracking-wide opacity-70">
                      <tr>
                        <th className="text-start px-4 py-3 font-bold">الباقة</th>
                        <th className="text-start px-4 py-3 font-bold">المشمول</th>
                        <th className="text-end px-4 py-3 font-bold">النموذج + التخصيص + الإجمالي (USD)</th>
                        <th className="text-end px-4 py-3 font-bold">≈ {lyd} (إرشادي)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {config.pricing.plans.map((plan) => {
                        const breakdown = resolvePlanPriceBreakdown(plan);
                        return (
                        <tr key={plan.id} className="border-t border-[var(--border)]">
                          <td className="px-4 py-3 font-black">
                            {plan.name}
                            <span className="block text-[11px] font-normal opacity-50" dir="ltr">
                              {plan.nameEn}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs opacity-65">
                            {plan.features.slice(0, 3).join(" · ")}
                          </td>
                          <td className="px-4 py-3 text-end text-xs" dir="ltr">
                            <div>النموذج: {breakdown.modelPriceUsd == null ? "—" : formatMainPrice(breakdown.modelPriceUsd, "$")}</div>
                            <div className="mt-1 opacity-65">
                              التخصيص{breakdown.customizationPercent == null ? "" : ` (${breakdown.customizationPercent}٪)`}: {breakdown.customizationUsd == null ? "عرض سعر" : formatMainPrice(breakdown.customizationUsd, "$")}
                            </div>
                            <strong className="mt-1 block text-sm text-[var(--accent)]">الإجمالي: {breakdown.totalPriceUsd == null ? "يُحدد بعرض سعر" : formatMainPrice(breakdown.totalPriceUsd, "$")}</strong>
                          </td>
                          <td className="px-4 py-3 text-end text-xs opacity-60" dir="ltr">
                            {breakdown.totalPriceLyd == null ? `${formatLyd(plan.price)} + تخصيص` : formatLyd(breakdown.totalPriceLyd)}
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Link
                  href="/pricing"
                  className="mt-4 inline-flex h-10 px-5 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] items-center text-sm font-bold"
                >
                  مقارنة الباقات كاملة
                </Link>
              </section>
            )}

            {/* FAQ */}
            {article.faqs.length > 0 && (
              <section id="faq" className="mt-12 scroll-mt-28">
                <h2 className="text-2xl font-black">أسئلة شائعة</h2>
                <p className="mt-1 text-xs font-bold opacity-40" dir="ltr">
                  Frequently asked questions
                </p>
                <div className="mt-5 space-y-3">
                  {article.faqs.map((faq) => (
                    <details
                      key={faq.qAr}
                      className="group rounded-2xl bg-[var(--card)] border border-[var(--border)] p-5"
                    >
                      <summary className="cursor-pointer list-none font-bold leading-6 marker:hidden">
                        {faq.qAr}
                        <span className="block text-xs font-normal opacity-45 mt-0.5" dir="ltr">
                          {faq.qEn}
                        </span>
                      </summary>
                      <p className="mt-3 text-sm leading-7 opacity-75">{faq.aAr}</p>
                      <p className="mt-1 text-xs leading-5 opacity-40" dir="ltr">
                        {faq.aEn}
                      </p>
                    </details>
                  ))}
                </div>
              </section>
            )}

            {/* CTA */}
            <div className="mt-12 rounded-[24px] bg-[var(--primary)] text-[var(--primary-foreground)] p-8 lg:p-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div>
                <h2 className="text-2xl font-black">هل تريد تطبيق هذا على مشروعك؟</h2>
                <p className="mt-2 opacity-75 max-w-[52ch]">
                  أرسل تفاصيل نشاطك ونرد خلال ساعتين في أوقات العمل بعرض سعر ثابت
                  ومدة تسليم واضحة — بدون التزام.
                </p>
              </div>
              <div className="flex gap-3 shrink-0">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-11 px-6 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] inline-flex items-center justify-center gap-2 font-bold"
                >
                  <MessageCircle className="h-4 w-4" />
                  واتساب مباشر
                </a>
                <Link
                  href="/contact"
                  className="h-11 px-6 rounded-full bg-white/10 border border-white/20 inline-flex items-center justify-center font-bold hover:bg-white/15"
                >
                  نموذج التواصل
                </Link>
              </div>
            </div>

            <p className="mt-6 text-[11px] opacity-35">
              الصفحة الرسمية: <span dir="ltr">{canonical}</span>
            </p>
          </article>

          {/* Colonne latérale */}
          <aside className="lg:sticky lg:top-28 space-y-5">
            {/* Sommaire */}
            <nav
              aria-label="فهرس المقال"
              className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5"
            >
              <div className="flex items-center gap-2 text-xs font-black tracking-wide opacity-70">
                <List className="h-4 w-4" />
                فهرس المقال
              </div>
              <ol className="mt-3 space-y-2 text-sm">
                {article.sections.map((section, index) => (
                  <li key={section.id} className="flex gap-2">
                    <span className="text-[11px] font-bold text-[var(--accent)] mt-0.5">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <a href={`#${section.id}`} className="opacity-75 hover:text-[var(--accent)] hover:opacity-100">
                      {section.headingAr}
                    </a>
                  </li>
                ))}
                {article.includePricing && (
                  <li className="flex gap-2">
                    <span className="text-[11px] font-bold text-[var(--accent)] mt-0.5">
                      {String(article.sections.length + 1).padStart(2, "0")}
                    </span>
                    <a href="#pricing-live" className="opacity-75 hover:text-[var(--accent)]">
                      الأسعار الحالية
                    </a>
                  </li>
                )}
              </ol>
            </nav>

            {/* Services liés */}
            {services.length > 0 && (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
                <h2 className="text-xs font-black tracking-wide opacity-70">
                  خدمات مرتبطة
                </h2>
                <ul className="mt-3 space-y-2">
                  {services.map((service) => {
                    const landing = resolveServiceLanding(service);
                    return (
                      <li key={service.id}>
                        <Link
                          href={servicePath(service.id)}
                          className="group flex items-start justify-between gap-3 text-sm"
                        >
                          <span>
                            <span className="font-bold group-hover:text-[var(--accent)]">
                              {service.titleAr}
                            </span>
                            <span className="block text-[11px] opacity-50">
                              {landing.deliveryAr}
                            </span>
                          </span>
                          <span className="text-xs font-black text-[var(--accent)] shrink-0" dir="ltr">
                            {formatMainPrice(service.priceFromUsd, "$")}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Secteurs liés */}
            {sectors.length > 0 && (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
                <h2 className="text-xs font-black tracking-wide opacity-70">
                  قطاعات مرتبطة
                </h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {sectors.map((sector) => (
                    <Link
                      key={sector.id}
                      href={`/sectors/${sector.id}`}
                      className="px-3 py-1.5 rounded-full bg-[var(--secondary)] border border-[var(--border)] text-xs font-bold hover:border-[var(--accent)]"
                    >
                      {sector.labelAr}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Réalisations */}
            {demos.length > 0 && (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
                <h2 className="text-xs font-black tracking-wide opacity-70">
                  أعمال حية
                </h2>
                <ul className="mt-3 space-y-2 text-sm">
                  {demos.map((demo) => (
                    <li key={demo.slug}>
                      <Link
                        href={`/demos/${demo.slug}`}
                        className="inline-flex items-center gap-1.5 opacity-75 hover:text-[var(--accent)] hover:opacity-100"
                      >
                        <ArrowUpRight className="h-3.5 w-3.5" />
                        {demo.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>

        {/* Articles liés */}
        {related.length > 0 && (
          <section className="py-12 border-t border-[var(--border)]">
            <div className="site-container px-4 sm:px-6 lg:px-8">
              <h2 className="text-2xl font-black">اقرأ أيضاً</h2>
              <p className="mt-1 text-xs font-bold opacity-40" dir="ltr">
                Related guides
              </p>
              <div className="mt-6 grid md:grid-cols-3 gap-4">
                {related.map((item) => (
                  <Link
                    key={item.slug}
                    href={articlePath(item.slug)}
                    className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-5 hover:border-[var(--accent)]/50 transition-colors"
                  >
                    <span className="text-[11px] font-bold text-[var(--accent)]">
                      {item.categoryAr}
                    </span>
                    <h3 className="mt-1.5 font-black leading-snug">{item.titleAr}</h3>
                    <p className="mt-2 text-xs opacity-55 line-clamp-2">{item.excerptAr}</p>
                    <span className="mt-3 inline-block text-xs font-bold text-[var(--accent)]">
                      اقرأ الدليل ←
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
