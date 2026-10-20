import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

// Initialisation de Claude connectée à la passerelle Vercel AI Gateway.
// Le provider AI SDK ajoute « /messages » à la baseURL : l'appel part donc
// vers https://ai-gateway.vercel.sh/v1/messages (endpoint compatible
// Anthropic Messages). La clé est lue depuis AI_GATEWAY_API_KEY
// (à définir dans Vercel → Settings → Environment Variables).
const anthropic = createAnthropic({
  baseURL: 'https://ai-gateway.vercel.sh/v1',
  apiKey: process.env.AI_GATEWAY_API_KEY,
});

// Sur AI Gateway, les modèles s'identifient au format « créateur/modèle ».
// Claude Sonnet 5.5 = dernier Sonnet en date (sept. 2026), bon équilibre
// qualité/coût pour un endpoint de chat. (L'ancien « claude-3-5-sonnet-
// 20240620 » est retiré du catalogue.)
const MODEL = 'anthropic/claude-sonnet-5.5';

// Garde-fous simples sur un endpoint public qui consomme des crédits.
const MAX_PROMPT_LENGTH = 4000;
const MAX_OUTPUT_TOKENS = 1024;

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json().catch(() => null);
    const prompt =
      body !== null && typeof body === 'object' && 'prompt' in body
        ? (body as { prompt?: unknown }).prompt
        : undefined;

    if (typeof prompt !== 'string' || prompt.trim().length === 0) {
      return Response.json(
        { error: 'Le champ « prompt » (texte non vide) est requis.' },
        { status: 400 },
      );
    }
    if (prompt.length > MAX_PROMPT_LENGTH) {
      return Response.json(
        {
          error: `Le prompt dépasse la limite de ${MAX_PROMPT_LENGTH} caractères.`,
        },
        { status: 400 },
      );
    }

    const { text } = await generateText({
      model: anthropic(MODEL),
      prompt,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    });

    return Response.json({ text });
  } catch (error) {
    // Détail côté serveur uniquement (logs Vercel) ; le client reçoit un
    // message générique pour ne rien exposer (clé, quota, stack…).
    console.error('[/api/chat] Échec de l’appel à Claude :', error);
    return Response.json(
      { error: 'Une erreur est survenue' },
      { status: 500 },
    );
  }
}
