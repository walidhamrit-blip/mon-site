"use client";

import dynamic from "next/dynamic";
import { useI18n } from "@/lib/i18n";
import { WhatsAppFloat } from "@/components/whatsapp-float";
import { BackToTop } from "@/components/back-to-top";

/**
 * L'assistant (567 lignes + moteur de conversation de 350 lignes) est chargé
 * à la demande : il n'est nécessaire qu'quand le visiteur l'ouvre, pas pour
 * rendre la page. `next/dynamic` le sort du JS initial de toutes les pages
 * (point 2 : réduction du JS initial) — il n'est pas essentielle au SSR,
 * d'où `ssr: false`.
 */
const SiteChatbot = dynamic(
  () => import("@/components/site-chatbot").then((mod) => mod.SiteChatbot),
  { ssr: false },
);

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
