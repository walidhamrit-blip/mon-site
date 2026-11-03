import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { z } from "zod";
import { enforceSameOrigin } from "@/lib/csrf";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSiteDataCached } from "@/lib/store";
import { digitalCatalogStatus, getDigitalCatalog } from "@/lib/digital-store";
import {
  actionsFromText,
  answerLocally,
  buildSiteKnowledge,
  buildSystemPrompt,
  detectLanguage,
  starterSuggestions,
  type AssistantLang,
  type AssistantReply,
  type SiteKnowledge,
} from "@/lib/site-assistant";

/**
 * Assistant du site — `/api/chat`.
 *
 * Répond aux questions des visiteurs sur TOUT le contenu du site (formules,
 * paiement crypto, abonnements, services, boutique de codes, portfolio,
 * secteurs, comparatifs, blog, conditions, remboursement, contact) en
 * arabe, anglais ou français.
 *
 *  1. La connaissance est construite à la demande à partir des données
 *     réelles (réglages /admin, contenu éditorial, catalogue digital live)
 *     et mémorisée 2 minutes.
 *  2. Si une clé LLM est configurée (`AI_GATEWAY_API_KEY` → Vercel AI
 *     Gateway, ou `OPENAI_API_KEY` en repli), la réponse est générée par le
 *     modèle, ancrée sur un prompt système = résumé du site + fiches
 *     pertinentes (retrieval par mots-clés, indispensable car le catalogue
 *     peut dépasser 2 000 produits).
 *  3. Sans clé, ou si l'appel échoue / dépasse le délai, on renvoie la
 *     réponse déterministe locale — le visiteur a toujours une réponse.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MESSAGE_CHARS = 1000;
const MAX_HISTORY = 12;
const MAX_OUTPUT_TOKENS = 700;
const LLM_TIMEOUT_MS = 20_000;
const KNOWLEDGE_TTL_MS = 120_000;

const DEFAULT_GATEWAY_MODEL = "anthropic/claude-sonnet-5.5";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

const RATE_LIMIT = { prefix: "chat", windowMs: 60_000, max: 20, minIntervalMs: 500 };

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(MAX_MESSAGE_CHARS * 2),
});

const bodySchema = z
  .object({
    prompt: z.string().trim().min(1).max(MAX_MESSAGE_CHARS).optional(),
    messages: z.array(messageSchema).max(MAX_HISTORY * 2).optional(),
    locale: z.enum(["ar", "en", "fr"]).optional(),
  })
  .refine((body) => body.prompt || (body.messages && body.messages.some((m) => m.role === "user")), {
    message: "Un message utilisateur est requis.",
  });

type ChatMessage = z.infer<typeof messageSchema>;

/* ───────────────────────── Connaissance (mémo 2 min) ────────────────────── */

let knowledgeCache: { at: number; value: SiteKnowledge } | null = null;

async function loadKnowledge(): Promise<SiteKnowledge> {
  const now = Date.now();
  // Une panne de catalogue signalée entre-temps (par /codes, le cron…)
  // invalide le mémo : l'assistant ne doit plus citer de prix produit.
  if (
    knowledgeCache &&
    now - knowledgeCache.at < KNOWLEDGE_TTL_MS &&
    !digitalCatalogStatus().degraded
  ) {
    return knowledgeCache.value;
  }
  const site = await getSiteDataCached();
  let products: Awaited<ReturnType<typeof getDigitalCatalog>> = [];
  try {
    products = await getDigitalCatalog({ publicOnly: true });
  } catch (error) {
    console.error("[/api/chat] catalogue digital indisponible :", error instanceof Error ? error.message : error);
  }
  const degraded = digitalCatalogStatus().degraded;
  const value = buildSiteKnowledge({ config: site.config, content: site.content, digitalProducts: products, degraded });
  // Un repli dû à une panne n'est pas mémorisé : dès que la base revient,
  // l'assistant doit le voir immédiatement.
  if (!degraded) knowledgeCache = { at: now, value };
  return value;
}

/* ───────────────────────── Fournisseurs LLM ─────────────────────────────── */

interface LlmProvider {
  name: "gateway" | "openai";
  run: (system: string, messages: ChatMessage[], signal: AbortSignal) => Promise<string>;
}

