// Registre des soldes dus aux clients — accès base.
//
// Règle métier : ce que le client a payé en trop lui reste dû. Le cas typique
// est la carte de recharge téléphonique : carte 30,00 LYD pour un devis de
// 17,96 LYD → 12,04 LYD de solde, utilisables plus tard ou remboursables.
//
// Toute variation passe par un MOUVEMENT (jamais une écriture directe du
// solde) : l'historique est la preuve, le solde n'en est que la somme.
// Le calcul et le formatage vivent dans `client-credits-core.ts` (pur).

import { desc, eq } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import {
  clientCreditMovements,
  clientCredits,
  digitalOrders,
  phoneCardPayments,
} from "@/db/schema";
import {
  applyMovement,
  CREDIT_MOVEMENT_SIGNS,
  displayLyd,
  formatLyd,
  normalizeClientKey,
  normalizeMovementKind,
  overpaymentLyd,
  parseLyd,
  type CreditMovementKind,
} from "@/lib/client-credits-core";

export interface AdminClientCredit {
  id: number;
  clientKey: string;
  clientName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  balanceLyd: string;
  note: string | null;
  updatedAt: string;
}

export interface AdminCreditMovement {
  id: number;
  creditId: number;
  kind: CreditMovementKind;
  amountLyd: string;
  orderRef: string | null;
  balanceAfterLyd: string;
  note: string | null;
  createdAt: string;
  clientName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
}

export type CreditWriteResult =
  | { ok: true; message: string; balanceAfter?: string; creditId?: number }
  | { ok: false; error: string };

/* --------------------------------- Lecture -------------------------------- */

