export const PILOT_CANDIDATE_OFFER_ID = "G1795521210943KM";

/** Offres historiques retirées et irrécupérables : ne jamais activer, mapper ni acheter. */
export const RETIRED_G2G_OFFER_IDS: readonly string[] = ["G1795076410074VF"];

export function isRetiredG2gOffer(value: string | undefined | null): boolean {
  const id = value?.trim().toUpperCase() ?? "";
  return Boolean(id) && RETIRED_G2G_OFFER_IDS.includes(id);
}

/** Pilotage prudent : une offre explicitement désignée, jamais plus d'une unité, jamais une offre retirée. */
export function pilotOfferId(value: string | undefined): string | null {
  const id = value?.trim().toUpperCase() ?? "";
  if (!/^G[0-9A-Z]{8,}$/.test(id)) return null;
  if (isRetiredG2gOffer(id)) return null;
  return id;
}

export function pilotQuantityAllowed(offerId: string, quantity: number, configuredId: string | undefined): boolean {
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 1) return false;
  if (quantity === 0) return true;
  const normalizedOfferId = offerId?.trim().toUpperCase() ?? "";
  if (isRetiredG2gOffer(normalizedOfferId)) return false;
  const pilot = pilotOfferId(configuredId);
  return pilot !== null && normalizedOfferId === pilot;
}

/** Bloqué en code jusqu'à validation du contrat de livraison de bout en bout. */
export function automaticDeliveryVerified(): boolean {
  return false;
}

/** Les événements du bouton de diagnostic ne doivent jamais acheter. */
export function isSyntheticDelivery(deliveryId: string, orderId: string): boolean {
  return /^TESTD\d+$/.test(deliveryId) || /^TEST-ORDER-\d+$/.test(orderId);
}
