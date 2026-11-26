"use client";

/**
 * « Continuer sur Telegram » — raccourci vers la boutique du bot, ouvert
 * directement sur le bon rayon (`t.me/<bot>?start=shop-ar-gift_card`).
 *
 *  - `TelegramShopStrip` : bandeau compact, visible dès le premier écran ;
 *  - `TelegramShopPanel` : présentation du bot (3 étapes + un lien par rayon) ;
 *  - `TelegramShopLink`  : lien nu (menu, sous-menu mobile).
 *
 * Rien n'est rendu si le bot n'est pas configuré (`TELEGRAM_BOT_USERNAME`
 * lu côté serveur puis passé en prop) : aucun lien mort.
 */
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import type { DigitalKind } from "@/lib/digital-types";
import { storeCategories } from "@/lib/site-hierarchy";
import { normalizeTelegramHandle, telegramShopUrl } from "@/lib/telegram-links";

type CtaKind = DigitalKind | "all" | null | undefined;

interface CtaProps {
  /** Nom du bot (`@NokhbaGamebot`), lu côté serveur. */
  bot?: string | null;
  ar: boolean;
  /** Rayon ciblé ; `all`/absent → racine de la boutique. */
  kind?: CtaKind;
  /** Emplacement, pour la mesure (`codes`, `category`, `nav`…). */
  source: string;
}

const categories = storeCategories.filter((category) => category.kind !== "all") as ReadonlyArray<{
  kind: DigitalKind;
  ar: string;
  en: string;
}>;

function concreteKind(kind: CtaKind): DigitalKind | null {
  return kind && kind !== "all" ? kind : null;
}

function categoryLabel(kind: CtaKind, ar: boolean): string {
  const match = categories.find((category) => category.kind === kind);
  if (match) return ar ? match.ar : match.en;
  return ar ? "المنتجات الرقمية" : "digital products";
}

export function TelegramIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className} fill="currentColor">
      <path d="M21.94 4.3a1.2 1.2 0 0 0-1.63-1.03L2.84 10.02c-1.12.44-1.1 2.03.03 2.43l4.39 1.55 1.7 5.33c.25.79 1.25 1.04 1.84.46l2.45-2.38 4.47 3.29c.73.54 1.78.14 1.97-.75L21.94 4.3Zm-4.17 3.26-7.75 7.03-.31 3.15-1.33-4.18 9.12-6.33c.18-.13.43.13.27.33Z" />
    </svg>
  );
}

export function TelegramShopLink({
  bot,
  ar,
  kind,
  source,
  className,
  children,
  label,
}: CtaProps & { className?: string; children: ReactNode; label?: string }) {
  const target = concreteKind(kind);
  const href = telegramShopUrl(bot, { kind: target, locale: ar ? "ar" : "en" });
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      data-telegram-cta={source}
      className={className}
      onClick={() => trackEvent({ name: "telegram_click", source, kind: target ?? "all" })}
    >
      {children}
    </a>
  );
}

/** Bandeau compact : une ligne, un bouton — le raccourci le plus visible. */
export function TelegramShopStrip({ bot, ar, kind, source }: CtaProps) {
  if (!normalizeTelegramHandle(bot)) return null;
  const label = categoryLabel(kind, ar);
  return (
    <aside className="tg-strip" aria-label={ar ? "المتابعة على تيليجرام" : "Continue on Telegram"}>
      <span className="tg-strip-icon"><TelegramIcon /></span>
      <p className="tg-strip-text">
        <strong>{ar ? `تفضّل تيليجرام؟ اطلب ${label} من بوت نخبة` : `Prefer Telegram? Order ${label} from the Nukhba bot`}</strong>
        <span>{ar ? "نفس المنتجات · الدفع داخل المحادثة · إشعار عند التسليم" : "Same products · pay in the chat · delivery alerts"}</span>
      </p>
      <TelegramShopLink bot={bot} ar={ar} kind={kind} source={source} className="tg-button">
        <TelegramIcon className="h-4 w-4" />
        {ar ? "تابع على تيليجرام" : "Continue on Telegram"}
        <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
      </TelegramShopLink>
    </aside>
  );
}

