"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckSquare, Loader2, RefreshCw, Sparkles, TriangleAlert } from "lucide-react";
import { applyDigitalSyncAction } from "@/app/admin/actions";
import type { SyncProposal } from "@/lib/digital-sync-core";

/** Marques suivies par défaut (celles du catalogue). */
const DEFAULT_BRANDS = ["Steam", "PlayStation", "Xbox", "Google Play", "Amazon", "Roblox", "Spotify", "NVIDIA"];
const COUNTRIES = ["US", "EU", "SA", "AE", "EG", "TR", "GLOBAL"];

interface AnalysisResponse {
  ok?: boolean;
  message?: string;
  mode?: string;
  scanned?: number;
  skipped?: number;
  errors?: string[];
  proposals?: SyncProposal[];
}

const money = (value: number) => `${value.toFixed(2)} $`;

/**
 * Révision du catalogue à partir du catalogue Reloadly.
 *
 * 1. on choisit la marge nette, les marques et les pays ;
 * 2. l'analyse (lecture seule chez Reloadly) rapproche chaque produit d'une
 *    fiche et calcule les prix ;
 * 3. l'admin coche ce qu'il retient, puis applique — les prix sont alors
 *    recalculés côté serveur, jamais repris du navigateur.
 */
export function ReloadlySync({ paymentFeePercent }: { paymentFeePercent: number }) {
  const router = useRouter();
  const [margin, setMargin] = useState("6");
  const [brands, setBrands] = useState(DEFAULT_BRANDS.join(", "));
  const [countries, setCountries] = useState<string[]>(["US"]);
  const [proposals, setProposals] = useState<SyncProposal[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [meta, setMeta] = useState<{ scanned: number; skipped: number; errors: string[]; mode: string } | null>(null);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [busy, startTransition] = useTransition();

  const request = () => ({
    marginPercent: Number(margin.replace(",", ".")),
    paymentFeePercent,
    brands: brands.split(",").map((brand) => brand.trim()).filter(Boolean),
    countries,
  });

  const analyse = () => {
    setError("");
    setFlash(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/digital/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request()),
          cache: "no-store",
        });
        const data = (await res.json().catch(() => ({}))) as AnalysisResponse;
        if (!res.ok || !data.ok) {
          setError(data.message ?? "Analyse impossible.");
          setProposals(null);
          return;
        }
        const list = data.proposals ?? [];
        setProposals(list);
        setMeta({
          scanned: data.scanned ?? 0,
          skipped: data.skipped ?? 0,
          errors: data.errors ?? [],
          mode: data.mode ?? "",
        });
        // Les fiches existantes sont cochées d'office, pas les créations.
        setSelected(new Set(list.filter((item) => item.action === "update").map((item) => item.key)));
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
      const result = await applyDigitalSyncAction(request(), Array.from(selected));
      if (result.ok) {
        setFlash({ kind: "ok", msg: result.message ?? "Révision appliquée." });
        setProposals(null);
        setSelected(new Set());
        router.refresh();
      } else {
        setFlash({ kind: "err", msg: result.error ?? "Échec de l'application." });
      }
    });
  };

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-2xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="inline-flex items-center gap-2 text-[15px] font-black text-stone-900">
            <Sparkles className="h-4 w-4 text-[#8A6D2F]" />
            Réviser le catalogue depuis Reloadly
          </h2>
          <p className="mt-1 max-w-[70ch] text-[12.5px] leading-5 text-stone-600">
            Compare les produits Reloadly aux fiches du site : relie les produits,
            ajoute les montants manquants, désactive ceux que le fournisseur
            refuse et recalcule tous les prix depuis la marge nette. Lecture seule
            chez Reloadly — <strong>rien n&apos;est écrit avant validation</strong>.
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-[140px_1fr]">
        <label className="block">
          <span className="text-[10.5px] font-bold uppercase tracking-wide text-stone-500">
            Marge nette (%)
          </span>
          <input
            type="number"
            step="0.1"
            min="0"
            max="50"
            value={margin}
            onChange={(event) => setMargin(event.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-stone-300 px-2 text-[13px] outline-none focus:border-[#B8923F]"
          />
        </label>
        <label className="block">
          <span className="text-[10.5px] font-bold uppercase tracking-wide text-stone-500">
            Marques (séparées par des virgules)
          </span>
          <input
            value={brands}
            onChange={(event) => setBrands(event.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-stone-300 px-2 text-[13px] outline-none focus:border-[#B8923F]"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[10.5px] font-bold uppercase tracking-wide text-stone-500">Pays</span>
        {COUNTRIES.map((country) => {
          const active = countries.includes(country);
          return (
            <button
              key={country}
              type="button"
              onClick={() =>
                setCountries((prev) =>
                  prev.includes(country) ? prev.filter((item) => item !== country) : [...prev, country],
                )
              }
              className={`h-8 rounded-full border px-3 text-[12px] font-bold ${
                active
                  ? "border-stone-900 bg-stone-900 text-[#E5CA87]"
                  : "border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
              }`}
            >
              {country}
            </button>
          );
        })}
        <button
          type="button"
          onClick={analyse}
          disabled={busy}
          className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#C6A664] px-3 text-[12.5px] font-bold text-stone-900 transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Analyser
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

      {meta && (
        <p className="mt-3 text-[11.5px] leading-5 text-stone-600">
          Environnement Reloadly : <strong>{meta.mode || "—"}</strong> · {meta.scanned} produit(s)
          lu(s) · {meta.skipped} ignoré(s) (aucun montant fixe).
          {meta.errors.length > 0 && (
            <span className="block text-amber-800">
              Avertissements : {meta.errors.slice(0, 3).join(" | ")}
            </span>
          )}
        </p>
      )}

      {proposals && (
        <div className="mt-3 space-y-2">
          {proposals.length === 0 ? (
            <p className="rounded-lg border border-dashed border-stone-300 px-3 py-4 text-center text-[12px] text-stone-500">
              Aucun produit Reloadly ne correspond à ces marques et pays.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[12px] font-bold text-stone-700">
                  {proposals.length} proposition(s) · {selected.size} sélectionnée(s)
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

              <ul className="max-h-[32rem] space-y-2 overflow-y-auto">
                {proposals.map((proposal) => {
                  const checked = selected.has(proposal.key);
                  return (
                    <li
                      key={`${proposal.key}-${proposal.productId}`}
                      className={`rounded-lg border px-3 py-2 ${
                        checked ? "border-[#C6A664] bg-[#FBF7EC]" : "border-stone-200 bg-white"
                      }`}
                    >
                      <label className="flex cursor-pointer items-start gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(proposal.key)}
                          className="mt-1 h-4 w-4 accent-stone-900"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-[13px] font-black text-stone-900">{proposal.title}</span>
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10.5px] font-bold ${
                                proposal.action === "create"
                                  ? "border-sky-200 bg-sky-50 text-sky-800"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-800"
                              }`}
                            >
                              {proposal.action === "create" ? "Nouvelle fiche" : "Mise à jour"}
                            </span>
                            <span className="text-[11px] text-stone-500">
                              #{proposal.productId} · {proposal.country} · {proposal.currency || "—"} · marge{" "}
                              {proposal.marginPercent} %
                            </span>
                          </span>

                          <span className="mt-1 block text-[11.5px] leading-5 text-stone-600">
                            {proposal.denominations
                              .map(
                                (item) =>
                                  `${item.label} → ${money(item.priceUsd)} (coût ${money(item.cost)}, ${item.netMarginPercent} %)`,
                              )
                              .join(" · ")}
                          </span>

                          {proposal.disabledLabels.length > 0 && (
                            <span className="mt-1 flex items-start gap-1 text-[11px] leading-5 text-orange-800">
                              <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
                              Désactivés (refusés par Reloadly) : {proposal.disabledLabels.join(", ")}
                            </span>
                          )}
                          {proposal.notes.length > 0 && (
                            <span className="mt-0.5 block text-[11px] leading-5 text-stone-500">
                              {proposal.notes.join(" · ")}
                            </span>
                          )}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}
