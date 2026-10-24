import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getSiteDataCached } from "@/lib/store";
import { runSeoAudit } from "@/lib/seo-audit";
import { googleSiteVerification } from "@/lib/seo";

export const dynamic = "force-dynamic";

/**
 * Audit SEO & GEO (Référencement IA) en direct pour l'administration.
 * Analyse la configuration et les contenus en base et renvoie le score
 * sur 100 ainsi que les contrôles détaillés.
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
