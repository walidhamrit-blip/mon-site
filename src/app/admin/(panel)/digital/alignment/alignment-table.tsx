"use client";

import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Ban, CircleCheck, Search, ShieldAlert } from "lucide-react";
import type { AlignmentStatus } from "@/lib/competitor-pricing";

export interface AlignmentRow {
  key: string;
  product: string;
  platform: string;
  denomination: string;
  region: string;
  /** Prix de la fiche (barème maison), avant alignement. */
  catalogUsd: number | null;
  /** Prix réellement affiché et facturé (après alignement). */
  servedUsd: number;
  costUsd: number | null;
  benchmarkUsd: number | null;
  channel: string | null;
  observedAt: string | null;
  confidence: "reseller" | "official" | null;
  targetUsd: number | null;
  floorUsd: number | null;
  status: AlignmentStatus;
  currentVsBenchmarkPercent: number | null;
  netMarginUsd: number | null;
  netMarginPercent: number | null;
}

const money = (value: number | null | undefined) =>
  value == null ? "—" : `${value.toFixed(2)} $`;
const percent = (value: number | null | undefined) =>
  value == null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(1)} %`;

const STATUS_LABEL: Record<AlignmentStatus, string> = {
  aligned: "Aligné",
  lowered: "Baissé",
  raised: "Relevé",
  blocked: "Bloqué (marché < plancher)",
  step_blocked: "Écart trop fort",
  no_benchmark: "Sans référence",
  no_cost: "Coût inconnu",
  disabled: "Désactivé",
  locked: "Verrouillé",
};

const STATUS_STYLE: Record<AlignmentStatus, string> = {
  aligned: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  lowered: "bg-sky-50 text-sky-800 ring-sky-200",
  raised: "bg-indigo-50 text-indigo-800 ring-indigo-200",
  blocked: "bg-rose-50 text-rose-800 ring-rose-200",
  step_blocked: "bg-amber-50 text-amber-800 ring-amber-200",
  no_benchmark: "bg-stone-100 text-stone-600 ring-stone-200",
  no_cost: "bg-stone-100 text-stone-600 ring-stone-200",
  disabled: "bg-stone-100 text-stone-600 ring-stone-200",
  locked: "bg-violet-50 text-violet-800 ring-violet-200",
};

function StatusBadge({ status }: { status: AlignmentStatus }) {
  const Icon =
    status === "aligned"
      ? CircleCheck
      : status === "lowered"
        ? ArrowDownRight
        : status === "raised"
          ? ArrowUpRight
          : status === "blocked"
            ? ShieldAlert
            : Ban;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${STATUS_STYLE[status]}`}
    >
      <Icon size={11} aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}

type Filter = "all" | "work" | "blocked" | "noref";

export function AlignmentTable({ rows }: { rows: AlignmentRow[] }) {
  const [filter, setFilter] = useState<Filter>("work");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter === "work" && row.status === "aligned") return false;
      if (filter === "work" && (row.status === "no_benchmark" || row.status === "no_cost")) return false;
      if (filter === "blocked" && row.status !== "blocked") return false;
      if (filter === "noref" && row.status !== "no_benchmark" && row.status !== "no_cost") return false;
      if (!needle) return true;
      return `${row.product} ${row.platform} ${row.denomination} ${row.region}`.toLowerCase().includes(needle);
    });
  }, [rows, filter, query]);

  const tabs: { id: Filter; label: string; count: number }[] = [
    { id: "work", label: "À traiter", count: rows.filter((r) => r.status !== "aligned" && r.status !== "no_benchmark" && r.status !== "no_cost").length },
    { id: "blocked", label: "Bloqués", count: rows.filter((r) => r.status === "blocked").length },
    { id: "noref", label: "Sans référence", count: rows.filter((r) => r.status === "no_benchmark" || r.status === "no_cost").length },
    { id: "all", label: "Tout", count: rows.length },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`rounded-full px-3 py-1 text-[11px] font-bold ring-1 transition ${
                filter === tab.id
                  ? "bg-stone-900 text-white ring-stone-900"
                  : "bg-white text-stone-600 ring-stone-200 hover:bg-stone-50"
              }`}
            >
              {tab.label} · {tab.count}
            </button>
          ))}
        </div>
        <label className="relative">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" aria-hidden />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filtrer (produit, montant, région…)"
            className="w-64 rounded-lg border border-stone-200 bg-white py-1.5 pl-7 pr-2 text-xs text-stone-800 outline-hidden focus:border-stone-400"
          />
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="w-full min-w-[980px] text-left text-xs">
          <thead className="bg-stone-50 text-[10px] uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-3 py-2 font-bold">Produit · montant</th>
              <th className="px-3 py-2 font-bold">Coût</th>
              <th className="px-3 py-2 font-bold">Marché</th>
              <th className="px-3 py-2 font-bold">Cible</th>
              <th className="px-3 py-2 font-bold">Plancher</th>
              <th className="px-3 py-2 font-bold">Catalogue</th>
              <th className="px-3 py-2 font-bold">Prix servi</th>
              <th className="px-3 py-2 font-bold">Marge nette</th>
              <th className="px-3 py-2 font-bold">État</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {filtered.map((row) => (
              <tr key={row.key} className="align-top">
                <td className="px-3 py-2">
                  <div className="font-bold text-stone-900">{row.product}</div>
                  <div className="text-[11px] text-stone-500">
                    {row.denomination}
                    {row.region ? ` · ${row.region}` : ""}
                  </div>
                </td>
                <td className="px-3 py-2 tabular-nums text-stone-700">{money(row.costUsd)}</td>
                <td className="px-3 py-2">
                  <div className="tabular-nums text-stone-900">{money(row.benchmarkUsd)}</div>
                  <div className="text-[10px] text-stone-500">
                    {row.channel ?? "—"}
                    {row.confidence === "reseller" ? " · revendeur" : row.confidence === "official" ? " · plafond" : ""}
                  </div>
                </td>
                <td className="px-3 py-2 tabular-nums text-stone-700">{money(row.targetUsd)}</td>
                <td className="px-3 py-2 tabular-nums text-stone-700">{money(row.floorUsd)}</td>
                <td className="px-3 py-2 tabular-nums text-stone-500">{money(row.catalogUsd)}</td>
                <td className="px-3 py-2 tabular-nums font-bold text-stone-900">
                  {money(row.servedUsd)}
                  {row.floorUsd != null && row.servedUsd < row.floorUsd - 0.004 && (
                    <div className="text-[10px] font-bold text-rose-600">vente à perte</div>
                  )}
                </td>
                <td className="px-3 py-2 tabular-nums">
                  <span className="text-stone-800">{money(row.netMarginUsd)}</span>
                  {row.netMarginPercent != null && (
                    <span className="ml-1 text-[10px] text-stone-500">{percent(row.netMarginPercent)}</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={row.status} />
                  {row.currentVsBenchmarkPercent != null && (
                    <div className="mt-1 text-[10px] text-stone-500">
                      vs marché {percent(row.currentVsBenchmarkPercent)}
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-stone-500">
                  Aucun montant dans ce filtre.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
