import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { getSiteDataCached } from "@/lib/store";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { getSectorSeo, getDemosForSector, sectorCollectionJsonLd, sectorFaqJsonLd, sectorIds } from "@/lib/sectors";
import { demoImageAlt, formatLyd, lydLabel, resolveDemoClassification } from "@/lib/classification";
import { formatMainPrice } from "@/lib/installments";

export async function generateStaticParams() {
  return sectorIds.map((sector) => ({ sector }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sector: string }>;
}): Promise<Metadata> {
  const { sector: sectorId } = await params;
  const sector = getSectorSeo(sectorId);
  if (!sector) return {};
  const { config } = await getSiteDataCached();
  return pageMetadata(config, {
    path: `/sectors/${sector.id}`,
    title: sector.titleAr,
    description: sector.descriptionAr,
    // opengraph-image.tsx génère une carte 1200×630 propre au secteur.
    image: false,
    keywords: [...sector.keywordsAr, ...sector.keywordsEn, sector.labelAr, sector.labelEn],
  });
}

export default async function SectorPage({ params }: { params: Promise<{ sector: string }> }) {
  const { sector: sectorId } = await params;
  const sector = getSectorSeo(sectorId);
  if (!sector) notFound();

  const { config, content } = await getSiteDataCached();
  const demosInSector = getDemosForSector(content.demos, sectorId);

  // Fonctionnalités réellement livrées dans ce secteur (agrégées depuis
  // les fiches réalisations, dédupliquées) + prix d'entrée constaté :
  // contenu factuel propre à chaque secteur, sans texte générique.
  const sectorFeaturesAr = [...new Set(demosInSector.flatMap((d) => d.features))].slice(0, 10);
  const sectorFeaturesEn = [...new Set(demosInSector.flatMap((d) => d.featuresEn))].slice(0, 10);
  const sectorPricesUsd = demosInSector
    .map((d) => resolveDemoClassification(d, config.pricing.plans)?.priceUsd)
    .filter((p): p is number => typeof p === "number" && p > 0);
  const sectorPriceFromUsd =
    sectorPricesUsd.length > 0 ? Math.min(...sectorPricesUsd) : null;

  const collectionLd = sectorCollectionJsonLd(config, sector, demosInSector);
  const faqLd = sectorFaqJsonLd(sector);

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(config, [
            { name: "الرئيسية", path: "/" },
            { name: "القطاعات", path: "/sectors" },
            { name: sector.labelAr, path: `/sectors/${sector.id}` },
          ]),
          collectionLd,
          faqLd,
        ]}
      />

      <div className="pt-[96px]">
        {/* Hero sectoriel */}
        <section className="py-12 bg-[var(--secondary)]/30 border-b border-[var(--border)]">
          <div className="site-container px-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
              <Link href="/sectors" className="px-3 py-1 rounded-full bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)]">
                ← كل القطاعات
              </Link>
              <span className="px-3 py-1 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)]">
                {sector.labelAr} · {sector.labelEn}
              </span>
            </div>

            <h1 className="mt-6 text-[32px] lg:text-[44px] font-black tracking-tight leading-tight">
              {sector.h1Ar}
            </h1>
            <p className="mt-3 text-lg opacity-70 max-w-[64ch] leading-relaxed">{sector.heroSubtitleAr}</p>
            <p className="mt-2 text-sm opacity-50 max-w-[64ch]">{sector.heroSubtitleEn}</p>

            <div className="mt-6 flex flex-wrap gap-2">
              <a
                href="#demos"
                className="h-11 px-6 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] inline-flex items-center justify-center text-sm font-bold"
              >
                استعرض {demosInSector.length} موقع في هذا القطاع
              </a>
              <Link
                href="/contact"
                className="h-11 px-6 rounded-full border border-[var(--border)] bg-[var(--card)] inline-flex items-center justify-center text-sm font-bold hover:bg-[var(--secondary)]"
              >
                اطلب عرض سعر مجاني
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap gap-2 text-xs">
              {sector.keywordsAr.map((kw) => (
                <span key={kw} className="px-3 py-1 rounded-full bg-[var(--card)] border border-[var(--border)] opacity-70">
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
                مواقع {sector.labelAr} — {demosInSector.length} مشروع حي
              </h2>
              <span className="text-sm opacity-60">{sector.labelEn} showcases</span>
            </div>

            {demosInSector.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--card)] p-12 text-center">
                <p className="font-bold">لا توجد مشاريع في هذا القطاع بعد — كن أول عميل!</p>
                <p className="mt-1 text-sm opacity-60">
                  No projects yet in {sector.labelEn} — be the first showcase.
                </p>
                <Link
                  href="/contact"
                  className="mt-4 inline-flex h-10 px-6 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] items-center justify-center text-sm font-bold"
                >
                  ابدأ مشروعك الآن
                </Link>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {demosInSector.map((d) => {
                  const cls = resolveDemoClassification(d, config.pricing.plans);
                  return (
                    <Link
                      key={d.slug}
                      href={`/demos/${d.slug}`}
                      className="group rounded-[22px] overflow-hidden bg-[var(--card)] border border-[var(--border)] hover:shadow-xl hover:border-[var(--accent)]/40 transition-all flex flex-col"
                    >
                      <div className="relative aspect-[16/11] overflow-hidden">
                        <Image
                          src={d.image}
                          alt={d.imageAltAr || d.title}
                          fill
                          sizes="(max-width: 640px) 100vw, 33vw"
                          className="object-cover group-hover:scale-[1.04] transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                        <div className="absolute top-3 start-3">
                          <span className="px-2.5 py-1 rounded-full bg-white text-black text-xs font-bold">
                            {d.sectorAr}
                          </span>
                        </div>
                        {d.previewUrl && d.previewUrl !== "#" && (
                          <div className="absolute top-3 end-3">
                            <span className="px-2.5 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-black">
                              LIVE
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="p-5 flex-1 flex flex-col">
                        <h3 className="font-black text-[16px] group-hover:text-[var(--accent)] transition-colors">
                          {d.title}
                        </h3>
                        <p className="text-sm opacity-60 mt-1 line-clamp-2">{d.description}</p>
                        {cls && (
                          <div className="mt-3 text-xs opacity-60 flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-full bg-[var(--secondary)] border border-[var(--border)] font-bold">
                              فئة {cls.tier} · {cls.nameEn}
                            </span>
                            <span dir="ltr" className="font-bold">
                              ${cls.priceUsd ?? "—"} / {formatLyd(cls.priceLyd)} {lydLabel("ar")}
                            </span>
                          </div>
                        )}
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {d.features.slice(0, 3).map((f) => (
                            <span
                              key={f}
                              className="px-2.5 py-1 rounded-full bg-[var(--secondary)] border border-[var(--border)] text-xs"
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="px-5 pb-5">
                        <span className="text-sm font-bold text-[var(--accent)] group-hover:underline">عرض التفاصيل ←</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* CTA sectoriel */}
            <div className="mt-12 rounded-[24px] bg-[var(--primary)] text-[var(--primary-foreground)] p-8 lg:p-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div>
                <h3 className="text-2xl font-black">جاهز لموقع {sector.labelAr} احترافي؟</h3>
                <p className="mt-2 opacity-70 max-w-[50ch]">
                  نطلق موقعك في 7-14 يوم مع حجز/بيع أونلاين، SEO محلي، ومتابعة واتساب — احجز استشارتك المجانية اليوم.
                </p>
              </div>
              <div className="flex gap-3 shrink-0">
                <Link
                  href="/contact"
                  className="h-11 px-6 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] inline-flex items-center justify-center font-bold"
                >
                  اطلب عرض سعر
                </Link>
                <Link
                  href="/pricing"
                  className="h-11 px-6 rounded-full bg-white/10 border border-white/20 inline-flex items-center justify-center font-bold hover:bg-white/15"
                >
                  شاهد الباقات
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Ce qu'inclut un site du secteur — fonctionnalités agrégées */}
        {sectorFeaturesAr.length > 0 && (
          <section className="py-10 border-t border-[var(--border)]">
            <div className="site-container px-4 sm:px-6 lg:px-8">
              <h2 className="text-2xl font-black">
                ماذا يشمل موقع {sector.labelAr} من نخبة؟
              </h2>
              <p className="mt-1 text-sm opacity-60">
                What a Nukhba {sector.labelEn} website includes
              </p>
              <p className="mt-4 leading-8 opacity-80 max-w-[70ch]">
                {sector.descriptionAr}
              </p>
              <p className="mt-2 leading-7 opacity-60 text-sm max-w-[70ch]" lang="en">
                {sector.descriptionEn}
              </p>
              <div className="mt-6 grid md:grid-cols-2 gap-x-8 gap-y-2.5">
                {sectorFeaturesAr.map((feature, idx) => (
                  <div key={feature} className="flex gap-2 text-sm">
                    <span className="h-5 w-5 rounded-full bg-green-500 text-white grid place-items-center flex-shrink-0 mt-0.5">
                      <Check className="h-3 w-3" />
                    </span>
                    <span>
                      {feature}
                      {sectorFeaturesEn[idx] ? (
                        <span className="opacity-50"> — {sectorFeaturesEn[idx]}</span>
                      ) : null}
                    </span>
                  </div>
                ))}
              </div>
              {sectorPriceFromUsd != null && (
                <p className="mt-6 text-sm opacity-70">
                  مواقع {sector.labelAr} لدينا تبدأ من{" "}
                  <strong dir="ltr" className="text-[var(--accent)]">
                    ${sectorPriceFromUsd}
                  </strong>{" "}
                  حسب الحجم والميزات —{" "}
                  <Link
                    href="/pricing"
                    className="font-bold text-[var(--accent)] hover:underline"
                  >
                    قارن الباقات والأسعار
                  </Link>
                </p>
              )}
            </div>
          </section>
        )}

        {/* FAQ sectorielle */}
        <section className="py-10 bg-[var(--secondary)]/20 border-t border-[var(--border)]">
          <div className="site-container px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-black">أسئلة شائعة — {sector.labelAr}</h2>
            <p className="mt-1 text-sm opacity-60">FAQ — {sector.labelEn}</p>
            <div className="mt-6 grid md:grid-cols-2 gap-4">
              {sector.faqsAr.map((faq, i) => (
                <div
                  key={i}
                  className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-6"
                >
                  <h3 className="font-bold">{faq.qAr}</h3>
                  <p className="mt-1 text-xs opacity-50">{faq.qEn}</p>
                  <p className="mt-3 text-sm opacity-70 leading-6">{faq.aAr}</p>
                  <p className="mt-1 text-sm opacity-50 leading-6">{faq.aEn}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Maillage interne : autres secteurs */}
        <section className="py-8 border-t border-[var(--border)]">
          <div className="site-container px-4 sm:px-6 lg:px-8">
            <h3 className="text-sm font-bold opacity-60">استكشف قطاعات أخرى</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {sectorIds
                .filter((id) => id !== sector.id)
                .slice(0, 8)
                .map((id) => {
                  const s = getSectorSeo(id);
                  if (!s) return null;
                  return (
                    <Link
                      key={id}
                      href={`/sectors/${id}`}
                      className="px-4 py-2 rounded-full bg-[var(--card)] border border-[var(--border)] text-sm font-medium hover:border-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors"
                    >
                      {s.labelAr}
                    </Link>
                  );
                })}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
