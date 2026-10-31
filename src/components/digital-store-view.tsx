"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { useSiteConfig } from "./site-provider";
import { EditorialVisual } from "./editorial-visual";
import { DigitalCatalog } from "./digital-catalog";
import { StoreUnavailableNotice } from "./store-status-notice";
import { storeCategories } from "@/lib/site-hierarchy";
import { storeFaqs } from "@/lib/digital-seo";
import { lowestPriceUsd, type DigitalKind, type DigitalProduct } from "@/lib/digital-types";

/** All visible shop copy follows the live locale, including maintenance. */
export function DigitalStoreView({ products, degraded, initialKind }: {
  products: DigitalProduct[];
  degraded: boolean;
  initialKind: DigitalKind | "all";
}) {
  const config = useSiteConfig();
  const { locale } = useI18n();
  const ar = locale === "ar";
  const faqs = storeFaqs(locale);
  const prices = products.map(lowestPriceUsd).filter((price): price is number => price != null);
  const cheapest = prices.length ? Math.min(...prices) : null;
  return <>
      {/*
        En-tête de rayon — volontairement compact : la vitrine s'organise
        comme celle du fournisseur (barre de filtres collante + rail de
        facettes + grille), donc le contenu marchand doit commencer dans le
        premier écran. Le titre et l'accroche restent complets pour le SEO.
      */}
      <section className="relative overflow-hidden border-b border-[var(--border)] bg-[var(--secondary)]/30">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-28 start-1/2 h-64 w-[560px] -translate-x-1/2 rounded-full opacity-20 blur-3xl rtl:translate-x-1/2"
          style={{ background: "var(--accent)" }}
        />
        <div className="site-container relative px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 pb-5 pt-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-[52rem]">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-[11px] font-black shadow-[var(--shadow-xs)]">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--accent)]" />
                <span className="text-[var(--accent)]">
                  {ar
                    ? "متجر رقمي عالمي — تسليم فوري"
                    : "Worldwide digital store"}
                </span>
              </div>

              <h1 className="mt-3 max-w-[28ch] text-[clamp(1.6rem,1.1rem+2vw,2.5rem)] font-black leading-[1.08] tracking-[-0.03em] text-balance">
                {ar ? "أكواد ألعاب وبرامج وبطاقات هدايا" : "Game keys, gift cards & digital codes"}
                <span className="text-[var(--accent)]"> {ar ? "— بأسعار واضحة" : "— made simple"}</span>
              </h1>

              <p className="mt-2.5 max-w-[68ch] text-[14px] leading-7 text-[var(--muted-foreground)]">
                {ar
                  ? "بطاقات هدايا Steam وPlayStation وXbox وNintendo وRoblox وGoogle Play وAmazon، أكواد ألعاب وبرامج (Minecraft، Red Dead Redemption 2) وشحن العملات داخل الألعاب. تحقّق من منطقة كل بطاقة قبل الطلب — التسليم الرقمي يصلك على بريدك الإلكتروني بعد تأكيد الدفع."
                  : "Steam, PlayStation, Xbox, Nintendo, Roblox, Google Play and Amazon gift cards, game keys and software (Minecraft, Red Dead Redemption 2), plus in-game top-ups. Check each card’s region before ordering — digital delivery is sent to your email after payment confirmation."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
              <span className="chip chip-accent">
                {degraded
                  ? ar
                    ? "صيانة مؤقتة"
                    : "Temporary maintenance"
                  : ar
                    ? `${products.length} منتجاً`
                    : `${products.length} products`}
              </span>
              <span className="chip">
                {ar ? "تسليم رقمي فوري" : "Digital delivery"}
              </span>
              {/*
                Pendant une panne, le prix « à partir de » proviendrait des
                fiches de démonstration : on n'annonce pas un tarif pour des
                produits qui ne peuvent pas être commandés.
              */}
              {!degraded && (
                <span className="chip">
                  {ar
                    ? cheapest != null
                      ? `تبدأ من ${cheapest.toFixed(2)} $`
                      : "أسعار بالدولار"
                    : cheapest != null
                      ? `From $${cheapest.toFixed(2)}`
                      : "USD pricing"}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="site-container px-4 py-6 sm:px-6 lg:px-8"><EditorialVisual kind="store" /></div>
      {degraded && (
        <StoreUnavailableNotice ar={ar} phone={config.phone} />
      )}

      {/*
        Pendant une panne de base, la grille n'est pas affichée : elle
        contiendrait les fiches de démonstration, présentées comme le
        catalogue réel — c'est exactement ce qui a trompé les visiteurs (et
        le sitemap) le 29/10/2026.
      */}
      <nav aria-label={ar ? "فئات المتجر" : "Store categories"} className="site-container flex flex-wrap gap-2 px-4 py-6 sm:px-6 lg:px-8">
        {storeCategories.map((category) => <Link key={category.kind} href={category.kind === "all" ? "/codes" : `/codes?kind=${category.kind}`} aria-current={initialKind === category.kind ? "page" : undefined} className={`rounded-full border px-4 py-2 text-sm font-bold ${initialKind === category.kind ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]" : "border-[var(--border)] bg-[var(--card)]"}`}>{ar ? category.ar : category.en}</Link>)}
      </nav>
      {!degraded && <DigitalCatalog key={initialKind} products={products} initialKind={initialKind} />}

      {/*
        Contenu de rayon : ces sections répondent aux questions réellement
        posées avant l'achat (région, livraison, authenticité, paiement).
        Elles rendent `/codes` utile pour l'internaute ET pour Google — un
        simple mur de cartes sans texte se classe mal sur les requêtes
        « acheter une carte Steam en Libye ».
      */}
      <section className="section-tight border-t border-[var(--border)]">
        <div className="site-container grid gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:px-8">
          <div>
            <h2 className="text-2xl font-black">
              {ar ? "كيف يعمل الشراء والتسليم؟" : "How buying and delivery work"}
            </h2>
            <ol className="mt-5 space-y-4">
              {(ar
                ? [
                    "اختر المنتج ثم المبلغ والمنطقة المناسبة لحسابك.",
                    "ادفع بالدولار أو USDT عبر NOWPayments — دون حساب على المتجر.",
                    "يصلك الكود على بريدك الإلكتروني بعد تأكيد الدفع مباشرة.",
                    "استخدم الكود في المتجر أو اللعبة الرسمية، واحتفظ برسالة الطلب.",
                  ]
                : [
                    "Choose the product, amount and the region that matches your account.",
                    "Pay in USD or USDT via NOWPayments — no store account needed.",
                    "Your code arrives by email right after payment confirmation.",
                    "Redeem it in the official store or game, and keep the order email.",
                  ]
              ).map((step, index) => (
                <li key={step} className="flex items-start gap-3 text-[14px] leading-7">
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--accent)]/15 text-[12px] font-black text-[var(--accent)]">
                    {index + 1}
                  </span>
                  <span className="opacity-85">{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-4 text-[13px] leading-6 text-[var(--muted-foreground)]">
              {ar
                ? "الأكواد تُشترى من الموزّع الرسمي عند الطلب. الأسعار بالدولار الأمريكي، و1 دولار = 1 USDT. البطاقات الإقليمية لا تُسترجع بعد التسليم — تحقّق من منطقة حسابك أولاً."
                : "Codes are purchased from the official distributor on demand. Prices are in USD, with 1 USD = 1 USDT. Region-locked cards cannot be refunded after delivery — check your account region first."}
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-black">
              {ar ? "أسئلة شائعة قبل الشراء" : "Questions before you buy"}
            </h2>
            <div className="mt-5 divide-y divide-[var(--border)] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)]">
              {faqs.map((faq) => (
                <details key={faq.q} className="group p-4">
                  <summary className="cursor-pointer list-none text-[14px] font-black leading-6 marker:hidden">
                    {faq.q}
                  </summary>
                  <p className="mt-2 text-[13px] leading-7 text-[var(--muted-foreground)]">
                    {faq.a}
                  </p>
                </details>
              ))}
            </div>
            <p className="mt-4 text-[12.5px] leading-6 text-[var(--muted-foreground)]">
              {ar ? "لم تجد إجابتك؟ " : "Still unsure? "}
              <Link href="/contact" className="font-bold text-[var(--accent)] underline-offset-4 hover:underline">
                {ar ? "تواصل معنا على واتساب" : "Talk to us on WhatsApp"}
              </Link>
            </p>
          </div>
        </div>
      </section>
  </>;
}
