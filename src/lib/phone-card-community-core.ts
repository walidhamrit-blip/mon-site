// Lecture prudente des publications publiques Telegram utilisées pour le
// taux communautaire USD/LYD. Module pur : aucun appel réseau ici, afin de
// tester les formats arabes et les exclusions sans dépendre de Telegram.

import {
  normalizePhoneCardRate,
  type PhoneCardQuoteReference,
} from "./phone-card-pricing-core.ts";

export const PHONE_CARD_COMMUNITY_MAX_AGE_MS = 36 * 60 * 60 * 1000;
export const PHONE_CARD_COMMUNITY_MAX_SPREAD = 0.03;
export const PHONE_CARD_COMMUNITY_MIN_SOURCES = 2;

export const PHONE_CARD_COMMUNITY_CHANNELS = [
  { id: "dollar_ly", label: "@dollar_ly" },
  { id: "lydollar", label: "@lydollar" },
  { id: "suqalmushir", label: "@suqalmushir" },
] as const;

export type PhoneCardCommunityChannelId =
  (typeof PHONE_CARD_COMMUNITY_CHANNELS)[number]["id"];

export interface PhoneCardCommunityObservation extends PhoneCardQuoteReference {
  channel: PhoneCardCommunityChannelId;
}

export interface PhoneCardCommunityConsensus {
  rateLyd: number;
  /** Publication la plus récente retenue dans la médiane. */
  rateUpdatedAt: string;
  references: PhoneCardQuoteReference[];
}

function roundRate(value: number): number {
  return Math.round((value + Number.EPSILON) * 10_000) / 10_000;
}

function decodeHtml(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    hellip: "…",
    laquo: "«",
    lt: "<",
    nbsp: " ",
    quot: '"',
    raquo: "»",
    ndash: "–",
    mdash: "—",
  };
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    const lower = code.toLowerCase();
    if (lower.startsWith("#x")) {
      const point = Number.parseInt(lower.slice(2), 16);
      return Number.isFinite(point) && point >= 0 && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : entity;
    }
    if (lower.startsWith("#")) {
      const point = Number.parseInt(lower.slice(1), 10);
      return Number.isFinite(point) && point >= 0 && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : entity;
    }
    return named[lower] ?? entity;
  });
}

