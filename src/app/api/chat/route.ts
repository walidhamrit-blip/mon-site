import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

// Initialisation de Claude connectée à la passerelle Vercel
const anthropic = createAnthropic({
  baseURL: 'https://ai-gateway.vercel.sh/v1',
  apiKey: process.env.AI_GATEWAY_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    const { text } = await generateText({
      model: anthropic('claude-3-5-sonnet-20240620'),
      prompt: prompt || 'Bonjour, présente-toi.',
    });

    return Response.json({ text });
  } catch (error) {
    return Response.json({ error: 'Une erreur est survenue' }, { status: 500 });
  }
}
