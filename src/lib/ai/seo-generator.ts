import { metaDescription } from "@/lib/seo";

export const LIMITS = { title: 60, description: 160, alt: 125 } as const;

export interface SeoDemoInput {
  title: string; titleEn: string;
  description: string; descriptionEn: string;
  sectorAr: string; sectorEn: string;
}
export interface SeoCopy {
  metaTitle: string; metaDescription: string;
  metaTitleEn: string; metaDescriptionEn: string;
  imageAltAr: string; imageAltEn: string;
}

/**
 * Moteur réellement utilisé pour produire les champs SEO :
 * - `llm`      : la clé OpenAI est configurée et l'appel a réussi ;
 * - `template` : aucune clé n'est configurée (comportement normal, silencieux) ;
 * - `error`    : une clé est configurée mais l'appel a échoué (401/403/429,
 *                timeout, réponse illisible…). Le gabarit local est renvoyé et
 *                `warning` explique la cause à l'admin.
 */
export type SeoEngine = "llm" | "template" | "error";

/**
 * Code court et stable remonté à l'admin et écrit dans les logs.
 * Aucun secret ni corps de réponse du LLM n'est exposé.
 */
export type SeoWarningCode =
  | "missing_key"
  | "timeout"
  | "invalid_json"
  | "empty_response"
  | "network_error"
  | "unexpected_error"
  | `http_${number}`;

export interface SeoGenerationResult {
  copy: SeoCopy;
  engine: SeoEngine;
  /** Renseigné pour `template` (missing_key) et `error` (cause). */
  warning?: SeoWarningCode;
}

function clamp(text: string, max: number): string {
  return metaDescription(text, max);
}

export function templateSeoCopy(demo: SeoDemoInput): SeoCopy {
  return {
    metaTitle: clamp(`${demo.title} — موقع من إنجاز نخبة`, LIMITS.title),
    metaDescription: clamp(`${demo.sectorAr} في طرابلس. ${demo.description}`, LIMITS.description),
    metaTitleEn: clamp(`${demo.titleEn} — website by Nukhba`, LIMITS.title),
    metaDescriptionEn: clamp(`${demo.sectorEn} in Tripoli, Libya. ${demo.descriptionEn}`, LIMITS.description),
    imageAltAr: clamp(`${demo.title} — ${demo.sectorAr}، موقع من تصميم نخبة في طرابلس`, LIMITS.alt),
    imageAltEn: clamp(`${demo.titleEn} — ${demo.sectorEn} website designed by Nukhba, Tripoli`, LIMITS.alt),
  };
}

/**
 * Complète automatiquement tout champ SEO bilingue vide d'une réalisation
 * avec le gabarit optimisé local, sans jamais écraser un champ déjà saisi.
 */
export function ensureDemoSeoFields<T extends SeoDemoInput & Partial<SeoCopy>>(
  demo: T,
): T & SeoCopy {
  const fallback = templateSeoCopy(demo);
  return {
    ...demo,
    metaTitle: demo.metaTitle?.trim() ? clamp(demo.metaTitle.trim(), LIMITS.title) : fallback.metaTitle,
    metaDescription: demo.metaDescription?.trim()
      ? clamp(demo.metaDescription.trim(), LIMITS.description)
      : fallback.metaDescription,
    metaTitleEn: demo.metaTitleEn?.trim() ? clamp(demo.metaTitleEn.trim(), LIMITS.title) : fallback.metaTitleEn,
    metaDescriptionEn: demo.metaDescriptionEn?.trim()
      ? clamp(demo.metaDescriptionEn.trim(), LIMITS.description)
      : fallback.metaDescriptionEn,
    imageAltAr: demo.imageAltAr?.trim() ? clamp(demo.imageAltAr.trim(), LIMITS.alt) : fallback.imageAltAr,
    imageAltEn: demo.imageAltEn?.trim() ? clamp(demo.imageAltEn.trim(), LIMITS.alt) : fallback.imageAltEn,
  };
}

function buildPrompt(demo: SeoDemoInput): string {
  return [
    "You are an SEO copywriter for a premium web agency in Tripoli, Libya.",
    "Generate metadata for ONE portfolio project. Arabic (ar, RTL) and English (en).",
    "Rules:",
    `- metaTitle*: max ${LIMITS.title} chars, include the project name, no brand suffix, no quotes or emoji.`,
    `- metaDescription*: max ${LIMITS.description} chars, persuasive, mention Tripoli/Libya and the sector, one sentence.`,
    `- imageAlt*: max ${LIMITS.alt} chars, factual image description of the project.`,
    "Output ONLY a JSON object with exactly these keys:",
    "metaTitle, metaDescription, metaTitleEn, metaDescriptionEn, imageAltAr, imageAltEn",
    "", "Project data:", JSON.stringify(demo, null, 2),
  ].join("\n");
}

