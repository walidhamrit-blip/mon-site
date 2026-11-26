"use client";

import { LocalizedLink as Link } from "@/components/localized-link";
import { ArrowUpRight, BookOpen, Code2, Gamepad2, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSiteConfig } from "./site-provider";
import { marketLabels, resolveMarket } from "@/lib/market";
import { WhatsAppEnquiry } from "@/components/whatsapp-enquiry";
import { useUniverse } from "@/components/universe-shell";
import { universeBrands, type Universe } from "@/lib/universes";

type FooterLink = readonly [href: string, label: string];
type FooterGroup = { title: string; icon: typeof Gamepad2; links: readonly FooterLink[] };

/**
 * Contenu du pied de page propre à chaque univers. La boutique ne pousse pas
 * la création de sites (et inversement) : seul le bandeau du bas rappelle,
 * discrètement, l'autre service Nukhba.
 */
function footerContent(universe: Universe, ar: boolean) {
  const storeGroup: FooterGroup = { title: ar ? "المنتجات الرقمية" : "Digital products", icon: Gamepad2, links: [
    ["/codes", ar ? "كل المنتجات" : "All products"],
    ["/codes/category/gift_card", ar ? "بطاقات هدايا" : "Gift cards"],
    ["/codes/category/software_key", ar ? "مفاتيح ألعاب وبرامج" : "Game & software keys"],
    ["/codes/category/game_topup", ar ? "شحن الألعاب" : "Game top-ups"],
    ["/codes/category/subscription_code", ar ? "اشتراكات" : "Subscriptions"],
  ] };
  const studioGroup: FooterGroup = { title: ar ? "إنشاء المواقع" : "Website creation", icon: Code2, links: [
    ["/creation-sites", ar ? "ابدأ مشروعك" : "Start your project"],
    ["/apps", ar ? "التطبيقات (قريباً)" : "Apps (coming soon)"],
    ["/demos", ar ? "نماذج المواقع" : "Website examples"],
    ["/pricing", ar ? "الباقات والأسعار" : "Plans & pricing"],
    ["/services", ar ? "خدمات حسب الطلب" : "Individual services"],
    ["/abonnements", ar ? "الصيانة والاشتراكات" : "Maintenance & subscriptions"],
    ["/sectors", ar ? "حلول حسب النشاط" : "Industry solutions"],
  ] };
  const orderHelpGroup: FooterGroup = { title: ar ? "مساعدة الطلب" : "Order help", icon: ShieldCheck, links: [
    ["/codes/commande", ar ? "تتبع طلبي" : "Track my order"],
    ["/remboursement", ar ? "سياسة الاسترداد" : "Refund policy"],
    ["/conditions", ar ? "شروط البيع" : "Terms of sale"],
    ["/avis", ar ? "تقييمات العملاء" : "Customer reviews"],
  ] };
  const studioResourcesGroup: FooterGroup = { title: ar ? "موارد" : "Resources", icon: BookOpen, links: [
    ["/blog", ar ? "الأدلة" : "Guides"],
    ["/compare", ar ? "المقارنات" : "Comparisons"],
    ["/products", ar ? "منتجاتنا" : "Our products"],
    ["/badge", ar ? "شارة العملاء" : "Client badge"],
  ] };
  const legal: FooterLink[] = [
    ["/conditions", ar ? "الشروط" : "Terms"],
    ["/remboursement", ar ? "الاسترداد" : "Refund policy"],
    ["/avis", ar ? "تقييمات العملاء" : "Customer reviews"],
    ["/mentions-legales", ar ? "المعلومات القانونية" : "Legal notice"],
  ];

  if (universe === "store") {
    return {
      kicker: ar ? "متجر نخبة" : "NUKHBA STORE",
      heading: ar ? "بطاقتك أو مفتاح لعبتك، خلال دقائق." : "Your card or game key, in minutes.",
      actions: [["/codes", ar ? "تصفح المتجر" : "Browse the store"], ["/codes/commande", ar ? "تتبع طلبي" : "Track my order"]] as FooterLink[],
      about: ar ? "بطاقات هدايا، مفاتيح ألعاب وبرامج، شحن واشتراكات. راجع المنصة والمنطقة قبل الطلب، والتسليم إلكتروني." : "Gift cards, game and software keys, top-ups and subscriptions. Check platform and region before ordering; delivery is electronic.",
      groups: [storeGroup, orderHelpGroup],
      resources: legal,
      motto: ar ? "بطاقات · مفاتيح · شحن" : "CARDS / KEYS / TOP-UPS",
      sibling: ["/creation-sites", ar ? "مواقع وتطبيقات" : "Websites & apps"] as FooterLink,
    };
  }
  if (universe === "studio") {
    return {
      kicker: ar ? "استوديو نخبة" : "NUKHBA STUDIO",
      heading: ar ? "لنبنِ موقعك أو تطبيقك القادم." : "Let’s build your next website or app.",
      actions: [["/creation-sites#lead-form", ar ? "اطلب عرض سعر" : "Request a quote"], ["/demos", ar ? "شاهد النماذج" : "See examples"]] as FooterLink[],
      about: ar ? "مواقع ومتاجر إلكترونية وتطبيقات حسب الطلب: نطاق واضح، أسعار معلنة، ومتابعة بعد الإطلاق." : "Custom websites, online stores and apps: clear scope, published pricing and support after launch.",
      groups: [studioGroup, studioResourcesGroup],
      resources: legal,
      motto: ar ? "تصميم · تطوير · إطلاق" : "DESIGN / BUILD / LAUNCH",
      sibling: ["/codes", ar ? "المنتجات الرقمية" : "Digital products"] as FooterLink,
    };
  }
  return {
    kicker: ar ? "خطوتك التالية" : "YOUR NEXT MOVE",
    heading: ar ? "اختر مسارك: مشروع موقع أو منتجات رقمية." : "Choose your path: website project or digital products.",
    actions: [["/creation-sites#lead-form", ar ? "أنشئ موقعك" : "Build your website"], ["/codes", ar ? "تصفح المنتجات الرقمية" : "Browse digital products"]] as FooterLink[],
    about: ar ? "خدمتان مستقلتان تحت علامة واحدة: استوديو لإنشاء المواقع والتطبيقات، ومتجر للبطاقات الرقمية ومفاتيح الألعاب." : "Two independent services under one brand: a studio for websites and apps, and a store for digital cards and game keys.",
    // Même ordre que le menu : sites et applications, puis produits numériques.
    groups: [studioGroup, storeGroup],
    resources: [...studioResourcesGroup.links, ...legal],
    motto: ar ? "مواقع · تطبيقات · منتجات رقمية" : "WEBSITES / APPS / DIGITAL PRODUCTS",
    sibling: null,
  };
}

