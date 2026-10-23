"use client";

import { useState } from "react";

interface SyncFailure {
  id: string;
  error: string;
}

interface SyncResult {
  ok: boolean;
  created: string[];
  updated: string[];
  unchanged: string[];
  failed: SyncFailure[];
  error?: string;
}

/** Crée / met à jour les six formules chez NOWPayments et affiche le détail. */
export function SyncPlansButton() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/subscriptions/sync", { method: "POST" });
      const data = (await res.json().catch(() => null)) as Partial<SyncResult> & {
        detail?: string;
      } | null;
      setResult({
        ok: Boolean(data?.ok),
        created: data?.created ?? [],
        updated: data?.updated ?? [],
        unchanged: data?.unchanged ?? [],
        failed: data?.failed ?? [],
        error: data?.error ? `${data.error}${data.detail ? ` — ${data.detail}` : ""}` : res.ok ? undefined : `HTTP ${res.status}`,
      });
    } catch (error) {
      setResult({
        ok: false,
        created: [],
        updated: [],
        unchanged: [],
        failed: [],
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-2xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-bold text-stone-900">Synchroniser les formules</div>
          <div className="text-xs text-stone-500">
            Crée ou met à jour les six formules chez NOWPayments (à faire une fois par environnement).
          </div>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="rounded-full bg-stone-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy ? "Synchronisation…" : "Synchroniser"}
        </button>
      </div>

      {result && (
        <div className="mt-4 space-y-2 text-sm">
          <div className={result.ok ? "font-bold text-emerald-700" : "font-bold text-red-700"}>
            {result.ok ? "Synchronisation réussie" : "Synchronisation en échec"}
          </div>
          <div className="text-stone-700">
            Créées : {result.created.length} · Mises à jour : {result.updated.length} · Inchangées :{" "}
            {result.unchanged.length} · En échec : {result.failed.length}
          </div>
          {result.error && <div className="break-all text-red-700">Erreur : {result.error}</div>}
          {result.failed.length > 0 && (
            <ul className="space-y-1">
              {result.failed.map((f) => (
                <li key={f.id} className="break-all rounded-lg bg-red-50 p-2 text-red-800">
                  <span className="font-mono text-xs">{f.id}</span> : {f.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
