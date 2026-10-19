"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
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
import { formatLyd, lydLabel, resolveDemoClassification } from "@/lib/classification";
import { formatMainPrice, formatUsd } from "@/lib/installments";

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
  const [loading, setLoading] = useState(true);

  const baseWidth = mode === "desktop" ? 1440 : 390;
  const baseHeight = mode === "desktop" ? 900 : 693;

  useEffect(() => {
    setLoading(true);
  }, [url, reloadKey]);

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
          loading="eager"
          tabIndex={interactive ? undefined : -1}
          aria-hidden={interactive ? undefined : true}
          onLoad={() => {
            setLoading(false);
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
  initialMode = "desktop",
  onClose,
  backHref,
  standalone = false,
}: {
  demo: Demo;
  initialMode?: "desktop" | "mobile";
  onClose?: () => void;
  backHref?: string;
  /**
   * Page dédiée (/demos/[slug]) : le viewer est alors le contenu principal.
   * On émet un bloc sémantique (h1 + description) rendu côté serveur, donc
   * présent dans le HTML initial — sinon la page serait vide pour les
   * crawlers (le portail ne se monte qu'après hydratation). En usage modale
   * (page d'accueil), on reste sans h1 pour ne pas doubler celui du hero.
   */
  standalone?: boolean;
}) {
  const { locale } = useI18n();
  const config = useSiteConfig();
  const classification = resolveDemoClassification(demo, config.pricing.plans);
  const depositUsd = config.reservation?.depositUsd ?? 1;
  const [mode, setMode] = useState<"desktop" | "mobile">(initialMode);
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  // Proposition de réservation : visible à l'ouverture, masquable pour
  // laisser toute la place au site en démonstration.
  const [offerVisible, setOfferVisible] = useState(true);

  useEffect(() => {
    setMounted(true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const title = locale === "ar" ? demo.title : demo.titleEn;

  const content = (
    <div
      className="fixed inset-0 z-[9999] w-screen h-screen bg-[#0B0B0E] text-white flex flex-col overflow-hidden"
      style={{ isolation: "isolate" }}
    >
      {/* Barre supérieure de contrôle plein écran */}
      <div className="min-h-14 h-auto py-2 px-3 sm:px-5 border-b border-white/10 bg-[#111116] flex flex-wrap items-center justify-between gap-2 flex-shrink-0">
        {/* Gauche : Retour / Fermer + Titre */}
        <div className="flex items-center gap-2.5 min-w-0">
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-3.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer flex-shrink-0"
            >
              <Minimize2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">
                {locale === "ar" ? "إغلاق العرض الكامل" : "Exit Fullscreen"}
              </span>
            </button>
          ) : backHref ? (
            <Link
              href={backHref}
              className="h-9 px-3.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold inline-flex items-center gap-1.5 transition-colors flex-shrink-0"
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
            className={`h-8 px-4 rounded-full text-xs sm:text-sm font-black inline-flex items-center gap-1.5 transition-all cursor-pointer ${
              mode === "desktop"
                ? "bg-[var(--accent)] text-[var(--accent-foreground)] shadow"
                : "text-zinc-300 hover:text-white"
            }`}
          >
            <Monitor className="h-4 w-4" />
            <span>{locale === "ar" ? "عرض حاسوب (Desktop)" : "Desktop View"}</span>
          </button>
          <button
            type="button"
            onClick={() => setMode("mobile")}
            className={`h-8 px-4 rounded-full text-xs sm:text-sm font-black inline-flex items-center gap-1.5 transition-all cursor-pointer ${
              mode === "mobile"
                ? "bg-[var(--accent)] text-[var(--accent-foreground)] shadow"
                : "text-zinc-300 hover:text-white"
            }`}
          >
            <Smartphone className="h-4 w-4" />
            <span>{locale === "ar" ? "عرض هاتف (Mobile)" : "Mobile View"}</span>
          </button>
        </div>

        {/* Droite : Classification + Réservation + Actualiser + Ouvrir */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {classification && (
            <span
              className="hidden xl:inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-white/10 border border-white/15 text-[11px] font-bold text-zinc-200"
              dir="ltr"
              title={locale === "ar" ? "فئة الموقع وسعره" : "Site category & price"}
            >
              <Tag className="h-3.5 w-3.5 text-[var(--accent)]" />
              {locale === "ar" ? "الفئة" : "Cat."} {classification.tier}
              <span className="text-white/30">·</span>
              {classification.priceUsd != null
                ? formatMainPrice(
                    classification.priceUsd,
                    locale === "ar" ? config.pricing.currency : config.pricing.currencyEn,
                  )
                : `${formatLyd(classification.priceLyd)} ${lydLabel(locale)}`}
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
              className="h-9 px-3.5 sm:px-4 rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-foreground)] text-xs font-black inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            />
          )}

          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setReloadKey((k) => k + 1);
            }}
            title={locale === "ar" ? "إعادة تحميل الموقع" : "Reload site"}
            className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center transition-colors cursor-pointer"
          >
            <RotateCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <Link
            href="/contact"
            onClick={() => onClose?.()}
            className="hidden lg:inline-flex h-9 px-4 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold items-center gap-1.5 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
            <span>{locale === "ar" ? "اطلب موقعاً مماثلاً" : "Order Similar Site"}</span>
          </Link>

          <a
            href={demo.previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="h-9 px-4 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
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
          mode === "mobile" ? "bg-[#0B0B0E] p-3 sm:p-6" : "bg-white p-0"
        }`}
      >
        {loading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#0B0B0E] text-white p-6 text-center">
            <div className="h-11 w-11 rounded-full border-3 border-[var(--accent)] border-t-transparent animate-spin mb-3" />
            <div className="text-base font-bold">{title}</div>
            <div className="text-xs text-zinc-400 mt-1" dir="ltr">
              {demo.previewUrl}
            </div>
          </div>
        )}

        <div
          className={
            mode === "mobile"
              ? "w-[390px] max-w-full h-full max-h-[844px] rounded-[38px] border-[10px] border-zinc-800 bg-white shadow-[0_25px_80px_rgba(0,0,0,0.85)] overflow-hidden relative flex flex-col"
              : "w-full h-full bg-white overflow-hidden"
          }
        >
          {mode === "mobile" && (
            <div className="h-6 bg-zinc-900 flex items-center justify-center flex-shrink-0">
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
      {config.reservation?.enabled && offerVisible && (
        <div
          dir={locale === "ar" ? "rtl" : "ltr"}
          className="absolute bottom-3 start-3 end-3 sm:end-auto sm:w-[330px] z-30 rounded-2xl border border-white/15 bg-[#111116]/95 backdrop-blur-md p-4 text-white shadow-[0_18px_50px_rgba(0,0,0,0.55)]"
        >
          <div className="flex items-start justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[var(--accent)]">
              <Sparkles className="h-3 w-3" />
              {locale === "ar" ? "حجز أولوية" : "Priority booking"}
            </span>
            <button
              type="button"
              onClick={() => setOfferVisible(false)}
              className="h-6 w-6 -mt-1 -me-1 grid place-items-center rounded-full text-zinc-500 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              aria-label={locale === "ar" ? "إخفاء العرض" : "Dismiss offer"}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {classification && (
            <div className="mt-2 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                  {locale === "ar" ? "الفئة" : "Category"} {classification.tier}
                </div>
                <div className="text-sm font-bold truncate">
                  {locale === "ar" ? classification.name : classification.nameEn}
                </div>
              </div>
              <div className="text-end flex-shrink-0">
                {classification.priceUsd != null && (
                  <div className="text-xl font-black text-[var(--accent)]" dir="ltr">
                    {formatMainPrice(
                      classification.priceUsd,
                      locale === "ar" ? config.pricing.currency : config.pricing.currencyEn,
                    )}
                  </div>
                )}
                <div className="text-[10px] text-zinc-500" dir="ltr">
                  {formatLyd(classification.priceLyd)}{" "}
                  {lydLabel(locale)}
                </div>
              </div>
            </div>
          )}

          <ReservationButton
            demo={demo}
            className="mt-3 h-10 w-full rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] text-xs font-black inline-flex items-center justify-center gap-1.5 hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
          />
          <p className="mt-2 text-[10px] text-zinc-500 leading-relaxed">
            {locale === "ar"
              ? `عربون ${formatUsd(depositUsd)} $ (${formatLyd(
                  config.reservation?.depositLyd ?? 0,
                )} د.ل) يُخصم من سعر المشروع — أولوية في جدول العمل.`
              : `$${formatUsd(depositUsd)} deposit (${formatLyd(
                  config.reservation?.depositLyd ?? 0,
                )} LYD) deducted from the project price — priority in our schedule.`}
          </p>
        </div>
      )}
    </div>
  );

  return (
    <>
      {standalone && (
        <section className="sr-only" aria-label={title}>
          <h1>{title}</h1>
          <p>{locale === "ar" ? demo.description : demo.descriptionEn}</p>
        </section>
      )}
      {mounted && createPortal(content, document.body)}
    </>
  );
}
