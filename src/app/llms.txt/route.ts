import { createHash } from "node:crypto";
import { getSiteDataCached } from "@/lib/store";
import { getDigitalCatalog } from "@/lib/digital-store";
import { buildLlmsTxt } from "@/lib/llms-txt";

/**
 * Route dynamique `/llms.txt` (standard llmstxt.org).
 *
 * Générée à partir de la base de données (`/admin`) et revalidée
 * automatiquement à chaque modification de configuration ou de contenu.
 */
export async function GET() {
  const [data, digitalProducts] = await Promise.all([
    getSiteDataCached(),
    getDigitalCatalog({ publicOnly: true }),
  ]);
  const body = buildLlmsTxt({ ...data, digitalProducts });
  const etag = `"${createHash("sha256").update(body).digest("base64url").slice(0, 32)}"`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Robots-Tag": "all",
      // ETag : permet aux crawlers IA de revalider sans re-télécharger
      // l'intégralité de la base de connaissances à chaque passage.
      ETag: etag,
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
