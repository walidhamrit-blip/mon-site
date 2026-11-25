"use server";

/**
 * Actions admin de la file de vérification des paiements manuels
 * (Skrill, Neteller, Airtm, D17, Volet, WebMoney et Kashy).
 *
 * Principe identique à la carte téléphonique : l'acceptation est un geste
 * HUMAIN qui atteste la réception réelle de l'argent. Ensuite seulement :
 *  - `autoDeliver` → livraison du code (achat fournisseur autorisé) ;
 *  - sans `autoDeliver` → livraison manuelle par le gérant.
 * Un refus ne livre jamais rien et ne déclenche aucun achat.
 */

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import {
  listManualPayments,
  manualPaymentDeliveryGate,
  reviewManualPayment,
  type ReviewManualPaymentResult,
} from "@/lib/manual-payments";
import { approveManualSubscription } from "@/lib/subscriptions";
import {
  deliverPaidDigitalOrder,
  getAdminDigitalOrder,
  markDigitalOrderDeliveredOffPlatform,
} from "@/lib/digital-orders";
import { sendManualPaymentApprovedEmail } from "@/lib/digital-emails";
import {
  MANUAL_PAYMENT_METHOD_LABELS,
  manualPaymentMethodReady,
  normalizeManualPaymentMethod,
  normalizeManualPaymentsConfig,
} from "@/lib/manual-payment-core";
import { getSiteData, upsertSetting, SETTINGS_KEYS } from "@/lib/store";

export interface ActionResult {
  ok: boolean;
  error?: string;
  message?: string;
}

function dbIssue(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function reviewManualPaymentAction(
  ref: string,
  decision: "approved" | "rejected",
  note?: string,
  options: { autoDeliver?: boolean } = {},
): Promise<ActionResult> {
  await requireAdmin();
  if (decision !== "approved" && decision !== "rejected") {
    return { ok: false, error: "Décision de vérification invalide." };
  }
  const orderRef = String(ref ?? "").trim().toUpperCase();
  if (!orderRef) return { ok: false, error: "Référence manquante." };
  const autoDeliver = options?.autoDeliver === true;

  try {
    const rows = await listManualPayments(300);
    const row = rows.find((item) => item.ref === orderRef);
    if (!row) return { ok: false, error: "Paiement manuel introuvable." };

    const result: ReviewManualPaymentResult = await reviewManualPayment(
      orderRef,
      decision,
      note,
    );
    if (!result.ok) return { ok: false, error: result.error ?? "Vérification impossible." };

    revalidatePath("/admin/paiements-manuels");
    revalidatePath("/admin/orders");
    revalidatePath("/admin/digital/orders");

    if (decision === "rejected") {
      return {
        ok: true,
        message:
          "Paiement refusé. La commande est marquée comme non payée : aucun code ne sera livré et aucun achat fournisseur n’est déclenché.",
      };
    }

    // 1) Abonnement réglé par virement : l'approbation ouvre la période.
    if (result.subscriptionId) {
      const activation = await approveManualSubscription(result.subscriptionId, orderRef);
      revalidatePath("/admin/abonnements");
      if (!activation.ok) {
        return { ok: false, error: activation.error };
      }
      let mailWarning = "";
      try {
        const { config } = await getSiteData();
        const email = await sendManualPaymentApprovedEmail(
          {
            ref: orderRef,
            productTitle: row.productTitle,
            recipientName: row.recipientName,
            recipientEmail: row.recipientEmail,
            recipientPhone: row.recipientPhone,
          },
          row.method,
          config.name,
          config.url,
          config.email,
        );
        if (!email.ok) mailWarning = ` E-mail non envoyé : ${email.error ?? "échec inconnu"}`;
      } catch (error) {
        mailWarning = ` E-mail non envoyé : ${dbIssue(error)}`;
      }
      return {
        ok: true,
        message: `Paiement accepté : l’abonnement est actif pour la période en cours.${mailWarning}`,
      };
    }

    // 2) Commande digitale : livraison du code, seulement maintenant.
    const gate = await manualPaymentDeliveryGate(orderRef);
    let deliveryMessage = "";
    if (row.digitalOrderRef) {
      if (autoDeliver) {
        try {
          const delivery = await deliverPaidDigitalOrder(orderRef, {
            manualPaymentApproved: true,
          });
          deliveryMessage =
            delivery.outcome === "delivered"
              ? ` Code livré au client (${delivery.ref}).`
              : ` Livraison non effectuée : ${delivery.message} Saisissez le code manuellement.`;
        } catch (error) {
          deliveryMessage = ` Livraison automatique impossible : ${dbIssue(error)} Saisissez le code manuellement.`;
        }
      } else {
        deliveryMessage =
          " Commande marquée « à livrer manuellement » : saisissez le code cadeau dans la table des commandes.";
      }
      revalidatePath("/admin/digital/orders");
      revalidatePath("/codes/commande");
    } else if (gate.isManual) {
      deliveryMessage = "";
    }

    // 3) E-mail client « paiement accepté » (jamais de code dedans).
    let mailWarning = "";
    try {
      const order = await getAdminDigitalOrder(orderRef);
      if (order) {
        const { config } = await getSiteData();
        const email = await sendManualPaymentApprovedEmail(
          order,
          row.method,
          config.name,
          config.url,
          config.email,
        );
        if (!email.ok) mailWarning = ` E-mail non envoyé : ${email.error ?? "échec inconnu"}`;
      }
    } catch (error) {
      mailWarning = ` E-mail non envoyé : ${dbIssue(error)}`;
    }

    return {
      ok: true,
      message: `Paiement accepté.${deliveryMessage}${mailWarning}`.trim(),
    };
  } catch (error) {
    return { ok: false, error: dbIssue(error) };
  }
}

/**
 * Livraison manuelle d'un code après acceptation du paiement : refuse tant
 * que le paiement n'est pas accepté (le verrou est aussi dans la couche
 * métier, cette action ne fait que remonter l'erreur).
 */
export async function deliverManualPaymentOrderAction(
  ref: string,
  content: string,
  note?: string,
): Promise<ActionResult> {
  await requireAdmin();
  const orderRef = String(ref ?? "").trim().toUpperCase();
  if (!orderRef) return { ok: false, error: "Référence manquante." };
  const value = String(content ?? "").trim();
  if (value.length < 3) return { ok: false, error: "Saisissez le code à livrer." };

  try {
    const result = await markDigitalOrderDeliveredOffPlatform(orderRef, {
      channel: "manual",
      note: [value, note].filter(Boolean).join(" — "),
    });
    revalidatePath("/admin/paiements-manuels");
    revalidatePath("/admin/digital/orders");
    revalidatePath("/codes/commande");
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true, message: `Code livré au client (${orderRef}).` };
  } catch (error) {
    return { ok: false, error: dbIssue(error) };
  }
}

