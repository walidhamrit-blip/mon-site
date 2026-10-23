"use client";

import { Ticket } from "lucide-react";
import { CURRENT_PROMO, discountedAmount, promoActive } from "@/lib/promotion";
import { useCurrency } from "@/components/currency-provider";
import { useI18n } from "@/lib/i18n";

/**
 * Petit rappel de prix après coupon, affiché sous un tarif.
 *
 * La coherente du prix était le dernier point d'incohérence de la galerie :
 * le bandeau annonce « -50 % avec le coupon NUKHBA50 », les cartes projets
 * affichaient le prix plein sans jamais montrer le prix remisé. Le visiteur
 * devait donc faire le calcul lui-même (et pouvait croire à une offre fictive).
 *
 * Le montant remisé vient de `discountedAmount()` — la même fonction que le
 * serveur de paiement — donc l'affichage ne peut pas diverger du prix facturé.
 * Rien n'est rendu quand la promotion est désactivée.
 */
export function PromoPriceNote({
  amountUsd,
  className = "",
}: {
  amountUsd: number | null | undefined;
  className?: string;
}) {
  const { locale } = useI18n();
  const { format } = useCurrency();
  const ar = locale === "ar";
  if (!promoActive(CURRENT_PROMO)) return null;
  if (typeof amountUsd !== "number" || !Number.isFinite(amountUsd) || amountUsd <= 0) {
    return null;
  }

  const discounted = discountedAmount(amountUsd);
  const price = format(discounted);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-[var(--accent)]/12 px-2 py-0.5 text-[10.5px] font-bold text-[color-mix(in_srgb,var(--accent)_70%,var(--foreground))] dark:text-[var(--accent)] ${className}`}
    >
      <Ticket className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span>
        {ar ? `${price} بكوبون ${CURRENT_PROMO.code}` : `${price} with ${CURRENT_PROMO.code}`}
      </span>
    </span>
  );
}
