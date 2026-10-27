// E-mails de la boutique digitale (codes / cartes cadeaux).
//
//   • au CLIENT : les codes livrés (numéro de carte + PIN + lien
//     d'activation) et le lien de suivi protégé ;
//   • à l'AGENCE : alerte « paiement reçu, livraison manuelle requise »
//     quand l'achat automatique n'a pas pu se faire.
//
// L'envoi est « au mieux » : un échec SMTP ne change jamais le statut de
// la commande (les codes restent consultables dans l'admin et sur la page
// de suivi).

import { sendEmail } from "@/lib/mailer";
import { escapeHtml } from "@/lib/emails";
import type { DigitalOrder } from "@/db/schema";
import type { GiftCardCode } from "@/lib/reloadly";

export interface DigitalEmailResult {
  ok: boolean;
  provider: string;
  error?: string;
}

function emailAddressFrom(value: string | undefined): string {
  return value?.match(/[^\s<>]+@[^\s<>]+/)?.[0]?.trim() ?? "";
}

function adminRecipient(siteEmail?: string): string {
  return (
    emailAddressFrom(process.env.LEAD_NOTIFICATION_EMAIL) ||
    emailAddressFrom(siteEmail) ||
    emailAddressFrom(process.env.EMAIL_FROM) ||
    ""
  );
}

function decimal(value: string): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : value;
}

function siteLink(siteUrl: string, path: string): string {
  return `${siteUrl.replace(/\/+$/, "")}${path}`;
}

/**
 * Envoie les codes au client. Le lien de suivi contient la référence et
 * le jeton — il permet de retrouver les codes sans dépendre de l'e-mail
 * (utile quand la livraison est consultée depuis un autre appareil).
 */
