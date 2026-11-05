/**
 * Gabarits des e-mails de livraison d'un projet web — module PUR (sans I/O).
 *
 * Trois messages :
 *   1. le lien de livraison envoyé au client (il consulte et valide) ;
 *   2. le reçu de recette, envoyé après validation (horodaté) ;
 *   3. la notification à l'agence (français, comme les autres notifications).
 *
 * Les e-mails client sont bilingues arabe / anglais : le client lit la version
 * de sa langue sans renvoyer un message pour demander une traduction.
 *
 * ⚠️ Aucun mot de passe n'est jamais écrit dans ces e-mails : ils sont
 * archivés, transférés, et parfois imprimés. Voir
 * docs/livraison-site-apres-paiement-2026-11-04.md §6.
 */

export interface DeliveryEmailData {
  ref: string;
  clientName: string;
  projectTitle: string;
  /** Montant encaissé, déjà formaté ('' si non renseigné). */
  amountUsd: string;
  /** URL publique de validation (`/livraison/<ref>?t=<jeton>`). */
  acceptUrl: string;
  links: { label: string; url: string }[];
  items: { label: string }[];
  warrantyDays: number;
  siteUrl: string;
  siteName: string;
  siteNameAr: string;
  supportEmail: string;
  supportWhatsapp: string;
  /** E-mail du client — affiché uniquement dans la notification interne. */
  clientEmail?: string | null;
  /**
   * Bloc de demande d'avis (bilingue, voir `src/lib/review-emails.ts`).
   * Absent tant que l'envoi n'est pas activé dans /admin : le reçu reste
   * alors identique à ce qu'il était.
   */
  review?: { html: string; text: string[] } | null;
  /** Renseigné uniquement pour le reçu de recette. */
  acceptedAt?: Date | null;
  acceptedByName?: string | null;
}

export interface DeliveryEmailContent {
  subject: string;
  html: string;
  text: string;
}

const COLORS = {
  bg: "#0B0B0E",
  card: "#121218",
  border: "#26262E",
  text: "#F4F4F5",
  muted: "#A1A1AA",
  accent: "#C6A664",
  onAccent: "#12121A",
  white: "#FFFFFF",
};

const FONT_LTR =
  "'Inter','Segoe UI',Roboto,-apple-system,'Helvetica Neue',Arial,sans-serif";
const FONT_RTL =
  "'Noto Kufi Arabic','Segoe UI',Tahoma,'Geeza Pro','Arabic Typesetting',sans-serif";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Isole un segment latin (URL, référence) dans un texte arabe. */
function ltr(value: string): string {
  return `<span dir="ltr" style="display:inline-block;unicode-bidi:embed;">${escapeHtml(value)}</span>`;
}

function dateFr(value: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Africa/Tripoli",
  }).format(value);
}

function shell(options: {
  rtl: boolean;
  brandLine: string;
  brandSub: string;
  body: string;
}): string {
  const font = options.rtl ? FONT_RTL : FONT_LTR;
  return `<!doctype html>
<html lang="${options.rtl ? "ar" : "en"}" dir="${options.rtl ? "rtl" : "ltr"}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<title>${escapeHtml(options.brandLine)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.bg};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.bg};">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;">
      <tr><td style="background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:18px;overflow:hidden;font-family:${font};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="padding:22px 28px;border-bottom:1px solid ${COLORS.border};">
            <p style="margin:0;font-size:17px;font-weight:800;color:${COLORS.accent};">✦ ${escapeHtml(options.brandLine)}</p>
            <p style="margin:6px 0 0;font-size:12px;color:${COLORS.muted};">${escapeHtml(options.brandSub)}</p>
          </td>
        </tr></table>
        ${options.body}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/** Bloc de texte (paragraphes) dans la langue demandée. */
function paragraphs(lines: string[], rtl: boolean): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:22px 28px 0;">${lines
    .map(
      (line) =>
        `<p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:${COLORS.text};"${rtl ? ' dir="rtl"' : ""}>${line}</p>`,
    )
    .join("")}</td></tr></table>`;
}

function heading(text: string, rtl: boolean): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:20px 28px 0;">
    <p style="margin:0;font-size:13px;font-weight:800;letter-spacing:.04em;color:${COLORS.accent};text-transform:uppercase;"${rtl ? ' dir="rtl"' : ""}>${escapeHtml(text)}</p>
  </td></tr></table>`;
}

