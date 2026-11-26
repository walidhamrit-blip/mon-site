"use client";

import Image from "next/image";
import { imageOptimizationProps } from "@/lib/image-source";
import { LocalizedLink as Link } from "@/components/localized-link";
import { ArrowUpRight, Code2, Gamepad2, Smartphone } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSiteContent } from "@/components/site-provider";
import { trackEvent } from "@/lib/analytics";
import { primaryNavigation } from "@/lib/site-hierarchy";

type DoorVisual = { visual: { src: string; altAr?: string; altEn?: string }; alt: string };

/**
 * Trois portes, dans l'ordre de lecture voulu (src/lib/site-hierarchy.ts) :
 * 1. les sites (cœur de l'agence), 2. les applications (bientôt),
 * 3. les produits numériques — une catégorie dont les rayons (cartes, clés,
 * recharges, abonnements) sont liés directement.
 *
 * Chaque carte adopte déjà l'identité de l'univers vers lequel elle mène
 * (`data-universe-preview`) : sobre pour le studio, gaming pour la boutique.
 * Le titre porte le lien principal (étendu à toute la carte) ; les rayons de
 * la boutique sont de vrais liens distincts, sans liens imbriqués.
 */
export function HomeGateway() {
  const { locale } = useI18n();
  const { visuals } = useSiteContent();
  const ar = locale === "ar";
  const productCategories = primaryNavigation.find((item) => item.href === "/codes")?.children ?? [];
  const doors: {
    universe: "studio" | "store";
    icon: typeof Code2;
    href: string;
    badge: string;
    soon?: boolean;
    title: string;
    text: string;
    points: readonly string[];
    links?: readonly { href: string; label: string }[];
    action: string;
    visuals: readonly DoorVisual[];
  }[] = [
    {
      universe: "studio",
      icon: Code2,
      href: "/creation-sites",
      badge: ar ? "استوديو نخبة" : "Nukhba Studio",
      title: ar ? "مواقع ومتاجر إلكترونية لنشاطك" : "Websites & online stores for your business",
      text: ar
        ? "موقع احترافي أو متجر إلكتروني، من الفكرة إلى الإطلاق: نطاق واضح، أسعار معلنة ومتابعة بعد التسليم."
        : "A professional website or online store, from concept to launch: clear scope, published pricing and support after delivery.",
      points: ar ? ["نماذج حقيقية", "أسعار معلنة", "عرض سعر مجاني"] : ["Real examples", "Published pricing", "Free quote"],
      action: ar ? "اكتشف عروض المواقع" : "Explore website offers",
      visuals: [{ visual: visuals.gatewayWebsites, alt: ar ? "إنشاء المواقع والمتاجر" : "Websites & online stores" }],
    },
    {
      universe: "studio",
      icon: Smartphone,
      href: "/apps",
      badge: ar ? "تطبيقات نخبة" : "Nukhba Apps",
      soon: true,
      title: ar ? "تطبيقات الجوال والويب" : "Mobile & web apps",
      text: ar
        ? "تطبيقات للمتاجر والعيادات والمطاعم على iOS وAndroid والويب، قيد التحضير. اطّلع على ما نعدّه وسجّل اهتمامك."
        : "Apps for shops, clinics and restaurants on iOS, Android and the web, in preparation. See what we are building and register your interest.",
      points: ar ? ["iOS وAndroid", "تطبيقات ويب", "إطلاق قريب"] : ["iOS & Android", "Web apps", "Launching soon"],
      action: ar ? "اكتشف التطبيقات القادمة" : "See upcoming apps",
      // Visuels locaux (captures mobiles) : aucune dépendance à un hôte externe.
      visuals: [
        { visual: { src: "/previews/al-bay-family-restaurant-mobile.webp" }, alt: ar ? "واجهة تطبيق مطعم على الجوال" : "Restaurant app on mobile" },
        { visual: { src: "/previews/hala-perfumes-mobile.webp" }, alt: ar ? "واجهة متجر على الجوال" : "Store app on mobile" },
      ],
    },
    {
      universe: "store",
      icon: Gamepad2,
      href: "/codes",
      badge: ar ? "المنتجات الرقمية" : "Digital products",
      title: ar ? "بطاقات هدايا، مفاتيح ألعاب وشحن" : "Gift cards, game keys & top-ups",
      text: ar
        ? "Steam وPlayStation وXbox وRoblox وغيرها. راجع المنصة والمنطقة والقيمة في صفحة المنتج، والتسليم إلكتروني."
        : "Steam, PlayStation, Xbox, Roblox and more. Check platform, region and value on the product page; delivery is electronic.",
      points: [],
      links: productCategories.map((category) => ({ href: category.href, label: ar ? category.ar : category.en })),
      action: ar ? "كل المنتجات الرقمية" : "All digital products",
      visuals: [
        { visual: visuals.gatewayGiftCards, alt: ar ? "بطاقات هدايا ومفاتيح" : "Gift cards & digital keys" },
        { visual: visuals.gatewayTopUps, alt: ar ? "شحن الألعاب" : "Game top-ups" },
      ],
    },
  ];
  return (
    <section aria-label={ar ? "اختر ما تحتاجه" : "Choose what you need"} className="home-gateway site-container relative z-10 px-4 sm:px-6 lg:px-8">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {doors.map(({ icon: Icon, ...door }, i) => (
          <article key={door.href} data-universe-preview={door.universe} data-category={i} className="universe-door group relative">
            <div className={`universe-door-art${door.visuals.length > 1 ? " is-split" : ""}`}>
              {door.visuals.map((item, index) => (
                <Image
                  key={item.visual.src}
                  src={item.visual.src}
                  alt={ar ? item.visual.altAr || item.alt : item.visual.altEn || item.alt}
                  width={760}
                  height={440}
                  sizes={door.visuals.length > 1 ? "(max-width: 768px) 45vw, 220px" : "(max-width: 768px) 90vw, 440px"}
                  loading={i === 0 && index === 0 ? "eager" : "lazy"}
                  fetchPriority={i === 0 && index === 0 ? "high" : "auto"}
                  className={`h-full w-full object-cover object-top${door.soon ? " universe-door-soon-art" : ""}`}
                  {...imageOptimizationProps(item.visual.src)}
                />
              ))}
              <span className="universe-door-badge"><Icon className="h-4 w-4" aria-hidden="true" />{door.badge}</span>
              {door.soon ? <span className="universe-door-soon">{ar ? "قريباً" : "Coming soon"}</span> : null}
            </div>
            <div className="universe-door-body">
              <h2 className="font-extrabold">
                <Link
                  href={door.href}
                  onClick={() => trackEvent({ name: "gateway_click", path: door.href })}
                  className="universe-door-link"
                >
                  {door.title}
                </Link>
              </h2>
              <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">{door.text}</p>
              {door.links && door.links.length > 0 ? (
                <ul className="universe-door-points is-links mb-6">
                  {door.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} onClick={() => trackEvent({ name: "gateway_click", path: link.href })}>{link.label}</Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="universe-door-points mb-6">
                  {door.points.map((point) => <li key={point}>{point}</li>)}
                </ul>
              )}
              <span className="universe-door-action" aria-hidden="true">{door.action}<ArrowUpRight className="h-4 w-4 rtl:rotate-[-90deg]" /></span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
