// Stockage et revue admin des paiements manuels sans passerelle
// (Skrill, Neteller, Airtm, D17).
//
// Serveur uniquement. Contrairement aux cartes téléphoniques, il n'y a ici
// aucun secret à chiffrer : on conserve seulement une PREUVE DÉCLARÉE
// (titulaire, compte expéditeur, identifiant de transaction) que
// l'administrateur confronte à son relevé avant d'accepter.
//
// Règle centrale : rien ne se débloque tout seul. `approved` est le seul
// statut qui autorise la livraison, et il n'est atteint que par un geste
// humain authentifié.

import { and, desc, eq, ne } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import {
  digitalOrders,
  manualPayments,
  subscriptions,
  subscriptionPlans,
  orders,
  type ManualPayment,
} from "@/db/schema";
import {
  calculateManualPaymentQuote,
  formatManualPaymentAmount,
  manualPaymentCurrencyAndRate,
  manualPaymentMethodReady,
  MANUAL_PAYMENT_METHOD_LABELS,
  normalizeManualPaymentMethod,
  normalizeManualPaymentReviewStatus,
  manualPaymentQuoteMatches,
  validateManualPaymentInput,
  type ManualPaymentInput,
  type ManualPaymentQuote,
  type ManualPaymentReviewStatus,
  type ManualPaymentMethodSettings,
} from "@/lib/manual-payment-core";

export class ManualPaymentError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ManualPaymentError";
  }
}

export interface PreparedManualPayment {
  method: NonNullable<ReturnType<typeof normalizeManualPaymentMethod>>;
  targetAccount: string;
  targetBeneficiary: string | null;
  senderName: string;
  senderAccount: string;
  transactionRef: string;
  note: string | null;
  quote: ManualPaymentQuote;
}

/**
 * Valide l'entrée, vérifie que la méthode est bien ouverte et recalcule le
 * devis AVANT d'ouvrir la commande. Le montant envoyé par le navigateur
 * n'est jamais repris : `quote` vient exclusivement du réglage serveur.
 */
export function prepareManualPayment(
  input: ManualPaymentInput | null | undefined,
  settings: ManualPaymentMethodSettings | null | undefined,
  amountUsd: number,
): PreparedManualPayment {
  const validated = validateManualPaymentInput(input);
  if (!validated.ok) {
    throw new ManualPaymentError("invalid_manual_payment", 400, validated.error);
  }
  if (!settings || settings.enabled !== true || !manualPaymentMethodReady(settings)) {
    throw new ManualPaymentError(
      "manual_payment_method_unavailable",
      409,
      "Ce moyen de paiement n’est pas proposé actuellement. Choisissez-en un autre ou le paiement crypto.",
    );
  }
  const currencyAndRate = manualPaymentCurrencyAndRate(settings);
  if (!currencyAndRate) {
    throw new ManualPaymentError(
      "manual_payment_rate_unavailable",
      503,
      "Le taux de change de ce moyen de paiement n’est pas configuré. Aucun prix ne sera inventé — choisissez la crypto ou écrivez-nous.",
    );
  }

  const { method, senderName, senderAccount, transactionRef, note } = validated.value;
  const quote = calculateManualPaymentQuote(amountUsd, method, settings);
  if (!quote) {
    throw new ManualPaymentError(
      "manual_payment_quote_unavailable",
      400,
      "Montant de commande invalide pour ce moyen de paiement.",
    );
  }

  return {
    method,
    targetAccount: settings.account.trim(),
    targetBeneficiary: settings.beneficiary.trim() || null,
    senderName,
    senderAccount,
    transactionRef,
    note,
    quote,
  };
}

/** Enregistre la preuve déclarée, une seule fois par commande. */
export async function insertPreparedManualPayment(
  orderRef: string,
  prepared: PreparedManualPayment,
  options: { subscriptionId?: number } = {},
): Promise<void> {
  await ensureSchema();
  await db.insert(manualPayments).values({
    orderRef,
    ...(options.subscriptionId ? { subscriptionId: options.subscriptionId } : {}),
    method: prepared.method,
    targetAccount: prepared.targetAccount,
    targetBeneficiary: prepared.targetBeneficiary,
    amountUsd: prepared.quote.amountUsd.toFixed(2),
    payCurrency: prepared.quote.payCurrency,
    payRate: prepared.quote.payRate.toFixed(6),
    feePercent: prepared.quote.feePercent.toFixed(2),
    payAmount: prepared.quote.payAmount.toFixed(2),
    senderName: prepared.senderName,
    senderAccount: prepared.senderAccount,
    transactionRef: prepared.transactionRef,
    note: prepared.note,
  });
}

