"use client";

import { useState } from "react";
import { Upload, X } from "lucide-react";
import { DecimalInput } from "@/components/decimal-input";
import type { ManualPaymentsConfigData, ManualPaymentMethodConfigData } from "@/lib/site-types";
import {
  MANUAL_PAYMENT_LIMITS,
  MANUAL_PAYMENT_METHOD_CURRENCIES,
  MANUAL_PAYMENT_METHOD_DEFAULT_CURRENCY,
  MANUAL_PAYMENT_METHOD_LABELS,
  MANUAL_PAYMENT_METHODS,
  isCryptoManualPaymentMethod,
  isDirectCryptoWalletMethod,
  isDollarPeggedManualCurrency,
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
  binance_pay: "Binance Pay ID ou Binance UID qui reçoit le transfert interne (0 frais).",
  okx_pay: "OKX UID / identifiant interne OKX Pay qui reçoit les fonds.",
  bybit_pay: "Bybit UID / identifiant interne Bybit Pay qui reçoit les fonds.",
  redotpay: "RedotPay ID / UID qui reçoit le transfert interne RedotPay.",
  usdt_bep20: "Adresse de dépôt USDT sur réseau BNB Smart Chain (BEP20, commence par 0x…).",
  usdt_trc20: "Adresse de dépôt USDT sur réseau Tron (TRC20, commence par T…).",
  usdt_ton: "Adresse de dépôt USDT sur réseau TON (UQ… / EQ… ; ajoutez le Memo en consigne si nécessaire).",
  usdt_polygon: "Adresse de dépôt USDT sur réseau Polygon (commence par 0x…).",
  usdt_sol: "Adresse de dépôt USDT sur réseau Solana.",
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
  const [uploadingMethod, setUploadingMethod] = useState<ManualPaymentMethod | null>(null);
  const [uploadError, setUploadError] = useState<{ method: ManualPaymentMethod; message: string } | null>(null);

  const defaultSettings = (method: ManualPaymentMethod): ManualPaymentMethodConfigData => ({
    enabled: false,
    account: "",
    beneficiary: "",
    currency: MANUAL_PAYMENT_METHOD_DEFAULT_CURRENCY[method],
    rate: null,
    feePercent: 0,
    instructions: "",
    qrImage: "",
  });

  const update = (method: ManualPaymentMethod, patch: Partial<ManualPaymentMethodConfigData>) => {
    const previous: ManualPaymentMethodConfigData =
      current[method] ?? defaultSettings(method);
    onChange({ ...current, [method]: { ...previous, ...patch } });
  };

  const uploadQrImage = async (method: ManualPaymentMethod, file: File) => {
    if (file.size > 4 * 1024 * 1024) {
      setUploadError({ method, message: "Image trop lourde (4 Mo maximum)." });
      return;
    }
    setUploadError(null);
    setUploadingMethod(method);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/admin/media", { method: "POST", body });
      const result = (await response.json()) as { ok?: boolean; url?: string; error?: string };
      if (!response.ok || !result.ok || !result.url) {
        throw new Error(result.error || "Import impossible.");
      }
      update(method, { qrImage: result.url });
    } catch (error) {
      setUploadError({
        method,
        message: error instanceof Error ? error.message : "Import impossible.",
      });
    } finally {
      setUploadingMethod(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#8A6D2F]">
          Paiements manuels · sans passerelle
        </span>
        <h2 className="mt-1 text-lg font-extrabold text-stone-900">
          Binance Pay, OKX, Bybit, RedotPay, USDT direct, Skrill, Neteller, Airtm, D17, Volet, WebMoney et Kashy
        </h2>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-stone-500 sm:text-sm">
          Le client transfère lui-même l’argent sur le compte, UID ou adresse indiqué, puis
          déclare le compte/adresse expéditeur et l’identifiant de transaction (Order ID / TxHash). Rien
          n’est livré avant votre acceptation dans la file « Paiements manuels ».
          Montant demandé ={" "}
          <strong className="text-stone-800">
            total USD × taux × (1 + majoration %)
          </strong>
          . Un moyen n’est proposé que s’il est activé et que son compte est rempli
          (et, hors USD/USDT, que son taux est positif).
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
                    maxLength={MANUAL_PAYMENT_LIMITS.account}
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
                    maxLength={MANUAL_PAYMENT_LIMITS.beneficiary}
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
                          isDollarPeggedManualCurrency(currency) || currency !== settings.currency
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
                    value={isDollarPeggedManualCurrency(settings.currency) ? 1 : settings.rate}
                    onChange={(rate) =>
                      update(method, {
                        rate: isDollarPeggedManualCurrency(settings.currency) ? null : rate,
                      })
                    }
                    disabled={isDollarPeggedManualCurrency(settings.currency)}
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

                {isCryptoManualPaymentMethod(method) && (
                  <div className="sm:col-span-2 rounded-xl border border-stone-200 bg-stone-50/70 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="block text-[11px] font-bold text-stone-700">
                          QR Code affiché au client (facultatif)
                        </span>
                        <p className="text-[11px] text-stone-500">
                          {isDirectCryptoWalletMethod(method)
                            ? "Un QR code est déjà généré automatiquement depuis votre adresse ci-dessus. Importez une image seulement si vous voulez la remplacer."
                            : "Importez le QR code de réception exporté depuis votre application (sinon un QR de votre Pay ID / UID est généré automatiquement)."}
                        </p>
                      </div>
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-[11.5px] font-bold text-stone-700 hover:border-[#8A6D2F]">
                        <Upload className="h-3.5 w-3.5" />
                        {uploadingMethod === method ? "Envoi…" : "Importer un QR"}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          className="sr-only"
                          disabled={uploadingMethod === method}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) void uploadQrImage(method, file);
                            event.target.value = "";
                          }}
                        />
                      </label>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <input
                        value={settings.qrImage ?? ""}
                        onChange={(event) => update(method, { qrImage: event.target.value })}
                        dir="ltr"
                        maxLength={MANUAL_PAYMENT_LIMITS.qrImage}
                        placeholder="/api/media/… ou https://… (laisser vide = QR automatique)"
                        className="h-9 min-w-[220px] flex-1 rounded-lg border border-stone-300 bg-white px-2.5 text-[12px] outline-none focus:border-[#8A6D2F]"
                      />
                      {settings.qrImage && (
                        <button
                          type="button"
                          onClick={() => update(method, { qrImage: "" })}
                          className="inline-flex h-9 items-center gap-1 rounded-lg border border-stone-300 bg-white px-2.5 text-[11.5px] font-semibold text-stone-600 hover:border-red-300 hover:text-red-700"
                        >
                          <X className="h-3.5 w-3.5" />
                          Retirer
                        </button>
                      )}
                    </div>

                    {settings.qrImage && (
                      <div className="mt-2 flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={settings.qrImage}
                          alt={`Aperçu QR ${MANUAL_PAYMENT_METHOD_LABELS[method]}`}
                          className="h-20 w-20 rounded-lg border border-stone-200 bg-white object-contain p-1"
                        />
                        <span className="text-[11px] text-stone-500">
                          QR personnalisé actif (remplace le QR généré automatiquement).
                        </span>
                      </div>
                    )}

                    {uploadError?.method === method && (
                      <p className="mt-1.5 text-[11px] font-semibold text-red-700">
                        {uploadError.message}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {settings.enabled && !complete && (
                <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11.5px] font-semibold text-amber-800">
                  Ce moyen reste fermé aux clients : renseignez le compte
                  {!isDollarPeggedManualCurrency(settings.currency) ? " et un taux positif" : ""}.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
