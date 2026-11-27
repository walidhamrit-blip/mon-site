import { measureTelegram, traceTelegram, telegramServerTiming } from "@/lib/telegram-performance";
import type { Metadata, Viewport } from "next";
import { getPublicCatalogCached, getSiteDataCachedShared } from "@/lib/catalog-cache";
import { digitalCategories } from "@/lib/digital-categories";
import { sortByDemand } from "@/lib/digital-priority";
import { productVisual, productVisualFit } from "@/lib/game-covers";
import { localeFromSearchParams } from "@/lib/locale";
import type { LocalePageProps } from "@/lib/locale";
import { siteLocale } from "@/lib/seo";
import {
  buildMiniAppCategories,
  buildMiniAppProducts,
  type MiniAppSourceProduct,
} from "@/lib/telegram-mini-app-core";
import { TelegramMiniApp } from "./telegram-mini-app";

/**
 * Mini App Telegram (`/tg`) — vitrine visuelle ouverte depuis le bot.
 *
 * Hors du groupe `(site)` : pas de barre de navigation, de pied de page ni de
 * widgets flottants. Dans Telegram, la fenêtre a déjà son propre en-tête.
 * La page n'est pas indexée : c'est une vue d'application, pas une page SEO
 * (la vitrine indexable reste `/codes`).
 */
export const metadata: Metadata = {
  title: "Nukhba — Telegram Store",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

/** Même règle que `/codes` : jamais figée au build sur le catalogue de repli. */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function TelegramMiniAppPage({ searchParams }: LocalePageProps) {
  return traceTelegram("mini_app", async (trace) => {
    const page = await measureTelegram("page_data", () => renderMiniApp({ searchParams }));
    return <><meta name="nokhba-tg-server-timing" content={telegramServerTiming(trace)} />{page}</>;
  });
}

async function renderMiniApp({ searchParams }: LocalePageProps) {
  const [params, { config }, snapshot] = await Promise.all([
    searchParams,
    measureTelegram("site_settings", () => getSiteDataCachedShared()),
    measureTelegram("catalog_load", () => getPublicCatalogCached()),
  ]);
  const defaultLocale = siteLocale(config);
  const rawLang = params.lang;
  const explicitLang = typeof rawLang === "string" ? rawLang : null;
  const initialLocale = localeFromSearchParams(params, defaultLocale);

  const products = buildMiniAppProducts(
    sortByDemand(snapshot.products) as unknown as MiniAppSourceProduct[],
    (product) => {
      const source = product as Parameters<typeof productVisual>[0];
      return { src: productVisual(source), fit: productVisualFit(source) };
    },
  );
  const categories = buildMiniAppCategories(digitalCategories, products);

  return (
    <TelegramMiniApp
      siteName={config.name || "Nukhba"}
      products={products}
      categories={categories}
      defaultLocale={defaultLocale}
      initialLocale={initialLocale}
      explicitLocale={explicitLang}
      whatsapp={config.whatsapp || config.social?.whatsapp || null}
      degraded={snapshot.degraded}
    />
  );
}
