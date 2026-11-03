import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getSiteDataCached } from "@/lib/store";
import { runSeoAudit } from "@/lib/seo-audit";
import { googleSiteVerification } from "@/lib/seo";

export const dynamic = "force-dynamic";

/**
 * Audit de complétude technique SEO & GEO en direct pour l'administration.
 * Analyse la configuration et les contenus en base et renvoie un score de
 * complétude sur 100 ainsi que les contrôles détaillés.
 *
 * ⚠️ Le score ne mesure ni le classement, ni l'éligibilité aux résultats
 * enrichis, ni les citations IA (A14). Il indique seulement que les champs
 * et contrôles techniques sont présents et cohérents.
 */
export async function GET() {
  await requireAdmin();
  const { config, content } = await getSiteDataCached();
  const report = runSeoAudit(content, config, {
    openAiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
    indexNowConfigured: true,
    googleVerificationConfigured: Boolean(googleSiteVerification(config.domain)),
  });

  return NextResponse.json(report);
}
