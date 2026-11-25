import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Sparkles } from "lucide-react";
import { getSiteDataCached } from "@/lib/store";
import { getSearchConsoleConfigStatus } from "@/lib/google-indexing";
import { googleSiteVerification } from "@/lib/seo";
import { runSeoAudit } from "@/lib/seo-audit";
import { SearchConsolePanel } from "./search-console-panel";

export const metadata: Metadata = {
  title: "Google Search Console — Administration",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminSearchConsolePage() {
  const { config, content } = await getSiteDataCached();
  const configStatus = getSearchConsoleConfigStatus(config.url);
  const googleVerificationConfigured = Boolean(googleSiteVerification(config.domain));
  const sheetsSyncConfigured = Boolean(
    process.env.GOOGLE_SHEETS_GSC_SPREADSHEET_ID?.trim(),
  );
  const audit = runSeoAudit(content, config, {
    openAiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
    indexNowConfigured: true,
    googleVerificationConfigured,
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-black tracking-tight text-stone-900">
            Google Search Console &amp; Automatisation SEO
          </h1>
          <p className="mt-1 text-[13px] text-stone-500">
            Suivi des clics, impressions, resoumission automatique de{" "}
            <code>sitemap.xml</code> et détection des requêtes en position 11–20 (« Quick Wins Page 2 »).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="https://search.google.com/search-console"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
          >
            <span>Ouvrir Google Search Console</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <Link
            href="/admin"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Tableau de bord</span>
          </Link>
        </div>
      </header>

      {!configStatus.configured ? (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-800" />
            <h2 className="text-sm font-black tracking-tight text-amber-950">
              Relier Google Search Console en 5 minutes (sans exposer vos clés)
            </h2>
          </div>
          <ol className="list-decimal space-y-2 pl-5 text-[13px] leading-relaxed text-amber-950">
            <li>
              Dans <b>Google Cloud Console</b>, activez{" "}
              <b>Google Search Console API</b>, puis créez un{" "}
              <b>Compte de service</b> (<i>IAM &amp; Admin → Service Accounts</i>) et téléchargez sa clé JSON.
            </li>
            <li>
              Dans <b>Google Search Console → Paramètres → Utilisateurs et autorisations</b>, cliquez sur{" "}
              <b>Ajouter un utilisateur</b>, collez l’adresse{" "}
              <code>...@....iam.gserviceaccount.com</code> avec l’autorisation{" "}
              <b>Complet</b> (requis pour soumettre le sitemap ; « Restreint » ne permet que la lecture).
            </li>
            <li>
              Ajoutez ces 3 variables dans <b>Vercel → Settings → Environment Variables (Production)</b>{" "}
              <b>ET</b> dans <b>GitHub → Settings → Secrets and variables → Actions</b> :
              <ul className="mt-1.5 list-disc space-y-1 pl-5 font-mono text-xs">
                <li>GOOGLE_INDEXING_CLIENT_EMAIL = client_email du fichier JSON</li>
                <li>GOOGLE_INDEXING_PRIVATE_KEY = private_key complet (-----BEGIN PRIVATE KEY-----…)</li>
                <li>
                  GOOGLE_INDEXING_SITE_URL = sc-domain:{config.domain} (ou {config.url}/)
                </li>
              </ul>
            </li>
            <li>
              Redéployez sur Vercel : ce panneau devient actif et le workflow{" "}
              <code>.github/workflows/gsc-monitor.yml</code> publiera <b>tous les matins (7j/7 à 08:30 UTC)</b> votre rapport automatique (pouls 7j, tendance 28j, état sitemap et Quick Wins Page 2).
            </li>
          </ol>
          <p className="text-[12px] text-amber-900">
            Guide détaillé pas à pas : <code>docs/google-search-console-automation.md</code> ·{" "}
            <b>Ne collez jamais votre clé privée PEM dans un chat.</b>
          </p>
        </section>
      ) : null}

      <SearchConsolePanel
        configStatus={configStatus}
        googleVerificationConfigured={googleVerificationConfigured}
        sheetsSyncConfigured={sheetsSyncConfigured}
        seoAuditScore={audit.score}
        seoAuditSummary={audit.summary}
      />
    </div>
  );
}
