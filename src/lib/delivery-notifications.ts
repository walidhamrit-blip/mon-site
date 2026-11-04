// Envoi des e-mails de livraison (lien au client, reçu de recette,
// notification interne). Aucun envoi ne fait échouer la livraison : les
// erreurs sont renvoyées à l'appelant, qui se contente de les journaliser.

import {
  buildDeliveryAcceptedEmail,
  buildDeliveryAcceptedNotification,
  buildDeliveryLinkEmail,
  type DeliveryEmailData,
} from "@/lib/delivery-emails";
import { mailLeadRecipient, mailReplyTo, sendEmail, type MailResult } from "@/lib/mailer";
import type { DeliveryRow } from "@/lib/deliveries";

export interface DeliveryMailContext {
  name: string;
  nameAr: string;
  url: string;
  email: string;
  phone: string;
  whatsapp: string;
}

/** Construit les données communes aux trois gabarits. */
export function deliveryEmailData(
  row: DeliveryRow,
  ctx: DeliveryMailContext,
  acceptUrl = "",
): DeliveryEmailData {
  return {
    ref: row.ref,
    clientName: row.clientName,
    projectTitle: row.projectTitle,
    amountUsd: row.amountUsd,
    acceptUrl,
    links: row.links,
    items: row.checklist,
    warrantyDays: row.warrantyDays,
    siteUrl: ctx.url.replace(/\/+$/, ""),
    siteName: ctx.name,
    siteNameAr: ctx.nameAr,
    supportEmail: ctx.email,
    supportWhatsapp: ctx.whatsapp,
    clientEmail: row.email,
    acceptedAt: row.acceptedAt ? new Date(row.acceptedAt) : null,
    acceptedByName: row.acceptedByName,
  };
}

/** Adresse qui reçoit les notifications internes (même règle que les demandes). */
function internalRecipient(ctx: DeliveryMailContext): string {
  return mailLeadRecipient(ctx.email);
}

/**
 * Envoie au client le lien de validation. Sans e-mail client, rien n'est
 * envoyé : l'admin copie alors le lien (WhatsApp).
 */
export async function sendDeliveryLinkEmail(
  row: DeliveryRow,
  ctx: DeliveryMailContext,
  acceptUrl: string,
): Promise<MailResult | null> {
  if (!row.email) return null;
  const content = buildDeliveryLinkEmail(deliveryEmailData(row, ctx, acceptUrl));
  return sendEmail({
    to: row.email,
    subject: content.subject,
    html: content.html,
    text: content.text,
    replyTo: mailReplyTo() ?? undefined,
  });
}

export interface DeliveryAcceptedOutcome {
  /** Reçu envoyé au client — null s'il n'a pas laissé d'e-mail. */
  receipt: MailResult | null;
  /** Notification interne (agence). */
  notification: MailResult;
}

/** Reçu au client + notification à l'agence, après validation de la recette. */
export async function sendDeliveryAcceptedEmails(
  row: DeliveryRow,
  ctx: DeliveryMailContext,
): Promise<DeliveryAcceptedOutcome> {
  const data = deliveryEmailData(row, ctx);
  const receiptContent = buildDeliveryAcceptedEmail(data);
  const noticeContent = buildDeliveryAcceptedNotification(data);
  const [receipt, notification] = await Promise.all([
    row.email
      ? sendEmail({
          to: row.email,
          subject: receiptContent.subject,
          html: receiptContent.html,
          text: receiptContent.text,
          replyTo: mailReplyTo() ?? undefined,
        })
      : Promise.resolve(null),
    sendEmail({
      to: internalRecipient(ctx),
      subject: noticeContent.subject,
      html: noticeContent.html,
      text: noticeContent.text,
      replyTo: row.email ?? undefined,
    }),
  ]);
  return { receipt, notification };
}