function buttonHtml(href: string, label: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:18px 28px 4px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="${COLORS.accent}" style="border-radius:999px;">
      <a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 28px;font-family:${FONT_LTR};font-size:14px;font-weight:700;color:${COLORS.onAccent};text-decoration:none;border-radius:999px;">${escapeHtml(label)}</a>
    </td></tr></table>
  </td></tr></table>`;
}

function listHtml(items: { label: string; url?: string }[], rtl: boolean): string {
  const rows = items
    .map(
      (item) =>
        `<li style="margin:0 0 8px;font-size:14px;line-height:1.6;color:${COLORS.text};">${
          item.url
            ? `<a href="${escapeHtml(item.url)}" style="color:${COLORS.accent};font-weight:700;text-decoration:none;">${escapeHtml(item.label || item.url)}</a>`
            : `${escapeHtml(item.label)}`
        }</li>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:12px 28px 0;">
    <ul style="margin:0;padding-${rtl ? "right" : "left"}:20px;">${rows}</ul>
  </td></tr></table>`;
}

function mutedNote(ar: string, en: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:16px 28px 0;">
    <p style="margin:0;font-size:13px;line-height:1.7;color:${COLORS.muted};" dir="rtl">${escapeHtml(ar)}</p>
    <p style="margin:6px 0 0;font-size:13px;line-height:1.7;color:${COLORS.muted};">${escapeHtml(en)}</p>
  </td></tr></table>`;
}

