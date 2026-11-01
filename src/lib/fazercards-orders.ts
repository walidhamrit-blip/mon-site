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
  fazercardsMinOrderUsd,
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
  sendDigitalCodePendingEmail,
  sendDigitalCodesEmail,
  sendDigitalManualNotice,
  sendDigitalTopupDeliveredEmail,
} from "@/lib/digital-emails";
import { checkFazercardsPlayerId } from "@/lib/fazercards-player-id";
import { playerIdGate } from "@/lib/fazercards-player-id-core";
import { balanceGate } from "@/lib/fazercards-balance-core";
import { getFazercardsBalanceStatus } from "@/lib/fazercards-balance";
import {
  classifyFazercardsDelivery,
  describeFazercardsPayload,
  extractFazercardsCodesFromOrder,
  redactFazercardsPayload,
} from "@/lib/fazercards-extract";


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
  /**
   * Certification explicite de l'identifiant par le client, exigée quand le
   * fournisseur ne sait pas vérifier le jeu (`checked: false`). Sans elle, la
   * vente est refusée : un identifiant erroné sur un jeu non vérifiable
   * ouvrait auparavant la page de paiement sans le moindre garde-fou.
   */
  idConfirmed?: boolean;
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

/**
 * Champs acheteur mémorisés sur une commande (colonne jsonb existante).
 *
 * Exporté pour l'admin : c'est la seule trace de l'identifiant RÉELLEMENT
 * transmis au fournisseur (ex. le `user_id` d'une recharge). Sans cet
 * affichage, un litige « ce n'est pas mon compte » ne se diagnostiquait
 * qu'en lisant la base.
 */
export function storedBuyerFields(order: {
  reloadlyResponse?: unknown;
}): Record<string, string | number> {
  const stored = order.reloadlyResponse;
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return {};
  const fields = (stored as { buyerFields?: unknown }).buyerFields;
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) return {};
  return sanitizeBuyerFields(fields as Record<string, unknown>);
}

/** Trace du contrôle d'identifiant mémorisée à la caisse (admin). */
export interface StoredPlayerIdCheck {
  checked: boolean;
  valid: boolean;
  playerName?: string;
  region?: string;
  reason?: string;
  confirmedByCustomer?: boolean;
}

/**
 * Relit le contrôle d'identifiant enregistré sur la commande.
 *
 * `null` = commande antérieure au garde-fou (aucune trace). C'est cette
 * information qui permet à l'admin de savoir si une recharge est partie sur
 * un identifiant vérifié, refusé, ou seulement certifié par le client.
 */
