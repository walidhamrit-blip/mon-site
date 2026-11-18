/**
 * Prix des services à la carte — source unique.
 *
 * Le prix vit dans `config.standaloneServices[].priceFromUsd` (modifiable
 * dans /admin → Réglages). Il ne doit jamais être recopié en dur dans un
 * texte : une page qui affiche « 90 USDT » dans sa carte tarifaire et
 * « 15 $ » dans son paragraphe détruit la confiance du client, et le
 * problème revient à chaque changement de tarif.
 *
 * Ce module est volontairement pur (aucun import Next, aucune donnée) :
 * il est utilisable côté serveur, côté client et dans les tests.
 */

/** Forme minimale d'un service tarifé (évite un import circulaire). */
export interface PricedService {
  id: string;
  priceFromUsd: number;
}

/** Langue de formatage d'un montant (arabe ou anglais). */
export type PriceLang = "ar" | "en";

/** 90 → « 90 », 90.5 → « 90.50 ». */
export function formatPriceAmount(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

/**
 * Montant prêt à insérer dans un texte : « 90 دولاراً » en arabe,
 * « $90 » en anglais. Le site facture en USD (1 USD = 1 USDT).
 */
export function formatServicePrice(amount: number, lang: PriceLang): string {
  const value = formatPriceAmount(amount);
  return lang === "ar" ? `${value} دولاراً` : `$${value}`;
}

/** Prix « à partir de » d'un service, lu dans la configuration vivante. */
export function serviceStartingPrice(
  services: ReadonlyArray<PricedService>,
  id: string,
  fallback = 0,
): number {
  return services.find((service) => service.id === id)?.priceFromUsd ?? fallback;
}

/** Prix de départ le plus bas parmi les services (pour « à partir de »). */
export function lowestServicePrice(
  services: ReadonlyArray<PricedService>,
  fallback = 0,
): number {
  const prices = services
    .map((service) => service.priceFromUsd)
    .filter((price) => Number.isFinite(price) && price > 0);
  return prices.length > 0 ? Math.min(...prices) : fallback;
}

/**
 * Remplace le jeton `{price}` par le prix du service courant.
 *
 * Exemple : « تقرير واضح من {price} » + 90 → « تقرير واضح من 90 دولاراً ».
 * Utilisé au moment de résoudre le contenu éditorial, jamais à l'écriture.
 */
export function fillPriceTokens(
  text: string,
  amount: number,
  lang: PriceLang,
): string {
  if (!text.includes("{price}")) return text;
  return text.replaceAll("{price}", formatServicePrice(amount, lang));
}
