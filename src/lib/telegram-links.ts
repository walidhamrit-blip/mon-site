/**
 * Liens « Continuer sur Telegram » vers la boutique du bot.
 *
 * Module PUR (aucune dépendance serveur) : utilisable par les composants
 * client comme par le webhook. Le nom du bot, lui, est lu côté serveur
 * (`TELEGRAM_BOT_USERNAME`, jamais une variable publique) puis passé en prop.
 *
 * Format du paramètre `start` (Telegram : `[A-Za-z0-9_-]`, 64 caractères max) :
 *   shop                    → boutique, racine
 *   shop-ar / shop-en       → boutique, langue imposée par le site
 *   shop-ar-gift_card       → boutique ouverte directement sur un rayon
 *
 * Ce même paramètre est enregistré comme source d'acquisition par le bot :
 * on sait ainsi quel rayon du site amène des clients sur Telegram.
 */

/**
 * Rayons de la boutique — copie de `DIGITAL_KINDS` (`digital-types.ts`) pour
 * garder ce module sans import (exécutable tel quel par `node --test`).
 * L'égalité des deux listes est vérifiée par `scripts/telegram-links.test.mjs`.
 */
export const SHOP_LINK_KINDS = ["software_key", "gift_card", "game_topup", "subscription_code"] as const;
type DigitalKind = (typeof SHOP_LINK_KINDS)[number];

export const SHOP_START_PREFIX = "shop";

export type ShopStartLocale = "ar" | "en";

export interface ShopStartTarget {
  kind: DigitalKind | null;
  locale: ShopStartLocale | null;
}

function isDigitalKind(value: string): value is DigitalKind {
  return (SHOP_LINK_KINDS as readonly string[]).includes(value);
}

/** `@NokhbaGamebot` → `NokhbaGamebot` ; vide si ce n'est pas un nom Telegram valide. */
export function normalizeTelegramHandle(handle: string | null | undefined): string {
  const clean = (handle ?? "").trim().replace(/^@/, "");
  return /^[A-Za-z0-9_]{4,32}$/.test(clean) ? clean : "";
}

/** Paramètre `start` d'un lien boutique (voir le format en tête de fichier). */
export function shopStartPayload(target: Partial<ShopStartTarget> = {}): string {
  const parts: string[] = [SHOP_START_PREFIX];
  if (target.locale === "ar" || target.locale === "en") parts.push(target.locale);
  if (target.kind && isDigitalKind(target.kind)) parts.push(target.kind);
  return parts.join("-");
}

/**
 * Lit un paramètre `start` boutique. `null` s'il ne s'agit pas d'un lien
 * boutique : le bot garde alors son comportement habituel (menu, suivi…).
 * Un rayon inconnu ouvre la racine de la boutique plutôt qu'une erreur.
 */
export function shopTargetFromStartPayload(payload: string | null | undefined): ShopStartTarget | null {
  const raw = (payload ?? "").trim().toLowerCase();
  if (raw !== SHOP_START_PREFIX && !raw.startsWith(`${SHOP_START_PREFIX}-`)) return null;
  let rest = raw.slice(SHOP_START_PREFIX.length + 1);
  let locale: ShopStartLocale | null = null;
  const lang = rest.slice(0, 2);
  if ((lang === "ar" || lang === "en") && (rest.length === 2 || rest[2] === "-")) {
    locale = lang;
    rest = rest.slice(3);
  }
  return { kind: isDigitalKind(rest) ? rest : null, locale };
}

/**
 * URL `t.me` qui ouvre la boutique du bot (éventuellement sur un rayon).
 * Vide si le bot n'est pas configuré : mieux vaut aucun bouton qu'un lien mort.
 */
export function telegramShopUrl(handle: string | null | undefined, target: Partial<ShopStartTarget> = {}): string {
  const clean = normalizeTelegramHandle(handle);
  if (!clean) return "";
  return `https://t.me/${clean}?start=${shopStartPayload(target)}`;
}
