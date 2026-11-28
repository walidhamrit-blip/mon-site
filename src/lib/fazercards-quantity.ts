/** FazerCards top-ups have no quantity parameter: one offer per order. */
export function fazercardsMaxQuantity(kind: string, configuredMax: number): number {
  return kind === "game_topup" ? 1 : configuredMax;
}

export function requiresTopupQuantityReview(kind: string, quantity: number): boolean {
  return kind === "game_topup" && quantity !== 1;
}