export async function sendDigitalCodesEmail(
  order: DigitalOrder,
  codes: GiftCardCode[],
  siteName: string,
  siteUrl: string,
  siteEmail?: string,
): Promise<DigitalEmailResult> {
  const to = emailAddressFrom(order.recipientEmail);
  if (!to) return { ok: false, provider: "none", error: "destinataire absent" };
  if (codes.length === 0) return { ok: false, provider: "none", error: "aucun code" };

  const support = emailAddressFrom(siteEmail) || emailAddressFrom(process.env.EMAIL_FROM);
  const subject = `🎁 Vos codes ${order.productTitle} — ${order.ref}`;

  const codeLines = codes.map((code, index) => {
    const parts = [
      codes.length > 1 ? `Code ${index + 1}` : "Code",
      `Numéro : ${code.cardNumber}`,
      ...(code.pinCode ? [`PIN : ${code.pinCode}`] : []),
      ...(code.redemptionUrl ? [`Activation : ${code.redemptionUrl}`] : []),
    ];
    return parts.join("\n");
  });

  const text = [
    `Merci pour votre commande chez ${siteName} !`,
    ``,
    `Produit : ${order.productTitle} — ${order.denominationLabel}`,
    `Quantité : ${order.quantity}`,
    `Montant réglé : ${decimal(order.totalUsd)} USD`,
    `Commande : ${order.ref}`,
    ``,
    `Vos codes :`,
    ...codeLines.flatMap((block) => [``, block]),
    ``,
    `Région du code : ${order.region.toUpperCase()} — un code n'est valable que dans la région indiquée.`,
    order.region.toLowerCase() === "global"
      ? `Ce code est valable partout dans le monde.`
      : `N'essayez pas de l'activer avec un compte d'une autre région : le code serait refusé.`,
    ``,
    support ? `Une question ? Répondez à cet e-mail ou écrivez à ${support}.` : "",
    `${siteName} — ${siteUrl}`,
  ]
    .filter((line) => line !== "")
    .join("\n");

  const codeCards = codes
    .map(
      (code, index) => `
      <div style="border:1px solid #e7e1d3;border-radius:14px;background:#faf8f3;padding:14px 16px;margin:10px 0">
        ${codes.length > 1 ? `<div style="font-size:11px;letter-spacing:.12em;color:#8A6D2F;font-weight:700">CODE ${index + 1}</div>` : ""}
        <div style="font-size:12px;color:#666;margin-top:${codes.length > 1 ? "6px" : "0"}">Numéro de carte</div>
        <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:17px;font-weight:700;letter-spacing:.06em;word-break:break-all">${escapeHtml(code.cardNumber)}</div>
        ${
          code.pinCode
            ? `<div style="font-size:12px;color:#666;margin-top:10px">PIN</div>
               <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:16px;font-weight:700;letter-spacing:.08em">${escapeHtml(code.pinCode)}</div>`
            : ""
        }
        ${
          code.redemptionUrl
            ? `<div style="margin-top:12px"><a href="${escapeHtml(code.redemptionUrl)}" style="color:#8A6D2F;font-weight:700;text-decoration:none">Activer le code →</a></div>`
            : ""
        }
      </div>`,
    )
    .join("");

  const html = `
    <div style="font-family:system-ui,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1e">
      <div style="font-size:13px;letter-spacing:.12em;color:#C6A664;font-weight:700">${escapeHtml(siteName.toUpperCase())} — BOUTIQUE DIGITALE</div>
      <h1 style="font-size:22px;font-weight:900;margin:8px 0 4px">Vos codes sont prêts 🎁</h1>
      <p style="color:#666;font-size:14px;margin:0 0 18px">
        ${escapeHtml(order.productTitle)} — ${escapeHtml(order.denominationLabel)}${order.quantity > 1 ? ` × ${order.quantity}` : ""}
      </p>
      ${codeCards}
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:16px">
        <tr><td style="padding:6px 10px;background:#f6f3ec;font-weight:700;width:130px">Commande</td><td style="padding:6px 10px">${escapeHtml(order.ref)}</td></tr>
        <tr><td style="padding:6px 10px;background:#f6f3ec;font-weight:700">Montant</td><td style="padding:6px 10px">${escapeHtml(decimal(order.totalUsd))} USD</td></tr>
        <tr><td style="padding:6px 10px;background:#f6f3ec;font-weight:700">Région</td><td style="padding:6px 10px">${escapeHtml(order.region.toUpperCase())}${order.region.toLowerCase() === "global" ? " (valable partout)" : " — compte de cette région uniquement"}</td></tr>
      </table>
      <p style="color:#666;font-size:13px;margin-top:16px">
        Conservez cet e-mail : le code n'est affiché qu'un nombre limité de fois.
        Vous pouvez aussi le retrouver ici : <a href="${escapeHtml(siteLink(siteUrl, "/codes/commande"))}" style="color:#8A6D2F;font-weight:700">suivi de commande</a>
        (référence + lien reçus sur la page de paiement).
      </p>
      ${support ? `<p style="color:#666;font-size:13px">Une question ? Écrivez à <a href="mailto:${escapeHtml(support)}" style="color:#8A6D2F">${escapeHtml(support)}</a>.</p>` : ""}
      <p style="color:#999;font-size:12px;margin-top:24px">${escapeHtml(siteName)} — ${escapeHtml(siteUrl)}</p>
    </div>`;

  const result = await sendEmail({ to, subject, text, html });
  return { ok: result.ok, provider: result.provider, error: result.error };
}

/** Alerte interne : la commande est payée mais doit être livrée à la main. */
export async function sendDigitalManualNotice(
  order: DigitalOrder,
  reason: string,
  siteName: string,
  siteUrl: string,
  siteEmail?: string,
): Promise<DigitalEmailResult> {
  const to = adminRecipient(siteEmail);
  if (!to) return { ok: false, provider: "none", error: "destinataire absent" };

  const adminUrl = siteLink(siteUrl, "/admin/digital/orders");
  const subject = `⚠️ Livraison manuelle requise — ${order.ref} (${order.productTitle})`;

  const text = [
    `Une commande de code a été payée mais n'a pas pu être livrée automatiquement.`,
    ``,
    `Commande : ${order.ref}`,
    `Produit : ${order.productTitle} — ${order.denominationLabel} × ${order.quantity}`,
    `Montant : ${decimal(order.totalUsd)} USD`,
    `Client : ${order.recipientName || "—"} <${order.recipientEmail}>`,
    `Téléphone : ${order.recipientPhone || "—"}`,
    `Région : ${order.region.toUpperCase()}`,
    `Mode : ${order.fulfillment === "auto" ? "automatique (Reloadly)" : "manuel"}`,
    order.reloadlyTransactionId
      ? `Transaction Reloadly : ${order.reloadlyTransactionId} (${order.reloadlyStatus ?? "?"})`
      : `Transaction Reloadly : aucune`,
    ``,
    `Motif : ${reason}`,
    ``,
    `À faire : acheter le code dans le tableau Reloadly, puis le transmettre au client (e-mail / WhatsApp).`,
    `Admin : ${adminUrl}`,
  ].join("\n");

  const html = `
    <div style="font-family:system-ui,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1e">
      <div style="font-size:13px;letter-spacing:.12em;color:#C6A664;font-weight:700">${escapeHtml(siteName.toUpperCase())} — BOUTIQUE DIGITALE</div>
      <h1 style="font-size:21px;font-weight:900;margin:8px 0 4px">Livraison manuelle requise ⚠️</h1>
      <p style="color:#666;font-size:14px;margin:0 0 16px">Le paiement est confirmé, mais le code doit être acheté et transmis à la main.</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <tr><td style="padding:7px 11px;background:#f6f3ec;font-weight:700;width:140px">Commande</td><td style="padding:7px 11px">${escapeHtml(order.ref)}</td></tr>
        <tr><td style="padding:7px 11px;background:#f6f3ec;font-weight:700">Produit</td><td style="padding:7px 11px">${escapeHtml(order.productTitle)} — ${escapeHtml(order.denominationLabel)} × ${order.quantity}</td></tr>
        <tr><td style="padding:7px 11px;background:#f6f3ec;font-weight:700">Montant</td><td style="padding:7px 11px">${escapeHtml(decimal(order.totalUsd))} USD</td></tr>
        <tr><td style="padding:7px 11px;background:#f6f3ec;font-weight:700">Client</td><td style="padding:7px 11px">${escapeHtml(order.recipientName || "—")} &lt;${escapeHtml(order.recipientEmail)}&gt;</td></tr>
        <tr><td style="padding:7px 11px;background:#f6f3ec;font-weight:700">Téléphone</td><td style="padding:7px 11px">${escapeHtml(order.recipientPhone || "—")}</td></tr>
        <tr><td style="padding:7px 11px;background:#f6f3ec;font-weight:700">Région</td><td style="padding:7px 11px">${escapeHtml(order.region.toUpperCase())}</td></tr>
        <tr><td style="padding:7px 11px;background:#f6f3ec;font-weight:700">Transaction</td><td style="padding:7px 11px">${escapeHtml(order.reloadlyTransactionId ?? "aucune")}${order.reloadlyStatus ? ` (${escapeHtml(order.reloadlyStatus)})` : ""}</td></tr>
      </table>
      <p style="font-size:14px;background:#fff6e5;border:1px solid #f0d9a8;border-radius:12px;padding:12px 14px;margin:18px 0">
        <strong>Motif :</strong> ${escapeHtml(reason)}
      </p>
      <p style="margin:22px 0 0">
        <a href="${escapeHtml(adminUrl)}" style="display:inline-block;background:#C6A664;color:#111;font-weight:700;padding:12px 22px;border-radius:999px;text-decoration:none">Ouvrir les commandes digitales</a>
      </p>
    </div>`;

  const result = await sendEmail({ to, subject, text, html });
  return { ok: result.ok, provider: result.provider, error: result.error };
}

