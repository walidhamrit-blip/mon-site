"use client";

import { useState } from "react";
import { Loader2, Search } from "lucide-react";

interface ReloadlyProduct {
  productId: number;
  name: string;
  country: string;
  currency: string;
  brand: string;
  type: string;
  fixedDenominations: number[];
  minDenomination: number | null;
  maxDenomination: number | null;
  status: string;
}

/**
 * Recherche dans le catalogue Reloadly (admin) pour retrouver l'ID du
 * produit à relier à une fiche. Lecture seule, aucun achat.
 */
export function ReloadlyProductSearch({
  defaultCountry,
  onSelect,
}: {
  defaultCountry?: string;
  onSelect: (product: { productId: number; countryCode: string }) => void;
}) {
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState((defaultCountry ?? "").toUpperCase());
  const [results, setResults] = useState<ReloadlyProduct[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<string>("");

  const search = async () => {
    setBusy(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (country.trim()) params.set("country", country.trim().toUpperCase());
      const res = await fetch(`/api/admin/reloadly/products?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        products?: ReloadlyProduct[];
        message?: string;
        mode?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.message ?? "Recherche impossible.");
        setResults([]);
        return;
      }
      setResults(data.products ?? []);
      setMode(data.mode ?? "");
      if ((data.products ?? []).length === 0) {
        setError("Aucun produit pour cette recherche.");
      }
    } catch {
      setError("Serveur injoignable.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="block flex-1">
          <span className="text-[10px] font-bold uppercase text-stone-400">
            Rechercher sur Reloadly
          </span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void search();
              }
            }}
            placeholder="Steam, PlayStation, Amazon…"
            className="h-9 w-full rounded-md border border-stone-300 px-2 text-[13px] outline-none focus:border-[#B8923F]"
          />
        </label>
        <label className="block w-20">
          <span className="text-[10px] font-bold uppercase text-stone-400">Pays</span>
          <input
            maxLength={2}
            value={country}
            onChange={(event) =>
              setCountry(event.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase())
            }
            placeholder="US"
            className="h-9 w-full rounded-md border border-stone-300 px-2 text-[13px] uppercase outline-none focus:border-[#B8923F]"
          />
        </label>
        <button
          type="button"
          onClick={() => void search()}
          disabled={busy}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-stone-900 px-3 text-[12px] font-bold text-white disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          Chercher
        </button>
      </div>

      {mode && (
        <p className="mt-2 text-[11px] text-stone-500">
          Environnement interrogé :{" "}
          <strong>{mode === "live" ? "LIVE" : "SANDBOX (test)"}</strong>
        </p>
      )}
      {error && <p className="mt-2 text-[11.5px] text-orange-700">{error}</p>}

      {results.length > 0 && (
        <ul className="mt-2 max-h-56 space-y-1.5 overflow-y-auto">
          {results.map((item) => (
            <li
              key={`${item.productId}-${item.country}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-stone-200 bg-[#FAF9F6] px-2.5 py-2"
            >
              <div className="min-w-0">
                <div className="truncate text-[12.5px] font-bold text-stone-900">
                  #{item.productId} · {item.name}
                </div>
                <div className="text-[11px] text-stone-500">
                  {item.country || "—"} · {item.currency} ·{" "}
                  {item.type === "FIXED"
                    ? `montants : ${item.fixedDenominations.join(", ") || "—"}`
                    : `libre : ${item.minDenomination ?? "?"}–${item.maxDenomination ?? "?"}`}
                  {item.status && item.status !== "ACTIVE" ? ` · ${item.status}` : ""}
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  onSelect({ productId: item.productId, countryCode: item.country })
                }
                className="shrink-0 rounded-md bg-[#C6A664] px-2.5 py-1.5 text-[11.5px] font-bold text-stone-900 hover:bg-[#B8923F]"
              >
                Utiliser
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
