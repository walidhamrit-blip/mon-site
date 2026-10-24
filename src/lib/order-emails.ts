// Notification e-mail envoyée à l'agence lorsqu'un paiement
// crypto est confirmé (IPN NOWPayments). L'envoi est « au mieux »
// : un échec de messagerie ne change jamais le statut de la
// commande, déjà enregistré en base.

import { sendEmail } from "@/lib/mailer";
import { escapeHtml } from "@/lib/emails";
import { ORDER_STATUS_LABELS } from "@/lib/nowpayments";
import { ORDER_KIND_LABELS } from "@/lib/site-types";
import type { Order } from "@/db/schema";

function frDate(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  try {
    return d.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Africa/Tripoli",
    });
  } catch {
    return d.toLocaleString("fr-FR");
  }
}

/** Extrait une adresse d'une valeur simple ou `Nom <adresse>`. */
function emailAddressFrom(value: string | undefined): string {
  return value?.match(/[^\s<>]+@[^\s<>]+/)?.[0]?.trim() ?? "";
}

/**
 * Destinataire des notifications de paiement.
 * Priorité : variable dédiée → e-mail public du site → expéditeur.
 * Le repli sur l'e-mail du site évite de perdre silencieusement les
 * notifications quand seule la messagerie sortante est configurée.
 */
function paymentNotificationRecipient(siteEmail?: string): string {
  return (
    emailAddressFrom(process.env.LEAD_NOTIFICATION_EMAIL) ||
    emailAddressFrom(siteEmail) ||
    emailAddressFrom(process.env.EMAIL_FROM) ||
    ""
  );
}

export interface PaymentEmailResult {
  ok: boolean;
  provider: string;
  error?: string;
}