export async function listClientCredits(limit = 200): Promise<AdminClientCredit[]> {
  await ensureSchema();
  const rows = await db
    .select()
    .from(clientCredits)
    .orderBy(desc(clientCredits.updatedAt))
    .limit(Math.min(500, Math.max(1, limit)));

  return rows.map((row) => ({
    id: row.id,
    clientKey: row.clientKey,
    clientName: row.clientName,
    clientEmail: row.clientEmail,
    clientPhone: row.clientPhone,
    balanceLyd: row.balanceLyd,
    note: row.note,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function listCreditMovements(limit = 100): Promise<AdminCreditMovement[]> {
  await ensureSchema();
  const rows = await db
    .select({
      movement: clientCreditMovements,
      clientName: clientCredits.clientName,
      clientEmail: clientCredits.clientEmail,
      clientPhone: clientCredits.clientPhone,
    })
    .from(clientCreditMovements)
    .innerJoin(clientCredits, eq(clientCredits.id, clientCreditMovements.creditId))
    .orderBy(desc(clientCreditMovements.createdAt))
    .limit(Math.min(500, Math.max(1, limit)));

  return rows.map(({ movement, ...client }) => ({
    id: movement.id,
    creditId: movement.creditId,
    kind: normalizeMovementKind(movement.kind) ?? "adjustment",
    amountLyd: movement.amountLyd,
    orderRef: movement.orderRef,
    balanceAfterLyd: movement.balanceAfterLyd,
    note: movement.note,
    createdAt: movement.createdAt.toISOString(),
    ...client,
  }));
}

/** Total réellement dû à des clients (somme des soldes positifs). */
export async function totalOutstandingLyd(): Promise<string> {
  await ensureSchema();
  const rows = await db.select({ balanceLyd: clientCredits.balanceLyd }).from(clientCredits);
  const total = rows.reduce((sum, row) => sum + (parseLyd(row.balanceLyd) ?? 0), 0);
  return formatLyd(total);
}

/* --------------------------- Trop-perçu d'une carte ------------------------ */

export interface OverpaymentResult {
  ok: boolean;
  /** Message prêt à afficher dans l'admin (création ou motif d'absence). */
  message?: string;
  /** Montant effectivement crédité (jamais deux fois la même commande). */
  credited?: string;
  /** Explication quand rien n'est écrit (carte non acceptée, aucun écart…). */
  skipped?: string;
  creditId?: number;
  error?: string;
}

/**
 * Crée le solde dû à partir d'une carte téléphonique acceptée.
 *
 * Idempotent : l'index unique `(order_ref, kind)` empêche de créditer deux
 * fois le même trop-perçu, même si l'acceptation est rejouée.
 */
export async function recordPhoneCardOverpayment(ref: string): Promise<OverpaymentResult> {
  await ensureSchema();
  const orderRef = String(ref ?? "").trim().toUpperCase();
  if (!orderRef) return { ok: false, error: "Référence manquante." };

  const rows = await db
    .select({ payment: phoneCardPayments, order: digitalOrders })
    .from(phoneCardPayments)
    .innerJoin(digitalOrders, eq(digitalOrders.ref, phoneCardPayments.orderRef))
    .where(eq(phoneCardPayments.orderRef, orderRef))
    .limit(1);

  const found = rows[0];
  if (!found) {
    return { ok: false, error: "Aucune carte téléphonique pour cette référence." };
  }
  const { payment, order } = found;

  if ((payment.status ?? "").trim() !== "approved") {
    return { ok: true, skipped: "Carte non acceptée : aucun solde à créer." };
  }

  const amount = overpaymentLyd(payment.cardValueLyd, payment.quoteTotalLyd);
  if (amount === null) {
    return {
      ok: true,
      skipped:
        "Valeur de carte ou devis manquant : impossible de calculer l'écart sans risque d'erreur.",
    };
  }
  if (amount === 0) {
    return { ok: true, skipped: "Aucun trop-perçu (carte ≤ montant dû)." };
  }

  const identity = normalizeClientKey({
    email: order.recipientEmail,
    phone: order.recipientPhone,
  });
  if (!identity) {
    return {
      ok: true,
      skipped:
        "Ni e-mail ni téléphone exploitable sur la commande : solde non créé (impossible de le rapprocher d'un client).",
    };
  }

  return db.transaction(async (tx) => {
    const [credit] = await tx
      .insert(clientCredits)
      .values({
        clientKey: identity.key,
        clientName: order.recipientName,
        clientEmail: identity.email,
        clientPhone: identity.phone,
      })
      .onConflictDoUpdate({
        target: clientCredits.clientKey,
        set: {
          clientName: order.recipientName,
          clientEmail: identity.email,
          clientPhone: identity.phone,
          updatedAt: new Date(),
        },
      })
      .returning();

    const applied = applyMovement({
      balanceLyd: credit.balanceLyd,
      kind: "overpayment",
      amountLyd: amount,
    });
    if (!applied.ok) throw new Error(applied.error);

    const inserted = await tx
      .insert(clientCreditMovements)
      .values({
        creditId: credit.id,
        kind: "overpayment",
        amountLyd: applied.amount,
        orderRef,
        balanceAfterLyd: applied.balanceAfter,
        note: `Carte ${displayLyd(payment.cardValueLyd)} — devis ${displayLyd(payment.quoteTotalLyd)}`,
      })
      .onConflictDoNothing({
        target: [clientCreditMovements.orderRef, clientCreditMovements.kind],
      })
      .returning();

    if (!inserted[0]) {
      return {
        ok: true as const,
        skipped: `Le trop-perçu de la commande ${orderRef} est déjà enregistré.`,
        creditId: credit.id,
      };
    }

    await tx
      .update(clientCredits)
      .set({ balanceLyd: applied.balanceAfter, updatedAt: new Date() })
      .where(eq(clientCredits.id, credit.id));

    return {
      ok: true as const,
      credited: applied.amount,
      creditId: credit.id,
      message: `Solde client +${displayLyd(applied.amount)} (nouveau solde : ${displayLyd(applied.balanceAfter)}).`,
    };
  });
}

/* ----------------------------- Écritures admin ---------------------------- */

export interface MovementInput {
  creditId: number;
  kind: unknown;
  amountLyd: unknown;
  note?: unknown;
  orderRef?: unknown;
}

/**
 * Enregistre un mouvement (utilisation, remboursement, ajustement).
 * Le débit ne peut jamais dépasser le solde : `applyMovement` le refuse.
 */
export async function addCreditMovement(input: MovementInput): Promise<CreditWriteResult> {
  await ensureSchema();
  const kind = normalizeMovementKind(input.kind);
  if (!kind) return { ok: false, error: "Type de mouvement inconnu." };
  if (kind === "overpayment") {
    return {
      ok: false,
      error: "Le trop-perçu est calculé automatiquement depuis la carte, il ne se saisit pas à la main.",
    };
  }

  const note = String(input.note ?? "").trim().slice(0, 300) || null;
  const orderRef = String(input.orderRef ?? "").trim().toUpperCase().slice(0, 80) || null;
  if ((kind === "use" || kind === "refund") && !note && !orderRef) {
    return {
      ok: false,
      error: "Indiquez la commande concernée ou une note : un débit sans justification est intraçable.",
    };
  }

  return db.transaction(async (tx) => {
    const [credit] = await tx
      .select()
      .from(clientCredits)
      .where(eq(clientCredits.id, input.creditId))
      .limit(1);
    if (!credit) return { ok: false as const, error: "Solde client introuvable." };

    const applied = applyMovement({
      balanceLyd: credit.balanceLyd,
      kind,
      amountLyd: input.amountLyd,
    });
    if (!applied.ok) return { ok: false as const, error: applied.error };

    await tx.insert(clientCreditMovements).values({
      creditId: credit.id,
      kind,
      amountLyd: applied.signedAmount,
      orderRef,
      balanceAfterLyd: applied.balanceAfter,
      note,
    });

    await tx
      .update(clientCredits)
      .set({ balanceLyd: applied.balanceAfter, updatedAt: new Date() })
      .where(eq(clientCredits.id, credit.id));

    const sign = CREDIT_MOVEMENT_SIGNS[kind];
    return {
      ok: true as const,
      creditId: credit.id,
      balanceAfter: applied.balanceAfter,
      message: `Mouvement enregistré (${sign > 0 ? "+" : "−"}${displayLyd(applied.amount)}) — solde : ${displayLyd(applied.balanceAfter)}.`,
    };
  });
}
