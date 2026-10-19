import { getSiteDataCached } from "@/lib/store";
import { buildLlmsTxt } from "@/lib/llms-txt";

/**
 * Route dynamique `/llms.txt` (standard llmstxt.org).
 *
 * Générée à partir de la base de données (`/admin`) et revalidée
 * automatiquement à chaque modification de configuration ou de contenu.
 */
export async function GET() {
  const data = await getSiteDataCached();
  const body = buildLlmsTxt(data);

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Robots-Tag": "all",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
