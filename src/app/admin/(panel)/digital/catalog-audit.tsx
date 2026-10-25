"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckSquare, Loader2, RefreshCw, Stethoscope, TriangleAlert } from "lucide-react";
import { applyCatalogRecalcAction } from "@/app/admin/actions";
import type { RecalcAnalysis, RecalcRow } from "@/lib/digital-audit";

const money = (value: number) => `${value.toFixed(2)} $`;

/**
 * Audit du catalogue + recalcul global des prix.
 *
 * 1. *Analyser* : chaque montant est confronté à son coût réel (frais
 *    Reloadly) et à la marge de sa fiche ; l'arrondi de 0,50 est proposé.
 * 2. On coche les fiches à corriger, puis *Appliquer* — le serveur recalcule
 *    les prix lui-même (le navigateur n'envoie jamais un prix).
 */
export function CatalogAudit({ paymentFeePercent }: { paymentFeePercent: number }) {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<RecalcAnalysis | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [flash, setFlash] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [busy, startTransition] = useTransition();
  const [anomaliesOnly, setAnomaliesOnly] = useState(true);

  const analyse = () => {
    setError("");
    setFlash(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/digital/recalc", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentFeePercent }),
          cache: "no-store",
        });
        const data = (await res.json().catch(() => ({}))) as RecalcAnalysis & {
          ok?: boolean;
          message?: string;
        };
        if (!res.ok || !data.ok) {
          setError(data.message ?? "Analyse impossible.");
          setAnalysis(null);
          return;
        }
        setAnalysis(data);
        // Par défaut, on coche les fiches qui ont au moins un prix à changer
        // ou une anomalie à corriger.
        // On coche toute fiche qui perd de l'argent ou dont un prix change :
        // une perte ne doit jamais rester non traitée par défaut.
        const withWork = new Set(
          data.rows
            .filter(
              (row) =>
                row.loss ||
                row.suspect ||
                (row.newPrice != null && Math.abs(row.newPrice - row.oldPrice) > 0.004),
            )
            .map((row) => row.ficheId),
        );
        setSelected(withWork);
      } catch {
        setError("Serveur injoignable.");
      }
    });
  };

  const apply = () => {
    if (selected.size === 0) {
      setFlash({ kind: "err", msg: "Aucune fiche sélectionnée." });
      return;
    }
    startTransition(async () => {
      const result = await applyCatalogRecalcAction(paymentFeePercent, Array.from(selected));
      if (result.ok) {
        setFlash({ kind: "ok", msg: result.message ?? "Recalcul appliqué." });
        setAnalysis(null);
        setSelected(new Set());
        router.refresh();
      } else {
        setFlash({ kind: "err", msg: result.error ?? "Échec du recalcul." });
      }
    });
  };

  const visibleRows = (analysis?.rows ?? []).filter((row) => {
    if (!anomaliesOnly) return true;
    if (row.loss || row.suspect) return true;
    if (row.newPrice != null && Math.abs(row.newPrice - row.oldPrice) > 0.004) return true;
    return row.issues.some((issue) => issue.severity !== "info");
  });

  const byFiche = new Map<string, { title: string; rows: RecalcRow[] }>();
  for (const row of visibleRows) {
    const entry = byFiche.get(row.ficheId) ?? { title: row.ficheTitle, rows: [] };
    entry.rows.push(row);
    byFiche.set(row.ficheId, entry);
  }

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-2xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="inline-flex items-center gap-2 text-[15px] font-black text-stone-900">
            <Stethoscope className="h-4 w-4 text-[#8A6D2F]" />
            Audit &amp; recalcul des prix
          </h2>
          <p className="mt-1 max-w-[75ch] text-[12.5px] leading-5 text-stone-600">
            Contrôle tout le catalogue : prix sous le coût, marge non appliquée,
            montants refusés par Reloadly, prix non arrondis. Le recalcul applique
            la marge de chaque fiche puis arrondit <strong>au demi-dollar supérieur</strong>{" "}
            (22,27 → 22,50). Frais de paiement pris en compte : {paymentFeePercent} %.
          </p>
        </div>
        <button
          type="button"
          onClick={analyse}
          disabled={busy}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#C6A664] px-3 text-[12.5px] font-bold text-stone-900 transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Analyser le catalogue
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
          {error}
        </p>
      )}

      {flash && (
        <p
          className={`mt-3 rounded-lg border px-3 py-2 text-[12px] ${
            flash.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {flash.msg}
        </p>
      )}

      {analysis && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[12px] font-bold text-stone-700">
              {analysis.changes} prix à ajuster · {selected.size} fiche(s) sélectionnée(s)
              {analysis.skipped.length > 0 ? ` · ${analysis.skipped.length} fiche(s) ignorée(s)` : ""}
            </span>
            <button
              type="button"
              onClick={apply}
              disabled={busy || selected.size === 0}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-stone-900 px-3 text-[12.5px] font-bold text-[#E5CA87] transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckSquare className="h-3.5 w-3.5" />}
              Appliquer la sélection
            </button>
          </div>

          {/* Synthèse : la perte d'argent d'abord. */}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div
              className={`rounded-lg border px-3 py-2 ${
                analysis.summary.losses > 0
                  ? "border-red-300 bg-red-50"
                  : "border-emerald-200 bg-emerald-50"
              }`}
            >
              <div className="text-[10.5px] font-bold uppercase tracking-wide text-stone-500">
                Ventes à perte
              </div>
              <div
                className={`text-[15px] font-black ${
                  analysis.summary.losses > 0 ? "text-red-700" : "text-emerald-800"
                }`}
              >
                {analysis.summary.losses} montant(s)
              </div>
              <div className="text-[11px] text-stone-600">
                {analysis.summary.fichesWithLoss} fiche(s) concernée(s)
              </div>
              {(analysis.summary.suspects ?? 0) > 0 && (
                <div className="mt-1 text-[11px] font-bold text-amber-800">
                  + {analysis.summary.suspects} à vérifier (remise inconnue)
                </div>
              )}
            </div>
            <div className="rounded-lg border border-stone-200 bg-[#FAF9F6] px-3 py-2">
              <div className="text-[10.5px] font-bold uppercase tracking-wide text-stone-500">
                Prix sous la valeur faciale
              </div>
              <div className="text-[15px] font-black text-stone-900">
                {analysis.summary.belowFace}
              </div>
            </div>
            <div className="rounded-lg border border-stone-200 bg-[#FAF9F6] px-3 py-2">
              <div className="text-[10.5px] font-bold uppercase tracking-wide text-stone-500">
                Refusés par Reloadly
              </div>
              <div className="text-[15px] font-black text-stone-900">{analysis.summary.refused}</div>
            </div>
            <div className="rounded-lg border border-stone-200 bg-[#FAF9F6] px-3 py-2">
              <div className="text-[10.5px] font-bold uppercase tracking-wide text-stone-500">
                Prix non recalculables
              </div>
              <div className="text-[15px] font-black text-stone-900">
                {analysis.summary.missingPrice}
              </div>
              <div className="text-[11px] text-stone-600">marge ou valeur absente</div>
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-[12px] font-bold text-stone-700">
            <input
              type="checkbox"
              checked={anomaliesOnly}
              onChange={(event) => setAnomaliesOnly(event.target.checked)}
              className="h-4 w-4 accent-stone-900"
            />
            Afficher seulement les anomalies
          </label>

          {analysis.warnings.length > 0 && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11.5px] leading-5 text-amber-900">
              {analysis.warnings.slice(0, 3).join(" | ")}
            </p>
          )}

          <ul className="max-h-[32rem] space-y-2 overflow-y-auto">
            {Array.from(byFiche.entries()).map(([ficheId, entry]) => {
              const checked = selected.has(ficheId);
              return (
                <li
                  key={ficheId}
                  className={`rounded-lg border px-3 py-2 ${
                    checked ? "border-[#C6A664] bg-[#FBF7EC]" : "border-stone-200 bg-white"
                  }`}
                >
                  <label className="flex cursor-pointer items-start gap-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(ficheId)}
                      className="mt-1 h-4 w-4 accent-stone-900"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-black text-stone-900">{entry.title}</span>
                      <span className="mt-1 block space-y-0.5 text-[11.5px] leading-5 text-stone-600">
                        {entry.rows.map((row) => (
                          <span
                            key={row.denominationId}
                            className={`block ${
                              row.loss
                                ? "rounded bg-red-50 px-1 font-bold text-red-800"
                                : row.suspect
                                  ? "rounded bg-amber-50 px-1 text-amber-900"
                                  : ""
                            }`}
                          >
                            <strong>{row.denominationLabel}</strong> :{" "}
                            {row.loss ? "⛔ " : ""}
                            {row.newPrice == null ? (
                              <span className="text-red-700">
                                prix incalculable ({money(row.oldPrice)})
                              </span>
                            ) : Math.abs(row.newPrice - row.oldPrice) > 0.004 ? (
                              <>
                                {money(row.oldPrice)} → <strong>{money(row.newPrice)}</strong>
                              </>
                            ) : (
                              <>inchangé ({money(row.oldPrice)})</>
                            )}
                            {row.cost != null ? ` · coût ${money(row.cost)}` : ""}
                            {row.netMarginPercent != null ? ` · marge ${row.netMarginPercent} %` : ""}
                            {row.issues.length > 0 && (
                              <span className="mt-0.5 block space-y-0.5">
                                {row.issues.map((issue, index) => (
                                  <span
                                    key={`${row.denominationId}-issue-${index}`}
                                    className={`flex items-start gap-1 ${
                                      issue.severity === "loss"
                                        ? "font-bold text-red-700"
                                        : issue.severity === "warning"
                                          ? "text-orange-800"
                                          : "text-stone-500"
                                    }`}
                                  >
                                    <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
                                    {issue.message}
                                  </span>
                                ))}
                              </span>
                            )}
                          </span>
                        ))}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          {analysis.skipped.length > 0 && (
            <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-[11.5px] leading-5 text-stone-600">
              <strong>Fiches ignorées</strong> :{" "}
              {analysis.skipped
                .slice(0, 8)
                .map((item) => `${item.ficheTitle} (${item.reason})`)
                .join(" · ")}
              {analysis.skipped.length > 8 ? ` … +${analysis.skipped.length - 8}` : ""}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
