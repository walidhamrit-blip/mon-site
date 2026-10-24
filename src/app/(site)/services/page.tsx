import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Check, Clock, Layers, Sparkles } from "lucide-react";
import { getSiteDataCached } from "@/lib/store";
import { breadcrumbJsonLd, faqJsonLd, pageMetadata, webPageJsonLd } from "@/lib/seo";
import {
  resolveServiceLanding,
  servicesCollectionJsonLd,
  servicesHubFaqs,
  servicePath,
  type ServiceLike,
} from "@/lib/services";
import { JsonLd } from "@/components/json-ld";
import { formatMainPrice } from "@/lib/installments";

/** Prix « à partir de » d'un service, lu dans la configuration vivante. */
function startingPrice(
  services: ReadonlyArray<ServiceLike>,
  id: string,
  fallback: number,
): number {
  return services.find((service) => service.id === id)?.priceFromUsd ?? fallback;
}

export async function generateMetadata(): Promise<Metadata> {
  const { config } = await getSiteDataCached();
  const services: ReadonlyArray<ServiceLike> = config.standaloneServices;
  const price = (id: string, fallback: number) =>
    formatMainPrice(startingPrice(services, id, fallback), "$");

  return pageMetadata(config, {
    path: "/services",
    title: "خدمات رقمية سريعة في طرابلس — هوية، عروض، صفحات هبوط",
    description:
      `خدمات نخبة الرقمية في طرابلس بأسعار معلنة: إعادة تصميم موقع من ${price("restyle", 49)}، ` +
      `إضافة قسم من ${price("add-section", 19)}، عرض تقديمي من ${price("slides", 29)}، ` +
      `هوية بصرية من ${price("branding", 39)}، صفحة هبوط من ${price("landing", 59)}، ` +
      `وإصلاح موقع من ${price("fix-optimize", 15)}.`,
    keywords: [
      "خدمات رقمية طرابلس",
      "إعادة تصميم موقع ليبيا",
      "تصميم هوية بصرية",
      "صفحة هبوط ليبيا",
      "إصلاح موقع طرابلس",
      "digital services Tripoli",
    ],
  });
}

