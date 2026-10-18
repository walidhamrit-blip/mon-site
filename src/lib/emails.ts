// Modèles d'e-mail du site (notification à l'agence + accusé de réception client).
//
// Les e-mails sont écrits en tables HTML avec styles en ligne : c'est la
// seule mise en page rendu de façon fiable par Gmail, Outlook et WhatsApp.
// La version arabe est en RTL (direction + polices arabes) ; la version
// anglaise reste en LTR.

import { LEAD_FIELD_TITLES, leadFieldLabel, type LeadLocale } from "@/lib/lead-fields";

export interface LeadEmailData {
  id: number;
  name: string;
  business: string;
  phone: string;
  email: string | null;
  sector: string;
  need: string;
  budget: string;
  deadline: string;
  message: string | null;
  utm: string | null;
  locale: string | null;
  createdAt?: string;
}

export interface SiteEmailContext {
  siteName: string;
  siteNameAr: string;
  siteUrl: string;
  email: string;
  phone: string;
  whatsapp: string;
  address: string;
  addressEn: string;
  hours: string;
  hoursEn: string;
}

export interface EmailContent {
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
  whatsapp: "#25D366",
  white: "#FFFFFF",
};

const FONT_LTR =
  "'Inter','Segoe UI',Roboto,-apple-system,'Helvetica Neue',Arial,sans-serif";
const FONT_RTL =
  "'Noto Kufi Arabic','Segoe UI',Tahoma,'Geeza Pro','Arabic Typesetting',sans-serif";

/** Échappe les caractères HTML (les données viennent du formulaire public). */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Isole un segment latin (email, URL, téléphone) dans un texte arabe. */
function ltr(value: string): string {
  return `<span dir="ltr" style="display:inline-block;unicode-bidi:embed;">${escapeHtml(value)}</span>`;
}

function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, "");
}

function whatsappLink(phone: string, message: string): string {
  return `https://wa.me/${digitsOnly(phone)}?text=${encodeURIComponent(message)}`;
}

function button(href: string, label: string, background: string, color: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="${background}" style="border-radius:999px;">
            <a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 26px;font-family:${FONT_LTR};font-size:14px;font-weight:700;color:${color};text-decoration:none;border-radius:999px;">${escapeHtml(label)}</a>
          </td></tr></table>`;
}

/** Bloc « label / valeur » du tableau récapitulatif. */
function detailRows(
  rows: { label: string; value: string }[],
  align: "left" | "right",
): string {
  return rows
    .map(
      (row) => `<tr>
        <td style="padding:10px 0;border-bottom:1px solid ${COLORS.border};font-size:12px;color:${COLORS.muted};white-space:nowrap;">${escapeHtml(row.label)}</td>
        <td align="${align}" style="padding:10px 0;border-bottom:1px solid ${COLORS.border};font-size:14px;font-weight:700;color:${COLORS.text};">${row.value}</td>
      </tr>`,
    )
    .join("");
}

function footer(ctx: SiteEmailContext, locale: LeadLocale): string {
  const lines =
    locale === "ar"
      ? [
          `${ctx.siteNameAr} — وكالة ويب بطرابلس`,
          ctx.address,
          ctx.hours,
          `${ctx.siteUrl} · ${ctx.phone}`,
        ]
      : [
          `${ctx.siteName} — Premium Web Agency, Tripoli`,
          ctx.addressEn,
          ctx.hoursEn,
          `${ctx.siteUrl} · ${ctx.phone}`,
        ];
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:22px 28px 26px;border-top:1px solid ${COLORS.border};text-align:center;">
    ${lines
      .map(
        (line, index) =>
          `<p style="margin:${index === 0 ? "0 0 6px" : "0 0 4px"};font-size:12px;color:${index === 0 ? COLORS.muted : "#71717A"};">${escapeHtml(line)}</p>`,
      )
      .join("")}
  </td></tr></table>`;
}

function shell(options: {
  locale: LeadLocale;
  preheader: string;
  brandLine: string;
  brandSub: string;
  body: string;
}): string {
  const rtl = options.locale === "ar";
  return `<!doctype html>
<html lang="${rtl ? "ar" : "en"}" dir="${rtl ? "rtl" : "ltr"}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${escapeHtml(options.preheader)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.bg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(options.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.bg};">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;">
      <tr><td style="background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:18px;overflow:hidden;font-family:${rtl ? FONT_RTL : FONT_LTR};">
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

