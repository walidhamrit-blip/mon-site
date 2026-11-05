// Stockage et revue admin des cartes de recharge téléphonique.
// Serveur uniquement : le code ne quitte ce module déchiffré que pour l'admin.

import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { Buffer } from "node:buffer";
import { and, desc, eq, ne } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import {
  digitalOrders,
  orders,
  phoneCardPayments,
  type PhoneCardPayment,
} from "@/db/schema";
import { digitalCodesKey } from "@/lib/digital-codes";
import {
  normalizePhoneCardReviewStatus,
  validatePhoneCardInput,
  type PhoneCardInput,
  type PhoneCardReviewStatus,
} from "@/lib/phone-card-core";
import type { PhoneCardLydQuote } from "@/lib/phone-card-pricing-core";

export class PhoneCardPaymentError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "PhoneCardPaymentError";
  }
}

export interface PreparedPhoneCardPayment {
  operator: string;
  cardValueLyd: string;
  codeCipher: string;
  codeFingerprint: string;
  codeHint: string;
}

/** Chiffre et empreinte le code AVANT d'ouvrir la commande. */
export function preparePhoneCardPayment(
  input: PhoneCardInput | null | undefined,
): PreparedPhoneCardPayment {
  const validated = validatePhoneCardInput(input);
  if (!validated.ok) {
    throw new PhoneCardPaymentError("invalid_phone_card", 400, validated.error);
  }
  const key = digitalCodesKey();
  if (!key) {
    throw new PhoneCardPaymentError(
      "phone_card_encryption_unconfigured",
      503,
      "Le paiement par carte téléphonique n’est pas disponible : configurez DIGITAL_CODES_SECRET ou SESSION_SECRET.",
    );
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(validated.value.code, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const codeCipher = [iv, tag, encrypted]
    .map((part) => part.toString("base64url"))
    .join(".");
  // HMAC plutôt qu'un hash simple : l'empreinte unique ne permet pas de
  // tester hors ligne des numéros de recharge plausibles.
  const codeFingerprint = createHmac("sha256", key)
    .update(`nukhba-phone-card:${validated.value.code}`)
    .digest("hex");

  return {
    operator: validated.value.operator,
    cardValueLyd: validated.value.valueLyd,
    codeCipher,
    codeFingerprint,
    codeHint: `•••• ${validated.value.code.slice(-4)}`,
  };
}

function decryptPhoneCardCode(payload: string): string | null {
  const key = digitalCodesKey();
  if (!key) return null;
  const parts = payload.split(".");
  if (parts.length !== 3) return null;
  try {
    const [iv, tag, data] = parts.map((part) => Buffer.from(part, "base64url"));
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export async function insertPreparedPhoneCardPayment(
  orderRef: string,
  prepared: PreparedPhoneCardPayment,
  quote: PhoneCardLydQuote,
): Promise<void> {
  await ensureSchema();
  await db.insert(phoneCardPayments).values({
    orderRef,
    ...prepared,
    quoteAmountUsdt: quote.amountUsdt.toFixed(2),
    quoteRateLyd: quote.rateLyd.toFixed(4),
    quoteTotalLyd: quote.totalLyd.toFixed(2),
    quoteMarkupPercent: quote.markupPercent,
    quoteSource: quote.source,
    quoteRateUpdatedAt: quote.rateUpdatedAt ? new Date(quote.rateUpdatedAt) : null,
    quoteFetchedAt: new Date(quote.fetchedAt),
  });
}

export function isPhoneCardDuplicateError(error: unknown): boolean {
  const candidate = error as { code?: string; constraint?: string; message?: string } | null;
  return Boolean(
    candidate &&
      (candidate.constraint === "phone_card_payments_code_fingerprint_unique" ||
        (candidate.code === "23505" && /code_fingerprint/i.test(candidate.message ?? ""))),
  );
}

export interface PhoneCardDeliveryGate {
  isPhoneCard: boolean;
  status: PhoneCardReviewStatus;
}

/** Garde-fou partagé par la livraison automatique et la saisie manuelle. */
export async function phoneCardDeliveryGate(ref: string): Promise<PhoneCardDeliveryGate> {
  await ensureSchema();
  const paymentRows = await db
    .select({ paymentMethod: orders.paymentMethod })
    .from(orders)
    .where(eq(orders.ref, ref))
    .limit(1);
  if (paymentRows[0]?.paymentMethod !== "phone_card") {
    return { isPhoneCard: false, status: "pending" };
  }
  const rows = await db
    .select({ status: phoneCardPayments.status })
    .from(phoneCardPayments)
    .where(eq(phoneCardPayments.orderRef, ref))
    .limit(1);
  return {
    isPhoneCard: true,
    status: normalizePhoneCardReviewStatus(rows[0]?.status),
  };
}

export async function getPhoneCardReviewStatus(
  ref: string,
): Promise<PhoneCardReviewStatus | null> {
  await ensureSchema();
  const rows = await db
    .select({ status: phoneCardPayments.status })
    .from(phoneCardPayments)
    .where(eq(phoneCardPayments.orderRef, ref))
    .limit(1);
  return rows[0] ? normalizePhoneCardReviewStatus(rows[0].status) : null;
}

export interface AdminPhoneCardPaymentRow {
  ref: string;
  createdAt: string;
  productTitle: string;
  denominationLabel: string;
  quantity: number;
  totalUsd: string;
  recipientName: string | null;
  recipientEmail: string;
  recipientPhone: string | null;
  operator: string;
  cardValueLyd: string;
  quote: {
    amountUsdt: string;
    rateLyd: string;
    totalLyd: string;
    markupPercent: number;
    source: string;
    rateUpdatedAt: string | null;
    fetchedAt: string | null;
  } | null;
  codeHint: string;
  /** Déchiffré seulement pour le rendu admin authentifié. */
  code: string | null;
  status: PhoneCardReviewStatus;
  reviewedAt: string | null;
  reviewNote: string | null;
  deliveryStatus: string;
}

export async function listPhoneCardPayments(limit = 100): Promise<AdminPhoneCardPaymentRow[]> {
  await ensureSchema();
  const rows = await db
    .select({
      payment: phoneCardPayments,
      productTitle: digitalOrders.productTitle,
      denominationLabel: digitalOrders.denominationLabel,
      quantity: digitalOrders.quantity,
      totalUsd: digitalOrders.totalUsd,
      recipientName: digitalOrders.recipientName,
      recipientEmail: digitalOrders.recipientEmail,
      recipientPhone: digitalOrders.recipientPhone,
      deliveryStatus: digitalOrders.status,
    })
    .from(phoneCardPayments)
    .innerJoin(digitalOrders, eq(digitalOrders.ref, phoneCardPayments.orderRef))
    .orderBy(desc(phoneCardPayments.createdAt))
    .limit(Math.min(200, Math.max(1, limit)));

  return rows.map(({ payment, ...order }) => ({
    ref: payment.orderRef,
    createdAt: payment.createdAt.toISOString(),
    ...order,
    operator: payment.operator,
    cardValueLyd: payment.cardValueLyd,
    quote:
      payment.quoteAmountUsdt && payment.quoteRateLyd && payment.quoteTotalLyd
        ? {
            amountUsdt: payment.quoteAmountUsdt,
            rateLyd: payment.quoteRateLyd,
            totalLyd: payment.quoteTotalLyd,
            markupPercent: payment.quoteMarkupPercent ?? 20,
            source: payment.quoteSource ?? "manual",
            rateUpdatedAt: payment.quoteRateUpdatedAt?.toISOString() ?? null,
            fetchedAt: payment.quoteFetchedAt?.toISOString() ?? null,
          }
        : null,
    codeHint: payment.codeHint,
    code: decryptPhoneCardCode(payment.codeCipher),
    status: normalizePhoneCardReviewStatus(payment.status),
    reviewedAt: payment.reviewedAt?.toISOString() ?? null,
    reviewNote: payment.reviewNote,
  }));
}

export interface ReviewPhoneCardResult {
  ok: boolean;
  status?: PhoneCardReviewStatus;
  error?: string;
  payment?: PhoneCardPayment;
}

/** Accepte ou refuse une carte en attente, puis synchronise les deux commandes. */
export async function reviewPhoneCardPayment(
  refInput: string,
  decision: "approved" | "rejected",
  noteInput?: string,
): Promise<ReviewPhoneCardResult> {
  await ensureSchema();
  const ref = refInput.trim().toUpperCase();
  if (!ref) return { ok: false, error: "Référence manquante." };
  const note = (noteInput ?? "").trim().slice(0, 500) || null;
  if (decision === "rejected" && !note) {
    return { ok: false, error: "Indiquez le motif du refus pour le suivi interne." };
  }

  return db.transaction(async (tx) => {
    const existingDigital = await tx
      .select({ status: digitalOrders.status })
      .from(digitalOrders)
      .where(eq(digitalOrders.ref, ref))
      .limit(1);
    if (!existingDigital[0]) return { ok: false, error: "Commande digitale introuvable." };
    if (existingDigital[0].status === "delivered") {
      return { ok: false, error: "Cette commande est déjà livrée : son paiement ne peut plus être modifié." };
    }

    const now = new Date();
    const reviewed = await tx
      .update(phoneCardPayments)
      .set({ status: decision, reviewedAt: now, reviewNote: note, updatedAt: now })
      .where(and(eq(phoneCardPayments.orderRef, ref), eq(phoneCardPayments.status, "pending")))
      .returning();
    if (!reviewed[0]) {
      const current = await tx
        .select()
        .from(phoneCardPayments)
        .where(eq(phoneCardPayments.orderRef, ref))
        .limit(1);
      return current[0]
        ? { ok: false, error: "Cette carte a déjà été traitée.", status: normalizePhoneCardReviewStatus(current[0].status) }
        : { ok: false, error: "Carte téléphonique introuvable." };
    }

    await tx
      .update(orders)
      .set({
        status: decision === "approved" ? "paid" : "failed",
        ipnStatus: `phone_card_${decision}`,
        updatedAt: now,
      })
      .where(eq(orders.ref, ref));

    if (decision === "approved") {
      // Jamais `paid` ici : ce statut laisserait le cron acheter automatiquement.
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
          lastError: `Carte téléphonique refusée : ${note}`,
          updatedAt: now,
        })
        .where(and(eq(digitalOrders.ref, ref), ne(digitalOrders.status, "delivered")));
    }

    return { ok: true, status: decision, payment: reviewed[0] };
  });
}
