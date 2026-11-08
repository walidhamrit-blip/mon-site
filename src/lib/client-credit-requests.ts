// Demandes d'utilisation d'un solde — accès base (option B).
//
// Le client voit son solde sur le suivi privé de sa commande (référence +
// jeton de suivi) et **demande** à l'utiliser. L'argent ne bouge pas avant la
// validation de l'admin : c'est la seule protection possible puisqu'il n'y a
// pas de compte client, donc aucune preuve d'identité autre que le lien privé
// reçu par e-mail.
//
// La validation réutilise `addCreditMovement` (kind « use ») : aucune écriture
// directe du solde, et le débit reste refusé s'il dépasse le solde disponible.

import { and, desc, eq } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import {
  clientCreditMovements,
  clientCreditRequests,
  clientCredits,
  digitalOrders,
  orders,
} from "@/db/schema";
import {
  creditRequestBlock,
  displayLyd,
  formatLyd,
  normalizeClientKey,
  normalizeCreditRequestStatus,
  parseLyd,
  type CreditRequestBlock,
  type CreditRequestStatus,
} from "@/lib/client-credits-core";
import { addCreditMovement } from "@/lib/client-credits";
import { trackingAccess } from "@/lib/order-tracking";

export interface ClientCreditRequestView {
  status: CreditRequestStatus;
  amountLyd: string;
  createdAt: string;
  reviewedAt: string | null;
  adminNote: string | null;
}

/** Ce que le client a le droit de voir sur son propre suivi. */
export interface ClientCreditView {
  balanceLyd: string;
  /** Demande connue pour CETTE commande (la plus récente). */
  request: ClientCreditRequestView | null;
  canRequest: boolean;
  blocked: CreditRequestBlock;
}

export interface AdminCreditRequest {
  id: number;
  creditId: number;
  orderRef: string;
  amountLyd: string;
  status: CreditRequestStatus;
  clientNote: string | null;
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  clientName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  balanceLyd: string;
  productTitle: string | null;
  orderStatus: string | null;
}

export type CreditRequestWriteResult =
  | { ok: true; message: string; view?: ClientCreditView; requestId?: number }
  | { ok: false; error: string };

/* ------------------------------- Lecture ---------------------------------- */

interface OrderCreditContext {
  orderRef: string;
  creditId: number;
  balanceLyd: string;
  orderStatus: string;
  digitalStatus: string;
  request: ClientCreditRequestView | null;
  hasPendingRequest: boolean;
  alreadyUsed: boolean;
  hasIdentity: boolean;
}

/**
 * Charge le contexte « solde » d'une commande, **sans jamais** se fier à
 * l'e-mail envoyé par le navigateur : l'identité vient de la commande.
 */
