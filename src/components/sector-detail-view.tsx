"use client";

import Link from "next/link";
import Image from "next/image";
import { Check } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Price } from "@/components/price";
import { fillTemplate, renderTemplate } from "@/lib/text-template";
import type { SectorSeo } from "@/lib/sectors";
import type { Demo } from "@/lib/site-types";

/**
 * Page d'un secteur (/sectors/[sector]) — composant client.
 *
 * La page suit la langue du site (bouton AR/EN). Le serveur fournit le
 * secteur, les réalisations du secteur et les agrégats (fonctionnalités,
 * prix d'entrée) ; l'affichage choisit la langue.
 */
export function SectorDetailView({
  sector,
  demos,
  featuresAr,
  featuresEn,
  priceFromUsd,
  otherSectors,
  demoPlans,
}: {
  sector: SectorSeo;
  demos: ReadonlyArray<Demo>;
  featuresAr: ReadonlyArray<string>;
  featuresEn: ReadonlyArray<string>;
  priceFromUsd: number | null;
  otherSectors: ReadonlyArray<{ id: string; labelAr: string; labelEn: string }>;
  /** Prix de chaque réalisation (déjà résolus côté serveur). */
  demoPlans: Record<
    string,
    {
      tier: number;
      nameEn: string;
      priceUsd: number | null;
      customizationPercent: number | null;
      customizationUsd: number | null;
      totalPriceUsd: number | null;
    } | null
  >;
}) {
  const { locale, t } = useI18n();
  const ar = locale === "ar";
  const s = t.sectorDetail;
  const count = demos.length;
  const pick = <T,>(arValue: T, enValue: T): T => (ar ? arValue : enValue);
  const main = <T,>(arValue: T, enValue: T) => (ar ? arValue : enValue);
  const second = <T,>(arValue: T, enValue: T): T | null => (ar ? enValue : null);

  const label = main(sector.labelAr, sector.labelEn);

  return (
    <div className="pt-6" dir={ar ? "rtl" : "ltr"}>
      {/* Hero sectoriel */}
      <section className="section-tight border-b border-[var(--border)] bg-[var(--secondary)]/35">
        <div className="site-container px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <Link
              href="/sectors"
              className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 transition-colors hover:border-[var(--accent)]"
            >
              ← {pick(s.allSectorsAr, s.allSectorsEn)}
            </Link>
            <span className="rounded-full border border-[var(--accent)]/35 bg-[var(--accent)]/12 px-3 py-1 text-[var(--accent)]">
              {ar ? `${sector.labelAr} · ${sector.labelEn}` : sector.labelEn}
            </span>
          </div>

          <h1 className="mt-6 max-w-[28ch] text-[clamp(1.8rem,1.2rem+2.2vw,2.85rem)] font-black leading-[1.08] tracking-[-0.03em] text-balance">
            {main(sector.h1Ar, sector.h1En)}
          </h1>
          <p className="mt-3 text-lg opacity-70 max-w-[64ch] leading-relaxed">
            {main(sector.heroSubtitleAr, sector.heroSubtitleEn)}
          </p>
          <p className="mt-2 text-sm opacity-50 max-w-[64ch]">
            {second(sector.heroSubtitleAr, sector.heroSubtitleEn)}
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <a
              href="#demos"
              className="h-11 px-6 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] inline-flex items-center justify-center text-sm font-bold"
            >
              {count === 1
                ? pick(s.browseSitesOneAr, s.browseSitesOneEn)
                : fillTemplate(pick(s.browseSitesAr, s.browseSitesEn), {
                    count,
                  })}
            </a>
            <Link
              href="/contact"
              className="h-11 px-6 rounded-full border border-[var(--border)] bg-[var(--card)] inline-flex items-center justify-center text-sm font-bold hover:bg-[var(--secondary)]"
            >
              {pick(s.quoteFreeAr, s.quoteFreeEn)}
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap gap-2 text-xs">
            {(ar ? sector.keywordsAr : sector.keywordsEn).map((kw) => (
              <span
                key={kw}
                className="px-3 py-1 rounded-full bg-[var(--card)] border border-[var(--border)] opacity-70"
              >
                {kw}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Réalisations du secteur */}
      <section id="demos" className="py-10">
        <div className="site-container px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between gap-4 mb-6">
            <h2 className="text-2xl font-black">
              {count === 1
                ? fillTemplate(pick(s.sitesTitleOneAr, s.sitesTitleOneEn), { label })
                : fillTemplate(pick(s.sitesTitleAr, s.sitesTitleEn), {
                    label,
                    count,
                  })}
            </h2>
            <span className="text-sm opacity-60">{sector.labelEn} showcases</span>
          </div>

          {demos.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--card)] p-12 text-center">
              <p className="font-bold">{pick(s.noProjectsAr, s.noProjectsEn)}</p>
              <p className="mt-1 text-sm opacity-60">
                {second(s.noProjectsAr, s.noProjectsEn)}
              </p>
              <Link
                href="/contact"
                className="mt-4 inline-flex h-10 px-6 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] items-center justify-center text-sm font-bold"
              >
                {pick(s.startProjectAr, s.startProjectEn)}
              </Link>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {demos.map((demo) => {
                const cls = demoPlans[demo.slug];
                return (
                  <Link
                    key={demo.slug}
                    href={`/demos/${demo.slug}`}
                    className="card-surface card-interactive group flex flex-col overflow-hidden"
                  >
                    <div className="relative aspect-[16/11] overflow-hidden">
                      <Image
                        src={demo.image}
                        alt={main(demo.imageAltAr || demo.title, demo.imageAltEn || demo.titleEn)}
                        fill
                        sizes="(max-width: 640px) 100vw, 33vw"
                        className="object-cover group-hover:scale-[1.04] transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      <div className="absolute top-3 start-3">
                        <span className="px-2.5 py-1 rounded-full bg-white text-black text-xs font-bold">
                          {main(demo.sectorAr, demo.sectorEn)}
                        </span>
                      </div>
                      {demo.previewUrl && demo.previewUrl !== "#" && (
                        <div className="absolute top-3 end-3">
                          <span className="px-2.5 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-black">
                            LIVE
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="p-5 flex-1 flex flex-col">
                      <h3 className="font-black text-[16px] group-hover:text-[var(--accent)] transition-colors">
                        {main(demo.title, demo.titleEn)}
                      </h3>
                      <p className="text-sm opacity-60 mt-1 line-clamp-2">
                        {main(demo.description, demo.descriptionEn)}
                      </p>
                      {cls && (
                        <div className="mt-3 rounded-xl bg-[var(--secondary)]/60 p-3 text-xs">
                          <div className="mb-2 inline-flex rounded-full border border-[var(--border)] px-2 py-0.5 font-bold">
                            {pick(s.tierAr, s.tierEn)} {cls.tier} · {cls.nameEn}
                          </div>
                          <div className="flex justify-between gap-2">
                            <span className="opacity-60">
                              {pick(s.modelPriceAr, s.modelPriceEn)}
                            </span>
                            <strong>
                              {cls.priceUsd == null ? (
                                pick(s.onRequestAr, s.onRequestEn)
                              ) : (
                                <Price usd={cls.priceUsd} compact />
                              )}
                            </strong>
                          </div>
                          <div className="mt-1 flex justify-between gap-2">
                            <span className="opacity-60">
                              {pick(s.customisationAr, s.customisationEn)}
                              {cls.customizationPercent == null
                                ? ""
                                : ` (${cls.customizationPercent}${ar ? "٪" : "%"})`}
                            </span>
                            <strong dir="ltr">
                              {cls.customizationUsd == null
                                ? pick(s.quoteAr, s.quoteEn)
                                : `$${cls.customizationUsd}`}
                            </strong>
                          </div>
                          <div className="mt-1 flex justify-between gap-2 border-t border-[var(--border)]/70 pt-1 font-black">
                            <span>{pick(s.totalAr, s.totalEn)}</span>
                            <strong>
                              {cls.totalPriceUsd == null ? (
                                pick(s.beforePaymentAr, s.beforePaymentEn)
                              ) : (
                                <Price usd={cls.totalPriceUsd} compact />
                              )}
                            </strong>
                          </div>
                        </div>
                      )}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {(ar ? demo.features : demo.featuresEn)
                          .slice(0, 3)
                          .map((feature) => (
                            <span
                              key={feature}
                              className="px-2.5 py-1 rounded-full bg-[var(--secondary)] border border-[var(--border)] text-xs"
                            >
                              {feature}
                            </span>
                          ))}
                      </div>
                    </div>
                    <div className="px-5 pb-5">
                      <span className="text-sm font-bold text-[var(--accent)] group-hover:underline">
                        {pick(s.detailsAr, s.detailsEn)}
                        <span aria-hidden="true" className="ms-1">
                          {ar ? "←" : "→"}
                        </span>
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* CTA sectoriel */}
          <div className="mt-12 flex flex-col gap-6 rounded-[var(--radius-lg)] bg-[var(--primary)] p-8 text-[var(--primary-foreground)] shadow-[var(--shadow-lg)] lg:flex-row lg:items-center lg:justify-between lg:p-10">
            <div>
              <h3 className="text-2xl font-black">
                {fillTemplate(pick(s.ctaTitleAr, s.ctaTitleEn), { label })}
              </h3>
              <p className="mt-2 opacity-70 max-w-[50ch]">
                {pick(s.ctaTextAr, s.ctaTextEn)}
              </p>
            </div>
            <div className="flex gap-3 shrink-0">
              <Link
                href="/contact"
                className="h-11 px-6 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] inline-flex items-center justify-center font-bold"
              >
                {pick(s.ctaQuoteAr, s.ctaQuoteEn)}
              </Link>
              <Link
                href="/pricing"
                className="h-11 px-6 rounded-full bg-white/10 border border-white/20 inline-flex items-center justify-center font-bold hover:bg-white/15"
              >
                {pick(s.ctaPlansAr, s.ctaPlansEn)}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Ce qu'inclut un site du secteur — fonctionnalités agrégées */}
      {featuresAr.length > 0 && (
        <section className="py-10 border-t border-[var(--border)]">
          <div className="site-container px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-black">
              {fillTemplate(pick(s.includesTitleAr, s.includesTitleEn), { label })}
            </h2>
            {ar && (
              <p className="mt-1 text-sm opacity-60">
                {fillTemplate(second(s.includesTitleAr, s.includesTitleEn) ?? "", {
                  label,
                })}
              </p>
            )}
            <p className="mt-4 leading-8 opacity-80 max-w-[70ch]">
              {main(sector.descriptionAr, sector.descriptionEn)}
            </p>
            {ar && (
              <p className="mt-2 leading-7 opacity-60 text-sm max-w-[70ch]">
                {second(sector.descriptionAr, sector.descriptionEn)}
              </p>
            )}
            <div className="mt-6 grid md:grid-cols-2 gap-x-8 gap-y-2.5">
              {(ar ? featuresAr : featuresEn).map((feature, idx) => (
                <div key={feature} className="flex gap-2 text-sm">
                  <span className="h-5 w-5 rounded-full bg-green-500 text-white grid place-items-center flex-shrink-0 mt-0.5">
                    <Check className="h-3 w-3" />
                  </span>
                  <span>
                    {feature}
                    {ar && featuresEn[idx] ? (
                      <span className="opacity-50">
                        {" "}
                        — {featuresEn[idx]}
                      </span>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
            {priceFromUsd != null && (
              <p className="mt-6 text-sm opacity-70">
                {renderTemplate(pick(s.priceFromAr, s.priceFromEn), {
                  label,
                  price: (
                    <strong dir="ltr" className="text-[var(--accent)]">
                      ${priceFromUsd}
                    </strong>
                  ),
                })}{" "}
                <Link
                  href="/pricing"
                  className="font-bold text-[var(--accent)] hover:underline"
                >
                  {pick(s.comparePlansAr, s.comparePlansEn)}
                </Link>
              </p>
            )}
          </div>
        </section>
      )}

      {/* FAQ sectorielle */}
      <section className="py-10 bg-[var(--secondary)]/20 border-t border-[var(--border)]">
        <div className="site-container px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-black">
            {fillTemplate(pick(s.faqTitleAr, s.faqTitleEn), { label })}
          </h2>
          {ar && (
            <p className="mt-1 text-sm opacity-60">
              {fillTemplate(second(s.faqTitleAr, s.faqTitleEn) ?? "", { label })}
            </p>
          )}
          <div className="mt-6 grid md:grid-cols-2 gap-4">
            {sector.faqsAr.map((faq, index) => (
              <div
                key={index}
                className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-6"
              >
                <h3 className="font-bold">{main(faq.qAr, faq.qEn)}</h3>
                <p className="mt-1 text-xs opacity-50">{second(faq.qAr, faq.qEn)}</p>
                <p className="mt-3 text-sm opacity-70 leading-6">{main(faq.aAr, faq.aEn)}</p>
                <p className="mt-1 text-sm opacity-50 leading-6">{second(faq.aAr, faq.aEn)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Maillage interne : autres secteurs */}
      <section className="py-8 border-t border-[var(--border)]">
        <div className="site-container px-4 sm:px-6 lg:px-8">
          <h3 className="text-sm font-bold opacity-60">
            {pick(s.otherSectorsAr, s.otherSectorsEn)}
          </h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {otherSectors.map((other) => (
              <Link
                key={other.id}
                href={`/sectors/${other.id}`}
                className="px-4 py-2 rounded-full bg-[var(--card)] border border-[var(--border)] text-sm font-medium hover:border-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors"
              >
                {pick(other.labelAr, other.labelEn)}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
