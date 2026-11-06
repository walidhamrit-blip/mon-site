/**
 * Demande d'avis après livraison — module PUR (aucune I/O).
 *
 * Deux formes, pour deux moments :
 *   • `reviewInviteBlock()` : bloc compact inséré dans un e-mail existant
 *     (codes livrés, reçu de recette) — le meilleur moment pour demander un
 *     avis est celui où le client vient d'être servi, pas une semaine après ;
 *   • `buildReviewInviteEmail()` : e-mail autonome, bilingue, pour les cas où
 *     aucun e-mail métier n'est envoyé (abonnement renouvelé, livraison
 *     remise en main propre…).
 *
 * Trois règles de rédaction, alignées sur les conditions de Trustpilot et de
 * Google (voir `docs/avis-clients-trustpilot-scamadviser-2026-11-05.md`) :
 *
 *   1. **jamais de consigne de note** — pas de « 5 étoiles », pas d'emoji
 *      étoile, pas de « si vous êtes satisfait » : la demande s'adresse à
 *      tous les clients livrés, y compris ceux qui ont rencontré un problème ;
 *   2. **jamais de contrepartie** — aucune remise, aucun code, aucun tirage ;
 *   3. **une porte de sortie honnête** — l'adresse de support figure dans le
 *      même bloc, sans condition ni « avant de noter ».
 *
 * Rien n'est inventé ici : les liens viennent de `reviewLinks()` et aucune
 * note, moyenne ou compteur d'avis n'est affiché.
 */

import { escapeHtml } from "@/lib/delivery-emails";
import { reviewInviteLinks, reviewInvitesEnabled, type ReviewLink } from "@/lib/trust";
import type { SiteConfigData } from "@/lib/site-types";

export type ReviewInviteKind = "digital" | "website" | "subscription";

export interface ReviewInviteData {
  siteName: string;
  siteNameAr: string;
  siteUrl: string;
  clientName?: string | null;
  orderRef?: string | null;
  kind: ReviewInviteKind;
  links: ReviewLink[];
  supportEmail?: string;
}

export interface ReviewPrompt {
  /** Bloc HTML à insérer dans le corps d'un e-mail. */
  html: string;
  /** Lignes de la version texte. */
  text: string[];
}

export interface ReviewInviteEmail {
  subject: string;
  html: string;
  text: string;
}

const COLORS = {
  text: "#1a1a1e",
  muted: "#666",
  border: "#e7e1d3",
  gold: "#8A6D2F",
  goldBg: "#C6A664",
};

/** Ce qui a été livré, dit en une ligne dans chaque langue. */
function contextLine(kind: ReviewInviteKind): { ar: string; en: string } {
  switch (kind) {
    case "website":
      return {
        ar: "تم تسليم موقعك واعتماده.",
        en: "Your website has been delivered and accepted.",
      };
    case "subscription":
      return {
        ar: "اشتراكك ساري المفعول.",
        en: "Your subscription is up and running.",
      };
    default:
      return {
        ar: "تم تسليم أكوادك.",
        en: "Your codes have been delivered.",
      };
  }
}

function siteHost(siteUrl: string): string {
  try {
    return new URL(siteUrl).hostname.replace(/^www\./, "");
  } catch {
    return siteUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  }
}

/** Boutons de plateformes, dans l'ordre fourni par `reviewLinks()`. */
function buttons(links: ReviewLink[]): string {
  return links
    .map(
      (link) =>
        `<a href="${escapeHtml(link.url)}" style="display:inline-block;margin:0 8px 8px 0;background:${COLORS.goldBg};color:#12121A;font-weight:700;font-size:13px;padding:11px 18px;border-radius:999px;text-decoration:none">${escapeHtml(link.labelEn)}</a>`,
    )
    .join("");
}

/**
 * Bloc bilingue inséré dans un e-mail transactionnel.
 * Renvoie `null` quand aucun profil n'est configuré — un e-mail ne doit
 * jamais proposer un lien vers une page qui n'existe pas.
 */
