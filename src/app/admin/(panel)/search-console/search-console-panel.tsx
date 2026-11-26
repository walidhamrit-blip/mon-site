"use client";

import { useState, useTransition, type ChangeEvent } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Search,
  Send,
  TrendingUp,
} from "lucide-react";
import type {
  GoogleSitemapStatus,
  SearchConsoleConfigStatus,
  SearchConsoleOpportunity,
  SearchConsoleSnapshot,
} from "@/lib/google-indexing";
import {
  analyzeSearchConsoleCsvAction,
  loadSearchConsoleAction,
  submitSitemapNowAction,
  type CsvAnalysisResult,
} from "./actions";

interface Props {
  configStatus: SearchConsoleConfigStatus;
  googleVerificationConfigured: boolean;
  sheetsSyncConfigured: boolean;
  seoAuditScore: number;
  seoAuditSummary: {
    pass: number;
    warn: number;
    error: number;
  };
}

type BusyKind = "load" | "sitemap" | "csv" | null;

function formatDelta(value: number | null | undefined, suffix = "%"): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("fr-FR")}${suffix}`;
}

function formatDateFr(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function OpportunityTable({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: SearchConsoleOpportunity[];
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <h3 className="text-sm font-black tracking-tight text-stone-900">{title}</h3>
        <p className="mt-1 text-xs text-stone-500">{subtitle}</p>
        <p className="mt-4 rounded-xl bg-stone-50 p-4 text-xs text-stone-500">
          Aucune opportunité détectée sur cette période (ou volume d’impressions encore faible).
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <div className="border-b border-stone-100 px-5 py-4">
        <h3 className="text-sm font-black tracking-tight text-stone-900">{title}</h3>
        <p className="mt-0.5 text-xs text-stone-500">{subtitle}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-stone-50 text-[11px] font-bold uppercase tracking-wider text-stone-500">
            <tr>
              <th className="px-4 py-2.5">Requête</th>
              <th className="px-4 py-2.5">Page cible</th>
              <th className="px-3 py-2.5 text-right">Pos.</th>
              <th className="px-3 py-2.5 text-right">Impr.</th>
              <th className="px-3 py-2.5 text-right">Clics</th>
              <th className="px-3 py-2.5 text-right">CTR</th>
              <th className="px-4 py-2.5">Action recommandée</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {items.map((item, index) => (
              <tr key={`${item.query}-${item.page}-${index}`} className="hover:bg-stone-50/70">
                <td className="px-4 py-3 font-semibold text-stone-900 max-w-[220px]">
                  <span className="line-clamp-2">{item.query || "—"}</span>
                </td>
                <td className="px-4 py-3 text-stone-600 max-w-[220px]">
                  {item.page ? (
                    <a
                      href={item.page}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[#8A6D2F] hover:underline break-all"
                    >
                      <span>{item.page.replace(/^https?:\/\/[^/]+/, "") || "/"}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-3 text-right font-bold tabular-nums text-stone-900">
                  {item.position.toFixed(1)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-stone-700">
                  {item.impressions.toLocaleString("fr-FR")}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-stone-700">
                  {item.clicks.toLocaleString("fr-FR")}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-stone-700">
                  {(item.ctr * 100).toFixed(1)} %
                </td>
                <td className="px-4 py-3 text-[11.5px] leading-relaxed text-stone-600 max-w-xs">
                  {item.recommendedAction}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SearchConsolePanel({
  configStatus,
  googleVerificationConfigured,
  sheetsSyncConfigured,
  seoAuditScore,
  seoAuditSummary,
}: Props) {
  const [busy, setBusy] = useState<BusyKind>(null);
  const [days, setDays] = useState<number>(28);
  const [banner, setBanner] = useState<{ ok: boolean; text: string } | null>(null);
  const [snapshot, setSnapshot] = useState<SearchConsoleSnapshot | null>(null);
  const [sitemapOverride, setSitemapOverride] = useState<GoogleSitemapStatus | null>(null);
  const [csvText, setCsvText] = useState("");
  const [csvResult, setCsvResult] = useState<CsvAnalysisResult | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [, startTransition] = useTransition();

  const activeSitemap = sitemapOverride ?? snapshot?.sitemap ?? null;

  function handleLoadSnapshot() {
    setBusy("load");
    setBanner(null);
    startTransition(() => {
      void (async () => {
        try {
          const res = await loadSearchConsoleAction(days);
          setBanner({ ok: res.ok, text: res.message });
          if (res.snapshot) setSnapshot(res.snapshot);
        } catch (err) {
          setBanner({
            ok: false,
            text: err instanceof Error ? err.message : "Lecture Search Console impossible.",
          });
        } finally {
          setBusy(null);
        }
      })();
    });
  }

  function handleSubmitSitemap() {
    setBusy("sitemap");
    setBanner(null);
    startTransition(() => {
      void (async () => {
        try {
          const res = await submitSitemapNowAction();
          setBanner({ ok: res.ok, text: res.message });
          if (res.sitemap) setSitemapOverride(res.sitemap);
        } catch (err) {
          setBanner({
            ok: false,
            text: err instanceof Error ? err.message : "Soumission du sitemap impossible.",
          });
        } finally {
          setBusy(null);
        }
      })();
    });
  }

  function handleAnalyzeCsv() {
    setBusy("csv");
    setBanner(null);
    startTransition(() => {
      void (async () => {
        try {
          const res = await analyzeSearchConsoleCsvAction(csvText);
          setCsvResult(res);
          setBanner({ ok: res.ok, text: res.message });
        } catch (err) {
          setBanner({
            ok: false,
            text: err instanceof Error ? err.message : "Analyse CSV impossible.",
          });
        } finally {
          setBusy(null);
        }
      })();
    });
  }

  function handleFileUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCsvText(reader.result);
      }
    };
    reader.readAsText(file);
  }

  async function copyServiceEmail() {
    if (!configStatus.clientEmail) return;
    try {
      await navigator.clipboard.writeText(configStatus.clientEmail);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    } catch {
      // Presse-papiers non disponible
    }
  }

  return (
    <div className="space-y-6">
      {/* Cartes d'état technique + connexion API */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <div className="text-xs font-semibold text-stone-500">Compte de service GSC</div>
          <div className="mt-2 flex items-center gap-2">
            {configStatus.configured ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
                <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" /> Connecté
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> À configurer
              </span>
            )}
          </div>
          <div className="mt-2 text-[11px] text-stone-500 truncate">
            {configStatus.clientEmail ? (
              <button
                type="button"
                onClick={copyServiceEmail}
                className="inline-flex items-center gap-1 text-left font-mono text-[11px] text-stone-700 hover:text-stone-950"
                title="Copier l'e-mail du compte de service"
              >
                <span className="truncate max-w-[190px]">{configStatus.clientEmail}</span>
                <Copy className="h-3 w-3 shrink-0" aria-hidden="true" />
                {copiedEmail ? <span className="text-emerald-700">copié</span> : null}
              </button>
            ) : (
              "GOOGLE_INDEXING_CLIENT_EMAIL absent"
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <div className="text-xs font-semibold text-stone-500">Propriété & Sitemap</div>
          <div className="mt-2 font-mono text-xs font-bold text-stone-900 break-all">
            {configStatus.property}
          </div>
          <div className="mt-1 text-[11px] text-stone-500 truncate">
            {configStatus.sitemapUrl}
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <div className="text-xs font-semibold text-stone-500">Validation & Pont Sheets</div>
          <div className="mt-2 space-y-1 text-xs font-semibold text-stone-800">
            <div className="flex items-center gap-1.5">
              <CheckCircle2
                className={`h-3.5 w-3.5 ${
                  googleVerificationConfigured ? "text-emerald-600" : "text-stone-400"
                }`} aria-hidden="true" />
              <span>
                Balise HTML : {googleVerificationConfigured ? "active" : "DNS / non définie"}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2
                className={`h-3.5 w-3.5 ${
                  sheetsSyncConfigured ? "text-emerald-600" : "text-stone-400"
                }`} aria-hidden="true" />
              <span>
                Google Sheets : {sheetsSyncConfigured ? "synchronisé" : "optionnel"}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <div className="text-xs font-semibold text-stone-500">Complétude technique SEO</div>
          <div className="mt-2 text-2xl font-black tabular-nums text-stone-900">
            {seoAuditScore} / 100
          </div>
          <div className="mt-1 text-[11px] text-stone-500">
            {seoAuditSummary.pass} OK · {seoAuditSummary.warn} avert. · {seoAuditSummary.error} err.
          </div>
        </div>
      </section>

      {/* Barre d'actions en direct */}
      <section className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-black tracking-tight text-stone-900">
              Contrôle en direct Google Search Console
            </h2>
            <p className="mt-0.5 text-xs text-stone-500">
              Interroge l’API officielle Search Console à la demande et extrait les requêtes en position 11–20 (« Page 2 ») ainsi que les pages à CTR perfectible.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              aria-label="Fenêtre d'analyse"
              className="h-9 rounded-xl border border-stone-300 bg-white px-3 text-xs font-semibold text-stone-800"
            >
              <option value={7}>7 derniers jours</option>
              <option value={28}>28 derniers jours</option>
              <option value={90}>90 derniers jours</option>
            </select>

            <button
              type="button"
              disabled={busy !== null || !configStatus.configured}
              onClick={handleLoadSnapshot}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-stone-900 px-4 text-xs font-bold text-white hover:bg-stone-800 disabled:opacity-50"
            >
              {busy === "load" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 text-[#E5CA87]" aria-hidden="true" />
              )}
              <span>Charger les données GSC</span>
            </button>

            <button
              type="button"
              disabled={busy !== null || !configStatus.configured}
              onClick={handleSubmitSitemap}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-stone-300 bg-white px-3.5 text-xs font-bold text-stone-800 hover:bg-stone-50 disabled:opacity-50"
            >
              {busy === "sitemap" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="h-3.5 w-3.5 text-[#8A6D2F]" aria-hidden="true" />
              )}
              <span>Resoumettre sitemap.xml</span>
            </button>
          </div>
        </div>

        {banner && (
          <div
            role="status"
            className={`rounded-xl border px-4 py-3 text-xs font-medium ${
              banner.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-amber-300 bg-amber-50 text-amber-950"
            }`}
          >
            {banner.text}
          </div>
        )}

        {/* État du sitemap si chargé */}
        {activeSitemap && activeSitemap.status === "ok" && (
          <div className="rounded-xl border border-stone-200 bg-[#FAF9F6] p-4 grid gap-3 sm:grid-cols-4 text-xs">
            <div>
              <div className="text-stone-500">Dernière soumission</div>
              <div className="mt-0.5 font-bold text-stone-900">
                {formatDateFr(activeSitemap.lastSubmitted)}
              </div>
            </div>
            <div>
              <div className="text-stone-500">Dernière lecture Google</div>
              <div className="mt-0.5 font-bold text-stone-900">
                {formatDateFr(activeSitemap.lastDownloaded)}
              </div>
            </div>
            <div>
              <div className="text-stone-500">URL déclarées / indexées</div>
              <div className="mt-0.5 font-bold tabular-nums text-stone-900">
                {activeSitemap.submittedUrls?.toLocaleString("fr-FR") ?? "—"} /{" "}
                {activeSitemap.indexedUrls?.toLocaleString("fr-FR") ?? "—"}
              </div>
            </div>
            <div>
              <div className="text-stone-500">Erreurs / avertissements</div>
              <div className="mt-0.5 font-bold tabular-nums text-stone-900">
                {activeSitemap.errors ?? 0} erreur(s) · {activeSitemap.warnings ?? 0} avert.
              </div>
            </div>
          </div>
        )}

        {/* KPIs période courante vs période précédente */}
        {snapshot?.status === "ok" && snapshot.summary && (
          <div className="space-y-4 pt-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
              <span>
                Période analysée : <b>{snapshot.summary.startDate}</b> →{" "}
                <b>{snapshot.summary.endDate}</b> (comparée à {snapshot.summary.previousStartDate} →{" "}
                {snapshot.summary.previousEndDate})
              </span>
              <span className="inline-flex items-center gap-1 text-[#8A6D2F] font-semibold">
                <TrendingUp className="h-3.5 w-3.5" /> Données finales GSC
              </span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-4">
                <div className="text-xs text-stone-500">Clics organiques</div>
                <div className="mt-1 text-2xl font-black tabular-nums text-stone-900">
                  {snapshot.summary.current.clicks.toLocaleString("fr-FR")}
                </div>
                <div className="mt-1 text-[11px] font-semibold text-stone-600">
                  Évolution : {formatDelta(snapshot.summary.deltas.clicksPct, " %")}
                </div>
              </div>

              <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-4">
                <div className="text-xs text-stone-500">Impressions</div>
                <div className="mt-1 text-2xl font-black tabular-nums text-stone-900">
                  {snapshot.summary.current.impressions.toLocaleString("fr-FR")}
                </div>
                <div className="mt-1 text-[11px] font-semibold text-stone-600">
                  Évolution : {formatDelta(snapshot.summary.deltas.impressionsPct, " %")}
                </div>
              </div>

              <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-4">
                <div className="text-xs text-stone-500">CTR moyen</div>
                <div className="mt-1 text-2xl font-black tabular-nums text-stone-900">
                  {(snapshot.summary.current.ctr * 100).toFixed(2)} %
                </div>
                <div className="mt-1 text-[11px] font-semibold text-stone-600">
                  Écart : {formatDelta(snapshot.summary.deltas.ctrPts, " pt")}
                </div>
              </div>

              <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-4">
                <div className="text-xs text-stone-500">Position moyenne</div>
                <div className="mt-1 text-2xl font-black tabular-nums text-stone-900">
                  {snapshot.summary.current.position > 0
                    ? snapshot.summary.current.position.toFixed(1)
                    : "—"}
                </div>
                <div className="mt-1 text-[11px] font-semibold text-stone-600">
                  Variation : {formatDelta(snapshot.summary.deltas.positionDiff, "")}{" "}
                  <span className="text-stone-400">(négatif = gain)</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Tableaux Quick Wins issus de l'API live */}
      {snapshot?.status === "ok" && (
        <div className="space-y-5">
          <OpportunityTable
            title={`Quick Wins Page 2 — Positions 11 à 20 (${snapshot.quickWins?.length ?? 0})`}
            subtitle="Requêtes déjà classées juste derrière la 1re page Google : priorité #1 pour gagner du trafic rapidement."
            items={snapshot.quickWins ?? []}
          />
          <OpportunityTable
            title={`Pages en 1re page à faible CTR < 2,5 % (${snapshot.lowCtrPageOne?.length ?? 0})`}
            subtitle="Déjà visibles dans le Top 10 mais peu cliquées : retravailler le <title> et la meta description rapporte des clics immédiats."
            items={snapshot.lowCtrPageOne ?? []}
          />
        </div>
      )}

      {/* Analyseur CSV hors-ligne (utilisable immédiatement sans clé API) */}
      <section className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-black tracking-tight text-stone-900">
              <FileSpreadsheet className="h-4 w-4 text-[#8A6D2F]" />
              <span>Analyse instantanée d’un export CSV Search Console (sans clé API)</span>
            </h2>
            <p className="mt-1 text-xs text-stone-500">
              Depuis Search Console → <b>Performances → Exporter → Télécharger au format CSV</b>, importez{" "}
              <code>Queries.csv</code> (ou collez son contenu) pour obtenir immédiatement vos Quick Wins Page 2.
            </p>
          </div>
          <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-stone-300 bg-[#FAF9F6] px-3.5 text-xs font-semibold text-stone-800 hover:bg-stone-100">
            <Search className="h-3.5 w-3.5 text-[#8A6D2F]" aria-hidden="true" />
            <span>Importer un CSV</span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileUpload}
              className="sr-only"
            />
          </label>
        </div>

        <textarea
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          rows={4}
          placeholder={
            "Top queries,Clicks,Impressions,CTR,Position\nacheter carte steam libye,4,120,3.33%,12.4"
          }
          className="w-full rounded-xl border border-stone-200 bg-stone-50/60 p-3 font-mono text-xs text-stone-800 focus:border-[#C6A664] focus:bg-white focus:outline-none"
        />

        <div className="flex items-center justify-end gap-2">
          {csvText ? (
            <button
              type="button"
              onClick={() => {
                setCsvText("");
                setCsvResult(null);
              }}
              className="h-9 rounded-xl px-3 text-xs font-semibold text-stone-500 hover:bg-stone-100"
            >
              Effacer
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy !== null || !csvText.trim()}
            onClick={handleAnalyzeCsv}
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-stone-900 px-4 text-xs font-bold text-white hover:bg-stone-800 disabled:opacity-50"
          >
            {busy === "csv" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
            <span>Détecter les Quick Wins du CSV</span>
          </button>
        </div>

        {csvResult?.ok && (
          <div className="space-y-4 pt-2">
            <OpportunityTable
              title={`CSV · Quick Wins Page 2 (${csvResult.quickWins.length})`}
              subtitle="Classés par potentiel de clics organiques supplémentaires."
              items={csvResult.quickWins}
            />
            {csvResult.lowCtrPageOne.length > 0 && (
              <OpportunityTable
                title={`CSV · Page 1 à faible CTR (${csvResult.lowCtrPageOne.length})`}
                subtitle="Requêtes en Top 10 avec CTR < 2,5 %."
                items={csvResult.lowCtrPageOne}
              />
            )}
          </div>
        )}
      </section>
    </div>
  );
}