async function loadOrderCreditContext(ref: string): Promise<OrderCreditContext | null> {
  const orderRef = String(ref ?? "").trim().toUpperCase();
  if (!orderRef) return null;

  const rows = await db
    .select({
      digital: digitalOrders,
      orderStatus: orders.status,
    })
    .from(digitalOrders)
    .leftJoin(orders, eq(orders.ref, digitalOrders.ref))
    .where(eq(digitalOrders.ref, orderRef))
    .limit(1);

  const found = rows[0];
  if (!found) return null;

  const identity = normalizeClientKey({
    email: found.digital.recipientEmail,
    phone: found.digital.recipientPhone,
  });

  const base: OrderCreditContext = {
    orderRef,
    creditId: 0,
    balanceLyd: "0.00",
    orderStatus: String(found.orderStatus ?? ""),
    digitalStatus: String(found.digital.status ?? ""),
    request: null,
    hasPendingRequest: false,
    alreadyUsed: false,
    hasIdentity: Boolean(identity),
  };
  if (!identity) return base;

  const creditRows = await db
    .select()
    .from(clientCredits)
    .where(eq(clientCredits.clientKey, identity.key))
    .limit(1);
  const credit = creditRows[0];
  if (!credit) return base;

  const requests = await db
    .select()
    .from(clientCreditRequests)
    .where(
      and(
        eq(clientCreditRequests.creditId, credit.id),
        eq(clientCreditRequests.orderRef, orderRef),
      ),
    )
    .orderBy(desc(clientCreditRequests.createdAt))
    .limit(3);

  const latest = requests[0] ?? null;
  const usedRows = await db
    .select({ id: clientCreditMovements.id })
    .from(clientCreditMovements)
    .where(
      and(
        eq(clientCreditMovements.creditId, credit.id),
        eq(clientCreditMovements.orderRef, orderRef),
        eq(clientCreditMovements.kind, "use"),
      ),
    )
    .limit(1);

  return {
    ...base,
    creditId: credit.id,
    balanceLyd: formatLyd(credit.balanceLyd),
    request: latest
      ? {
          status: normalizeCreditRequestStatus(latest.status),
          amountLyd: formatLyd(latest.amountLyd),
          createdAt: latest.createdAt.toISOString(),
          reviewedAt: latest.reviewedAt?.toISOString() ?? null,
          adminNote: latest.adminNote,
        }
      : null,
    hasPendingRequest: requests.some(
      (row) => normalizeCreditRequestStatus(row.status) === "pending",
    ),
    alreadyUsed: usedRows.length > 0,
  };
}

function blockedFor(context: OrderCreditContext): CreditRequestBlock {
  // Une commande non payée par carte et encore « pending » reste ouverte au
  // solde : c'est justement le moment où le client veut l'utiliser.
  return creditRequestBlock({
    balanceLyd: context.balanceLyd,
    orderStatus: context.digitalStatus || context.orderStatus,
    hasPendingRequest: context.hasPendingRequest,
    alreadyUsed: context.alreadyUsed,
    hasIdentity: context.hasIdentity,
  });
}

/**
 * Vue publique du solde d'une commande.
 * `null` quand le jeton de suivi est absent ou faux : on ne révèle pas
 * l'existence de la référence (même politique que `/api/digital/orders/[ref]`).
 */
export async function getClientCreditView(
  ref: string,
  trackingToken: string | null,
): Promise<ClientCreditView | null> {
  await ensureSchema();
  const orderRef = String(ref ?? "").trim().toUpperCase();
  if (!orderRef) return null;

  const access = await db
    .select({
      ref: digitalOrders.ref,
      hash: orders.trackingTokenHash,
      recipientEmail: digitalOrders.recipientEmail,
    })
    .from(digitalOrders)
    .leftJoin(orders, eq(orders.ref, digitalOrders.ref))
    .where(eq(digitalOrders.ref, orderRef))
    .limit(1);

  const row = access[0];
  if (!row) return null;
  if (trackingAccess(row.hash, trackingToken) === "denied") return null;

  const context = await loadOrderCreditContext(orderRef);
  if (!context) return null;

  const blocked = blockedFor(context);
  return {
    balanceLyd: context.balanceLyd,
    request: context.request,
    canRequest: blocked === "none",
    blocked,
  };
}

/* ------------------------------- Demande ---------------------------------- */

/**
 * Enregistre la demande du client. Idempotent : une demande déjà en attente
 * (ou déjà validée/refusée sur la même commande) n'est pas dupliquée.
 */