function formatDate(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Africa/Tripoli",
  }).format(date);
}

/* ------------------------------------------------------------------ */
/* 1. Notification à l'agence (français — l'administration est en FR)  */
/* ------------------------------------------------------------------ */

export function buildLeadNotification(
  data: LeadEmailData,
  ctx: SiteEmailContext,
): EmailContent {
  const reference = `#${data.id}`;
  const subject = `🆕 Nouvelle demande ${data.business} — ${reference}`;

  const waMessage =
    `Bonjour ${data.name}, nous avons bien reçu votre demande (${reference}) ` +
    `concernant « ${data.business} ». Pouvons-nous en discuter ?`;

  const rows = detailRows(
    [
      { label: "Référence", value: escapeHtml(reference) },
      { label: "Date", value: escapeHtml(formatDate(data.createdAt)) },
      { label: "Demandeur", value: escapeHtml(data.name) },
      { label: "Activité", value: escapeHtml(data.business) },
      { label: "Secteur", value: escapeHtml(leadFieldLabel("sector", data.sector, "en")) },
      { label: "Besoin", value: escapeHtml(leadFieldLabel("need", data.need, "en")) },
      { label: "Budget", value: escapeHtml(leadFieldLabel("budget", data.budget, "en")) },
      { label: "Délai", value: escapeHtml(leadFieldLabel("deadline", data.deadline, "en")) },
      { label: "Téléphone", value: ltr(data.phone) },
      { label: "E-mail", value: data.email ? ltr(data.email) : "—" },
      { label: "Langue du formulaire", value: escapeHtml(data.locale ?? "—") },
      { label: "UTM", value: data.utm ? escapeHtml(data.utm) : "—" },
    ],
    "left",
  );

  const messageBlock = data.message
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:20px 28px 0;">
        <p style="margin:0 0 8px;font-size:12px;color:${COLORS.muted};">Message du client</p>
        <div style="padding:14px 16px;background:#1A1A22;border-right:3px solid ${COLORS.accent};border-radius:10px;font-size:14px;line-height:1.7;color:${COLORS.text};">${escapeHtml(data.message).replace(/\n/g, "<br>")}</div>
      </td></tr></table>`
    : "";

  const html = shell({
    locale: "en",
    preheader: `Nouvelle demande ${data.business} (${data.name}) — réf. ${reference}`,
    brandLine: `${ctx.siteName} — Nukhba`,
    brandSub: "Agence Web Premium · Tripoli",
    body: `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:26px 28px 0;">
        <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${COLORS.accent};">Nouvelle demande</p>
        <h1 style="margin:10px 0 0;font-size:24px;line-height:1.25;color:${COLORS.text};">${escapeHtml(data.business)}</h1>
        <p style="margin:8px 0 0;font-size:14px;color:${COLORS.muted};">${escapeHtml(data.name)} — ${ltr(data.phone)}</p>
      </td></tr></table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:22px 28px 0;">
        ${rows}
      </td></tr></table>
      ${messageBlock}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:24px 28px 0;">
        <p style="margin:0 0 12px;font-size:14px;color:${COLORS.muted};">Contacter le client</p>
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td align="center" style="padding-right:8px;">${button(whatsappLink(data.phone, waMessage), "WhatsApp", COLORS.whatsapp, COLORS.white)}</td>
          <td align="center" style="padding-right:8px;">${button(`tel:${data.phone.replace(/\s/g, "")}`, "Appeler", "#24242E", COLORS.text)}</td>
          <td align="center">${button(`${ctx.siteUrl}/admin/leads`, "Ouvrir l'administration", COLORS.accent, COLORS.onAccent)}</td>
        </tr></table>
      </td></tr></table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:20px 28px 0;">
        <p style="margin:0;font-size:12px;line-height:1.7;color:#71717A;">${
          data.email
            ? `Répondre directement à cet e-mail pour écrire à ${escapeHtml(data.name)} (${escapeHtml(data.email)}).`
            : "Le client n'a pas laissé d'adresse e-mail — utilisez WhatsApp ou le téléphone."
        }</p>
      </td></tr></table>
      ${footer(ctx, "en")}`,
  });

  const text = [
    "NOUVELLE DEMANDE",
    "",
    `Référence : ${reference}`,
    `Date : ${formatDate(data.createdAt) || "—"}`,
    `Activité : ${data.business}`,
    `Demandeur : ${data.name}`,
    `Téléphone : ${data.phone}`,
    `E-mail : ${data.email || "—"}`,
    `Secteur : ${leadFieldLabel("sector", data.sector, "en")}`,
    `Besoin : ${leadFieldLabel("need", data.need, "en")}`,
    `Budget : ${leadFieldLabel("budget", data.budget, "en")}`,
    `Délai : ${leadFieldLabel("deadline", data.deadline, "en")}`,
    `Langue du formulaire : ${data.locale || "—"}`,
    `UTM : ${data.utm || "—"}`,
    data.message ? `\nMessage du client :\n${data.message}` : "",
    "",
    `WhatsApp : ${whatsappLink(data.phone, waMessage)}`,
    `Administration : ${ctx.siteUrl}/admin/leads`,
  ]
    .filter((line) => line !== "")
    .join("\n");

  return { subject, html, text };
}

/* ------------------------------------------------------------------ */
/* 2. Accusé de réception client (arabe ou anglais selon le formulaire) */
/* ------------------------------------------------------------------ */

export function buildLeadReceipt(
  data: LeadEmailData,
  ctx: SiteEmailContext,
): EmailContent {
  const rtl = (data.locale ?? "en").toLowerCase().startsWith("ar");
  const locale: LeadLocale = rtl ? "ar" : "en";
  const reference = `#${data.id}`;

  const subject = rtl
    ? `✅ استلمنا طلبك — ${data.business}`
    : `✅ We received your request — ${data.business}`;

  const waMessage = rtl
    ? `مرحبا ${data.name} 👋\nشكراً لتواصلك مع ${ctx.siteNameAr}. طلبك رقم ${reference} — كيف يمكننا مساعدتك؟`
    : `Hello ${data.name} 👋\nThanks for contacting ${ctx.siteName}. Your request is ${reference} — how can we help?`;

  const rows = detailRows(
    [
      { label: LEAD_FIELD_TITLES.sector[locale], value: escapeHtml(leadFieldLabel("sector", data.sector, locale)) },
      { label: LEAD_FIELD_TITLES.need[locale], value: escapeHtml(leadFieldLabel("need", data.need, locale)) },
      { label: LEAD_FIELD_TITLES.budget[locale], value: escapeHtml(leadFieldLabel("budget", data.budget, locale)) },
      { label: LEAD_FIELD_TITLES.deadline[locale], value: escapeHtml(leadFieldLabel("deadline", data.deadline, locale)) },
    ],
    rtl ? "right" : "left",
  );

  const copy = rtl
    ? {
        preheader: `طلبك رقم ${reference} — نرد خلال ساعتين`,
        brandLine: `${ctx.siteNameAr} — نخبة`,
        brandSub: "وكالة ويب بطرابلس",
        title: "شكراً لتواصلك معنا",
        intro: `مرحباً ${data.name}، استلمنا طلبك بخصوص «${data.business}» وسنرد عليك خلال ساعتين كحد أقصى.`,
        reference: `رقم الطلب: ${reference}`,
        recapTitle: "ملخص طلبك",
        nextTitle: "ماذا بعد؟",
        next: [
          "ندرس طلبك ونجهّز عرض سعر شفافاً بلا التزام.",
          "نتواصل معك عبر واتساب أو الهاتف خلال ساعتين.",
          "عند الموافقة، سلّم موقعك خلال 7 إلى 14 يوماً.",
        ],
        whatsapp: "تواصل عبر واتساب",
        call: "اتصل بنا",
        site: "شاهد أعمالنا",
        footerNote: "وصلتك هذه الرسالة لأنك استعملت نموذج الطلب في موقعنا.",
      }
    : {
        preheader: `Request ${reference} — we reply within 2 hours`,
        brandLine: `${ctx.siteName} — Nukhba`,
        brandSub: "Premium Web Agency · Tripoli",
        title: "Thanks for reaching out",
        intro: `Hello ${data.name}, we received your request about “${data.business}” and will get back to you within 2 hours.`,
        reference: `Request reference: ${reference}`,
        recapTitle: "Your request",
        nextTitle: "What happens next",
        next: [
          "We review your request and prepare a transparent quote, with no commitment.",
          "We contact you on WhatsApp or by phone within 2 hours.",
          "Once you approve, your site goes live in 7 to 14 days.",
        ],
        whatsapp: "Chat on WhatsApp",
        call: "Call us",
        site: "See our work",
        footerNote: "You received this email because you used the request form on our website.",
      };

  const nextItems = copy.next
    .map(
      (item) =>
        `<li style="margin:0 0 8px;font-size:14px;line-height:1.7;color:${COLORS.text};">${escapeHtml(item)}</li>`,
    )
    .join("");

  const html = shell({
    locale,
    preheader: copy.preheader,
    brandLine: copy.brandLine,
    brandSub: copy.brandSub,
    body: `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:26px 28px 0;">
        <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${COLORS.accent};">${escapeHtml(copy.reference)}</p>
        <h1 style="margin:10px 0 0;font-size:24px;line-height:1.3;color:${COLORS.text};">${escapeHtml(copy.title)}</h1>
        <p style="margin:10px 0 0;font-size:15px;line-height:1.8;color:${COLORS.muted};">${escapeHtml(copy.intro)}</p>
      </td></tr></table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:22px 28px 0;">
        <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:${COLORS.text};">${escapeHtml(copy.recapTitle)}</p>
        ${rows}
      </td></tr></table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:24px 28px 0;">
        <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:${COLORS.text};">${escapeHtml(copy.nextTitle)}</p>
        <ul style="margin:0;padding:0;list-style:none;">${nextItems}</ul>
      </td></tr></table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:24px 28px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td align="center" style="padding-right:8px;">${button(whatsappLink(ctx.whatsapp, waMessage), copy.whatsapp, COLORS.whatsapp, COLORS.white)}</td>
          <td align="center" style="padding-right:8px;">${button(`tel:${ctx.phone.replace(/\s/g, "")}`, copy.call, "#24242E", COLORS.text)}</td>
          <td align="center">${button(`${ctx.siteUrl}/demos`, copy.site, COLORS.accent, COLORS.onAccent)}</td>
        </tr></table>
      </td></tr></table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:20px 28px 0;">
        <p style="margin:0;font-size:12px;line-height:1.7;color:#71717A;">${escapeHtml(copy.footerNote)}</p>
      </td></tr></table>
      ${footer(ctx, locale)}`,
  });

  const text = rtl
    ? [
        "شكراً لتواصلك معنا",
        "",
        copy.intro,
        copy.reference,
        "",
        copy.recapTitle,
        `${LEAD_FIELD_TITLES.sector.ar} : ${leadFieldLabel("sector", data.sector, "ar")}`,
        `${LEAD_FIELD_TITLES.need.ar} : ${leadFieldLabel("need", data.need, "ar")}`,
        `${LEAD_FIELD_TITLES.budget.ar} : ${leadFieldLabel("budget", data.budget, "ar")}`,
        `${LEAD_FIELD_TITLES.deadline.ar} : ${leadFieldLabel("deadline", data.deadline, "ar")}`,
        "",
        copy.nextTitle,
        ...copy.next.map((item) => `• ${item}`),
        "",
        `واتساب : ${whatsappLink(ctx.whatsapp, waMessage)}`,
        `الهاتف : ${ctx.phone}`,
        `الموقع : ${ctx.siteUrl}`,
      ].join("\n")
    : [
        "Thanks for reaching out",
        "",
        copy.intro,
        copy.reference,
        "",
        copy.recapTitle,
        `${LEAD_FIELD_TITLES.sector.en} : ${leadFieldLabel("sector", data.sector, "en")}`,
        `${LEAD_FIELD_TITLES.need.en} : ${leadFieldLabel("need", data.need, "en")}`,
        `${LEAD_FIELD_TITLES.budget.en} : ${leadFieldLabel("budget", data.budget, "en")}`,
        `${LEAD_FIELD_TITLES.deadline.en} : ${leadFieldLabel("deadline", data.deadline, "en")}`,
        "",
        copy.nextTitle,
        ...copy.next.map((item) => `• ${item}`),
        "",
        `WhatsApp : ${whatsappLink(ctx.whatsapp, waMessage)}`,
        `Phone : ${ctx.phone}`,
        `Website : ${ctx.siteUrl}`,
      ].join("\n");

  return { subject, html, text };
}
