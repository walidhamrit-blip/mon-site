// Récupération serveur du taux USD/LYD du marché parallèle.
// La clé Fulus ne quitte jamais ce module et n'est jamais renvoyée au client.

import { getSiteData } from "@/lib/store";
import {
  calculatePhoneCardLydQuote,
  normalizePhoneCardRate,
  parseFulusCurrentRate,
  type PhoneCardLydQuote,
  type PhoneCardRateSnapshot,
} from "@/lib/phone-card-pricing-core";

const FULUS_ENDPOINT = "https://fulus.ly/api/v1/rates/current";
const FULUS_TIMEOUT_MS = 7_000;
const FULUS_CACHE_MS = 10 * 60 * 1000;
const FULUS_MAX_STALE_MS = 6 * 60 * 60 * 1000;
const PROVIDER_MAX_RATE_AGE_MS = 48 * 60 * 60 * 1000;

interface FulusCacheEntry {
  snapshot: PhoneCardRateSnapshot;
  storedAt: number;
}

let fulusCache: FulusCacheEntry | null = null;
let fulusRefresh: Promise<PhoneCardRateSnapshot> | null = null;

function manualSnapshot(config: Awaited<ReturnType<typeof getSiteData>>["config"]): PhoneCardRateSnapshot | null {
  const settings = config.fazercards;
  const rateLyd = normalizePhoneCardRate(settings?.phoneCardManualRateLyd);
  if (!rateLyd) return null;
  const rawDate = settings?.phoneCardManualRateUpdatedAt;
  return {
    rateLyd,
    source: "manual",
    rateUpdatedAt:
      typeof rawDate === "string" && Number.isFinite(Date.parse(rawDate)) ? rawDate : null,
    fetchedAt: new Date().toISOString(),
    stale: false,
  };
}

async function fetchFulusSnapshot(token: string): Promise<PhoneCardRateSnapshot> {
  const response = await fetch(FULUS_ENDPOINT, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(FULUS_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Fulus HTTP ${response.status}`);
  const parsed = parseFulusCurrentRate(await response.json());
  if (!parsed) throw new Error("Réponse Fulus sans taux USD/LYD valide");

  const fetchedAt = new Date().toISOString();
  const providerTime = parsed.rateUpdatedAt ? Date.parse(parsed.rateUpdatedAt) : Number.NaN;
  if (Number.isFinite(providerTime)) {
    const now = Date.now();
    // Une date très ancienne ne doit pas être présentée comme un taux courant.
    if (now - providerTime > PROVIDER_MAX_RATE_AGE_MS) {
      throw new Error("Le taux Fulus est trop ancien");
    }
  }

  return {
    rateLyd: parsed.rateLyd,
    source: "fulus",
    rateUpdatedAt: parsed.rateUpdatedAt ?? fetchedAt,
    fetchedAt,
    stale: false,
  };
}

async function refreshFulus(token: string): Promise<PhoneCardRateSnapshot> {
  if (!fulusRefresh) {
    fulusRefresh = fetchFulusSnapshot(token)
      .then((snapshot) => {
        fulusCache = { snapshot, storedAt: Date.now() };
        return snapshot;
      })
      .finally(() => {
        fulusRefresh = null;
      });
  }
  return fulusRefresh;
}

/**
 * Mode automatique : Fulus frais, puis taux manuel admin, puis dernier Fulus
 * connu pendant six heures. Mode manuel : uniquement le taux de l'admin.
 */
export async function getPhoneCardRateSnapshot(): Promise<PhoneCardRateSnapshot | null> {
  const { config } = await getSiteData();
  const manual = manualSnapshot(config);
  if (config.fazercards?.phoneCardRateMode === "manual") return manual;

  const now = Date.now();
  if (fulusCache && now - fulusCache.storedAt <= FULUS_CACHE_MS) {
    return fulusCache.snapshot;
  }

  const token = process.env.FULUS_API_KEY?.trim();
  if (token) {
    try {
      return await refreshFulus(token);
    } catch (error) {
      console.warn(
        "[phone-card-rate] rafraîchissement Fulus impossible :",
        error instanceof Error ? error.message : error,
      );
    }
  }

  if (manual) return manual;
  if (fulusCache && now - fulusCache.storedAt <= FULUS_MAX_STALE_MS) {
    return { ...fulusCache.snapshot, stale: true };
  }
  return null;
}

/** Recalcule le devis à partir du total catalogue fourni par le serveur. */
export async function getPhoneCardLydQuote(amountUsdt: number): Promise<PhoneCardLydQuote | null> {
  const snapshot = await getPhoneCardRateSnapshot();
  if (!snapshot) return null;
  const { rateLyd, ...metadata } = snapshot;
  return calculatePhoneCardLydQuote(amountUsdt, rateLyd, metadata);
}
