"use client";

import type { PlanPriceBreakdown } from "@/lib/classification";
import { formatLyd, lydLabel } from "@/lib/classification";
import { formatMainPrice } from "@/lib/installments";
import { useI18n } from "@/lib/i18n";

/** Itemized model + customization + total, shared by pricing and demo pages. */
export function ModelPriceBreakdown({
  breakdown,
  currency,
  compact = false,
  className = "",
}: {
  breakdown: PlanPriceBreakdown;
  currency: string;
  compact?: boolean;
  className?: string;
}) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const row = compact ? "flex items-start justify-between gap-3 text-[11px]" : "flex items-start justify-between gap-3 text-sm";
  const muted = compact ? "opacity-60" : "opacity-65";

  const price = (usd: number | null, lyd: number | null) => {
    if (usd == null) return ar ? "حسب الطلب" : "On request";
    return (
      <span className="text-end" dir="ltr">
        <span className="font-bold">{formatMainPrice(usd, currency)}</span>
        {lyd != null && (
          <span className={`ms-1 ${muted}`}>
            ≈ {formatLyd(lyd)} {lydLabel(locale)}
          </span>
        )}
      </span>
    );
  };

  return (
    <dl className={`space-y-1.5 ${compact ? "text-xs" : "text-sm"} ${className}`}>
      <div className={row}>
        <dt className={muted}>{ar ? "سعر النموذج" : "Website model"}</dt>
        <dd>{price(breakdown.modelPriceUsd, breakdown.modelPriceLyd)}</dd>
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
            : price(breakdown.customizationUsd, breakdown.customizationLyd)}
        </dd>
      </div>
      <div className={`${row} border-t border-[var(--border)]/70 pt-1.5 font-black`}>
        <dt>{ar ? "الإجمالي النهائي" : "Final project total"}</dt>
        <dd className="text-[var(--accent)]">
          {breakdown.totalPriceUsd == null
            ? <span className="text-end text-[11px] font-semibold opacity-75">{ar ? "بعد اعتماد عرض السعر" : "Confirmed in your quote"}</span>
            : price(breakdown.totalPriceUsd, breakdown.totalPriceLyd)}
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
