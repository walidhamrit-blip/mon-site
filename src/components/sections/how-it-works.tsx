"use client";

import { MessageCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { WhatsAppEnquiry } from "@/components/whatsapp-enquiry";

const STEPS = [
  {
    ar: "نتحدث معاً على واتساب عمّا تريد.",
    en: "We talk on WhatsApp about what you want.",
  },
  {
    ar: "أرسل لك عنواناً بسيطاً للدفع بالعملة الرقمية.",
    en: "I send you a simple address to pay in crypto.",
  },
  {
    ar: "فور استلامها، أبدأ موقعك وأرسل لك الرابط.",
    en: "As soon as it's received, I start your website and send you the link.",
  },
];

/**
 * « Comment ça marche ? Simple pour tout le monde » — 3 pas, aucune
 * explication technique, juste la simplicité. Un gros bouton WhatsApp
 * vert au milieu de la page pour convertir directement.
 */
export function HowItWorks() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  return (
    <section className="site-container px-4 py-14 sm:px-6 lg:px-8" aria-labelledby="how-it-works-title">
      <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-6 sm:p-10">
        <h2 id="how-it-works-title" className="text-2xl font-black sm:text-3xl">
          {ar ? "كيف يعمل الأمر؟ بسيط للجميع." : "How does it work? Simple for everyone."}
        </h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={index} className="flex gap-4 rounded-2xl border border-[var(--border)] bg-[var(--secondary)]/40 p-5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#0B6B3A] text-sm font-black text-white">
                {index + 1}
              </span>
              <p className="text-sm font-bold leading-6">{ar ? step.ar : step.en}</p>
            </li>
          ))}
        </ol>
        {/* Rassurance : dès le paiement, le client reçoit un site exemple en
            ligne qu'on personnalise ensuite pour sa boutique. */}
        <p className="mt-6 flex items-start gap-3 rounded-2xl border border-[#0B6B3A]/35 bg-[#0B6B3A]/10 p-5 text-sm font-bold leading-6">
          <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#0B6B3A]" aria-hidden="true" />
          <span>
            {ar
              ? "Dès le paiement, tu reçois un site exemple en ligne. Ensuite, je le personnalise pour ta boutique : tes couleurs, ton logo, tes produits."
              : "As soon as you pay, you receive a live example website. Then I customize it for your shop: your colors, your logo, your products."}
          </span>
        </p>
        <div className="mt-8">
          <WhatsAppEnquiry
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#0B6B3A] px-7 text-[14px] font-black text-white shadow-[0_10px_28px_-8px_rgba(11,107,58,0.55)] transition-transform hover:scale-[1.03]"
          >
            <MessageCircle className="h-4 w-4" />
            {ar ? "تحدث على واتساب" : "Chat on WhatsApp"}
          </WhatsAppEnquiry>
        </div>
      </div>
    </section>
  );
}
