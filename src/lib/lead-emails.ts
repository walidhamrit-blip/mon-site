// Envoi des e-mails liés à une demande (formulaire public).
//
// Deux messages sont envoyés en parallèle :
//   1. la notification à l'agence (pour ne rien laisser passer),
//   2. l'accusé de réception envoyé au client s'il a laissé un e-mail.
//
// Aucun envoi ne fait échouer la demande : les erreurs sont renvoyées à
// l'appelant, qui se contente de les journaliser.

import {
  buildLeadNotification,
  buildLeadReceipt,
  type LeadEmailData,
  type SiteEmailContext,
} from "@/lib/emails";
import { sendEmail, type MailResult } from "@/lib/mailer";

export interface LeadEmailOutcome {
  /** Notification adressée à l'agence. */
  notification: MailResult;
  /** Accusé de réception client — null si le client n'a pas laissé d'e-mail. */
  receipt: MailResult | null;
}

/** Adresse qui reçoit les notifications de demandes. */
export function notificationRecipient(ctx: SiteEmailContext): string {
  const explicit = process.env.LEAD_NOTIFICATION_EMAIL?.trim();
  return explicit || ctx.email;
}

/** Construit le contexte du site (coordonnées) à partir de la configuration. */
export function leadEmailContext(config: {
  name: string;
  nameAr: string;
  url: string;
  email: string;
  phone: string;
  whatsapp: string;
  address: string;
  addressEn: string;
  hours: string;
  hoursEn: string;
}): SiteEmailContext {
  return {
    siteName: config.name,
    siteNameAr: config.nameAr,
    siteUrl: config.url.replace(/\/+$/, ""),
    email: config.email,
    phone: config.phone,
    whatsapp: config.whatsapp,
    address: config.address,
    addressEn: config.addressEn,
    hours: config.hours,
    hoursEn: config.hoursEn,
  };
}

/** Envoie la notification à l'agence et l'accusé de réception au client. */
export async function sendLeadEmails(
  data: LeadEmailData,
  ctx: SiteEmailContext,
): Promise<LeadEmailOutcome> {
  const notification = buildLeadNotification(data, ctx);
  const receipt = data.email ? buildLeadReceipt(data, ctx) : null;

  const [notificationResult, receiptResult] = await Promise.all([
    sendEmail({
      to: notificationRecipient(ctx),
      subject: notification.subject,
      html: notification.html,
      text: notification.text,
      // Répondre à l'e-mail de l'agence écrit directement au client.
      replyTo: data.email ?? undefined,
    }),
    receipt
      ? sendEmail({
          to: data.email as string,
          subject: receipt.subject,
          html: receipt.html,
          text: receipt.text,
        })
      : Promise.resolve(null),
  ]);

  return { notification: notificationResult, receipt: receiptResult };
}
