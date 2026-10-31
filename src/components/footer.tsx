"use client";

import Link from "next/link";
import { ArrowUpRight, Code2, Gamepad2, Mail, MapPin, Phone } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSiteConfig } from "./site-provider";
import { marketLabels, resolveMarket } from "@/lib/market";
import { whatsappLink } from "@/lib/utils";

export function Footer() {
  const config = useSiteConfig();
  const { locale } = useI18n();
  const ar = locale === "ar";
  const market = marketLabels(resolveMarket(config.market), locale);
  const groups = [
    { title: ar ? "المتجر الرقمي" : "Digital store", icon: Gamepad2, links: [
      ["/codes", ar ? "كل المنتجات" : "All products"],
      ["/codes?kind=gift_card", ar ? "بطاقات هدايا" : "Gift cards"],
      ["/codes?kind=software_key", ar ? "مفاتيح ألعاب وبرامج" : "Game & software keys"],
      ["/codes?kind=game_topup", ar ? "شحن الألعاب" : "Game top-ups"],
    ] },
    { title: ar ? "إنشاء المواقع" : "Website creation", icon: Code2, links: [
      ["/creation-sites", ar ? "ابدأ مشروعك" : "Start your project"],
      ["/demos", ar ? "نماذج المواقع" : "Website examples"],
      ["/pricing", ar ? "الباقات والأسعار" : "Plans & pricing"],
      ["/services", ar ? "خدمات حسب الطلب" : "Individual services"],
      ["/abonnements", ar ? "الصيانة والاشتراكات" : "Maintenance & subscriptions"],
      ["/sectors", ar ? "حلول حسب النشاط" : "Industry solutions"],
    ] },
  ];
  return <footer className="public-footer gaming-footer">
    <div className="site-container px-4 sm:px-6 lg:px-8">
      <div className="gaming-footer-cta">
        <div><p className="gaming-kicker">{ar ? "خطوتك التالية" : "YOUR NEXT MOVE"}</p><h2>{ar ? "عالمك الرقمي يبدأ هنا." : "Your digital world starts here."}</h2></div>
        <div className="flex flex-wrap gap-3"><Link href="/codes" className="vivid-button">{ar ? "اكتشف المتجر" : "Explore the store"}<ArrowUpRight className="h-4 w-4" /></Link><Link href="/creation-sites#lead-form" className="vivid-button is-secondary">{ar ? "أنشئ موقعك" : "Build your website"}</Link></div>
      </div>
      <div className="gaming-footer-grid">
        <div>
          <Link href="/" className="gaming-footer-brand"><span className="gaming-brand">{ar ? "ن" : "N"}</span><strong>{config.name}</strong></Link>
          <p className="mt-4 max-w-xs text-sm leading-7 text-[var(--muted-foreground)]">{ar ? "مواقع احترافية، بطاقات رقمية ومفاتيح ألعاب وشحن. مساران واضحان، وتجربة واحدة." : "Professional websites, digital cards, game keys and top-ups. Two clear paths. One digital experience."}</p>
          <p className="mt-4 flex items-center gap-2 text-xs text-[var(--muted-foreground)]"><MapPin className="h-4 w-4" />{market.place}</p>
        </div>
        {groups.map(({ title, icon: Icon, links }) => <nav key={title} aria-label={title}><h3><Icon className="h-4 w-4" />{title}</h3><ul>{links.map(([href, label]) => <li key={href}><Link href={href}>{label}</Link></li>)}</ul></nav>)}
        <nav aria-label={ar ? "الدعم" : "Support"}>
          <h3>{ar ? "لنتواصل" : "Let’s talk"}</h3>
          <ul>
            <li><Link href="/contact">{ar ? "مساعدة وتواصل" : "Help & contact"}</Link></li>
            <li><a href={whatsappLink(config.whatsapp)} target="_blank" rel="noopener noreferrer">WhatsApp ↗</a></li>
            <li><a href={`mailto:${config.email}`} className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /><span dir="ltr">{config.email}</span></a></li>
            <li><a href={`tel:${config.phone.replace(/\s/g, "")}`} className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /><span dir="ltr">{config.phone}</span></a></li>
          </ul>
        </nav>
      </div>
      <nav className="gaming-footer-resources" aria-label={ar ? "الموارد والمعلومات" : "Resources & information"}>
        {[["/blog",ar ? "الأدلة" : "Guides"],["/compare",ar ? "المقارنات" : "Comparisons"],["/products",ar ? "منتجاتنا" : "Our products"],["/apps",ar ? "تطبيقاتنا" : "Our apps"],["/badge",ar ? "شارة العملاء" : "Client badge"],["/conditions",ar ? "الشروط" : "Terms"],["/remboursement",ar ? "الاسترداد" : "Refund policy"]].map(([href,label]) => <Link key={href} href={href}>{label}</Link>)}
      </nav>
      <div className="gaming-footer-bottom"><span>© {new Date().getFullYear()} {config.name}</span><span>{ar ? "مواقع · بطاقات · ألعاب" : "WEBSITES / CARDS / GAMING"}</span></div>
    </div>
  </footer>;
}
