"use client";

import Link from "next/link";
import { ArrowUpRight, Code2, Gift, Gamepad2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/** Three real entry points, rather than the reference's demo cart/auth flows. */
export function HomeGateway() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const items = [
    { icon: Code2, href: "/creation-sites", title: ar ? "مواقع وبرامج حسب الطلب" : "Website creation", text: ar ? "مواقع احترافية ومتاجر إلكترونية وحلول تناسب نشاطك." : "Professional websites, online stores and solutions built for your business.", action: ar ? "اكتشف الخدمات" : "View website offers" },
    { icon: Gift, href: "/codes?kind=gift_card", title: ar ? "بطاقات هدايا وأكواد رقمية" : "Gift cards & digital codes", text: ar ? "تصفّح البطاقات وأكواد البرامج والألعاب المتاحة في متجرنا." : "Discover available gift cards, software codes and game keys in our store.", action: ar ? "تصفّح المتجر" : "Browse the store" },
    { icon: Gamepad2, href: "/codes?kind=game_topup", title: ar ? "شحن الألعاب" : "Game top-ups", text: ar ? "اختر لعبتك وقيمة الشحن وتابع طلبك من مكان واحد." : "Find your game, choose a top-up and follow your order in one place.", action: ar ? "اكتشف الشحن" : "Explore top-ups" },
  ];
  return (
    <section aria-label={ar ? "اختر ما تحتاجه" : "Choose what you need"} className="site-container relative z-10 px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-5 md:grid-cols-3">
        {items.map(({ icon: Icon, ...item }, i) => (
          <Link key={item.href} href={item.href} data-category={i} className="gateway-card group flex flex-col rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-7 shadow-[var(--shadow-sm)] transition-colors hover:border-[var(--accent)]">
            <div className="mb-6 flex items-center justify-between">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)]"><Icon className="h-7 w-7" /></span>
              <span aria-hidden="true" className="text-sm font-bold text-[var(--muted-foreground)]/50">0{i + 1}</span>
            </div>
            <h2 className="text-xl font-black">{item.title}</h2>
            <p className="mb-6 mt-3 text-sm leading-7 text-[var(--muted-foreground)]">{item.text}</p>
            <span className="mt-auto flex items-center gap-2 text-sm font-bold text-[var(--accent)]">{item.action}<ArrowUpRight className="h-4 w-4 rtl:rotate-[-90deg]" /></span>
          </Link>
        ))}
      </div>
    </section>
  );
}