export async function requestCreditUse(
  ref: string,
  trackingToken: string | null,
  clientNote?: string,
): Promise<CreditRequestWriteResult> {
  const view = await getClientCreditView(ref, trackingToken);
  if (!view) return { ok: false, error: "Commande introuvable." };

  if (!view.canRequest) {
    switch (view.blocked) {
      case "no_balance":
        return { ok: false, error: "Aucun solde disponible sur ce compte." };
      case "already_pending":
        return { ok: false, error: "Une demande est déjà en attente de validation." };
      case "already_used":
        return { ok: false, error: "Le solde a déjà été utilisé sur cette commande." };
      case "order_closed":
        return { ok: false, error: "Commande terminée : contactez-nous pour utiliser un solde." };
      case "no_identity":
      default:
        return { ok: false, error: "Aucun solde rattaché à cette commande." };
    }
  }

  const orderRef = String(ref ?? "").trim().toUpperCase();
  const context = await loadOrderCreditContext(orderRef);
  if (!context || !context.creditId) {
    return { ok: false, error: "Aucun solde rattaché à cette commande." };
  }

  const amount = parseLyd(context.balanceLyd) ?? 0;
  if (amount <= 0) return { ok: false, error: "Aucun solde disponible sur ce compte." };

  const note = String(clientNote ?? "").trim().slice(0, 300) || null;

  let insertedId: number | undefined;
  try {
    const inserted = await db
      .insert(clientCreditRequests)
      .values({
        creditId: context.creditId,
        orderRef,
        amountLyd: formatLyd(amount),
        status: "pending",
        clientNote: note,
      })
      .returning({ id: clientCreditRequests.id });
    insertedId = inserted[0]?.id;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Index unique (order_ref, status) : deux clics ne créent pas deux demandes.
    if (/duplicate|unique/i.test(message)) {
      return { ok: false, error: "Une demande a déjà été enregistrée pour cette commande." };
    }
    throw error;
  }

  return {
    ok: true,
    message: `Demande envoyée : ${displayLyd(amount)}. L’équipe valide et vous confirme.`,
    view: (await getClientCreditView(orderRef, trackingToken)) ?? undefined,
    requestId: insertedId,
  };
}

/** Données de la notification admin après une demande client. */
export interface CreditRequestNotice {
  orderRef: string;
  amountLyd: string;
  balanceLyd: string;
  clientName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  productTitle: string | null;
  clientNote: string | null;
}

/**
 * Charge de quoi prévenir l'admin (nom, e-mail, montant demandé).
 * Renvoie `null` si la demande n'existe pas — jamais d'invention de montant.
 */
export async function creditRequestNotice(
  ref: string,
  requestId?: number,
): Promise<CreditRequestNotice | null> {
  await ensureSchema();
  const orderRef = String(ref ?? "").trim().toUpperCase();
  const rows = await db
    .select({
      request: clientCreditRequests,
      credit: clientCredits,
      productTitle: digitalOrders.productTitle,
    })
    .from(clientCreditRequests)
    .innerJoin(clientCredits, eq(clientCredits.id, clientCreditRequests.creditId))
    .leftJoin(digitalOrders, eq(digitalOrders.ref, clientCreditRequests.orderRef))
    .where(
      requestId
        ? and(
            eq(clientCreditRequests.orderRef, orderRef),
            eq(clientCreditRequests.id, requestId),
          )
        : eq(clientCreditRequests.orderRef, orderRef),
    )
    .orderBy(desc(clientCreditRequests.createdAt))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  return {
    orderRef: row.request.orderRef,
    amountLyd: formatLyd(row.request.amountLyd),
    balanceLyd: formatLyd(row.credit.balanceLyd),
    clientName: row.credit.clientName,
    clientEmail: row.credit.clientEmail,
    clientPhone: row.credit.clientPhone,
    productTitle: row.productTitle,
    clientNote: row.request.clientNote,
  };
}

/* ---------------------------- Côté admin ---------------------------------- */

