"use client";
import { BadgeCheck, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * Encadré « garantie du service » affiché au moment du paiement en ligne
 * via la passerelle (NOWPayments) : il rassure le client sur la sécurité
 * de la transaction et sur l'engagement de livraison AVANT qu'il paie.
 *
 * - `variant="full"` : titre + 3 engagements (dialogue de paiement).
 * - `variant="compact"` : titre + résumé en une phrase (sections du site).
 */
export function PaymentGuarantee({
  variant = "full",
  className = "",
}: {
  variant?: "full" | "compact";
  className?: string;
}) {
  const { t, locale } = useI18n();
  const ar = locale === "ar";

  const title = ar ? t.checkout.guaranteeTitleAr : t.checkout.guaranteeTitleEn;
  const points = [
    ar ? t.checkout.guarantee1Ar : t.checkout.guarantee1En,
    ar ? t.checkout.guarantee2Ar : t.checkout.guarantee2En,
    ar ? t.checkout.guarantee3Ar : t.checkout.guarantee3En,
  ];

  if (variant === "compact") {
    return (
      <div
        className={`flex items-start gap-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 ${className}`}
      >
        <ShieldCheck className="mt-0.5 h-4.5 w-4.5 flex-shrink-0 text-emerald-400" />
        <p className="text-xs leading-relaxed text-emerald-300">
          <strong className="font-black">{title}</strong>
          {" — "}
          {points[0]}
        </p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 ${className}`}
    >
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4.5 w-4.5 flex-shrink-0 text-emerald-400" />
        <p className="text-sm font-black text-emerald-300">{title}</p>
      </div>
      <ul className="mt-2.5 space-y-1.5">
        {points.map((point) => (
          <li key={point} className="flex items-start gap-2">
            <BadgeCheck className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-400" />
            <span className="text-xs leading-relaxed text-emerald-300/90">{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
