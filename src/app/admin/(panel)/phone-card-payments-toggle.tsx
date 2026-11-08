"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Power, Smartphone } from "lucide-react";
import { setPhoneCardPaymentsEnabled } from "@/app/admin/actions";

/**
 * Interrupteur opérationnel, enregistré immédiatement et durablement.
 * Il coupe les nouvelles demandes, jamais la revue des cartes déjà reçues.
 */
export function PhoneCardPaymentsToggle({ enabled: initialEnabled }: { enabled: boolean }) {
  const router = useRouter();
  const descriptionId = useId();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const toggle = () => {
    const next = !enabled;
    if (
      !next &&
      !window.confirm(
        "Désactiver le paiement manuel par carte / solde téléphonique ?\n\n" +
          "Les nouvelles demandes seront refusées, y compris depuis une page déjà ouverte. " +
          "Le paiement crypto reste disponible. Vous pourrez toujours vérifier et livrer les cartes déjà reçues.\n\n" +
          "Le paiement restera désactivé jusqu'à votre réactivation manuelle.",
      )
    ) {
      return;
    }
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await setPhoneCardPaymentsEnabled(next);
        setFeedback({ ok: result.ok, text: result.message ?? result.error ?? "Réponse inattendue." });
        if (result.ok) {
          setEnabled(next);
          router.refresh();
        }
      } catch {
        setFeedback({
          ok: false,
          text: "Enregistrement impossible. L’état affiché reste inchangé ; vérifiez la connexion puis réessayez.",
        });
      }
    });
  };

  return (
    <section
      aria-labelledby={`${descriptionId}-title`}
      className={`rounded-2xl border p-4 sm:p-5 shadow-2xs ${
        enabled ? "border-emerald-200 bg-emerald-50/50" : "border-amber-300 bg-amber-50/70"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1 basis-64">
          <h2 id={`${descriptionId}-title`} className="flex items-center gap-2 text-sm font-black text-stone-900">
            <Smartphone className="h-4 w-4 shrink-0 text-[#8A6D2F]" />
            Paiement manuel · carte / solde téléphonique
          </h2>
          <p id={descriptionId} className="mt-1.5 text-xs leading-5 text-stone-600">
            Coupez les nouvelles demandes Libyana / Al Madar pendant vos périodes d’indisponibilité.
            Le paiement crypto reste disponible ; les cartes déjà reçues restent accessibles pour vérification et livraison.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span
            role="status"
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${
              enabled
                ? "border-emerald-300 bg-white text-emerald-800"
                : "border-amber-300 bg-white text-amber-900"
            }`}
          >
            <span aria-hidden="true" className={`h-2 w-2 rounded-full ${enabled ? "bg-emerald-600" : "bg-amber-600"}`} />
            {enabled ? "Activé" : "Désactivé"}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Paiement manuel par carte / solde téléphonique"
            aria-describedby={descriptionId}
            aria-busy={pending}
            disabled={pending}
            onClick={toggle}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-colors cursor-pointer disabled:cursor-wait disabled:opacity-60 ${
              enabled
                ? "border border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
                : "bg-stone-900 text-white hover:bg-stone-800"
            }`}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
            {pending ? "Enregistrement…" : enabled ? "Désactiver" : "Activer"}
          </button>
        </div>
      </div>
      <p className="mt-2 text-[11px] leading-4 text-stone-500">
        Enregistrement immédiat, sans bouton « Enregistrer » supplémentaire. Conservé après redéploiement ;
        réactivation uniquement de votre part, sans date de retour automatique.
      </p>
      {feedback && (
        <p
          role={feedback.ok ? "status" : "alert"}
          className={`mt-3 rounded-xl border px-3 py-2 text-xs leading-5 ${
            feedback.ok ? "border-emerald-200 bg-white text-emerald-800" : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {feedback.text}
        </p>
      )}
    </section>
  );
}
