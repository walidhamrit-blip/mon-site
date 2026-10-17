"use client";
import { useI18n } from "@/lib/i18n";
import { CTAForm } from "@/components/sections/cta-form";
import { useSiteConfig } from "@/components/site-provider";
import { MapPin, Phone, Mail, Clock, MessageCircle } from "lucide-react";
import { whatsappLink } from "@/lib/utils";

export default function ContactPage() {
  const siteConfig = useSiteConfig();
  const { locale, t } = useI18n();
  return (
    <div className="pt-[96px]">
      <section className="py-10 bg-[var(--secondary)]/30 border-b border-[var(--border)]">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <h1 className="text-[36px] lg:text-[48px] font-black leading-none tracking-tight">{t.contactPage.title}</h1>
              <p className="mt-3 opacity-60">{t.contactPage.subtitle}</p>
              <div className="mt-6 grid sm:grid-cols-2 gap-3">
                {[
                  { icon: MapPin, label: locale === "ar" ? siteConfig.address : siteConfig.addressEn },
                  { icon: Phone, label: siteConfig.phone },
                  { icon: Mail, label: siteConfig.email },
                  { icon: Clock, label: locale === "ar" ? siteConfig.hours : siteConfig.hoursEn },
                ].map((item) => (
                  <div key={item.label} className="flex gap-3 rounded-2xl bg-[var(--card)] border border-[var(--border)] p-4">
                    <item.icon className="h-5 w-5 text-[var(--accent)] flex-shrink-0" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </div>
                ))}
              </div>
              <a href={whatsappLink(siteConfig.whatsapp, locale === "ar" ? "مرحبا نخبة 👋" : "Hello Nukhba")} target="_blank" className="mt-6 inline-flex h-11 px-6 rounded-full bg-[#25D366] text-white font-bold items-center gap-2">
                <MessageCircle className="h-5 w-5" /> {locale === "ar" ? "تواصل واتساب مباشر" : "Direct WhatsApp"}
              </a>
            </div>

            <div className="rounded-[24px] overflow-hidden border border-[var(--border)] bg-[var(--card)] p-2">
              <div className="rounded-[18px] overflow-hidden aspect-[4/3] bg-[var(--secondary)] relative">
                <img src="https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80&auto=format&fit=crop" alt="Map" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                <div className="absolute bottom-4 start-4 end-4 bg-[var(--card)] rounded-2xl p-4 flex items-center gap-3 shadow-xl">
                  <div className="h-10 w-10 rounded-full bg-[var(--accent)] grid place-items-center">📍</div>
                  <div>
                    <div className="font-bold text-sm">Tripoli — Al Jumhouriya</div>
                    <div className="text-xs opacity-60">{locale === "ar" ? "مفتوح • رد سريع" : "Open • Fast reply"}</div>
                  </div>
                </div>
              </div>
              <div className="p-4 text-xs opacity-60 text-center">
                {locale === "ar" ? "استبدل الخريطة بـ Google Maps iframe بإحداثياتك" : "Replace with Google Maps iframe with your coords"}
              </div>
            </div>
          </div>
        </div>
      </section>

      <CTAForm />
    </div>
  );
}
