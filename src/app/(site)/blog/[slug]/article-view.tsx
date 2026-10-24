"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Calendar,
  Camera,
  Check,
  Clock,
  List,
  MessageCircle,
  RefreshCw,
  User,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { whatsappLink } from "@/lib/utils";
import { articlePath, formatArticleDate, type BlogArticle } from "@/lib/blog";
import { resolvePlanPriceBreakdown } from "@/lib/classification";
import { formatMainPrice } from "@/lib/installments";

export interface ArticlePlanLite {
  id: string;
  name: string;
  nameEn: string;
  priceUsd?: number | null;
  customizationPercent?: number | null;
}

export interface ArticleServiceLite {
  id: string;
  titleAr: string;
  titleEn: string;
  priceFromUsd: number;
  deliveryAr: string;
  deliveryEn: string;
}

export interface ArticleRelatedLite {
  slug: string;
  categoryAr: string;
  categoryEn: string;
  titleAr: string;
  titleEn: string;
  excerptAr: string;
  excerptEn: string;
}

/**
 * Rendu visible d'un guide — composant client localisé.
 *
 * Avant ce correctif, la page article était rendue côté serveur avec
 * l'arabe en langue principale et l'anglais en petits sous-titres :
 * un visiteur en version anglaise voyait donc le guide « en arabe ».
 * Désormais le guide suit la langue choisie sur le site, exactement
 * comme le reste des pages : anglais intégral en `en`, arabe intégral
 * en `ar` (titres, paragraphes, puces, FAQ, légendes des photos).
 * Les métadonnées et les données structurées restent côté serveur.
 */
