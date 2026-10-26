// Commandes digitales FazerCards — « vendre à la commande ».
//
// Flux complet :
//   1. le client choisit un code (catalogue FazerCards) et le paie en crypto
//      (facture hébergée NOWPayments) ;
//   2. l'IPN confirme le paiement → `deliverPaidFazercardsOrder` achète le
//      code chez FazerCards avec le solde du compte marchand ;
//   3. le code reçu est chiffré en base puis envoyé par e-mail au client.
//
// Aucun stock n'est acheté à l'avance : on achète uniquement après
// encaissement. Toute condition non remplie bascule la commande en
// livraison MANUELLE et notifie l'agence — jamais d'achat silencieux.
//
// Idempotence : chaque commande de création utilise un Idempotency-Key
// (référence DGC-…) pour éviter tout double débit chez FazerCards.
//
// Les colonnes de la table `digitalOrders` sont nommées autour de Reloadly
// (`reloadlyTransactionId`, `codesCipher`, `deliveredAt`, …) : FazerCards
// les réutilise telles quelles pour éviter toute modification de schéma.

import { desc, eq } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { digitalOrders, orders, type DigitalOrder } from "@/db/schema";
import {
  fazercardsConfigured,
  fazercardsErrorMessage,
  fazercardsGameKeyOrder,
  fazercardsGiftCardOrder,
  fazercardsMaxOrderUsd,
  fazercardsOrder,
  fazercardsTopupOrder,
  isFazercardsError,
  type FazercardsOrderResponse,
} from "@/lib/fazercards";
import {
  decryptDigitalCodes,
  digitalCodesKey,
  encryptDigitalCodes,
} from "@/lib/digital-codes";
import { createInvoice } from "@/lib/nowpayments";
import { recordDigitalEmailOutcome } from "@/lib/digital-email-log";
import { createTrackingToken, newOrderReference } from "@/lib/order-tracking";
import { siteBaseUrl } from "@/lib/site-url";
import { getSiteData } from "@/lib/store";
import {
  sendDigitalCodesEmail,
  sendDigitalManualNotice,
} from "@/lib/digital-emails";

/* --------------------------------- Types -------------------------------- */

export interface CreateFazercardsCheckoutInput {
  productId: string; // identifiant FazercardsProduct (slug)
  denominationId: string; // offer_id / card_id / key_id
  quantity: unknown;
  email: string;
  name?: string;
  phone?: string;
  locale?: "ar" | "en";
  // Champs acheteur dynamiques (top-ups : player_id, …)
  fields?: Record<string, string | number>;
}

export interface FazercardsCheckoutResult {
  orderRef: string;
  trackingToken: string;
  paymentUrl: string;
  totalUsd: number;
  productTitle: string;
  denominationLabel: string;
  quantity: number;
}

export type FazercardsDeliveryOutcome =
  | "delivered"
  | "awaiting_codes"
  | "manual"
  | "already_delivered"
  | "not_paid"
  | "not_found"
  | "failed";

export interface FazercardsDeliveryResult {
  outcome: FazercardsDeliveryOutcome;
  ref: string;
  message?: string;
}

/* --------------------------------- Erreurs ------------------------------ */

export class FazercardsOrderError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = "FazercardsOrderError";
    this.code = code;
    this.status = status;
  }
}

/* --------------------------------- Chargement --------------------------- */

async function loadFazercardsOrder(
  idOrRef: number | string,
): Promise<DigitalOrder | null> {
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
 * Nettoie les champs acheteur reçus du navigateur : clés non vides,
 * valeurs chaîne ou nombre uniquement, longueur bornée. Toute autre valeur
 * est ignorée plutôt que transmise au fournisseur.
 */
export function sanitizeBuyerFields(
  input: Record<string, unknown> | undefined,
): Record<string, string | number> {
  const fields: Record<string, string | number> = {};
  if (!input) return fields;
  for (const [rawKey, rawValue] of Object.entries(input)) {
    const key = rawKey.trim().slice(0, 60);
    if (!key) continue;
    if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      fields[key] = rawValue;
      continue;
    }
    if (typeof rawValue === "string") {
      const value = rawValue.trim().slice(0, 200);
      if (value) fields[key] = value;
    }
  }
  return fields;
}