/** Présentation du bot : ce qu'on y fait, en 3 étapes, et un lien par rayon. */
export function TelegramShopPanel({ bot, ar, kind, source }: CtaProps) {
  const handle = normalizeTelegramHandle(bot);
  if (!handle) return null;
  const current = concreteKind(kind);
  const steps = ar
    ? [
        ["افتح البوت واختر القسم", "بطاقات هدايا، مفاتيح ألعاب وبرامج، شحن ألعاب أو اشتراكات."],
        ["اختر المنتج والقيمة وادفع", "نفس كتالوج الموقع، والدفع يتم من داخل المحادثة."],
        ["استلم الكود وتابع طلبك", "يصلك الكود على بريدك مع إشعار في تيليجرام، ودعم مباشر برسالة."],
      ]
    : [
        ["Open the bot and pick a category", "Gift cards, game & software keys, top-ups or subscriptions."],
        ["Choose the product, amount and pay", "Same catalogue as the website, paid right inside the chat."],
        ["Get your code and track the order", "Code by email plus a Telegram alert, and live support by message."],
      ];
  return (
    <section className="site-container px-4 py-10 sm:px-6 lg:px-8" aria-labelledby={`tg-panel-${source}`}>
      <div className="tg-panel">
        <div className="tg-panel-head">
          <span className="tg-panel-icon"><TelegramIcon className="h-7 w-7" /></span>
          <div>
            <p className="tg-panel-kicker">{ar ? "بوت نخبة على تيليجرام" : "Nukhba bot on Telegram"} · <span dir="ltr">@{handle}</span></p>
            <h2 id={`tg-panel-${source}`} className="tg-panel-title">
              {current
                ? ar ? `اطلب ${categoryLabel(current, ar)} من داخل تيليجرام` : `Order ${categoryLabel(current, ar).toLowerCase()} right inside Telegram`
                : ar ? "تسوّق المنتجات الرقمية من داخل تيليجرام" : "Shop digital products right inside Telegram"}
            </h2>
            <p className="tg-panel-lead">
              {ar
                ? "للتنقل الأسهل على الجوال: البوت يعرض نفس الأقسام والمنتجات، خطوة بخطوة، بدون تحميل صفحات."
                : "The easiest way on mobile: the bot shows the same categories and products, step by step, with no page loads."}
            </p>
          </div>
        </div>

        <ol className="tg-steps">
          {steps.map(([title, text], index) => (
            <li key={title}>
              <span className="tg-step-number" aria-hidden="true">{index + 1}</span>
              <div><strong>{title}</strong><p>{text}</p></div>
            </li>
          ))}
        </ol>

        <div className="tg-panel-actions">
          <TelegramShopLink bot={bot} ar={ar} kind={current} source={source} className="tg-button tg-button-lg">
            <TelegramIcon className="h-5 w-5" />
            {current
              ? ar ? `افتح ${categoryLabel(current, ar)} في تيليجرام` : `Open ${categoryLabel(current, ar).toLowerCase()} in Telegram`
              : ar ? "افتح بوت نخبة" : "Open the Nukhba bot"}
            <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
          </TelegramShopLink>
          <ul className="tg-chips" aria-label={ar ? "الأقسام على تيليجرام" : "Categories on Telegram"}>
            {categories.map((category) => (
              <li key={category.kind}>
                <TelegramShopLink
                  bot={bot}
                  ar={ar}
                  kind={category.kind}
                  source={`${source}-chip`}
                  className={`tg-chip${category.kind === current ? " is-current" : ""}`}
                  label={ar ? `${category.ar} على تيليجرام` : `${category.en} on Telegram`}
                >
                  <TelegramIcon className="h-3.5 w-3.5" />
                  {ar ? category.ar : category.en}
                </TelegramShopLink>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
