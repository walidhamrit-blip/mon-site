"use client";

import { useI18n } from "@/lib/i18n";
import { WhatsAppFloat } from "@/components/whatsapp-float";
import { SiteChatbot } from "@/components/site-chatbot";
import { BackToTop } from "@/components/back-to-top";

/**
 * Les widgets flottants restent hors du flux, mais dans un repère
 * d'accessibilité explicite (complémentaire) plutôt qu'isolés
 * du plan de page.
 */
export function FloatingWidgets() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  return (
    <div role="complementary" aria-label={ar ? "أدوات مساعدة عائمة" : "Floating help tools"}>
      <WhatsAppFloat />
      <SiteChatbot />
      <BackToTop />
    </div>
  );
}
