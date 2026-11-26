"use client";

import Image from "next/image";
import { imageOptimizationProps } from "@/lib/image-source";
import { LocalizedLink as Link } from "@/components/localized-link";
import { ArrowUpRight, Code2, Gamepad2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSiteContent } from "@/components/site-provider";
import { trackEvent } from "@/lib/analytics";

/**
 * Deux portes, deux univers (src/lib/universes.ts) : chaque carte adopte déjà
 * l'identité de l'univers vers lequel elle mène (`data-universe-preview`) —
 * sobre pour le studio web, gaming pour la boutique. Le visiteur sait où il
 * va avant de cliquer, et l'agence n'est jamais confondue avec la boutique.
 */
export function HomeGateway() {
  const { locale } = useI18n();
  const { visuals } = useSiteContent();
  const ar = locale === "ar";
  const doors = [
    {
      universe: "studio",
      icon: Code2,
      href: "/creation-sites",
      badge: ar ? "استوديو نخبة" : "Nukhba Studio",
      title: ar ? "مواقع ومتاجر وتطبيقات لنشاطك" : "Websites, stores & apps for your business",
      text: ar
        ? "موقع احترافي أو متجر إلكتروني أو تطبيق، من الفكرة إلى الإطلاق: نطاق واضح، أسعار معلنة ومتابعة بعد التسليم."
        : "A professional website, online store or app, from concept to launch: clear scope, published pricing and support after delivery.",
      points: ar ? ["نماذج حقيقية", "أسعار معلنة", "عرض سعر مجاني"] : ["Real examples", "Published pricing", "Free quote"],
      action: ar ? "اكتشف الاستوديو" : "Visit the studio",
      visuals: [{ visual: visuals.gatewayWebsites, alt: ar ? "إنشاء المواقع والمتاجر" : "Websites & online stores" }],
    },
    {
      universe: "store",
      icon: Gamepad2,
      href: "/codes",
      badge: ar ? "متجر نخبة" : "Nukhba Store",
      title: ar ? "بطاقات هدايا، مفاتيح ألعاب وشحن" : "Gift cards, game keys & top-ups",
      text: ar
        ? "Steam وPlayStation وXbox وRoblox وغيرها. راجع المنصة والمنطقة والقيمة في صفحة المنتج، والتسليم إلكتروني."
        : "Steam, PlayStation, Xbox, Roblox and more. Check platform, region and value on the product page; delivery is electronic.",
      points: ar ? ["بطاقات هدايا", "مفاتيح ألعاب", "شحن الألعاب"] : ["Gift cards", "Game keys", "Game top-ups"],
      action: ar ? "ادخل المتجر" : "Enter the store",
      visuals: [
        { visual: visuals.gatewayGiftCards, alt: ar ? "بطاقات هدايا ومفاتيح" : "Gift cards & digital keys" },
        { visual: visuals.gatewayTopUps, alt: ar ? "شحن الألعاب" : "Game top-ups" },
      ],
    },
  ] as const;
  return (
    <section aria-label={ar ? "اختر ما تحتاجه" : "Choose what you need"} className="home-gateway site-container relative z-10 px-4 sm:px-6 lg:px-8">
      <div className="grid gap-5 md:grid-cols-2">
        {doors.map(({ icon: Icon, ...door }, i) => (
          <Link
            key={door.href}
            href={door.href}
            data-universe-preview={door.universe}
            data-category={i}
            onClick={() => trackEvent({ name: "gateway_click", path: door.href })}
            className="universe-door group"
          >
            <div className={`universe-door-art${door.visuals.length > 1 ? " is-split" : ""}`}>
              {door.visuals.map((item, index) => (
                <Image
                  key={item.visual.src}
                  src={item.visual.src}
                  alt={ar ? item.visual.altAr || item.alt : item.visual.altEn || item.alt}
                  width={760}
                  height={440}
                  sizes={door.visuals.length > 1 ? "(max-width: 768px) 45vw, 300px" : "(max-width: 768px) 90vw, 600px"}
                  loading={i === 0 && index === 0 ? "eager" : "lazy"}
                  fetchPriority={i === 0 && index === 0 ? "high" : "auto"}
                  className="h-full w-full object-cover object-top"
                  {...imageOptimizationProps(item.visual.src)}
                />
              ))}
              <span className="universe-door-badge"><Icon className="h-4 w-4" aria-hidden="true" />{door.badge}</span>
            </div>
            <div className="universe-door-body">
              <h2 className="font-extrabold">{door.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">{door.text}</p>
              <ul className="universe-door-points mb-6">
                {door.points.map((point) => <li key={point}>{point}</li>)}
              </ul>
              <span className="universe-door-action">{door.action}<ArrowUpRight className="h-4 w-4 rtl:rotate-[-90deg]" aria-hidden="true" /></span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
