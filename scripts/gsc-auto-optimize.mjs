#!/usr/bin/env node
/**
 * Pilote automatique SEO fermé (Search Console → Surcharges SERP sécurisées)
 *
 * Lit `reports/gsc-monitor-latest.json` et `src/lib/seo-autopilot-data.ts`,
 * sélectionne jusqu'à 2 nouvelles pages à fort potentiel (Quick Wins Page 2
 * avec >= 8 impressions ou Page 1 CTR < 3,5 % avec >= 15 impressions),
 * applique strictement le verrou anti-yo-yo de 18 jours par URL, valide
 * les plafonds SERP (title <= 60, description 50..155, 0 promesse interdite)
 * et met à jour `src/lib/seo-autopilot-data.ts` + `reports/gsc-autopilot-latest.json`.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const FORBIDDEN_COPY_RE =
  /delivered in 7 days|7-day delivery|تسليم في 7 أيام|goes live in 7 to 14 days|delivered in 7-10 days|We reply in 2 hours|we reply within 2 hours|نرد في أقل من ساعتين|Open now · fast reply|bank transfer on request|\.vercel\.app|nokhba\.net/i;

const LEGACY_SEED_SLUGS = new Set([
  "spotify-premium",
  "steam-wallet",
  "playstation-store",
  "xbox-gift-card",
  "robux-roblox",
  "google-play-gift",
  "amazon-gift-card",
  "nvidia-redeem",
]);

const ROUTE_LABELS = {
  "/": { ar: "تصميم مواقع ومتاجر", en: "Websites & Digital Store" },
  "/creation-sites": { ar: "تصميم مواقع احترافية", en: "Custom Website Creation" },
  "/demos": { ar: "معرض المواقع الحية", en: "Live Website Portfolio" },
  "/services": { ar: "خدمات الويب والتطوير", en: "Web & Design Services" },
  "/audit": { ar: "فحص الموقع والسيو", en: "Website & SEO Audit" },
  "/sectors": { ar: "مواقع حسب القطاع", en: "Industry Website Models" },
  "/blog": { ar: "مدونة الويب والسيو", en: "Web & SEO Guides" },
  "/compare": { ar: "مقارنة منصات المواقع", en: "Website Platform Comparisons" },
  "/products": { ar: "برمجيات وأنظمة الشركات", en: "Business Software & POS" },
  "/apps": { ar: "تطبيقات الجوال والويب", en: "Smart Web & Mobile Apps" },
  "/codes": { ar: "متجر الأكواد والبطاقات", en: "Gift Cards & Game Codes" },
  "/pricing": { ar: "أسعار تصميم المواقع", en: "Website & Store Pricing" },
  "/contact": { ar: "التواصل وعرض السعر", en: "Contact & Free Quote" },
  "/abonnements": { ar: "باقات الصيانة والاشتراك", en: "Maintenance & Subscriptions" },
};

export function normalizePath(urlOrPath) {
  const raw = String(urlOrPath ?? "").trim();
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

export function isEligiblePath(urlOrPath) {
  const path = normalizePath(urlOrPath);
  if (
    path === "/" ||
    path === "/admin" ||
    path.startsWith("/admin/") ||
    path.startsWith("/api/") ||
    path.startsWith("/pay/") ||
    path.startsWith("/livraison/") ||
    path.startsWith("/live-demos/") ||
    path === "/codes/commande" ||
    path.startsWith("/codes/commande/") ||
    path === "/mentions-legales" ||
    path === "/conditions" ||
    path === "/remboursement"
  ) {
    return false;
  }
  if (path.startsWith("/codes/") && !path.startsWith("/codes/category/")) {
    const slug = decodeURIComponent(path.slice("/codes/".length)).toLowerCase();
    if (LEGACY_SEED_SLUGS.has(slug)) return false;
  }
  return true;
}

export function checkCooldown(path, state, nowMs = Date.now()) {
  const norm = normalizePath(path);
  const item = state?.history?.[norm];
  if (!item?.lastOptimizedAt) {
    return { locked: false, daysRemaining: 0, unlockDate: null };
  }
  const ts = Date.parse(item.lastOptimizedAt);
  if (Number.isNaN(ts)) {
    return { locked: false, daysRemaining: 0, unlockDate: null };
  }
  const cooldownDays = Math.max(14, Number(state?.cooldownDays || 18));
  const unlockMs = ts + cooldownDays * 86_400_000;
  const unlockDate = new Date(unlockMs).toISOString().slice(0, 10);
  if (nowMs >= unlockMs) {
    return { locked: false, daysRemaining: 0, unlockDate };
  }
  return {
    locked: true,
    daysRemaining: Math.ceil((unlockMs - nowMs) / 86_400_000),
    unlockDate,
  };
}

function expandForLengthCheck(text, locale) {
  const city = locale === "ar" ? "طرابلس" : "Tripoli";
  const country = locale === "ar" ? "ليبيا" : "Libya";
  return String(text ?? "")
    .replaceAll("{city}", city)
    .replaceAll("{country}", country)
    .replaceAll("{cityEn}", "Tripoli")
    .replaceAll("{countryEn}", "Libya")
    .replaceAll("{place}", `${city}، ${country}`)
    .replaceAll("{placeEn}", "Tripoli, Libya");
}

export function validateGeneratedOverride(override) {
  const errors = [];
  const checks = [
    ["titleAr", override.titleAr, 18, 52, "ar"],
    ["titleEn", override.titleEn, 18, 50, "en"],
    ["descriptionAr", override.descriptionAr, 55, 152, "ar"],
    ["descriptionEn", override.descriptionEn, 55, 152, "en"],
  ];

  for (const [name, rawVal, min, max, locale] of checks) {
    const raw = String(rawVal ?? "").trim();
    const expanded = expandForLengthCheck(raw, locale);
    if (raw.length < min || expanded.length > max) {
      errors.push(`${name}_len_${expanded.length}_bounds_${min}_${max}`);
    }
    if (raw.endsWith("…") || raw.endsWith("...")) {
      errors.push(`${name}_truncated`);
    }
    if (FORBIDDEN_COPY_RE.test(raw)) {
      errors.push(`${name}_forbidden`);
    }
  }

  for (const [name, title] of [
    ["titleAr", override.titleAr],
    ["titleEn", override.titleEn],
  ]) {
    const hits = (String(title ?? "").match(/nukhba|نخبة/gi) || []).length;
    if (hits > 1) errors.push(`${name}_duplicate_brand`);
  }

  return { valid: errors.length === 0, errors };
}

function humanizeSlug(slug, maxLen = 22) {
  const words = String(slug ?? "")
    .replace(/^fzr-(giftcard|topup|gamekey)-/i, "")
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => (w.length <= 3 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)));
  let out = "";
  for (const word of words) {
    const next = out ? `${out} ${word}` : word;
    if (next.length > maxLen) break;
    out = next;
  }
  return out || "Digital Solution";
}

function cleanQueryLabel(query, wantArabic) {
  const q = String(query ?? "").trim();
  if (!q || q.startsWith("(") || q.length < 4 || q.length > 22) return null;
  if (/nukhba|نخبة|http|\.ly|\.com/i.test(q)) return null;
  const hasArabic = /[\u0600-\u06FF]/.test(q);
  if (wantArabic && !hasArabic) return null;
  if (!wantArabic && hasArabic) return null;
  return q;
}

export function buildDeterministicAutopilotOverride(candidate, nowIso = new Date().toISOString()) {
  const path = normalizePath(candidate.page);
  const segments = path.split("/").filter(Boolean);
  const slug = segments[segments.length - 1] || "";
  const known = ROUTE_LABELS[path];
  const queryAr = cleanQueryLabel(candidate.query, true);
  const queryEn = cleanQueryLabel(candidate.query, false);
  const slugEn = humanizeSlug(slug, 22);
  const labelEn = known?.en || queryEn || slugEn;
  const labelAr = known?.ar || queryAr || slugEn;

  let titleAr;
  let titleEn;
  let descriptionAr;
  let descriptionEn;

  if (path.startsWith("/demos/")) {
    titleAr = `معاينة ${labelAr} في {city} — موقع بـ35$`;
    titleEn = `${labelEn} Demo ({cityEn}) — $35 Website`;
    descriptionAr = `استعرض نموذج ${labelAr} التفاعلي في {city}: تصميم متجاوب بسعر موحد 35$ يشمل الكود وتخصيص محتواك الأول مجاناً مع خيارات المتجر.`;
    descriptionEn = `View the live ${labelEn} demo in {cityEn}: responsive design at a $35 base with source code, free initial setup and optional store.`;
  } else if (path.startsWith("/sectors/")) {
    titleAr = `تصميم مواقع ${labelAr} في {country} — 35$`;
    titleEn = `${labelEn} Websites ({countryEn}) — $35`;
    descriptionAr = `مواقع احترافية لقطاع ${labelAr} في {city} بسعر أساسي 35$ (USD/USDT) يشمل الكود وتخصيص المحتوى الأول مجاناً مع خيارات الحجز أو المتجر.`;
    descriptionEn = `Custom ${labelEn} websites in {cityEn} from a $35 base (USD/USDT) with source code, free initial setup and optional booking or online store.`;
  } else if (path.startsWith("/services/")) {
    titleAr = `خدمة ${labelAr} في {city} — أسعار بالدولار`;
    titleEn = `${labelEn} in {cityEn} — Clear USD Pricing`;
    descriptionAr = `اطلب خدمة ${labelAr} في {city} بأسعار واضحة بالدولار أو USDT: تحديد دقيق للنطاق قبل الدفع وتواصل مباشر عبر واتساب مع فريق نخبة.`;
    descriptionEn = `Order ${labelEn} in {cityEn} with transparent USD or USDT pricing: clear scope confirmed before payment and direct WhatsApp support.`;
  } else if (path.startsWith("/compare/")) {
    titleAr = `مقارنة ${labelAr} — التكلفة الحقيقية بالدولار`;
    titleEn = `${labelEn} Comparison — Real Cost in USD`;
    descriptionAr = `مقارنة عملية حول ${labelAr} للشركات في {country}: الفروقات التقنية والرسوم المتكررة مقابل عرض الموقع الموحد بـ35$ لمرة واحدة بالدولار أو USDT.`;
    descriptionEn = `Practical ${labelEn} comparison for {countryEn} businesses: weigh recurring fees and ownership against a one-time $35 base website in USD/USDT.`;
  } else if (path.startsWith("/blog/")) {
    titleAr = `${labelAr} — دليل عملي في {country}`;
    titleEn = `${labelEn} — Practical Guide ({countryEn})`;
    descriptionAr = `دليل عملي ومفصل حول ${labelAr} لأصحاب المشاريع في {city} و{country}: خطوات واضحة وأمثلة تطبيقية وتكاليف شفافة بالدولار وUSDT.`;
    descriptionEn = `Practical guide to ${labelAr} for businesses in {cityEn}, {countryEn}: clear steps, real examples and transparent USD or USDT pricing.`;
  } else if (path.startsWith("/codes")) {
    titleAr = `${labelAr} — أكواد وبطاقات بالدولار وUSDT`;
    titleEn = `${labelEn} — Digital Codes in USD & USDT`;
    descriptionAr = `اشترِ ${labelAr} بأسعار واضحة بالدولار أو USDT في {country}: التحقق من المنطقة قبل الدفع وتسليم إلكتروني عبر البريد الإلكتروني بعد التأكيد.`;
    descriptionEn = `Buy ${labelEn} with clear USD or USDT pricing in {countryEn}: region displayed before checkout and electronic code delivery by email.`;
  } else {
    titleAr = `${labelAr} في {city} — عرض موحد 35$`;
    titleEn = `${labelEn} ({cityEn}) — $35 Base Offer`;
    descriptionAr = `اكتشف ${labelAr} في {city}: موقع مخصص بسعر 35$ يشمل الكود وتخصيص المحتوى الأول مجاناً مع دفع USD أو USDT.`;
    descriptionEn = `Discover ${labelEn} in {cityEn}: $35 base website with source code, free initial setup and clear USD/USDT options.`;
  }

  return {
    titleAr,
    descriptionAr,
    titleEn,
    descriptionEn,
    triggerQuery: candidate.query || "(aggregated)",
    reason: candidate.reason,
    updatedAt: nowIso,
  };
}

export function selectAutopilotCandidates(report, state, options = {}) {
  const nowMs = options.nowMs ?? Date.now();
  const maxUrls = Math.max(1, Math.min(5, Number(options.maxUrls ?? 2)));
  const minQuickWinImpr = Number(options.minQuickWinImpressions ?? 8);
  const minLowCtrImpr = Number(options.minLowCtrImpressions ?? 15);

  const rawPool = [
    ...(report?.lowCtrPage1 ?? [])
      .filter((r) => Number(r.impressions) >= minLowCtrImpr && Number(r.ctr) < 0.035)
      .map((r) => ({ ...r, reason: "low_ctr_page1", score: Number(r.impressions) * 1.4 })),
    ...(report?.quickWins ?? [])
      .filter((r) => Number(r.impressions) >= minQuickWinImpr)
      .map((r) => ({ ...r, reason: "quick_win_page2", score: Number(r.impressions) })),
  ];

  const byPath = new Map();
  const skippedCooldown = [];

  for (const item of rawPool) {
    const path = normalizePath(item.page);
    if (!isEligiblePath(path)) continue;
    const cooldown = checkCooldown(path, state, nowMs);
    if (cooldown.locked) {
      if (!skippedCooldown.some((s) => s.path === path)) {
        skippedCooldown.push({
          path,
          daysRemaining: cooldown.daysRemaining,
          unlockDate: cooldown.unlockDate,
        });
      }
      continue;
    }
    const existing = byPath.get(path);
    if (!existing || item.score > existing.score) {
      byPath.set(path, { ...item, path });
    }
  }

  const selected = [...byPath.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, maxUrls);

  return { selected, skippedCooldown };
}

export function parseAutopilotDataModule(source) {
  const match = String(source).match(/SEO_AUTOPILOT_STATE:\s*SeoAutopilotState\s*=\s*(\{[\s\S]*\});\s*$/);
  if (!match) {
    throw new Error("Format inattendu dans src/lib/seo-autopilot-data.ts");
  }
  return JSON.parse(match[1]);
}

export function serializeAutopilotDataModule(state) {
  return [
    'import type { SeoAutopilotState } from "@/lib/seo-autopilot";',
    "",
    "/**",
    " * État persistant du pilote automatique SEO Search Console.",
    " *",
    " * - `cooldownDays` : durée minimale (règle anti-yo-yo 14–21j) pendant laquelle",
    " *   une URL fraîchement optimisée reste verrouillée afin de laisser Google",
    " *   stabiliser sa position et mesurer le gain de CTR.",
    " * - `history` : journal horodaté des optimisations par chemin relatif.",
    " * - `overrides` : surcharges SERP bilingues (`<title>` & `meta description`)",
    " *   générées automatiquement par `scripts/gsc-auto-optimize.mjs` et validées",
    " *   avant commit.",
    " */",
    `export const SEO_AUTOPILOT_STATE: SeoAutopilotState = ${JSON.stringify(state, null, 2)};`,
    "",
  ].join("\n");
}

