"use client";

import { LocalizedLink as Link } from "@/components/localized-link";
import { ArrowUpRight, Code2, Gamepad2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * L'offre est expliquée AVANT la bannière visuelle : un GROS titre visible
 * (compris en 5 secondes), le bouton WhatsApp vert en premier, puis les
 * deux chemins clairs, dans l'ordre voulu : la création de sites d'abord
 * (action principale), puis les produits numériques. Le bouton boutique
 * adopte la palette gaming (`data-universe-preview`).
 */
export function HomeIntro() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  return (
    <section className="home-intro site-container px-4 pb-6 pt-8 sm:px-6 lg:px-8 lg:pb-10 lg:pt-14">
      <div className="max-w-3xl">
        <p className="text-[13px] font-black uppercase tracking-[0.14em] text-[var(--accent)]">
          {ar ? "نخبة — خدمات رقمية" : "Nukhba — digital services"}
        </p>
        <h1 className="mt-3 text-[clamp(1.9rem,1.2rem+2.6vw,3.1rem)] font-black leading-[1.15] tracking-[-0.02em] text-balance">
          {ar
            ? "موقع احترافي لنشاطك، أو بطاقات وأكواد رقمية لألعابك."
            : "A professional website for your business, or digital cards and codes for your games."}
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-7 text-[var(--muted-foreground)]">
          {ar
            ? "مساران واضحان: أنشئ موقعك أو متجرك، أو اشترِ بطاقات الهدايا ومفاتيح الألعاب والشحن. أسعار واضحة وتفاصيل قبل الطلب."
            : "Two clear paths: build your website or store, or buy gift cards, game keys and top-ups. Clear pricing and details before you order."}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/creation-sites"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-6 text-[14px] font-bold text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
          >
            <Code2 className="h-4 w-4" aria-hidden="true" />
            {ar ? "أنشئ موقعك" : "Build your website"}
            <ArrowUpRight className="h-4 w-4 rtl:rotate-[-90deg]" aria-hidden="true" />
          </Link>
          <Link
            href="/codes"
            data-universe-preview="store"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-6 text-[14px] font-bold text-[var(--accent)] transition-colors hover:border-[var(--accent)]"
          >
            <Gamepad2 className="h-4 w-4" aria-hidden="true" />
            {ar ? "تصفح المنتجات الرقمية" : "Browse digital products"}
          </Link>
        </div>
      </div>
    </section>
  );
}
