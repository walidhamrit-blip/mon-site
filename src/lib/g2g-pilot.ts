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
  if (normalizedOfferId !== PILOT_CANDIDATE_OFFER_ID) return false;
  const pilot = pilotOfferId(configuredId);
  return pilot === PILOT_CANDIDATE_OFFER_ID;
}

/**
 * Autorise l'achat et la livraison automatiques UNIQUEMENT lorsque :
 * 1. `G2G_AUTO_DELIVERY` vaut explicitement `"1"` ;
 * 2. `G2G_PILOT_OFFER_ID` désigne exactement l'offre pilote `G1795521210943KM`.
 * En l'absence de ces deux variables (comportement par défaut), retourne `false`.
 */
export function automaticDeliveryVerified(
  configuredPilot: string | undefined = process.env.G2G_PILOT_OFFER_ID,
  autoDelivery: string | undefined = process.env.G2G_AUTO_DELIVERY,
): boolean {
  return (
    autoDelivery?.trim() === "1" &&
    pilotOfferId(configuredPilot) === PILOT_CANDIDATE_OFFER_ID
  );
}

/** Les événements du bouton de diagnostic ne doivent jamais acheter. */
export function isSyntheticDelivery(deliveryId: string, orderId: string): boolean {
  return /^TESTD\d+$/.test(deliveryId) || /^TEST-ORDER-\d+$/.test(orderId);
}