function footer(data: DeliveryEmailData): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:22px 28px 26px;border-top:1px solid ${COLORS.border};text-align:center;margin-top:18px;">
    <p style="margin:0 0 6px;font-size:12px;color:${COLORS.muted};" dir="rtl">${escapeHtml(data.siteNameAr)} — ${escapeHtml(data.supportEmail)}</p>
    <p style="margin:0;font-size:12px;color:#71717A;">${escapeHtml(data.siteName)} — ${escapeHtml(data.siteUrl)}</p>
  </td></tr></table>`;
}

/**
 * 1. Lien de livraison : le client consulte le récapitulatif et valide.
 * Le jeton de validation figure dans l'URL — il ne sera pas réédité.
 */
export function buildDeliveryLinkEmail(data: DeliveryEmailData): DeliveryEmailContent {
  const subjectAr = `تسليم مشروعك: ${data.projectTitle} (${data.ref})`;
  const subjectEn = `Your project is delivered: ${data.projectTitle} (${data.ref})`;
  const body = [
    paragraphs(
      [
        `مرحباً ${escapeHtml(data.clientName)}، تم تسليم مشروع <strong>${escapeHtml(data.projectTitle)}</strong> (المرجع ${ltr(data.ref)}).`,
        `راجع الملخص والروابط وقائمة العناصر المسلّمة، ثم اضغط «اعتماد الاستلام» لتأكيد الاستلام وتفعيل الضمان (${data.warrantyDays} يوماً).`,
      ],
      true,
    ),
    paragraphs(
      [
        `Hello ${escapeHtml(data.clientName)}, your project <strong>${escapeHtml(data.projectTitle)}</strong> (ref. ${escapeHtml(data.ref)}) has been delivered.`,
        `Review the summary, the links and the delivered items, then press “Accept delivery” to confirm and start the ${data.warrantyDays}-day warranty.`,
      ],
      false,
    ),
    buttonHtml(data.acceptUrl, "اعتماد الاستلام / Accept delivery"),
    data.links.length
      ? heading("الروابط / Links", true) + listHtml(data.links, true)
      : "",
    data.items.length
      ? heading("العناصر المسلّمة / Delivered items", true) + listHtml(data.items, true)
      : "",
    mutedNote(
      "لا تردّ على هذا البريد بكلمات مرور. بيانات الدخول تُرسل عبر قناة منفصلة.",
      "Never reply with passwords. Credentials are sent through a separate channel.",
    ),
  ].join("");
  const text = [
    `مرحباً ${data.clientName}، تم تسليم مشروع ${data.projectTitle} (${data.ref}).`,
    "",
    `رابط الاعتماد: ${data.acceptUrl}`,
    "",
    ...data.links.map((link) => `${link.label || link.url}: ${link.url}`),
    "",
    `Hello ${data.clientName}, your project ${data.projectTitle} (${data.ref}) has been delivered.`,
    `Accept here: ${data.acceptUrl}`,
  ].join("\n");
  return {
    subject: `${subjectAr} — ${subjectEn}`,
    html: shell({
      rtl: true,
      brandLine: `${data.siteNameAr} — تسليم المشروع`,
      brandSub: `${data.siteName} — project delivery · ${data.ref}`,
      body: body + footer(data),
    }),
    text,
  };
}

/**
 * 2. Reçu de recette : envoyé au client après validation. Il tient lieu de
 * procès-verbal — la date et le nom du validateur y figurent.
 */
export function buildDeliveryAcceptedEmail(data: DeliveryEmailData): DeliveryEmailContent {
  const when = data.acceptedAt ? dateFr(data.acceptedAt) : "";
  const by = data.acceptedByName?.trim() || data.clientName;
  const subjectAr = `تم اعتماد الاستلام: ${data.projectTitle} (${data.ref})`;
  const subjectEn = `Delivery accepted: ${data.projectTitle} (${data.ref})`;
  const body = [
    paragraphs(
      [
        `شكراً ${escapeHtml(by)} — تم اعتماد استلام <strong>${escapeHtml(data.projectTitle)}</strong> (المرجع ${ltr(data.ref)})${when ? ` بتاريخ ${ltr(when)}` : ""}.`,
        `الضمان ساري حتى ${ltr(dateFr(new Date((data.acceptedAt ?? new Date()).getTime() + data.warrantyDays * 86400000)))}: نصلّح أي خلل في ما تم تسليمه دون أي تكلفة إضافية.`,
      ],
      true,
    ),
    paragraphs(
      [
        `Thank you ${escapeHtml(by)} — delivery of <strong>${escapeHtml(data.projectTitle)}</strong> (ref. ${escapeHtml(data.ref)}) is accepted${when ? ` on ${escapeHtml(when)}` : ""}.`,
        `Warranty runs for ${data.warrantyDays} days: any defect in what was delivered is fixed at no extra cost.`,
      ],
      false,
    ),
    data.links.length
      ? heading("الروابط / Links", true) + listHtml(data.links, true)
      : "",
    data.items.length
      ? heading("العناصر المعتمدة / Accepted items", true) + listHtml(data.items, true)
      : "",
    mutedNote(
      "احتفظ بهذا البريد: هو إثبات الاستلام وتاريخ بدء الضمان.",
      "Keep this e-mail: it is the proof of acceptance and the start date of the warranty.",
    ),
    data.review?.html ?? "",
  ].join("");
  const text = [
    `${subjectAr} — ${subjectEn}`,
    `Accepted by ${by}${when ? ` on ${when}` : ""}. Warranty: ${data.warrantyDays} days.`,
    "",
    ...data.links.map((link) => `${link.label || link.url}: ${link.url}`),
    ...data.items.map((item) => `- ${item.label}`),
    ...(data.review?.text ?? []),
  ].join("\n");
  return {
    subject: `${subjectAr} — ${subjectEn}`,
    html: shell({
      rtl: true,
      brandLine: `${data.siteNameAr} — اعتماد الاستلام`,
      brandSub: `${data.siteName} · ${data.ref}`,
      body: body + footer(data),
    }),
    text,
  };
}

/** 3. Notification interne à l'agence (français, comme les notifications de demande). */
export function buildDeliveryAcceptedNotification(
  data: DeliveryEmailData,
): DeliveryEmailContent {
  const when = data.acceptedAt ? dateFr(data.acceptedAt) : "—";
  const by = data.acceptedByName?.trim() || data.clientName;
  const body = [
    paragraphs(
      [
        `<strong>${escapeHtml(by)}</strong> a validé la livraison du projet <strong>${escapeHtml(data.projectTitle)}</strong>.`,
        `Référence : ${escapeHtml(data.ref)} · Validé le ${escapeHtml(when)} · Garantie : ${data.warrantyDays} jours${data.amountUsd ? ` · Montant : ${escapeHtml(data.amountUsd)}` : ""}.`,
        data.clientEmail ? `E-mail client : ${escapeHtml(data.clientEmail)}` : "",
      ].filter(Boolean),
      false,
    ),
    mutedNote(
      "Prochaine étape conseillée : point J+7 puis proposition d'abonnement maintenance à J+30.",
      "Next step: check in at D+7, offer the maintenance plan at D+30.",
    ),
  ].join("");
  return {
    subject: `Recette validée — ${data.projectTitle} (${data.ref})`,
    html: shell({
      rtl: false,
      brandLine: `${data.siteName} — recette validée`,
      brandSub: `${data.ref} · ${when}`,
      body,
    }),
    text: [
      `Recette validée — ${data.projectTitle} (${data.ref})`,
      `Validé par ${by} le ${when} · Garantie ${data.warrantyDays} jours`,
      data.clientEmail ? `E-mail client : ${data.clientEmail}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}
