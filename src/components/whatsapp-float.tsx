"use client";
import { MessageCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { WhatsAppEnquiry } from "@/components/whatsapp-enquiry";

/**
 * Bouton WhatsApp flottant — un seul bouton rond, ancré en bas de l'écran.
 *
 * ⚠️ Correctif : l'ancienne classe combinait `fixed` ET `relative`. Comme
 * `relative` l'emportait dans la feuille générée, le bouton n'était pas
 * fixe : il défilait avec la page et sortait du cadre à droite, créant un
 * débordement horizontal (page /badge notamment). Il est désormais
 * réellement `fixed`, calé sur les marges de sécurité des téléphones.
 */
export function WhatsAppFloat() {
  const { locale } = useI18n();

  return (
    <WhatsAppEnquiry
      ariaLabel={locale === "ar" ? "تواصل عبر واتساب" : "Chat on WhatsApp"}
      className="whatsapp-float group fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] end-5 z-[70] grid h-14 w-14 place-items-center rounded-full bg-[#0B6B3A] text-white shadow-[0_10px_28px_-6px_rgba(11,107,58,0.45)] transition-transform duration-200 hover:scale-105 print:hidden"
    >
      <MessageCircle className="h-6 w-6" />
    </WhatsAppEnquiry>
  );
}
