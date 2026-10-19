import { getSiteDataCached } from "@/lib/store";
import { buildLlmsFullTxt } from "@/lib/llms-txt";

/**
 * Route dynamique `/llms-full.txt` (extension llmstxt.org pour ingestion
 * RAG / LLM complète).
 *
 * Expose en un seul document Markdown bilingue (AR + EN) la totalité du
 * catalogue de réalisations, les tarifs, les services à la carte, le
 * processus en 5 étapes, les témoignages et la FAQ.
 */
export async function GET() {
  const data = await getSiteDataCached();
  const body = buildLlmsFullTxt(data);

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Robots-Tag": "all",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