/**
 * Prépare un paiement manuel depuis la configuration VIVANTE du site.
 *
 * Factorisé parce que trois tunnels l'utilisent (boutique de codes, création
 * de sites, abonnements) : la règle « méthode activée + compte présent +
 * taux disponible + devis recalculé » est ainsi écrite une seule fois.
 *
 * `confirmQuote` est fourni par le client ; il ne sert qu'à refuser un écart
 * (réglage modifié entre l'affichage et l'envoi). Le devis retenu est
 * TOUJOURS celui recalculé ici.
 */
export async function prepareManualPaymentForSite(
  input: ManualPaymentInput | null | undefined,
  amountUsd: number,
  locale: "ar" | "en" = "ar",
): Promise<PreparedManualPayment> {
  const method = normalizeManualPaymentMethod(input?.method);
  if (!method) {
    throw new ManualPaymentError(
      "manual_payment_method_unavailable",
      400,
      locale === "ar"
        ? "اختر وسيلة دفع يدوي صحيحة."
        : "Choose a valid manual payment method.",
    );
  }
  const { getSiteData } = await import("@/lib/store");
  const { config } = await getSiteData();
  const settings = config.manualPayments?.[method];
  if (!settings || settings.enabled !== true) {
    throw new ManualPaymentError(
      "manual_payment_method_unavailable",
      409,
      locale === "ar"
        ? "طريقة الدفع اليدوي هذه غير متاحة حالياً. اختر طريقة أخرى أو الدفع بالعملات الرقمية."
        : "This manual payment method is not available right now. Choose another method or crypto payment.",
    );
  }
  const prepared = prepareManualPayment(input, settings, amountUsd);
  if (input?.quoteAccepted !== true) {
    throw new ManualPaymentError(
      "manual_payment_quote_unconfirmed",
      400,
      locale === "ar"
        ? "أكّد قراءتك لمبلغ التحويل المطلوب قبل إرسال بيانات الدفع."
        : "Confirm the amount to send before submitting your payment details.",
    );
  }
  if (!manualPaymentQuoteMatches(input?.quote, prepared.quote)) {
    throw new ManualPaymentError(
      "manual_payment_quote_changed",
      409,
      locale === "ar"
        ? "تغيّر مبلغ التحويل المطلوب. راجع المبلغ الجديد وأكّده قبل إعادة المحاولة."
        : "The amount to send has changed. Review the new amount and confirm it again.",
    );
  }
  return prepared;
}

export function isManualPaymentDuplicateError(error: unknown): boolean {
  const candidate = error as { code?: string; constraint?: string; message?: string } | null;
  return Boolean(
    candidate &&
      (candidate.constraint === "manual_payments_order_ref_unique" ||
        (candidate.code === "23505" && /order_ref/i.test(candidate.message ?? ""))),
  );
}

export interface ManualPaymentDeliveryGate {
  isManual: boolean;
  method: string | null;
  status: ManualPaymentReviewStatus;
}

/**
 * Garde-fou partagé par la livraison automatique et la saisie manuelle.
 * Une commande qui n'est pas un paiement manuel renvoie `isManual: false`.
 */
export async function manualPaymentDeliveryGate(ref: string): Promise<ManualPaymentDeliveryGate> {
  await ensureSchema();
  const rows = await db
    .select({
      method: manualPayments.method,
      status: manualPayments.status,
    })
    .from(manualPayments)
    .where(eq(manualPayments.orderRef, ref))
    .limit(1);
  // Une ligne sans méthode exploitable n'est pas une preuve valide : mieux
  // vaut ne pas verrouiller la livraison sur une donnée incomplète que
  // bloquer indéfiniment une commande légitime.
  if (!rows[0] || !String(rows[0].method ?? "").trim()) {
    return { isManual: false, method: null, status: "pending" };
  }
  return {
    isManual: true,
    method: rows[0].method,
    status: normalizeManualPaymentReviewStatus(rows[0].status),
  };
}

export async function getManualPaymentReviewStatus(
  ref: string,
): Promise<ManualPaymentReviewStatus | null> {
  await ensureSchema();
  const rows = await db
    .select({ status: manualPayments.status })
    .from(manualPayments)
    .where(eq(manualPayments.orderRef, ref))
    .limit(1);
  return rows[0] ? normalizeManualPaymentReviewStatus(rows[0].status) : null;
}