export function storedPlayerIdCheck(order: {
  reloadlyResponse?: unknown;
}): StoredPlayerIdCheck | null {
  const stored = order.reloadlyResponse;
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return null;
  const check = (stored as { playerIdCheck?: unknown }).playerIdCheck;
  if (!check || typeof check !== "object" || Array.isArray(check)) return null;
  const value = check as Record<string, unknown>;
  return {
    checked: value.checked === true,
    valid: value.valid === true,
    ...(typeof value.playerName === "string" && value.playerName
      ? { playerName: value.playerName }
      : {}),
    ...(typeof value.region === "string" && value.region ? { region: value.region } : {}),
    ...(typeof value.reason === "string" && value.reason ? { reason: value.reason } : {}),
    confirmedByCustomer: value.confirmedByCustomer === true,
  };
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

  // Facture trop petite : la passerelle crypto la refuserait. On l'annonce
  // AVANT le paiement, avec l'action à faire (augmenter la quantité).
  const minOrderUsd = fazercardsMinOrderUsd();
  const minQuantity = Math.max(1, Math.ceil(minOrderUsd / unitPriceUsd));
  if (totalUsd < minOrderUsd) {
    throw new FazercardsOrderError(
      "below_minimum",
      400,
      `Montant minimum ${minOrderUsd.toFixed(2)} $ par commande — choisissez au moins ${Math.min(
        minQuantity,
        denomination.maxOrderQuantity,
      )} × ${denomination.label}.`,
    );
  }

  // Plafond d'achat automatique : au-delà, la livraison basculerait en
  // manuel APRÈS encaissement. On refuse donc la vente tout de suite — le
  // client n'a aucune raison de payer un article qu'on ne livrera pas seul.
  const maxOrderUsd = fazercardsMaxOrderUsd();
  if (totalUsd > maxOrderUsd) {
    const maxQuantityByCap = Math.max(1, Math.floor(maxOrderUsd / unitPriceUsd));
    throw new FazercardsOrderError(
      "above_limit",
      409,
      `Montant maximum ${maxOrderUsd.toFixed(0)} $ par commande — réduisez la quantité (au plus ${maxQuantityByCap}) ou écrivez-nous sur WhatsApp.`,
    );
  }

  // Garde-fou de SOLDE fournisseur AVANT paiement — la caisse tient sa
  // promesse : ne jamais encaisser un achat que le solde ne peut pas financer
  // (le solde est débité du COÛT fournisseur, jamais du prix de vente).
  // Sans cette porte, une vente au-dessus du solde était encaissée puis
  // basculait en livraison manuelle + remboursement.
  // Coût inconnu (dénomination sans coût renseigné) ou solde illisible
  // (passerelle muette) → la vente reste possible : une API muette ne doit
  // pas fermer toute la boutique, et la bascule manuelle reste le filet.
  const orderCostUsd =
    denomination.supplierCostUsd != null &&
    Number.isFinite(denomination.supplierCostUsd) &&
    denomination.supplierCostUsd > 0
      ? Math.round(denomination.supplierCostUsd * quantity * 100) / 100
      : null;
  const balanceStatus = await getFazercardsBalanceStatus();
  const balanceDecision = balanceGate({
    balanceUsd: balanceStatus.assessment.balanceUsd,
    orderCostUsd,
  });
  if (balanceDecision.decision === "block") {
    // Le message client ne contient AUCUN montant interne (ni solde, ni coût).
    throw new FazercardsOrderError(
      "supplier_balance_insufficient",
      409,
      "Ce montant dépasse notre capacité d'achat immédiat : aucun montant n'a été débité. " +
        "Réduisez la quantité ou écrivez-nous sur WhatsApp — nous le commandons pour vous.",
    );
  }

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

  // Vérification de l'identifiant joueur AVANT le paiement — la seule
  // protection contre une recharge partie sur le compte d'un autre joueur
  // (identifiant appartenant à un autre jeu, faute de frappe…). Une recharge
  // livrée est irréversible : mieux vaut refuser la vente que créditer un
  // inconnu.
  //
  // Deux issues, décidées par `playerIdGate` (même règle que le tunnel) :
  //  - identifiant refusé par le fournisseur → refus net ;
  //  - jeu NON vérifiable → vente possible, mais seulement si le client a
  //    certifié l'identifiant (`idConfirmed`). Sans cette certification, la
  //    facture n'est pas créée : c'était le trou constaté en production.
  let playerIdCheck: {
    checked: boolean;
    valid: boolean;
    playerName?: string;
    region?: string;
    reason?: string;
    confirmedByCustomer: boolean;
  } | null = null;
  if (product.kind === "game_topup" && Object.keys(buyerFields).length > 0) {
    const check = await checkFazercardsPlayerId({
      categoryId: product.categoryId,
      fields: buyerFields,
    });
    const confirmed = input.idConfirmed === true;
    playerIdCheck = {
      checked: check.checked,
      valid: check.valid,
      ...(check.playerName ? { playerName: check.playerName } : {}),
      ...(check.region ? { region: check.region } : {}),
      ...(check.reason ? { reason: check.reason } : {}),
      confirmedByCustomer: confirmed,
    };

    const gate = playerIdGate({
      checked: check.checked,
      valid: check.valid,
      confirmed,
    });
    if (gate === "block") {
      throw new FazercardsOrderError(
        "invalid_player_id",
        400,
        "Identifiant refusé par le fournisseur : aucun compte de jeu ne correspond. " +
          "Vérifiez que cet identifiant est bien celui de votre compte — aucun montant n'a été débité.",
      );
    }
    if (gate === "require_confirmation") {
      throw new FazercardsOrderError(
        "player_id_unconfirmed",
        400,
        "Nous ne pouvons pas vérifier automatiquement cet identifiant auprès du fournisseur. " +
          "Confirmez explicitement qu'il s'agit de votre compte dans ce jeu : une recharge est " +
          "irréversible — aucun montant n'a été débité.",
      );
    }
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
        // Trace du contrôle d'identifiant (aucun secret) : l'admin voit si
        // l'identifiant a été vérifié, refusé, ou seulement certifié par le
        // client sur un jeu que le fournisseur ne sait pas vérifier.
        ...(playerIdCheck ? { playerIdCheck } : {}),
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

/** Nombre de relectures du statut fournisseur après l'achat (code en cours d'émission). */
const FAZERCARDS_CODE_POLL_ATTEMPTS = 4;
/** Délai entre deux relectures (ms). 4 × 2,5 s = 10 s au total. */
const FAZERCARDS_CODE_POLL_DELAY_MS = 2_500;

/**
 * Nombre de tentatives après lequel une commande `completed` SANS code est
 * basculée en livraison manuelle.
 *
 * Sans cette sortie de secours, une carte que notre extraction ne sait pas
 * lire tournait indéfiniment en « livraison en cours » : le client avait payé,
 * n'avait ni code ni e-mail, et personne n'était alerté. Mieux vaut un humain
 * qui récupère le code dans le tableau de bord du fournisseur et le saisit
 * (le client reçoit alors l'e-mail automatiquement).
 */
const FAZERCARDS_NO_CODE_ESCALATE_ATTEMPTS = 2;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

  // Seconde vérification, juste avant l'achat : le compte a pu être renommé
  // ou supprimé entre le paiement et la livraison. Si l'identifiant n'existe
  // plus, on N'ACHÈTE PAS (une recharge livrée est irréversible) et on passe
  // la main à un humain pour remboursement ou correction.
  if (loaded.kind === "game_topup") {
    const fields = storedBuyerFields(loaded);
    if (Object.keys(fields).length > 0) {
      const check = await checkFazercardsPlayerId({
        categoryId: loaded.productId,
        fields,
      });
      if (check.checked && !check.valid) {
        return flagManual(
          loaded,
          "Identifiant joueur refusé par le fournisseur au moment de la livraison : aucun compte correspondant. Achat NON effectué — corriger l'identifiant avec le client ou rembourser.",
        );
      }
    }
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

  // Numéro de la tentative en cours (1 = première livraison).
  const attemptNumber = (loaded.attempts ?? 0) + 1;

  // Marque comme « paid » avant l'achat fournisseur.
  await db
    .update(digitalOrders)
    .set({
      status: "paid",
      attempts: attemptNumber,
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
    let orderDetail = await getFazercardsOrderDetail(transactionId);
    if (!orderDetail.ok) {
      return flagManual(
        loaded,
        `FazerCards : statut inconnu (${orderDetail.status || "vide"}).`,
      );
    }

    const readDelivery = (raw: Record<string, unknown>, status: string) => {
      const supplierStatus = (status ?? "").trim().toLowerCase();
      const codes = extractFazercardsCodesFromOrder(raw);
      return {
        supplierStatus,
        codes,
        verdict: classifyFazercardsDelivery({
          kind: loaded.kind,
          status: supplierStatus,
          codes,
        }),
      };
    };

    let { supplierStatus, codes, verdict } = readDelivery(orderDetail.raw, orderDetail.status);

    // Sondage court : une carte cadeau est souvent émise quelques secondes
    // APRÈS la validation de la commande. Sans ces relectures, la commande
    // restait en « livraison en cours » jusqu'au cron du lendemain — le
    // client n'avait ni code ni e-mail (incident du 29/10/2026).
    // Durée totale bornée : 4 relectures × 2,5 s = 10 s, très en dessous du
    // temps d'exécution maximal d'une fonction serverless.
    if (loaded.kind !== "game_topup") {
      for (
        let poll = 1;
        poll < FAZERCARDS_CODE_POLL_ATTEMPTS && verdict === "processing";
        poll += 1
      ) {
        await sleep(FAZERCARDS_CODE_POLL_DELAY_MS);
        const next = await getFazercardsOrderDetail(transactionId);
        if (!next.ok) break;
        orderDetail = next;
        ({ supplierStatus, codes, verdict } = readDelivery(next.raw, next.status));
      }
    }

    // Journalise la FORME de la réponse quand un code est attendu mais absent
    // (valeurs masquées : jamais de clé en clair dans les logs). Sans cela,
    // un échec d'extraction ne se diagnostiquait qu'à l'aveugle.
    if (verdict !== "codes" && loaded.kind !== "game_topup") {
      console.warn(
        `[fazercards] aucun code lisible pour ${loaded.ref} (statut ${supplierStatus || "inconnu"}) — charges utiles :`,
        JSON.stringify(redactFazercardsPayload(orderDetail.raw ?? {})),
      );
    }

    // Commande annulée / refusée chez le fournisseur alors que le client a
    // payé : on ne peut pas livrer, mais il ne faut pas attendre un code
    // qui n'arrivera jamais. Bascule immédiate en livraison manuelle
    // (remplacement ou remboursement par l'équipe).
    if (verdict === "failed") {
      return flagManual(
        loaded,
        `FazerCards a annulé la commande (${supplierStatus}) — remboursement ou remplacement requis.`,
      );
    }

    if (verdict === "processing") {
      // Le fournisseur dit « completed » mais aucun code n'est extrait :
      // ce n'est plus une question d'attente, c'est un cas HUMAIN. On
      // s'arrête là au lieu de boucler, et le motif porte la structure de
      // la réponse (noms de champs uniquement, jamais une valeur) pour que
      // le diagnostic soit possible sans accès aux logs.
      const stuck =
        supplierStatus === "completed" &&
        loaded.kind !== "game_topup" &&
        attemptNumber >= FAZERCARDS_NO_CODE_ESCALATE_ATTEMPTS;

      if (stuck) {
        const shape = describeFazercardsPayload(orderDetail.raw ?? {})
          .slice(0, 12)
          .join(" | ");
        return flagManual(
          loaded,
          `FazerCards annonce la commande « completed » mais aucun code n'a pu être lu (${attemptNumber} tentatives). Récupérez le code dans le tableau de bord du fournisseur puis saisissez-le manuellement. Structure reçue : ${shape}`.slice(
            0,
            800,
          ),
        );
      }

      await db
        .update(digitalOrders)
        .set({
          reloadlyStatus: supplierStatus || "processing",
          updatedAt: new Date(),
        })
        .where(eq(digitalOrders.id, loaded.id));

      // Première attente : le client doit savoir que son paiement est reçu et
      // que le code arrive. Sans cet e-mail, il n'avait AUCUNE nouvelle entre
      // le paiement et la livraison (jusqu'à plusieurs heures).
      if (attemptNumber <= 1) {
        try {
          const { config } = await getSiteData();
          const email = await sendDigitalCodePendingEmail(
            loaded,
            config.name,
            config.url,
            config.email,
          );
          await recordDigitalEmailOutcome(loaded.id, email);
        } catch (error) {
          console.warn("[fazercards] e-mail « code en cours » non envoyé :", error);
        }
      }

      return {
        outcome: "awaiting_codes",
        ref: loaded.ref,
        message: `Code en cours de traitement chez FazerCards (${supplierStatus || "processing"}).`,
      };
    }

    // Recharge de jeu terminée : il n'y a PAS de code à attendre — le crédit
    // est appliqué directement au compte du joueur. La commande est donc
    // livrée, et le client reçoit un e-mail de confirmation. (Avant ce
    // correctif, elle basculait à tort en livraison manuelle.)
    if (verdict === "topup_completed") {
      const now = new Date();
      const updatedTopup = await db
        .update(digitalOrders)
        .set({
          status: "delivered",
          reloadlyStatus: supplierStatus || "completed",
          deliveredAt: now,
          lastError: null,
          updatedAt: now,
        })
        .where(eq(digitalOrders.id, loaded.id))
        .returning();
      const deliveredTopup = updatedTopup[0] ?? { ...loaded, status: "delivered" };

      try {
        const { config } = await getSiteData();
        const email = await sendDigitalTopupDeliveredEmail(
          deliveredTopup,
          config.name,
          config.url,
          config.email,
        );
        await recordDigitalEmailOutcome(loaded.id, email);
      } catch (error) {
        console.warn("[fazercards] e-mail recharge non envoyé :", error);
      }

      return { outcome: "delivered", ref: loaded.ref };
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
 *
 * ⚠️ On conserve l'objet ENTIER (`raw`), pas seulement `payload` : la réponse
 * n'est pas documentée (`additionalProperties: true`) et certaines familles
 * — les cartes cadeaux notamment — n'exposent pas leurs codes au même
 * endroit. Ne garder que `payload` faisait perdre le code et bloquait la
 * commande en « livraison en cours » (incident DGC-FE3D8287…, 29/10/2026).
 */
async function getFazercardsOrderDetail(
  orderId: string,
): Promise<{
  ok: boolean;
  status: string;
  raw: Record<string, unknown>;
}> {
  const detail = await fazercardsOrder(orderId);
  const raw = (detail.order ?? {}) as unknown as Record<string, unknown>;
  return {
    ok: detail.ok,
    status: String(detail.order?.status ?? ""),
    raw,
  };
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
