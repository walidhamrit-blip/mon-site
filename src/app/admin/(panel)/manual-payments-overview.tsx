"use client";

import Link from "next/link";
import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Power, Wallet } from "lucide-react";
import { setAllManualPaymentsEnabled, setManualPaymentMethodEnabled } from "@/app/admin/manual-payments-actions";
import { manualPaymentsClosedAt } from "@/lib/manual-payment-hours";
import { PhoneCardPaymentsToggle } from "./phone-card-payments-toggle";
import {
  MANUAL_PAYMENT_CURRENCY_LABELS,
  MANUAL_PAYMENT_METHOD_LABELS,
  MANUAL_PAYMENT_METHODS,
  isDollarPeggedManualCurrency,
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
  masterEnabled,
  manualPayments,
}: {
  phoneCardEnabled: boolean;
  masterEnabled: boolean | null;
  manualPayments: ManualPaymentsConfigData;
}) {
  const router = useRouter();
  const titleId = useId();
  const descriptionId = useId();
  const master = masterEnabled;
  const [closedNow, setClosedNow] = useState(true);
  const [masterBusy, setMasterBusy] = useState(false);
  useEffect(() => {
    const update = () => setClosedNow(manualPaymentsClosedAt(new Date()));
    update();
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const [pendingMethod, setPendingMethod] = useState<ManualPaymentMethod | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [transitionPending, startTransition] = useTransition();

  const pending = transitionPending || pendingMethod !== null || masterBusy;

  const toggleMaster = () => {
    if (master === null) return;
    const next = !master;
    setMasterBusy(true);
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await setAllManualPaymentsEnabled(next);
        setFeedback({ ok: result.ok, text: result.message ?? result.error ?? "Réponse inattendue." });
        if (result.ok) router.refresh();
      } catch {
        setFeedback({ ok: false, text: "Enregistrement impossible. Réessayez." });
      } finally { setMasterBusy(false); }
    });
  };

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
            Carte / solde téléphonique et virements hors passerelle. Chaque moyen garde son réglage individuel ;
            les paiements automatiques par passerelle ne sont pas coupés par ces interrupteurs. Les demandes déjà
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

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
        <div>
          <h3 className="text-sm font-black text-stone-900">Interrupteur général des paiements manuels</h3>
          <p className="mt-1 text-xs text-stone-600">Inclut cartes téléphoniques et virements manuels, y compris USDT manuel. Les paiements crypto via NOWPayments ne sont pas concernés.</p>
          <p role="status" className="mt-1 text-xs font-bold text-stone-800">{master === null ? "État indisponible : nouvelles demandes bloquées." : !master ? "Fermé manuellement, y compris après 9 h." : closedNow ? "Fermeture automatique : 00 h–09 h, heure de Tripoli." : "Ouvert : seuls les moyens individuels activés sont proposés."}</p>
        </div>
        <button type="button" role="switch" aria-checked={master === true} aria-label="Interrupteur général des paiements manuels" disabled={pending || master === null} onClick={toggleMaster} className="min-h-11 rounded-xl bg-stone-900 px-4 text-xs font-bold text-white disabled:opacity-50">
          {masterBusy ? "Enregistrement…" : master === null ? "Indisponible" : master ? "Tout désactiver" : "Tout autoriser"}
        </button>
      </div>
      <p className="text-xs text-stone-600">Les états ci-dessous indiquent les réglages individuels, pas la disponibilité effective : ils restent mémorisés même lorsque la fermeture générale ou horaire s’applique.</p>
      <PhoneCardPaymentsToggle enabled={phoneCardEnabled} embedded />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {MANUAL_PAYMENT_METHODS.map((method) => {
          const settings = manualPayments[method];
          const complete = manualPaymentMethodReady(settings);
          const enabled = settings.enabled === true && complete;
          const busy = pendingMethod === method;
          const rateLabel = isDollarPeggedManualCurrency(settings.currency)
            ? `1 USD = 1 ${settings.currency}`
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