const KEYS: (keyof SeoCopy)[] = ["metaTitle","metaDescription","metaDescriptionEn","metaTitleEn","imageAltAr","imageAltEn"];
const MAX_BY_KEY: Record<keyof SeoCopy, number> = {
  metaTitle: LIMITS.title, metaTitleEn: LIMITS.title,
  metaDescription: LIMITS.description, metaDescriptionEn: LIMITS.description,
  imageAltAr: LIMITS.alt, imageAltEn: LIMITS.alt,
};

type LlmOutcome =
  | { ok: true; raw: Partial<SeoCopy> }
  | { ok: false; code: SeoWarningCode };

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "AbortError"
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Appelle le LLM et renvoie soit les champs bruts, soit un code d'échec.
 * Ne lève jamais : `generateSeoCopy` décide du repli et de l'état exposé.
 * Ne journalise ni la clé ni le corps de la réponse.
 */
async function llmSeoCopy(demo: SeoDemoInput): Promise<LlmOutcome> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return { ok: false, code: "missing_key" };
  const baseUrl = (process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 20_000);
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model, temperature: 0.4, response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You output strict JSON only." },
          { role: "user", content: buildPrompt(demo) },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, code: `http_${res.status}` };
    let data: { choices?: { message?: { content?: string } }[] };
    try {
      data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    } catch {
      return { ok: false, code: "invalid_json" };
    }
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.trim().length === 0) {
      return { ok: false, code: "empty_response" };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return { ok: false, code: "invalid_json" };
    }
    if (!isPlainObject(parsed)) return { ok: false, code: "invalid_json" };
    const raw = parsed as Partial<SeoCopy>;
    const hasValue = KEYS.some(
      (key) => typeof raw[key] === "string" && (raw[key] as string).trim().length > 0,
    );
    if (!hasValue) return { ok: false, code: "empty_response" };
    return { ok: true, raw };
  } catch (error) {
    if (timedOut || isAbortError(error)) return { ok: false, code: "timeout" };
    if (error instanceof TypeError) return { ok: false, code: "network_error" };
    return { ok: false, code: "unexpected_error" };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Génère les six champs SEO bilingues d'une réalisation.
 *
 * `copy` est toujours renvoyé (repli gabarit local si besoin). L'état
 * `engine` + `warning` permet à l'admin de distinguer une absence de clé
 * (normal) d'une clé refusée ou d'un service indisponible (à corriger).
 */
export async function generateSeoCopy(demo: SeoDemoInput): Promise<SeoGenerationResult> {
  const fallback = templateSeoCopy(demo);
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return { copy: fallback, engine: "template", warning: "missing_key" };
  }
  const outcome = await llmSeoCopy(demo);
  if (!outcome.ok) {
    console.warn(`[ai-seo] appel LLM échoué (${outcome.code}) — repli sur le gabarit local.`);
    return { copy: fallback, engine: "error", warning: outcome.code };
  }
  const copy = { ...fallback };
  for (const key of KEYS) {
    const value = outcome.raw[key];
    if (typeof value === "string" && value.trim().length > 0) copy[key] = clamp(value.trim(), MAX_BY_KEY[key]);
  }
  return { copy, engine: "llm" };
}

export interface SeoBatchGenerationResult {
  items: SeoGenerationResult[];
  engine: SeoEngine;
  warning?: SeoWarningCode;
}

/**
 * Génère en lot les champs SEO bilingues pour plusieurs réalisations.
 * Exécute par vagues de 3 requêtes max pour préserver les quotas OpenAI.
 */
export async function generateSeoCopyBatch(
  demos: readonly SeoDemoInput[],
): Promise<SeoBatchGenerationResult> {
  if (demos.length === 0) {
    return { items: [], engine: process.env.OPENAI_API_KEY?.trim() ? "llm" : "template" };
  }
  const items: SeoGenerationResult[] = [];
  const chunkSize = 3;
  for (let i = 0; i < demos.length; i += chunkSize) {
    const slice = demos.slice(i, i + chunkSize);
    const batch = await Promise.all(slice.map((d) => generateSeoCopy(d)));
    items.push(...batch);
  }
  const errorItem = items.find((r) => r.engine === "error");
  const llmItem = items.find((r) => r.engine === "llm");
  const engine: SeoEngine = errorItem ? "error" : llmItem ? "llm" : "template";
  const warning = errorItem?.warning ?? items.find((r) => r.warning)?.warning;
  return { items, engine, ...(warning ? { warning } : {}) };
}