export function reviewInviteBlock(data: ReviewInviteData): ReviewPrompt | null {
  const links = data.links ?? [];
  if (links.length === 0) return null;

  const context = contextLine(data.kind);
  const ref = data.orderRef?.trim() ? ` (${data.orderRef!.trim()})` : "";
  const client = data.clientName?.trim() ?? "";
  // Salutation personnalisée quand le prénom est connu — jamais un placeholder
  // du genre « Cher client » qui trahit l'automatisation.
  const greetingAr = client ? `مرحباً ${escapeHtml(client)}، ` : "";
  const greetingEn = client ? `${escapeHtml(client)}, ` : "";
  const host = siteHost(data.siteUrl);
  const support = data.supportEmail?.trim() ?? "";

  const html = `
    <div style="margin-top:26px;padding-top:18px;border-top:1px solid ${COLORS.border}">
      <div dir="rtl" lang="ar" style="font-family:'Noto Kufi Arabic','Segoe UI',Tahoma,sans-serif;color:${COLORS.text}">
        <p style="font-size:15px;font-weight:800;margin:0 0 6px">${greetingAr}كيف كانت تجربتك مع ${escapeHtml(data.siteNameAr || data.siteName)}؟</p>
        <p style="font-size:13px;color:${COLORS.muted};margin:0 0 12px;line-height:1.7">
          ${context.ar}${escapeHtml(ref)} — تقييمك يساعد العملاء الآخرين على الثقة بنا، ويساعدنا على تحسين ما يجب تحسينه.
        </p>
      </div>
      <div style="margin:0 0 12px">${buttons(links)}</div>
      <div lang="en" style="color:${COLORS.text}">
        <p style="font-size:13px;color:${COLORS.muted};margin:0 0 10px;line-height:1.7">
          ${greetingEn}${context.en}${escapeHtml(ref)} Your review helps other customers trust us — and shows us what to fix.
        </p>
      </div>
      <p style="font-size:12px;color:${COLORS.muted};margin:0;line-height:1.6">
        ${
          support
            ? `هل واجهت مشكلة؟ اكتب لنا على <a href="mailto:${escapeHtml(support)}" style="color:${COLORS.gold};font-weight:700">${escapeHtml(support)}</a> — نجيب خلال 24 ساعة.<br>Something wrong? Write to the same address, we answer within 24 hours.<br>`
            : ""
        }
        لا نطلب تقييماً مقابل أي مقابل، ولا نُخفي أي رأي. / We never pay for reviews and never filter who we ask.
      </p>
      <p style="font-size:12px;color:#999;margin:8px 0 0">${escapeHtml(data.siteName)} — ${escapeHtml(host)}</p>
    </div>`;

  const text = [
    "",
    `— ${data.siteNameAr || data.siteName}: كيف كانت تجربتك؟ / How was your experience?`,
    `   ${context.ar} ${context.en}`,
    ...links.map((link) => `   ${link.labelEn}: ${link.url}`),
    ...(support ? [`   ${support}`] : []),
    "   لا نطلب تقييماً مقابل أي مقابل. / We never pay for reviews.",
  ];

  return { html, text };
}

/**
 * E-mail autonome de demande d'avis.
 * Renvoie `null` si aucun profil n'est configuré (rien à envoyer).
 */
export function buildReviewInviteEmail(data: ReviewInviteData): ReviewInviteEmail | null {
  const prompt = reviewInviteBlock(data);
  if (!prompt) return null;

  const ref = data.orderRef?.trim();
  const subjectAr = ref
    ? `تقييمك يهمّنا — ${data.siteNameAr || data.siteName} (${ref})`
    : `تقييمك يهمّنا — ${data.siteNameAr || data.siteName}`;
  const subjectEn = ref
    ? `How did we do? — ${data.siteName} (${ref})`
    : `How did we do? — ${data.siteName}`;

  const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(subjectAr)}</title>
</head>
<body style="margin:0;padding:24px 12px;background:#f6f3ec;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid ${COLORS.border};border-radius:18px;padding:24px;font-family:system-ui,Arial,sans-serif;color:${COLORS.text}">
    <div style="font-size:12px;letter-spacing:.14em;color:${COLORS.gold};font-weight:700">${escapeHtml(data.siteName.toUpperCase())}</div>
    <h1 style="font-size:20px;font-weight:900;margin:8px 0 14px">رأيك يهمّنا — ${escapeHtml(data.siteNameAr || data.siteName)}</h1>
    ${prompt.html}
  </div>
</body>
</html>`;

  const text = [`${subjectAr}`, `${subjectEn}`, ...prompt.text].join("\n");

  return { subject: `${subjectAr} — ${subjectEn}`, html, text };
}

/**
 * Bloc de demande d'avis prêt à insérer, calculé depuis la configuration du
 * site. Point d'entrée unique pour les e-mails métier :
 *
 *   const review = reviewPromptForConfig(config, { kind: "digital", orderRef: order.ref });
 *
 * Renvoie `null` quand l'envoi est désactivé ou qu'aucun profil n'est
 * configuré — l'e-mail reste alors strictement identique à avant.
 */
export function reviewPromptForConfig(
  config: Pick<SiteConfigData, "name" | "nameAr" | "url" | "email" | "trust">,
  options: {
    kind: ReviewInviteKind;
    orderRef?: string | null;
    clientName?: string | null;
  },
): ReviewPrompt | null {
  if (!reviewInvitesEnabled(config.trust)) return null;
  return reviewInviteBlock({
    siteName: config.name,
    siteNameAr: config.nameAr,
    siteUrl: config.url,
    clientName: options.clientName ?? null,
    orderRef: options.orderRef ?? null,
    kind: options.kind,
    // Formulaire direct quand il est configuré, sinon fiche publique.
    links: reviewInviteLinks(config.trust),
    supportEmail: config.email,
  });
}
