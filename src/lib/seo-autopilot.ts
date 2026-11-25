import { isLegacySeedSlug } from "@/lib/digital-fallback";
import { SEO_AUTOPILOT_STATE } from "@/lib/seo-autopilot-data";

export const DEFAULT_AUTOPILOT_COOLDOWN_DAYS = 18;

export interface SeoAutopilotOverride {
  titleAr: string;
  descriptionAr: string;
  titleEn: string;
  descriptionEn: string;
  triggerQuery?: string;
  reason?: "quick_win_page2" | "low_ctr_page1";
  updatedAt: string;
}

export interface SeoAutopilotHistoryItem {
  lastOptimizedAt: string;
  baselinePosition?: number;
  baselineCtr?: number;
  baselineImpressions?: number;
  note?: string;
}

export interface SeoAutopilotState {
  cooldownDays: number;
  history: Record<string, SeoAutopilotHistoryItem>;
  overrides: Record<string, SeoAutopilotOverride>;
}

const FORBIDDEN_COPY_RE =
  /delivered in 7 days|7-day delivery|تسليم في 7 أيام|goes live in 7 to 14 days|delivered in 7-10 days|We reply in 2 hours|we reply within 2 hours|نرد في أقل من ساعتين|Open now · fast reply|bank transfer on request|\.vercel\.app/i;

/** Extrait un chemin canonique relatif propre (ex: "/pricing", "/demos/foo"). */
export function normalizeAutopilotPath(urlOrPath: string): string {
  const raw = (urlOrPath ?? "").trim();
  if (!raw) return "/";
  let pathname = raw;
  if (/^https?:\/\//i.test(raw)) {
    try {
      pathname = new URL(raw).pathname;
    } catch {
      return "/";
    }
  } else {
    pathname = raw.split(/[?#]/)[0] || "/";
  }
  const withSlash = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return withSlash === "/" ? "/" : withSlash.replace(/\/+$/, "");
}

/** Exclut les routes privées, transactionnelles ou redirigées en 308. */
export function isAutopilotEligiblePath(urlOrPath: string): boolean {
  const path = normalizeAutopilotPath(urlOrPath);
  if (
    path === "/admin" ||
    path.startsWith("/admin/") ||
    path.startsWith("/api/") ||
    path.startsWith("/pay/") ||
    path.startsWith("/livraison/") ||
    path.startsWith("/live-demos/") ||
    path === "/codes/commande" ||
    path.startsWith("/codes/commande/")
  ) {
    return false;
  }
  if (path.startsWith("/codes/") && !path.startsWith("/codes/category/")) {
    const slug = decodeURIComponent(path.slice("/codes/".length));
    if (isLegacySeedSlug(slug)) return false;
  }
  return true;
}

/** Vérifie la fenêtre anti-yo-yo (18 jours par défaut) pour une URL donnée. */
export function isUnderAntiYoYoCooldown(
  urlOrPath: string,
  state: SeoAutopilotState = SEO_AUTOPILOT_STATE,
  nowMs: number = Date.now(),
): { locked: boolean; daysRemaining: number; unlockDate: string | null } {
  const path = normalizeAutopilotPath(urlOrPath);
  const entry = state.history?.[path];
  if (!entry?.lastOptimizedAt) {
    return { locked: false, daysRemaining: 0, unlockDate: null };
  }
  const ts = Date.parse(entry.lastOptimizedAt);
  if (Number.isNaN(ts)) {
    return { locked: false, daysRemaining: 0, unlockDate: null };
  }
  const cooldownDays = Math.max(14, Number(state.cooldownDays || DEFAULT_AUTOPILOT_COOLDOWN_DAYS));
  const unlockMs = ts + cooldownDays * 86_400_000;
  if (nowMs >= unlockMs) {
    return { locked: false, daysRemaining: 0, unlockDate: new Date(unlockMs).toISOString().slice(0, 10) };
  }
  const daysRemaining = Math.ceil((unlockMs - nowMs) / 86_400_000);
  return {
    locked: true,
    daysRemaining,
    unlockDate: new Date(unlockMs).toISOString().slice(0, 10),
  };
}

/** Valide strictement les plafonds SERP et la conformité commerciale avant publication. */
export function validateAutopilotOverride(
  override: SeoAutopilotOverride,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const fields: Array<[string, string, number, number]> = [
    ["titleAr", override.titleAr, 18, 60],
    ["titleEn", override.titleEn, 18, 60],
    ["descriptionAr", override.descriptionAr, 50, 155],
    ["descriptionEn", override.descriptionEn, 50, 155],
  ];

  for (const [name, value, min, max] of fields) {
    const clean = (value ?? "").trim();
    if (clean.length < min || clean.length > max) {
      errors.push(`${name}_length_${clean.length}_expected_${min}_${max}`);
    }
    if (clean.endsWith("…") || clean.endsWith("...")) {
      errors.push(`${name}_truncated`);
    }
    if (FORBIDDEN_COPY_RE.test(clean)) {
      errors.push(`${name}_forbidden_claim`);
    }
  }

  for (const [name, title] of [
    ["titleAr", override.titleAr],
    ["titleEn", override.titleEn],
  ] as const) {
    const brandHits = ((title ?? "").match(/nukhba|نخبة/gi) || []).length;
    if (brandHits > 1) {
      errors.push(`${name}_duplicate_brand`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/** Retourne la surcharge SERP validée du pilote automatique pour `(path, locale)`. */
export function resolveAutopilotOverride(
  path: string,
  locale: "ar" | "en",
  state: SeoAutopilotState = SEO_AUTOPILOT_STATE,
): { title: string; description: string } | null {
  const key = normalizeAutopilotPath(path);
  const item = state.overrides?.[key];
  if (!item) return null;
  const check = validateAutopilotOverride(item);
  if (!check.valid) return null;
  return locale === "ar"
    ? { title: item.titleAr, description: item.descriptionAr }
    : { title: item.titleEn, description: item.descriptionEn };
}