/** Envoie la notification « paiement confirmé » à l'agence. */
export async function sendPaymentConfirmedEmail(
  order: Order,
  siteName: string,
  siteUrl: string,
  siteEmail?: string,
): Promise<PaymentEmailResult> {
  const to = paymentNotificationRecipient(siteEmail);
  if (!to) {
    return { ok: false, provider: "none", error: "destinataire absent" };
  }

  const adminUrl = `${siteUrl.replace(/\/+$/, "")}/admin/orders`;
  const payInfo = order.payCurrency
    ? `${order.payAmount ?? "?"} ${order.payCurrency.toUpperCase()} vers ${order.payAddress ?? "—"}`
    : "—";

  const trancheInfo =
    order.installments > 1
      ? `Tranche ${order.installmentIndex}/${order.installments} — plan ${order.groupRef ?? order.ref}`
      : null;

  const isReservation = order.kind === "reservation";
  const kindLabel = isReservation
    ? ORDER_KIND_LABELS.reservation
    : order.kind === "flex"
      ? ORDER_KIND_LABELS.flex
      : ORDER_KIND_LABELS.plan;

  const subject = `✓ ${
    isReservation
      ? "Réservation prioritaire confirmée"
      : order.kind === "flex"
        ? "Paiement flexible confirmé"
        : "Paiement crypto confirmé"
  } — ${order.ref} (${order.planName}${trancheInfo ? ` — ${trancheInfo}` : ""})`;

  const text = [
    isReservation
      ? `Réservation prioritaire confirmée via NOWPayments (acompte)`
      : order.kind === "flex"
        ? `Paiement flexible confirmé via NOWPayments (montant libre)`
        : `Paiement confirmé via NOWPayments`,
    ``,
    `Commande : ${order.ref}`,
    `Type : ${kindLabel}${isReservation ? " — acompte prioritaire" : ""}`,
    ...(order.demoSlug ? [`Site : /demos/${order.demoSlug}`] : []),
    `Boutique : ${order.planName}`,
    `Montant : ${order.amountUsd} ${order.currency.toUpperCase()} (= USDT)`,
    ...(trancheInfo ? [`Tranche : ${trancheInfo}`] : []),
    `Client : ${order.clientName || "—"} <${order.email || "—"}>`,
    `Téléphone : ${order.phone || "—"}`,
    `Crypto : ${payInfo}`,
    `Date : ${frDate(order.createdAt)}`,
    ``,
    `Suivi : ${adminUrl}`,
  ].join("\n");

  const html = `
    <div style="font-family:system-ui,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1e">
      <div style="font-size:13px;letter-spacing:.12em;color:#C6A664;font-weight:700">${escapeHtml(siteName.toUpperCase())} — PAIEMENT CRYPTO</div>
      <h1 style="font-size:22px;font-weight:900;margin:8px 0 4px">${
        isReservation ? "Réservation prioritaire confirmée ✓" : "Paiement confirmé ✓"
      }</h1>
      <p style="color:#666;font-size:14px;margin:0 0 20px">${
        isReservation
          ? "Le client a réglé l'acompte de réservation en cryptomonnaie. Il prend une place en avance dans le planning."
          : "Le client a réglé sa commande en cryptomonnaie."
      }</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px" cellpadding="0" cellspacing="0">
        <tr><td style="padding:8px 12px;background:#f6f3ec;font-weight:700;width:140px">Commande</td><td style="padding:8px 12px;border-bottom:1px solid #eee">${escapeHtml(order.ref)}</td></tr>
        <tr><td style="padding:8px 12px;background:#f6f3ec;font-weight:700">Type</td><td style="padding:8px 12px;border-bottom:1px solid #eee">${escapeHtml(kindLabel)}${isReservation ? " — acompte prioritaire" : ""}</td></tr>
        ${
          order.demoSlug
            ? `<tr><td style="padding:8px 12px;background:#f6f3ec;font-weight:700">Site</td><td style="padding:8px 12px;border-bottom:1px solid #eee">/demos/${escapeHtml(order.demoSlug)}</td></tr>`
            : ""
        }
        <tr><td style="padding:8px 12px;background:#f6f3ec;font-weight:700">Boutique</td><td style="padding:8px 12px;border-bottom:1px solid #eee">${escapeHtml(order.planName)}</td></tr>
        <tr><td style="padding:8px 12px;background:#f6f3ec;font-weight:700">Montant</td><td style="padding:8px 12px;border-bottom:1px solid #eee"><strong>${escapeHtml(order.amountUsd)} ${escapeHtml(order.currency.toUpperCase())}</strong> (= USDT)</td></tr>
        ${trancheInfo ? `<tr><td style="padding:8px 12px;background:#f6f3ec;font-weight:700">Tranche</td><td style="padding:8px 12px;border-bottom:1px solid #eee">${escapeHtml(trancheInfo)}</td></tr>` : ""}
        <tr><td style="padding:8px 12px;background:#f6f3ec;font-weight:700">Client</td><td style="padding:8px 12px;border-bottom:1px solid #eee">${escapeHtml(order.clientName || "—")} &lt;${escapeHtml(order.email || "—")}&gt;</td></tr>
        <tr><td style="padding:8px 12px;background:#f6f3ec;font-weight:700">Téléphone</td><td style="padding:8px 12px;border-bottom:1px solid #eee">${escapeHtml(order.phone || "—")}</td></tr>
        <tr><td style="padding:8px 12px;background:#f6f3ec;font-weight:700">Crypto</td><td style="padding:8px 12px;border-bottom:1px solid #eee">${escapeHtml(payInfo)}</td></tr>
        <tr><td style="padding:8px 12px;background:#f6f3ec;font-weight:700">Date</td><td style="padding:8px 12px">${escapeHtml(frDate(order.createdAt))}</td></tr>
      </table>
      <p style="margin:24px 0 0">
        <a href="${escapeHtml(adminUrl)}" style="display:inline-block;background:#C6A664;color:#111;font-weight:700;padding:12px 22px;border-radius:999px;text-decoration:none">Voir la commande dans l'admin</a>
      </p>
      <p style="color:#999;font-size:12px;margin-top:20px">Statut : ${escapeHtml(ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS] ?? order.status)} — envoyé automatiquement par le site.</p>
    </div>`;

  const result = await sendEmail({ to, subject, text, html });
  return { ok: result.ok, provider: result.provider, error: result.error };
}
