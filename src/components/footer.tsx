"use client";
import Link from "next/link";
import { ArrowUpRight, Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSiteConfig } from "@/components/site-provider";
import { marketLabels, resolveMarket } from "@/lib/market";
import { whatsappLink } from "@/lib/utils";

/**
 * Pied de page.
 *
 * - La mention « الأسعار أمثلة قابلة للتعديل في ملف config.ts » a été
 *   retirée : c'était une note de développement visible par les clients.
 * - Hiérarchie clarifiée (marque + contact / navigation / services / CTA),
 *   icônes de contact réelles et réseaux sociaux en pastilles.
 */
export function Footer() {
  const siteConfig = useSiteConfig();
  const { locale, t } = useI18n();
  const ar = locale === "ar";
  // Libellés de lieu : ils suivent le marché configuré dans /admin.
  const market = resolveMarket(siteConfig.market);
  const marketText = marketLabels(market, locale);
  const withPlace = (text: string) =>
    text.replaceAll("{place}", marketText.place).replaceAll("{city}", marketText.city);

  // lucide v1 ne fournit plus les logos de marques : les réseaux sociaux
  // utilisent un monogramme typographique, cohérent avec l'identité du site.
  const socials = [
    { href: siteConfig.social.instagram, label: "Instagram", short: "IG" },
    { href: siteConfig.social.facebook, label: "Facebook", short: "FB" },
    { href: siteConfig.social.tiktok, label: "TikTok", short: "TT" },
    {
      href: whatsappLink(siteConfig.whatsapp, ar ? "مرحبا نخبة 👋" : "Hello Nukhba 👋"),
      label: "WhatsApp",
      short: "WA",
    },
  ];

  return (
    <footer className="relative overflow-hidden bg-[var(--primary)] text-[var(--primary-foreground)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 end-0 h-[380px] w-[380px] translate-x-1/3 rounded-full bg-[var(--accent)]/15 blur-[90px] rtl:-translate-x-1/3"
      />

      <div className="site-container relative px-4 sm:px-6 lg:px-8">
        {/* Bandeau d'appel à l'action */}
        <div className="flex flex-col gap-5 border-b border-white/10 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
              {ar ? "خطوتك التالية" : "Next step"}
            </p>
            <p className="mt-2 max-w-[46ch] text-[19px] font-black leading-snug tracking-tight sm:text-[22px]">
              {ar
                ? "موقعك الاحترافي جاهز خلال 7 أيام — ابدأ بمكالمة قصيرة."
                : "Your professional site in 7 days — start with a short call."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link
              href="/contact"
              className="inline-flex h-11 items-center gap-1.5 rounded-full bg-[var(--accent)] px-5 text-[13.5px] font-bold text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)]"
            >
              {ar ? "اطلب عرضاً مجانياً" : "Get a free quote"}
              <ArrowUpRight className="h-4 w-4" />
            </Link>
            <a
              href={whatsappLink(siteConfig.whatsapp, ar ? "مرحبا نخبة 👋" : "Hello Nukhba 👋")}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center gap-1.5 rounded-full border border-white/20 px-5 text-[13.5px] font-semibold transition-colors hover:bg-white/10"
            >
              WhatsApp
            </a>
          </div>
        </div>

        <div className="grid gap-9 py-12 lg:grid-cols-[1.35fr_0.8fr_0.8fr_1fr]">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-black font-black">
                {ar ? "ن" : "N"}
              </span>
              <div>
                <div className="font-black tracking-tight">NUKHBA · نخبة</div>
                <div className="text-[11.5px] opacity-60">
                  {marketText.city} · Premium Web Agency
                </div>
              </div>
            </div>
            <p className="mt-4 max-w-[38ch] text-[13px] leading-6 opacity-70">
              {withPlace(t.footer.desc)}
            </p>
            <div className="mt-5 flex gap-2">
              {socials.map(({ href, label, short }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  title={label}
                  className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-[11px] font-black tracking-wide transition-colors hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]"
                >
                  {short}
                </a>
              ))}
            </div>
          </div>

          <nav aria-label={ar ? "روابط الموقع" : "Site links"}>
            <div className="text-[12px] font-bold uppercase tracking-[0.14em] opacity-55">
              {t.footer.links}
            </div>
            <ul className="mt-4 space-y-2.5 text-[13px]">
              {[
                { href: "/", label: t.nav.home },
                { href: "/demos", label: t.nav.demos },
                { href: "/services", label: ar ? "الخدمات السريعة" : "Open services" },
                { href: "/compare", label: ar ? "المقارنات الصريحة" : "Comparisons" },
                { href: "/pricing", label: t.nav.pricing },
                { href: "/blog", label: ar ? "الأدلة والمقالات" : "Guides & blog" },
                { href: "/products", label: ar ? "منتجاتنا الرقمية" : "Digital products" },
                { href: "/codes", label: ar ? "الأكواد وبطاقات الهدايا" : "Codes & gift cards" },
                { href: "/apps", label: ar ? "تطبيقاتنا" : "Our apps" },
                { href: "/badge", label: ar ? "شارة نخبة" : "Client badge" },
                { href: "/contact", label: t.nav.contact },
                { href: "/conditions", label: ar ? "الشروط العامة للبيع" : "Terms & conditions of sale" },
                { href: "/remboursement", label: ar ? "سياسة الاسترداد" : "Refund policy" },
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="opacity-75 transition-opacity hover:opacity-100">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label={ar ? "خدماتنا" : "Our services"}>
            <div className="text-[12px] font-bold uppercase tracking-[0.14em] opacity-55">
              {t.footer.services}
            </div>
            <ul className="mt-4 space-y-2.5 text-[13px]">
              {siteConfig.standaloneServices.slice(0, 5).map((service) => (
                <li key={service.id}>
                  <Link
                    href={`/services/${service.id}`}
                    className="opacity-75 transition-opacity hover:opacity-100"
                  >
                    {ar ? service.titleAr : service.titleEn}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/services"
                  className="inline-flex items-center gap-1 font-bold text-[var(--accent)] hover:underline"
                >
                  {ar ? "كل الخدمات" : "All services"} <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </li>
            </ul>
          </nav>

          <div>
            <div className="text-[12px] font-bold uppercase tracking-[0.14em] opacity-55">
              {t.footer.contact}
            </div>
            <ul className="mt-4 space-y-3 text-[13px]">
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
                <span className="opacity-75">{ar ? siteConfig.address : siteConfig.addressEn}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                <a href={`tel:${siteConfig.phone.replace(/\s/g, "")}`} dir="ltr" className="opacity-75 hover:opacity-100">
                  {siteConfig.phone}
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                <a href={`mailto:${siteConfig.email}`} dir="ltr" className="opacity-75 hover:opacity-100">
                  {siteConfig.email}
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <MessageCircle className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                <a href={whatsappLink(siteConfig.whatsapp)} target="_blank" rel="noopener noreferrer" className="opacity-75 hover:opacity-100">
                  WhatsApp <span dir="ltr">{siteConfig.phone}</span>
                </a>
              </li>
              <li className="flex items-start gap-2.5">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
                <span className="opacity-75">{ar ? siteConfig.hours : siteConfig.hoursEn}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-3 border-t border-white/10 py-6 text-[11.5px] opacity-55 sm:flex-row">
          <span>{withPlace(t.footer.rights)}</span>
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
            {withPlace(t.footer.madeIn)}
          </span>
        </div>
      </div>
    </footer>
  );
}
