// Dossiers de livraison des projets web — accès base de données (serveur).
//
// Une livraison suit la règle générale du site : on ne remet les clés qu'après
// paiement du solde, et la validation du client est horodatée. Le jeton de
// validation suit le même modèle que le suivi de commande : seule son
// empreinte SHA-256 est conservée (src/lib/order-tracking.ts).
//
// Démarche complète : docs/livraison-site-apres-paiement-2026-11-04.md

import { desc, eq } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { siteDeliveries, type SiteDelivery } from "@/db/schema";
import {
  createTrackingToken,
  maskEmail,
  newOrderReference,
  trackingAccess,
} from "@/lib/order-tracking";
import { decryptDeliveryToken, encryptDeliveryToken } from "@/lib/delivery-tokens";
import {
  DELIVERY_STATUSES,
  deliveryWarrantyEndsAt,
  sanitizeDeliveryChecklist,
  sanitizeDeliveryLinks,
  sanitizeWarrantyDays,
  type DeliveryItem,
  type DeliveryLink,
  type DeliveryStatus,
} from "@/lib/delivery-kit";

export interface NewDeliveryInput {
  clientName: string;
  email?: string | null;
  phone?: string | null;
  projectTitle: string;
  amountUsd?: string | null;
  links: unknown;
  checklist: unknown;
  warrantyDays?: unknown;
  locale?: string | null;
  notes?: string | null;
}

export interface CreatedDelivery {
  ref: string;
  token: string;
}

