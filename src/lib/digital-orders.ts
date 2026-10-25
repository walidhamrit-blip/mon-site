// Commandes digitales — « vendre à la commande ».
//
// Flux complet :
//   1. le client choisit un code (catalogue `/codes`) et le paie en crypto
//      (facture hébergée NOWPayments) ;
//   2. l'IPN confirme le paiement → `deliverPaidDigitalOrder` achète le
//      code chez Reloadly avec le solde du compte marchand ;
//   3. le code reçu est chiffré en base puis envoyé par e-mail au client,
//      et consultable sur `/codes/commande` (référence + jeton).
//
// Aucun stock n'est acheté à l'avance : on achète uniquement après
// encaissement. Toute condition non remplie (Reloadly non configuré,
// produit non relié, plafond dépassé, échec fournisseur) bascule la
// commande en livraison MANUELLE et notifie l'agence — jamais d'achat
// silencieux.

import { and, desc, eq, ne } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { digitalOrders, orders, type DigitalOrder } from "@/db/schema";
import { getDigitalProductBySlug } from "@/lib/digital-store";
import { denominationUnitPrice, effectiveFulfillment } from "@/lib/digital-types";
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
  type GiftCardCode,
} from "@/lib/reloadly";
import {
  createInvoice,
  getPayment,
  nextOrderStatus,
  nowPaymentsConfigured,
  orderStatusFromIpn,
  validatePaidAmount,
} from "@/lib/nowpayments";
import { createTrackingToken, newOrderReference, trackingAccess } from "@/lib/order-tracking";
import { siteBaseUrl } from "@/lib/site-url";
import { getSiteData } from "@/lib/store";
import { sendDigitalCodesEmail, sendDigitalManualNotice } from "@/lib/digital-emails";
import { sendPaymentConfirmedEmail } from "@/lib/order-emails";


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
export { digitalCodesKey, encryptDigitalCodes, decryptDigitalCodes } from "@/lib/digital-codes";

/* --------------------------- Suivi des e-mails ---------------------------- */

/**
 * Enregistre le verdict RÉEL du fournisseur pour l'e-mail des codes.
 *
 * Un « envoyé » sans identifiant de message ni motif d'échec est
 * indiagnosticable : c'est exactement ce qui rendait invisible un e-mail
 * accepté mais jamais remis (domaine non vérifié, SPF/DKIM absents, spam).
 */
