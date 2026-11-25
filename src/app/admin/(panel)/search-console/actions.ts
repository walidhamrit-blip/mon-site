"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { getSiteData } from "@/lib/store";
import {
  classifySearchConsoleOpportunities,
  fetchGoogleSitemapStatus,
  fetchSearchConsoleSnapshot,
  notifyGoogleSitemap,
  parseSearchConsoleCsv,
  type GoogleSitemapStatus,
  type SearchConsoleOpportunity,
  type SearchConsoleRow,
  type SearchConsoleSnapshot,
} from "@/lib/google-indexing";

/**
 * Actions serveur du panneau `/admin/search-console`.
 *
 * Toutes commencent par `requireAdmin()` : une action serveur est un point
 * d'entrée HTTP public, elle ne peut pas se reposer uniquement sur le layout.
 */

export interface LoadSearchConsoleResult {
  ok: boolean;
  message: string;
  snapshot?: SearchConsoleSnapshot;
}

export async function loadSearchConsoleAction(
  days: number = 28,
): Promise<LoadSearchConsoleResult> {
  await requireAdmin();
  const { config } = await getSiteData();
  const snapshot = await fetchSearchConsoleSnapshot(config.url, { days });

  if (snapshot.status === "skipped") {
    return {
      ok: false,
      snapshot,
      message:
        "Identifiants Search Console absents : renseignez GOOGLE_INDEXING_CLIENT_EMAIL et GOOGLE_INDEXING_PRIVATE_KEY sur Vercel (Production), puis redéployez.",
    };
  }
  if (snapshot.status === "error") {
    return {
      ok: false,
      snapshot,
      message:
        `Google Search Console a renvoyé une erreur (${snapshot.reason ?? "inconnue"}). ` +
        "Vérifiez que l'API « Google Search Console API » est activée et que l'e-mail du compte de service est ajouté dans Search Console → Paramètres → Utilisateurs et autorisations.",
    };
  }
  return {
    ok: true,
    snapshot,
    message: `Rapport ${snapshot.summary?.days ?? days} jours chargé depuis ${snapshot.property}.`,
  };
}

export interface SubmitSitemapActionResult {
  ok: boolean;
  message: string;
  sitemap?: GoogleSitemapStatus;
}

export async function submitSitemapNowAction(): Promise<SubmitSitemapActionResult> {
  await requireAdmin();
  const { config } = await getSiteData();
  const res = await notifyGoogleSitemap(config.url, { allowManualAdmin: true });

  if (res.status === "skipped") {
    const reasonText =
      res.reason === "preview-or-local-origin"
        ? "Soumission bloquée : l'URL configurée du site pointe vers un domaine local ou preview."
        : "Identifiants Search Console non configurés sur cet environnement.";
    return { ok: false, message: reasonText };
  }

  if (res.status === "error") {
    const hint =
      res.httpStatus === 403
        ? " (HTTP 403 : passez le compte de service en droit « Complet » dans Search Console → Utilisateurs et autorisations)."
        : "";
    return {
      ok: false,
      message: `Échec de soumission du sitemap (${res.reason ?? "erreur"})${hint}`,
    };
  }

  const sitemap = await fetchGoogleSitemapStatus(config.url).catch(() => undefined);
  revalidatePath("/admin/search-console");
  return {
    ok: true,
    sitemap,
    message: `Sitemap soumis avec succès à Google Search Console : ${res.sitemapUrl ?? `${config.url}/sitemap.xml`}`,
  };
}

export interface CsvAnalysisResult {
  ok: boolean;
  message: string;
  totalRows: number;
  quickWins: SearchConsoleOpportunity[];
  lowCtrPageOne: SearchConsoleOpportunity[];
  topQueries: SearchConsoleRow[];
}

export async function analyzeSearchConsoleCsvAction(
  csvText: string,
): Promise<CsvAnalysisResult> {
  await requireAdmin();
  const trimmed = (csvText ?? "").trim();
  if (!trimmed) {
    return {
      ok: false,
      message: "Collez ou importez un fichier CSV exporté depuis Google Search Console.",
      totalRows: 0,
      quickWins: [],
      lowCtrPageOne: [],
      topQueries: [],
    };
  }
  if (trimmed.length > 2_000_000) {
    return {
      ok: false,
      message: "Fichier CSV trop volumineux (> 2 Mo). Exportez les 1 000 premières lignes.",
      totalRows: 0,
      quickWins: [],
      lowCtrPageOne: [],
      topQueries: [],
    };
  }

  const rows = parseSearchConsoleCsv(trimmed);
  if (rows.length === 0) {
    return {
      ok: false,
      message:
        "Aucune ligne exploitable détectée. Exportez l'onglet « Requêtes » (Queries.csv) ou un rapport personnalisé « Requête + Page » depuis Search Console → Performances → Exporter.",
      totalRows: 0,
      quickWins: [],
      lowCtrPageOne: [],
      topQueries: [],
    };
  }

  const { quickWins, lowCtrPageOne } = classifySearchConsoleOpportunities(rows, {
    limit: 30,
  });
  const topQueries = [...rows]
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
    .slice(0, 15);

  return {
    ok: true,
    message: `${rows.length} lignes analysées · ${quickWins.length} Quick Wins Page 2 (pos. 11–20) · ${lowCtrPageOne.length} pages Page 1 à CTR perfectible.`,
    totalRows: rows.length,
    quickWins,
    lowCtrPageOne,
    topQueries,
  };
}
