/** Pilotage prudent : une offre explicitement désignée, jamais plus d'une unité. */
export function pilotOfferId(value: string | undefined): string | null {
  const id = value?.trim().toUpperCase() ?? "";
  return /^G[0-9A-Z]{8,}$/.test(id) ? id : null;
}

export function pilotQuantityAllowed(offerId: string, quantity: number, configuredId: string | undefined): boolean {
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 1) return false;
  if (quantity === 0) return true;
  const pilot = pilotOfferId(configuredId);
  return pilot !== null && offerId === pilot;
}

/** Bloqué en code jusqu'à validation du contrat de livraison de bout en bout. */
export function automaticDeliveryVerified(): boolean {
  return false;
}

/** Les événements du bouton de diagnostic ne doivent jamais acheter. */
export function isSyntheticDelivery(deliveryId: string, orderId: string): boolean {
  return /^TESTD\d+$/.test(deliveryId) || /^TEST-ORDER-\d+$/.test(orderId);
}
