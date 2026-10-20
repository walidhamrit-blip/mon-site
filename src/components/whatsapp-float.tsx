"use client";
import { MessageCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSiteConfig } from "@/components/site-provider";
import { whatsappLink } from "@/lib/utils";

/**
 * Bouton WhatsApp flottant — volontairement réduit au seul bouton rond.
 * L'ancienne carte d'accroche (qui apparaissait automatiquement au-dessus)
 * a été remplacée par l'assistant du site (src/components/site-chatbot.tsx).
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
      className="fixed bottom-5 end-5 z-50 grid h-14 w-14 relative place-items-center rounded-full bg-[#25D366] text-white shadow-[0_8px_24px_rgba(37,211,102,0.5)] transition-transform hover:scale-105 print:hidden"
    >
      <MessageCircle className="h-7 w-7" />
      <span className="absolute -top-1 -end-1 h-3 w-3 animate-pulse rounded-full border-2 border-white bg-red-500" />
    </a>
  );
}
