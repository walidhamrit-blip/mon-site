"use client";
import { useEffect, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSiteConfig } from "@/components/site-provider";
import { whatsappLink } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export function WhatsAppFloat() {
  const siteConfig = useSiteConfig();
  const { locale } = useI18n();
  const [showTip, setShowTip] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowTip(true), 2500);
    return () => clearTimeout(t);
  }, []);

  const msg = locale === "ar"
    ? `مرحبا نخبة 👋 رأيت موقعكم وأريد استشارة مجانية لنشاطي.`
    : `Hello Nukhba 👋 I saw your site and want a free consult.`;

  return (
    <div className="fixed bottom-5 end-5 z-50 flex flex-col items-end gap-3">
      <AnimatePresence>
        {showTip && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="max-w-[280px] rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-xl p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex gap-3">
                <div className="h-9 w-9 rounded-full bg-[#25D366] grid place-items-center text-white flex-shrink-0">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-bold">{locale === "ar" ? "نخبة — متاح الآن" : "Nukhba — online"}</div>
                  <div className="text-xs opacity-60 mt-0.5">{locale === "ar" ? "نرد خلال دقائق عبر واتساب" : "We reply in minutes on WhatsApp"}</div>
                </div>
              </div>
              <button onClick={() => setShowTip(false)} className="h-7 w-7 rounded-full bg-[var(--secondary)] grid place-items-center cursor-pointer">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <a href={whatsappLink(siteConfig.whatsapp, msg)} target="_blank" className="mt-3 inline-flex h-8 px-4 rounded-full bg-[#25D366] text-white text-sm font-bold items-center gap-1">
              {locale === "ar" ? "ابدأ محادثة" : "Start chat"} →
            </a>
          </motion.div>
        )}
      </AnimatePresence>

      <a
        href={whatsappLink(siteConfig.whatsapp, msg)}
        target="_blank"
        aria-label="WhatsApp"
        className="h-14 w-14 rounded-full bg-[#25D366] text-white shadow-[0_8px_24px_rgba(37,211,102,0.5)] grid place-items-center hover:scale-105 transition-transform relative"
      >
        <MessageCircle className="h-7 w-7" />
        <span className="absolute -top-1 -end-1 h-3 w-3 bg-red-500 rounded-full border-2 border-white animate-pulse" />
      </a>
    </div>
  );
}
