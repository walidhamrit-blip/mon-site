"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Power, Wallet } from "lucide-react";
import { setManualPaymentMethodEnabled } from "@/app/admin/manual-payments-actions";
import { PhoneCardPaymentsToggle } from "./phone-card-payments-toggle";
import {
  MANUAL_PAYMENT_CURRENCY_LABELS,
  MANUAL_PAYMENT_METHOD_LABELS,
  MANUAL_PAYMENT_METHODS,
  manualPaymentMethodReady,
  type ManualPaymentMethod,
} from "@/lib/manual-payment-core";
import type { ManualPaymentsConfigData } from "@/lib/site-types";

/**
 * Vue d’ensemble actionnable des paiements manuels.
 *
 * Chaque moyen a son propre interrupteur : activer Skrill n’active pas
 * Neteller, et désactiver un moyen ne livre ni ne supprime les reçus déjà
 * envoyés. Les réglages détaillés (compte, devise, taux) restent dans
 * Réglages → Paiements manuels.
 */
export function ManualPaymentsOverview({
  phoneCardEnabled,
  manualPayments,
}: {
  phoneCardEnabled: boolean;
  manualPayments: ManualPaymentsConfigData;
}) {
  const router = useRouter();
  const titleId = useId();
  const descriptionId = useId();
  const [pendingMethod, setPendingMethod] = useState<ManualPaymentMethod | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [transitionPending, startTransition] = useTransition();

  const pending = transitionPending || pendingMethod !== null;

  const toggleMethod = (method: ManualPaymentMethod) => {
    const current = manualPayments[method];
    const next = !current.enabled;
    if (
      !next &&
      !window.confirm(
        `Désactiver ${MANUAL_PAYMENT_METHOD_LABELS[method]} ?\n\n` +
          "Les nouvelles demandes utilisant ce moyen seront refusées. " +
          "Les reçus déjà déclarés restent vérifiables et livrables.",
      )
    ) {
      return;
    }

    setPendingMethod(method);
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await setManualPaymentMethodEnabled(method, next);
        setFeedback({
          ok: result.ok,
          text: result.message ?? result.error ?? "Réponse inattendue.",
        });
        if (result.ok) router.refresh();
      } catch {
        setFeedback({
          ok: false,
          text: "Enregistrement impossible. L’état affiché reste inchangé ; réessayez.",
        });
      } finally {
        setPendingMethod(null);
      }
    });
  };

  return (
    <section
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="space-y-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-2xs sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-3xl">
          <h2 id={titleId} className="flex items-center gap-2 text-sm font-black text-stone-900">
            <Wallet className="h-4 w-4 shrink-0 text-[#8A6D2F]" />
            Paiements manuels
          </h2>
          <p id={descriptionId} className="mt-1.5 text-xs leading-5 text-stone-600">
            Carte / solde téléphonique et virements hors passerelle. Chaque moyen est indépendant ;
            les crypto-monnaies ne sont jamais coupées par ces interrupteurs. Les demandes déjà
            reçues restent traitables.
          </p>
        </div>
        <Link
          href="/admin/settings?tab=manual-payments"
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-[#C6A664]/50 bg-[#C6A664]/10 px-4 text-xs font-bold text-[#8A6D2F] transition-colors hover:bg-[#C6A664]/20"
        >
          Configurer les comptes
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <PhoneCardPaymentsToggle enabled={phoneCardEnabled} embedded />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {MANUAL_PAYMENT_METHODS.map((method) => {
          const settings = manualPayments[method];
          const complete = manualPaymentMethodReady(settings);
          const enabled = settings.enabled === true && complete;
          const busy = pendingMethod === method;
          const rateLabel = settings.currency === "USD"
            ? "1 USD = 1 USD"
            : settings.rate != null
              ? `1 USD = ${settings.rate.toFixed(2)} ${settings.currency}`
              : "Taux manquant";

          return (
            <div
              key={method}
              className={`flex min-w-0 flex-col gap-3 rounded-xl border p-3.5 ${
                enabled
                  ? "border-emerald-200 bg-emerald-50/40"
                  : complete
                    ? "border-stone-200 bg-stone-50/70"
                    : "border-amber-200 bg-amber-50/50"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-xs font-black text-stone-900">
                    {MANUAL_PAYMENT_METHOD_LABELS[method]}
                  </h3>
                  <p className="mt-1 truncate text-[11px] text-stone-500" title={settings.account || undefined}>
                    {settings.account || "Compte non renseigné"}
                  </p>
                </div>
                <span
                  role="status"
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold ${
                    enabled
                      ? "border-emerald-300 bg-white text-emerald-800"
                      : complete
                        ? "border-stone-200 bg-white text-stone-600"
                        : "border-amber-300 bg-white text-amber-900"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`h-1.5 w-1.5 rounded-full ${
                      enabled ? "bg-emerald-600" : complete ? "bg-stone-400" : "bg-amber-600"
                    }`}
                  />
                  {enabled ? "Activé" : complete ? "Prêt" : "À configurer"}
                </span>
              </div>

              <dl className="grid grid-cols-2 gap-2 text-[10.5px] leading-4 text-stone-600">
                <div>
                  <dt className="font-semibold text-stone-400">Devise</dt>
                  <dd>{MANUAL_PAYMENT_CURRENCY_LABELS[settings.currency]}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-stone-400">Majoration</dt>
                  <dd>{Number(settings.feePercent ?? 0).toFixed(2)} %</dd>
                </div>
                <div className="col-span-2">
                  <dt className="font-semibold text-stone-400">Taux</dt>
                  <dd dir="ltr" className="font-mono">{rateLabel}</dd>
                </div>
              </dl>

              <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  aria-label={`${MANUAL_PAYMENT_METHOD_LABELS[method]} : ${enabled ? "désactiver" : "activer"}`}
                  disabled={!complete || pending}
                  title={complete ? undefined : "Renseignez d’abord le compte et, hors USD, un taux positif."}
                  onClick={() => toggleMethod(method)}
                  className={`inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-[11px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    enabled
                      ? "border border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
                      : "bg-stone-900 text-white hover:bg-stone-800"
                  }`}
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Power className="h-3.5 w-3.5" />}
                  {busy ? "Enregistrement…" : enabled ? "Désactiver" : "Activer"}
                </button>
                <Link
                  href="/admin/settings?tab=manual-payments"
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-stone-200 bg-white px-3 text-[11px] font-bold text-stone-600 transition-colors hover:bg-stone-50 hover:text-stone-900"
                >
                  Configurer
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] leading-4 text-stone-500">
        L’activation ou la désactivation est immédiate et conservée après redéploiement. Elle ne modifie
        pas les reçus déjà envoyés : ils restent visibles dans la file de vérification.
      </p>
      {feedback && (
        <p
          role={feedback.ok ? "status" : "alert"}
          className={`rounded-xl border px-3 py-2 text-xs leading-5 ${
            feedback.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {feedback.text}
        </p>
      )}
    </section>
  );
}
