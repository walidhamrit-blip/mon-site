"use client";

import Link from "next/link";
import { ArrowUpRight, Check, Scale, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { ComparisonSeo } from "@/lib/comparisons";

/**
 * Bandeau « comparaisons » affiché en haut de la page /services (Open
 * services) : c'est le point d'entrée naturel du visiteur qui hésite entre
 * « payer une annonce » et « payer un site ».
 *
 * Composant client : suit la langue du site (arabe / anglais).
 */
export function ComparisonStrip({
  items,
}: {
  items: ReadonlyArray<ComparisonSeo>;
}) {
  const { locale, t } = useI18n();
  const ar = locale === "ar";
  const c = t.compare;
  const pick = <T,>(arValue: T, enValue: T): T => (ar ? arValue : enValue);

  return (
    <section className="border-b border-[var(--border)] bg-[var(--secondary)]/25">
      <div className="site-container px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-[62ch]">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent)]/35 bg-[var(--accent)]/12 px-3 py-1 text-xs font-bold text-[var(--accent)]">
              <Scale className="h-3 w-3" />
              {pick(c.badgeAr, c.badgeEn)}
            </span>
            <h2 className="mt-3 text-xl font-black sm:text-2xl">
              {pick(c.stripTitleAr, c.stripTitleEn)}
            </h2>
            <p className="mt-2 text-sm opacity-70 leading-7">
              {pick(c.stripSubtitleAr, c.stripSubtitleEn)}
            </p>
          </div>
          <Link
            href="/compare"
            className="h-11 px-5 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] inline-flex items-center justify-center text-sm font-bold shrink-0"
          >
            {pick(c.stripCtaAr, c.stripCtaEn)}
            <ArrowUpRight className="ms-1.5 h-4 w-4" />
          </Link>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((comparison) => (
            <Link
              key={comparison.id}
              href={`/compare/${comparison.id}`}
              className="group rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:border-[var(--accent)]"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-black leading-snug">
                  {pick(comparison.h1Ar, comparison.h1En)}
                </p>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-[var(--accent)] opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                <span className="flex items-center gap-1 rounded-lg bg-[#C1272D]/10 px-2 py-1.5 font-bold text-[#C1272D]">
                  <X className="h-3 w-3 shrink-0" />
                  <span className="truncate" dir="ltr">
                    {comparison.themPriceLabel}
                  </span>
                </span>
                <span className="flex items-center gap-1 rounded-lg bg-[#0E9F6E]/10 px-2 py-1.5 font-bold text-[#0E9F6E]">
                  <Check className="h-3 w-3 shrink-0" />
                  <span className="truncate">
                    {pick(comparison.usPriceLabelAr, comparison.usPriceLabelEn)}
                  </span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
