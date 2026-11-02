/** Règle de surveillance, sans mouvement de fonds. Les montants sont en USD. */
export interface ReplenishmentSettings {
  thresholdUsd: number;
  targetUsd: number;
}

export const DEFAULT_REPLENISHMENT_SETTINGS: ReplenishmentSettings = {
  thresholdUsd: 30,
  targetUsd: 100,
};

export function validReplenishmentSettings(value: unknown): value is ReplenishmentSettings {
  if (!value || typeof value !== "object") return false;
  const input = value as Partial<ReplenishmentSettings>;
  return typeof input.thresholdUsd === "number" && Number.isFinite(input.thresholdUsd) &&
    typeof input.targetUsd === "number" && Number.isFinite(input.targetUsd) &&
    input.thresholdUsd >= 0 && input.targetUsd > input.thresholdUsd &&
    input.targetUsd <= 50000 &&
    Math.abs(Math.round(input.thresholdUsd * 100) - input.thresholdUsd * 100) < 1e-7 &&
    Math.abs(Math.round(input.targetUsd * 100) - input.targetUsd * 100) < 1e-7;
}

/** null signifie que le solde est inconnu ; il ne faut pas inventer un montant. */
export function replenishmentNeed(balanceUsd: number | null, rule: ReplenishmentSettings): number | null {
  if (balanceUsd == null || !Number.isFinite(balanceUsd) || balanceUsd < 0) return null;
  if (balanceUsd >= rule.thresholdUsd) return 0;
  return Math.ceil((rule.targetUsd - balanceUsd) * 100 - 1e-8) / 100;
}

/** Combine la surveillance de recharge avec l'alerte de couverture existante. */
export function replenishmentAlertLevel<T extends "ok" | "low" | "critical" | "unknown">(
  coverageLevel: T, balanceUsd: number | null, rule: ReplenishmentSettings,
): "ok" | "low" | "critical" | "unknown" {
  const need = replenishmentNeed(balanceUsd, rule);
  return coverageLevel === "ok" && need != null && need > 0 ? "low" : coverageLevel;
}