/**
 * E-mail au CLIENT pour une RECHARGE de jeu livrée.
 *
 * Une recharge (`game_topup`) ne produit aucun code : le fournisseur crédite
 * directement le compte du joueur. Il n'y a donc rien à « envoyer » au client,
 * mais il doit recevoir une confirmation — sinon il croit que la commande est
 * bloquée. Les identifiants saisis à la caisse (player_id…) sont rappelés :
 * c'est ce qui lui permet de vérifier que le crédit est parti sur le bon
 * compte.
 */
export async function sendDigitalTopupDeliveredEmail(
  order: DigitalOrder,
  siteName: string,
  siteUrl: string,
  siteEmail?: string,
): Promise<DigitalEmailResult> {
  const to = emailAddressFrom(order.recipientEmail);
  if (!to) return { ok: false, provider: "none", error: "destinataire absent" };

  const support = emailAddressFrom(siteEmail) || emailAddressFrom(process.env.EMAIL_FROM);
  const subject = `✅ Recharge créditée ${order.productTitle} — ${order.ref}`;

  // Champs acheteur mémorisés à la caisse (player_id, server_id, account_id…).
  const buyerFields = readBuyerFields(order);
  const fieldLines = buyerFields.map(([key, value]) => `${key} : ${value}`);
  const fieldRows = buyerFields
    .map(
      ([key, value]) =>
        `<tr><td style="padding:6px 10px;background:#f6f3ec;font-weight:700;width:150px">${escapeHtml(key)}</td><td style="padding:6px 10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace">${escapeHtml(value)}</td></tr>`,
    )
    .join("");

  const text = [
    `Merci pour votre commande chez ${siteName} !`,
    ``,
    `Votre recharge a été créditée sur votre compte de jeu.`,
    ``,
    `Produit : ${order.productTitle} — ${order.denominationLabel}`,
    `Quantité : ${order.quantity}`,
    `Montant réglé : ${decimal(order.totalUsd)} USD`,
    `Commande : ${order.ref}`,
    ``,
    ...(fieldLines.length > 0
      ? [`Compte crédité :`, ...fieldLines.map((line) => `  ${line}`), ``]
      : []),
    `Il n'y a aucun code à saisir : le crédit est appliqué directement au compte indiqué ci-dessus.`,
    `Si votre solde en jeu n'a pas changé d'ici quelques minutes, répondez à cet e-mail avec la référence de commande.`,
    ``,
    support ? `Une question ? Écrivez à ${support}.` : "",
    `${siteName} — ${siteUrl}`,
  ]
    .filter((line) => line !== "")
    .join("\n");

  const html = `
    <div style="font-family:system-ui,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1e">
      <div style="font-size:13px;letter-spacing:.12em;color:#C6A664;font-weight:700">${escapeHtml(siteName.toUpperCase())} — BOUTIQUE DIGITALE</div>
      <h1 style="font-size:22px;font-weight:900;margin:8px 0 4px">Votre recharge est créditée ✅</h1>
      <p style="color:#666;font-size:14px;margin:0 0 18px">
        ${escapeHtml(order.productTitle)} — ${escapeHtml(order.denominationLabel)}${order.quantity > 1 ? ` × ${order.quantity}` : ""}
      </p>
      <div style="border:1px solid #e7e1d3;border-radius:14px;background:#faf8f3;padding:14px 16px;margin:10px 0;font-size:14px">
        Aucun code n'est nécessaire : le crédit a été appliqué directement au compte de jeu indiqué ci-dessous.
      </div>
      ${
        fieldRows
          ? `<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:12px">
              <tr><td colspan="2" style="padding:6px 10px;font-weight:900;font-size:12px;letter-spacing:.08em;color:#8A6D2F">COMPTE CRÉDITÉ</td></tr>
              ${fieldRows}
            </table>`
          : ""
      }
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:16px">
        <tr><td style="padding:6px 10px;background:#f6f3ec;font-weight:700;width:150px">Commande</td><td style="padding:6px 10px">${escapeHtml(order.ref)}</td></tr>
        <tr><td style="padding:6px 10px;background:#f6f3ec;font-weight:700">Montant</td><td style="padding:6px 10px">${escapeHtml(decimal(order.totalUsd))} USD</td></tr>
      </table>
      <p style="color:#666;font-size:13px;margin-top:16px">
        Si votre solde en jeu n'a pas changé d'ici quelques minutes, répondez à cet e-mail avec la référence de commande : nous vérifions le crédit chez le fournisseur.
        Suivi : <a href="${escapeHtml(siteLink(siteUrl, "/codes/commande"))}" style="color:#8A6D2F;font-weight:700">suivi de commande</a>.
      </p>
      ${support ? `<p style="color:#666;font-size:13px">Une question ? Écrivez à <a href="mailto:${escapeHtml(support)}" style="color:#8A6D2F">${escapeHtml(support)}</a>.</p>` : ""}
      <p style="color:#999;font-size:12px;margin-top:24px">${escapeHtml(siteName)} — ${escapeHtml(siteUrl)}</p>
    </div>`;

  const result = await sendEmail({ to, subject, text, html });
  return { ok: result.ok, provider: result.provider, error: result.error };
}

/** Champs acheteur mémorisés sur la commande (player_id, server_id…). */
function readBuyerFields(order: DigitalOrder): [string, string][] {
  const payload = order.reloadlyResponse;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  const fields = (payload as Record<string, unknown>).buyerFields;
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) return [];
  return Object.entries(fields as Record<string, unknown>)
    .filter(([, value]) => value != null && String(value).trim() !== "")
    .map(([key, value]) => [key, String(value)]);
}