async function maybeRefineWithOpenAi(candidate, fallback) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return fallback;
  const baseUrl = (process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const prompt = [
      "Generate high-CTR bilingual SERP metadata for a Nukhba web agency / digital codes page.",
      `Path: ${candidate.path}`,
      `Search Console Query: ${candidate.query}`,
      `Position: ${candidate.position}, Impressions: ${candidate.impressions}, CTR: ${(candidate.ctr * 100).toFixed(1)}%`,
      "Strict constraints:",
      "- Use {city}/{country} in Arabic and {cityEn}/{countryEn} in English instead of hardcoding Tripoli/Libya.",
      "- Never promise 7-day delivery or 2-hour reply. Base static website offer is $35 (USD/USDT) with source code & free initial content setup.",
      "- titleAr <= 48 chars, titleEn <= 46 chars (no brand suffix, no ellipsis).",
      "- descriptionAr 70..145 chars, descriptionEn 70..145 chars (complete sentence, no ellipsis).",
      "Output strict JSON with keys: titleAr, descriptionAr, titleEn, descriptionEn.",
    ].join("\n");

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });
    if (!res.ok) return fallback;
    const data = await res.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
    const candidateOverride = {
      ...fallback,
      titleAr: String(parsed.titleAr || "").trim(),
      descriptionAr: String(parsed.descriptionAr || "").trim(),
      titleEn: String(parsed.titleEn || "").trim(),
      descriptionEn: String(parsed.descriptionEn || "").trim(),
    };
    return validateGeneratedOverride(candidateOverride).valid ? candidateOverride : fallback;
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}

