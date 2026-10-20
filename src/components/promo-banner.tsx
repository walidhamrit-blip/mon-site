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
 * Bandeau de solde animé : dégradé doré accordé au thème, hauteur 52 px
 * (lisible sans écraser la page), message défilant, pastille « PROMO »,
 * coupon copiable en un clic, fermeture, pause au survol.
 * La hauteur est publiée dans `--promo-h` pour que navbar et contenu se
 * décalent sans recouvrement.
 */
export function PromoBanner() {
  const { locale } = useI18n();
  const promo = CURRENT_PROMO;
  const enabled = promoActive(promo);
  const [visible, setVisible] = useState(true);
  const [copied, setCopied] = useState(false);

  // Réserve (ou libère) la hauteur du bandeau : navbar + contenu suivent.
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--promo-h",
      enabled && visible ? "52px" : "0px",
    );
  }, [enabled, visible]);

  if (!enabled) return null;

  const ar = locale === "ar";
  const text = promoBannerText(locale, promo);
  const label = promoLabel(locale, promo.percent);

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
      aria-label={ar ? "عرض ترويجي" : "Promotion"}
      dir={ar ? "rtl" : "ltr"}
      className="promo-banner fixed inset-x-0 top-0 z-[60] flex h-[52px] items-stretch"
    >
      {/* Pastille « PROMO » fixe — ancre visuelle immédiate. */}
      <div className="relative z-10 hidden shrink-0 items-center ps-3 pe-2 sm:flex">
        <span className="promo-badge inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] shadow-sm">
          <Sparkles className="h-3 w-3" />
          {ar ? "عرض" : "Promo"}
        </span>
      </div>

      {/* Message défilant (dupliqué pour une boucle sans coupure). */}
      <div className="relative z-10 flex-1 min-w-0 self-stretch overflow-hidden promo-window">
        <div className="promo-track flex h-full w-max items-center">
          {[0, 1].map((copy) => (
            <div
              key={copy}
              className="flex h-full items-center gap-2 whitespace-nowrap px-3 text-[12.5px] font-bold sm:text-[13.5px]"
              aria-hidden={copy === 1 ? "true" : undefined}
            >
              <Sparkles className="h-4 w-4 shrink-0 sm:hidden" />
              <span>{text}</span>
              <span className="mx-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#17110A]/40" />
              <span className="font-black tracking-wide">{label}</span>
              <span className="mx-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#17110A]/40" />
            </div>
          ))}
        </div>
      </div>

      {/* Coupon : lecture + copie en un clic (hors partie animée). */}
      <button
        type="button"
        onClick={copyCode}
        title={ar ? "نسخ الكوبون" : "Copy coupon"}
        className="promo-coupon relative z-10 my-2 me-2 inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 text-[12px] font-black tracking-wider transition-colors cursor-pointer sm:text-[13px]"
      >
        <span dir="ltr">{promo.code}</span>
        {copied ? (
          <Check className="h-4 w-4" />
        ) : (
          <Copy className="h-4 w-4 opacity-70" />
        )}
        <span className="sr-only">
          {ar ? "نسخ كود الخصم" : "Copy discount code"}
        </span>
      </button>

      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-label={ar ? "إغلاق الشريط" : "Dismiss banner"}
        className="relative z-10 grid w-9 shrink-0 place-items-center text-[#17110A]/70 hover:text-[#17110A] cursor-pointer"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
