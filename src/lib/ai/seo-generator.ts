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

async function llmSeoCopy(demo: SeoDemoInput): Promise<Partial<SeoCopy>> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY absente");
  const baseUrl = (process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
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
    if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Réponse LLM vide");
    return JSON.parse(content) as Partial<SeoCopy>;
  } finally { clearTimeout(timeout); }
}

const KEYS: (keyof SeoCopy)[] = ["metaTitle","metaDescription","metaDescriptionEn","metaTitleEn","imageAltAr","imageAltEn"];
const MAX_BY_KEY: Record<keyof SeoCopy, number> = {
  metaTitle: LIMITS.title, metaTitleEn: LIMITS.title,
  metaDescription: LIMITS.description, metaDescriptionEn: LIMITS.description,
  imageAltAr: LIMITS.alt, imageAltEn: LIMITS.alt,
};

export async function generateSeoCopy(demo: SeoDemoInput): Promise<{ copy: SeoCopy; engine: "llm" | "template" }> {
  const fallback = templateSeoCopy(demo);
  let raw: Partial<SeoCopy> = {};
  let engine: "llm" | "template" = "template";
  if (process.env.OPENAI_API_KEY?.trim()) {
    try { raw = await llmSeoCopy(demo); engine = "llm"; }
    catch (error) { console.warn("[ai-seo] repli gabarit :", error instanceof Error ? error.message : error); }
  }
  const copy = { ...fallback };
  for (const key of KEYS) {
    const value = raw[key];
    if (typeof value === "string" && value.trim().length > 0) copy[key] = clamp(value.trim(), MAX_BY_KEY[key]);
  }
  return { copy, engine };
}
