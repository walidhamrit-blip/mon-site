/** Politique temporaire de la boutique de produits digitaux (prix de vente USD). */
export const MAX_DIGITAL_ORDER_USD = 50;
export const MAX_GIFT_CARD_PRICE_USD = 100;

/** Met en veille les dénominations de cartes au-delà du seuil, sans modifier le catalogue stocké. */
export function applyGiftCardSalesPolicy<
  T extends { kind: string; denominations: { priceUsd: number; available: boolean }[] },
>(product: T): T {
  if (product.kind !== "gift_card") return product;
  return {
    ...product,
    denominations: product.denominations.map((denomination) => ({
      ...denomination,
      available: denomination.available && denomination.priceUsd <= MAX_GIFT_CARD_PRICE_USD,
    })),
  };
}