/**
 * Interrupteur opérationnel immédiat d'un moyen Skrill / Neteller / Airtm / D17 / Volet / WebMoney / Kashy. Un moyen incomplet (compte absent, ou taux hors USD manquant) ne peut
 * pas être activé depuis le tableau de bord. Les reçus déjà déclarés restent
 * toujours vérifiables et livrables après une désactivation.
 */
export async function setManualPaymentMethodEnabled(
  method: unknown,
  enabled: unknown,
): Promise<ActionResult> {
  await requireAdmin();
  const selected = normalizeManualPaymentMethod(method);
  if (!selected) {
    return { ok: false, error: "Moyen de paiement manuel invalide." };
  }
  if (typeof enabled !== "boolean") {
    return { ok: false, error: "Valeur invalide : true ou false attendu." };
  }

  const label = MANUAL_PAYMENT_METHOD_LABELS[selected];
  try {
    const { config } = await getSiteData();
    const manualPayments = normalizeManualPaymentsConfig(config.manualPayments);
    const current = manualPayments[selected];

    if (enabled && !manualPaymentMethodReady(current)) {
      return {
        ok: false,
        error: `${label} est incomplet : renseignez le compte à créditer${current.currency === "USD" ? "" : " et un taux positif"} avant de l’activer.`,
      };
    }

    const nextManualPayments = {
      ...manualPayments,
      [selected]: { ...current, enabled },
    };
    await upsertSetting(SETTINGS_KEYS.config, {
      ...config,
      manualPayments: nextManualPayments,
    });

    revalidatePath("/", "layout");
    revalidatePath("/codes", "layout");
    revalidatePath("/admin", "layout");
    revalidatePath("/admin/settings");
    revalidatePath("/admin/paiements-manuels");

    return {
      ok: true,
      message: enabled
        ? `${label} activé : les clients pourront le choisir.`
        : `${label} désactivé : il ne sera plus proposé aux clients ; les reçus déjà déclarés restent traitables.`,
    };
  } catch (error) {
    return { ok: false, error: dbIssue(error) };
  }
}

/** Coupe ou autorise tous les paiements manuels, indépendamment des réglages individuels. */
export async function setAllManualPaymentsEnabled(enabled: unknown): Promise<ActionResult> {
  await requireAdmin();
  if (typeof enabled !== "boolean") return { ok: false, error: "Valeur invalide." };
  try {
    const { MANUAL_PAYMENTS_MASTER_KEY } = await import("@/lib/manual-payment-availability");
    await upsertSetting(MANUAL_PAYMENTS_MASTER_KEY, enabled);
    revalidatePath("/", "layout");
    revalidatePath("/admin", "layout");
    return { ok: true, message: enabled
      ? "Interrupteur général activé : les moyens individuellement actifs rouvrent entre 9 h et minuit (Tripoli)."
      : "Tous les paiements manuels sont désactivés. Les demandes existantes restent consultables." };
  } catch (error) {
    return { ok: false, error: dbIssue(error) };
  }
}
