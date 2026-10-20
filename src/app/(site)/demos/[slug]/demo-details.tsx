import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
import type { Demo } from "@/lib/site-types";
import type { siteConfig } from "@/lib/config";
import { getSectorSeo } from "@/lib/sectors";
import {
  formatLyd,
  lydLabel,
  resolveDemoClassification,
} from "@/lib/classification";
import { formatMainPrice } from "@/lib/installments";
import { whatsappLink } from "@/lib/utils";

/**
 * Section éditoriale serveur sous la visionneuse d'une fiche démo.
 *
 * La fiche est dominée par l'expérience plein écran (iframe du site
 * client) : le HTML initial ne contenait que le chrome + l'article
 * `sr-only` d'accessibilité. Cette section ajoute du contenu VISIBLE et
 * indexable, complémentaire (pas de duplication de l'article sr-only) :
 * présentation du projet, contexte sectoriel, détail de la formule
 * tarifaire correspondante, faits clés et CTA. Tout est dérivé des
 * données vivantes (démo, secteur, tarifs) — aucun texte inventé.
 */
export function DemoDetails({
  demo,
  config,
}: {
  demo: Demo;
  config: typeof siteConfig;
}) {
  const sector = getSectorSeo(demo.sector);
  const classification = resolveDemoClassification(demo, config.pricing.plans);
  const plan = classification
    ? config.pricing.plans.find((p) => p.id === classification.planId)
    : undefined;
  const hasLiveUrl =
    Boolean(demo.previewUrl) &&
    demo.previewUrl !== "#" &&
    /^https?:\/\//i.test(demo.previewUrl);

  const whatsappUrl = whatsappLink(
    config.whatsapp,
    `مرحبا نخبة 👋 أريد موقعاً مثل «${demo.title}» (${demo.sectorAr}).`,
  );

  return (
    <section
      aria-label={`تفاصيل مشروع ${demo.title}`}
      className="py-12 lg:py-16 border-t border-[var(--border)] bg-[var(--secondary)]/20"
    >
      <div className="site-container px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-2 space-y-10">
            {/* Présentation du projet */}
            <div>
              <h2 className="text-2xl font-black">عن هذا المشروع — {demo.title}</h2>
              <p className="mt-1 text-sm opacity-60" lang="en">
                About this project — {demo.titleEn}
              </p>
              <p className="mt-4 leading-8 opacity-80 max-w-[70ch]">
                {demo.description}
              </p>
              <p className="mt-3 leading-7 opacity-60 text-sm max-w-[70ch]" lang="en">
                {demo.descriptionEn}
              </p>
            </div>

            {/* Contexte sectoriel */}
            {sector && (
              <div>
                <h3 className="text-xl font-black">
                  لماذا تحتاج شركات {sector.labelAr} إلى موقع احترافي؟
                </h3>
                <p className="mt-3 leading-8 opacity-80 max-w-[70ch]">
                  {sector.descriptionAr}
                </p>
                <p className="mt-2 leading-7 opacity-60 text-sm max-w-[70ch]" lang="en">
                  {sector.descriptionEn}
                </p>
                <Link
                  href={`/sectors/${sector.id}`}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--accent)] hover:underline"
                >
                  كل مواقع {sector.labelAr} في طرابلس
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            )}

            {/* Détail de la formule tarifaire du projet */}
            {plan && (
              <div>
                <h3 className="text-xl font-black">
                  ماذا تشمل باقة «{plan.name}»؟
                </h3>
                <p className="mt-2 opacity-70 leading-7 text-sm max-w-[70ch]">
                  {plan.description} — {plan.descriptionEn}.{" "}
                  هذا المشروع من الفئة {classification?.tier}، وتشمل الباقة:
                </p>
                <ul className="mt-4 grid sm:grid-cols-2 gap-x-6 gap-y-2.5">
                  {plan.features.map((feature, idx) => (
                    <li key={feature} className="flex gap-2 text-sm">
                      <span className="h-5 w-5 rounded-full bg-green-500 text-white grid place-items-center flex-shrink-0 mt-0.5">
                        <Check className="h-3 w-3" />
                      </span>
                      <span>
                        {feature}
                        {plan.featuresEn[idx] ? (
                          <span className="opacity-50"> — {plan.featuresEn[idx]}</span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/pricing"
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--accent)] hover:underline"
                >
                  قارن كل الباقات والأسعار
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            )}
          </div>

          {/* Faits clés + CTA */}
          <aside className="rounded-[24px] bg-[var(--card)] border border-[var(--border)] p-6">
            <h3 className="text-sm font-black uppercase tracking-wider opacity-60">
              حقائق سريعة — Quick facts
            </h3>
            <dl className="mt-4 space-y-3.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="opacity-60">القطاع</dt>
                <dd className="font-bold text-end">
                  {sector ? (
                    <Link
                      href={`/sectors/${sector.id}`}
                      className="text-[var(--accent)] hover:underline"
                    >
                      {demo.sectorAr}
                    </Link>
                  ) : (
                    demo.sectorAr
                  )}
                </dd>
              </div>
              {classification && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="opacity-60">الفئة</dt>
                  <dd className="font-bold text-end">
                    {classification.tier} · {classification.name}
                  </dd>
                </div>
              )}
              {classification?.priceUsd != null && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="opacity-60">السعر</dt>
                  <dd className="font-bold text-end" dir="ltr">
                    {formatMainPrice(
                      classification.priceUsd,
                      config.pricing.currency,
                    )}{" "}
                    <span className="opacity-60 font-medium">
                      ≈ {formatLyd(classification.priceLyd)} {lydLabel("ar")}
                    </span>
                  </dd>
                </div>
              )}
              {hasLiveUrl && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="opacity-60">الموقع الحي</dt>
                  <dd className="font-bold text-end">
                    <a
                      href={demo.previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--accent)] hover:underline inline-flex items-center gap-1"
                    >
                      زيارة الموقع
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </a>
                  </dd>
                </div>
              )}
            </dl>

            <div className="mt-6 space-y-2.5">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="h-11 w-full rounded-full bg-[#25D366] text-white grid place-items-center font-bold text-sm"
              >
                اطلب موقعاً مشابهاً عبر واتساب
              </a>
              <Link
                href="/contact"
                className="h-11 w-full rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] grid place-items-center font-bold text-sm hover:opacity-90"
              >
                عرض سعر مجاني
              </Link>
            </div>
            <p className="mt-3 text-[11px] opacity-50 leading-relaxed">
              تسليم في 7–14 يوماً، تحسين SEO وظهور في محركات الذكاء الاصطناعي،
              ودعم عبر واتساب — من طرابلس، ليبيا.
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}