export async function runAutopilotOptimization({
  report,
  state,
  nowMs = Date.now(),
  maxUrls = 2,
  useOpenAi = false,
}) {
  const nowIso = new Date(nowMs).toISOString();
  const nextState = {
    cooldownDays: state.cooldownDays || 18,
    history: { ...(state.history || {}) },
    overrides: { ...(state.overrides || {}) },
  };

  const { selected, skippedCooldown } = selectAutopilotCandidates(report, nextState, {
    nowMs,
    maxUrls,
  });

  const optimizedToday = [];
  for (const candidate of selected) {
    const det = buildDeterministicAutopilotOverride(candidate, nowIso);
    const finalOverride = useOpenAi ? await maybeRefineWithOpenAi(candidate, det) : det;
    const check = validateGeneratedOverride(finalOverride);
    if (!check.valid) continue;

    nextState.overrides[candidate.path] = finalOverride;
    nextState.history[candidate.path] = {
      lastOptimizedAt: nowIso,
      baselinePosition: Number(Number(candidate.position || 0).toFixed(1)),
      baselineCtr: Number(Number(candidate.ctr || 0).toFixed(4)),
      baselineImpressions: Number(candidate.impressions || 0),
      note: `Auto-optimisé (${candidate.reason})`,
    };
    optimizedToday.push({
      path: candidate.path,
      reason: candidate.reason,
      query: candidate.query,
      impressions: candidate.impressions,
      position: candidate.position,
      titleAr: finalOverride.titleAr,
      titleEn: finalOverride.titleEn,
    });
  }

  const activeLocks = Object.keys(nextState.history)
    .map((p) => ({ path: p, ...checkCooldown(p, nextState, nowMs) }))
    .filter((x) => x.locked)
    .sort((a, b) => a.daysRemaining - b.daysRemaining);

  return {
    changed: optimizedToday.length > 0,
    optimizedToday,
    skippedCooldown,
    activeLocks,
    nextState,
  };
}