export function ArticleView({
  article,
  plans,
  services,
  sectors,
  demos,
  related,
  whatsapp,
  canonical,
}: {
  article: BlogArticle;
  plans: ArticlePlanLite[];
  services: ArticleServiceLite[];
  sectors: { id: string; labelAr: string; labelEn: string }[];
  demos: { slug: string; title: string; titleEn: string }[];
  related: ArticleRelatedLite[];
  whatsapp: string;
  canonical: string;
}) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const whatsappUrl = whatsappLink(
    whatsapp,
    ar
      ? `مرحبا نخبة 👋 قرأت دليل «${article.h1Ar}» وأريد عرض سعر لمشروعي.`
      : `Hello Nukhba 👋 I read your guide “${article.h1En}” and I'd like a quote for my project.`,
  );

  return (
    <div className="pt-6">
      {/* En-tête */}
      <section className="section-tight border-b border-[var(--border)] bg-[var(--secondary)]/35">
        <div className="site-container px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <Link
              href="/blog"
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)]"
            >
              <ArrowLeft className="h-3 w-3 rtl:-scale-x-100" />
              {ar ? "كل الأدلة" : "All guides"}
            </Link>
            <span className="rounded-full border border-[var(--accent)]/35 bg-[var(--accent)]/12 px-3 py-1 text-[var(--accent)]">
              {ar ? article.categoryAr : article.categoryEn}
            </span>
          </div>

          <h1 className="mt-6 text-[32px] lg:text-[44px] font-black tracking-tight leading-tight max-w-[26ch]">
            {ar ? article.h1Ar : article.h1En}
          </h1>

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs opacity-60">
            <span className="inline-flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              {ar ? article.authorAr : article.authorEn}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {formatArticleDate(article.publishedAt, locale)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              {ar ? "آخر تحديث: " : "Updated: "}
              {formatArticleDate(article.updatedAt, locale)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {article.readingMinutes} {ar ? "دقائق قراءة" : "min read"}
            </span>
          </div>

          {/* Réponse directe (GEO / speakable) */}
          <div
            id="article-answer"
            className="mt-7 rounded-2xl bg-[var(--card)] border border-[var(--border)] p-6 max-w-[78ch]"
          >
            <p className="text-sm leading-7 opacity-85">
              <strong className="text-[var(--accent)]">
                {ar ? "باختصار: " : "In short: "}
              </strong>
              {ar ? article.answerAr : article.answerEn}
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
              {ar ? "أرقام أساسية" : "Key facts"}
            </h2>
            <dl className="mt-4 grid sm:grid-cols-2 gap-x-6 gap-y-3">
              {article.keyFacts.map((fact) => (
                <div key={fact.labelEn} className="flex items-baseline justify-between gap-3 border-b border-[var(--border)]/60 pb-2">
                  <dt className="text-xs opacity-60">{ar ? fact.labelAr : fact.labelEn}</dt>
                  <dd className="text-sm font-black text-[var(--accent)]" dir="ltr">
                    {ar ? fact.valueAr : fact.valueEn}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {article.sections.map((section, index) => {
            const bullets = ar ? section.bulletsAr : section.bulletsEn;
            const callout = ar ? section.calloutAr : section.calloutEn;
            return (
              <section key={section.id} id={section.id} className="mt-10 scroll-mt-28">
                <h2 className="text-2xl font-black leading-snug">
                  <span className="text-[var(--accent)]/50 me-2">{String(index + 1).padStart(2, "0")}</span>
                  {ar ? section.headingAr : section.headingEn}
                </h2>

                {(ar ? section.paragraphsAr : section.paragraphsEn).map((paragraph) => (
                  <p key={paragraph.slice(0, 40)} className="mt-4 text-[15px] leading-8 opacity-80">
                    {paragraph}
                  </p>
                ))}

                {bullets && bullets.length > 0 && (
                  <ul className="mt-4 space-y-2">
                    {bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-2.5 text-sm leading-7">
                        <Check className="h-4 w-4 mt-1.5 shrink-0 text-[var(--accent)]" />
                        <span className="opacity-80">{bullet}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {section.image && (
                  <figure className="mt-6 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-xs)]">
                    <div className="relative aspect-[16/9]">
                      <Image
                        src={section.image.src}
                        alt={ar ? section.image.altAr : section.image.altEn}
                        fill
                        sizes="(max-width: 1024px) 100vw, 760px"
                        quality={88}
                        className="object-cover"
                      />
                    </div>
                    {(ar ? section.image.captionAr : section.image.captionEn) && (
                      <figcaption className="flex items-start gap-2 px-4 py-3 text-xs leading-6 opacity-70">
                        <Camera className="mt-1 h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                        <span>{ar ? section.image.captionAr : section.image.captionEn}</span>
                      </figcaption>
                    )}
                  </figure>
                )}

                {callout && (
                  <aside className="mt-5 rounded-xl border-s-4 border-[var(--accent)] bg-[var(--accent)]/8 px-5 py-4">
                    <p className="text-sm leading-7 font-medium">{callout}</p>
                  </aside>
                )}
              </section>
            );
          })}

          {/* Tableau tarifaire live — USD uniquement (= USDT) */}
          {article.includePricing && (
            <section id="pricing-live" className="mt-12 scroll-mt-28">
              <h2 className="text-2xl font-black">
                {ar ? "الأسعار الحالية — محدثة من لوحة الإدارة" : "Current pricing — synced with the admin panel"}
              </h2>
              <p className="mt-1 text-xs font-bold opacity-50">
                {ar ? "كل المبالغ بالدولار — تدفع نفس المبلغ بـ USDT" : "All amounts in USD — pay the same amount in USDT"}
              </p>
              <div className="mt-5 overflow-x-auto rounded-2xl border border-[var(--border)]">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--secondary)]">
                    <tr>
                      <th className="px-4 py-3 text-start">{ar ? "الباقة" : "Plan"}</th>
                      <th className="px-4 py-3 text-end">{ar ? "النموذج" : "Model"}</th>
                      <th className="px-4 py-3 text-end">{ar ? "التخصيص" : "Customization"}</th>
                      <th className="px-4 py-3 text-end">{ar ? "الإجمالي (USD = USDT)" : "Total (USD = USDT)"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {plans.map((plan) => {
                      const breakdown = resolvePlanPriceBreakdown(plan);
                      return (
                        <tr key={plan.id}>
                          <td className="px-4 py-3 font-bold">{ar ? plan.name : plan.nameEn}</td>
                          <td className="px-4 py-3 text-end" dir="ltr">
                            {breakdown.modelPriceUsd == null ? (ar ? "حسب الطلب" : "On request") : formatMainPrice(breakdown.modelPriceUsd, "$")}
                          </td>
                          <td className="px-4 py-3 text-end" dir="ltr">
                            {breakdown.customizationUsd == null ? (ar ? "عرض سعر" : "Quoted") : formatMainPrice(breakdown.customizationUsd, "$")}
                          </td>
                          <td className="px-4 py-3 text-end font-black text-[var(--accent)]" dir="ltr">
                            {breakdown.totalPriceUsd == null ? (ar ? "يُحدد بالعرض" : "In quote") : formatMainPrice(breakdown.totalPriceUsd, "$")}
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
                {ar ? "مقارنة الباقات كاملة" : "Compare all plans"}
              </Link>
            </section>
          )}

          {/* FAQ */}
          {article.faqs.length > 0 && (
            <section id="faq" className="mt-12 scroll-mt-28">
              <h2 className="text-2xl font-black">{ar ? "أسئلة شائعة" : "Frequently asked questions"}</h2>
              <div className="mt-5 space-y-3">
                {article.faqs.map((faq) => (
                  <details
                    key={faq.qEn}
                    className="group rounded-2xl bg-[var(--card)] border border-[var(--border)] p-5"
                  >
                    <summary className="cursor-pointer list-none font-bold leading-6 marker:hidden">
                      {ar ? faq.qAr : faq.qEn}
                    </summary>
                    <p className="mt-3 text-sm leading-7 opacity-75">{ar ? faq.aAr : faq.aEn}</p>
                  </details>
                ))}
              </div>
            </section>
          )}

          {/* CTA */}
          <div className="mt-12 flex flex-col gap-6 rounded-[var(--radius-lg)] bg-[var(--primary)] p-8 text-[var(--primary-foreground)] shadow-[var(--shadow-lg)] lg:flex-row lg:items-center lg:justify-between lg:p-10">
            <div>
              <h2 className="text-2xl font-black">
                {ar ? "هل تريد تطبيق هذا على مشروعك؟" : "Want this applied to your project?"}
              </h2>
              <p className="mt-2 opacity-75 max-w-[52ch]">
                {ar
                  ? "أرسل تفاصيل نشاطك ونرد خلال ساعتين في أوقات العمل بعرض سعر ثابت بالدولار ومدة تسليم واضحة — بدون التزام."
                  : "Send us your project details and we reply within 2 working hours with a fixed USD quote and a clear delivery date — no commitment."}
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
                {ar ? "واتساب مباشر" : "Direct WhatsApp"}
              </a>
              <Link
                href="/contact"
                className="h-11 px-6 rounded-full bg-white/10 border border-white/20 inline-flex items-center justify-center font-bold hover:bg-white/15"
              >
                {ar ? "نموذج التواصل" : "Contact form"}
              </Link>
            </div>
          </div>

          <p className="mt-6 text-[11px] opacity-35">
            {ar ? "الصفحة الرسمية: " : "Canonical page: "}
            <span dir="ltr">{canonical}</span>
          </p>
        </article>

        {/* Colonne latérale */}
        <aside className="lg:sticky lg:top-28 space-y-5">
          <nav
            aria-label={ar ? "فهرس المقال" : "Article contents"}
            className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5"
          >
            <div className="flex items-center gap-2 text-xs font-black tracking-wide opacity-70">
              <List className="h-4 w-4" />
              {ar ? "فهرس المقال" : "In this guide"}
            </div>
            <ol className="mt-3 space-y-2 text-sm">
              {article.sections.map((section, index) => (
                <li key={section.id} className="flex gap-2">
                  <span className="text-[11px] font-bold text-[var(--accent)] mt-0.5">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <a href={`#${section.id}`} className="opacity-75 hover:text-[var(--accent)] hover:opacity-100">
                    {ar ? section.headingAr : section.headingEn}
                  </a>
                </li>
              ))}
              {article.includePricing && (
                <li className="flex gap-2">
                  <span className="text-[11px] font-bold text-[var(--accent)] mt-0.5">
                    {String(article.sections.length + 1).padStart(2, "0")}
                  </span>
                  <a href="#pricing-live" className="opacity-75 hover:text-[var(--accent)]">
                    {ar ? "الأسعار الحالية" : "Current pricing"}
                  </a>
                </li>
              )}
            </ol>
          </nav>

          {services.length > 0 && (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
              <h2 className="text-xs font-black tracking-wide opacity-70">
                {ar ? "خدمات مرتبطة" : "Related services"}
              </h2>
              <ul className="mt-3 space-y-2">
                {services.map((service) => (
                  <li key={service.id}>
                    <Link href={`/services/${service.id}`} className="group flex items-start justify-between gap-3 text-sm">
                      <span>
                        <span className="font-bold group-hover:text-[var(--accent)]">
                          {ar ? service.titleAr : service.titleEn}
                        </span>
                        <span className="block text-[11px] opacity-50">
                          {ar ? service.deliveryAr : service.deliveryEn}
                        </span>
                      </span>
                      <span className="text-xs font-black text-[var(--accent)] shrink-0" dir="ltr">
                        {formatMainPrice(service.priceFromUsd, "$")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {sectors.length > 0 && (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
              <h2 className="text-xs font-black tracking-wide opacity-70">
                {ar ? "قطاعات مرتبطة" : "Related sectors"}
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {sectors.map((sector) => (
                  <Link
                    key={sector.id}
                    href={`/sectors/${sector.id}`}
                    className="px-3 py-1.5 rounded-full bg-[var(--secondary)] border border-[var(--border)] text-xs font-bold hover:border-[var(--accent)]"
                  >
                    {ar ? sector.labelAr : sector.labelEn}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {demos.length > 0 && (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
              <h2 className="text-xs font-black tracking-wide opacity-70">
                {ar ? "أعمال حية" : "Live work"}
              </h2>
              <ul className="mt-3 space-y-2 text-sm">
                {demos.map((demo) => (
                  <li key={demo.slug}>
                    <Link
                      href={`/demos/${demo.slug}`}
                      className="inline-flex items-center gap-1.5 opacity-75 hover:text-[var(--accent)] hover:opacity-100"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      {ar ? demo.title : demo.titleEn}
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
            <h2 className="text-2xl font-black">{ar ? "اقرأ أيضاً" : "Read next"}</h2>
            <div className="mt-6 grid md:grid-cols-3 gap-4">
              {related.map((item) => (
                <Link
                  key={item.slug}
                  href={articlePath(item.slug)}
                  className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-5 hover:border-[var(--accent)]/50 transition-colors"
                >
                  <span className="text-[11px] font-bold text-[var(--accent)]">
                    {ar ? item.categoryAr : item.categoryEn}
                  </span>
                  <h3 className="mt-1.5 font-black leading-snug">{ar ? item.titleAr : item.titleEn}</h3>
                  <p className="mt-2 text-xs opacity-55 line-clamp-2">{ar ? item.excerptAr : item.excerptEn}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[var(--accent)]">
                    {ar ? "اقرأ الدليل" : "Read the guide"}
                    <ArrowRight className="h-3 w-3 rtl:-scale-x-100" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
