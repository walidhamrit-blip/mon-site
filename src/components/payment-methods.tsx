"use client";

import { Apple } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const methods = ["visa", "mastercard", "apple-pay", "google-pay"] as const;

/** Brand marks for the card and wallet options shown at checkout. */
export function PaymentBrandLogos({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${className}`}
      aria-label="Visa, Mastercard, Apple Pay, Google Pay"
      role="img"
    >
      {methods.map((method) => (
        <span key={method} className={`payment-brand payment-brand-${method}`}>
          {method === "visa" && <span className="payment-visa">VISA</span>}
          {method === "mastercard" && (
            <span className="payment-mastercard-mark" aria-hidden="true">
              <i />
              <i />
            </span>
          )}
          {method === "mastercard" && <span className="payment-mastercard-word">mastercard</span>}
          {method === "apple-pay" && (
            <>
              <Apple aria-hidden="true" className="h-[17px] w-[17px] fill-current stroke-[1.5]" />
              <span>Pay</span>
            </>
          )}
          {method === "google-pay" && (
            <>
              <span className="payment-google-g" aria-hidden="true">G</span>
              <span><span className="payment-google-word">Google</span> Pay</span>
            </>
          )}
        </span>
      ))}
    </div>
  );
}

/** Site-wide, accessible payment-method marquee; the duplicate makes the loop seamless. */
export function PaymentMethodsRibbon() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const heading = ar ? "طرق الدفع المتاحة" : "Payment methods";

  return (
    <section className="payment-ribbon" aria-label={heading}>
      <div className="payment-ribbon-heading">
        <span className="payment-ribbon-dot" aria-hidden="true" />
        {heading}
      </div>
      <div className="payment-ribbon-window" aria-label={ar ? "بطاقات وخدمات الدفع" : "Cards and payment services"}>
        <div className="payment-ribbon-track">
          {[0, 1].map((copy) => (
            <div
              key={copy}
              className="payment-ribbon-group"
              aria-hidden={copy === 1 ? "true" : undefined}
            >
              <PaymentBrandLogos />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
