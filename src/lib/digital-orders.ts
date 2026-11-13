import { LEGACY_SUPPLIER_RETIRED, RETIRED_SUPPLIER_MESSAGE } from "@/lib/retired-supplier";
// Commandes digitales — « vendre à la commande ».
//
// Flux complet :
//   1. le client choisit un code (catalogue `/codes`) et le paie en crypto
//      (facture hébergée NOWPayments) ;
//   2. l'IPN confirme le paiement → `deliverPaidDigitalOrder` route la
//      commande vers son fournisseur : FazerCards pour les produits du
//      catalogue FazerCards (`fzr-…`), Reloadly pour les fiches reliées à
//      un produit Reloadly ;
//   3. le code reçu est chiffré en base puis envoyé par e-mail au client,
//      et consultable sur `/codes/commande` (référence + jeton).
//
// Aucun stock n'est acheté à l'avance : on achète uniquement après
// encaissement. Toute condition non remplie (fournisseur non configuré,
// produit non relié, plafond dépassé, échec fournisseur) bascule la
// commande en livraison MANUELLE et notifie l'agence — jamais d'achat
// silencieux.

import { and, desc, eq, ne } from "drizzle-orm";
import { localizedPath } from "@/lib/locale";
import { db, ensureSchema } from "@/db";
import { digitalOrders, orders, type DigitalOrder } from "@/db/schema";
import {
  classifyDeliveryError,
  fulfillmentStatusFromLegacy,
  normalizeFulfillmentStatus,
  type DeliveryErrorClass,
  type FulfillmentStatus,
} from "@/lib/delivery-queue-core";
import { getDigitalProductBySlug } from "@/lib/digital-store";
import {
  denominationUnitPrice,
  effectiveFulfillment,
  type DigitalSupplier,
} from "@/lib/digital-types";
import {
  checkSupplierUnitPrice,
  maskEmail,
  normalizeDigitalStatus,
  parseManualCodes,
  pickOrderDenomination,
  quoteDigitalOrder,
  shouldAutoDeliverOnPoll,
  type DigitalOrderStatus,
  type DigitalQuote,
} from "@/lib/digital-order-core";
import {
  decryptDigitalCodes,
  digitalCodesKey,
  digitalCodesKeyRing,
  encryptDigitalCodes,
} from "@/lib/digital-codes";
import {
  createGiftCardOrder,
  getGiftCardCodes,
  getGiftCardProduct,
  isReloadlyError,
  reloadlyConfigured,
  reloadlyErrorMessage,
  reloadlyMaxOrderUsd,
  reloadlyMode,
  type GiftCardCode,
} from "@/lib/reloadly";
import {
  createInvoice,
  getPayment,
  nextOrderStatus,
  nowPaymentsConfigured,
  nowPaymentsSandbox,
  orderStatusFromIpn,
  validatePaidAmount,
} from "@/lib/nowpayments";
import { createTrackingToken, newOrderReference, trackingAccess } from "@/lib/order-tracking";
import { siteBaseUrl } from "@/lib/site-url";
import { getSiteData } from "@/lib/store";
import {
  sendDigitalCodesEmail,
  sendDigitalDeliveredOffPlatformEmail,
  sendDigitalManualNotice,
  sendDigitalTopupDeliveredEmail,
} from "@/lib/digital-emails";
import {
  offPlatformNotice,
  validateOffPlatformDelivery,
} from "@/lib/digital-offplatform-core";
import { recordDigitalEmailOutcome } from "@/lib/digital-email-log";
import { reviewPromptForConfig } from "@/lib/review-emails";
import { isFazercardsProductRef } from "@/lib/fazercards-catalog";
import { notifyTelegramOrderDelivered } from "@/lib/telegram-delivery";
import {
  claimProviderBudget,
  claimProviderSync,
  clearProviderSyncGate,
  releaseProviderSync,
} from "@/lib/provider-budget";
import { telegramOrderUrlFromEnv } from "@/lib/telegram-core";

import { deliverPaidFazercardsOrder } from "@/lib/fazercards-orders";
import { sendPaymentConfirmedEmail } from "@/lib/order-emails";
import { phoneCardDeliveryGate } from "@/lib/phone-card-payments";
import {
  phoneCardAutoDeliveryMessage,
  phoneCardDeliveryRoute,
  phoneCardPublicNotice,
} from "@/lib/phone-card-core";


/* Ré-exports : les consommateurs serveur (admin, routes) importent tout
 * depuis ce module ; les composants client utilisent directement
 * `digital-order-core` (sans base ni secrets). */
export {
  DIGITAL_ORDER_STATUSES,
  DIGITAL_ORDER_STATUS_LABELS,
  DIGITAL_ORDER_STATUS_TONES,
  MAX_DIGITAL_QUANTITY,
  normalizeDigitalStatus,
  parseManualCodes,
  quoteDigitalOrder,
} from "@/lib/digital-order-core";
export type { DigitalOrderStatus, DigitalQuote } from "@/lib/digital-order-core";
export {
  digitalCodesKey,
  digitalCodesKeyRing,
  encryptDigitalCodes,
  decryptDigitalCodes,
} from "@/lib/digital-codes";

/* ------------------------ Valeur faciale vs Reloadly ---------------------- */

/**
 * Contrôle la valeur faciale auprès du produit Reloadly AVANT l'achat.
 *
 * Renvoie un motif lisible quand le fournisseur refuse cette valeur
 * (`WRONG_PRODUCT_PRICE` côté API, message incompréhensible pour l'admin),
 * `null` quand elle est acceptable — ou quand la vérification est
 * impossible (panne du catalogue) : on ne bloque jamais un achat sur une
 * vérification facultative.
 */
