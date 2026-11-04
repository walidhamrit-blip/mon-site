/**
 * Politique de la boutique de produits digitaux (prix de vente en USD).
 *
 * Plafond de commande relevé de 50 $ à **110 $** (décision du 4 novembre
 * 2026) : avec l'alignement marché, les cartes 100 $ se vendent sous 100 $ et
 * étaient achetables mais non commandables — un client pouvait voir le prix
 * et se voir refuser le paiement. 110 $ laisse une marge de manœuvre aux
 * quantités multiples et couvre toute carte alignée.
 *
 * ⚠️ Ce plafond est un garde-fou de RISQUE (solde fournisseur, litiges), pas
 * un prix : il ne doit jamais descendre sous le prix de la fiche la plus chère
 * du catalogue, sinon la vitrine affiche des articles invendables.
 * Le réglage fin reste dans `/admin` → Réglages (`fazercards.maxOrderUsd`).
 */
export const MAX_DIGITAL_ORDER_USD = 110;
export const MAX_GIFT_CARD_PRICE_USD = 110;

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
