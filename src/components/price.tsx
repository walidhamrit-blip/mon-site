"use client";

import { useCurrency } from "@/components/currency-provider";
import { useI18n } from "@/lib/i18n";
import { BASE_CURRENCY, formatMoney } from "@/lib/currency";

/**
 * Affichage d'un prix dans la devise choisie par le visiteur.
 *
 * Les prix sont **facturés en USD** (c'est la devise encaissée par
 * NOWPayments, et 1 USD = 1 USDT au paiement crypto). Ce composant se charge
 * de la conversion et du formatage : le visiteur voit son montant, la
 * facturation reste en USD — l'indication « facturé en USD » n'apparaît que
 * lorsqu'il a choisi une autre devise.
 *
 * Le site n'affiche **aucun équivalent en devise locale** : la conversion se
 * fait dans la devise choisie par le visiteur (le sélecteur de la barre
 * supérieure propose USD, EUR, SAR, AED, EGP et LYD).
 *
 * Utilisable depuis un composant serveur comme client : la conversion se fait
 * dans le navigateur, où la devise choisie est connue.
 */
export function Price({
  usd,
  className = "",
  compact = false,
}: {
  /** Montant en USD (devise de facturation). */
  usd: number;
  className?: string;
  /** Format compact : sans décimales au-delà de 100. */
  compact?: boolean;
}) {
  const { format, formatCompact, currency } = useCurrency();
  const { locale } = useI18n();
  const ar = locale === "ar";
  const isBaseCurrency = currency === BASE_CURRENCY;

  return (
    <span className={className}>
      <span dir="ltr">{compact ? formatCompact(usd) : format(usd)}</span>
      {!isBaseCurrency && (
        <span className="ms-1 text-[0.85em] opacity-55">
          {" · "}
          {ar ? "الفوترة بـ" : "billed in"} {formatMoney(usd, BASE_CURRENCY, "en")}
        </span>
      )}
    </span>
  );
}
