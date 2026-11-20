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
