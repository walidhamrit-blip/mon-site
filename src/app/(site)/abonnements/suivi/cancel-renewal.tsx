"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSiteConfig } from "@/components/site-provider";
import { resolveMarket } from "@/lib/market";

/** Bouton d'annulation du renouvellement (espace abonné). */
export function CancelRenewal({
  reference,
  token,
  accessUntil,
}: {
  reference: string;
  token: string;
  accessUntil: string | null;
}) {
  const router = useRouter();
  const siteConfig = useSiteConfig();
  const market = resolveMarket(siteConfig.market);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const until = accessUntil
    ? new Date(accessUntil).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: market.timezone,
      })
    : null;

  async function cancel() {
    const question = until
      ? `Annuler le renouvellement ? Votre accès reste ouvert jusqu'au ${until}, sans remboursement.`
      : "Annuler le renouvellement ?";
    if (!window.confirm(question)) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/subscriptions/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: reference, token }),
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      if (!response.ok || data.ok !== true) {
        setError(data.message ?? "L'annulation a échoué. Réessayez plus tard.");
        return;
      }
      router.refresh();
    } catch {
      setError("Impossible de joindre le serveur.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={cancel}
        disabled={busy}
        className="rounded-2xl border border-[var(--border)] px-5 py-3 font-bold disabled:opacity-50"
      >
        {busy ? "…" : "Annuler le renouvellement / Cancel renewal"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}
