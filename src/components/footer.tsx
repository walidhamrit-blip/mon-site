"use client";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { useSiteConfig } from "@/components/site-provider";
import { MessageCircle } from "lucide-react";

export function Footer() {
  const siteConfig = useSiteConfig();
  const { locale, t } = useI18n();
  return (
    <footer className="bg-[var(--primary)] text-[var(--primary-foreground)]">
      <div className="site-container px-4 sm:px-6 lg:px-8">
        <div className="py-10 grid lg:grid-cols-[1.2fr_0.8fr_0.8fr_1fr] gap-8">
          <div>
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-white text-black grid place-items-center font-black">ن</div>
              <div>
                <div className="font-black">NUKHBA • نخبة</div>
                <div className="text-xs opacity-60">Tripoli • Premium Web Agency</div>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 opacity-70 max-w-[36ch]">{t.footer.desc}</p>
            <div className="mt-4 flex gap-2">
              <a href={siteConfig.social.instagram} target="_blank" className="h-9 w-9 rounded-full bg-white/10 grid place-items-center hover:bg-white/15 text-xs font-bold">IG</a>
              <a href={siteConfig.social.facebook} target="_blank" className="h-9 w-9 rounded-full bg-white/10 grid place-items-center hover:bg-white/15 text-xs font-bold">Fb</a>
              <a href={siteConfig.social.whatsapp} target="_blank" className="h-9 w-9 rounded-full bg-[#25D366] grid place-items-center text-white"><MessageCircle className="h-4 w-4" /></a>
            </div>
          </div>

          <div>
            <div className="font-bold text-sm tracking-wide opacity-90">{t.footer.links}</div>
            <ul className="mt-4 space-y-2 text-sm opacity-70">
              <li><Link href="/" className="hover:opacity-100 hover:underline">{t.nav.home}</Link></li>
              <li><Link href="/demos" className="hover:opacity-100 hover:underline">{t.nav.demos}</Link></li>
              <li><Link href="/pricing" className="hover:opacity-100 hover:underline">{t.nav.pricing}</Link></li>
              <li><Link href="/contact" className="hover:opacity-100 hover:underline">{t.nav.contact}</Link></li>
            </ul>
          </div>

          <div>
            <div className="font-bold text-sm tracking-wide opacity-90">{t.footer.services}</div>
            <ul className="mt-4 space-y-2 text-sm opacity-70">
              <li>{locale === "ar" ? "موقع واجهة" : "Vitrine site"}</li>
              <li>{locale === "ar" ? "متجر إلكتروني" : "E-commerce"}</li>
              <li>{locale === "ar" ? "حجز مواعيد" : "Booking"}</li>
              <li>{locale === "ar" ? "تحسين SEO" : "SEO"}</li>
            </ul>
          </div>

          <div>
            <div className="font-bold text-sm tracking-wide opacity-90">{t.footer.contact}</div>
            <ul className="mt-4 space-y-2 text-sm opacity-70">
              <li dir="ltr">{siteConfig.phone} • {siteConfig.email}</li>
              <li>{locale === "ar" ? siteConfig.address : siteConfig.addressEn}</li>
              <li>{locale === "ar" ? siteConfig.hours : siteConfig.hoursEn}</li>
            </ul>
            <div className="mt-4 text-xs opacity-50">
              {locale === "ar" ? "الأسعار أمثلة قابلة للتعديل في ملف config.ts" : "Prices are examples — edit in config.ts"}
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs opacity-60">
          <span>{t.footer.rights}</span>
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[var(--accent)] animate-pulse" />
            {t.footer.madeIn}
          </span>
        </div>
      </div>
    </footer>
  );
}
