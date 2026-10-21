// Gabarits des relances d'abonnement (module pur, sans I/O).
// Les e-mails ne contiennent AUCUN jeton de suivi : nous ne conservons que
// son empreinte. Le client retrouve la facture de renouvellement dans le
// message de NOWPayments, et le lien de réabonnement pointe vers /abonnements.

import type { SubscriptionNotice } from "@/lib/subscription-lifecycle";

export interface NoticeData {
  ref: string;
  planName: string;
  /** Fin de la période payée (échéance). */
  endsAt: Date;
  /** Dernier jour d'accès, grâce comprise. */
  accessEndsAt: Date;
  graceDays: number;
  subscribeUrl: string;
  siteName: string;
}

export interface NoticeEmail {
  subject: string;
  text: string;
  html: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function dateFr(value: Date): string {
  return value.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Africa/Tripoli",
  });
}

interface Copy {
  subject: string;
  fr: string[];
  ar: string[];
}

function copyFor(kind: SubscriptionNotice, d: NoticeData): Copy {
  const end = dateFr(d.endsAt);
  const access = dateFr(d.accessEndsAt);
  switch (kind) {
    case "reminder":
      return {
        subject: `Votre abonnement ${d.planName} arrive à échéance le ${end}`,
        fr: [
          `Bonjour, votre abonnement ${d.planName} (réf. ${d.ref}) arrive à échéance le ${end}.`,
          "NOWPayments vous enverra la facture de renouvellement par e-mail : réglez-la avant cette date pour éviter toute interruption.",
        ],
        ar: [
          `مرحباً، ينتهي اشتراكك ${d.planName} (المرجع ${d.ref}) في ${end}.`,
          "ستصلك فاتورة التجديد من NOWPayments عبر البريد الإلكتروني، يرجى سدادها قبل هذا التاريخ.",
        ],
      };
    case "overdue":
      return {
        subject: `Paiement en retard — ${d.planName}`,
        fr: [
          `Le paiement de votre abonnement ${d.planName} (réf. ${d.ref}) n'a pas été reçu avant le ${end}.`,
          `Votre accès est maintenu jusqu'au ${access} (${d.graceDays} jours de grâce). Réglez la facture NOWPayments reçue par e-mail.`,
        ],
        ar: [
          `لم نستلم دفعة اشتراكك ${d.planName} (المرجع ${d.ref}) قبل ${end}.`,
          `يبقى وصولك مفعّلاً حتى ${access} (${d.graceDays} أيام سماح). يرجى سداد فاتورة NOWPayments المرسلة إلى بريدك.`,
        ],
      };
    case "expired":
      return {
        subject: `Abonnement suspendu — ${d.planName}`,
        fr: [
          `Votre abonnement ${d.planName} (réf. ${d.ref}) est suspendu faute de paiement.`,
          `Vous pouvez vous réabonner à tout moment : ${d.subscribeUrl}`,
        ],
        ar: [
          `تم إيقاف اشتراكك ${d.planName} (المرجع ${d.ref}) لعدم السداد.`,
          `يمكنك الاشتراك من جديد في أي وقت: ${d.subscribeUrl}`,
        ],
      };
  }
}

export function buildNoticeEmail(
  kind: SubscriptionNotice,
  data: NoticeData,
): NoticeEmail {
  const copy = copyFor(kind, data);
  const footer = `${data.siteName} — ${data.subscribeUrl}`;
  const text = [...copy.fr, "", ...copy.ar, "", footer].join("\n");
  const html = [
    `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#1c1917">`,
    ...copy.fr.map((line) => `<p>${escapeHtml(line)}</p>`),
    `<p dir="rtl" style="font-family:Tahoma,Arial,sans-serif">${copy.ar.map((line) => escapeHtml(line)).join("<br>")}</p>`,
    `<p style="color:#78716c;font-size:12px">${escapeHtml(footer)}</p>`,
    `</div>`,
  ].join("");
  return { subject: copy.subject, text, html };
}