async function recordEmailOutcome(
  orderId: number,
  result: { ok: boolean; provider?: string; id?: string; error?: string },
): Promise<void> {
  const patch = result.ok
    ? { emailSentAt: new Date(), emailProviderId: result.id ?? null, emailLastError: null }
    : {
        emailLastError: `${result.provider ?? "mail"} : ${result.error ?? "échec inconnu"}`.slice(0, 500),
      };
  try {
    await db.update(digitalOrders).set(patch).where(eq(digitalOrders.id, orderId));
  } catch (error) {
    console.warn(
      "[digital] suivi e-mail non enregistré :",
      error instanceof Error ? error.message : error,
    );
  }
  if (!result.ok) {
    console.warn("[digital] e-mail codes non envoyé :", result.error);
  }
}

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
  const product = await getDigitalProductBySlug(input.productSlug);
  const quoted = quoteDigitalOrder(product, input.denominationId, input.quantity);
  if (!quoted.ok || !product) {
    throw new DigitalOrderError(quoted.ok ? "product_not_found" : quoted.error, 400, quoted.ok ? "Produit introuvable." : quoted.message);
  }
  const { quote } = quoted;

  const fulfillment = effectiveFulfillment(product);
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
      successUrl: `${baseUrl}/codes/commande?${query}`,
      cancelUrl: `${baseUrl}/pay/cancel?${query}`,
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
): Promise<DigitalDeliveryResult> {
  const alreadyManual = order.status === "manual";
  await db
    .update(digitalOrders)
    .set({ status: "manual", lastError: reason.slice(0, 800), updatedAt: new Date() })
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

  return { outcome: "manual", ref: order.ref, message: reason };
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
export async function deliverPaidDigitalOrder(
  idOrRef: number | string,
  options: { force?: boolean } = {},
): Promise<DigitalDeliveryResult> {
  const loaded = await loadDigitalOrder(idOrRef);
  if (!loaded) return { outcome: "not_found", ref: String(idOrRef) };

  if (loaded.status === "delivered") {
    return { outcome: "already_delivered", ref: loaded.ref };
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
    );
  }

  const requiresAuto = order.fulfillment === "auto";
  if (!requiresAuto || !reloadlyConfigured()) {
    return flagManual(
      order,
      requiresAuto
        ? "Reloadly n'est pas configuré sur ce serveur : livraison manuelle requise."
        : "Fiche en livraison manuelle : achetez le code dans le tableau Reloadly puis transmettez-le au client.",
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
    );
  }

  const productId = Number(order.reloadlyProductId);
  const unitPrice = Number(order.reloadlyUnitPrice);
  if (!Number.isInteger(productId) || productId <= 0) {
    return flagManual(order, "Aucun produit Reloadly relié à cette fiche (admin → Codes & Cartes).");
  }
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
    return flagManual(order, "Valeur faciale Reloadly absente pour ce montant.");
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
      if (priceIssue) return flagManual(order, priceIssue);

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
      );
      await recordEmailOutcome(order.id, email);
    } catch (error) {
      console.warn(
        "[digital] e-mail codes impossible :",
        error instanceof Error ? error.message : error,
      );
    }

    return { outcome: "delivered", ref: order.ref };
  } catch (error) {
    const message = reloadlyErrorMessage(error);
    console.error(`[digital] livraison ${order.ref} impossible :`, message);

    // 4xx (hors 401) = refus métier : inutile de rejouer en boucle, mais
    // la commande reste payable → livraison manuelle. Erreur réseau/5xx :
    // l'achat a peut-être abouti → on conserve la transaction si connue.
    const reloadlyStatus = isReloadlyError(error) ? error.status : null;
    const soldOut = reloadlyStatus === 400 || reloadlyStatus === 404 || reloadlyStatus === 409;

    const current = await loadDigitalOrder(order.id);
    const recordedTransaction = current?.reloadlyTransactionId ?? transactionId;

    await db
      .update(digitalOrders)
      .set({
        status: "manual",
        reloadlyTransactionId: recordedTransaction || null,
        lastError: `Reloadly : ${message}`.slice(0, 800),
        updatedAt: new Date(),
      })
      .where(eq(digitalOrders.id, order.id));

    if (soldOut || !recordedTransaction) {
      return flagManual(order, `Reloadly : ${message}`);
    }
    return {
      outcome: "manual",
      ref: order.ref,
      message: `Vérification requise chez Reloadly (transaction ${recordedTransaction}) : ${message}`,
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
  /** Message d'attente / d'action, sans détail technique. */
  notice: string | null;
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
      const remote = await getPayment(payment.paymentId);
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
      await deliverPaidDigitalOrder(order.id);
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
      ? decryptDigitalCodes(order.codesCipher, digitalCodesKey())
      : [];

  return {
    ref: order.ref,
    status,
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
    notice: publicNotice(status),
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

  const key = digitalCodesKey();
  return rows.map((row) => ({
    ...row,
    normalizedStatus: normalizeDigitalStatus(row.status),
    codes: decryptDigitalCodes(row.codesCipher, key),
  }));
}

/** Charge une commande pour l'admin (codes déchiffrés). */
export async function getAdminDigitalOrder(ref: string): Promise<AdminDigitalOrder | null> {
  const order = await loadDigitalOrder(ref);
  if (!order) return null;
  return {
    ...order,
    normalizedStatus: normalizeDigitalStatus(order.status),
    codes: decryptDigitalCodes(order.codesCipher, digitalCodesKey()),
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
): Promise<{ ok: boolean; delivered: number; error?: string }> {
  const order = await loadDigitalOrder(ref);
  if (!order) return { ok: false, delivered: 0, error: "Commande introuvable." };

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
      codesCipher: encryptDigitalCodes(codes, key),
      deliveredAt: now,
      lastError: null,
      updatedAt: now,
    })
    .where(eq(digitalOrders.id, order.id))
    .returning();

  const delivered = updated[0] ?? order;
  let emailError: string | undefined;
  try {
    const { config } = await getSiteData();
    const email = await sendDigitalCodesEmail(
      delivered,
      codes,
      config.name,
      config.url,
      config.email,
    );
    await recordEmailOutcome(order.id, email);
    if (!email.ok) emailError = email.error ?? "e-mail non envoyé";
  } catch (error) {
    emailError = error instanceof Error ? error.message : String(error);
  }

  return {
    ok: true,
    delivered: codes.length,
    ...(emailError ? { error: `Codes enregistrés, e-mail non envoyé : ${emailError}` } : {}),
  };
}

/** Renvoie l'e-mail des codes d'une commande livrée. */
export async function resendDigitalCodesEmail(ref: string): Promise<{ ok: boolean; error?: string }> {
  const order = await loadDigitalOrder(ref);
  if (!order) return { ok: false, error: "Commande introuvable." };
  const codes = decryptDigitalCodes(order.codesCipher, digitalCodesKey());
  if (codes.length === 0) return { ok: false, error: "Aucun code enregistré pour cette commande." };

  const { config } = await getSiteData();
  const result = await sendDigitalCodesEmail(order, codes, config.name, config.url, config.email);
  await recordEmailOutcome(order.id, result);
  return { ok: result.ok, error: result.error };
}
