"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Code2, Gift, Gamepad2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function HomeGateway() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const items = [
    { icon: Code2, src: "/previews/al-manhaj-company-desktop.webp", href: "/creation-sites", title: ar ? "إنشاء المواقع والمتاجر" : "Websites & online stores", text: ar ? "موقع احترافي أو متجر إلكتروني مصمم لنشاطك، من الفكرة إلى الإطلاق." : "A professional website or online store for your business, from concept to launch.", action: ar ? "اكتشف العروض" : "Explore website offers" },
    { icon: Gift, src: "/digital-products/steam-wallet.jpg", href: "/codes?kind=gift_card", title: ar ? "بطاقات هدايا ومفاتيح" : "Gift cards & digital keys", text: ar ? "استكشف البطاقات ومفاتيح الألعاب والبرامج. تحقق من المنطقة والتوفر قبل الطلب." : "Explore gift cards, game and software keys. Check region and availability before ordering.", action: ar ? "استكشف البطاقات" : "Explore digital cards" },
    { icon: Gamepad2, src: "/visuals/digital-universe.webp", href: "/codes?kind=game_topup", title: ar ? "شحن الألعاب" : "Game top-ups", text: ar ? "اختر لعبتك والمبلغ المناسب، وراجع تفاصيل الشحن في صفحة المنتج." : "Choose your game and amount, then review top-up details on the product page.", action: ar ? "اختر لعبتك" : "Find your game" },
  ];
  return (
    <section aria-label={ar ? "اختر ما تحتاجه" : "Choose what you need"} className="home-gateway site-container relative z-10 px-4 sm:px-6 lg:px-8">
      <div className="grid gap-5 md:grid-cols-3">
        {items.map(({ icon: Icon, ...item }, i) => (
          <Link key={item.href} href={item.href} data-category={i} className="gateway-card group flex flex-col rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6">
            <div className="gateway-art">
              <Image src={item.src} alt={item.title} fill sizes="(max-width: 768px) 85vw, 380px" className="object-cover object-top" />
              <span className="gateway-art-icon"><Icon className="h-5 w-5" /></span>
            </div>
            <p className="gaming-card-index" aria-hidden="true">0{i + 1} / {ar ? "اختر مسارك" : "CHOOSE YOUR PATH"}</p>
            <h2 className="mt-3 text-xl font-extrabold">{item.title}</h2>
            <p className="mb-6 mt-3 text-sm leading-7 text-[var(--muted-foreground)]">{item.text}</p>
            <span className="gateway-action mt-auto flex items-center justify-center gap-2 text-sm font-bold">{item.action}<ArrowUpRight className="h-4 w-4 rtl:rotate-[-90deg]" /></span>
          </Link>
        ))}
      </div>
    </section>
  );
}