export interface AdminManualPaymentRow {
  ref: string;
  createdAt: string;
  method: string;
  methodLabel: string;
  productTitle: string;
  denominationLabel: string;
  quantity: number;
  totalUsd: string;
  recipientName: string | null;
  recipientEmail: string | null;
  recipientPhone: string | null;
  amountUsd: string;
  payCurrency: string;
  payRate: string;
  feePercent: string;
  payAmount: string;
  targetAccount: string;
  targetBeneficiary: string | null;
  senderName: string;
  senderAccount: string;
  transactionRef: string;
  note: string | null;
  status: ManualPaymentReviewStatus;
  reviewedAt: string | null;
  reviewNote: string | null;
  /** Nature du paiement : code digital, projet web, ou abonnement. */
  kind: "digital" | "order" | "subscription";
  /** Référence d'une commande digitale (à livrer), sinon null. */
  digitalOrderRef: string | null;
  /** Traces utiles : la commande peut être digitale ou non. */
  orderKind: string;
  orderPlanName: string;
  orderEmail: string | null;
  orderPhone: string | null;
  orderClientName: string | null;
  deliveryStatus: string | null;
}

/**
 * File d'attente admin : la plus récente d'abord, quel que soit le tunnel
 * (codes, projets web, abonnements). Un paiement de projet web n'a pas de
 * ligne `digital_orders` — d'où la jointure externe.
 */
export async function listManualPayments(limit = 100): Promise<AdminManualPaymentRow[]> {
  await ensureSchema();
  const rows = await db
    .select({
      payment: manualPayments,
      orderKind: orders.kind,
      orderPlanName: orders.planName,
      orderEmail: orders.email,
      orderPhone: orders.phone,
      orderClientName: orders.clientName,
      productTitle: digitalOrders.productTitle,
      denominationLabel: digitalOrders.denominationLabel,
      quantity: digitalOrders.quantity,
      totalUsd: digitalOrders.totalUsd,
      recipientName: digitalOrders.recipientName,
      recipientEmail: digitalOrders.recipientEmail,
      recipientPhone: digitalOrders.recipientPhone,
      deliveryStatus: digitalOrders.status,
      subscriptionPlanId: subscriptions.planId,
      subscriptionPlanTitle: subscriptionPlans.title,
    })
    .from(manualPayments)
    // Jointure EXTERNE : un paiement d'abonnement n'a aucune ligne `orders`.
    .leftJoin(orders, eq(orders.ref, manualPayments.orderRef))
    .leftJoin(digitalOrders, eq(digitalOrders.ref, manualPayments.orderRef))
    .leftJoin(subscriptions, eq(subscriptions.id, manualPayments.subscriptionId))
    .leftJoin(subscriptionPlans, eq(subscriptionPlans.id, subscriptions.planId))
    .orderBy(desc(manualPayments.createdAt))
    .limit(Math.min(300, Math.max(1, limit)));

  return rows.map(({ payment, ...rest }) => ({
    ref: payment.orderRef,
    createdAt: payment.createdAt.toISOString(),
    method: payment.method,
    methodLabel:
      MANUAL_PAYMENT_METHOD_LABELS[
        payment.method as keyof typeof MANUAL_PAYMENT_METHOD_LABELS
      ] ?? payment.method,
    productTitle:
      rest.productTitle ??
      rest.orderPlanName ??
      (rest.subscriptionPlanTitle
        ? `Abonnement — ${rest.subscriptionPlanTitle}`
        : "Abonnement"),
    kind: rest.deliveryStatus
      ? "digital"
      : rest.subscriptionPlanId
        ? "subscription"
        : "order",
    digitalOrderRef: rest.deliveryStatus ? payment.orderRef : null,
    denominationLabel: rest.denominationLabel ?? "—",
    quantity: rest.quantity ?? 1,
    totalUsd: rest.totalUsd ?? payment.amountUsd,
    recipientName: rest.recipientName ?? rest.orderClientName,
    recipientEmail: rest.recipientEmail ?? rest.orderEmail,
    recipientPhone: rest.recipientPhone ?? rest.orderPhone,
    amountUsd: payment.amountUsd,
    payCurrency: payment.payCurrency,
    payRate: payment.payRate,
    feePercent: payment.feePercent,
    payAmount: payment.payAmount,
    targetAccount: payment.targetAccount,
    targetBeneficiary: payment.targetBeneficiary,
    senderName: payment.senderName,
    senderAccount: payment.senderAccount,
    transactionRef: payment.transactionRef,
    note: payment.note,
    status: normalizeManualPaymentReviewStatus(payment.status),
    reviewedAt: payment.reviewedAt?.toISOString() ?? null,
    reviewNote: payment.reviewNote,
    orderKind: rest.orderKind ?? (rest.subscriptionPlanId ? "subscription" : "order"),
    orderPlanName: rest.orderPlanName ?? (rest.subscriptionPlanTitle ?? "Abonnement"),
    orderEmail: rest.orderEmail,
    orderPhone: rest.orderPhone,
    orderClientName: rest.orderClientName,
    deliveryStatus: rest.deliveryStatus,
  }));
}

