"use client";

import Link from "next/link";
import { ArrowUpRight, Check, Clock, Layers, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Price } from "@/components/price";
import { formatMainPrice } from "@/lib/installments";
import { renderTemplate } from "@/lib/text-template";
import { resolveServiceLanding, servicePath, type ServiceLike } from "@/lib/services";
import { ComparisonStrip } from "@/components/comparison-strip";
import type { ComparisonSeo } from "@/lib/comparisons";
import type { Faq } from "@/lib/site-types";

/**
 * Page « Open services » (/services) — composant client.
 *
 * La page suit la langue du site (bouton AR/EN) comme le reste des
 * sections dynamiques. Les prix affichés sont lus dans la configuration
 * vivante (props `services`) : le serveur ne fait que les transmettre.
 */
export function ServicesHubView({
  services,
  comparisons,
  faqs,
}: {
  services: ReadonlyArray<ServiceLike>;
  comparisons: ReadonlyArray<ComparisonSeo>;
  faqs: ReadonlyArray<Faq>;
}) {
  const { locale, t } = useI18n();
  const ar = locale === "ar";
  const s = t.servicesHub;
  const pick = <T,>(arValue: T, enValue: T): T => (ar ? arValue : enValue);

  const price = (id: string, fallback: number) =>
    formatMainPrice(
      services.find((service) => service.id === id)?.priceFromUsd ?? fallback,
      "$",
    );

  const fill = (template: string, values: Record<string, string | number>) =>
    Object.entries(values).reduce(
      (text, [key, value]) => text.replace(`{${key}}`, String(value)),
      template,
    );


  const answer = fill(
    pick(s.answerAr, s.answerEn),
    {
      count: services.length,
      restyle: price("restyle", 49),
      addSection: price("add-section", 19),
      slides: price("slides", 29),
      branding: price("branding", 39),
      landing: price("landing", 59),
      fix: price("fix-optimize", 15),
    },
  );

  const steps = [
    {
      num: "01",
      title: pick(s.step1TitleAr, s.step1TitleEn),
      desc: pick(s.step1DescAr, s.step1DescEn),
    },
    {
      num: "02",
      title: pick(s.step2TitleAr, s.step2TitleEn),
      desc: pick(s.step2DescAr, s.step2DescEn),
    },
    {
      num: "03",
      title: pick(s.step3TitleAr, s.step3TitleEn),
      desc: pick(s.step3DescAr, s.step3DescEn),
    },
  ];

  const explore = [
    { href: "/sectors", label: pick(s.linkSectorsAr, s.linkSectorsEn) },
    { href: "/demos", label: pick(s.linkDemosAr, s.linkDemosEn) },
    { href: "/pricing", label: pick(s.linkPricingAr, s.linkPricingEn) },
    { href: "/apps", label: pick(s.linkAppsAr, s.linkAppsEn) },
    { href: "/contact", label: pick(s.linkContactAr, s.linkContactEn) },
  ];

  return (
    <div className="pt-6" dir={ar ? "rtl" : "ltr"}>
      {/* Comparaisons — bandeau en haut : le visiteur qui hésite entre
          « payer une annonce » et « payer un site » trouve la réponse
          immédiatement, avant la grille des services. */}
      <ComparisonStrip items={comparisons} />

      {/* Hero */}
      <section className="section-tight border-b border-[var(--border)] bg-[var(--secondary)]/35">
        <div className="site-container px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <Link
              href="/"
              className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 transition-colors hover:border-[var(--accent)]"
            >
              ← {pick(s.homeAr, s.homeEn)}
            </Link>
            <span className="rounded-full border border-[var(--accent)]/35 bg-[var(--accent)]/12 px-3 py-1 text-[var(--accent)]">
              {pick(s.badgeAr, s.badgeEn)}
            </span>
          </div>

          <h1 className="mt-6 max-w-[26ch] text-[clamp(1.8rem,1.2rem+2.2vw,2.85rem)] font-black leading-[1.08] tracking-[-0.03em] text-balance">
            {pick(s.heroTitleAr, s.heroTitleEn)}
          </h1>
          <p className="mt-4 max-w-[66ch] text-[15.5px] leading-8 text-[var(--muted-foreground)]">
            {renderTemplate(pick(s.heroTextAr, s.heroTextEn), {
              from: ar ? "15 دولاراً" : "$15",
              delivery: ar ? "24 ساعة" : "24 hours",
            })}
          </p>
          {ar && (
            <p
              className="mt-2 max-w-[66ch] text-[13px] text-[var(--muted-foreground)]/75"
              dir="ltr"
            >
              {s.heroSecondaryEn}
            </p>
          )}

          <div
            id="services-answer"
            className="mt-7 max-w-[70ch] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow-xs)]"
          >
            <p className="text-sm leading-7 opacity-80">
              <strong>{pick(s.shortAr, s.shortEn)}</strong> {answer}
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/contact"
              className="h-11 px-6 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] inline-flex items-center justify-center text-sm font-bold"
            >
              {pick(s.ctaQuoteAr, s.ctaQuoteEn)}
            </Link>
            <Link
              href="/pricing"
              className="h-11 px-6 rounded-full border border-[var(--border)] bg-[var(--card)] inline-flex items-center justify-center text-sm font-bold hover:bg-[var(--secondary)]"
            >
              {pick(s.ctaPricingAr, s.ctaPricingEn)}
            </Link>
          </div>

          <ul className="mt-8 grid sm:grid-cols-3 gap-4 text-sm">
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 text-[var(--accent)]" />
              {pick(s.bulletPriceAr, s.bulletPriceEn)}
            </li>
            <li className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[var(--accent)]" />
              {pick(s.bulletDeliveryAr, s.bulletDeliveryEn)}
            </li>
            <li className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-[var(--accent)]" />
              {pick(s.bulletRevisionsAr, s.bulletRevisionsEn)}
            </li>
          </ul>
        </div>
      </section>

      {/* Grille des services */}
      <section className="section-tight">
        <div className="site-container px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl lg:text-3xl font-black">
                {fill(pick(s.gridTitleAr, s.gridTitleEn), { count: services.length })}
              </h2>
              <p className="mt-1 text-sm opacity-60">
                {pick(s.gridSubAr, s.gridSubEn)}
                {ar && <span className="ms-2 opacity-60">{s.gridSubEn}</span>}
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service) => {
              const landing = resolveServiceLanding(service);
              return (
                <article
                  key={service.id}
                  className="card-surface card-interactive group flex flex-col p-6"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="grid place-items-center h-9 w-9 rounded-full bg-[var(--accent)]/12 text-[var(--accent)]">
                        <Sparkles className="h-4 w-4" />
                      </span>
                      <h3 className="font-black text-lg leading-tight">
                        <Link
                          href={servicePath(service.id)}
                          className="hover:text-[var(--accent)] transition-colors"
                        >
                          {pick(service.titleAr, service.titleEn)}
                        </Link>
                      </h3>
                    </div>
                    {(service.badgeAr || service.badgeEn) && (
                      <span className="shrink-0 px-2 py-1 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] text-[10px] font-black">
                        {pick(service.badgeAr ?? "", service.badgeEn ?? "")}
                      </span>
                    )}
                  </div>

                  <p className="mt-4 text-sm leading-6 opacity-70">
                    {pick(service.descAr, service.descEn)}
                  </p>
                  {ar && (
                    <p className="mt-1 text-xs leading-5 opacity-50" dir="ltr">
                      {service.descEn}
                    </p>
                  )}

                  <ul className="mt-4 space-y-1.5 text-xs opacity-70">
                    {(ar ? service.featuresAr : service.featuresEn).map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto pt-5">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm opacity-50">
                        {pick(s.fromAr, s.fromEn)}
                      </span>
                      {/* Un seul montant : le composant <Price> affiche déjà
                          « facturé en USD » quand la devise change. */}
                      <span className="text-2xl font-black">
                        <Price usd={service.priceFromUsd} />
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] opacity-50">
                      {fill(pick(s.deliveryAr, s.deliveryEn), {
                        value: pick(landing.deliveryAr, landing.deliveryEn),
                      })}
                    </p>
                    <Link
                      href={servicePath(service.id)}
                      className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--accent)] hover:underline"
                    >
                      {pick(s.detailsAr, s.detailsEn)}
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Comment ça marche */}
      <section className="py-12 bg-[var(--secondary)]/30 border-y border-[var(--border)]">
        <div className="site-container px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl lg:text-3xl font-black">
            {pick(s.stepsTitleAr, s.stepsTitleEn)}
          </h2>
          <p className="mt-1 text-sm opacity-60">{pick(s.stepsSubAr, s.stepsSubEn)}</p>
          <ol className="mt-6 grid md:grid-cols-3 gap-5">
            {steps.map((step) => (
              <li
                key={step.num}
                className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-6"
              >
                <span className="text-3xl font-black text-[var(--accent)]/50">
                  {step.num}
                </span>
                <h3 className="mt-2 font-black">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 opacity-65">{step.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* FAQ */}
      <section className="section-tight">
        <div className="site-container px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-black">{pick(s.faqTitleAr, s.faqTitleEn)}</h2>
          <p className="mt-1 text-sm opacity-60">
            {pick(s.faqSubAr, s.faqSubEn)}
            {ar && <span className="ms-2 opacity-60">{s.faqSubEn}</span>}
          </p>
          <div className="mt-6 grid md:grid-cols-2 gap-4">
            {faqs.map((faq) => (
              <div
                key={faq.qAr}
                className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-6"
              >
                <h3 className="font-bold">{pick(faq.qAr, faq.qEn)}</h3>
                <p className="mt-3 text-sm leading-6 opacity-70">{pick(faq.aAr, faq.aEn)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Maillage interne */}
      <section className="py-10 border-t border-[var(--border)]">
        <div className="site-container px-4 sm:px-6 lg:px-8">
          <h2 className="text-sm font-bold opacity-60">
            {pick(s.exploreAr, s.exploreEn)}
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {explore.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-4 py-2 rounded-full bg-[var(--card)] border border-[var(--border)] text-sm font-medium hover:border-[var(--accent)]"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
