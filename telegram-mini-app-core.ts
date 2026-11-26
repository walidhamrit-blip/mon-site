/**
 * Mini App Telegram : vitrine visuelle du catalogue, ouverte depuis le bot.
 *
 * Le clavier inline du bot (`/shop`) ne peut afficher que du texte : aucun
 * bouton Telegram ne peut porter une image. La Mini App (`/tg`) comble ce
 * manque : grille de photos par famille, recherche, filtres par marque et
 * jaquettes produits, le tout dans une fenêtre Telegram plein écran.
 *
 * Choix structurants :
 *  - **Même catalogue que le site** : la page lit `getPublicCatalogCached()`.
 *    Aucun produit n'est inventé et aucun prix n'est recalculé ici.
 *  - **Même caisse que le site** : un appui sur un produit ouvre sa fiche
 *    `/codes/<slug>`. Montants, champs acheteur (identifiant joueur…), tous
 *    les moyens de paiement et le recalcul serveur du prix y vivent déjà.
 *    La Mini App ne crée donc aucune commande et ne manipule aucun secret.
 *  - **Charge utile légère** : seuls les champs affichés quittent le serveur
 *    (pas de descriptions, pas de champs internes fournisseur).
 *
 * Module PUR (aucun import Node/Next) : importable par la page serveur, par
 * le composant client et par un test `node --test`.
 */

import type { DigitalKind } from "./digital-types";

/** Chemin public de la Mini App (déclaré dans BotFather / `setChatMenuButton`). */
export const TELEGRAM_MINI_APP_PATH = "/tg";

/** Origines autorisées à embarquer la Mini App (client Telegram Web). */
export const TELEGRAM_MINI_APP_FRAME_ANCESTORS = [
  "https://web.telegram.org",
  "https://*.telegram.org",
] as const;

/** Script officiel du SDK Telegram Web Apps. */
export const TELEGRAM_WEB_APP_SCRIPT = "https://telegram.org/js/telegram-web-app.js";

export type MiniAppLocale = "ar" | "en";

/** Photo et libellés d'une famille du catalogue. */
export interface MiniAppCategory {
  kind: DigitalKind;
  ar: string;
  en: string;
  /** Visuel local (`public/telegram-mini-app/*.webp`, 400×400). */
  image: string;
  count: number;
}

/** Ce que la grille affiche d'un produit, rien de plus. */
export interface MiniAppProduct {
  slug: string;
  kind: DigitalKind;
  platform: string;
  titleAr: string;
  titleEn: string;
  /** Prix « à partir de » en USD (déjà aligné côté serveur). */
  fromUsd: number;
  /** Jaquette ou visuel admin, `null` = visuel de repli dégradé + initiales. */
  image: string | null;
  /** `cover` = jaquette locale 2:3 plein cadre ; `contain` = visuel admin (ratio inconnu). */
  fit: "cover" | "contain";
  color: string;
  /** Régions de la fiche (2 au maximum, pour le badge). */
  regions: string[];
}

/** Photos des familles, dans l'ordre du catalogue du site. */
export const MINI_APP_CATEGORY_IMAGES: Record<string, string> = {
  gift_card: "/telegram-mini-app/gift-card.webp",
  game_topup: "/telegram-mini-app/game-topup.webp",
  software_key: "/telegram-mini-app/software-key.webp",
  subscription_code: "/telegram-mini-app/subscription-code.webp",
};

/** Entrée minimale lue dans le catalogue (sous-ensemble de `DigitalProduct`). */
export interface MiniAppSourceProduct {
  slug: string;
  kind: DigitalKind;
  status: string;
  platform: string;
  color?: string | null;
  titleAr: string;
  titleEn: string;
  regions?: readonly string[] | null;
  denominations: readonly { available: boolean; priceUsd: number }[];
}

export interface MiniAppCategorySource {
  kind: DigitalKind;
  ar: string;
  en: string;
}

const FALLBACK_COLOR = "#6d5ae6";
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** Plus petit prix vendable d'une fiche, ou `null` si rien n'est vendable. */
export function miniAppFromUsd(product: MiniAppSourceProduct): number | null {
  const prices = product.denominations
    .filter((item) => item.available && Number.isFinite(item.priceUsd) && item.priceUsd > 0)
    .map((item) => item.priceUsd);
  return prices.length ? Math.min(...prices) : null;
}

/**
 * Produits affichables : disponibles ET avec au moins un montant vendable.
 * L'ordre reçu est conservé (le serveur passe déjà par `sortByDemand`).
 */
export function buildMiniAppProducts(
  products: readonly MiniAppSourceProduct[],
  visualFor: (product: MiniAppSourceProduct) => { src: string | null; fit: "cover" | "contain" },
): MiniAppProduct[] {
  const items: MiniAppProduct[] = [];
  for (const product of products) {
    if (product.status !== "available") continue;
    const fromUsd = miniAppFromUsd(product);
    if (fromUsd === null) continue;
    const visual = visualFor(product);
    items.push({
      slug: product.slug,
      kind: product.kind,
      platform: (product.platform ?? "").trim(),
      titleAr: product.titleAr || product.titleEn,
      titleEn: product.titleEn || product.titleAr,
      fromUsd: Math.round(fromUsd * 100) / 100,
      image: visual.src,
      fit: visual.src ? visual.fit : "cover",
      color: product.color && HEX_COLOR.test(product.color) ? product.color : FALLBACK_COLOR,
      regions: (product.regions ?? []).filter(Boolean).slice(0, 2),
    });
  }
  return items;
}

