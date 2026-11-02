"use client";

import { useState, useTransition } from "react";
import { saveFazercardsReplenishmentRule } from "@/app/admin/actions";
import { replenishmentNeed, type ReplenishmentSettings } from "@/lib/fazercards-replenishment-core";

export function FazercardsReplenishmentPanel({ rule, balanceUsd }: { rule: ReplenishmentSettings; balanceUsd: number | null }) {
  const [threshold, setThreshold] = useState(String(rule.thresholdUsd));
  const [target, setTarget] = useState(String(rule.targetUsd));
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  const need = replenishmentNeed(balanceUsd, rule);

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
      <h2 className="text-base font-black text-stone-900">Surveillance de recharge FazerCards</h2>
      <p className="mt-1 text-sm text-stone-600">Une alerte est envoyée si le solde passe sous le seuil. La cible sert à calculer le montant indicatif à recharger.</p>
      <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={(event) => {
        event.preventDefault();
        setMessage("");
        startTransition(async () => {
          const result = await saveFazercardsReplenishmentRule({ thresholdUsd: Number(threshold), targetUsd: Number(target) });
          setError(!result.ok);
          setMessage(result.message ?? result.error ?? "Erreur inattendue.");
        });
      }}>
        <label className="grid gap-1 text-sm font-bold text-stone-700">Seuil minimum (USD)
          <input required type="number" min="0" max="49999.99" step="0.01" value={threshold} onChange={(e) => setThreshold(e.target.value)} className="w-44 rounded-lg border border-stone-300 px-3 py-2 font-normal" />
        </label>
        <label className="grid gap-1 text-sm font-bold text-stone-700">Solde cible (USD)
          <input required type="number" min="0.01" max="50000" step="0.01" value={target} onChange={(e) => setTarget(e.target.value)} className="w-44 rounded-lg border border-stone-300 px-3 py-2 font-normal" />
        </label>
        <button disabled={pending} className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{pending ? "Enregistrement…" : "Enregistrer"}</button>
      </form>
      {message && <p role="status" className={`mt-2 text-sm ${error ? "text-red-700" : "text-emerald-700"}`}>{message}</p>}
      <p className="mt-3 text-sm text-stone-700">
        {need === null ? "Solde illisible : montant à recharger inconnu." : need > 0 ? `Règle enregistrée : recharge indicative de ${need.toFixed(2)} USD vers la cible de ${rule.targetUsd.toFixed(2)} USD.` : `Règle enregistrée : aucune recharge demandée (seuil ${rule.thresholdUsd.toFixed(2)} USD).`}
      </p>
      <p className="mt-2 text-xs leading-5 text-stone-500">Vérification quotidienne selon le cron configuré. Réseau envisagé : USDT BEP20. Aucun transfert ou facture n’est créé automatiquement : validez le montant, les frais et les instructions du fournisseur avant paiement.</p>
    </section>
  );
}
