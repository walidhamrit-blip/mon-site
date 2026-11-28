"use client";

import { createContext, useContext, type ReactNode } from "react";
import { MessageCircle, Send } from "lucide-react";
import { useSiteConfig } from "@/components/site-provider";
import { useI18n } from "@/lib/i18n";
import { normalizeTelegramHandle } from "@/lib/telegram-links";
import { whatsappLink } from "@/lib/utils";

const BotContext = createContext("");

/** Seul le nom public du bot est transmis, jamais son jeton. */
export function OrderSupportProvider({ bot, children }: { bot?: string; children: ReactNode }) {
  return <BotContext.Provider value={normalizeTelegramHandle(bot)}>{children}</BotContext.Provider>;
}

export function OrderSupport({ reference }: { reference?: string | null }) {
  const { whatsapp } = useSiteConfig();
  const { locale } = useI18n();
  const ar = locale === "ar";
  const bot = useContext(BotContext);
  // Ne jamais transmettre le jeton de suivi, l'adresse crypto ou les champs du formulaire.
  const ref = /^(?:DGC|NKH|RSV)-[A-Za-z0-9]{6,64}$/.test(reference ?? "") ? reference : "";
  const text = ar
    ? `مرحباً، أحتاج إلى مساعدة بشأن طلب${ref ? ` ${ref}` : " من المتجر"}.`
    : `Hello, I need help with ${ref ? `order ${ref}` : "a store order"}.`;
  const whatsappAvailable = whatsapp.replace(/\D/g, "").length >= 7;
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-3 text-sm">
      <p className="font-bold">{ar ? "تحتاج إلى مساعدة في الطلب؟" : "Need help with your order?"}</p>
      <p className="mt-1 text-xs text-[var(--muted-foreground)]">{ar ? "لا ترسل كلمة مرور أو رمز دفع أو رابط المتابعة الخاص." : "Never share passwords, payment codes or your private tracking link."}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {whatsappAvailable && <a href={whatsappLink(whatsapp, text)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#0B6B3A] px-4 font-bold text-white"><MessageCircle className="h-4 w-4" aria-hidden="true" />WhatsApp</a>}
        {bot && <a href={`https://t.me/${bot}?start=support-${ar ? "ar" : "en"}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--border)] px-4 font-bold"><Send className="h-4 w-4" aria-hidden="true" />Telegram</a>}
        {!whatsappAvailable && !bot && <a href="/contact" className="inline-flex min-h-11 items-center font-bold underline">{ar ? "تواصل معنا" : "Contact us"}</a>}
      </div>
      {bot && <p className="mt-2 text-xs text-[var(--muted-foreground)]">{ar ? "في تيليجرام افتح قسم الدعم واكتب مشكلتك ورقم الطلب إن وجد." : "In Telegram, open Support and send your question and order reference if available."}</p>}
    </div>
  );
}
