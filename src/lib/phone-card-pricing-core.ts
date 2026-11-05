// Calcul public et vérifiable du paiement par carte téléphonique.
// Aucune dépendance serveur : ce module est aussi utilisé par les tests.

export const PHONE_CARD_MARKUP_PERCENT = 20;
export const PHONE_CARD_RATE_FACTOR = 1 + PHONE_CARD_MARKUP_PERCENT / 100;

export type PhoneCardQuoteSource = "fulus" | "manual";

export interface PhoneCardRateSnapshot {
  rateLyd: number;
  source: PhoneCardQuoteSource;
  /** Date de mise à jour du taux chez la source, si elle est connue. */
  rateUpdatedAt: string | null;
  /** Date de récupération du taux par le serveur Nukhba. */
  fetchedAt: string;
  /** true = dernier taux Fulus connu, servi après un échec de rafraîchissement. */
  stale: boolean;
}

export interface PhoneCardLydQuote extends PhoneCardRateSnapshot {
  amountUsdt: number;
  markupPercent: number;
  totalLyd: number;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function normalizePhoneCardRate(value: unknown): number | null {
  const rate = Number(value);
  if (!Number.isFinite(rate) || rate <= 0 || rate > 10_000) return null;
  return round(rate, 4);
}

/**
 * Formule convenue : total USDT × marché parallèle LYD × 120 %.
 * Le total USDT vient toujours du catalogue côté serveur, jamais du navigateur.
 */
export function calculatePhoneCardLydQuote(
  amountInput: unknown,
  rateInput: unknown,
  snapshot: Omit<PhoneCardRateSnapshot, "rateLyd">,
): PhoneCardLydQuote | null {
  const amount = Number(amountInput);
  const rateLyd = normalizePhoneCardRate(rateInput);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000 || !rateLyd) {
    return null;
  }
  const amountUsdt = round(amount, 2);
  return {
    amountUsdt,
    rateLyd,
    markupPercent: PHONE_CARD_MARKUP_PERCENT,
    totalLyd: round(amountUsdt * rateLyd * PHONE_CARD_RATE_FACTOR, 2),
    ...snapshot,
  };
}

/** Lecture stricte de la réponse documentée par Fulus, avec tolérance aux listes. */
export function parseFulusCurrentRate(
  payload: unknown,
): { rateLyd: number; rateUpdatedAt: string | null } | null {
  if (!payload || typeof payload !== "object") return null;
  const data = (payload as { data?: unknown }).data;
  const candidates = Array.isArray(data) ? data : [data];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const row = candidate as Record<string, unknown>;
    const currency = String(row.currency ?? "").trim().toUpperCase();
    if (currency && currency !== "USD") continue;
    const rateLyd = normalizePhoneCardRate(row.rate);
    if (!rateLyd) continue;
    const rawDate = row.timestamp ?? row.updatedAt ?? row.updated_at;
    const rateUpdatedAt =
      typeof rawDate === "string" && Number.isFinite(Date.parse(rawDate)) ? rawDate : null;
    return { rateLyd, rateUpdatedAt };
  }
  return null;
}

/**
 * Vérifie que le client a accepté exactement le taux encore appliqué par le
 * serveur. `fetchedAt` et `stale` peuvent changer sans modifier le prix.
 */
export function phoneCardQuoteMatches(
  candidate: unknown,
  expected: PhoneCardLydQuote,
): boolean {
  if (!candidate || typeof candidate !== "object") return false;
  const value = candidate as Record<string, unknown>;
  const sameMoney = (input: unknown, target: number, decimals: number) => {
    const parsed = Number(input);
    return Number.isFinite(parsed) && parsed.toFixed(decimals) === target.toFixed(decimals);
  };
  const candidateDate = typeof value.rateUpdatedAt === "string" ? value.rateUpdatedAt : null;
  return (
    sameMoney(value.amountUsdt, expected.amountUsdt, 2) &&
    sameMoney(value.rateLyd, expected.rateLyd, 4) &&
    sameMoney(value.totalLyd, expected.totalLyd, 2) &&
    Number(value.markupPercent) === PHONE_CARD_MARKUP_PERCENT &&
    value.source === expected.source &&
    candidateDate === expected.rateUpdatedAt
  );
}