async function supplierPriceIssue(productId: number, unitPrice: number): Promise<string | null> {
  try {
    const product = await getGiftCardProduct(productId);
    const check = checkSupplierUnitPrice(product, unitPrice);
    return check.ok
      ? null
      : `${check.message} Corrigez la « Valeur Reloadly » de ce montant dans la fiche, puis relancez.`;
  } catch (error) {
    console.warn(
      "[digital] vérification de la valeur faciale impossible :",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/* ------------------------------- Création -------------------------------- */

export interface CreateDigitalCheckoutInput {
  productSlug: string;
  denominationId: string;
  quantity: unknown;
  email: string;
  name?: string;
  phone?: string;
  locale?: "ar" | "en";
}

export interface DigitalCheckoutResult {
  orderRef: string;
  trackingToken: string;
  paymentUrl: string;
  totalUsd: number;
  productTitle: string;
  denominationLabel: string;
  quantity: number;
}

/**
 * Crée la commande + la facture crypto. Le prix est recalculé ici à
 * partir du catalogue : aucun montant transmis par le navigateur n'est
 * accepté.
 */
export async function createDigitalCheckout(
  input: CreateDigitalCheckoutInput,
  req: Request,
): Promise<DigitalCheckoutResult> {
  if (LEGACY_SUPPLIER_RETIRED) {
    throw new DigitalOrderError("supplier_retired", 410, RETIRED_SUPPLIER_MESSAGE);
  }
  const product = await getDigitalProductBySlug(input.productSlug);
  const quoted = quoteDigitalOrder(product, input.denominationId, input.quantity);
  if (!quoted.ok || !product) {
    throw new DigitalOrderError(quoted.ok ? "product_not_found" : quoted.error, 400, quoted.ok ? "Produit introuvable." : quoted.message);
  }
  const { quote } = quoted;

  const fulfillment = effectiveFulfillment(product);
  if (fulfillment === "auto" && reloadlyEnvironmentMismatch()) {
    // Refus AVANT encaissement : mieux vaut ne rien vendre que livrer un
    // code de test à un client qui a payé en crypto réelle.
    console.error(
      "[digital][checkout] refuse : NOWPayments en production mais Reloadly en mode sandbox (RELOADLY_SANDBOX absent ou =true)",
    );
    throw new DigitalOrderError(
      "supplier_mode_mismatch",
      503,
      "Vente momentanément indisponible en ligne pour ce code. Contactez-nous sur WhatsApp : nous vous le fournissons manuellement.",
    );
  }
  if (fulfillment === "auto" && !reloadlyConfigured()) {
    // Le produit est censé être livré automatiquement mais aucun
    // identifiant Reloadly n'est présent sur le serveur : on refuse la
    // vente plutôt que d'encaisser sans pouvoir livrer. Le client reçoit
    // un message actionnable ; le détail technique reste dans les logs.
    console.error(
      "[digital][checkout] livraison automatique indisponible : RELOADLY_CLIENT_ID / RELOADLY_CLIENT_SECRET absents",
    );
    throw new DigitalOrderError(
      "supplier_not_configured",
      503,
      "Vente momentanément indisponible en ligne pour ce code. Contactez-nous sur WhatsApp : nous vous le fournissons manuellement.",
    );
  }

  // Prix accepté par le fournisseur : on refuse la vente AVANT d'encaisser
  // plutôt que de découvrir `WRONG_PRODUCT_PRICE` une fois le client payé.
  if (fulfillment === "auto" && quote.reloadlyUnitPrice != null) {
    const productId = Number(product.reloadlyProductId);
    const issue = await supplierPriceIssue(productId, quote.reloadlyUnitPrice);
    if (issue) {
      console.error(`[digital][checkout] valeur refusée (${product.slug}) : ${issue}`);
      throw new DigitalOrderError(
        "supplier_price_unsupported",
        409,
        "Ce montant n'est pas disponible à la vente en ligne pour le moment. Écrivez-nous sur WhatsApp : nous vous le fournissons autrement.",
      );
    }
  }

  const ref = newOrderReference("DGC");
  const tracking = createTrackingToken();
  const locale = input.locale === "en" ? "en" : "ar";
  const title = locale === "en" ? product.titleEn : product.titleAr;
  const label = `${title} — ${quote.label}${quote.quantity > 1 ? ` ×${quote.quantity}` : ""}`;

  await ensureSchema();

  // 1) Ligne de livraison (produit, destinataire, mode).
  const inserted = await db
    .insert(digitalOrders)
    .values({
      ref,
      trackingTokenHash: tracking.hash,
      productId: product.id,
      productSlug: product.slug,
      productTitle: title,
      kind: product.kind,
      platform: product.platform,
      denominationId: quote.denominationId,
      denominationLabel: quote.label,
      region: quote.region,
      faceValue: quote.faceValue,
      quantity: quote.quantity,
      unitPriceUsd: quote.unitPriceUsd.toFixed(2),
      totalUsd: quote.totalUsd.toFixed(2),
      recipientEmail: input.email,
      recipientName: input.name?.trim() || null,
      recipientPhone: input.phone?.trim() || null,
      locale,
      status: "pending",
      fulfillment,
      reloadlyProductId: product.reloadlyProductId ?? null,
      reloadlyUnitPrice:
        quote.reloadlyUnitPrice != null ? String(quote.reloadlyUnitPrice) : null,
      reloadlyCountryCode: (product.reloadlyCountryCode ?? "").toUpperCase().slice(0, 2),
    })
    .returning({ id: digitalOrders.id });
  const digitalOrderId = inserted[0]?.id;

  // 2) Ligne de paiement (table `orders`), reconnue par l'IPN NOWPayments.
  try {
    await db.insert(orders).values({
      ref,
      trackingTokenHash: tracking.hash,
      kind: "digital",
      planId: product.id,
      planName: label.slice(0, 190),
      amountLyd: quote.totalUsd.toFixed(2),
      amountUsd: quote.totalUsd.toFixed(2),
      currency: "usd",
      installments: 1,
      installmentIndex: 1,
      clientName: input.name?.trim() || null,
      email: input.email,
      phone: input.phone?.trim() || null,
      locale,
      digitalOrderId: digitalOrderId ?? null,
    });
  } catch (error) {
    // Sans ligne de paiement, la commande ne serait jamais confirmée.
    await db.delete(digitalOrders).where(eq(digitalOrders.ref, ref)).catch(() => null);
    throw error;
  }

  // 3) Facture hébergée NOWPayments (le client choisit sa crypto).
  const { config } = await getSiteData();
  const baseUrl = siteBaseUrl(req);
  const query = `ref=${encodeURIComponent(ref)}&t=${encodeURIComponent(tracking.token)}`;
  let invoice: Awaited<ReturnType<typeof createInvoice>>;
  try {
    invoice = await createInvoice({
      priceAmount: quote.totalUsd,
      orderId: ref,
      orderDescription: `${config.name} — ${label}`.slice(0, 190),
      ipnCallbackUrl: `${baseUrl}/api/payments/ipn`,
      successUrl: `${baseUrl}${localizedPath(`/codes/commande?${query}`, locale)}`,
      cancelUrl: `${baseUrl}${localizedPath(`/pay/cancel?${query}`, locale)}`,
    });
  } catch (error) {
    // Aucune facture : on retire la commande et sa ligne de paiement pour
    // ne pas laisser de commandes fantômes « en attente ».
    await db.delete(orders).where(eq(orders.ref, ref)).catch(() => null);
    await db.delete(digitalOrders).where(eq(digitalOrders.ref, ref)).catch(() => null);
    throw error;
  }

  await db
    .update(orders)
    .set({ paymentUrl: invoice.invoice_url, updatedAt: new Date() })
    .where(eq(orders.ref, ref))
    .catch(() => null);

  return {
    orderRef: ref,
    trackingToken: tracking.token,
    paymentUrl: invoice.invoice_url,
    totalUsd: quote.totalUsd,
    productTitle: title,
    denominationLabel: quote.label,
    quantity: quote.quantity,
  };
}

/** Erreur métier d'une commande digitale (code + message client). */
export class DigitalOrderError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = "DigitalOrderError";
    this.code = code;
    this.status = status;
  }
}

/* ------------------------------ Livraison -------------------------------- */

export type DigitalDeliveryOutcome =
  | "delivered"
  | "awaiting_codes"
  | "manual"
  | "already_delivered"
  | "not_paid"
  | "not_found"
  | "failed";

export interface DigitalDeliveryResult {
  outcome: DigitalDeliveryOutcome;
  ref: string;
  message?: string;
  /**
   * Classe de l'échec, quand il y en a un — renseignée par les chemins
   * FazerCards / Reloadly pour que la file de livraison distingue un
   * incident réseau (`transient`, on réessaie) d'un refus métier
   * (`permanent`, revue manuelle immédiate).
   */
  errorClass?: DeliveryErrorClass;
}

/** Fournisseur qui doit livrer une commande digitale (défini par le domaine). */
export type { DigitalSupplier };

/**
 * Détermine le fournisseur d'une commande.
 *
 * FazerCards et Reloadly partagent la même table `digitalOrders` (aucune
 * colonne « fournisseur » n'a été ajoutée au schéma) : l'appartenance se
 * lit sur le slug produit, que le checkout FazerCards enregistre avec le
 * préfixe `fzr-topup-` / `fzr-giftcard-` / `fzr-gamekey-`. Les commandes
 * antérieures (Reloadly) n'ont pas ce préfixe et restent livrées comme
 * avant.
 */
export function digitalOrderSupplier(order: {
  productSlug?: string | null;
  productId?: string | null;
}): DigitalSupplier {
  return isFazercardsProductRef(order.productSlug, order.productId)
    ? "fazercards"
    : "reloadly";
}

/**
 * Mélange d'environnements chez Reloadly : les clients paient en RÉEL
 * (NOWPayments production) alors que Reloadly émettrait des codes de TEST.
 *
 * Un tel achat livre un code factice à un client qui a payé : remboursement,
 * réclamation, perte de confiance. On refuse donc la vente automatique
 * (et on bascule les livraisons en cours en manuel) tant que l'appariement
 * n'est pas corrigé (`RELOADLY_SANDBOX=false` + identifiants LIVE).
 */
export function reloadlyEnvironmentMismatch(): boolean {
  if (!reloadlyConfigured()) return false;
  if (nowPaymentsSandbox()) return false;
  return reloadlyMode() === "sandbox";
}

async function loadDigitalOrder(idOrRef: number | string): Promise<DigitalOrder | null> {
  await ensureSchema();
  const rows = await db
    .select()
    .from(digitalOrders)
    .where(
      typeof idOrRef === "number"
        ? eq(digitalOrders.id, idOrRef)
        : eq(digitalOrders.ref, String(idOrRef).trim().toUpperCase()),
    )
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Marque la commande comme nécessitant une livraison humaine et prévient
 * l'agence. Le paiement reste valide : rien n'est perdu, il faut juste
 * acheter le code dans le tableau Reloadly puis le transmettre.
 */
async function flagManual(
  order: DigitalOrder,
  reason: string,
  errorClass: DeliveryErrorClass = "permanent",
): Promise<DigitalDeliveryResult> {
  const alreadyManual = order.status === "manual";
  // Statut granulaire `manual_review` : la commande est PAYÉE, l'argent est
  // encaissé, et un humain doit acheter le code ou rembourser. C'est
  // distinct d'un simple « en cours de livraison ».
  await db
    .update(digitalOrders)
    .set({
      status: "manual",
      fulfillmentStatus: "manual_review",
      nextRetryAt: null,
      lastError: reason.slice(0, 800),
      updatedAt: new Date(),
    })
    .where(eq(digitalOrders.id, order.id));

  // Une commande déjà signalée ne renvoie pas d'alerte à chaque relance :
  // seule la première bascule (ou un nouveau motif) notifie l'agence.
  if (alreadyManual && order.lastError === reason.slice(0, 800)) {
    return { outcome: "manual", ref: order.ref, message: reason };
  }

  try {
    const { config } = await getSiteData();
    await sendDigitalManualNotice(
      { ...order, status: "manual", lastError: reason },
      reason,
      config.name,
      config.url,
      config.email,
    );
  } catch (error) {
    console.warn(
      "[digital] notification manuelle non envoyée :",
      error instanceof Error ? error.message : error,
    );
  }

  return { outcome: "manual", ref: order.ref, message: reason, errorClass };
}

/** Clé de comparaison d'un prix (« 5 », « 5.00 », null → ""). */
function priceKey(value: string | null | undefined): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed.toFixed(2) : "";
}

/**
 * Réaligne la configuration de LIVRAISON d'une commande sur la fiche
 * actuelle (mode, produit Reloadly, pays, valeur faciale).
 *
 * Le prix payé n'est JAMAIS recalculé : le client a payé le tarif du moment
 * et le plafond d'achat se juge sur ce montant-là. Seuls les champs de
 * livraison sont rafraîchis.
 *
 * Sans ce réalignement, une commande payée AVANT la configuration de la
 * fiche restait bloquée en livraison manuelle pour toujours : « Relancer la
 * livraison » relisait le mode figé à la caisse, même après correction.
 */
async function resyncFulfillmentConfig(order: DigitalOrder): Promise<DigitalOrder> {
  let product: Awaited<ReturnType<typeof getDigitalProductBySlug>> = null;
  try {
    product = await getDigitalProductBySlug(order.productSlug);
  } catch (error) {
    // Fiche illisible : on garde la configuration figée plutôt que d'échouer.
    console.warn(
      "[digital] resynchronisation impossible :",
      error instanceof Error ? error.message : error,
    );
    return order;
  }
  if (!product) return order;

  const fulfillment = effectiveFulfillment(product);
  const reloadlyProductId =
    product.reloadlyProductId != null && Number(product.reloadlyProductId) > 0
      ? Math.trunc(Number(product.reloadlyProductId))
      : null;
  const denomination = pickOrderDenomination(product.denominations, {
    denominationId: order.denominationId,
    denominationLabel: order.denominationLabel,
    region: order.region,
  });
  const unitPrice = denomination ? denominationUnitPrice(denomination) : null;
  const reloadlyUnitPrice = unitPrice != null ? String(unitPrice) : null;
  const reloadlyCountryCode = (product.reloadlyCountryCode ?? "").toUpperCase().slice(0, 2);

  const unchanged =
    order.fulfillment === fulfillment &&
    (order.reloadlyProductId ?? null) === reloadlyProductId &&
    priceKey(order.reloadlyUnitPrice) === priceKey(reloadlyUnitPrice) &&
    (order.reloadlyCountryCode ?? "") === reloadlyCountryCode;
  if (unchanged) return order;

  const updated = await db
    .update(digitalOrders)
    .set({
      fulfillment,
      reloadlyProductId,
      reloadlyUnitPrice,
      reloadlyCountryCode,
      updatedAt: new Date(),
    })
    .where(eq(digitalOrders.id, order.id))
    .returning();

  return (
    updated[0] ?? {
      ...order,
      fulfillment,
      reloadlyProductId,
      reloadlyUnitPrice,
      reloadlyCountryCode,
    }
  );
}

/**
 * Livre une commande déjà payée (l'achat n'a lieu que si la ligne de
 * paiement `orders` est bien passée à `paid`).
 *
 * Idempotent : une commande livrée n'est jamais rachetée ; si une
 * transaction Reloadly existe déjà mais que les codes manquent, on
 * récupère les codes au lieu de repasser commande (aucun double débit).
 */
/**
 * Livre une commande payée par carte téléphonique **après** acceptation de
 * la carte par un administrateur.
 *
 * C'est le seul point d'entrée autorisé à acheter un code pour ce moyen de
 * paiement : il vérifie d'abord que la carte est bien acceptée, puis délègue
 * la livraison (achat fournisseur + e-mail client) au chemin habituel.
 * Idempotent : une commande déjà livrée n'est jamais rachetée.
 */
export async function deliverApprovedPhoneCardOrder(
  ref: string,
): Promise<DigitalDeliveryResult> {
  const orderRef = String(ref ?? "").trim().toUpperCase();
  if (!orderRef) return { outcome: "not_found", ref: orderRef, message: "Référence manquante." };
  const gate = await phoneCardDeliveryGate(orderRef);
  if (!gate.isPhoneCard) {
    return {
      outcome: "not_found",
      ref: orderRef,
      message: "Aucune carte téléphonique enregistrée pour cette référence.",
    };
  }
  if (gate.status !== "approved") {
    return {
      outcome: "not_paid",
      ref: orderRef,
      message: "La carte téléphonique n’est pas acceptée : aucun achat déclenché.",
    };
  }
  return deliverPaidDigitalOrder(orderRef, { phoneCardApproved: true });
}

export async function deliverPaidDigitalOrder(
  idOrRef: number | string,
  options: { force?: boolean; phoneCardApproved?: boolean } = {},
): Promise<DigitalDeliveryResult> {
  const loaded = await loadDigitalOrder(idOrRef);
  if (!loaded) return { outcome: "not_found", ref: String(idOrRef) };

  if (loaded.status === "delivered") {
    return { outcome: "already_delivered", ref: loaded.ref };
  }

  // Une recharge téléphonique n'achète un code QUE si l'administrateur l'a
  // explicitement demandé (`phoneCardApproved`) — c'est-à-dire au moment où il
  // accepte la carte, après avoir vérifié le crédit reçu. Sans ce drapeau
  // (cron de reprise, IPN, suivi client), la livraison reste manuelle : aucun
  // achat ne peut être déclenché par un robot.
  const phoneGate = await phoneCardDeliveryGate(loaded.ref);
  const phoneRoute = phoneCardDeliveryRoute({
    isPhoneCard: phoneGate.isPhoneCard,
    status: phoneGate.status,
    autoDeliver: options.phoneCardApproved === true,
  });
  if (phoneRoute === "blocked") {
    return {
      outcome: "not_paid",
      ref: loaded.ref,
      message: "La carte téléphonique n’a pas encore été acceptée par un administrateur.",
    };
  }
  if (phoneRoute === "manual") {
    return {
      outcome: "manual",
      ref: loaded.ref,
      message: "Carte téléphonique acceptée : saisissez manuellement le code cadeau à livrer.",
    };
  }

  // Routage fournisseur : une commande créée depuis le catalogue FazerCards
  // est achetée chez FazerCards (Idempotency-Key = référence de commande).
  // Les archives de l’ancien fournisseur ne déclenchent plus aucun achat.
  if (digitalOrderSupplier(loaded) === "fazercards") {
    const routed = await deliverPaidFazercardsOrder(loaded.id, {
      phoneCardApproved: options.phoneCardApproved === true,
    });
    return {
      outcome: routed.outcome,
      ref: routed.ref,
      ...(routed.message ? { message: routed.message } : {}),
      ...(routed.errorClass ? { errorClass: routed.errorClass } : {}),
    };
  }

  if (LEGACY_SUPPLIER_RETIRED) {
    return { outcome: "manual", ref: loaded.ref, message: RETIRED_SUPPLIER_MESSAGE };
  }

  // Garde-fou absolu : jamais d'achat sans paiement confirmé, même forcé.
  const payment = await db
    .select({ status: orders.status })
    .from(orders)
    .where(eq(orders.ref, loaded.ref))
    .limit(1);
  if (payment[0]?.status !== "paid") {
    return { outcome: "not_paid", ref: loaded.ref, message: "Paiement non confirmé." };
  }

  // La fiche a pu être configurée APRÈS la vente (produit Reloadly, mode
  // automatique, valeur faciale) : on relit la configuration avant de
  // décider. Le prix payé reste figé.
  const order = await resyncFulfillmentConfig(loaded);

  const key = digitalCodesKey();
  if (!key) {
    return flagManual(
      order,
      "DIGITAL_CODES_SECRET (ou SESSION_SECRET) absent : impossible de chiffrer et relire les codes en sécurité. Aucun achat n'a été effectué.",
      "permanent",
    );
  }

  const requiresAuto = order.fulfillment === "auto";
  if (requiresAuto && reloadlyEnvironmentMismatch()) {
    // Ne JAMAIS acheter un code de test pour une commande payée en vrai.
    return flagManual(
      order,
      "Reloadly est en mode SANDBOX alors que les paiements sont réels : aucun code de test n'a été acheté. Configurez RELOADLY_SANDBOX=false avec des identifiants LIVE, puis relancez la livraison.",
      "permanent",
    );
  }
  if (!requiresAuto || !reloadlyConfigured()) {
    return flagManual(
      order,
      requiresAuto
        ? "Reloadly n'est pas configuré sur ce serveur : livraison manuelle requise."
        : "Fiche en livraison manuelle : achetez le code dans le tableau Reloadly puis transmettez-le au client.",
      "permanent",
    );
  }

  const totalUsd = Number(order.totalUsd);
  const cap = reloadlyMaxOrderUsd();
  if (!Number.isFinite(totalUsd) || totalUsd <= 0) {
    return flagManual(order, "Montant de commande invalide.");
  }
  if (totalUsd > cap) {
    return flagManual(
      order,
      `Montant ${totalUsd.toFixed(2)} $ au-delà du plafond d'achat automatique (${cap} $). Livraison manuelle requise.`,
      "permanent",
    );
  }

  const productId = Number(order.reloadlyProductId);
  const unitPrice = Number(order.reloadlyUnitPrice);
  if (!Number.isInteger(productId) || productId <= 0) {
    return flagManual(
      order,
      "Aucun produit Reloadly relié à cette fiche (admin → Codes & Cartes).",
      "permanent",
    );
  }
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
    return flagManual(order, "Valeur faciale Reloadly absente pour ce montant.", "permanent");
  }

  await db
    .update(digitalOrders)
    .set({
      status: "paid",
      attempts: order.attempts + 1,
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(digitalOrders.id, order.id));

  let transactionId = order.reloadlyTransactionId ?? "";

  try {
    if (!transactionId) {
      const priceIssue = await supplierPriceIssue(productId, unitPrice);
      if (priceIssue) return flagManual(order, priceIssue, "permanent");

      const purchase = await createGiftCardOrder({
        productId,
        quantity: order.quantity,
        unitPrice,
        customIdentifier: order.ref,
        senderName: order.recipientName?.trim() || "Nukhba",
        recipientEmail: order.recipientEmail || undefined,
      });

      transactionId = purchase.transactionId;
      await db
        .update(digitalOrders)
        .set({
          reloadlyTransactionId: transactionId || null,
          reloadlyStatus: purchase.status,
          reloadlyResponse: purchase.raw,
          updatedAt: new Date(),
        })
        .where(eq(digitalOrders.id, order.id));

      if (purchase.kind === "failed") {
        await db
          .update(digitalOrders)
          .set({
            status: "failed",
            fulfillmentStatus: "manual_review",
            lastError: `Reloadly a refusé l'achat (${purchase.status}).`,
            updatedAt: new Date(),
          })
          .where(eq(digitalOrders.id, order.id));
        return {
          outcome: "failed",
          ref: order.ref,
          message: `Reloadly a refusé l'achat (${purchase.status}).`,
        };
      }

      if (purchase.kind !== "success") {
        // PENDING / PROCESSING : le code arrive plus tard. La commande
        // reste « payée » ; un rafraîchissement récupérera les codes.
        await db
          .update(digitalOrders)
          .set({
            status: "paid",
            reloadlyStatus: purchase.status,
            updatedAt: new Date(),
          })
          .where(eq(digitalOrders.id, order.id));
        return {
          outcome: "awaiting_codes",
          ref: order.ref,
          message: `Achat accepté par Reloadly (${purchase.status}) — code en cours d'émission.`,
        };
      }
    }

    // Codes disponibles : on les récupère, on les chiffre, on livre.
    const codes = await getGiftCardCodes(transactionId);
    if (codes.length === 0) {
      await db
        .update(digitalOrders)
        .set({
          status: "paid",
          reloadlyStatus: order.reloadlyStatus ?? "SUCCESSFUL",
          lastError: "Aucun code renvoyé par Reloadly pour cette transaction.",
          updatedAt: new Date(),
        })
        .where(eq(digitalOrders.id, order.id));
      return {
        outcome: "awaiting_codes",
        ref: order.ref,
        message: "Reloadly n'a pas encore renvoyé le code.",
      };
    }

    const cipher = encryptDigitalCodes(codes, key);
    const now = new Date();
    const updated = await db
      .update(digitalOrders)
      .set({
        status: "delivered",
        fulfillmentStatus: "delivered",
        nextRetryAt: null,
        codesCipher: cipher,
        reloadlyStatus: "SUCCESSFUL",
        deliveredAt: now,
        lastError: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(digitalOrders.id, order.id),
          ne(digitalOrders.status, "delivered"),
        ),
      )
      .returning();

    if (updated.length === 0) {
      return { outcome: "already_delivered", ref: order.ref };
    }

    const delivered = updated[0] ?? order;
    const { config } = await getSiteData();
    try {
      const email = await sendDigitalCodesEmail(
        delivered,
        codes,
        config.name,
        config.url,
        config.email,
        reviewPromptForConfig(config, { kind: "digital", orderRef: delivered.ref }),
        telegramOrderUrlFromEnv(delivered.ref),
      );
      await recordDigitalEmailOutcome(order.id, email);
    } catch (error) {
      console.warn(
        "[digital] e-mail codes impossible :",
        error instanceof Error ? error.message : error,
      );
    }

    // Canal additionnel : les clients qui suivent la commande depuis
    // Telegram sont prévenus dans le chat. Idempotent (notified_at) et
    // silencieux en cas d'échec — l'e-mail reste la source de vérité.
    await notifyTelegramOrderDelivered(delivered.ref, config.url, config.name);

    return { outcome: "delivered", ref: order.ref };
  } catch (error) {
    const message = reloadlyErrorMessage(error);
    console.error(`[digital] livraison ${order.ref} impossible :`, message);

    // 4xx (hors 401) = refus métier : inutile de rejouer en boucle, mais
    // la commande reste payable → livraison manuelle. Erreur réseau/5xx :
    // l'achat a peut-être abouti → on conserve la transaction si connue.
    const httpStatus = isReloadlyError(error) ? error.status : null;
    const soldOut = httpStatus === 400 || httpStatus === 404 || httpStatus === 409;
    // Classe de l'échec pour la file : un refus métier (400/404/409) ne se
    // répare pas en réessayant ; un timeout ou un 5xx, si.
    const errorClass: DeliveryErrorClass =
      soldOut || httpStatus === 422
        ? "permanent"
        : classifyDeliveryError({ status: httpStatus, message });

    const current = await loadDigitalOrder(order.id);
    const recordedTransaction = current?.reloadlyTransactionId ?? transactionId;

    await db
      .update(digitalOrders)
      .set({
        status: "manual",
        fulfillmentStatus: "manual_review",
        nextRetryAt: null,
        reloadlyTransactionId: recordedTransaction || null,
        lastError: `Reloadly : ${message}`.slice(0, 800),
        updatedAt: new Date(),
      })
      .where(eq(digitalOrders.id, order.id));

    if (soldOut || !recordedTransaction) {
      return flagManual(order, `Reloadly : ${message}`, errorClass);
    }
    return {
      outcome: "manual",
      ref: order.ref,
      message: `Vérification requise chez Reloadly (transaction ${recordedTransaction}) : ${message}`,
      errorClass,
    };
  }
}

/* ------------------------------ Consultation ----------------------------- */

export interface PublicDigitalCode {
  cardNumber: string;
  pinCode: string | null;
  redemptionUrl: string | null;
}

export interface PublicDigitalOrder {
  ref: string;
  status: DigitalOrderStatus;
  /**
   * Statut granulaire de livraison (`pending_payment`, `paid_fulfilling`,
   * `delivered`, `manual_review`). `status` reste exposé pour compatibilité
   * (clients mis en cache, anciens onglets ouverts).
   */
  fulfillmentStatus: FulfillmentStatus;
  productTitle: string;
  platform: string;
  denominationLabel: string;
  region: string;
  quantity: number;
  totalUsd: string;
  recipientEmailMasked: string;
  createdAt: string;
  deliveredAt: string | null;
  reloadlyStatus: string | null;
  codes: PublicDigitalCode[];
  paymentMethod: "nowpayments" | "phone_card";
  phoneCardStatus: "pending" | "approved" | "rejected" | null;
  /** Message d'attente / d'action, sans détail technique. */
  notice: string | null;
  /**
   * Statut brut NOWPayments (`waiting`, `confirming`, `confirmed`,
   * `sending`, `finished`). Sert à la barre de progression : c'est lui qui
   * distingue « fonds pas encore reçus » de « réseau en cours de
   * confirmation ». Aucune donnée sensible (ni adresse, ni montant payé).
   */
  ipnStatus: string | null;
  /**
   * Cryptomonnaie utilisée (`usdttrc20`, `btc`…) — sert uniquement à
   * estimer un délai de confirmation usuel. Optionnel : les commandes
   * antérieures n'ont pas toujours la valeur.
   */
  payCurrency: string | null;
  /**
   * Lien Telegram du bot (`https://t.me/NokhbaGamebot?start=…`) : le client
   * peut suivre la livraison et être prévenu dans le chat. `null` quand le
   * bot n'est pas configuré — l'interface n'affiche alors rien.
   */
  telegramUrl: string | null;
}

function publicNotice(status: DigitalOrderStatus): string | null {
  switch (status) {
    case "pending":
      return "En attente de confirmation du paiement par le réseau.";
    case "paid":
      return "Paiement confirmé — votre code est en cours d'émission.";
    case "manual":
      return "Paiement confirmé — votre code est en cours de préparation par notre équipe.";
    case "failed":
      return "Le fournisseur n'a pas pu émettre ce code. Notre équipe vous contacte pour un remplacement ou un remboursement.";
    default:
      return null;
  }
}

/**
 * Réconcilie le statut du paiement lié à une commande digitale et déclenche
 * ou poursuit la livraison des codes si le paiement est confirmé.
 *
 * Utilisé lors du suivi client (`/codes/commande`) pour couvrir :
 *  1. un retard ou un échec du webhook IPN NOWPayments ;
 *  2. une transaction Reloadly initialement `PENDING` / `PROCESSING`
 *     (`awaiting_codes`) dont le code est prêt au cycle de sondage suivant.
 */
async function reconcileDigitalOrderOnPoll(order: DigitalOrder): Promise<DigitalOrder> {
  const initialStatus = normalizeDigitalStatus(order.status);
  if (initialStatus !== "pending" && initialStatus !== "paid") return order;

  try {
    const paymentRows = await db
      .select()
      .from(orders)
      .where(eq(orders.ref, order.ref))
      .limit(1);
    let payment = paymentRows[0];
    if (!payment) return order;

    if (payment.status === "pending" && payment.paymentId && nowPaymentsConfigured()) {
      // ── Deux garde-fous AVANT tout appel sortant ────────────────────────
      // Chaque GET de la page de suivi arrivait ici tant que la commande
      // restait `pending` : un onglet laissé ouvert = 4 appels facturés par
      // minute, et le quota NOWPayments est partagé par tout le site.
      //   1. créneau durable par commande (colonne, résiste aux instances) ;
      //   2. plafond global d'instance, pour les pics.
      // Refus = on sert l'état en base, la page reste utile.
      const claimed = await claimProviderSync(payment.ref ?? order.ref, {
        lastSyncAt: payment.lastProviderSyncAt ?? null,
        since: payment.createdAt ?? order.createdAt ?? null,
      });
      const budget = claimed.sync ? claimProviderBudget() : { allow: false };
      if (!claimed.sync || !budget.allow) {
        return order;
      }

      let remote: Awaited<ReturnType<typeof getPayment>> = null;
      try {
        remote = await getPayment(payment.paymentId);
      } finally {
        releaseProviderSync(payment.ref ?? order.ref);
      }
      if (remote && remote.payment_status) {
        const remoteStatus = remote.payment_status;
        const incomingStatus = orderStatusFromIpn(remoteStatus);
        let resolvedStatus = nextOrderStatus(payment.status, remoteStatus);

        const amountValidation =
          incomingStatus === "paid"
            ? validatePaidAmount(payment, remote)
            : { ok: true, reason: null as string | null };
        if (incomingStatus === "paid" && !amountValidation.ok) {
          resolvedStatus = "pending";
        }

        const refreshed = {
          ...payment,
          status: resolvedStatus,
          ipnStatus: remoteStatus,
          payAddress: remote.pay_address ?? payment.payAddress,
          payCurrency: remote.pay_currency ?? payment.payCurrency,
          payAmount:
            remote.pay_amount != null ? String(remote.pay_amount) : payment.payAmount,
        };

        const shouldPersist =
          refreshed.status !== payment.status ||
          refreshed.ipnStatus !== payment.ipnStatus ||
          refreshed.payAddress !== payment.payAddress ||
          refreshed.payCurrency !== payment.payCurrency ||
          refreshed.payAmount !== payment.payAmount;

        if (shouldPersist) {
          const claimed = await db
            .update(orders)
            .set({
              status: refreshed.status,
              ipnStatus: refreshed.ipnStatus,
              payAddress: refreshed.payAddress,
              payCurrency: refreshed.payCurrency,
              payAmount: refreshed.payAmount,
              updatedAt: new Date(),
            })
            .where(and(eq(orders.id, payment.id), eq(orders.status, payment.status)))
            .returning({ id: orders.id });

          if (claimed.length > 0 && refreshed.status === "paid") {
            const { config } = await getSiteData();
            await sendPaymentConfirmedEmail(
              refreshed,
              config.name,
              config.url,
              config.email,
            ).catch(() => null);
          }
          payment = refreshed;
        }
      }
    }

    if (
      shouldAutoDeliverOnPoll({
        digitalStatus: order.status,
        paymentStatus: payment.status,
        attempts: order.attempts,
        updatedAt: order.updatedAt,
      })
    ) {
      // La file fait foi : elle relit le job (retry programmé, bail expiré,
      // job déjà terminé) au lieu de relancer un achat direct. Le sondage
      // client devient ainsi un worker de secours — utile sur Vercel Hobby
      // où le cron est quotidien.
      const { runDeliveryQueue } = await import("@/lib/delivery-queue");
      await runDeliveryQueue({ limit: 1 });
      return (await loadDigitalOrder(order.id)) ?? order;
    }
  } catch (error) {
    console.warn(
      "[digital][suivi] réconciliation au sondage ignorée :",
      error instanceof Error ? error.message : error,
    );
  }

  return order;
}

/**
 * Commande digitale telle que consultable par le client, avec le jeton de
 * suivi (le même que la facture). Les codes ne sont renvoyés qu'une fois
 * la commande livrée.
 */
export async function getPublicDigitalOrder(
  ref: string,
  trackingToken: string | null,
): Promise<PublicDigitalOrder | null> {
  const loaded = await loadDigitalOrder(ref);
  if (!loaded) return null;
  if (trackingAccess(loaded.trackingTokenHash, trackingToken) === "denied") return null;

  const order = await reconcileDigitalOrderOnPoll(loaded);
  const status = normalizeDigitalStatus(order.status);
  const codes =
    status === "delivered"
      ? decryptDigitalCodes(order.codesCipher, digitalCodesKeyRing())
      : [];
  const phoneGate = await phoneCardDeliveryGate(order.ref);
  const locale = order.locale === "en" ? "en" : "ar";

  // État brut du paiement (sans quoi la barre de progression ne peut pas
  // distinguer « rien reçu » de « réseau en cours »). Une seule requête,
  // colonnes minimales, et jamais renvoyée telle quelle au navigateur.
  const [payment] = await db
    .select({
      ipnStatus: orders.ipnStatus,
      payCurrency: orders.payCurrency,
      status: orders.status,
    })
    .from(orders)
    .where(eq(orders.ref, order.ref))
    .limit(1);

  // Livrée hors système (WhatsApp…) : aucun code en base, mais le client doit
  // lire où il l'a reçu au lieu d'une page « Livré » vide.
  const externalNotice =
    status === "delivered" && codes.length === 0
      ? offPlatformNotice(order.deliveryChannel, order.deliveredAt, locale)
      : null;

  return {
    ref: order.ref,
    status,
    fulfillmentStatus: normalizeFulfillmentStatus(
      order.fulfillmentStatus ?? fulfillmentStatusFromLegacy(order.status),
    ),
    productTitle: order.productTitle,
    platform: order.platform,
    denominationLabel: order.denominationLabel,
    region: order.region,
    quantity: order.quantity,
    totalUsd: order.totalUsd,
    recipientEmailMasked: maskEmail(order.recipientEmail),
    createdAt: order.createdAt.toISOString(),
    deliveredAt: order.deliveredAt ? order.deliveredAt.toISOString() : null,
    reloadlyStatus: order.reloadlyStatus,
    codes,
    paymentMethod: phoneGate.isPhoneCard ? "phone_card" : "nowpayments",
    phoneCardStatus: phoneGate.isPhoneCard ? phoneGate.status : null,
    ipnStatus: order.status === "delivered" ? "finished" : (payment?.ipnStatus ?? null),
    payCurrency: payment?.payCurrency ?? null,
    telegramUrl: telegramOrderUrlFromEnv(order.ref),
    notice:
      phoneGate.isPhoneCard && status !== "delivered"
        ? phoneCardPublicNotice(phoneGate.status, locale)
        : phoneGate.isPhoneCard
          ? externalNotice
          : (externalNotice ?? publicNotice(status)),
  };
}

/* ---------------------------------- Admin -------------------------------- */

export interface AdminDigitalOrder extends DigitalOrder {
  /** Statut normalisé pour l'affichage. */
  normalizedStatus: DigitalOrderStatus;
  /** Codes en clair — réservé à l'admin (jamais dans une réponse publique). */
  codes: PublicDigitalCode[];
}

/** Liste des commandes digitales (admin), de la plus récente à la plus ancienne. */
export async function listDigitalOrders(limit = 100): Promise<AdminDigitalOrder[]> {
  await ensureSchema();
  const rows = await db
    .select()
    .from(digitalOrders)
    .orderBy(desc(digitalOrders.createdAt))
    .limit(Math.min(300, Math.max(1, limit)));

  const keys = digitalCodesKeyRing();
  return rows.map((row) => ({
    ...row,
    normalizedStatus: normalizeDigitalStatus(row.status),
    codes: decryptDigitalCodes(row.codesCipher, keys),
  }));
}

/** Charge une commande pour l'admin (codes déchiffrés). */
export async function getAdminDigitalOrder(ref: string): Promise<AdminDigitalOrder | null> {
  const order = await loadDigitalOrder(ref);
  if (!order) return null;
  return {
    ...order,
    normalizedStatus: normalizeDigitalStatus(order.status),
    codes: decryptDigitalCodes(order.codesCipher, digitalCodesKeyRing()),
  };
}

/**
 * Livre une commande à la main : les codes sont chiffrés puis envoyés au
 * client exactement comme une livraison automatique. Utilisé quand
 * l'achat a été fait dans le tableau Reloadly (mode manuel, incident
 * fournisseur, commande au-delà du plafond automatique).
 */
export async function deliverDigitalOrderManually(
  ref: string,
  codesInput: string,
  options: { withoutCodes?: boolean } = {},
): Promise<{ ok: boolean; delivered: number; error?: string }> {
  const order = await loadDigitalOrder(ref);
  if (!order) return { ok: false, delivered: 0, error: "Commande introuvable." };

  const phoneGate = await phoneCardDeliveryGate(ref);
  if (phoneGate.isPhoneCard && phoneGate.status !== "approved") {
    return {
      ok: false,
      delivered: 0,
      error: "Livraison verrouillée : acceptez d’abord la carte téléphonique dans la zone de vérification.",
    };
  }

  // Clôture SANS code : réservée aux recharges de jeu, qui ne produisent
  // aucun code (le crédit part sur le compte du joueur). Sans cette
  // possibilité, l'admin devait inventer un faux code pour clôturer une
  // commande pourtant livrée.
  const closeWithoutCodes = options.withoutCodes === true;
  if (closeWithoutCodes) {
    if (order.kind !== "game_topup") {
      return {
        ok: false,
        delivered: 0,
        error:
          "Clôture sans code réservée aux recharges de jeu : une carte ou une clé doit avoir un code.",
      };
    }
    const now = new Date();
    const closedRows = await db
      .update(digitalOrders)
      .set({
        status: "delivered",
        fulfillmentStatus: "delivered",
        nextRetryAt: null,
        deliveredAt: now,
        lastError: null,
        updatedAt: now,
      })
      .where(eq(digitalOrders.id, order.id))
      .returning();
    const closed = closedRows[0] ?? { ...order, status: "delivered" };

    let emailError: string | undefined;
    try {
      const { config } = await getSiteData();
      const email = await sendDigitalTopupDeliveredEmail(
        closed,
        config.name,
        config.url,
        config.email,
        reviewPromptForConfig(config, { kind: "digital", orderRef: closed.ref }),
      );
      await recordDigitalEmailOutcome(order.id, email);
      if (!email.ok) emailError = email.error ?? "e-mail non envoyé";
    } catch (error) {
      emailError = error instanceof Error ? error.message : String(error);
    }
    return { ok: true, delivered: 1, ...(emailError ? { error: emailError } : {}) };
  }

  const codes = parseManualCodes(codesInput);
  if (codes.length === 0) {
    return { ok: false, delivered: 0, error: "Aucun code reconnu (une carte par ligne)." };
  }

  const key = digitalCodesKey();
  if (!key) {
    return {
      ok: false,
      delivered: 0,
      error: "DIGITAL_CODES_SECRET (ou SESSION_SECRET) absent : codes non enregistrables.",
    };
  }

  const now = new Date();
  const updated = await db
    .update(digitalOrders)
    .set({
      status: "delivered",
      fulfillmentStatus: "delivered",
      nextRetryAt: null,
      codesCipher: encryptDigitalCodes(codes, key),
      deliveredAt: now,
      lastError: null,
      updatedAt: now,
    })
    .where(eq(digitalOrders.id, order.id))
    .returning();

  const delivered = updated[0] ?? order;
  let emailError: string | undefined;
  let siteName = "Nokhba";
  let siteUrl = "";
  try {
    const { config } = await getSiteData();
    siteName = config.name;
    siteUrl = config.url;
    const email = await sendDigitalCodesEmail(
      delivered,
      codes,
      config.name,
      config.url,
      config.email,
      reviewPromptForConfig(config, { kind: "digital", orderRef: delivered.ref }),
      telegramOrderUrlFromEnv(delivered.ref),
    );
    await recordDigitalEmailOutcome(order.id, email);
    if (!email.ok) emailError = email.error ?? "e-mail non envoyé";
  } catch (error) {
    emailError = error instanceof Error ? error.message : String(error);
  }

  // Le client qui suit la commande depuis Telegram est prévenu, même si
  // l'e-mail vient d'échouer (c'est justement le cas où ça compte).
  await notifyTelegramOrderDelivered(delivered.ref, siteUrl, siteName);

  return {
    ok: true,
    delivered: codes.length,
    ...(emailError ? { error: `Codes enregistrés, e-mail non envoyé : ${emailError}` } : {}),
  };
}

/** Renvoie l'e-mail des codes d'une commande livrée. */
export async function resendDigitalCodesEmail(ref: string): Promise<{ ok: boolean; error?: string }> {
  // Action admin : elle ne doit pas être ralentie par un créneau de synchro
  // déjà consommé par la page du client (throttle fournisseur).
  await clearProviderSyncGate(ref);
  const order = await loadDigitalOrder(ref);
  if (!order) return { ok: false, error: "Commande introuvable." };
  const codes = decryptDigitalCodes(order.codesCipher, digitalCodesKeyRing());
  if (codes.length === 0) return { ok: false, error: "Aucun code enregistré pour cette commande." };

  const { config } = await getSiteData();
  const result = await sendDigitalCodesEmail(
    order,
    codes,
    config.name,
    config.url,
    config.email,
    null,
    telegramOrderUrlFromEnv(order.ref),
  );
  await recordDigitalEmailOutcome(order.id, result);
  return { ok: result.ok, error: result.error };
}

export interface OffPlatformDeliveryResult {
  ok: boolean;
  error?: string;
  /** E-mail de confirmation non parti : la livraison reste enregistrée. */
  warning?: string;
  trackingUrl?: string;
}

/**
 * Marque une commande livrée alors que le code a été transmis HORS du
 * système (WhatsApp, téléphone, e-mail direct).
 *
 * Pourquoi : un achat manuel envoyé par WhatsApp restait bloqué en `manual`,
 * le client lisait « code en cours de préparation » sur `/codes/commande` et
 * ne recevait jamais d'e-mail. Sans code en base, « livrer manuellement » est
 * inutilisable, et « clôturer sans code » est réservé aux recharges de jeu.
 *
 * Ce que fait cette fonction, dans l'ordre :
 *  1. refuse une commande déjà livrée, verrouillée par une carte téléphonique
 *     non acceptée, ou qui contient déjà des codes (→ « Renvoyer l'e-mail ») ;
 *  2. passe la commande en `delivered` et mémorise le canal + la note interne ;
 *  3. régénère le jeton de suivi (l'ancien lien cesse de fonctionner) ;
 *  4. envoie au client un e-mail de livraison SANS le code, avec le lien.
 *
 * Le code lui-même n'est jamais stocké : c'est une décision assumée, la note
 * interne sert de justificatif.
 */
export async function markDigitalOrderDeliveredOffPlatform(
  ref: string,
  input: { channel?: unknown; note?: unknown },
): Promise<OffPlatformDeliveryResult> {
  const orderRef = String(ref ?? "").trim().toUpperCase();
  if (!orderRef) return { ok: false, error: "Référence manquante." };

  const order = await loadDigitalOrder(orderRef);
  if (!order) return { ok: false, error: "Commande introuvable." };

  if (normalizeDigitalStatus(order.status) === "delivered") {
    return { ok: false, error: "Cette commande est déjà livrée." };
  }

  const phoneGate = await phoneCardDeliveryGate(order.ref);
  if (phoneGate.isPhoneCard && phoneGate.status !== "approved") {
    return {
      ok: false,
      error:
        "Livraison verrouillée : acceptez d’abord la carte téléphonique dans la zone de vérification.",
    };
  }

  const storedCodes = decryptDigitalCodes(order.codesCipher, digitalCodesKeyRing());
  if (storedCodes.length > 0) {
    return {
      ok: false,
      error:
        "Des codes sont déjà enregistrés pour cette commande : utilisez « Renvoyer l’e-mail », la livraison est déjà faite.",
    };
  }

  const validation = validateOffPlatformDelivery(input);
  if (!validation.ok) return { ok: false, error: validation.error };

  const now = new Date();
  const tracking = createTrackingToken();
  const updatedRows = await db
    .update(digitalOrders)
    .set({
      status: "delivered",
      fulfillmentStatus: "delivered",
      nextRetryAt: null,
      fulfillment: "manual",
      deliveredAt: now,
      trackingTokenHash: tracking.hash,
      deliveryChannel: validation.channel,
      deliveryNote: validation.note,
      lastError: null,
      updatedAt: now,
    })
    .where(eq(digitalOrders.id, order.id))
    .returning();
  const delivered = updatedRows[0] ?? order;

  const locale = order.locale === "en" ? "en" : "ar";
  const query = `ref=${encodeURIComponent(order.ref)}&t=${encodeURIComponent(tracking.token)}`;
  const trackingUrl = `${siteBaseUrl()}${localizedPath(`/codes/commande?${query}`, locale)}`;

  let warning: string | undefined;
  try {
    const { config } = await getSiteData();
    const email = await sendDigitalDeliveredOffPlatformEmail(delivered, {
      trackingUrl,
      channel: validation.channel,
      note: validation.note,
      siteName: config.name,
      siteUrl: config.url,
      siteEmail: config.email,
      deliveredAtLabel: now.toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Africa/Tripoli",
      }),
    });
    await recordDigitalEmailOutcome(order.id, email);
    if (!email.ok) warning = email.error ?? "e-mail non envoyé";
  } catch (error) {
    warning = error instanceof Error ? error.message : String(error);
  }

  return { ok: true, trackingUrl, ...(warning ? { warning } : {}) };
}
