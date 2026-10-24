import { createHash } from "node:crypto";
import { getSiteDataCached } from "@/lib/store";
import { getDigitalCatalog } from "@/lib/digital-store";
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
  const [data, digitalProducts] = await Promise.all([
    getSiteDataCached(),
    getDigitalCatalog({ publicOnly: true }),
  ]);
  const body = buildLlmsFullTxt({ ...data, digitalProducts });
  const etag = `"${createHash("sha256").update(body).digest("base64url").slice(0, 32)}"`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Robots-Tag": "all",
      "ETag": etag,
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
