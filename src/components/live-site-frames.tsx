"use client";

import { useState, useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { LocalizedLink as Link } from "@/components/localized-link";
import {
  Monitor,
  Smartphone,
  ExternalLink,
  Minimize2,
  RotateCw,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Tag,
  X,
} from "lucide-react";
import type { Demo } from "@/lib/site-types";
import { useI18n } from "@/lib/i18n";
import { useSiteConfig } from "@/components/site-provider";
import { ReservationButton } from "@/components/reservation-dialog";
import { resolveDemoClassification } from "@/lib/classification";
import { Price } from "@/components/price";
import { formatMainPrice, formatUsd } from "@/lib/installments";
import { ModelPriceBreakdown } from "@/components/model-price-breakdown";
import { ModelPurchaseButton } from "@/components/model-purchase-button";

export function isRealUrl(url?: string): boolean {
  return Boolean(url && url !== "#" && (/^https?:\/\//i.test(url.trim()) || url.trim().startsWith("/")));
}

export function getIframeSrc(url: string): string {
  if (/tulin-magazin\.vercel\.app/i.test(url)) {
    return "/live-demos/tulin-magazin/index.html";
  }
  return url;
}

/**
 * Aperçu proportionnel haute fidélité pour la boîte de démonstration de la page d'accueil.
 * En mode Desktop, le site est rendu dans un vrai viewport de 1440x900 puis mis à l'échelle
 * exactement à la largeur du cadre afin que la mise en page ne soit jamais déformée ou déplacée.
 * En mode Mobile, le site est rendu dans un vrai viewport mobile de 390x844.
 */
export function ScaledLiveIframe({
  url,
  title,
  mode,
  reloadKey = 0,
  onLoaded,
  interactive = true,
}: {
  url: string;
  title: string;
  mode: "desktop" | "mobile";
  reloadKey?: number;
  onLoaded?: () => void;
  /** Hero slides are visual previews; the Visit site link handles navigation. */
  interactive?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  const baseWidth = mode === "desktop" ? 1440 : 390;
  const baseHeight = mode === "desktop" ? 900 : 693;
  const frameKey = `${url}-${reloadKey}`;
  const loading = loadedKey !== frameKey;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateScale = () => {
      const w = el.clientWidth;
      if (w > 0) {
        setScale(w / baseWidth);
      }
    };

    updateScale();
    const ro = new ResizeObserver(updateScale);
    ro.observe(el);
    return () => ro.disconnect();
  }, [baseWidth]);

  return (
    <div
      ref={containerRef}
      dir="ltr"
      className="relative w-full h-full bg-white overflow-hidden"
    >
      {loading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white text-zinc-900 p-6 text-center">
          <div className="h-10 w-10 rounded-full border-3 border-[var(--accent)] border-t-transparent animate-spin mb-3" />
          <div className="text-sm font-bold">{title}</div>
          <div className="text-xs text-zinc-500 mt-1 truncate max-w-full" dir="ltr">
            {url}
          </div>
        </div>
      )}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: `${baseWidth}px`,
          height: `${baseHeight}px`,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
        className="bg-white"
      >
        <iframe
          key={`${url}-${reloadKey}-${mode}`}
          src={getIframeSrc(url)}
          title={title}
          className="w-full h-full border-0 bg-white block"
          loading="lazy"
          tabIndex={interactive ? undefined : -1}
          aria-hidden={interactive ? undefined : true}
          onLoad={() => {
            setLoadedKey(frameKey);
            onLoaded?.();
          }}
          allow="clipboard-write; fullscreen"
        />
      </div>
    </div>
  );
}

/**
 * Visionneuse plein écran (100vw x 100vh) avec choix de 2 vues : Desktop ou Mobile.
 * Rendue via un Portal dans document.body avec z-[9999] pour masquer totalement
 * l'arrière-plan, la barre de navigation et le bouton WhatsApp de l'ancien site.
 */
export function FullscreenLiveViewer({
  demo,
  allDemos = [],
  initialMode = "desktop",
  onClose,
  backHref,
  standalone = false,
}: {
  demo: Demo;
  allDemos?: Demo[];
  initialMode?: "desktop" | "mobile";
  onClose?: () => void;
  backHref?: string;
  /**
   * Page dédiée (/demos/[slug]) : le viewer est alors le contenu principal.
   * On émet un bloc sémantique complet (h1, description bilingue, h2
   * fonctionnalités, prix/catégorie et maillage interne vers les projets
   * liés) rendu côté serveur, donc présent dans le HTML initial pour
   * Googlebot et les crawlers IA. En usage modale (page d'accueil), on
   * reste sans h1 pour ne pas doubler celui du hero.
   */
  standalone?: boolean;
}) {
  const { locale } = useI18n();
  const config = useSiteConfig();
  const classification = resolveDemoClassification(demo, config.pricing.plans);
  const classifiedPlan = classification
    ? config.pricing.plans.find((plan) => plan.id === classification.planId)
    : null;
  const depositUsd = config.reservation?.depositUsd ?? 1;
  const [mode, setMode] = useState<"desktop" | "mobile">(() =>
    typeof window !== "undefined" && window.innerWidth < 768 && initialMode === "desktop"
      ? "mobile"
      : initialMode,
  );
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  // Proposition de réservation : visible à l'ouverture, masquable pour
  // laisser toute la place au site en démonstration.
  const [offerVisible, setOfferVisible] = useState(true);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.setAttribute("data-dialog", "open");
    return () => {
      document.body.style.overflow = prevOverflow;
      document.documentElement.removeAttribute("data-dialog");
    };
  }, []);

  const title = locale === "ar" ? demo.title : demo.titleEn;

  const content = (
    <div
      className="fixed inset-0 z-[9999] flex h-dvh w-full flex-col overflow-hidden bg-[#0B0B0E] text-white"
      style={{ isolation: "isolate" }}
    >
      {/* Barre supérieure de contrôle plein écran */}
      <div className="flex min-h-14 h-auto flex-shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-[#111116] px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-5">
        {/* Gauche : Retour / Fermer + Titre */}
        <div className="flex items-center gap-2.5 min-w-0">
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label={locale === "ar" ? "إغلاق العرض الكامل" : "Exit Fullscreen"}
              className="min-h-10 px-3.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer flex-shrink-0"
            >
              <Minimize2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">
                {locale === "ar" ? "إغلاق العرض الكامل" : "Exit Fullscreen"}
              </span>
            </button>
          ) : backHref ? (
            <Link
              href={backHref}
              aria-label={locale === "ar" ? "الرجوع للمعارض" : "Back to Demos"}
              className="min-h-10 px-3.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold inline-flex items-center gap-1.5 transition-colors flex-shrink-0"
            >
              {locale === "ar" ? (
                <ArrowRight className="h-3.5 w-3.5" />
              ) : (
                <ArrowLeft className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">
                {locale === "ar" ? "الرجوع للمعارض" : "Back to Demos"}
              </span>
            </Link>
          ) : null}

          <div className="hidden md:flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-black flex-shrink-0">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              {locale === "ar" ? "موقع حقيقي مباشر" : "LIVE SITE"}
            </span>
            <span className="font-bold text-sm truncate">{title}</span>
          </div>
        </div>

        {/* Centre : Choix des 2 vues (Desktop ou Mobile) */}
        <div className="order-3 w-full justify-center sm:order-none sm:w-auto flex items-center gap-1 p-1 rounded-full bg-white/10 border border-white/15">
          <button
            type="button"
            onClick={() => setMode("desktop")}
            className={`min-h-9 flex-1 justify-center sm:flex-none px-3.5 sm:px-4 rounded-full text-xs sm:text-sm font-black inline-flex items-center gap-1.5 transition-[background-color,border-color,color] cursor-pointer ${
              mode === "desktop"
                ? "bg-[var(--accent)] text-[var(--accent-foreground)] shadow"
                : "text-zinc-300 hover:text-white"
            }`}
          >
            <Monitor className="h-4 w-4 shrink-0" />
            <span className="sm:hidden">{locale === "ar" ? "حاسوب" : "Desktop"}</span>
            <span className="hidden sm:inline">{locale === "ar" ? "عرض حاسوب (Desktop)" : "Desktop View"}</span>
          </button>
          <button
            type="button"
            onClick={() => setMode("mobile")}
            className={`min-h-9 flex-1 justify-center sm:flex-none px-3.5 sm:px-4 rounded-full text-xs sm:text-sm font-black inline-flex items-center gap-1.5 transition-[background-color,border-color,color] cursor-pointer ${
              mode === "mobile"
                ? "bg-[var(--accent)] text-[var(--accent-foreground)] shadow"
                : "text-zinc-300 hover:text-white"
            }`}
          >
            <Smartphone className="h-4 w-4 shrink-0" />
            <span className="sm:hidden">{locale === "ar" ? "هاتف" : "Mobile"}</span>
            <span className="hidden sm:inline">{locale === "ar" ? "عرض هاتف (Mobile)" : "Mobile View"}</span>
          </button>
        </div>

        {/* Droite : Classification + Réservation + Actualiser + Ouvrir */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {classification && (
            <span
              className="hidden xl:inline-flex items-center gap-1.5 h-10 px-3 rounded-full bg-white/10 border border-white/15 text-[11px] font-bold text-zinc-200"
              dir="ltr"
              title={locale === "ar" ? "فئة الموقع وسعره" : "Site category & price"}
            >
              <Tag className="h-3.5 w-3.5 text-[var(--accent)]" />
              {locale === "ar" ? "العرض الأساسي" : "Base offer"}
              <span className="text-white/30">·</span>
              {classification.totalPriceUsd != null ? (
                <Price usd={classification.totalPriceUsd} />
              ) : classification.priceUsd != null ? (
                <>
                  {locale === "ar" ? "النموذج" : "Model"}{" "}
                  <Price usd={classification.priceUsd} />
                </>
              ) : (
                <Price usd={classification.priceUsd ?? 0} />
              )}
            </span>
          )}

          {config.reservation?.enabled && (
            <ReservationButton
              demo={demo}
              label={
                locale === "ar"
                  ? `احجز — ${formatUsd(depositUsd)} $`
                  : `Reserve — $${formatUsd(depositUsd)}`
              }
              className="min-h-10 px-3.5 sm:px-4 rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-foreground)] text-xs font-black inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            />
          )}

          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setReloadKey((k) => k + 1);
            }}
            title={locale === "ar" ? "إعادة تحميل الموقع" : "Reload site"}
            aria-label={locale === "ar" ? "إعادة تحميل الموقع" : "Reload site"}
            className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center transition-colors cursor-pointer"
          >
            <RotateCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <Link
            href="/contact"
            onClick={() => onClose?.()}
            className="hidden lg:inline-flex h-10 px-4 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold items-center gap-1.5 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
            <span>{locale === "ar" ? "اطلب موقعاً مماثلاً" : "Order Similar Site"}</span>
          </Link>

          <a
            href={demo.previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={locale === "ar" ? "فتح في نافذة جديدة" : "Open in New Tab"}
            className="min-h-10 px-3.5 sm:px-4 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
          >
            <span className="hidden sm:inline">
              {locale === "ar" ? "فتح في نافذة جديدة" : "Open in New Tab"}
            </span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* Zone principale : 100% plein écran en Desktop, ou Smartphone centré en Mobile */}
      <div
        dir="ltr"
        className={`flex-1 w-full overflow-hidden flex items-center justify-center relative ${
          mode === "mobile" ? "bg-[#0B0B0E] p-0 sm:p-6" : "bg-white p-0"
        }`}
      >
        {loading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#0B0B0E] text-white p-6 text-center">
            <div className="h-11 w-11 rounded-full border-3 border-[var(--accent)] border-t-transparent animate-spin mb-3" />
            <div className="text-base font-bold">{title}</div>
            <div className="text-xs text-zinc-400 mt-1 break-all" dir="ltr">
              {demo.previewUrl}
            </div>
          </div>
        )}

        <div
          className={
            mode === "mobile"
              ? "h-full w-full bg-white overflow-hidden relative flex flex-col sm:w-[390px] sm:max-w-full sm:max-h-[844px] sm:rounded-[38px] sm:border-[10px] sm:border-zinc-800 sm:shadow-[0_25px_80px_rgba(0,0,0,0.85)]"
              : "w-full h-full bg-white overflow-hidden"
          }
        >
          {mode === "mobile" && (
            <div className="hidden h-6 flex-shrink-0 items-center justify-center bg-zinc-900 sm:flex">
              <div className="h-1.5 w-16 rounded-full bg-zinc-700" />
            </div>
          )}
          <iframe
            key={`${demo.slug}-${reloadKey}`}
            src={getIframeSrc(demo.previewUrl)}
            title={title}
            className="w-full flex-1 h-full border-0 bg-white block"
            loading="eager"
            onLoad={() => setLoading(false)}
            allow="clipboard-write; fullscreen"
          />
        </div>
      </div>

      {/* Proposition de réservation prioritaire — classification + prix + acompte */}
      {(config.reservation?.enabled || classifiedPlan) && offerVisible && (
        <div
          dir={locale === "ar" ? "rtl" : "ltr"}
          className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] start-3 end-3 sm:end-auto sm:w-[330px] max-h-[46dvh] overflow-y-auto overscroll-contain z-30 rounded-2xl border border-white/15 bg-[#111116]/95 backdrop-blur-md p-4 text-white shadow-[0_18px_50px_rgba(0,0,0,0.55)]"
        >
          <div className="flex items-start justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 pt-1 text-[10px] font-black uppercase tracking-wider text-[var(--accent)]">
              <Sparkles className="h-3 w-3" />
              {locale === "ar" ? "عرض الموقع الأساسي" : "Base website offer"}
            </span>
            <button
              type="button"
              onClick={() => setOfferVisible(false)}
              className="h-10 w-10 -mt-1.5 -me-1.5 grid shrink-0 place-items-center rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              aria-label={locale === "ar" ? "إخفاء العرض" : "Dismiss offer"}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {classification && (
            <div className="mt-2 rounded-xl bg-white/5 p-3">
              <div className="mb-2 text-[10px] uppercase tracking-wider text-zinc-500">
                {locale === "ar" ? classification.name : classification.nameEn}
              </div>
              <ModelPriceBreakdown
                breakdown={classification}
                compact
                className="text-white"
              />
            </div>
          )}

          {classifiedPlan && (
            <ModelPurchaseButton
              plan={classifiedPlan}
              demo={demo}
              className="mt-3 min-h-11 w-full rounded-full bg-[var(--accent)] px-3 text-[var(--accent-foreground)] text-xs font-black inline-flex items-center justify-center gap-1.5 hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
            />
          )}
          {config.reservation?.enabled && (
            <>
              <ReservationButton
                demo={demo}
                className="mt-2 min-h-11 w-full rounded-full border border-white/20 bg-white/10 px-3 text-white text-xs font-black inline-flex items-center justify-center gap-1.5 hover:bg-white/15 transition-colors cursor-pointer"
              />
              <p className="mt-2 text-[10px] text-zinc-500 leading-relaxed">
                {locale === "ar"
                  ? `العربون ${formatUsd(depositUsd)} $ (= ${formatUsd(depositUsd)} USDT) يُخصم من سعر الموقع الأساسي.`
                  : `$${formatUsd(depositUsd)} deposit (= ${formatUsd(depositUsd)} USDT) is deducted from the base website price.`}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );

  const relatedDemos = allDemos
    .filter((d) => d.slug !== demo.slug)
    .sort((a, b) => {
      const aScore =
        (a.sector === demo.sector ? 2 : 0) + (a.planId === demo.planId ? 1 : 0);
      const bScore =
        (b.sector === demo.sector ? 2 : 0) + (b.planId === demo.planId ? 1 : 0);
      return bScore - aScore;
    })
    .slice(0, 4);

  return (
    <>
      {standalone && (
        <article className="sr-only" aria-label={title}>
          <h1>{title}</h1>
          <p>{demo.description}</p>
          <p lang="en" dir="ltr">
            {demo.titleEn} — {demo.descriptionEn}
          </p>

          <section>
            <h2>القطاع والباقة — Sector &amp; Package</h2>
            <p>
              {demo.sectorAr} ({demo.sectorEn})
              {classification
                ? ` — العرض الأساسي: ${classification.name} (${classification.nameEn}) · نموذج الموقع: ${classification.priceUsd != null ? `$${formatUsd(classification.priceUsd)} USD (= USDT)` : "حسب الطلب"} · التخصيص${classification.customizationPercent != null ? ` (${classification.customizationPercent}٪)` : ""}: ${classification.customizationUsd != null ? `$${formatUsd(classification.customizationUsd)} USD` : "عرض سعر مكتوب قبل الدفع"} · الإجمالي: ${classification.totalPriceUsd != null ? `$${formatUsd(classification.totalPriceUsd)} USD (= USDT)` : "يُحدد ويُعتمد قبل الدفع النهائي"}`
                : ""}
            </p>
          </section>

          {(demo.features.length > 0 || demo.featuresEn.length > 0) && (
            <section>
              <h2>المميزات الرئيسية — Key Features</h2>
              <ul>
                {demo.features.map((feat, idx) => (
                  <li key={feat}>
                    {feat}
                    {demo.featuresEn[idx] ? ` — ${demo.featuresEn[idx]}` : ""}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {isRealUrl(demo.previewUrl) && (
            <p>
              <a href={demo.previewUrl} rel="noopener noreferrer">
                معاينة الموقع الحي — Live Preview: {demo.titleEn}
              </a>
            </p>
          )}

          <nav aria-label="مشاريع مشابهة وروابط داخلية — Related portfolio projects">
            <h2>معارض أعمال أخرى — Related Showcases</h2>
            <ul>
              {relatedDemos.map((item) => (
                <li key={item.slug}>
                  <Link href={`/demos/${item.slug}`}>
                    {item.title} — {item.titleEn} ({item.sectorAr})
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/demos">كل المعارض الحية — All Live Demos</Link>
              </li>
              <li>
                <Link href="/pricing">الباقات والأسعار — Pricing Plans</Link>
              </li>
              <li>
                <Link href="/contact">تواصل معنا — Contact Nukhba</Link>
              </li>
            </ul>
          </nav>
        </article>
      )}
      {mounted && createPortal(content, document.body)}
    </>
  );
}
