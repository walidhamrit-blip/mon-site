"use client";
import { Pricing } from "@/components/sections/pricing";
import { FAQ } from "@/components/sections/faq";
import { useI18n } from "@/lib/i18n";

export function PricingClient() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  return <div className="pt-6">
    <header className="site-container px-4 text-center sm:px-6 lg:px-8">
      <h1 className="section-title">{ar ? "سعر واحد للتصاميم، وخيارات واضحة للوظائف" : "One price for every design. Clear options for functions."}</h1>
      <p className="section-lead mx-auto">{ar ? "ابدأ بموقع ثابت مخصص بلغة واحدة، ثم أضف اللغات أو قاعدة البيانات والإدارة حسب حاجتك." : "Start with a personalized static website in one language, then add languages or database-backed management as needed."}</p>
    </header>
    <Pricing />
    <FAQ />
  </div>;
}
