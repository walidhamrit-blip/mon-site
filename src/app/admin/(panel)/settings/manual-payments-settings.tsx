"use client";

import { DecimalInput } from "@/components/decimal-input";
import type { ManualPaymentsConfigData, ManualPaymentMethodConfigData } from "@/lib/site-types";
import {
  MANUAL_PAYMENT_METHOD_CURRENCIES,
  MANUAL_PAYMENT_METHOD_DEFAULT_CURRENCY,
  MANUAL_PAYMENT_METHOD_LABELS,
  MANUAL_PAYMENT_METHODS,
  manualPaymentMethodReady,
  type ManualPaymentCurrency,
  type ManualPaymentMethod,
} from "@/lib/manual-payment-core";

const METHOD_HINTS: Record<ManualPaymentMethod, string> = {
  skrill: "E-mail du compte Skrill de l’agence (ou identifiant marchand).",
  neteller: "E-mail / identifiant du compte Neteller qui reçoit les fonds.",
  airtm: "E-mail du compte Airtm (adresse d’envoi des fonds).",
  d17: "Numéro D17 / e-Dinar de la Poste Tunisienne qui reçoit l’argent.",
  advcash: "Identifiant Volet / AdvCash qui reçoit les fonds (USD uniquement).",
  webmoney: "Identifiant WebMoney qui reçoit les fonds (devise WMZ : indiquez le taux).",
  kashy: "Numéro de téléphone / identifiant Kashy qui reçoit les fonds (TND uniquement).",
};

/**
 * Réglages des moyens de paiement manuels : un bloc par moyen, avec son
 * propre compte, sa devise et son taux.
 *
 * Le montant affiché au client n'est jamais figé dans le code : il est
 * calculé à partir d'ici (montant USD de la commande × taux × majoration).
 * Laisser le compte vide ou décocher « Actif » ferme le moyen partout.
 */