/** Familles avec photo et compteur. Une famille vide n'est pas affichée. */
export function buildMiniAppCategories(
  categories: readonly MiniAppCategorySource[],
  products: readonly MiniAppProduct[],
): MiniAppCategory[] {
  return categories
    .map((category) => ({
      kind: category.kind,
      ar: category.ar,
      en: category.en,
      image: MINI_APP_CATEGORY_IMAGES[category.kind] ?? MINI_APP_CATEGORY_IMAGES.gift_card,
      count: products.filter((product) => product.kind === category.kind).length,
    }))
    .filter((category) => category.count > 0);
}

/** Marques les plus représentées d'une liste (puces de filtre rapide). */
export function topMiniAppBrands(products: readonly MiniAppProduct[], limit = 12): string[] {
  const counts = new Map<string, number>();
  for (const product of products) {
    if (!product.platform) continue;
    counts.set(product.platform, (counts.get(product.platform) ?? 0) + 1);
  }
  return Array.from(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([brand]) => brand);
}

/** Normalise pour la recherche : minuscules, sans accents ni ponctuation. */
export function normalizeMiniAppQuery(value: string): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export interface MiniAppFilter {
  kind: string | null;
  brand: string | null;
  query: string;
}

/** Filtre combiné famille + marque + recherche (AR et EN). */
export function filterMiniAppProducts(
  products: readonly MiniAppProduct[],
  filter: MiniAppFilter,
): MiniAppProduct[] {
  const terms = normalizeMiniAppQuery(filter.query).split(" ").filter(Boolean);
  return products.filter((product) => {
    if (filter.kind && product.kind !== filter.kind) return false;
    if (filter.brand && product.platform !== filter.brand) return false;
    if (!terms.length) return true;
    const haystack = normalizeMiniAppQuery(
      `${product.titleEn} ${product.titleAr} ${product.platform} ${product.regions.join(" ")}`,
    );
    return terms.every((term) => haystack.includes(term));
  });
}

/** Langue de l'interface : `?lang=` explicite, sinon langue Telegram, sinon défaut du site. */
export function resolveMiniAppLocale(
  explicit: string | null | undefined,
  telegramLanguage: string | null | undefined,
  fallback: MiniAppLocale,
): MiniAppLocale {
  const pick = (value: string | null | undefined): MiniAppLocale | null => {
    const lower = String(value ?? "").toLowerCase();
    if (lower.startsWith("ar")) return "ar";
    if (lower.startsWith("en")) return "en";
    return null;
  };
  return pick(explicit) ?? (telegramLanguage ? (pick(telegramLanguage) ?? "en") : fallback);
}

/** Prix affiché : « $6.06 » (en) ou « 6.06 $ » (ar). */
export function formatMiniAppUsd(value: number, locale: MiniAppLocale): string {
  const amount = (Math.round(value * 100) / 100).toFixed(2);
  return locale === "ar" ? `${amount} $` : `$${amount}`;
}

/** Initiales du visuel de repli (« Steam Wallet » → « SW »). */
export function miniAppInitials(name: string): string {
  const words = (name ?? "").replace(/[^\p{L}\p{N} ]+/gu, " ").split(/\s+/).filter(Boolean);
  return (words[0]?.[0] ?? "?").toUpperCase() + (words[1]?.[0] ?? "").toUpperCase();
}

/**
 * Lien vers la fiche produit, depuis la Mini App.
 * `utm_source=telegram` permet de mesurer les ventes venues du bot.
 */
export function miniAppProductHref(
  slug: string,
  locale: MiniAppLocale,
  defaultLocale: MiniAppLocale,
): string {
  const params = new URLSearchParams({ utm_source: "telegram", utm_medium: "mini_app" });
  if (locale !== defaultLocale) params.set("lang", locale);
  return `/codes/${encodeURIComponent(slug)}?${params.toString()}`;
}

/**
 * Clients Telegram qui affichent la Mini App dans une <iframe> (Telegram Web).
 * Les fiches du site interdisent l'embarquement (anti-clickjacking) : sur ces
 * clients, la fiche s'ouvre dans un nouvel onglet au lieu de la même vue.
 */
export function miniAppOpensExternally(platform: string | null | undefined): boolean {
  return platform === "weba" || platform === "webk" || platform === "web";
}

/** CSP de la seule route `/tg` : la CSP du site + SDK Telegram + Telegram Web. */
export function telegramMiniAppCsp(baseDirectives: readonly string[]): string {
  return baseDirectives
    .map((directive) => {
      if (directive.startsWith("script-src ")) return `${directive} https://telegram.org`;
      if (directive.startsWith("frame-ancestors ")) {
        return `frame-ancestors 'self' ${TELEGRAM_MINI_APP_FRAME_ANCESTORS.join(" ")}`;
      }
      return directive;
    })
    .join("; ");
}

/** La route est-elle la Mini App (ou une sous-route) ? */
export function isTelegramMiniAppPath(pathname: string): boolean {
  return pathname === TELEGRAM_MINI_APP_PATH || pathname.startsWith(`${TELEGRAM_MINI_APP_PATH}/`);
}