function text(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function optionalText(value: unknown, max: number): string | null {
  const cleaned = text(value, max);
  return cleaned || null;
}

/** Crée le dossier et renvoie la référence + le jeton (à transmettre une fois). */
export async function createDelivery(input: NewDeliveryInput): Promise<CreatedDelivery> {
  await ensureSchema();
  const { token, hash } = createTrackingToken();
  const ref = newOrderReference("LIV");
  const [row] = await db
    .insert(siteDeliveries)
    .values({
      ref,
      trackingTokenHash: hash,
      trackingTokenCipher: encryptDeliveryToken(token),
      clientName: text(input.clientName, 120) || "Client",
      email: optionalText(input.email, 200),
      phone: optionalText(input.phone, 40),
      projectTitle: text(input.projectTitle, 160) || "Site web",
      amountUsd: text(input.amountUsd, 20),
      links: sanitizeDeliveryLinks(input.links),
      checklist: sanitizeDeliveryChecklist(input.checklist),
      warrantyDays: sanitizeWarrantyDays(input.warrantyDays),
      locale: optionalText(input.locale, 8),
      notes: optionalText(input.notes, 2000),
      status: "delivered",
    })
    .returning({ ref: siteDeliveries.ref });
  return { ref: row?.ref ?? ref, token };
}

export interface DeliveryRow {
  id: number;
  ref: string;
  clientName: string;
  email: string | null;
  phone: string | null;
  projectTitle: string;
  amountUsd: string;
  links: DeliveryLink[];
  checklist: DeliveryItem[];
  warrantyDays: number;
  status: DeliveryStatus;
  createdAt: string;
  updatedAt: string;
  acceptedAt: string | null;
  acceptedByName: string | null;
  notes: string | null;
}

function toRow(row: SiteDelivery): DeliveryRow {
  const status = (DELIVERY_STATUSES as readonly string[]).includes(row.status)
    ? (row.status as DeliveryStatus)
    : "delivered";
  return {
    id: row.id,
    ref: row.ref,
    clientName: row.clientName,
    email: row.email,
    phone: row.phone,
    projectTitle: row.projectTitle,
    amountUsd: row.amountUsd,
    links: sanitizeDeliveryLinks(row.links),
    checklist: sanitizeDeliveryChecklist(row.checklist),
    warrantyDays: sanitizeWarrantyDays(row.warrantyDays),
    status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    acceptedAt: row.acceptedAt ? row.acceptedAt.toISOString() : null,
    acceptedByName: row.acceptedByName,
    notes: row.notes,
  };
}

/** Liste des livraisons, les plus récentes d'abord (tableau de bord admin). */
export async function listDeliveries(limit = 100): Promise<DeliveryRow[]> {
  await ensureSchema();
  const rows = await db
    .select()
    .from(siteDeliveries)
    .orderBy(desc(siteDeliveries.createdAt))
    .limit(Math.min(Math.max(limit, 1), 500));
  return rows.map(toRow);
}

export async function findDeliveryById(id: number): Promise<DeliveryRow | null> {
  await ensureSchema();
  const [row] = await db.select().from(siteDeliveries).where(eq(siteDeliveries.id, id)).limit(1);
  return row ? toRow(row) : null;
}

export async function findDeliveryByRef(ref: string): Promise<DeliveryRow | null> {
  await ensureSchema();
  const [row] = await db
    .select()
    .from(siteDeliveries)
    .where(eq(siteDeliveries.ref, ref.trim().toUpperCase()))
    .limit(1);
  return row ? toRow(row) : null;
}

export interface DeliveryView {
  ref: string;
  projectTitle: string;
  clientName: string;
  emailMasked: string | null;
  amountUsd: string;
  links: DeliveryLink[];
  checklist: DeliveryItem[];
  warrantyDays: number;
  status: DeliveryStatus;
  deliveredAt: string;
  acceptedAt: string | null;
  acceptedByName: string | null;
  warrantyEndsAt: string | null;
}

/**
 * Dossier tel qu'il est présenté au client : l'e-mail est masqué et rien
 * d'interne (notes) ne sort. `null` si la référence ou le jeton est invalide —
 * la page publique ne distingue jamais les deux cas.
 */
export async function findDeliveryForTracking(
  ref: string | null | undefined,
  token: string | null | undefined,
): Promise<DeliveryView | null> {
  const cleanRef = (ref ?? "").trim().toUpperCase();
  if (!cleanRef) return null;
  const row = await findDeliveryByRef(cleanRef);
  if (!row) return null;
  const [raw] = await db
    .select({ hash: siteDeliveries.trackingTokenHash })
    .from(siteDeliveries)
    .where(eq(siteDeliveries.ref, cleanRef))
    .limit(1);
  if (trackingAccess(raw?.hash, token) !== "granted") return null;
  const deliveredAt = new Date(row.createdAt);
  const endsAt = deliveryWarrantyEndsAt(deliveredAt, row.warrantyDays);
  return {
    ref: row.ref,
    projectTitle: row.projectTitle,
    clientName: row.clientName,
    emailMasked: maskEmail(row.email),
    amountUsd: row.amountUsd,
    links: row.links,
    checklist: row.checklist,
    warrantyDays: row.warrantyDays,
    status: row.status,
    deliveredAt: row.createdAt,
    acceptedAt: row.acceptedAt,
    acceptedByName: row.acceptedByName,
    warrantyEndsAt: endsAt.toISOString(),
  };
}

/**
 * Jeton en clair d'un dossier, relu depuis sa forme chiffrée — sert à
 * renvoyer le lien de validation. `null` s'il n'est pas récupérable.
 */
export async function deliveryTokenForRef(ref: string): Promise<string | null> {
  const cleanRef = (ref ?? "").trim().toUpperCase();
  if (!cleanRef) return null;
  await ensureSchema();
  const [row] = await db
    .select({ cipher: siteDeliveries.trackingTokenCipher })
    .from(siteDeliveries)
    .where(eq(siteDeliveries.ref, cleanRef))
    .limit(1);
  return decryptDeliveryToken(row?.cipher);
}

export type AcceptDeliveryCode =
  | "not_found"
  | "forbidden"
  | "invalid_name"
  | "accepted"
  | "already_accepted"
  | "error";

export interface AcceptDeliveryResult {
  ok: boolean;
  code: AcceptDeliveryCode;
  status: number;
  /** Vrai si la recette était déjà validée (aucun e-mail à renvoyer). */
  alreadyAccepted?: boolean;
  acceptedAt?: string | null;
  acceptedByName?: string | null;
  view?: DeliveryView;
}

/**
 * Valide la recette : horodate l'acceptation et mémorise le nom du signataire.
 * Idempotent — un second appel avec le même jeton ne renvoie pas d'erreur.
 */
export async function acceptDelivery(
  ref: string | null | undefined,
  token: string | null | undefined,
  acceptedBy: string | null | undefined,
): Promise<AcceptDeliveryResult> {
  const cleanRef = (ref ?? "").trim().toUpperCase();
  if (!cleanRef) {
    return { ok: false, code: "not_found", status: 404 };
  }
  const name = (acceptedBy ?? "").trim().slice(0, 120);
  if (!name) {
    return { ok: false, code: "invalid_name", status: 400 };
  }
  await ensureSchema();
  const [row] = await db
    .select()
    .from(siteDeliveries)
    .where(eq(siteDeliveries.ref, cleanRef))
    .limit(1);
  if (!row) return { ok: false, code: "not_found", status: 404 };
  if (trackingAccess(row.trackingTokenHash, token) !== "granted") {
    return { ok: false, code: "forbidden", status: 403 };
  }
  if (row.status === "accepted") {
    return {
      ok: true,
      code: "already_accepted",
      status: 200,
      alreadyAccepted: true,
      acceptedAt: row.acceptedAt ? row.acceptedAt.toISOString() : null,
      acceptedByName: row.acceptedByName,
    };
  }
  const [updated] = await db
    .update(siteDeliveries)
    .set({
      status: "accepted",
      acceptedAt: new Date(),
      acceptedByName: name,
      updatedAt: new Date(),
    })
    .where(eq(siteDeliveries.ref, cleanRef))
    .returning({ acceptedAt: siteDeliveries.acceptedAt });
  const acceptedAt = updated?.acceptedAt ? updated.acceptedAt.toISOString() : new Date().toISOString();
  return {
    ok: true,
    code: "accepted",
    status: 200,
    alreadyAccepted: false,
    acceptedAt,
    acceptedByName: name,
  };
}

/** Supprime un dossier (admin). Erreur propagée : l'appelant la journalise. */
export async function deleteDelivery(id: number): Promise<void> {
  await ensureSchema();
  await db.delete(siteDeliveries).where(eq(siteDeliveries.id, id));
}