export default async function ServicesPage() {
  const { config } = await getSiteDataCached();
  const services: ReadonlyArray<ServiceLike> = config.standaloneServices;
  const price = (id: string, fallback: number) =>
    formatMainPrice(startingPrice(services, id, fallback), "$");
  const lowestPrice = services.reduce(
    (min, service) => Math.min(min, service.priceFromUsd),
    Number.POSITIVE_INFINITY,
  );

  const webPage = webPageJsonLd(config, {
    path: "/services",
    name: "خدمات نخبة الرقمية السريعة — أسعار معلنة وتسليم سريع",
    description:
      `خدمات رقمية à la carte في طرابلس: إعادة تصميم موقع، إضافة قسم، عروض تقديمية، هوية بصرية، صفحة هبوط، وإصلاح وتحسين — بأسعار تبدأ من ${Number.isFinite(lowestPrice) ? lowestPrice : 15} دولاراً.`,
    speakable: ["h1", "#services-answer"],
    about: "خدمات تصميم وتطوير الويب في طرابلس، ليبيا",
  });

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(config, [
            { name: "الرئيسية", path: "/" },
            { name: "الخدمات", path: "/services" },
          ]),
          webPage,
          servicesCollectionJsonLd(config, services),
          faqJsonLd(servicesHubFaqs),
        ]}
      />

      <div className="pt-6">
        {/* Hero */}
        <section className="section-tight border-b border-[var(--border)] bg-[var(--secondary)]/35">
          <div className="site-container px-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
              <Link
                href="/"
                className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 transition-colors hover:border-[var(--accent)]"
              >
                ← الرئيسية
              </Link>
              <span className="rounded-full border border-[var(--accent)]/35 bg-[var(--accent)]/12 px-3 py-1 text-[var(--accent)]">
                خدمات مفتوحة · Open services
              </span>
            </div>

            <h1 className="mt-6 max-w-[26ch] text-[clamp(1.8rem,1.2rem+2.2vw,2.85rem)] font-black leading-[1.08] tracking-[-0.03em] text-balance">
              خدمات رقمية سريعة بأسعار معلنة — طرابلس، ليبيا
            </h1>
            <p className="mt-4 max-w-[66ch] text-[15.5px] leading-8 text-[var(--muted-foreground)]">
              لا تحتاج مشروعاً كاملاً لكل فكرة. اختر الخدمة التي تحتاجها اليوم: تجديد
              موقعك، إضافة قسم، عرض تقديمي، هوية بصرية، صفحة هبوط أو إصلاح تقني —
              بأسعار تبدأ من <strong>15 دولاراً</strong> وتسليم يبدأ من <strong>24 ساعة</strong>.
            </p>
            <p className="mt-2 max-w-[66ch] text-[13px] text-[var(--muted-foreground)]/75" dir="ltr">
              Fast, fixed-scope digital services in Tripoli, Libya — from $15 with
              delivery in as little as 24 hours.
            </p>

            <div
              id="services-answer"
              className="mt-7 max-w-[70ch] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow-xs)]"
            >
              <p className="text-sm leading-7 opacity-80">
                <strong>باختصار:</strong> نخبة تقدم {services.length} خدمات رقمية جاهزة
                للتنفيذ عن بُعد حول العالم — إعادة تصميم موقع ({price("restyle", 49)})،
                إضافة قسم جديد ({price("add-section", 19)})، عروض تقديمية (
                {price("slides", 29)})، هوية بصرية ({price("branding", 39)})،
                صفحة هبوط ({price("landing", 59)})، وإصلاح وتحسين (
                {price("fix-optimize", 15)}). كل الأسعار بالدولار فقط وتُدفع بنفس
                المبلغ بـ USDT، كاملة أو على دفعتين/ثلاث.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/contact"
                className="h-11 px-6 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] inline-flex items-center justify-center text-sm font-bold"
              >
                اطلب عرض سعر مجاني
              </Link>
              <Link
                href="/pricing"
                className="h-11 px-6 rounded-full border border-[var(--border)] bg-[var(--card)] inline-flex items-center justify-center text-sm font-bold hover:bg-[var(--secondary)]"
              >
                شاهد باقات المواقع الكاملة
              </Link>
            </div>

            <ul className="mt-8 grid sm:grid-cols-3 gap-4 text-sm">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-[var(--accent)]" />
                سعر ثابت مكتوب قبل البدء
              </li>
              <li className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[var(--accent)]" />
                تسليم 24 – 72 ساعة
              </li>
              <li className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-[var(--accent)]" />
                مراجعتان مجانيتان
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
                  كل الخدمات — {services.length} مهمة جاهزة للتنفيذ
                </h2>
                <p className="mt-1 text-sm opacity-60">
                  أسعار بالدولار فقط — 1 دولار = 1 USDT · USD pricing only — 1 USD = 1 USDT
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
                          <Link href={servicePath(service.id)} className="hover:text-[var(--accent)] transition-colors">
                            {service.titleAr}
                          </Link>
                        </h3>
                      </div>
                      {(service.badgeAr || service.badgeEn) && (
                        <span className="shrink-0 px-2 py-1 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] text-[10px] font-black">
                          {service.badgeAr ?? service.badgeEn}
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-xs opacity-50" dir="ltr">
                      {service.titleEn}
                    </p>
                    <p className="mt-4 text-sm leading-6 opacity-70">{service.descAr}</p>
                    <p className="mt-1 text-xs leading-5 opacity-45" dir="ltr">
                      {service.descEn}
                    </p>

                    <ul className="mt-4 space-y-1.5 text-xs opacity-70">
                      {service.featuresAr.map((feature) => (
                        <li key={feature} className="flex items-start gap-2">
                          <Check className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[var(--accent)]" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-auto pt-5">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm opacity-50">تبدأ من</span>
                        <span className="text-2xl font-black" dir="ltr">
                          {formatMainPrice(service.priceFromUsd, "$")}
                        </span>
                        <span className="text-xs opacity-50" dir="ltr">
                          USD · = USDT
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] opacity-50">
                        التسليم: {landing.deliveryAr}
                      </p>
                      <Link
                        href={servicePath(service.id)}
                        className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--accent)] hover:underline"
                      >
                        تفاصيل الخدمة
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
            <h2 className="text-2xl lg:text-3xl font-black">كيف تعمل الخدمة السريعة؟</h2>
            <p className="mt-1 text-sm opacity-60">ثلاث خطوات، بدون اجتماعات طويلة.</p>
            <ol className="mt-6 grid md:grid-cols-3 gap-5">
              {[
                {
                  num: "01",
                  title: "أرسل التفاصيل",
                  desc: "رابط موقعك أو ملف العرض + ما تريد الوصول إليه. الرد خلال ساعتين في أوقات العمل.",
                },
                {
                  num: "02",
                  title: "عرض سعر ثابت",
                  desc: "نحدد النطاق والمدة والسعر كتابياً. نبدأ بعد دفعة مقدمة 50% — الباقي عند التسليم.",
                },
                {
                  num: "03",
                  title: "تسليم ومراجعة",
                  desc: "نسلّم الملفات أو النشر، ثم مراجعتان مجانيتان حتى الرضا الكامل — ودعم 14 يوماً بعدها.",
                },
              ].map((step) => (
                <li
                  key={step.num}
                  className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-6"
                >
                  <span className="text-3xl font-black text-[var(--accent)]/50">{step.num}</span>
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
            <h2 className="text-2xl font-black">أسئلة شائعة عن الخدمات المفتوحة</h2>
            <p className="mt-1 text-sm opacity-60">Open services — FAQ</p>
            <div className="mt-6 grid md:grid-cols-2 gap-4">
              {servicesHubFaqs.map((faq) => (
                <div
                  key={faq.qAr}
                  className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-6"
                >
                  <h3 className="font-bold">{faq.qAr}</h3>
                  <p className="mt-1 text-xs opacity-50" dir="ltr">
                    {faq.qEn}
                  </p>
                  <p className="mt-3 text-sm leading-6 opacity-70">{faq.aAr}</p>
                  <p className="mt-1 text-xs leading-5 opacity-45" dir="ltr">
                    {faq.aEn}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Maillage interne */}
        <section className="py-10 border-t border-[var(--border)]">
          <div className="site-container px-4 sm:px-6 lg:px-8">
            <h2 className="text-sm font-bold opacity-60">استكشف أيضاً</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/sectors" className="px-4 py-2 rounded-full bg-[var(--card)] border border-[var(--border)] text-sm font-medium hover:border-[var(--accent)]">
                مواقع حسب القطاع
              </Link>
              <Link href="/demos" className="px-4 py-2 rounded-full bg-[var(--card)] border border-[var(--border)] text-sm font-medium hover:border-[var(--accent)]">
                معارض الأعمال الحية
              </Link>
              <Link href="/pricing" className="px-4 py-2 rounded-full bg-[var(--card)] border border-[var(--border)] text-sm font-medium hover:border-[var(--accent)]">
                باقات المواقع الكاملة
              </Link>
              <Link href="/apps" className="px-4 py-2 rounded-full bg-[var(--card)] border border-[var(--border)] text-sm font-medium hover:border-[var(--accent)]">
                تطبيقات قريباً
              </Link>
              <Link href="/contact" className="px-4 py-2 rounded-full bg-[var(--card)] border border-[var(--border)] text-sm font-medium hover:border-[var(--accent)]">
                تواصل معنا
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