export interface ReviewManualPaymentResult {
  ok: boolean;
  status?: ManualPaymentReviewStatus;
  error?: string;
  payment?: ManualPayment;
  /** Commande digitale liée (si présente) : utilisée pour la livraison. */
  digitalOrderRef?: string | null;
  /** Abonnement réglé par ce virement (à activer après approbation). */
  subscriptionId?: number | null;
}

/**
 * Accepte ou refuse un paiement manuel en attente.
 *
 * Acceptation :
 *  - `orders.status = paid` → l'argent est réellement arrivé ;
 *  - une commande digitale bascule en livraison MANUELLE (`manual`) ; elle
 *    n'est jamais marquée « à livrer » automatiquement, exactement comme une
 *    carte téléphonique acceptée.
 * Refus : statut `failed`, motif obligatoire, aucune livraison.
 */
export async function reviewManualPayment(
  refInput: string,
  decision: "approved" | "rejected",
  noteInput?: string,
): Promise<ReviewManualPaymentResult> {
  await ensureSchema();
  const ref = refInput.trim().toUpperCase();
  if (!ref) return { ok: false, error: "Référence manquante." };
  const note = (noteInput ?? "").trim().slice(0, 500) || null;
  if (decision === "rejected" && !note) {
    return { ok: false, error: "Indiquez le motif du refus pour le suivi interne." };
  }

  // Une preuve peut porter sur une commande (`orders`) OU sur un abonnement
  // (aucune commande produit : le virement règle la période).
  const paymentRows = await db
    .select({ subscriptionId: manualPayments.subscriptionId })
    .from(manualPayments)
    .where(eq(manualPayments.orderRef, ref))
    .limit(1);
  if (!paymentRows[0]) return { ok: false, error: "Paiement manuel introuvable." };
  const subscriptionId = paymentRows[0].subscriptionId;

  return db.transaction(async (tx) => {
    const existing = subscriptionId
      ? [{ status: "pending", digitalOrderId: null }]
      : await tx
          .select({ status: orders.status, digitalOrderId: orders.digitalOrderId })
          .from(orders)
          .where(eq(orders.ref, ref))
          .limit(1);
    if (!existing[0]) return { ok: false, error: "Commande introuvable." };

    const now = new Date();
    const reviewed = await tx
      .update(manualPayments)
      .set({ status: decision, reviewedAt: now, reviewNote: note, updatedAt: now })
      .where(and(eq(manualPayments.orderRef, ref), eq(manualPayments.status, "pending")))
      .returning();
    if (!reviewed[0]) {
      const current = await tx
        .select()
        .from(manualPayments)
        .where(eq(manualPayments.orderRef, ref))
        .limit(1);
      return current[0]
        ? {
            ok: false,
            error: "Ce paiement a déjà été traité.",
            status: normalizeManualPaymentReviewStatus(current[0].status),
          }
        : { ok: false, error: "Paiement manuel introuvable." };
    }

    if (!subscriptionId) {
      await tx
        .update(orders)
        .set({
          status: decision === "approved" ? "paid" : "failed",
          ipnStatus: `manual_payment_${decision}`,
          updatedAt: now,
        })
        .where(eq(orders.ref, ref));
    }

    if (existing[0].digitalOrderId != null) {
      if (decision === "approved") {
        // Jamais `paid` ici : ce statut laisserait le cron acheter tout seul.
        await tx
          .update(digitalOrders)
          .set({
            status: "manual",
            fulfillment: "manual",
            lastError: null,
            updatedAt: now,
          })
          .where(and(eq(digitalOrders.ref, ref), ne(digitalOrders.status, "delivered")));
      } else {
        await tx
          .update(digitalOrders)
          .set({
            status: "failed",
            fulfillment: "manual",
            lastError: `Paiement manuel refusé : ${note}`,
            updatedAt: now,
          })
          .where(and(eq(digitalOrders.ref, ref), ne(digitalOrders.status, "delivered")));
      }
    }

    return {
      ok: true,
      status: decision,
      payment: reviewed[0],
      digitalOrderRef: existing[0].digitalOrderId != null ? ref : null,
      subscriptionId: subscriptionId ?? null,
    };
  });
}

/**
 * Résumé lisible du devis pour l'e-mail admin (jamais l'identifiant de
 * transaction complet côté public, mais l'admin en a besoin).
 */
export function manualPaymentQuoteLabel(payment: {
  payAmount: string;
  payCurrency: string;
  amountUsd: string;
}): string {
  return `${formatManualPaymentAmount(Number(payment.payAmount), payment.payCurrency as never)} (commande ${Number(payment.amountUsd).toFixed(2)} USD)`;
}