/**
 * Lien vers le bot Telegram public.
 *
 * L'identifiant est fourni par le layout serveur depuis
 * `TELEGRAM_BOT_USERNAME` — surtout PAS via une variable `NEXT_PUBLIC_*`
 * (Vercel affiche un avertissement « Keep This Value Private » pour tout
 * préfixe public, et un futur jeton collé dans une telle variable fuiterait
 * dans le bundle navigateur). Un @username Telegram est public, mais on ne
 * laisse au navigateur que ce strict nécessaire, validé au passage.
 */
function telegramUrlFrom(handle: string | undefined): string {
  const clean = (handle ?? "").trim().replace(/^@/, "");
  return /^[A-Za-z0-9_]{4,32}$/.test(clean) ? `https://t.me/${clean}` : "";
}

export function Footer({ telegramBot, year }: { telegramBot?: string; year: number }) {
  const telegramUrl = telegramUrlFrom(telegramBot);
  const config = useSiteConfig();
  const { locale } = useI18n();
  const universe = useUniverse();
  const ar = locale === "ar";
  const market = marketLabels(resolveMarket(config.market), locale);
  const brand = universeBrands[universe];
  const content = footerContent(universe, ar);
  const brandName = universe === "hub" ? config.name : ar ? brand.nameAr : brand.nameEn;
  return <footer className="public-footer gaming-footer">
    <div className="site-container px-4 sm:px-6 lg:px-8">
      <div className="gaming-footer-cta">
        <div><p className="gaming-kicker">{content.kicker}</p><h2>{content.heading}</h2></div>
        <div className="flex flex-wrap gap-3">{content.actions.map(([href, label], index) => <Link key={href} href={href} className={index === 0 ? "vivid-button" : "vivid-button is-secondary"}>{label}{index === 0 ? <ArrowUpRight className="h-4 w-4" aria-hidden="true" /> : null}</Link>)}</div>
      </div>
      <div className="gaming-footer-grid">
        <div>
          <Link href={brand.home} className="gaming-footer-brand"><span className="gaming-brand">{ar ? "ن" : "N"}</span><strong>{brandName}</strong></Link>
          <p className="mt-4 max-w-xs text-sm leading-7 text-[var(--muted-foreground)]">{content.about}</p>
          <p className="mt-4 flex items-center gap-2 text-xs text-[var(--muted-foreground)]"><MapPin className="h-4 w-4" aria-hidden="true" />{market.place}</p>
        </div>
        {content.groups.map(({ title, icon: Icon, links }) => <nav key={title} aria-label={title}><h3><Icon className="h-4 w-4" aria-hidden="true" />{title}</h3><ul>{links.map(([href, label]) => <li key={href}><Link href={href}>{label}</Link></li>)}</ul></nav>)}
        <nav aria-label={ar ? "الدعم" : "Support"}>
          <h3>{ar ? "لنتواصل" : "Let’s talk"}</h3>
          <ul>
            <li><Link href="/contact">{ar ? "مساعدة وتواصل" : "Help & contact"}</Link></li>
            <li><WhatsAppEnquiry className="cursor-pointer" source="footer"><span>WhatsApp</span><ArrowUpRight aria-hidden="true" className="h-4 w-4" /></WhatsAppEnquiry></li>
            {telegramUrl ? <li><a href={telegramUrl} target="_blank" rel="noopener noreferrer"><span>Telegram</span><ArrowUpRight aria-hidden="true" className="h-4 w-4" /></a></li> : null}
            <li><a href={`mailto:${config.email}`} className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" aria-hidden="true" /><span dir="ltr">{config.email}</span></a></li>
            <li><a href={`tel:${config.phone.replace(/\s/g, "")}`} className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" aria-hidden="true" /><span dir="ltr">{config.phone}</span></a></li>
          </ul>
        </nav>
      </div>
      <nav className="gaming-footer-resources" aria-label={ar ? "الموارد والمعلومات" : "Resources & information"}>
        {content.resources.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
      </nav>
      <div className="gaming-footer-bottom">
        <span>© {year} {config.name}{universe === "hub" ? null : <> · {ar ? "إحدى خدمات نخبة" : "A Nukhba service"}</>}</span>
        {content.sibling ? (
          <span className="universe-sibling">{ar ? "أيضاً من نخبة:" : "Also by Nukhba:"} <Link href={content.sibling[0]} className="underline underline-offset-4">{content.sibling[1]}</Link></span>
        ) : <span>{content.motto}</span>}
      </div>
    </div>
  </footer>;
}
