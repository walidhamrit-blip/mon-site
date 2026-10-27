"use client";

import Link from "next/link";
import { ArrowLeft, Check, Clock, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Price } from "@/components/price";
import { fillTemplate, renderTemplate } from "@/lib/text-template";
import { servicePath, type ServiceLike, type ServiceLandingContent } from "@/lib/services";

/**
 * Page d'un service (/services/[service]) — composant client.
 *
 * La page suit la langue du site (bouton AR/EN) comme le hub /services.
 * Le serveur ne fournit que les données (service, contenu éditorial,
 * maillage) ; les prix affichés restent lus dans la configuration vivante.
 */
export function ServiceDetailView({
  service,
  landing,
  relatedSectors,
  relatedDemos,
  others,
  sectorLinks,
  whatsappUrl,
  canonical,
}: {
  service: ServiceLike;
  landing: ServiceLandingContent;
  relatedSectors: ReadonlyArray<{ id: string; labelAr: string; labelEn: string }>;
  relatedDemos: ReadonlyArray<{
    slug: string;
    title: string;
    titleEn: string;
    description: string;
    descriptionEn: string;
    sectorAr: string;
    sectorEn: string;
  }>;
  others: ReadonlyArray<ServiceLike>;
  sectorLinks: ReadonlyArray<{ id: string; labelAr: string; labelEn: string }>;
  whatsappUrl: string;
  canonical: string;
}) {
  const { locale, t } = useI18n();
  const ar = locale === "ar";
  const s = t.serviceDetail;
  const pick = <T,>(arValue: T, enValue: T): T => (ar ? arValue : enValue);

  // Le texte principal est dans la langue active. La traduction en petit
  // sous le texte n'apparaît qu'en mode arabe (convention du site) : en
  // anglais, la page reste intégralement en anglais.
  const main = <T,>(arValue: T, enValue: T) => (ar ? arValue : enValue);
  const second = <T,>(arValue: T, enValue: T): T | null => (ar ? enValue : null);

  return (
    <div className="pt-6" dir={ar ? "rtl" : "ltr"}>
      {/* Hero */}
      <section className="section-tight border-b border-[var(--border)] bg-[var(--secondary)]/35">
        <div className="site-container px-4 sm:px-6 lg:px-8">
          <nav
            aria-label={pick(s.breadcrumbAr, s.breadcrumbEn)}
            className="flex flex-wrap items-center gap-2 text-xs font-bold"
          >
            <Link
              href="/services"
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)]"
            >
              <ArrowLeft className="h-3 w-3" />
              {pick(s.allServicesAr, s.allServicesEn)}
            </Link>
            <span className="rounded-full border border-[var(--accent)]/35 bg-[var(--accent)]/12 px-3 py-1 text-[var(--accent)]">
              {main(landing.deliveryAr, landing.deliveryEn)}
            </span>
          </nav>

          <div className="mt-6 grid lg:grid-cols-[1.6fr_1fr] gap-8 items-start">
            <div>
              <h1 className="text-[32px] lg:text-[42px] font-black tracking-tight leading-tight max-w-[26ch]">
                {main(landing.h1Ar, landing.h1En)}
              </h1>
              <p className="mt-1 text-sm opacity-50">
                {second(landing.h1Ar, landing.h1En)}
              </p>
              <p className="mt-4 text-lg opacity-70 max-w-[64ch] leading-relaxed">
                {main(landing.subtitleAr, landing.subtitleEn)}
              </p>
              <p className="mt-2 text-sm opacity-45 max-w-[64ch]">
                {second(landing.subtitleAr, landing.subtitleEn)}
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-11 px-6 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] inline-flex items-center justify-center gap-2 text-sm font-bold"
                >
                  <MessageCircle className="h-4 w-4" />
                  {pick(s.whatsappOrderAr, s.whatsappOrderEn)}
                </a>
                <Link
                  href="/contact"
                  className="h-11 px-6 rounded-full border border-[var(--border)] bg-[var(--card)] inline-flex items-center justify-center text-sm font-bold hover:bg-[var(--secondary)]"
                >
                  {pick(s.quoteFormAr, s.quoteFormEn)}
                </Link>
              </div>
            </div>

            {/* Carte tarifaire */}
            <aside className="rounded-[22px] bg-[var(--card)] border border-[var(--border)] p-6 shadow-sm">
              <p className="text-xs font-bold tracking-[0.12em] text-[var(--accent)]">
                {pick(s.startingAtAr, s.startingAtEn)}
              </p>
              <p className="mt-2 text-4xl font-black" dir="ltr">
                <Price usd={service.priceFromUsd} />
              </p>
              <ul className="mt-4 space-y-2 text-xs opacity-70">
                <li className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-[var(--accent)]" />
                  {fillTemplate(pick(s.deliveryAr, s.deliveryEn), {
                    value: main(landing.deliveryAr, landing.deliveryEn),
                  })}
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-[var(--accent)]" />
                  {pick(s.fixedPriceAr, s.fixedPriceEn)}
                </li>
                <li className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
                  {pick(s.instalmentsAr, s.instalmentsEn)}
                </li>
              </ul>
              <Link
                href="/pricing"
                className="mt-5 inline-flex items-center gap-1 text-xs font-bold text-[var(--accent)] hover:underline"
              >
                {pick(s.comparePlansAr, s.comparePlansEn)}
                <span aria-hidden="true">{ar ? "←" : "→"}</span>
              </Link>
            </aside>
          </div>

          {/* Réponse directe (GEO / speakable) */}
          <div
            id="service-answer"
            className="mt-8 rounded-2xl bg-[var(--card)] border border-[var(--border)] p-6 max-w-[78ch]"
          >
            <p className="text-sm leading-7 opacity-80">
              <strong className="text-[var(--accent)]">
                {pick(s.shortAr, s.shortEn)}{" "}
              </strong>
              {main(landing.answerAr, landing.answerEn)}
            </p>
            <p className="mt-3 text-xs leading-6 opacity-50">
              {second(landing.answerAr, landing.answerEn)}
            </p>
          </div>
        </div>
      </section>

      {/* Prestations + cible */}
      <section className="section-tight">
        <div className="site-container px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-8">
            <div>
              <h2 className="text-2xl font-black">{pick(s.includedAr, s.includedEn)}</h2>
              <p className="mt-1 text-sm opacity-55">
                {second(s.includedAr, s.includedEn)}
              </p>
              <ul className="mt-5 space-y-2.5">
                {main(landing.deliverablesAr, landing.deliverablesEn).map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm leading-6">
                    <Check className="h-4 w-4 mt-1 shrink-0 text-[var(--accent)]" />
                    <span className="opacity-80">{item}</span>
                  </li>
                ))}
              </ul>
              <ul className="mt-4 space-y-1 text-xs opacity-45">
                {(second(landing.deliverablesAr, landing.deliverablesEn) ?? []).map((item) => (
                  <li key={item}>· {item}</li>
                ))}
              </ul>
            </div>

            <div className="space-y-5">
              <div className="rounded-2xl bg-[var(--secondary)]/40 border border-[var(--border)] p-6">
                <h2 className="text-lg font-black">{pick(s.whoForAr, s.whoForEn)}</h2>
                <p className="mt-2 text-sm leading-6 opacity-70">
                  {main(landing.bestForAr, landing.bestForEn)}
                </p>
                <p className="mt-1 text-xs leading-5 opacity-45">
                  {second(landing.bestForAr, landing.bestForEn)}
                </p>
              </div>

              <div className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-6">
                <h2 className="text-lg font-black">{pick(s.pricingAr, s.pricingEn)}</h2>
                <p className="mt-2 text-sm leading-6 opacity-70">
                  {renderTemplate(pick(s.pricingTextAr, s.pricingTextEn), {
                    price: <Price usd={service.priceFromUsd} />,
                  })}
                </p>
              </div>

              {relatedSectors.length > 0 && (
                <div className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-6">
                  <h2 className="text-lg font-black">{pick(s.sectorsAr, s.sectorsEn)}</h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {relatedSectors.map((sector) => (
                      <Link
                        key={sector.id}
                        href={`/sectors/${sector.id}`}
                        className="px-3 py-1.5 rounded-full bg-[var(--secondary)] border border-[var(--border)] text-xs font-bold hover:border-[var(--accent)]"
                      >
                        {pick(sector.labelAr, sector.labelEn)}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-12 bg-[var(--secondary)]/25 border-y border-[var(--border)]">
        <div className="site-container px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-black">
            {fillTemplate(pick(s.faqAr, s.faqEn), {
              title: main(service.titleAr, service.titleEn),
            })}
          </h2>
          {ar && (
            <p className="mt-1 text-sm opacity-55">
              {fillTemplate(pick(s.faqAr, s.faqEn), {
                title: second(service.titleAr, service.titleEn) ?? "",
              })}
            </p>
          )}
          <div className="mt-6 grid md:grid-cols-2 gap-4">
            {landing.faqs.map((faq) => (
              <div
                key={faq.qAr}
                className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-6"
              >
                <h3 className="font-bold leading-6">{main(faq.qAr, faq.qEn)}</h3>
                <p className="mt-1 text-xs opacity-45">{second(faq.qAr, faq.qEn)}</p>
                <p className="mt-3 text-sm leading-6 opacity-70">{main(faq.aAr, faq.aEn)}</p>
                <p className="mt-1 text-xs leading-5 opacity-40">{second(faq.aAr, faq.aEn)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Réalisations liées */}
      {relatedDemos.length > 0 && (
        <section className="section-tight">
          <div className="site-container px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-black">
              {pick(s.showcasesAr, s.showcasesEn)}
            </h2>
            <p className="mt-1 text-sm opacity-55">{second(s.showcasesAr, s.showcasesEn)}</p>
            <div className="mt-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {relatedDemos.map((demo) => (
                <Link
                  key={demo.slug}
                  href={`/demos/${demo.slug}`}
                  className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-5 hover:border-[var(--accent)]/50 transition-colors"
                >
                  <span className="text-[11px] font-bold text-[var(--accent)]">
                    {main(demo.sectorAr, demo.sectorEn)}
                  </span>
                  <h3 className="mt-1 font-black">
                    {main(demo.title, demo.titleEn)}
                  </h3>
                  <p className="mt-1 text-xs opacity-55 line-clamp-2">
                    {main(demo.description, demo.descriptionEn)}
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[var(--accent)]">
                    {pick(s.caseStudyAr, s.caseStudyEn)}
                    <span aria-hidden="true">{ar ? "←" : "→"}</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Autres services + CTA */}
      <section className="py-12 border-t border-[var(--border)]">
        <div className="site-container px-4 sm:px-6 lg:px-8">
          <h2 className="text-sm font-bold opacity-60">{pick(s.othersAr, s.othersEn)}</h2>
          <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {others.map((other) => (
              <Link
                key={other.id}
                href={servicePath(other.id)}
                className="flex items-center justify-between gap-3 rounded-xl bg-[var(--card)] border border-[var(--border)] px-4 py-3 text-sm font-medium hover:border-[var(--accent)]"
              >
                <span>{pick(other.titleAr, other.titleEn)}</span>
                <span className="text-xs font-bold text-[var(--accent)]" dir="ltr">
                  <Price usd={other.priceFromUsd} />
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-10 rounded-[24px] bg-[var(--primary)] text-[var(--primary-foreground)] p-8 lg:p-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <h2 className="text-2xl font-black">{pick(s.readyAr, s.readyEn)}</h2>
              <p className="mt-2 opacity-75 max-w-[52ch]">
                {pick(s.readyTextAr, s.readyTextEn)}
              </p>
            </div>
            <div className="flex gap-3 shrink-0">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="h-11 px-6 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] inline-flex items-center justify-center font-bold"
              >
                {pick(s.whatsappDirectAr, s.whatsappDirectEn)}
              </a>
              <Link
                href="/contact"
                className="h-11 px-6 rounded-full bg-white/10 border border-white/20 inline-flex items-center justify-center font-bold hover:bg-white/15"
              >
                {pick(s.contactFormAr, s.contactFormEn)}
              </Link>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-2 text-xs">
            {sectorLinks.map((sector) => (
              <Link
                key={sector.id}
                href={`/sectors/${sector.id}`}
                className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 transition-colors hover:border-[var(--accent)]"
              >
                {pick(sector.labelAr, sector.labelEn)}
              </Link>
            ))}
            <Link
              href="/services"
              className="px-3 py-1 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] font-bold"
            >
              {pick(s.allServicesAr, s.allServicesEn)}
            </Link>
          </div>

          <p className="mt-6 text-[11px] opacity-35">
            {pick(s.officialAr, s.officialEn)}{" "}
            <span dir="ltr">{canonical}</span>
          </p>
        </div>
      </section>
    </div>
  );
}
