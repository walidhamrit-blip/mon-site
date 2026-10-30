"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Loader2, ShieldQuestion, Sparkles, TriangleAlert, Wallet } from "lucide-react";
import type {
  AutotopupRunReport,
  FazercardsAutotopupStatus,
} from "@/lib/fazercards-autotopup";

const money = (value: number) => `${value.toFixed(2)} $`;

/**
 * Recharge automatique du solde fournisseur — pilotage depuis l'administration.
 *
 * Le panneau de solde au-dessus répond à « puis-je honorer la vente la plus
 * chère ? ». Celui-ci répond à « qui remet de l'argent, et quand ? » :
 *  • *Simuler* : dit ce qui partirait, sans rien créer (aucune facture) ;
 *  • *Recharger* : crée la facture de dépôt FazerCards ET le virement
 *    NOWPayments — seulement si l'interrupteur serveur est actif ;
 *  • le code 2FA du virement en attente se saisit ici quand il arrive par
 *    e-mail (avec un secret TOTP, cette étape est automatique).
 */
export function FazercardsTopupPanel({ initial }: { initial: FazercardsAutotopupStatus }) {
  const router = useRouter();
  const [status, setStatus] = useState(initial);
  const [report, setReport] = useState<AutotopupRunReport | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [flash, setFlash] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [busy, startTransition] = useTransition();

  const call = (body: { action: "simulate" | "execute" | "verify"; code?: string }) => {
    setError("");
    setFlash(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/digital/fazercards-topup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          cache: "no-store",
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          message?: string;
          status?: FazercardsAutotopupStatus;
          report?: AutotopupRunReport;
        };
        if (data.status) setStatus(data.status);
        if (body.action === "verify") {
          if (!res.ok || !data.ok) {
            setError(data.error ?? data.message ?? "Validation impossible.");
          } else {
            setCode("");
            setFlash({ kind: "ok", msg: "Virement validé — en attente de la confirmation du fournisseur." });
          }
          router.refresh();
          return;
        }
        if (data.report) setReport(data.report);
        if (!res.ok || !data.ok) {
          setError(data.error ?? data.report?.error ?? "Opération impossible.");
        } else {
          setFlash({
            kind: "ok",
            msg:
              data.report?.executed === true
                ? "Virement créé — voir le détail ci-dessous."
                : (data.report?.reason ?? "Simulation terminée."),
          });
        }
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    });
  };

  const pending = status.state.pending;
  const prerequisites = [
    { label: "Clé FazerCards", ok: status.prerequisites.fazercards },
    { label: "Identifiants virement NOWPayments", ok: status.prerequisites.payoutCredentials },
    { label: "Interrupteur FAZERCARDS_AUTOTOPUP_ENABLED", ok: status.prerequisites.enabled },
    { label: "2FA automatique (TOTP)", ok: status.prerequisites.totp },
  ];

  return (
    <div className="rounded-2xl border border-stone-300 bg-white px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="inline-flex items-center gap-2 text-[13.5px] font-black text-stone-900">
          <Wallet className="h-4 w-4" /> Recharge automatique du solde fournisseur
        </p>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
            status.config.enabled
              ? "bg-emerald-100 text-emerald-800"
              : "bg-stone-200 text-stone-700"
          }`}
        >
          {status.config.enabled ? "ACTIVE" : "DÉSACTIVÉE"}
        </span>
      </div>

      <div className="mt-2 grid gap-x-6 gap-y-1 text-[12px] leading-5 text-stone-700 sm:grid-cols-2 lg:grid-cols-4">
        <p>
          <span className="font-bold">Float cible :</span> {money(status.targetUsd)} (coût du plafond{" "}
          {money(status.maxOrderUsd)} + 15 %)
        </p>
        <p>
          <span className="font-bold">Seuil de déclenchement :</span> écart ≥{" "}
          {money(status.config.thresholdUsd)}
        </p>
        <p>
          <span className="font-bold">Plafond par virement :</span> {money(status.config.maxUsd)}
        </p>
        <p>
          <span className="font-bold">Devise envoyée :</span> {status.currency.toUpperCase()}
        </p>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {prerequisites.map((item) => (
          <span
            key={item.label}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              item.ok ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"
            }`}
          >
            {item.ok ? <BadgeCheck className="h-3 w-3" /> : <TriangleAlert className="h-3 w-3" />}
            {item.label}
          </span>
        ))}
      </div>

      {pending && (
        <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] leading-5 text-amber-950">
          <p className="font-bold">
            Virement en cours — facture {pending.paymentId} ({money(pending.invoiceUsd)} à créditer)
          </p>
          <p>
            Adresse de dépôt : <code className="break-all">{pending.address}</code>
          </p>
          <p>
            Virement NOWPayments : {pending.payoutId ?? "non créé"} · envoyé {money(pending.sendUsd)}
            {pending.expiresAt ? ` · facture valable jusqu'au ${new Date(pending.expiresAt).toLocaleString("fr-FR")}` : ""}
          </p>
          {!status.prerequisites.totp && (
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <label className="text-[11.5px] font-bold">
                Code 2FA reçu par e-mail
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/[^\d]/g, "").slice(0, 8))}
                  inputMode="numeric"
                  placeholder="123456"
                  className="mt-1 block w-32 rounded-lg border border-amber-300 bg-white px-2 py-1 text-[13px] font-normal tracking-[0.2em]"
                />
              </label>
              <button
                type="button"
                onClick={() => call({ action: "verify", code })}
                disabled={busy || code.length < 6}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-900 px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldQuestion className="h-3.5 w-3.5" />}
                Valider le virement
              </button>
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => call({ action: "simulate" })}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 px-3 py-1.5 text-[12px] font-bold text-stone-800 hover:bg-stone-50 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Simuler
        </button>
        <button
          type="button"
          onClick={() => {
            if (
              typeof window !== "undefined" &&
              !window.confirm(
                "Créer la facture de dépôt FazerCards ET envoyer un virement USDT depuis le solde NOWPayments ?",
              )
            ) {
              return;
            }
            call({ action: "execute" });
          }}
          disabled={busy || !status.canExecute}
          className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wallet className="h-3.5 w-3.5" />}
          Recharger maintenant
        </button>
        {!status.canExecute && (
          <span className="text-[11.5px] text-stone-500">
            Exécution réelle verrouillée : activez l&apos;interrupteur et vérifiez les prérequis.
          </span>
        )}
      </div>

      {flash && (
        <p className={`mt-2 text-[12px] font-semibold ${flash.kind === "ok" ? "text-emerald-800" : "text-red-700"}`}>
          {flash.msg}
        </p>
      )}
      {error && <p className="mt-2 text-[12px] font-semibold text-red-700">{error}</p>}

      {report && (
        <div className="mt-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-[11.5px] leading-5 text-stone-700">
          <p className="font-black text-stone-800">
            {report.executed ? "Virement exécuté" : report.action === "topup" ? "Simulation" : "Aucun virement"}
          </p>
          <p>{report.reason}</p>
          <p>
            Solde lu {report.balanceUsd != null ? money(report.balanceUsd) : "—"} · cible{" "}
            {money(report.targetUsd)} · custody {report.custodyUsd != null ? money(report.custodyUsd) : "—"} ·
            frais réseau {report.feeUsd != null ? money(report.feeUsd) : "—"}
          </p>
          {report.paymentId && (
            <p>
              Facture {report.paymentId} · virement {report.payoutId ?? "non créé"}
              {report.verified ? " · validé par TOTP" : ""}
            </p>
          )}
        </div>
      )}

      {status.state.history.length > 0 && (
        <details className="mt-3 text-[11.5px] text-stone-700">
          <summary className="cursor-pointer font-bold">
            Historique des recharges ({status.state.history.length})
          </summary>
          <ul className="mt-1 space-y-1">
            {status.state.history.map((entry) => (
              <li key={`${entry.at}-${entry.paymentId}`}>
                {new Date(entry.at).toLocaleString("fr-FR")} — {entry.status} · {money(entry.sendUsd)}{" "}
                envoyés · facture {entry.paymentId}
                {entry.payoutId ? ` · virement ${entry.payoutId}` : ""}
                {entry.detail ? ` · ${entry.detail}` : ""}
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="mt-2 text-[11px] leading-5 text-stone-500">
        Un seul virement à la fois : tant que la facture précédente n&apos;est pas créditée (ou expirée),
        aucun nouvel envoi n&apos;est possible. Le montant envoyé inclut les frais réseau, pour que le
        fournisseur reçoive exactement le montant de la facture. Le cron planifié ne fait qu&apos;une
        simulation.
      </p>
    </div>
  );
}
