/**
 * Références de marché de la boutique — « à quel prix le client peut acheter
 * ailleurs ».
 *
 * ⚠️ Ce fichier ne contient QUE des prix observés publiquement, avec leur
 * canal et leur date. Aucun prix n'est inventé : un montant sans référence
 * n'obtient simplement pas d'alignement (voir `competitor-pricing.ts`).
 *
 * Deux natures de référence, à ne jamais confondre :
 *
 *  - `reseller` — le prix d'un revendeur (Eneba, G2A…). C'est le prix que le
 *    client peut réellement obtenir en ligne : il sert de **cible** à égaler
 *    (ou à dépasser légèrement vers le bas).
 *  - `official` — la valeur faciale de la plateforme (Steam, PSN, Xbox…).
 *    C'est un **plafond** : vendre au-dessus du prix officiel n'a aucun sens,
 *    mais on ne cherche pas non plus à descendre en dessous sans référence
 *    revendeur — on s'assure seulement de ne pas être plus cher.
 *
 * Les coupons et remises temporaires des revendeurs ne sont pas modélisés :
 * la référence retenue est le prix affiché « à partir de », relevé à date.
 */

export type BenchmarkConfidence = "reseller" | "official";

export interface MarketBenchmark {
  /** Prix observé, en USD (le même montant qu'en USDT). */
  usd: number;
  /** Canal de référence : « Eneba », « G2A », « Valeur faciale »… */
  channel: string;
  /** Date du relevé (ISO, jour). */
  observedAt: string;
  confidence: BenchmarkConfidence;
}

/**
 * Relevés du 3 novembre 2026, cartes **région US** (les seules comparables :
 * une carte régionale ne s'active que sur un compte de la même région).
 *
 * Clé : `<plateforme>:<valeur>` — valeur en dollars pour les cartes, en
 * Robux pour Roblox.
 */
export const MARKET_BENCHMARKS: Readonly<Record<string, MarketBenchmark>> = {
  // Steam — région US. Le revendeur est au-dessus ou au niveau du pair.
  "steam:5": { usd: 5.17, channel: "Eneba", observedAt: "2026-11-03", confidence: "reseller" },
  "steam:10": { usd: 10.75, channel: "Eneba", observedAt: "2026-11-03", confidence: "reseller" },
  "steam:20": { usd: 20.69, channel: "Eneba", observedAt: "2026-11-03", confidence: "reseller" },
  "steam:25": { usd: 27.86, channel: "Eneba", observedAt: "2026-11-03", confidence: "reseller" },
  "steam:50": { usd: 51.39, channel: "G2A", observedAt: "2026-11-03", confidence: "reseller" },

  // PlayStation — la seule famille où le revendeur casse franchement le prix.
  "playstation:25": { usd: 23.29, channel: "Eneba", observedAt: "2026-11-03", confidence: "reseller" },
  "playstation:50": { usd: 45.93, channel: "G2A", observedAt: "2026-11-03", confidence: "reseller" },

  // Robux — prix officiel Roblox (aucun revendeur vérifié au moment du relevé).
  "roblox:400": { usd: 4.99, channel: "Prix officiel Roblox", observedAt: "2026-11-03", confidence: "official" },
  "roblox:800": { usd: 9.99, channel: "Prix officiel Roblox", observedAt: "2026-11-03", confidence: "official" },
  "roblox:1700": { usd: 19.99, channel: "Prix officiel Roblox", observedAt: "2026-11-03", confidence: "official" },
  "roblox:4500": { usd: 49.99, channel: "Prix officiel Roblox", observedAt: "2026-11-03", confidence: "official" },
};

/** Plateformes dont la valeur faciale est libellée en dollars. */
const USD_FACE_PLATFORMS = new Set(["steam", "playstation", "xbox", "google-play", "amazon"]);

/** Ramène un libellé de fiche (« PlayStation », « Google Play »…) à une clé stable. */
export function platformKey(platform: string): string {
  const normalized = String(platform ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
  if (normalized.includes("playstation") || normalized === "psn" || normalized.includes("psn")) {
    return "playstation";
  }
  if (normalized.includes("google")) return "google-play";
  if (normalized.includes("steam")) return "steam";
  if (normalized.includes("xbox")) return "xbox";
  if (normalized.includes("amazon")) return "amazon";
  if (normalized.includes("roblox")) return "roblox";
  return normalized;
}

/** Premier nombre d'un texte (« 50 USD » → 50, « 4 500 Robux » → 4500). */
export function faceNumber(text: string | null | undefined): number | null {
  const raw = String(text ?? "");
  // Espaces (dont l'espace fine) utilisés comme séparateurs de milliers.
  const cleaned = raw.replace(/[\u00a0\u202f\s]/g, "");
  const match = cleaned.match(/\d+(?:[.,]\d+)?/);
  if (!match) return null;
  const value = Number(match[0].replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Valeur faciale exploitable d'une dénomination, ou `null` si non comparable. */
export function denominationFace(denomination: {
  faceValue: string;
  faceCurrency?: string | null;
  reloadlyUnitPrice?: number | null;
}): number | null {
  const currency = String(denomination.faceCurrency ?? "").trim().toUpperCase();
  if (currency && currency !== "USD" && currency !== "ROBUX") return null;
  const unit = denomination.reloadlyUnitPrice;
  if (typeof unit === "number" && Number.isFinite(unit) && unit > 0) return unit;
  return faceNumber(denomination.faceValue);
}

/**
 * Référence de marché d'une dénomination.
 *
 * Ordre de résolution :
 *  1. relevé revendeur exact (`plateforme:valeur`) ;
 *  2. valeur faciale **en dollars** d'une plateforme dont c'est le prix
 *     officiel → plafond, jamais une cible ;
 *  3. rien. Une fiche sans référence n'est jamais réalignée en aveugle.
 */
export function benchmarkForDenomination(
  platform: string,
  denomination: {
    faceValue: string;
    faceCurrency?: string | null;
    reloadlyUnitPrice?: number | null;
  },
): MarketBenchmark | null {
  const key = platformKey(platform);
  const face = denominationFace(denomination);
  if (face == null) return null;

  const observed = MARKET_BENCHMARKS[`${key}:${face}`];
  if (observed) return observed;

  // Le Robux n'a pas de valeur en dollars : sans relevé, aucune référence.
  if (!USD_FACE_PLATFORMS.has(key)) return null;
  if (String(denomination.faceCurrency ?? "").trim() !== "" &&
      String(denomination.faceCurrency).trim().toUpperCase() !== "USD") {
    return null;
  }

  return {
    usd: face,
    channel: "Valeur faciale",
    observedAt: "permanent",
    confidence: "official",
  };
}

/** Nombre de références disponibles (utile aux écrans d'administration). */
export function benchmarkCount(): number {
  return Object.keys(MARKET_BENCHMARKS).length;
}
