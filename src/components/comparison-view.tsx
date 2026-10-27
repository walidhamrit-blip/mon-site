"use client";

import Link from "next/link";
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
import { useI18n } from "@/lib/i18n";
import { Price } from "@/components/price";
import { whatsappLink } from "@/lib/utils";
import type { ComparisonCriterion, ComparisonSeo } from "@/lib/comparisons";

/**
 * Affichage d'une page comparative (/compare/[slug]).
 *
 * Composant **client** : la langue du site (arabe / anglais, bouton dans la
 * barre supérieure) s'applique ici comme partout ailleurs. Le serveur ne
 * fournit que les données (comparaison, prix vivants) ; le choix de la
 * langue se fait côté client, sans rechargement.
 */
export function ComparisonView({
  comparison,
  related,
  relatedServices,
  sitePriceUsd,
  servicePriceUsd,
  whatsapp,
}: {
  comparison: ComparisonSeo;
  related: ReadonlyArray<ComparisonSeo>;
  relatedServices: ReadonlyArray<{ id: string; titleAr: string; titleEn: string }>;
  sitePriceUsd: number;
  servicePriceUsd: number;
  whatsapp: string;
}) {
  const { locale, t } = useI18n();
  const ar = locale === "ar";
  const c = t.compare;

  /** Choisit la variante arabe ou anglaise d'un champ bilingue. */
  const pick = <T,>(arValue: T, enValue: T): T => (ar ? arValue : enValue);

  const competitorName = pick(comparison.competitorAr, comparison.competitorEn);
  const usName = pick(c.usNameAr, c.usNameEn);
  const themPrice = comparison.themPriceLabel;
  const usPrice = pick(comparison.usPriceLabelAr, comparison.usPriceLabelEn);
  const usNote = pick(comparison.usPriceNoteAr, comparison.usPriceNoteEn);

  const whatsappUrl = whatsappLink(
    whatsapp,
    ar
      ? `مرحبا نخبة 👋 قرأت مقارنة «${comparison.h1Ar}» وأريد عرض سعر لموقعي.`
      : `Hello Nukhba 👋 I read the "${comparison.h1En}" comparison and would like a quote for my website.`,
  );

  const summaryText = pick(c.summaryTextAr, c.summaryTextEn)
    .replace("{note}", usNote)
    .replace("{site}", String(sitePriceUsd))
    .replace("{service}", String(servicePriceUsd));

  return (
    <div className="pt-6" dir={ar ? "rtl" : "ltr"}>
      {/* ── En-tête ─────────────────────────────────────────────────── */}
      <section className="section-tight border-b border-[var(--border)] bg-[var(--secondary)]/35">
        <div className="site-container px-4 sm:px-6 lg:px-8">
          <nav
            aria-label={ar ? "مسار التصفح" : "Breadcrumb"}
            className="flex flex-wrap items-center gap-2 text-xs font-bold"
          >
            <Link
              href="/compare"
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)]"
            >
              <ArrowLeft className="h-3 w-3" />
              {pick(c.backAr, c.backEn)}
            </Link>
            <span className="rounded-full border border-[var(--accent)]/35 bg-[var(--accent)]/12 px-3 py-1 text-[var(--accent)]">
              <Scale className="me-1 inline h-3 w-3" />
              {pick(c.badgeAr, c.badgeEn)}
            </span>
          </nav>

          <h1 className="mt-6 max-w-[28ch] text-[clamp(1.8rem,1.2rem+2.2vw,2.85rem)] font-black leading-[1.08] tracking-[-0.03em] text-balance">
            {pick(comparison.h1Ar, comparison.h1En)}
          </h1>
          <p className="mt-4 max-w-[66ch] text-[15.5px] leading-8 text-[var(--muted-foreground)]">
            {pick(comparison.subtitleAr, comparison.subtitleEn)}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/contact"
              className="h-11 px-6 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] inline-flex items-center justify-center text-sm font-bold"
            >
              {pick(comparison.ctaAr, comparison.ctaEn)}
            </Link>
            <Link
              href="/pricing"
              className="h-11 px-6 rounded-full border border-[var(--border)] bg-[var(--card)] inline-flex items-center justify-center text-sm font-bold hover:bg-[var(--secondary)]"
            >
              {pick(c.seePricingAr, c.seePricingEn)}
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
                    {competitorName}
                  </p>
                  <p dir="ltr" className="text-xs opacity-80">
                    {comparison.competitorEn}
                  </p>
                </div>
              </div>

              <p dir="ltr" className="mt-6 text-[clamp(2rem,1.4rem+2.4vw,3rem)] font-black leading-none">
                {themPrice}
              </p>
              <p className="mt-2 text-xs opacity-85">
                {pick(comparison.themPriceAr, comparison.themPriceEn)}
              </p>

              <ul className="mt-6 space-y-3 text-sm leading-6">
                {comparison.themPoints.map((point) => (
                  <li key={point.textEn} className="flex gap-2.5">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/20">
                      <X className="h-3 w-3" />
                    </span>
                    <span>{pick(point.textAr, point.textEn)}</span>
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
                  <p className="text-lg font-black leading-tight">{usName}</p>
                  <p dir="ltr" className="text-xs opacity-85">
                    Premium Web Agency
                  </p>
                </div>
              </div>

              <p className="mt-6 text-[clamp(2rem,1.4rem+2.4vw,3rem)] font-black leading-none">
                {usPrice}
              </p>
              <p className="mt-2 text-xs opacity-90">
                {usNote} —{" "}
                {ar ? "موقع من" : "website from"}{" "}
                <Price usd={sitePriceUsd} compact />{" "}
                {ar ? "· خدمات من" : "· services from"}{" "}
                <Price usd={servicePriceUsd} compact />
              </p>

              <ul className="mt-6 space-y-3 text-sm leading-6">
                {comparison.usPoints.map((point) => (
                  <li key={point.textEn} className="flex gap-2.5">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/25">
                      <Check className="h-3 w-3" />
                    </span>
                    <span>{pick(point.textAr, point.textEn)}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/contact"
                className="mt-7 h-11 px-6 rounded-full bg-white text-[#0E9F6E] inline-flex items-center justify-center text-sm font-black hover:bg-white/90"
              >
                {pick(comparison.ctaAr, comparison.ctaEn)}
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
            <h2 className="text-lg font-black">
              {pick(c.answerTitleAr, c.answerTitleEn)}
            </h2>
            <p className="mt-3 text-[15px] leading-8 opacity-80">
              {pick(comparison.answerAr, comparison.answerEn)}
            </p>
          </div>
        </div>
      </section>

      {/* ── Tableau comparatif ligne par ligne ──────────────────────── */}
      <section className="py-10 border-b border-[var(--border)]">
        <div className="site-container px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-black">
            {pick(c.criteriaTitleAr, c.criteriaTitleEn)}
          </h2>
          <p className="mt-1 text-sm opacity-60">
            {ar
              ? `${competitorName} مقابل نخبة — ${pick(c.criteriaSubAr, c.criteriaSubEn)}`
              : `${comparison.competitorEn} vs Nukhba — ${pick(c.criteriaSubAr, c.criteriaSubEn)}`}
          </p>

          <div className="mt-6 overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border)]">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="bg-[var(--secondary)]/60">
                  <th className="text-start p-4 font-black w-[26%]">
                    {pick(c.criterionAr, c.criterionEn)}
                  </th>
                  <th className="text-start p-4 font-black text-[#C1272D] w-[37%]">
                    {competitorName}
                  </th>
                  <th className="text-start p-4 font-black text-[#0E9F6E] w-[37%]">
                    {usName}
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparison.criteria.map((criterion: ComparisonCriterion) => (
                  <tr
                    key={criterion.labelEn}
                    className="border-t border-[var(--border)] align-top"
                  >
                    <th scope="row" className="text-start p-4 font-bold">
                      {pick(criterion.labelAr, criterion.labelEn)}
                    </th>
                    <td className="p-4 opacity-75">
                      <span className="flex gap-2">
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#C1272D]/12 text-[#C1272D]">
                          <X className="h-3 w-3" />
                        </span>
                        <span>
                          {criterion.themAr
                            ? pick(criterion.themAr, criterion.themEn ?? "")
                            : pick(c.notIncludedAr, c.notIncludedEn)}
                        </span>
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="flex gap-2">
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#0E9F6E]/12 text-[#0E9F6E]">
                          <Check className="h-3 w-3" />
                        </span>
                        <span>{pick(criterion.usAr, criterion.usEn)}</span>
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
          <h2 className="text-2xl font-black">
            {pick(c.whenTitleAr, c.whenTitleEn)}
          </h2>

          <div className="mt-6 grid md:grid-cols-2 gap-4">
            <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-6">
              <h3 className="flex items-center gap-2 font-black">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-[#C1272D]/12 text-[#C1272D]">
                  <X className="h-4 w-4" />
                </span>
                {pick(c.whenThemAr, c.whenThemEn).replace(
                  "{name}",
                  competitorName,
                )}
              </h3>
              <ul className="mt-4 space-y-2.5 text-sm opacity-80">
                {(ar
                  ? comparison.chooseThemAr
                  : comparison.chooseThemEn
                ).map((item) => (
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
                {pick(c.whenUsAr, c.whenUsEn)}
              </h3>
              <ul className="mt-4 space-y-2.5 text-sm opacity-80">
                {(ar ? comparison.chooseUsAr : comparison.chooseUsEn).map(
                  (item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0E9F6E]" />
                      <span>{item}</span>
                    </li>
                  ),
                )}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <section className="py-10 border-b border-[var(--border)]">
        <div className="site-container px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-black">
            {pick(c.faqTitleAr, c.faqTitleEn)} —{" "}
            {pick(comparison.h1Ar, comparison.h1En)}
          </h2>
          <div className="mt-6 grid md:grid-cols-2 gap-4">
            {comparison.faqs.map((faq, index) => (
              <div
                key={index}
                className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-6"
              >
                <h3 className="font-bold">{pick(faq.qAr, faq.qEn)}</h3>
                <p className="mt-3 text-sm opacity-70 leading-6">
                  {pick(faq.aAr, faq.aEn)}
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
              <h2 className="text-2xl font-black">
                {pick(c.summaryTitleAr, c.summaryTitleEn)}
              </h2>
              <p className="mt-2 opacity-70 max-w-[60ch]">{summaryText}</p>
              <ul className="mt-4 flex flex-wrap gap-4 text-sm opacity-85">
                <li className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  {pick(c.deliveryAr, c.deliveryEn)}
                </li>
                <li className="flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4" />
                  {pick(c.ownershipAr, c.ownershipEn)}
                </li>
                <li className="flex items-center gap-1.5">
                  <MessageCircle className="h-4 w-4" />
                  {pick(c.replyAr, c.replyEn)}
                </li>
              </ul>
            </div>
            <div className="mt-6 lg:mt-0 flex flex-wrap gap-3 shrink-0">
              <Link
                href="/contact"
                className="h-11 px-6 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] inline-flex items-center justify-center font-bold"
              >
                {pick(c.freeQuoteAr, c.freeQuoteEn)}
              </Link>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="h-11 px-6 rounded-full bg-white/10 border border-white/20 inline-flex items-center justify-center font-bold hover:bg-white/15"
              >
                {pick(c.whatsappAr, c.whatsappEn)}
              </a>
            </div>
          </div>

          {/* Comparaisons liées */}
          {related.length > 0 && (
            <div className="mt-10">
              <h3 className="text-sm font-bold opacity-60">
                {pick(c.otherAr, c.otherEn)}
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {related.map((item) => (
                  <Link
                    key={item.id}
                    href={`/compare/${item.id}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--card)] border border-[var(--border)] text-sm font-medium hover:border-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors"
                  >
                    {pick(item.competitorAr, item.competitorEn)}
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Services liés */}
          {relatedServices.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-bold opacity-60">
                {pick(c.relatedServicesAr, c.relatedServicesEn)}
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {relatedServices.map((service) => (
                  <Link
                    key={service.id}
                    href={`/services/${service.id}`}
                    className="px-4 py-2 rounded-full bg-[var(--card)] border border-[var(--border)] text-sm font-medium hover:border-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors"
                  >
                    {pick(service.titleAr, service.titleEn)}
                  </Link>
                ))}
                <Link
                  href="/pricing"
                  className="px-4 py-2 rounded-full bg-[var(--card)] border border-[var(--border)] text-sm font-bold text-[var(--accent)] hover:border-[var(--accent)] transition-colors"
                >
                  {pick(c.allPlansAr, c.allPlansEn)}
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