export function ManualPaymentsSettings({
  value,
  onChange,
}: {
  value: ManualPaymentsConfigData | undefined;
  onChange: (next: ManualPaymentsConfigData) => void;
}) {
  const current = value ?? ({} as ManualPaymentsConfigData);

  const defaultSettings = (method: ManualPaymentMethod): ManualPaymentMethodConfigData => ({
    enabled: false,
    account: "",
    beneficiary: "",
    currency: MANUAL_PAYMENT_METHOD_DEFAULT_CURRENCY[method],
    rate: null,
    feePercent: 0,
    instructions: "",
  });

  const update = (method: ManualPaymentMethod, patch: Partial<ManualPaymentMethodConfigData>) => {
    const previous: ManualPaymentMethodConfigData =
      current[method] ?? defaultSettings(method);
    onChange({ ...current, [method]: { ...previous, ...patch } });
  };

  return (
    <div className="space-y-4">
      <div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#8A6D2F]">
          Paiements manuels · sans passerelle
        </span>
        <h2 className="mt-1 text-lg font-extrabold text-stone-900">
          Skrill, Neteller, Airtm, D17, Volet, WebMoney et Kashy
        </h2>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-stone-500 sm:text-sm">
          Le client transfère lui-même l’argent sur le compte indiqué, puis
          déclare le compte expéditeur et l’identifiant de transaction. Rien
          n’est livré avant votre acceptation dans la file « Paiements manuels ».
          Montant demandé ={" "}
          <strong className="text-stone-800">
            total USD × taux × (1 + majoration %)
          </strong>
          . Un moyen n’est proposé que s’il est activé et que son compte est rempli
          (et, hors USD, que son taux est positif).
        </p>
      </div>

      <div className="grid gap-4">
        {MANUAL_PAYMENT_METHODS.map((method) => {
          const settings: ManualPaymentMethodConfigData =
            current[method] ?? defaultSettings(method);
          const complete = manualPaymentMethodReady(settings);
          const ready = settings.enabled === true && complete;

          return (
            <div
              key={method}
              className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs sm:p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-extrabold text-stone-900">
                    {MANUAL_PAYMENT_METHOD_LABELS[method]}
                  </h3>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                      ready
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-stone-200 bg-stone-50 text-stone-500"
                    }`}
                  >
                    {ready ? "Proposé aux clients" : "Fermé"}
                  </span>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-[12px] font-bold text-stone-700">
                  <input
                    type="checkbox"
                    checked={settings.enabled === true}
                    onChange={(event) => update(method, { enabled: event.target.checked })}
                    className="h-4 w-4 accent-[#8A6D2F]"
                  />
                  Actif
                </label>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-[11px] font-bold text-stone-500">
                    Compte / identifiant à créditer (obligatoire)
                  </span>
                  <input
                    value={settings.account}
                    onChange={(event) => update(method, { account: event.target.value })}
                    dir="ltr"
                    maxLength={120}
                    placeholder={METHOD_HINTS[method]}
                    className="h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-[12.5px] outline-none focus:border-[#8A6D2F]"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-[11px] font-bold text-stone-500">
                    Bénéficiaire (facultatif)
                  </span>
                  <input
                    value={settings.beneficiary}
                    onChange={(event) => update(method, { beneficiary: event.target.value })}
                    maxLength={120}
                    className="h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-[12.5px] outline-none focus:border-[#8A6D2F]"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-[11px] font-bold text-stone-500">
                    Devise du compte
                  </span>
                  <select
                    value={settings.currency}
                    onChange={(event) => {
                      const currency = event.target.value as ManualPaymentCurrency;
                      // On efface le taux lors d’un changement de devise : le
                      // taux de l’ancienne devise ne doit jamais être réutilisé
                      // par erreur (notamment pour WMZ).
                      update(method, {
                        currency,
                        rate:
                          currency === "USD" || currency !== settings.currency
                            ? null
                            : settings.rate,
                      });
                    }}
                    className="h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-[12.5px] outline-none focus:border-[#8A6D2F]"
                  >
                    {MANUAL_PAYMENT_METHOD_CURRENCIES[method].map((currency) => (
                      <option key={currency} value={currency}>
                        {currency}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-[11px] font-bold text-stone-500">
                    Taux : 1 USD = ? {settings.currency}
                  </span>
                  <DecimalInput
                    value={settings.currency === "USD" ? 1 : settings.rate}
                    onChange={(rate) =>
                      update(method, {
                        rate: settings.currency === "USD" ? null : rate,
                      })
                    }
                    disabled={settings.currency === "USD"}
                    decimals={2}
                    placeholder={settings.currency === "WMZ" ? "À renseigner" : "Ex. 3.10"}
                    className="h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-[12.5px] outline-none focus:border-[#8A6D2F] disabled:bg-stone-100 disabled:text-stone-400"
                    ariaLabel={`Taux de conversion ${method}`}
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-[11px] font-bold text-stone-500">
                    Majoration (%)
                  </span>
                  <DecimalInput
                    value={settings.feePercent ?? 0}
                    onChange={(fee) =>
                      update(method, {
                        feePercent: Math.min(25, Math.max(0, fee ?? 0)),
                      })
                    }
                    decimals={2}
                    placeholder="0.00"
                    className="h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-[12.5px] outline-none focus:border-[#8A6D2F]"
                    ariaLabel={`Majoration ${method}`}
                  />
                </label>

                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-[11px] font-bold text-stone-500">
                    Consigne affichée au client (facultatif)
                  </span>
                  <textarea
                    value={settings.instructions}
                    onChange={(event) => update(method, { instructions: event.target.value })}
                    maxLength={300}
                    rows={2}
                    placeholder="Ex. envoyez en « payment to friends and family », puis indiquez l’ID de transaction."
                    className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[#8A6D2F]"
                  />
                </label>
              </div>

              {settings.enabled && !complete && (
                <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11.5px] font-semibold text-amber-800">
                  Ce moyen reste fermé aux clients : renseignez le compte
                  {settings.currency !== "USD" ? " et un taux positif" : ""}.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
