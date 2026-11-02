/**
 * Horaires d'ouverture structurés — A09 (audit SEO/GEO 2026-11-01).
 *
 * Source unique : le texte `config.hoursEn`, éditable dans
 * /admin → Réglages (« Sat - Thu: 9:00 AM - 11:00 PM »). Ce module en dérive
 * le JSON-LD `openingHoursSpecification` pour que le schema.org ne diverge
 * jamais du texte affiché en AR/EN (avant, opens/closes étaient en dur dans
 * seo.ts : 18h/22h/23h selon les sources).
 */

const DAY_ABBR: Record<string, string> = {
  sun: "Sunday",
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
};
/** Ordre lundi → dimanche (semaine internationale) pour les plages. */
const DAY_ORDER = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export interface OpeningHoursSpec {
  dayOfWeek: string[];
  opens: string;
  closes: string;
}

/** « 9:00 AM » → "09:00", « 11:00 PM » → "23:00", « 23:00 » → "23:00". */
function to24h(hour: number, minute: number, meridiem?: string): string {
  let h = hour;
  if (meridiem) {
    h = hour % 12;
    if (meridiem.toUpperCase() === "P") h += 12;
  }
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** « Sat - Thu » → [Saturday, Sunday, Monday, Tuesday, Wednesday, Thursday]. */
function parseDays(daysText: string): string[] {
  // « Daily », « Every day », « 7j/7 », « 7/7 » → les sept jours.
  if (/daily|every\s*day|all\s*days|7\s*\/\s*7|7j\s*\/\s*7/i.test(daysText)) {
    return [...DAY_ORDER];
  }
  const tokens = daysText
    .split(/[,،\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const days: string[] = [];
  for (const token of tokens) {
    const range = token
      .split(/\s*(?:-|–|—|to)\s*/i)
      .map((part) => part.trim())
      .filter(Boolean);
    if (range.length === 2) {
      const start = DAY_ABBR[range[0].slice(0, 3).toLowerCase()];
      const end = DAY_ABBR[range[1].slice(0, 3).toLowerCase()];
      if (start && end) {
        let index = DAY_ORDER.indexOf(start);
        for (;;) {
          days.push(DAY_ORDER[index]);
          if (DAY_ORDER[index] === end) break;
          index = (index + 1) % 7;
        }
        continue;
      }
    }
    const single = DAY_ABBR[token.slice(0, 3).toLowerCase()];
    if (single) days.push(single);
  }
  return [...new Set(days)];
}

/**
 * Parse un texte d'horaires anglais en spec schema.org.
 * Retourne `null` si le texte est illisible (l'appelant retombe alors sur
 * une valeur par défaut explicite, jamais sur une valeur silencieuse).
 */
export function parseOpeningHoursEn(text: string): OpeningHoursSpec | null {
  const raw = String(text ?? "").trim();
  if (!raw) return null;

  // 1) heures au format 12h (« 9:00 AM », « 11 PM »), 2) sinon format 24h (« 09:00 »).
  type HourMatch = { hour: number; minute: number; meridiem?: string; index: number };
  let hourMatches: HourMatch[] = [
    ...raw.matchAll(/(\d{1,2})(?::(\d{2}))?\s*([AP])\.?M\.?/gi),
  ].map((match) => ({
    hour: Number(match[1]),
    minute: Number(match[2] ?? "0"),
    meridiem: match[3],
    index: match.index ?? 0,
  }));
  if (hourMatches.length < 2) {
    hourMatches = [...raw.matchAll(/(\d{1,2}):(\d{2})/g)].map((match) => ({
      hour: Number(match[1]),
      minute: Number(match[2]),
      meridiem: undefined,
      index: match.index ?? 0,
    }));
  }
  if (hourMatches.length < 2) return null;

  const daysText = raw.slice(0, hourMatches[0].index);
  const dayOfWeek = parseDays(daysText);
  if (dayOfWeek.length === 0) return null;

  const [open, close] = hourMatches;
  return {
    dayOfWeek,
    opens: to24h(open.hour, open.minute, open.meridiem),
    closes: to24h(close.hour, close.minute, close.meridiem),
  };
}

/** Repli explicite si le texte des réglages est illisible. */
export const FALLBACK_OPENING_HOURS: OpeningHoursSpec = {
  dayOfWeek: ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"],
  opens: "09:00",
  closes: "23:00",
};

/**
 * Horaires structurés, toujours dérivés de la config (jamais en dur).
 */
export function openingHoursFromConfig(hoursEn: string): OpeningHoursSpec {
  return parseOpeningHoursEn(hoursEn) ?? FALLBACK_OPENING_HOURS;
}
