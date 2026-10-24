"use client";

import { useState } from "react";
import { Bitcoin, MessageCircle } from "lucide-react";
import { CheckoutDialog } from "@/components/checkout-dialog";
import { useSiteConfig } from "@/components/site-provider";
import { useI18n } from "@/lib/i18n";
import {
  resolveDemoClassification,
  resolvePlanPriceBreakdown,
  type ClassificationPlan,
} from "@/lib/classification";
import type { Demo } from "@/lib/site-types";
import { formatMainPrice } from "@/lib/installments";
import { whatsappLink } from "@/lib/utils";

/**
 * Direct, server-priced checkout when the complete amount is configured;
 * otherwise a pre-filled WhatsApp request for the customization quote.
 */
export function ModelPurchaseButton({
  plan,
  demo,
  className = "",
}: {
  plan: ClassificationPlan;
  demo?: Demo;
  className?: string;
}) {
  const config = useSiteConfig();
  const { locale } = useI18n();
  const ar = locale === "ar";
  const [open, setOpen] = useState(false);
  const classification = demo
    ? resolveDemoClassification(demo, config.pricing.plans)
    : null;
  const checkoutPlan =
    config.pricing.plans.find((candidate) => candidate.id === (classification?.planId ?? plan.id)) ?? plan;
  const breakdown = resolvePlanPriceBreakdown(
    checkoutPlan,
    classification?.priceUsd ?? checkoutPlan.priceUsd,
  );
  const title = demo ? (ar ? demo.title : demo.titleEn) : (ar ? plan.name : plan.nameEn);
  const currency = ar ? config.pricing.currency : config.pricing.currencyEn;

  if (breakdown.totalPriceUsd == null) {
    const message = ar
      ? `مرحبا نخبة، أريد عرض سعر نهائي لموقع «${title}». سعر النموذج ${formatMainPrice(breakdown.modelPriceUsd ?? 0, currency)}، وأحتاج معرفة تكلفة التخصيص قبل الدفع.`
      : `Hello Nukhba, please send me a final written quote for “${title}”. The model is ${formatMainPrice(breakdown.modelPriceUsd ?? 0, currency)}; I would like the customization fee confirmed before payment.`;
    return (
      <a
        href={whatsappLink(config.whatsapp, message)}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        <MessageCircle className="h-4 w-4 shrink-0" />
        {ar ? "اطلب السعر النهائي للتخصيص" : "Get final customization quote"}
      </a>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className}
      >
        <Bitcoin className="h-4 w-4 shrink-0" />
        {ar ? "اشترِ الموقع والتخصيص" : "Buy model + customization"}
        <span dir="ltr">— {formatMainPrice(breakdown.totalPriceUsd, currency)}</span>
      </button>
      {open && (
        <CheckoutDialog
          plan={checkoutPlan}
          demo={demo}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