export async function listCreditRequests(limit = 50): Promise<AdminCreditRequest[]> {
  await ensureSchema();
  const rows = await db
    .select({
      request: clientCreditRequests,
      credit: clientCredits,
      productTitle: digitalOrders.productTitle,
      digitalStatus: digitalOrders.status,
    })
    .from(clientCreditRequests)
    .innerJoin(clientCredits, eq(clientCredits.id, clientCreditRequests.creditId))
    .leftJoin(digitalOrders, eq(digitalOrders.ref, clientCreditRequests.orderRef))
    .orderBy(desc(clientCreditRequests.createdAt))
    .limit(Math.min(200, Math.max(1, limit)));

  return rows.map(({ request, credit, productTitle, digitalStatus }) => ({
    id: request.id,
    creditId: request.creditId,
    orderRef: request.orderRef,
    amountLyd: formatLyd(request.amountLyd),
    status: normalizeCreditRequestStatus(request.status),
    clientNote: request.clientNote,
    adminNote: request.adminNote,
    createdAt: request.createdAt.toISOString(),
    reviewedAt: request.reviewedAt?.toISOString() ?? null,
    clientName: credit.clientName,
    clientEmail: credit.clientEmail,
    clientPhone: credit.clientPhone,
    balanceLyd: formatLyd(credit.balanceLyd),
    productTitle,
    orderStatus: digitalStatus,
  }));
}

/**
 * Valide la demande : le solde est débité par un mouvement « use » sur la
 * commande, puis la demande passe à `approved`.
 *
 * Refus si le solde a diminué entre-temps (débit > solde) ou si un mouvement
 * existe déjà pour cette commande (`(order_ref, kind)` unique).
 */
export async function approveCreditRequest(
  requestId: number,
  adminNote?: string,
): Promise<CreditRequestWriteResult> {
  await ensureSchema();
  if (!Number.isInteger(requestId) || requestId <= 0) {
    return { ok: false, error: "Demande invalide." };
  }

  const rows = await db
    .select()
    .from(clientCreditRequests)
    .where(eq(clientCreditRequests.id, requestId))
    .limit(1);
  const request = rows[0];
  if (!request) return { ok: false, error: "Demande introuvable." };
  if (normalizeCreditRequestStatus(request.status) !== "pending") {
    return { ok: false, error: "Cette demande a déjà été traitée." };
  }

  const note = String(adminNote ?? "").trim().slice(0, 300);
  const movement = await addCreditMovement({
    creditId: request.creditId,
    kind: "use",
    amountLyd: request.amountLyd,
    orderRef: request.orderRef,
    note: `Demande client validée${note ? ` — ${note}` : ""}`,
  });
  if (!movement.ok) return { ok: false, error: movement.error };

  const now = new Date();
  await db
    .update(clientCreditRequests)
    .set({
      status: "approved",
      adminNote: note || null,
      reviewedAt: now,
      updatedAt: now,
    })
    .where(eq(clientCreditRequests.id, requestId));

  return {
    ok: true,
    message: `Solde utilisé sur ${request.orderRef} : ${displayLyd(movement.balanceAfter ?? "0")} restant.`,
  };
}

/** Refuse la demande : aucun mouvement, le solde reste dû au client. */
export async function rejectCreditRequest(
  requestId: number,
  adminNote?: string,
): Promise<CreditRequestWriteResult> {
  await ensureSchema();
  if (!Number.isInteger(requestId) || requestId <= 0) {
    return { ok: false, error: "Demande invalide." };
  }
  const rows = await db
    .select()
    .from(clientCreditRequests)
    .where(eq(clientCreditRequests.id, requestId))
    .limit(1);
  const request = rows[0];
  if (!request) return { ok: false, error: "Demande introuvable." };
  if (normalizeCreditRequestStatus(request.status) !== "pending") {
    return { ok: false, error: "Cette demande a déjà été traitée." };
  }

  const now = new Date();
  await db
    .update(clientCreditRequests)
    .set({
      status: "rejected",
      adminNote: String(adminNote ?? "").trim().slice(0, 300) || null,
      reviewedAt: now,
      updatedAt: now,
    })
    .where(eq(clientCreditRequests.id, requestId));

  return { ok: true, message: `Demande refusée (${request.orderRef}) — le solde reste dû au client.` };
}
