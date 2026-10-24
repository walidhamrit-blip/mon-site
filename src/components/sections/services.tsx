"use client";
import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Check,
  LayoutGrid,
  MessageCircle,
  Palette,
  PenTool,
  Presentation,
  Rocket,
  Sparkles,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSectionHeading, useSiteConfig } from "@/components/site-provider";
import { SectionHeading } from "@/components/section-heading";
import { whatsappLink } from "@/lib/utils";
import { formatMainPrice } from "@/lib/installments";

/** Icônes disponibles pour les services libres (config : `standaloneServices`). */
const ICONS: Record<string, LucideIcon> = {
  Palette,
  LayoutGrid,
  Presentation,
  PenTool,
  Rocket,
  Wrench,
};

/**
 * Section « services libres » : petites missions à la carte, vendues au
 * forfait — restyliser un ancien site, ajouter une section, construire
 * des diapositives / présentations, design & identité, etc.
 */
export function Services() {
  const siteConfig = useSiteConfig();
  const heading = useSectionHeading("services");
  const { locale, t } = useI18n();
  const ar = locale === "ar";

  const [requested, setRequested] = useState<string | null>(null);
  const services = siteConfig.standaloneServices;

  const whatsappUrl = (serviceTitle: string) =>
    whatsappLink(
      siteConfig.whatsapp,
      ar
        ? `مرحبا ${siteConfig.nameAr} 👋 أريد طلب الخدمة: ${serviceTitle}`
        : `Hello ${siteConfig.name} 👋 I'd like to request this service: ${serviceTitle}`,
    );

  return (
    <section id="services" className="section">
      <div className="site-container px-4 sm:px-6 lg:px-8">
        <SectionHeading
          align="center"
          eyebrow={ar ? "خدمات مفتوحة" : "Open services"}
          title={heading.title}
          lead={heading.subtitle}
        />

        <div className="mx-auto mt-12 grid max-w-[1120px] gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service, idx) => {
            const Icon = ICONS[service.icon] ?? Sparkles;
            const title = ar ? service.titleAr : service.titleEn;
            return (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: (idx % 3) * 0.08 }}
                className="card-surface card-interactive relative flex flex-col p-6"
              >
                {"badgeAr" in service && service.badgeAr ? (
                  <div className="absolute -top-3 start-6 px-3 py-1 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] text-[10px] font-black shadow">
                    {ar ? service.badgeAr : service.badgeEn}
                  </div>
                ) : null}

                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--accent)]/12 text-[var(--accent)]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="text-end">
                    <div className="text-[10px] font-bold uppercase tracking-wider opacity-50">
                      {ar ? t.services.fromAr : t.services.fromEn}
                    </div>
                    <div className="text-[22px] font-black text-[var(--accent)] leading-none" dir="ltr">
                      {formatMainPrice(
                        service.priceFromUsd,
                        ar ? siteConfig.pricing.currency : siteConfig.pricing.currencyEn,
                      )}
                    </div>
                    <div className="text-[10px] opacity-50 mt-0.5" dir="ltr">
                      USD · = USDT
                    </div>
                  </div>
                </div>

                <h3 className="mt-4 text-lg font-black leading-snug">
                  <Link href={`/services/${service.id}`} className="hover:text-[var(--accent)] transition-colors">
                    {title}
                  </Link>
                </h3>
                <p className="mt-1.5 text-[13.5px] leading-6 text-[var(--muted-foreground)]">
                  {ar ? service.descAr : service.descEn}
                </p>
                <Link
                  href={`/services/${service.id}`}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[var(--accent)] hover:underline"
                >
                  {ar ? "تفاصيل الخدمة والأسعار" : "Service details & pricing"}
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>

                <ul className="mt-4 space-y-2">
                  {(ar ? service.featuresAr : service.featuresEn).map((f) => (
                    <li key={f} className="flex gap-2 text-[13px] leading-6 opacity-80">
                      <span className="mt-1 h-4 w-4 rounded-full bg-[var(--accent)] text-white grid place-items-center flex-shrink-0">
                        <Check className="h-2.5 w-2.5" />
                      </span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-5">
                  {requested === service.id ? (
                    <a
                      href={whatsappUrl(title)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-11 rounded-full bg-[#25D366] text-white font-bold text-sm inline-flex items-center justify-center gap-2 w-full hover:brightness-95 transition"
                    >
                      <MessageCircle className="h-4 w-4" />
                      {ar ? "أكمل الطلب عبر واتساب" : "Continue on WhatsApp"}
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setRequested(service.id)}
                      className="h-11 rounded-full border border-[var(--border)] font-bold text-sm inline-flex items-center justify-center gap-2 w-full hover:border-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors cursor-pointer"
                    >
                      {ar ? t.services.ctaAr : t.services.ctaEn}
                      <ArrowUpRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-10 max-w-[760px] mx-auto rounded-[20px] border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-start">
            <div className="flex items-center justify-center sm:justify-start gap-2 text-sm font-black">
              <Sparkles className="h-4 w-4 text-[var(--accent)]" />
              {ar ? t.services.customAr : t.services.customEn}
            </div>
            <p className="mt-1 text-xs opacity-60">
              {ar ? t.services.customCtaAr : t.services.customCtaEn}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href="/services"
              className="h-10 px-4 rounded-full border border-[var(--accent)]/40 text-xs font-black inline-flex items-center gap-1.5 hover:bg-[var(--accent)]/10 transition-colors"
            >
              {ar ? "كل الخدمات" : "All services"}
            </Link>
            <Link
              href="/contact"
              className="h-10 px-5 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] text-xs font-black inline-flex items-center gap-1.5 hover:bg-[var(--accent-hover)] transition-colors"
            >
              {ar ? "تواصل معنا" : "Contact us"}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
