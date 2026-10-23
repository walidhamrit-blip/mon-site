"use client";

import type { PlanPriceBreakdown } from "@/lib/classification";
import { Price } from "@/components/price";
import { useI18n } from "@/lib/i18n";

/**
 * Itemized model + customization + total, shared by pricing and demo pages.
 *
 * Les montants sont affichés dans la devise choisie par le visiteur
 * (`<Price />`) : la devise de facturation reste l'USD.
 */
export function ModelPriceBreakdown({
  breakdown,
  compact = false,
  className = "",
}: {
  breakdown: PlanPriceBreakdown;
  compact?: boolean;
  className?: string;
}) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const row = compact ? "flex items-start justify-between gap-3 text-[11px]" : "flex items-start justify-between gap-3 text-sm";
  const muted = compact ? "opacity-60" : "opacity-65";

  const price = (usd: number | null) => {
    if (usd == null) return ar ? "حسب الطلب" : "On request";
    return (
      <span className="text-end" dir="ltr">
        <Price usd={usd} className="font-bold" showLocal />
      </span>
    );
  };

  return (
    <dl className={`space-y-1.5 ${compact ? "text-xs" : "text-sm"} ${className}`}>
      <div className={row}>
        <dt className={muted}>{ar ? "سعر النموذج" : "Website model"}</dt>
        <dd>{price(breakdown.modelPriceUsd)}</dd>
      </div>
      <div className={row}>
        <dt className={muted}>
          {breakdown.customizationPercent == null
            ? (ar ? "تخصيص الهوية" : "Brand customization")
            : ar
              ? `تخصيص الهوية (${breakdown.customizationPercent}٪)`
              : `Brand customization (${breakdown.customizationPercent}%)`}
        </dt>
        <dd>
          {breakdown.customizationUsd == null
            ? <span className="text-end opacity-70">{ar ? "يُحدد في عرض السعر" : "Quoted before payment"}</span>
            : price(breakdown.customizationUsd)}
        </dd>
      </div>
      <div className={`${row} border-t border-[var(--border)]/70 pt-1.5 font-black`}>
        <dt>{ar ? "الإجمالي النهائي" : "Final project total"}</dt>
        <dd className="text-[var(--accent)]">
          {breakdown.totalPriceUsd == null
            ? <span className="text-end text-[11px] font-semibold opacity-75">{ar ? "بعد اعتماد عرض السعر" : "Confirmed in your quote"}</span>
            : price(breakdown.totalPriceUsd)}
        </dd>
      </div>
      {breakdown.totalPriceUsd == null && (
        <p className={`${compact ? "text-[10px]" : "text-[11px]"} leading-relaxed ${muted}`}>
          {ar
            ? "لا يتم تحصيل المبلغ النهائي إلا بعد اعتمادك عرضاً مكتوباً يشمل التخصيص."
            : "No final payment is taken until you approve a written quote including customization."}
        </p>
      )}
    </dl>
  );
}
