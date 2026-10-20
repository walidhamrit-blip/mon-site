import { getAllKnownDemos, getSiteDataCached } from "@/lib/store";

/**
 * Liste publique et légère des réalisations — consommée par
 * `scripts/capture-previews.mjs` (workflow « demo-previews ») pour capturer
 * les sites clients réellement publiés, y compris ceux ajoutés via /admin.
 *
 * Aucune donnée sensible : slug, URL d'aperçu, secteur et titres, tous déjà
 * publics sur `/demos`. Lecture seule, réponse cacheable.
 */
export async function GET() {
  const { content } = await getSiteDataCached();
  const demos = getAllKnownDemos(content).map((demo) => ({
    slug: demo.slug,
    previewUrl: demo.previewUrl,
    sector: demo.sector,
    title: demo.title,
    titleEn: demo.titleEn,
  }));

  return Response.json(
    { ok: true, count: demos.length, demos },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
      },
    },
  );
}