function resolveProvider(): LlmProvider | null {
  const gatewayKey = process.env.AI_GATEWAY_API_KEY?.trim();
  if (gatewayKey) {
    const anthropic = createAnthropic({
      baseURL: process.env.AI_GATEWAY_BASE_URL?.trim() || "https://ai-gateway.vercel.sh/v1",
      apiKey: gatewayKey,
    });
    const model = process.env.AI_CHAT_MODEL?.trim() || DEFAULT_GATEWAY_MODEL;
    return {
      name: "gateway",
      run: async (system, messages, signal) => {
        const { text } = await generateText({
          model: anthropic(model),
          system,
          messages,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          temperature: 0.3,
          abortSignal: signal,
        });
        return text;
      },
    };
  }

  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (openaiKey) {
    const baseUrl = (process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/+$/, "");
    const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
    return {
      name: "openai",
      run: async (system, messages, signal) => {
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          signal,
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
          body: JSON.stringify({
            model,
            temperature: 0.3,
            max_tokens: MAX_OUTPUT_TOKENS,
            messages: [{ role: "system", content: system }, ...messages],
          }),
        });
        if (!response.ok) throw new Error(`OpenAI HTTP ${response.status}`);
        const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const text = payload.choices?.[0]?.message?.content;
        if (typeof text !== "string" || !text.trim()) throw new Error("OpenAI: réponse vide");
        return text;
      },
    };
  }
  return null;
}

/* ───────────────────────── Handler ──────────────────────────────────────── */

function json(body: unknown, init?: ResponseInit): Response {
  return Response.json(body, { ...init, headers: { "Cache-Control": "no-store", ...(init?.headers ?? {}) } });
}

export async function POST(req: Request): Promise<Response> {
  if (!enforceSameOrigin(req)) {
    return json({ error: "Origine non autorisée." }, { status: 403 });
  }
  const limit = checkRateLimit(RATE_LIMIT, req);
  if (!limit.allow) {
    return json(
      { error: "Trop de requêtes, réessayez dans un instant." },
      { status: 429, headers: { "Retry-After": String(Math.max(1, limit.retryAfterSec)) } },
    );
  }

  const raw: unknown = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return json({ error: "Requête invalide : « prompt » ou « messages » requis." }, { status: 400 });
  }

  // Historique borné : les derniers échanges, terminés par la question courante.
  const history: ChatMessage[] = (parsed.data.messages ?? []).slice(-MAX_HISTORY * 2);
  if (parsed.data.prompt) {
    if (history.at(-1)?.role === "user") history.pop();
    history.push({ role: "user", content: parsed.data.prompt });
  }
  while (history.length > 0 && history[0].role !== "user") history.shift();
  const current = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
  if (!current) {
    return json({ error: "Requête invalide : question vide." }, { status: 400 });
  }

  const uiLocale: AssistantLang = parsed.data.locale ?? "en";
  const lang = detectLanguage(current, uiLocale);

  let knowledge: SiteKnowledge;
  try {
    knowledge = await loadKnowledge();
  } catch (error) {
    console.error("[/api/chat] connaissance du site indisponible :", error);
    return json({ error: "Assistant temporairement indisponible." }, { status: 503 });
  }

  const local = answerLocally(knowledge, current, lang);
  const provider = resolveProvider();
  if (!provider) {
    return json(local satisfies AssistantReply);
  }

  const userQueries = history.filter((m) => m.role === "user").map((m) => m.content).slice(-3);
  const system = buildSystemPrompt(knowledge, userQueries, lang);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
  try {
    const text = (await provider.run(system, history, controller.signal)).trim();
    if (!text) throw new Error("réponse vide");
    const actions = actionsFromText(text, knowledge, lang);
    const reply: AssistantReply = {
      text,
      actions: actions.length > 0 ? actions : local.actions.slice(0, 1),
      suggestions: local.suggestions.length > 0 ? local.suggestions : starterSuggestions(lang).slice(0, 4),
      mode: "llm",
    };
    return json(reply);
  } catch (error) {
    // Détail côté serveur uniquement ; le visiteur reçoit la réponse locale.
    console.error(`[/api/chat] échec LLM (${provider.name}) :`, error instanceof Error ? error.message : error);
    return json(local satisfies AssistantReply);
  } finally {
    clearTimeout(timer);
  }
}
