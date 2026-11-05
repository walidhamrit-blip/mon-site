// Récupération serveur des pages Telegram publiques, sans compte ni clé API.
// Les URLs sont une liste blanche fixe : aucune URL arbitraire n'est acceptée.

import {
  PHONE_CARD_COMMUNITY_CHANNELS,
  buildPhoneCardCommunityConsensus,
  parseTelegramCommunityObservations,
  type PhoneCardCommunityObservation,
} from "@/lib/phone-card-community-core";
import type { PhoneCardRateSnapshot } from "@/lib/phone-card-pricing-core";

const TELEGRAM_TIMEOUT_MS = 5_000;
const TELEGRAM_MAX_HTML_LENGTH = 2_000_000;

async function fetchChannel(
  channel: (typeof PHONE_CARD_COMMUNITY_CHANNELS)[number],
): Promise<PhoneCardCommunityObservation[]> {
  const response = await fetch(`https://t.me/s/${channel.id}`, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "ar,en;q=0.8",
    },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`${channel.label} HTTP ${response.status}`);
  const html = await response.text();
  if (html.length > TELEGRAM_MAX_HTML_LENGTH) {
    throw new Error(`${channel.label} réponse trop volumineuse`);
  }
  return parseTelegramCommunityObservations(html, channel.id);
}

/** Médiane des derniers messages valides ; au moins deux canaux sont requis. */
export async function fetchPhoneCardCommunitySnapshot(): Promise<PhoneCardRateSnapshot> {
  const results = await Promise.allSettled(PHONE_CARD_COMMUNITY_CHANNELS.map(fetchChannel));
  const observations = results.flatMap((result) =>
    result.status === "fulfilled" ? result.value : [],
  );
  const consensus = buildPhoneCardCommunityConsensus(observations);
  if (!consensus) {
    const errors = results
      .filter((result) => result.status === "rejected")
      .map((result) => result.reason instanceof Error ? result.reason.message : "lecture impossible");
    throw new Error(
      `Consensus Telegram indisponible (${observations.length} publication(s) valide(s)${
        errors.length ? ` ; ${errors.join(" ; ")}` : ""
      })`,
    );
  }
  return {
    rateLyd: consensus.rateLyd,
    source: "community",
    rateUpdatedAt: consensus.rateUpdatedAt,
    fetchedAt: new Date().toISOString(),
    stale: false,
    references: consensus.references,
  };
}
