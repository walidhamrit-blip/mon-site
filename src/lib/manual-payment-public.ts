// Passerelle entre la configuration vivante (serveur) et l'interface client
// des paiements manuels (Skrill / Neteller / Airtm / D17 / Volet / WebMoney / Kashy).
//
// Le navigateur n'a PAS besoin de la configuration entière : juste de quoi
// afficher la méthode, le compte à créditer, le taux et la majoration. On ne
// transmet donc que les méthodes réellement proposables, et jamais d'état
// interne (interrupteurs coupés, comptes vides, etc.).

import {
  MANUAL_PAYMENT_METHODS,
  normalizeManualPaymentsConfig,
  type ManualPaymentMethod,
} from "@/lib/manual-payment-core";

export interface PublicManualPaymentOption {
  method: ManualPaymentMethod;
  /** Compte à créditer tel qu'affiché au client (jamais un compte vide). */
  account: string;
  beneficiary: string;
  currency: "USD" | "LYD" | "EUR" | "TND" | "WMZ";
  rate: number | null;
  feePercent: number;
  instructions: string;
}

/**
 * Méthodes à afficher dans un tunnel de paiement.
 *
 * Une méthode n'apparaît que si elle est cochée ET utilisable (compte présent,
 * taux renseigné hors USD). Un réglage incomplet disparaît de l'interface au
 * lieu de produire un bouton qui échouerait au moment de payer.
 */
export function publicManualPaymentOptions(
  config: unknown,
): PublicManualPaymentOption[] {
  const normalized = normalizeManualPaymentsConfig(config);
  const options: PublicManualPaymentOption[] = [];
  for (const method of MANUAL_PAYMENT_METHODS) {
    const settings = normalized[method];
    if (!settings.enabled) continue;
    if (!settings.account.trim()) continue;
    if (settings.currency !== "USD" && !(Number(settings.rate) > 0)) continue;
    options.push({
      method,
      account: settings.account,
      beneficiary: settings.beneficiary,
      currency: settings.currency,
      rate: settings.currency === "USD" ? 1 : settings.rate,
      feePercent: settings.feePercent,
      instructions: settings.instructions,
    });
  }
  return options;
}
