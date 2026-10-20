"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Sparkles, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import {
  CURRENT_PROMO,
  promoActive,
  promoBannerText,
  promoLabel,
} from "@/lib/promotion";

/**
 * Bandeau de solde animé, volontairement très fin (34 px) et discret :
 * il défile une seule ligne, se met en pause au survol, peut être fermé
 * et réserve sa hauteur via la variable CSS `--promo-h` pour ne jamais
 * recouvrir le contenu. Fermé, il ne revient qu'au rechargement complet.
 */
export function PromoBanner() {
  const { locale } = useI18n();
  const promo = CURRENT_PROMO;
  const enabled = promoActive(promo);
  const [visible, setVisible] = useState(true);
  const [copied, setCopied] = useState(false);

  // Réserve (ou libère) la hauteur du bandeau : navbar + contenu suivent.
  useEffect(() => {
    const height = enabled && visible ? "34px" : "0px";
    document.documentElement.style.setProperty("--promo-h", height);
  }, [enabled, visible]);

  if (!enabled) return null;

  const text = promoBannerText(locale, promo);
  const label = promoLabel(locale, promo.percent);

  const dismiss = () => setVisible(false);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(promo.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* presse-papiers indisponible : le code reste lisible */
    }
  };

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label={locale === "ar" ? "عرض ترويجي" : "Promotion"}
      dir={locale === "ar" ? "rtl" : "ltr"}
      className="promo-banner fixed inset-x-0 top-0 z-[60] h-[34px] flex items-stretch text-[11.5px] sm:text-xs"
    >
      {/* Message défilant (dupliqué pour une boucle sans coupure). */}
      <div className="relative flex-1 min-w-0 overflow-hidden promo-window">
        <div className="promo-track flex h-full w-max items-center">
          {[0, 1].map((copy) => (
            <div
              key={copy}
              className="flex items-center gap-2 whitespace-nowrap px-4 font-semibold"
              aria-hidden={copy === 1 ? "true" : undefined}
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span>{text}</span>
              <span className="mx-2 opacity-50">•</span>
              <span className="font-black tracking-wide">{label}</span>
              <span className="mx-2 opacity-50">•</span>
            </div>
          ))}
        </div>
      </div>

      {/* Coupon : lecture + copie en un clic (hors partie animée). */}
      <button
        type="button"
        onClick={copyCode}
        title={locale === "ar" ? "نسخ الكوبون" : "Copy coupon"}
        className="promo-coupon inline-flex shrink-0 items-center gap-1.5 border-s border-white/15 px-2.5 sm:px-3 font-black tracking-wider cursor-pointer hover:bg-white/10 transition-colors"
      >
        <span dir="ltr">{promo.code}</span>
        {copied ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Copy className="h-3.5 w-3.5 opacity-70" />
        )}
        <span className="sr-only">
          {locale === "ar" ? "نسخ كود الخصم" : "Copy discount code"}
        </span>
      </button>

      <button
        type="button"
        onClick={dismiss}
        aria-label={locale === "ar" ? "إغلاق الشريط" : "Dismiss banner"}
        className="grid w-8 shrink-0 place-items-center border-s border-white/10 opacity-70 hover:opacity-100 cursor-pointer"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
