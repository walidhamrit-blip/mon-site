// Récupération serveur du taux USD/LYD du marché parallèle.
// La clé Fulus ne quitte jamais ce module et n'est jamais renvoyée au client.

import { getSiteData } from "@/lib/store";
import { fetchPhoneCardCommunitySnapshot } from "@/lib/phone-card-community";
import {
  calculatePhoneCardLydQuote,
  normalizePhoneCardRate,
  parseFulusCurrentRate,
  type PhoneCardLydQuote,
  type PhoneCardRateSnapshot,
} from "@/lib/phone-card-pricing-core";

const FULUS_ENDPOINT = "https://fulus.ly/api/v1/rates/current";
const FULUS_TIMEOUT_MS = 7_000;
const RATE_CACHE_MS = 10 * 60 * 1000;
const RATE_MAX_STALE_MS = 6 * 60 * 60 * 1000;
const PROVIDER_MAX_RATE_AGE_MS = 48 * 60 * 60 * 1000;

interface RateCacheEntry {
  snapshot: PhoneCardRateSnapshot;
  storedAt: number;
}

let communityCache: RateCacheEntry | null = null;
let communityRefresh: Promise<PhoneCardRateSnapshot> | null = null;
let fulusCache: RateCacheEntry | null = null;
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
    references: [],
  };
}

async function refreshCommunity(): Promise<PhoneCardRateSnapshot> {
  if (!communityRefresh) {
    communityRefresh = fetchPhoneCardCommunitySnapshot()
      .then((snapshot) => {
        communityCache = { snapshot, storedAt: Date.now() };
        return snapshot;
      })
      .finally(() => {
        communityRefresh = null;
      });
  }
  return communityRefresh;
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
    references: [],
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

function freshCache(cache: RateCacheEntry | null, now: number): PhoneCardRateSnapshot | null {
  return cache && now - cache.storedAt <= RATE_CACHE_MS ? cache.snapshot : null;
}

/**
 * Mode automatique : médiane de deux ou trois canaux Telegram publics, puis
 * Fulus si une clé est configurée, puis taux manuel admin. Sans taux manuel,
 * le dernier résultat automatique connu peut servir six heures, marqué ancien.
 * Mode manuel : uniquement le taux de l'admin.
 */
export async function getPhoneCardRateSnapshot(): Promise<PhoneCardRateSnapshot | null> {
  const { config } = await getSiteData();
  const manual = manualSnapshot(config);
  if (config.fazercards?.phoneCardRateMode === "manual") return manual;

  const now = Date.now();
  const freshCommunity = freshCache(communityCache, now);
  if (freshCommunity) return freshCommunity;
  try {
    return await refreshCommunity();
  } catch (error) {
    console.warn(
      "[phone-card-rate] consensus Telegram impossible :",
      error instanceof Error ? error.message : error,
    );
  }

  const freshFulus = freshCache(fulusCache, now);
  if (freshFulus) return freshFulus;
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
  const staleCandidates = [communityCache, fulusCache]
    .filter((cache): cache is RateCacheEntry =>
      Boolean(cache && now - cache.storedAt <= RATE_MAX_STALE_MS),
    )
    .sort((left, right) => right.storedAt - left.storedAt);
  return staleCandidates[0]
    ? { ...staleCandidates[0].snapshot, stale: true }
    : null;
}

/** Recalcule le devis à partir du total catalogue fourni par le serveur. */
export async function getPhoneCardLydQuote(amountUsdt: number): Promise<PhoneCardLydQuote | null> {
  const snapshot = await getPhoneCardRateSnapshot();
  if (!snapshot) return null;
  const { rateLyd, ...metadata } = snapshot;
  return calculatePhoneCardLydQuote(amountUsdt, rateLyd, metadata);
}
