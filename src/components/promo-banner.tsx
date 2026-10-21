"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Sparkles, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { CURRENT_PROMO, promoActive, promoLabel } from "@/lib/promotion";

/**
 * Bandeau promotionnel — version sobre.
 *
 * L'ancienne version faisait défiler le même message en boucle sur quatre
 * lignes, ce qui saturait le haut de page. Ici : une seule phrase, un
 * coupon copiable et une fermeture, sur 44 px. Le bandeau se replie dès
 * qu'on fait défiler la page et sa hauteur reste publiée dans `--promo-h`
 * (position de la navbar) et `--promo-space` (décalage du contenu), donc
 * il ne recouvre jamais la page.
 */
export function PromoBanner() {
  const { locale } = useI18n();
  const promo = CURRENT_PROMO;
  const enabled = promoActive(promo);
  const [visible, setVisible] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onScroll = () => setCollapsed(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty(
      "--promo-h",
      enabled && visible && !collapsed ? "44px" : "0px",
    );
    root.setProperty("--promo-space", enabled && visible ? "44px" : "0px");
  }, [enabled, visible, collapsed]);

  if (!enabled || !visible) return null;

  const ar = locale === "ar";
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

  return (
    <div
      role="region"
      aria-label={ar ? "عرض ترويجي" : "Promotion"}
      dir={ar ? "rtl" : "ltr"}
      className={`promo-banner fixed inset-x-0 top-0 z-[60] h-11 transition-transform duration-300 ease-out ${
        collapsed ? "-translate-y-full pointer-events-none" : "translate-y-0"
      }`}
    >
      <div className="mx-auto flex h-full w-full max-w-[1200px] items-center justify-center gap-2 px-3 sm:gap-3 sm:px-5">
        <span className="promo-badge hidden shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] sm:inline-flex">
          <Sparkles className="h-3 w-3" />
          {ar ? "عرض" : "Promo"}
        </span>

        <p className="truncate text-[12.5px] font-bold sm:text-[13px]">
          <span className="sm:hidden">{label}</span>
          <span className="hidden sm:inline">
            {ar
              ? `${label} على جميع المواقع عند الدفع`
              : `${label} on every website at checkout`}
          </span>
        </p>

        <button
          type="button"
          onClick={copyCode}
          title={ar ? "نسخ الكوبون" : "Copy coupon"}
          aria-live="polite"
          className="promo-coupon inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-black tracking-wider transition-colors cursor-pointer sm:px-3 sm:text-[12.5px]"
        >
          <span dir="ltr">{promo.code}</span>
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5 opacity-70" />}
          <span className="sr-only">{ar ? "نسخ كود الخصم" : "Copy discount code"}</span>
        </button>

        <button
          type="button"
          onClick={() => setVisible(false)}
          aria-label={ar ? "إغلاق الشريط" : "Dismiss banner"}
          className="ms-1 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[#17110A]/65 transition-colors hover:bg-black/10 hover:text-[#17110A] cursor-pointer sm:ms-3"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