export function renderAutopilotMarkdownSection(result) {
  const lines = [
    "",
    "## 6. Pilote automatique SEO (Auto-Optimisation & Anti-Yo-Yo 18j)",
    "",
  ];
  if (result.optimizedToday.length > 0) {
    lines.push(
      `- **Optimisées automatiquement aujourd'hui (${result.optimizedToday.length})** : ${result.optimizedToday.map((u) => `\`${u.path}\` (${u.reason})`).join(", ")}`,
    );
  } else {
    lines.push(
      "- **Auto-optimisation du jour** : aucune nouvelle page éligible hors période de stabilisation.",
    );
  }
  if (result.activeLocks.length > 0) {
    lines.push(
      `- **Pages protégées (anti-yo-yo 18j — ${result.activeLocks.length})** : ${result.activeLocks.map((l) => `\`${l.path}\` (jusqu'au ${l.unlockDate})`).join(" · ")}`,
    );
  }
  return `${lines.join("\n")}\n`;
}

async function main() {
  const reportPath = resolve(process.cwd(), "reports/gsc-monitor-latest.json");
  const reportMdPath = resolve(process.cwd(), "reports/gsc-monitor-latest.md");
  const dataPath = resolve(process.cwd(), "src/lib/seo-autopilot-data.ts");
  const outJsonPath = resolve(process.cwd(), "reports/gsc-autopilot-latest.json");

  if (!existsSync(reportPath) || !existsSync(dataPath)) {
    console.log("ℹ️ Rapport GSC ou état autopilot absent — étape ignorée.");
    return;
  }

  const report = JSON.parse(readFileSync(reportPath, "utf8"));
  if (report.status !== "ok") {
    console.log(`ℹ️ Rapport GSC statut=${report.status} — auto-optimisation ignorée.`);
    return;
  }

  const currentState = parseAutopilotDataModule(readFileSync(dataPath, "utf8"));
  const result = await runAutopilotOptimization({
    report,
    state: currentState,
    useOpenAi: Boolean(process.env.OPENAI_API_KEY?.trim()),
  });

  if (result.changed) {
    writeFileSync(dataPath, serializeAutopilotDataModule(result.nextState), "utf8");
    console.log(`✅ ${result.optimizedToday.length} URL(s) auto-optimisée(s) : ${result.optimizedToday.map((u) => u.path).join(", ")}`);
  } else {
    console.log(`✅ Aucune nouvelle URL à retoucher aujourd'hui (${result.activeLocks.length} URL(s) sous protection anti-yo-yo 18j).`);
  }

  if (existsSync(reportMdPath)) {
    const existingMd = readFileSync(reportMdPath, "utf8");
    if (!existingMd.includes("## 6. Pilote automatique SEO")) {
      writeFileSync(reportMdPath, `${existingMd.trimEnd()}\n${renderAutopilotMarkdownSection(result)}`, "utf8");
    }
  }

  mkdirSync(dirname(outJsonPath), { recursive: true });
  writeFileSync(
    outJsonPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        changed: result.changed,
        optimizedToday: result.optimizedToday,
        activeLocks: result.activeLocks,
      },
      null,
      2,
    ),
    "utf8",
  );
}

const isDirectRun =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((err) => {
    console.error("❌ Erreur gsc-auto-optimize :", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
