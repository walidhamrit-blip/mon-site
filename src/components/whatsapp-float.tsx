"use client";
import { MessageCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSiteConfig } from "@/components/site-provider";
import { whatsappLink } from "@/lib/utils";

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
  const siteConfig = useSiteConfig();
  const { locale } = useI18n();

  const msg =
    locale === "ar"
      ? `مرحبا نخبة 👋 رأيت موقعكم وأريد استشارة مجانية لنشاطي.`
      : `Hello Nukhba 👋 I saw your site and want a free consult.`;

  return (
    <a
      href={whatsappLink(siteConfig.whatsapp, msg)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={locale === "ar" ? "تواصل عبر واتساب" : "Chat on WhatsApp"}
      title={locale === "ar" ? "تواصل عبر واتساب" : "Chat on WhatsApp"}
      className="group fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] end-5 z-[70] grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-[0_10px_28px_-6px_rgba(37,211,102,0.65)] transition-transform duration-200 hover:scale-105 print:hidden"
    >
      <MessageCircle className="h-6 w-6" />
      <span
        aria-hidden="true"
        className="absolute -top-0.5 -end-0.5 h-3 w-3 rounded-full border-2 border-[var(--background)] bg-red-500"
      />
    </a>
  );
}
