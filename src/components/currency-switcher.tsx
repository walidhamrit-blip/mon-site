"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Coins } from "lucide-react";
import { useCurrency } from "@/components/currency-provider";
import { useI18n } from "@/lib/i18n";
import { currencyLongLabel, currencyShortLabel } from "@/lib/currency";

/**
 * Sélecteur de devise d'affichage.
 *
 * - Version compacte (barre supérieure) : un bouton qui ouvre une liste.
 * - Version liste (menu mobile) : la même liste, affichée d'un bloc.
 *
 * Le changement ne touche qu'à l'affichage : la devise facturée reste le
 * dollar (NOWPayments n'encaisse qu'en USD). Un indice l'indique
 * explicitement pour éviter toute confusion.
 */
export function CurrencySwitcher({
  variant = "compact",
}: {
  variant?: "compact" | "list";
}) {
  const { currency, currencies, setCurrency } = useCurrency();
  const { locale } = useI18n();
  const ar = locale === "ar";
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Fermeture au clic extérieur + touche Échap.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const label = currencyShortLabel(currency, locale);

  const list = (
    <ul className="space-y-1">
      {currencies.map((code) => {
        const active = code === currency;
        return (
          <li key={code}>
            <button
              type="button"
              onClick={() => {
                setCurrency(code);
                setOpen(false);
              }}
              aria-current={active ? "true" : undefined}
              className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-start text-[13px] font-semibold transition-colors ${
                active
                  ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                  : "hover:bg-[var(--secondary)]"
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="w-8 shrink-0 text-[13px] font-black">
                  {currencyShortLabel(code, locale)}
                </span>
                <span className="truncate">
                  {currencyLongLabel(code, locale)}
                </span>
              </span>
              {active && <Check className="h-3.5 w-3.5 shrink-0" />}
            </button>
          </li>
        );
      })}
    </ul>
  );

  if (variant === "list") {
    return (
      <div>
        <div className="mb-2.5 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
          <Coins className="h-3.5 w-3.5" />
          {ar ? "العملة" : "Currency"}
        </div>
        {list}
        <p className="mt-2 px-1 text-[10.5px] leading-5 text-[var(--muted-foreground)]">
          {ar
            ? "العرض فقط — الفاتورة تُحصَّل بالدولار الأمريكي."
            : "Display only — invoices are settled in US dollars."}
        </p>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ar ? "تغيير عملة العرض" : "Change display currency"}
        title={ar ? "عملة العرض" : "Display currency"}
        className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-[var(--secondary)] px-3 text-[12.5px] font-semibold transition-colors hover:bg-[var(--muted)]"
      >
        <Coins className="h-3.5 w-3.5" />
        <span dir="ltr">{label}</span>
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute end-0 top-11 z-50 w-60 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-2 shadow-[var(--shadow-lg)]"
        >
          {list}
          <p className="mt-1.5 px-2 pb-1 text-[10.5px] leading-4 text-[var(--muted-foreground)]">
            {ar
              ? "العرض فقط — الفاتورة بالدولار."
              : "Display only — invoiced in USD."}
          </p>
        </div>
      )}
    </div>
  );
}
