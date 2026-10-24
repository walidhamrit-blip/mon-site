import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Clock, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import { getSiteDataCached } from "@/lib/store";
import { whatsappLink } from "@/lib/utils";
import {
  absoluteUrl,
  breadcrumbJsonLd,
  pageMetadata,
  webPageJsonLd,
} from "@/lib/seo";
import {
  findService,
  resolveServiceLanding,
  serviceFaqJsonLd,
  serviceJsonLd,
  servicePath,
} from "@/lib/services";
import { getSectorSeo, sectorIds } from "@/lib/sectors";
import { JsonLd } from "@/components/json-ld";
import { formatMainPrice } from "@/lib/installments";

export async function generateStaticParams() {
  const { config } = await getSiteDataCached();
  return config.standaloneServices.map((service) => ({ service: service.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ service: string }>;
}): Promise<Metadata> {
  const { service: serviceId } = await params;
  const { config } = await getSiteDataCached();
  const service = findService(config.standaloneServices, serviceId);
  if (!service) {
    return pageMetadata(config, {
      path: servicePath(serviceId),
      title: "خدمة غير موجودة",
      description: "هذه الخدمة غير متاحة حالياً.",
      noindex: true,
    });
  }
  const landing = resolveServiceLanding(service);
  return pageMetadata(config, {
    path: servicePath(service.id),
    title: landing.titleAr,
    description: landing.descriptionAr,
    image: false, // opengraph-image.tsx génère la carte 1200×630 de la page.
    keywords: [...landing.keywordsAr, ...landing.keywordsEn, service.titleAr, service.titleEn],
  });
}

export default async function ServicePage({
  params,
}: {
  params: Promise<{ service: string }>;
}) {
  const { service: serviceId } = await params;
  const { config, content } = await getSiteDataCached();
  const service = findService(config.standaloneServices, serviceId);
  if (!service) notFound();

  const landing = resolveServiceLanding(service);
  const others = config.standaloneServices.filter((candidate) => candidate.id !== service.id);
  const relatedSectors = (landing.relatedSectors ?? [])
    .map((id) => getSectorSeo(id))
    .filter((sector): sector is NonNullable<typeof sector> => Boolean(sector));
  const relatedDemos = content.demos
    .filter((demo) => (landing.relatedSectors ?? []).includes(demo.sector))
    .slice(0, 3);

  const whatsappUrl = whatsappLink(
    config.whatsapp,
    `مرحبا نخبة 👋 أريد طلب خدمة: ${service.titleAr} (تبدأ من ${service.priceFromUsd}$)`,
  );
  const canonical = absoluteUrl(config, servicePath(service.id));

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(config, [
            { name: "الرئيسية", path: "/" },
            { name: "الخدمات", path: "/services" },
            { name: service.titleAr, path: servicePath(service.id) },
          ]),
          webPageJsonLd(config, {
            path: servicePath(service.id),
            name: landing.titleAr,
            description: landing.answerAr,
            speakable: ["h1", "#service-answer"],
            about: `${service.titleEn} — Tripoli, Libya`,
          }),
          serviceJsonLd(config, service, landing),
          serviceFaqJsonLd(landing),
        ]}
      />

      <div className="pt-6">
        {/* Hero */}
        <section className="section-tight border-b border-[var(--border)] bg-[var(--secondary)]/35">
          <div className="site-container px-4 sm:px-6 lg:px-8">
            <nav aria-label="مسار التصفح" className="flex flex-wrap items-center gap-2 text-xs font-bold">
              <Link
                href="/services"
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)]"
              >
                <ArrowLeft className="h-3 w-3" />
                كل الخدمات
              </Link>
              <span className="rounded-full border border-[var(--accent)]/35 bg-[var(--accent)]/12 px-3 py-1 text-[var(--accent)]">
                {landing.deliveryAr}
              </span>
            </nav>

            <div className="mt-6 grid lg:grid-cols-[1.6fr_1fr] gap-8 items-start">
              <div>
                <h1 className="text-[32px] lg:text-[42px] font-black tracking-tight leading-tight max-w-[26ch]">
                  {landing.h1Ar}
                </h1>
                <p className="mt-1 text-sm opacity-50" dir="ltr">
                  {landing.h1En}
                </p>
                <p className="mt-4 text-lg opacity-70 max-w-[64ch] leading-relaxed">
                  {landing.subtitleAr}
                </p>
                <p className="mt-2 text-sm opacity-45 max-w-[64ch]" dir="ltr">
                  {landing.subtitleEn}
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-11 px-6 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] inline-flex items-center justify-center gap-2 text-sm font-bold"
                  >
                    <MessageCircle className="h-4 w-4" />
                    اطلب الخدمة على واتساب
                  </a>
                  <Link
                    href="/contact"
                    className="h-11 px-6 rounded-full border border-[var(--border)] bg-[var(--card)] inline-flex items-center justify-center text-sm font-bold hover:bg-[var(--secondary)]"
                  >
                    نموذج طلب عرض سعر
                  </Link>
                </div>
              </div>

              {/* Carte tarifaire */}
              <aside className="rounded-[22px] bg-[var(--card)] border border-[var(--border)] p-6 shadow-sm">
                <p className="text-xs font-bold tracking-[0.12em] text-[var(--accent)]">
                  السعر يبدأ من · STARTING AT
                </p>
                <p className="mt-2 text-4xl font-black" dir="ltr">
                  {formatMainPrice(service.priceFromUsd, "$")}
                </p>
                <p className="mt-1 text-sm opacity-50" dir="ltr">
                  USD · pay the same in USDT
                </p>
                <ul className="mt-4 space-y-2 text-xs opacity-70">
                  <li className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-[var(--accent)]" />
                    التسليم: {landing.deliveryAr}
                  </li>
                  <li className="flex items-center gap-2">
                    <ShieldCheck className="h-3.5 w-3.5 text-[var(--accent)]" />
                    سعر ثابت + مراجعتان مجانيتان
                  </li>
                  <li className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
                    دفع كامل أو 2–3 أقساط
                  </li>
                </ul>
                <Link
                  href="/pricing"
                  className="mt-5 inline-flex text-xs font-bold text-[var(--accent)] hover:underline"
                >
                  مقارنة الباقات الكاملة ←
                </Link>
              </aside>
            </div>

            {/* Réponse directe (GEO / speakable) */}
            <div
              id="service-answer"
              className="mt-8 rounded-2xl bg-[var(--card)] border border-[var(--border)] p-6 max-w-[78ch]"
            >
              <p className="text-sm leading-7 opacity-80">
                <strong className="text-[var(--accent)]">باختصار: </strong>
                {landing.answerAr}
              </p>
              <p className="mt-3 text-xs leading-6 opacity-50" dir="ltr">
                {landing.answerEn}
              </p>
            </div>
          </div>
        </section>

        {/* Prestations + cible */}
        <section className="section-tight">
          <div className="site-container px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-8">
              <div>
                <h2 className="text-2xl font-black">ما الذي تحصل عليه؟</h2>
                <p className="mt-1 text-sm opacity-55">What is included</p>
                <ul className="mt-5 space-y-2.5">
                  {landing.deliverablesAr.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm leading-6">
                      <Check className="h-4 w-4 mt-1 shrink-0 text-[var(--accent)]" />
                      <span className="opacity-80">{item}</span>
                    </li>
                  ))}
                </ul>
                <ul className="mt-4 space-y-1 text-xs opacity-45" dir="ltr">
                  {landing.deliverablesEn.map((item) => (
                    <li key={item}>· {item}</li>
                  ))}
                </ul>
              </div>

              <div className="space-y-5">
                <div className="rounded-2xl bg-[var(--secondary)]/40 border border-[var(--border)] p-6">
                  <h2 className="text-lg font-black">لمن هذه الخدمة؟</h2>
                  <p className="mt-2 text-sm leading-6 opacity-70">{landing.bestForAr}</p>
                  <p className="mt-1 text-xs leading-5 opacity-45" dir="ltr">
                    {landing.bestForEn}
                  </p>
                </div>

                <div className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-6">
                  <h2 className="text-lg font-black">الأسعار والدفع</h2>
                  <p className="mt-2 text-sm leading-6 opacity-70">
                    تبدأ الخدمة من <strong dir="ltr">{formatMainPrice(service.priceFromUsd, "$")}</strong>{" "}
                    (يُدفع نفس المبلغ بـ USDT). السعر النهائي يعتمد على
                    حجم العمل ويُثبَّت كتابياً قبل البدء. نعمل بدفعة مقدمة 50% والباقي
                    عند التسليم، مع إمكانية الدفع بالتحويل البنكي أو نقداً أو بالعملات
                    الرقمية عبر NOWPayments — كاملاً أو على دفعتين/ثلاث.
                  </p>
                </div>

                {relatedSectors.length > 0 && (
                  <div className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-6">
                    <h2 className="text-lg font-black">قطاعات نخدمها بهذه الخدمة</h2>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {relatedSectors.map((sector) => (
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
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-12 bg-[var(--secondary)]/25 border-y border-[var(--border)]">
          <div className="site-container px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-black">أسئلة شائعة — {service.titleAr}</h2>
            <p className="mt-1 text-sm opacity-55">FAQ — {service.titleEn}</p>
            <div className="mt-6 grid md:grid-cols-2 gap-4">
              {landing.faqs.map((faq) => (
                <div
                  key={faq.qAr}
                  className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-6"
                >
                  <h3 className="font-bold leading-6">{faq.qAr}</h3>
                  <p className="mt-1 text-xs opacity-45" dir="ltr">
                    {faq.qEn}
                  </p>
                  <p className="mt-3 text-sm leading-6 opacity-70">{faq.aAr}</p>
                  <p className="mt-1 text-xs leading-5 opacity-40" dir="ltr">
                    {faq.aEn}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Réalisations liées */}
        {relatedDemos.length > 0 && (
          <section className="section-tight">
            <div className="site-container px-4 sm:px-6 lg:px-8">
              <h2 className="text-2xl font-black">أعمال أنجزناها في هذه القطاعات</h2>
              <p className="mt-1 text-sm opacity-55">Live showcases</p>
              <div className="mt-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {relatedDemos.map((demo) => (
                  <Link
                    key={demo.slug}
                    href={`/demos/${demo.slug}`}
                    className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-5 hover:border-[var(--accent)]/50 transition-colors"
                  >
                    <span className="text-[11px] font-bold text-[var(--accent)]">
                      {demo.sectorAr}
                    </span>
                    <h3 className="mt-1 font-black">{demo.title}</h3>
                    <p className="mt-1 text-xs opacity-55 line-clamp-2">{demo.description}</p>
                    <span className="mt-3 inline-block text-xs font-bold text-[var(--accent)]">
                      عرض دراسة الحالة ←
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
            <h2 className="text-sm font-bold opacity-60">خدمات أخرى قد تحتاجها</h2>
            <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {others.map((other) => (
                <Link
                  key={other.id}
                  href={servicePath(other.id)}
                  className="flex items-center justify-between gap-3 rounded-xl bg-[var(--card)] border border-[var(--border)] px-4 py-3 text-sm font-medium hover:border-[var(--accent)]"
                >
                  <span>{other.titleAr}</span>
                  <span className="text-xs font-bold text-[var(--accent)]" dir="ltr">
                    {formatMainPrice(other.priceFromUsd, "$")}
                  </span>
                </Link>
              ))}
            </div>

            <div className="mt-10 rounded-[24px] bg-[var(--primary)] text-[var(--primary-foreground)] p-8 lg:p-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div>
                <h2 className="text-2xl font-black">جاهز لتبدأ؟</h2>
                <p className="mt-2 opacity-75 max-w-[52ch]">
                  أرسل رابط موقعك أو ملفك، ونرد خلال ساعتين في أوقات العمل بعرض سعر
                  ثابت ومدة تسليم واضحة. لا التزام قبل الموافقة.
                </p>
              </div>
              <div className="flex gap-3 shrink-0">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-11 px-6 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] inline-flex items-center justify-center font-bold"
                >
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

            <div className="mt-8 flex flex-wrap gap-2 text-xs">
              {sectorIds.slice(0, 6).map((id) => {
                const sector = getSectorSeo(id);
                if (!sector) return null;
                return (
                  <Link
                    key={id}
                    href={`/sectors/${id}`}
                    className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 transition-colors hover:border-[var(--accent)]"
                  >
                    {sector.labelAr}
                  </Link>
                );
              })}
              <Link
                href="/services"
                className="px-3 py-1 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] font-bold"
              >
                كل الخدمات
              </Link>
            </div>

            <p className="mt-6 text-[11px] opacity-35">
              الصفحة الرسمية:{" "}
              <span dir="ltr">{canonical}</span>
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
