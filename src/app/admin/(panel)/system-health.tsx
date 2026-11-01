"use client";

import { useState } from "react";

interface HealthSnapshot {
  time?: string;
  database?: { connected?: boolean };
  catalog?: { degraded?: boolean };
  nowpayments?: { apiKeyValid?: boolean | null; sandbox?: boolean; ipnSecretConfigured?: boolean };
  fazercards?: { credentialsValid?: boolean | null };
  mail?: { configured?: boolean };
  warnings?: string[];
}

export function SystemHealth() {
  const [snapshot, setSnapshot] = useState<HealthSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function check() {
    setBusy(true);
    setError("");
    setSnapshot(null);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    try {
      // A 500 can contain valid diagnostics: do not confuse overall payment
      // readiness with database connectivity, or display a stale green result.
      const response = await fetch("/api/health", { cache: "no-store", signal: controller.signal });
      const data: HealthSnapshot = await response.json();
      if (typeof data.database?.connected !== "boolean") throw new Error("Diagnostic incomplet");
      setSnapshot(data);
    } catch {
      setError("Vérification indisponible ou délai dépassé. Aucun rétablissement ne peut être confirmé ; réessayez.");
    } finally {
      clearTimeout(timer);
      setBusy(false);
    }
  }

  const status = (value: boolean | null | undefined, yes: string, no: string) => value === true ? yes : value === false ? no : "Non vérifié";
  return <section className="rounded-2xl border border-stone-200 bg-white p-5" aria-labelledby="system-health-title">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 id="system-health-title" className="font-bold">État technique & reprise après Neon</h2>
        <p className="mt-1 text-xs text-stone-500">Contrôle à la demande, sans achat, paiement ni relance de livraison. L’état de production peut différer de cette preview.</p>
      </div>
      <button type="button" disabled={busy} onClick={check} className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
        {busy ? "Vérification…" : "Vérifier cet environnement"}
      </button>
    </div>
    <div aria-live="polite" aria-busy={busy}>
      {error && <p className="mt-3 text-sm text-amber-800" role="alert">{error}</p>}
      {snapshot && <>
        <p className="mt-3 text-xs text-stone-500">Résultat ponctuel — {snapshot.time ? new Date(snapshot.time).toLocaleString("fr-FR", { timeZone: "Africa/Tripoli" }) : "date inconnue"}</p>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Base Neon", status(snapshot.database?.connected, "Connectée", "Injoignable")],
            ["Catalogue", status(snapshot.catalog?.degraded, "Maintenance", "Hors maintenance")],
            ["Clé NOWPayments", status(snapshot.nowpayments?.apiKeyValid, "Valide", "Refusée / absente")],
            ["Mode paiement", status(snapshot.nowpayments?.sandbox, "Test", "Réel")],
            ["Secret notifications paiement", status(snapshot.nowpayments?.ipnSecretConfigured, "Configuré", "Absent")],
            ["Accès FazerCards", status(snapshot.fazercards?.credentialsValid, "Valide", "Refusé / absent")],
            ["Envoi e-mail", status(snapshot.mail?.configured, "Configuré (livraison non testée)", "Non configuré")],
          ].map(([label, value]) => <div key={label} className="rounded-xl bg-stone-50 p-3"><dt className="text-xs text-stone-500">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>)}
        </dl>
        {!!snapshot.warnings?.length && <ul className="mt-3 list-disc space-y-1 ps-5 text-xs text-amber-800">{snapshot.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul>}
        <p className="mt-3 text-xs text-stone-500">Un accès fournisseur valide ne confirme ni le solde, ni le stock, ni une livraison réussie. Vérifiez le catalogue et les commandes avant toute relance manuelle.</p>
      </>}
    </div>
  </section>;
}