/** Convertit les chiffres arabes et le HTML inline de Telegram en texte lisible. */
export function telegramMessageText(fragment: string): string {
  const text = fragment
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "");
  return decodeHtml(text)
    .normalize("NFKC")
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/٫/g, ".")
    .replace(/٬/g, "")
    .replace(/[\u00a0\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function tripoliDateKey(value: string): string | null {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Tripoli",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(time));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const year = get("year");
  const month = get("month");
  const day = get("day");
  return year && month && day ? `${year}-${month}-${day}` : null;
}

/** Date écrite dans le message, à contrôler contre la date réelle Telegram. */
function embeddedDateKey(text: string): string | null {
  const ymd = text.match(/\b(20\d{2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{1,2})\b/);
  if (ymd) {
    const year = Number(ymd[1]);
    const month = Number(ymd[2]);
    const day = Number(ymd[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  const dmy = text.match(/\b(\d{1,2})\s*-\s*(\d{1,2})\s*-\s*(20\d{2})\b/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  return null;
}

/**
 * Extrait uniquement « دولار = 9.92 » en espèces. Les lignes de chèques et
 * les messages de la Banque centrale / du marché officiel sont écartés.
 */
export function parseArabicCashDollarRate(textInput: string): number | null {
  const text = telegramMessageText(textInput);
  if (!text || /المركزي|السوق\s+الرسمي|السوق\s+الرسمية|official\s+(?:rate|market)/i.test(text)) {
    return null;
  }
  for (const line of text.split("\n")) {
    if (/بشيك|ب\s*شيك|بالصك|بصك|حوالة\s*تركيا|مصرف|بنك|bank/i.test(line)) continue;
    const match = line.match(
      /(?:^|[^\p{L}])(?:سعر\s+)?(?:الدولار|دولار)\s*(?:💵)?\s*(?:=|:|–|—)\s*(\d{1,3}(?:[.,]\d{1,4})?)/u,
    );
    if (!match) continue;
    const rate = normalizePhoneCardRate(match[1].replace(",", "."));
    // Garde-fou contre une ligne d'or, d'argent ou un montant sans rapport.
    if (rate && rate >= 1 && rate <= 100) return rate;
  }
  return null;
}

function parseViews(value: string | undefined): number | null {
  if (!value) return null;
  const normalized = telegramMessageText(value).replace(/\s+views?$/i, "").trim();
  const match = normalized.match(/^(\d+(?:\.\d+)?)([KM])?$/i);
  if (!match) return null;
  const base = Number(match[1]);
  const multiplier = match[2]?.toUpperCase() === "M" ? 1_000_000 : match[2]?.toUpperCase() === "K" ? 1_000 : 1;
  const views = Math.round(base * multiplier);
  return Number.isSafeInteger(views) && views >= 0 ? views : null;
}

/**
 * Lit les blocs `tgme_widget_message` de la page publique `/s/<canal>`.
 * Une date arabe différente du jour de publication Telegram invalide le
 * message : on préfère ignorer une valeur plutôt que présenter un taux daté
 * comme étant frais. Seules les publications de moins de 36 h sont retenues.
 */
export function parseTelegramCommunityObservations(
  html: string,
  channel: PhoneCardCommunityChannelId,
  nowInput: number = Date.now(),
): PhoneCardCommunityObservation[] {
  if (!html || !Number.isFinite(nowInput)) return [];
  const channelInfo = PHONE_CARD_COMMUNITY_CHANNELS.find((item) => item.id === channel);
  if (!channelInfo) return [];
  const postPattern = new RegExp(`data-post=["']${channel}/(\\d+)["']`, "g");
  const starts: { index: number; blockStart: number; postId: string }[] = [];
  for (const match of html.matchAll(postPattern)) {
    const index = match.index ?? -1;
    if (index < 0) continue;
    const blockStart = html.lastIndexOf("<div", index);
    starts.push({ index, blockStart: blockStart >= 0 ? blockStart : index, postId: match[1] });
  }

  const observations: PhoneCardCommunityObservation[] = [];
  for (let index = 0; index < starts.length; index += 1) {
    const current = starts[index];
    const block = html.slice(current.blockStart, starts[index + 1]?.blockStart ?? html.length);
    const textMatch = block.match(
      /<div[^>]+class=["'][^"']*tgme_widget_message_text[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    );
    const timeMatch = block.match(/<time[^>]+datetime=["']([^"']+)["']/i);
    if (!textMatch || !timeMatch || !Number.isFinite(Date.parse(timeMatch[1]))) continue;
    const publishedAt = new Date(timeMatch[1]).toISOString();
    const publishedTime = Date.parse(publishedAt);
    if (publishedTime > nowInput + 15 * 60 * 1000) continue;
    if (nowInput - publishedTime > PHONE_CARD_COMMUNITY_MAX_AGE_MS) continue;

    const text = telegramMessageText(textMatch[1]);
    const embeddedDate = embeddedDateKey(text);
    if (embeddedDate && embeddedDate !== tripoliDateKey(publishedAt)) continue;
    const rateLyd = parseArabicCashDollarRate(text);
    if (!rateLyd) continue;
    const viewsMatch = block.match(
      /<span[^>]+class=["'][^"']*tgme_widget_message_views[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
    );
    observations.push({
      channel,
      label: channelInfo.label,
      url: `https://t.me/${channel}/${current.postId}`,
      rateLyd,
      rateUpdatedAt: publishedAt,
      views: parseViews(viewsMatch?.[1]),
    });
  }
  return observations.sort(
    (left, right) => Date.parse(right.rateUpdatedAt) - Date.parse(left.rateUpdatedAt),
  );
}

/**
 * Médiane de deux ou trois canaux distincts. Toutes les valeurs retenues
 * doivent rester dans une bande de 3 % : un désaccord important bloque le
 * devis automatique au lieu de choisir arbitrairement un camp.
 */
export function buildPhoneCardCommunityConsensus(
  input: readonly PhoneCardCommunityObservation[],
): PhoneCardCommunityConsensus | null {
  const latestByChannel = new Map<PhoneCardCommunityChannelId, PhoneCardCommunityObservation>();
  for (const observation of input) {
    if (!PHONE_CARD_COMMUNITY_CHANNELS.some((channel) => channel.id === observation.channel)) continue;
    const rateLyd = normalizePhoneCardRate(observation.rateLyd);
    const publishedTime = Date.parse(observation.rateUpdatedAt);
    if (!rateLyd || rateLyd < 1 || rateLyd > 100 || !Number.isFinite(publishedTime)) continue;
    const current = latestByChannel.get(observation.channel);
    if (!current || publishedTime > Date.parse(current.rateUpdatedAt)) {
      latestByChannel.set(observation.channel, { ...observation, rateLyd });
    }
  }
  const retained = [...latestByChannel.values()].sort(
    (left, right) => Date.parse(right.rateUpdatedAt) - Date.parse(left.rateUpdatedAt),
  );
  if (retained.length < PHONE_CARD_COMMUNITY_MIN_SOURCES) return null;
  const rates = retained.map((item) => item.rateLyd).sort((left, right) => left - right);
  const middle = Math.floor(rates.length / 2);
  const median = rates.length % 2 === 0
    ? roundRate((rates[middle - 1] + rates[middle]) / 2)
    : rates[middle];
  if (!median || (rates[rates.length - 1] - rates[0]) / median > PHONE_CARD_COMMUNITY_MAX_SPREAD) {
    return null;
  }
  return {
    rateLyd: median,
    rateUpdatedAt: retained[0].rateUpdatedAt,
    references: retained.map(({ channel: _channel, ...reference }) => ({
      ...reference,
      rateLyd: normalizePhoneCardRate(reference.rateLyd) ?? reference.rateLyd,
    })),
  };
}
