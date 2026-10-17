"use client";

import { useState } from "react";
import Link from "next/link";
import type { Demo } from "@/lib/site-types";
import { useI18n } from "@/lib/i18n";
import { useSiteConfig } from "@/components/site-provider";
import {
  ArrowUpRight,
  Check,
  Smartphone,
  Tablet,
  Monitor,
  Sparkles,
  ExternalLink,
  Maximize2,
  Minimize2,
  RotateCw,
  Globe,
  Eye,
  Image as ImageIcon,
} from "lucide-react";

function isRealUrl(url?: string): boolean {
  return Boolean(url && url !== "#" && /^https?:\/\//i.test(url.trim()));
}

export function DemoViewer({ demo, allDemos }: { demo: Demo; allDemos: Demo[] }) {
  const { locale } = useI18n();
  const config = useSiteConfig();
  const hasLiveUrl = isRealUrl(demo.previewUrl);

  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [viewMode, setViewMode] = useState<"live" | "cover">(hasLiveUrl ? "live" : "cover");
  const [iframeLoading, setIframeLoading] = useState(true);
  const [iframeKey, setIframeKey] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  const title = locale === "ar" ? demo.title : demo.titleEn;
  const sectorLabel = locale === "ar" ? demo.sectorAr : demo.sectorEn;
  const description = locale === "ar" ? demo.description : demo.descriptionEn;
  const features = locale === "ar" ? demo.features : demo.featuresEn;
  const whatsappNumber = (config.whatsapp || "218912345678").replace(/\D/g, "");

  const otherDemos = allDemos.filter((d) => d.slug !== demo.slug).slice(0, 3);

  const reloadIframe = () => {
    setIframeLoading(true);
    setIframeKey((k) => k + 1);
  };

  return (
    <div className="pt-[96px]">
      <section className="py-8">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link
              href="/demos"
              className="inline-flex items-center gap-1.5 text-sm font-medium opacity-70 hover:opacity-100"
            >
              {locale === "ar" ? "← الرجوع لكل المعارض" : "← Back to all demos"}
            </Link>

            {hasLiveUrl && (
              <a
                href={demo.previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="h-10 px-5 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] text-xs sm:text-sm font-black inline-flex items-center gap-2 hover:bg-[var(--accent-hover)] transition-colors shadow-md"
              >
                <span className="h-2 w-2 rounded-full bg-emerald-700 animate-pulse" />
                {locale === "ar"
                  ? "زيارة الموقع الحقيقي في نافذة كاملة"
                  : "Visit Full Live Website in New Tab"}
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>

          <div className="mt-5 grid lg:grid-cols-[1.35fr_0.65fr] gap-8 items-start">
            {/* Interactive Live Browser Stage */}
            <div className="rounded-[24px] overflow-hidden bg-zinc-950 border border-white/10 p-3 sm:p-4 shadow-2xl">
              {/* Browser Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3 text-white">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="h-3 w-3 rounded-full bg-red-400 flex-shrink-0" />
                  <span className="h-3 w-3 rounded-full bg-yellow-400 flex-shrink-0" />
                  <span className="h-3 w-3 rounded-full bg-green-400 flex-shrink-0" />

                  <div className="ms-2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-xs min-w-0 flex-1 max-w-md">
                    {hasLiveUrl ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-400 font-bold flex-shrink-0">
                        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                        {locale === "ar" ? "حيّ ومباشر" : "LIVE"}
                      </span>
                    ) : (
                      <Globe className="h-3.5 w-3.5 text-zinc-400 flex-shrink-0" />
                    )}
                    <span className="text-zinc-300 truncate" dir="ltr">
                      {hasLiveUrl ? demo.previewUrl : `https://nukhba.ly/demos/${demo.slug}`}
                    </span>
                  </div>
                </div>

                {/* Viewport & Mode Controls */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {hasLiveUrl && (
                    <div className="inline-flex items-center rounded-full bg-white/10 p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setViewMode("live")}
                        className={`px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1 cursor-pointer ${
                          viewMode === "live" ? "bg-[var(--accent)] text-black" : "text-zinc-300"
                        }`}
                      >
                        <Eye className="h-3 w-3" />
                        {locale === "ar" ? "تصفح مباشر" : "Live"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode("cover")}
                        className={`px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1 cursor-pointer ${
                          viewMode === "cover" ? "bg-[var(--accent)] text-black" : "text-zinc-300"
                        }`}
                      >
                        <ImageIcon className="h-3 w-3" />
                        {locale === "ar" ? "صورة" : "Cover"}
                      </button>
                    </div>
                  )}

                  <div className="inline-flex items-center rounded-full bg-white/10 p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setDevice("desktop")}
                      title={locale === "ar" ? "عرض الحاسوب" : "Desktop view"}
                      className={`h-7 px-2.5 rounded-full inline-flex items-center gap-1 cursor-pointer ${
                        device === "desktop" ? "bg-white text-black font-bold" : "text-zinc-300"
                      }`}
                    >
                      <Monitor className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDevice("tablet")}
                      title={locale === "ar" ? "عرض الجهاز اللوحي" : "Tablet view"}
                      className={`h-7 px-2.5 rounded-full inline-flex items-center gap-1 cursor-pointer ${
                        device === "tablet" ? "bg-white text-black font-bold" : "text-zinc-300"
                      }`}
                    >
                      <Tablet className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDevice("mobile")}
                      title={locale === "ar" ? "عرض الهاتف" : "Mobile view"}
                      className={`h-7 px-2.5 rounded-full inline-flex items-center gap-1 cursor-pointer ${
                        device === "mobile" ? "bg-white text-black font-bold" : "text-zinc-300"
                      }`}
                    >
                      <Smartphone className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {hasLiveUrl && viewMode === "live" && (
                    <>
                      <button
                        type="button"
                        onClick={reloadIframe}
                        title={locale === "ar" ? "إعادة التحميل" : "Reload"}
                        className="h-7 w-7 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center cursor-pointer"
                      >
                        <RotateCw className={`h-3.5 w-3.5 ${iframeLoading ? "animate-spin" : ""}`} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setFullscreen(true)}
                        title={locale === "ar" ? "ملء الشاشة" : "Fullscreen"}
                        className="h-7 px-2.5 rounded-full bg-white/10 hover:bg-white/20 inline-flex items-center gap-1 text-xs font-bold cursor-pointer"
                      >
                        <Maximize2 className="h-3 w-3" />
                        <span className="hidden sm:inline">
                          {locale === "ar" ? "ملء الشاشة" : "Fullscreen"}
                        </span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Viewport Stage */}
              <div
                className={`mx-auto transition-all duration-300 ${
                  device === "mobile"
                    ? "max-w-[380px]"
                    : device === "tablet"
                      ? "max-w-[680px]"
                      : "max-w-full"
                }`}
              >
                <div
                  className={`rounded-[16px] overflow-hidden bg-white relative ${
                    device === "mobile"
                      ? "aspect-[9/16] max-h-[680px]"
                      : "h-[540px] sm:h-[640px]"
                  }`}
                >
                  {hasLiveUrl && viewMode === "live" ? (
                    <>
                      {iframeLoading && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-zinc-950/90 text-white p-6 text-center">
                          <img
                            src={demo.image}
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover opacity-25 blur-sm"
                          />
                          <div className="relative z-10 flex flex-col items-center">
                            <div className="h-11 w-11 rounded-full border-3 border-[var(--accent)] border-t-transparent animate-spin mb-3" />
                            <div className="text-base font-bold">
                              {locale === "ar"
                                ? `جارٍ تحميل الموقع الحقيقي: ${title}...`
                                : `Loading live website: ${title}...`}
                            </div>
                            <div className="text-xs opacity-70 mt-1" dir="ltr">
                              {demo.previewUrl}
                            </div>
                          </div>
                        </div>
                      )}
                      <iframe
                        key={`${demo.slug}-${iframeKey}`}
                        src={demo.previewUrl}
                        title={title}
                        className="w-full h-full border-0 bg-white"
                        loading="eager"
                        onLoad={() => setIframeLoading(false)}
                        allow="clipboard-write; fullscreen"
                      />
                    </>
                  ) : (
                    <>
                      <img src={demo.image} alt={title} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                      <div className="absolute bottom-0 p-6 text-white">
                        <span className="px-3 py-1 rounded-full bg-[var(--accent)] text-black text-xs font-bold">
                          {sectorLabel}
                        </span>
                        <h1 className="mt-2 text-2xl sm:text-3xl font-black">{title}</h1>
                        <p className="opacity-85 mt-1">{description}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 mt-3 text-white/75 text-xs px-1">
                <div className="flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-[var(--accent)]" />
                  <span>
                    {hasLiveUrl
                      ? locale === "ar"
                        ? "أنت تتصفح الموقع الحقيقي مباشرةً — يمكنك التمرير والنقر وتجربة كل الأقسام"
                        : "You are browsing the real live website — scroll, click, and test every feature"
                      : locale === "ar"
                        ? "متجاوب 100% — موبايل وحاسوب"
                        : "100% Responsive — Mobile & Desktop"}
                  </span>
                </div>
                {hasLiveUrl && (
                  <a
                    href={demo.previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--accent)] font-bold hover:underline inline-flex items-center gap-1"
                  >
                    {locale === "ar" ? "فتح الرابط المباشر" : "Open direct link"}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>

            {/* Project Details Sidebar */}
            <div className="space-y-6">
              <div className="rounded-[24px] bg-[var(--card)] border border-[var(--border)] p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--accent)] text-black text-xs font-bold">
                    <Sparkles className="h-3.5 w-3.5" />
                    {hasLiveUrl
                      ? locale === "ar"
                        ? "عمل حقيقي مُنجز"
                        : "Real Delivered Work"
                      : locale === "ar"
                        ? "معرض حي — قابل للتخصيص"
                        : "Live Demo — Customizable"}
                  </div>
                  <span className="px-3 py-1 rounded-full bg-[var(--secondary)] border border-[var(--border)] text-xs font-semibold">
                    {sectorLabel}
                  </span>
                </div>

                <h1 className="mt-3 text-2xl font-black">{title}</h1>
                <p className="mt-2 opacity-75 leading-7 text-sm">
                  {description}
                  {" — "}
                  {locale === "ar"
                    ? "نصممه ونبرمجه خصيصاً على هوية نشاطك التجاري مع لوحة تحكم سهلة."
                    : "Custom-designed and engineered for your brand with an easy management panel."}
                </p>

                <ul className="mt-4 space-y-2.5">
                  {features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm font-medium">
                      <span className="h-5 w-5 rounded-full bg-emerald-500 text-white grid place-items-center flex-shrink-0">
                        <Check className="h-3 w-3" />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>

                {hasLiveUrl && (
                  <a
                    href={demo.previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-6 w-full h-12 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] flex items-center justify-center gap-2 font-black text-sm hover:bg-[var(--accent-hover)] transition-colors shadow-md"
                  >
                    {locale === "ar" ? "زيارة الموقع الحقيقي الكامل" : "Visit Full Live Website"}
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Link
                    href="/contact"
                    className="h-11 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] grid place-items-center font-bold text-sm hover:opacity-90"
                  >
                    {locale === "ar" ? "اطلب مثل هذا" : "Request Similar"}
                  </Link>
                  <a
                    href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
                      locale === "ar"
                        ? `السلام عليكم، أعجبني موقع "${demo.title}" وأريد موقعاً احترافياً مماثلاً لنشاطي`
                        : `Hi, I liked the "${demo.titleEn}" website and would like a similar site for my business`,
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-11 rounded-full bg-[#25D366] text-white grid place-items-center font-bold text-sm hover:opacity-95"
                  >
                    {locale === "ar" ? "تحدث عبر واتساب" : "WhatsApp Us"}
                  </a>
                </div>
              </div>

              <div className="rounded-[24px] bg-[var(--secondary)] border border-[var(--border)] p-6">
                <h3 className="font-bold">
                  {locale === "ar" ? "ماذا يشمل موقعك معنا؟" : "What's included?"}
                </h3>
                <ul className="mt-3 grid grid-cols-1 gap-2 text-sm opacity-75">
                  <li>
                    {locale === "ar"
                      ? "✓ تصميم حصري 100% على هوية علامتك"
                      : "✓ 100% bespoke design tailored to your brand"}
                  </li>
                  <li>
                    {locale === "ar"
                      ? "✓ سرعة فائقة على الموبايل والحاسوب (Lighthouse 90+)"
                      : "✓ Blazing fast on mobile & desktop (Lighthouse 90+)"}
                  </li>
                  <li>
                    {locale === "ar"
                      ? "✓ تهيئة لمحركات البحث (SEO) + ربط واتساب وخرائط"
                      : "✓ Google SEO structure + WhatsApp & Maps integration"}
                  </li>
                  <li>
                    {locale === "ar"
                      ? "✓ لوحة تحكم سهلة + تدريب ودعم مباشر"
                      : "✓ Easy admin dashboard + training & direct support"}
                  </li>
                </ul>
                <Link
                  href="/pricing"
                  className="mt-4 inline-flex items-center gap-1 text-sm font-bold underline decoration-[var(--accent)] underline-offset-4"
                >
                  {locale === "ar" ? "شاهد الباقات والأسعار" : "View plans & pricing"}{" "}
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              {otherDemos.length > 0 && (
                <div className="rounded-[24px] bg-[var(--card)] border border-[var(--border)] p-5">
                  <div className="text-xs font-bold uppercase tracking-wider opacity-60 mb-3">
                    {locale === "ar" ? "معارض أخرى قد تهمك" : "Other Showcases"}
                  </div>
                  <div className="space-y-2.5">
                    {otherDemos.map((item) => (
                      <Link
                        key={item.slug}
                        href={`/demos/${item.slug}`}
                        className="flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--secondary)] transition-colors"
                      >
                        <img
                          src={item.image}
                          alt=""
                          className="h-12 w-16 rounded-lg object-cover flex-shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold truncate">
                            {locale === "ar" ? item.title : item.titleEn}
                          </div>
                          <div className="text-xs opacity-60 truncate">
                            {locale === "ar" ? item.sectorAr : item.sectorEn}
                          </div>
                        </div>
                        <ArrowUpRight className="h-4 w-4 opacity-50 flex-shrink-0" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section id="lead-form" className="py-10">
        <div className="mx-auto max-w-[720px] px-4 sm:px-6">
          <div className="rounded-[24px] bg-[var(--primary)] text-[var(--primary-foreground)] p-6 sm:p-8 text-center">
            <h3 className="text-xl sm:text-2xl font-black">
              {locale === "ar"
                ? "أعجبك هذا المستوى الاحترافي؟ ننفّذه لنشاطك في أيام"
                : "Love this level of quality? We build it for your business in days"}
            </h3>
            <p className="mt-2 text-sm opacity-75">
              {locale === "ar"
                ? "احصل على استشارة مجانية وتصور كامل لموقعك خلال أقل من ساعتين"
                : "Get a free consultation and a clear roadmap for your website within 2 hours"}
            </p>
            <Link
              href="/contact"
              className="mt-5 inline-flex h-11 px-6 rounded-full bg-[var(--accent)] text-black font-bold items-center gap-2 hover:bg-[var(--accent-hover)] transition-colors"
            >
              {locale === "ar" ? "اطلب عرضك المجاني" : "Get Your Free Quote"}{" "}
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Fullscreen Live Browser Modal */}
      {fullscreen && hasLiveUrl && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
          <div className="h-14 px-4 border-b border-white/10 flex items-center justify-between gap-3 bg-zinc-950 text-white">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setFullscreen(false)}
                className="h-9 px-3.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Minimize2 className="h-3.5 w-3.5" />
                {locale === "ar" ? "إغلاق ملء الشاشة" : "Exit Fullscreen"}
              </button>
              <span className="font-bold text-sm truncate hidden sm:inline">{title}</span>
              <span
                className="text-xs px-3 py-1 rounded-full bg-white/5 border border-white/10 text-zinc-400 truncate hidden md:inline"
                dir="ltr"
              >
                {demo.previewUrl}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1 p-1 rounded-full bg-white/5 border border-white/10">
                <button
                  type="button"
                  onClick={() => setDevice("desktop")}
                  className={`h-7 px-3 rounded-full text-xs font-semibold flex items-center gap-1 cursor-pointer ${
                    device === "desktop" ? "bg-[var(--accent)] text-black" : "text-zinc-300"
                  }`}
                >
                  <Monitor className="h-3.5 w-3.5" /> {locale === "ar" ? "حاسوب" : "Desktop"}
                </button>
                <button
                  type="button"
                  onClick={() => setDevice("mobile")}
                  className={`h-7 px-3 rounded-full text-xs font-semibold flex items-center gap-1 cursor-pointer ${
                    device === "mobile" ? "bg-[var(--accent)] text-black" : "text-zinc-300"
                  }`}
                >
                  <Smartphone className="h-3.5 w-3.5" /> {locale === "ar" ? "هاتف" : "Mobile"}
                </button>
              </div>

              <a
                href={demo.previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="h-9 px-4 rounded-full bg-[var(--accent)] text-black text-xs font-black inline-flex items-center gap-1.5 hover:opacity-90"
              >
                {locale === "ar" ? "فتح في نافذة جديدة" : "Open in New Tab"}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center p-0 sm:p-4 overflow-hidden">
            <div
              className={`bg-white h-full overflow-hidden shadow-2xl transition-all duration-300 ${
                device === "mobile"
                  ? "w-[390px] max-w-full rounded-[24px] border-4 border-zinc-800"
                  : "w-full rounded-none sm:rounded-[16px]"
              }`}
            >
              <iframe
                src={demo.previewUrl}
                title={title}
                className="w-full h-full border-0 bg-white"
                allow="clipboard-write; fullscreen"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
