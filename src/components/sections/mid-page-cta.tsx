"use client";

import { ArrowUpRight, MessageCircle, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSiteConfig } from "@/components/site-provider";
import { whatsappLink } from "@/lib/utils";

/**
 * Bandeau d'appel à l'action au milieu de la page d'accueil.
 *
 * La page enchaînait avis → FAQ → formulaire sans relance commerciale :
 * un visiteur convaincu devait chercher le formulaire en bas de page.
 * Cette section propose deux sorties (devis / WhatsApp) au moment où la
 * preuve sociale vient d'être lue, avec la promotion en cours rappelée.
 */
export function MidPageCta() {
  const { locale } = useI18n();
  const siteConfig = useSiteConfig();
  const ar = locale === "ar";

  const goToForm = () => {
    document.getElementById("lead-form")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="section-tight">
      <div className="site-container px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[var(--radius-xl)] bg-[var(--primary)] px-6 py-10 text-[var(--primary-foreground)] shadow-[var(--shadow-lg)] sm:px-10 sm:py-12">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -end-16 -top-24 h-[320px] w-[320px] rounded-full bg-[var(--accent)]/25 blur-[80px]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.14]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
              backgroundSize: "22px 22px",
              maskImage: "linear-gradient(to left, black, transparent 60%)",
              WebkitMaskImage: "linear-gradient(to left, black, transparent 60%)",
            }}
          />

          <div className="relative flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-[56ch]">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10.5px] font-black uppercase tracking-[0.18em] text-[var(--accent)]">
                <Sparkles className="h-3 w-3" />
                {ar ? "عرض محدود" : "Limited offer"}
              </span>
              <h2 className="mt-4 text-[clamp(1.6rem,1.1rem+1.8vw,2.4rem)] font-black leading-[1.1] tracking-[-0.025em]">
                {ar
                  ? "موقعك الاحترافي في 7 أيام — خصم 50% عند الدفع."
                  : "Your professional site in 7 days — 50% off at checkout."}
              </h2>
              <p className="mt-3 text-[14px] leading-7 opacity-70">
                {ar
                  ? "استشارة مجانية، عرض سعر مكتوب، وتخصيص كامل على هويتك. ابدأ اليوم وكن متصلاً بعملائك قبل نهاية الأسبوع."
                  : "Free consultation, a written quote and full customization to your brand. Start today and be online before the weekend."}
              </p>
            </div>

            <div className="flex shrink-0 flex-col gap-2.5 sm:flex-row lg:flex-col xl:flex-row">
              <button
                onClick={goToForm}
                className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-6 text-[14px] font-bold text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)]"
              >
                {ar ? "اطلب عرض سعر مجاني" : "Get a free quote"}
                <ArrowUpRight className="h-4 w-4" />
              </button>
              <a
                href={whatsappLink(
                  siteConfig.whatsapp,
                  ar
                    ? "مرحبا نخبة 👋 أريد استغلال عرض الخصم لموقع نشاطي."
                    : "Hello Nukhba 👋 I'd like to use the discount for my business site.",
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/20 px-6 text-[14px] font-semibold transition-colors hover:bg-white/10"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
