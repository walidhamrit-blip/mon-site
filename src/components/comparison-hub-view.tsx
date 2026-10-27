"use client";

import Link from "next/link";
import { ArrowUpRight, Check, Scale, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Price } from "@/components/price";
import type { ComparisonSeo } from "@/lib/comparisons";
import type { Faq } from "@/lib/site-types";

/**
 * Hub des comparaisons (/compare) — composant client : la page suit la
 * langue du site (arabe / anglais) sans rechargement.
 */
export function ComparisonHubView({
  items,
  faqs,
  sitePriceUsd,
}: {
  items: ReadonlyArray<ComparisonSeo>;
  faqs: ReadonlyArray<Faq>;
  sitePriceUsd: number;
}) {
  const { locale, t } = useI18n();
  const ar = locale === "ar";
  const c = t.compare;
  const pick = <T,>(arValue: T, enValue: T): T => (ar ? arValue : enValue);

  return (
    <div className="pt-6" dir={ar ? "rtl" : "ltr"}>
      {/* En-tête */}
      <section className="section-tight border-b border-[var(--border)] bg-[var(--secondary)]/35">
        <div className="site-container px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <Link
              href="/"
              className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 transition-colors hover:border-[var(--accent)]"
            >
              ← {pick(c.homeAr, c.homeEn)}
            </Link>
            <span className="rounded-full border border-[var(--accent)]/35 bg-[var(--accent)]/12 px-3 py-1 text-[var(--accent)]">
              <Scale className="me-1 inline h-3 w-3" />
              {pick(c.badgeAr, c.badgeEn)}
            </span>
          </div>

          <h1 className="mt-6 max-w-[26ch] text-[clamp(1.8rem,1.2rem+2.2vw,2.85rem)] font-black leading-[1.08] tracking-[-0.03em] text-balance">
            {pick(c.hubTitleAr, c.hubTitleEn)}
          </h1>
          <p className="mt-4 max-w-[66ch] text-[15.5px] leading-8 text-[var(--muted-foreground)]">
            {pick(c.hubSubtitleAr, c.hubSubtitleEn)}
          </p>

          <div
            id="compare-answer"
            className="mt-7 max-w-[74ch] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow-xs)]"
          >
            <p className="text-sm leading-7 opacity-80">
              <strong>{ar ? "باختصار:" : "In short:"}</strong>{" "}
              {pick(c.hubShortAr, c.hubShortEn)}{" "}
              {ar ? "موقع من" : "A website from"}{" "}
              <Price usd={sitePriceUsd} compact />
              {ar ? "، تسليم من 7 أيام." : ", delivered in 7 days."}
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/contact"
              className="h-11 px-6 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] inline-flex items-center justify-center text-sm font-bold"
            >
              {pick(c.freeQuoteAr, c.freeQuoteEn)}
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

      {/* Liste des comparaisons */}
      <section className="py-10 border-b border-[var(--border)]">
        <div className="site-container px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-black">
            {pick(c.hubAllAr, c.hubAllEn)}
          </h2>
          <p className="mt-1 text-sm opacity-60">
            {ar
              ? `${items.length} مقارنات — اختر ما يناسب سؤالك`
              : `${items.length} comparisons — pick the one that matches your question`}
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {items.map((comparison) => (
              <Link
                key={comparison.id}
                href={`/compare/${comparison.id}`}
                className="group rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-6 transition-colors hover:border-[var(--accent)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black leading-snug">
                      {pick(comparison.h1Ar, comparison.h1En)}
                    </h3>
                    <p dir="ltr" className="mt-1 text-xs opacity-55">
                      {ar
                        ? `${comparison.competitorEn} مقابل نخبة`
                        : `${comparison.competitorEn} vs Nukhba`}
                    </p>
                  </div>
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[var(--border)] text-[var(--accent)] transition-colors group-hover:bg-[var(--accent)] group-hover:text-[var(--accent-foreground)]">
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                </div>

                <p className="mt-3 text-sm opacity-70 leading-6">
                  {pick(comparison.descriptionAr, comparison.descriptionEn)}
                </p>

                {/* L'annonce en miniature */}
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-[#C1272D]/10 p-3">
                    <p className="flex items-center gap-1 font-black text-[#C1272D]">
                      <X className="h-3 w-3" />
                      {pick(comparison.competitorAr, comparison.competitorEn)}
                    </p>
                    <p dir="ltr" className="mt-1 font-black text-[#C1272D]">
                      {comparison.themPriceLabel}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#0E9F6E]/10 p-3">
                    <p className="flex items-center gap-1 font-black text-[#0E9F6E]">
                      <Check className="h-3 w-3" />
                      {pick(c.usNameAr, c.usNameEn)}
                    </p>
                    <p className="mt-1 font-black text-[#0E9F6E]">
                      {pick(comparison.usPriceLabelAr, comparison.usPriceLabelEn)}
                    </p>
                  </div>
                </div>

                <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-[var(--accent)] group-hover:underline">
                  {pick(c.hubReadAr, c.hubReadEn)}
                  <span aria-hidden="true">{ar ? "←" : "→"}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-10 border-b border-[var(--border)] bg-[var(--secondary)]/20">
        <div className="site-container px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-black">
            {pick(c.hubFaqTitleAr, c.hubFaqTitleEn)}
          </h2>
          <div className="mt-6 grid md:grid-cols-2 gap-4">
            {faqs.map((faq, index) => (
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

      {/* CTA */}
      <section className="py-10">
        <div className="site-container px-4 sm:px-6 lg:px-8">
          <div className="rounded-[var(--radius-lg)] bg-[var(--primary)] p-8 text-[var(--primary-foreground)] shadow-[var(--shadow-lg)] lg:flex-row lg:items-center lg:justify-between lg:p-10">
            <div>
              <h2 className="text-2xl font-black">
                {pick(c.hubCtaTitleAr, c.hubCtaTitleEn)}
              </h2>
              <p className="mt-2 opacity-70 max-w-[60ch]">
                {pick(c.hubCtaTextAr, c.hubCtaTextEn)}
              </p>
            </div>
            <div className="mt-6 lg:mt-0 flex flex-wrap gap-3 shrink-0">
              <Link
                href="/contact"
                className="h-11 px-6 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] inline-flex items-center justify-center font-bold"
              >
                {pick(c.quoteAr, c.quoteEn)}
              </Link>
              <Link
                href="/services"
                className="h-11 px-6 rounded-full bg-white/10 border border-white/20 inline-flex items-center justify-center font-bold hover:bg-white/15"
              >
                {pick(c.openServicesAr, c.openServicesEn)}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