/** Champs acheteur mémorisés sur une commande (colonne jsonb existante). */
function storedBuyerFields(order: DigitalOrder): Record<string, string | number> {
  const stored = order.reloadlyResponse;
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return {};
  const fields = (stored as { buyerFields?: unknown }).buyerFields;
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) return {};
  return sanitizeBuyerFields(fields as Record<string, unknown>);
}

/* --------------------------------- Création ----------------------------- */

/**
 * Crée la commande FazerCards + la facture crypto.
 * Le prix est recalculé côté serveur à partir du catalogue FazerCards :
 * le navigateur ne transmet jamais un prix.
 */
export async function createFazercardsCheckout(
  input: CreateFazercardsCheckoutInput,
  products: {
    findBySlug: (slug: string) => {
      kind: string;
      /** category_id / game_id FazerCards (transmis à l'achat). */
      categoryId: string;
      denominations: {
        id: string;
        label: string;
        priceUsd: number;
        available: boolean;
        maxOrderQuantity: number;
        supplierOfferId: string;
        supplierCostUsd: number | null;
        fields: { key: string; label: string; type: string }[];
      }[];
    } | null;
  },
  req: Request,
): Promise<FazercardsCheckoutResult> {
  if (!fazercardsConfigured()) {
    throw new FazercardsOrderError(
      "supplier_not_configured",
      503,
      "FazerCards n'est pas configuré sur ce serveur. Contactez-nous sur WhatsApp.",
    );
  }

  const product = products.findBySlug(input.productId);
  if (!product) {
    throw new FazercardsOrderError("product_not_found", 400, "Produit introuvable.");
  }

  const denomination = product.denominations.find(
    (d) => d.id === String(input.denominationId),
  );
  if (!denomination) {
    throw new FazercardsOrderError(
      "denomination_not_found",
      400,
      "Montant introuvable pour ce produit.",
    );
  }
  if (!denomination.available) {
    throw new FazercardsOrderError(
      "denomination_not_sellable",
      400,
      "Ce montant n'est plus disponible.",
    );
  }

  const quantity = Number(input.quantity ?? 1);
  if (
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > denomination.maxOrderQuantity
  ) {
    throw new FazercardsOrderError(
      "invalid_quantity",
      400,
      `Quantité invalide (1 à ${denomination.maxOrderQuantity}).`,
    );
  }

  const unitPriceUsd = Math.round(denomination.priceUsd * 100) / 100;
  if (!Number.isFinite(unitPriceUsd) || unitPriceUsd <= 0) {
    throw new FazercardsOrderError(
      "invalid_price",
      400,
      "Prix du produit non configuré.",
    );
  }

  const totalUsd = Math.round(unitPriceUsd * quantity * 100) / 100;

  // Champs acheteur (top-ups : player_id, serveur…). Ils sont indispensables
  // à l'achat : sans eux FazerCards refuse la commande APRÈS encaissement,
  // donc on refuse la vente tout de suite s'ils sont exigés et absents.
  const buyerFields = sanitizeBuyerFields(input.fields);
  const requiredFields = denomination.fields.filter(
    (field) => !(buyerFields[field.key] ?? "").toString().trim(),
  );
  if (denomination.fields.length > 0 && requiredFields.length > 0) {
    throw new FazercardsOrderError(
      "buyer_fields_required",
      400,
      `Informations requises : ${requiredFields.map((field) => field.label || field.key).join(", ")}.`,
    );
  }

  const ref = newOrderReference("DGC");
  const tracking = createTrackingToken();
  const locale = input.locale === "en" ? "en" : "ar";
  const title = `FazerCards — ${denomination.label}`;
  const label = `${title}${quantity > 1 ? ` ×${quantity}` : ""}`;

  await ensureSchema();

  // 1) Ligne de livraison (produit, destinataire, mode).
  const inserted = await db
    .insert(digitalOrders)
    .values({
      ref,
      trackingTokenHash: tracking.hash,
      // productId = category_id / game_id FazerCards (utilisé tel quel à
      // l'achat) ; productSlug = slug public `fzr-…`, qui sert aussi de
      // marqueur de fournisseur au moment de la livraison.
      productId: product.categoryId,
      productSlug: input.productId,
      productTitle: title,
      kind: product.kind,
      platform: product.kind,
      denominationId: denomination.id,
      denominationLabel: denomination.label,
      region: "GLOBAL",
      faceValue: denomination.label,
      quantity,
      unitPriceUsd: unitPriceUsd.toFixed(2),
      totalUsd: totalUsd.toFixed(2),
      recipientEmail: input.email,
      recipientName: input.name?.trim() || null,
      recipientPhone: input.phone?.trim() || null,
      locale,
      status: "pending",
      fulfillment: "auto",
      reloadlyProductId: null,
      reloadlyUnitPrice: denomination.supplierCostUsd
        ? String(denomination.supplierCostUsd)
        : null,
      reloadlyCountryCode: "GLOBAL",
      // Aucune colonne dédiée : la colonne jsonb existante mémorise le
      // fournisseur et les champs acheteur nécessaires à l'achat différé
      // (après paiement). Aucun code n'y est jamais stocké.
      reloadlyResponse: {
        supplier: "fazercards",
        categoryId: product.categoryId,
        offerId: denomination.supplierOfferId,
        buyerFields,
      },
    })
    .returning({ id: digitalOrders.id });
  const digitalOrderId = inserted[0]?.id;

  // 2) Ligne de paiement (table `orders`), reconnue par l'IPN NOWPayments.
  try {
    await db.insert(orders).values({
      ref,
      trackingTokenHash: tracking.hash,
      kind: "digital",
      planId: input.productId,
      planName: label.slice(0, 190),
      amountLyd: totalUsd.toFixed(2),
      amountUsd: totalUsd.toFixed(2),
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
    await db.delete(digitalOrders).where(eq(digitalOrders.ref, ref)).catch(() => null);
    throw error;
  }

  // 3) Facture hébergée NOWPayments.
  const { config } = await getSiteData();
  const baseUrl = siteBaseUrl(req);
  const query = `ref=${encodeURIComponent(ref)}&t=${encodeURIComponent(tracking.token)}`;
  let invoice: Awaited<ReturnType<typeof createInvoice>>;
  try {
    invoice = await createInvoice({
      priceAmount: totalUsd,
      orderId: ref,
      orderDescription: `${config.name} — ${label}`.slice(0, 190),
      ipnCallbackUrl: `${baseUrl}/api/payments/ipn`,
      successUrl: `${baseUrl}/codes/commande?${query}`,
      cancelUrl: `${baseUrl}/pay/cancel?${query}`,
    });
  } catch (error) {
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
    totalUsd,
    productTitle: title,
    denominationLabel: denomination.label,
    quantity,
  };
}

/* --------------------------------- Livraison ---------------------------- */

/**
 * Livre une commande FazerCards déjà payée.
 *
 * Idempotent : une commande livrée n'est jamais rachetée ; si une
 * transaction FazerCards existe déjà mais que les codes manquent, on
 * récupère les codes au lieu de repasser commande.
 */
export async function deliverPaidFazercardsOrder(
  idOrRef: number | string,
  options: { force?: boolean } = {},
): Promise<FazercardsDeliveryResult> {
  const loaded = await loadFazercardsOrder(idOrRef);
  if (!loaded) return { outcome: "not_found", ref: String(idOrRef) };

  if (loaded.status === "delivered") {
    return { outcome: "already_delivered", ref: loaded.ref };
  }

  // Garde-fou absolu : jamais d'achat sans paiement confirmé.
  const payment = await db
    .select({ status: orders.status })
    .from(orders)
    .where(eq(orders.ref, loaded.ref))
    .limit(1);
  if (payment[0]?.status !== "paid") {
    return { outcome: "not_paid", ref: loaded.ref, message: "Paiement non confirmé." };
  }

  const key = digitalCodesKey();
  if (!key) {
    return flagManual(
      loaded,
      "DIGITAL_CODES_SECRET (ou SESSION_SECRET) absent : impossible de chiffrer et relire les codes en sécurité.",
    );
  }

  const totalUsd = Number(loaded.totalUsd);
  const cap = fazercardsMaxOrderUsd();
  if (!Number.isFinite(totalUsd) || totalUsd <= 0) {
    return flagManual(loaded, "Montant de commande invalide.");
  }
  if (totalUsd > cap) {
    return flagManual(
      loaded,
      `Montant ${totalUsd.toFixed(2)} $ au-delà du plafond d'achat automatique (${cap} $).`,
    );
  }

  // Marque comme « paid » avant l'achat fournisseur.
  await db
    .update(digitalOrders)
    .set({
      status: "paid",
      attempts: (loaded.attempts ?? 0) + 1,
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(digitalOrders.id, loaded.id));

  let transactionId = loaded.reloadlyTransactionId ?? "";

  try {
    if (!transactionId) {
      const purchase = await placeFazercardsOrder(loaded);
      transactionId = purchase.order.id;
      await db
        .update(digitalOrders)
        .set({
          reloadlyTransactionId: transactionId,
          reloadlyStatus: purchase.order.status,
          updatedAt: new Date(),
        })
        .where(eq(digitalOrders.id, loaded.id));
    }

    // Récupère le détail de la commande chez FazerCards (GET /orders/:id).
    const orderDetail = await getFazercardsOrderDetail(transactionId);
    if (!orderDetail.ok) {
      return flagManual(
        loaded,
        `FazerCards : statut inconnu (${orderDetail.order.status}).`,
      );
    }

    const supplierStatus = (orderDetail.order.status ?? "").trim().toLowerCase();
    const codes = extractFazercardsCodes(orderDetail.order);

    // Commande annulée / refusée chez le fournisseur alors que le client a
    // payé : on ne peut pas livrer, mais il ne faut pas attendre un code
    // qui n'arrivera jamais. Bascule immédiate en livraison manuelle
    // (remplacement ou remboursement par l'équipe).
    if (
      codes.length === 0 &&
      ["cancelled", "canceled", "failed", "refunded", "rejected"].includes(
        supplierStatus,
      )
    ) {
      return flagManual(
        loaded,
        `FazerCards a annulé la commande (${supplierStatus}) — remboursement ou remplacement requis.`,
      );
    }

    if (codes.length === 0 && supplierStatus !== "completed") {
      await db
        .update(digitalOrders)
        .set({
          reloadlyStatus: supplierStatus || "processing",
          updatedAt: new Date(),
        })
        .where(eq(digitalOrders.id, loaded.id));
      return {
        outcome: "awaiting_codes",
        ref: loaded.ref,
        message: `Code en cours de traitement chez FazerCards (${supplierStatus || "processing"}).`,
      };
    }

    if (codes.length === 0) {
      return flagManual(
        loaded,
        "Aucun code retourné par FazerCards — livraison manuelle requise.",
      );
    }

    // Chiffre et stocke les codes.
    const encrypted = encryptDigitalCodes(codes, key);
    const now = new Date();
    const updated = await db
      .update(digitalOrders)
      .set({
        status: "delivered",
        codesCipher: encrypted,
        reloadlyStatus: supplierStatus || "completed",
        deliveredAt: now,
        lastError: null,
        updatedAt: now,
      })
      .where(eq(digitalOrders.id, loaded.id))
      .returning();
    const delivered = updated[0] ?? { ...loaded, status: "delivered" };

    // Envoie l'e-mail au client.
    try {
      const { config } = await getSiteData();
      const email = await sendDigitalCodesEmail(
        delivered,
        codes,
        config.name,
        config.url,
        config.email,
      );
      await recordDigitalEmailOutcome(loaded.id, email);
    } catch (error) {
      console.warn("[fazercards] e-mail codes non envoyé :", error);
    }

    return { outcome: "delivered", ref: loaded.ref };
  } catch (error) {
    const reason = isFazercardsError(error)
      ? fazercardsErrorMessage(error)
      : error instanceof Error
        ? error.message
        : "Échec fournisseur FazerCards.";
    return flagManual(
      loaded,
      `Achat FazerCards échoué : ${reason}`.slice(0, 800),
    );
  }
}

/**
 * Passe la commande chez FazerCards selon le type de produit.
 */
async function placeFazercardsOrder(
  order: DigitalOrder,
): Promise<FazercardsOrderResponse> {
  const categoryId = order.productId; // category_id / game_id FazerCards
  const offerId = order.denominationId; // offer_id / card_id / key_id
  const quantity = order.quantity;
  const idempotencyKey = order.ref; // DGC-… → clé d'idempotence FazerCards

  const kind = order.kind;

  if (kind === "game_topup") {
    // Les champs acheteur (player_id, serveur…) ont été saisis à la caisse
    // et mémorisés sur la commande : sans eux FazerCards refuse l'achat.
    return fazercardsTopupOrder({
      category_id: categoryId,
      offer_id: offerId,
      fields: storedBuyerFields(order),
      idempotencyKey,
    });
  }

  if (kind === "gift_card") {
    return fazercardsGiftCardOrder({
      category_id: categoryId,
      card_id: offerId,
      quantity,
      idempotencyKey,
    });
  }

  if (kind === "software_key") {
    return fazercardsGameKeyOrder({
      game_id: categoryId,
      key_id: offerId,
      quantity,
      idempotencyKey,
    });
  }

  throw new FazercardsOrderError(
    "unsupported_kind",
    400,
    `Type de produit non supporté par FazerCards : ${kind}`,
  );
}

/**
 * Récupère le détail d'une commande FazerCards (GET /orders/:id).
 */
async function getFazercardsOrderDetail(
  orderId: string,
): Promise<{
  ok: boolean;
  order: { id: string; status: string; payload?: Record<string, unknown> };
}> {
  const detail = await fazercardsOrder(orderId);
  return {
    ok: detail.ok,
    order: {
      id: detail.order.id,
      status: detail.order.status,
      payload: detail.order.payload,
    },
  };
}

/**
 * Extrait les codes (carte + PIN) d'une commande FazerCards terminée.
 * Le format exact dépend du type de produit (gift_card, topup, game_key…).
 */
function extractFazercardsCodes(
  order: { id: string; status: string; payload?: Record<string, unknown> },
): { cardNumber: string; pinCode: string | null; redemptionUrl: string | null }[] {
  const payload = order.payload ?? {};
  const codes: {
    cardNumber: string;
    pinCode: string | null;
    redemptionUrl: string | null;
  }[] = [];

  const asStr = (value: unknown): string =>
    value == null ? "" : String(value);
  const asStrNull = (value: unknown): string | null =>
    value == null ? null : String(value);

  // FazerCards peut retourner les codes sous différentes formes selon le type.
  if (Array.isArray(payload.codes)) {
    for (const c of payload.codes) {
      const card =
        asStr((c as Record<string, unknown>).cardNumber) ||
        asStr((c as Record<string, unknown>).code) ||
        asStr((c as Record<string, unknown>).number);
      if (!card) continue;
      codes.push({
        cardNumber: card,
        pinCode: asStrNull((c as Record<string, unknown>).pinCode ?? (c as Record<string, unknown>).pin),
        redemptionUrl: asStrNull((c as Record<string, unknown>).redemptionUrl ?? (c as Record<string, unknown>).url),
      });
    }
  } else if (payload.cardNumber) {
    codes.push({
      cardNumber: asStr(payload.cardNumber),
      pinCode: asStrNull(payload.pinCode ?? payload.pin),
      redemptionUrl: asStrNull(payload.redemptionUrl),
    });
  } else if (payload.code) {
    codes.push({
      cardNumber: asStr(payload.code),
      pinCode: asStrNull(payload.pin),
      redemptionUrl: asStrNull(payload.redemptionUrl),
    });
  }

  return codes.filter((c) => c.cardNumber.trim() !== "");
}

/* --------------------------------- Utils -------------------------------- */

async function flagManual(
  order: DigitalOrder,
  reason: string,
): Promise<FazercardsDeliveryResult> {
  const alreadyManual = order.status === "manual";
  await db
    .update(digitalOrders)
    .set({
      status: "manual",
      lastError: reason.slice(0, 800),
      updatedAt: new Date(),
    })
    .where(eq(digitalOrders.id, order.id));

  if (!alreadyManual || order.lastError !== reason.slice(0, 800)) {
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
      console.warn("[fazercards] notification manuelle non envoyée :", error);
    }
  }

  return { outcome: "manual", ref: order.ref, message: reason };
}
