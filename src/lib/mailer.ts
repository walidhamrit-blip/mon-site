// Envoi d'e-mails — deux fournisseurs au choix, activés par variables
// d'environnement, avec un repli silencieux si aucun n'est configuré.
//
//   • RESEND_API_KEY           → API Resend (appel REST, aucune dépendance)
//   • SMTP_HOST (+ SMTP_PORT…) → serveur SMTP via nodemailer
//
// Si aucun fournisseur n'est défini, l'envoi est ignoré : le formulaire
// continue de fonctionner (la demande reste enregistrée en base) et un
// message est écrit dans les journaux du serveur.

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Permet de répondre directement au client depuis l'e-mail de l'agence. */
  replyTo?: string;
}

export type MailProvider = "resend" | "smtp" | "none";

export interface MailResult {
  provider: MailProvider;
  ok: boolean;
  id?: string;
  error?: string;
}

import { domainFromOrigin, resolveSiteOrigin } from "@/lib/site-identity";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const TIMEOUT_MS = 8000;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Expéditeur par défaut — à surcharger avec EMAIL_FROM (domaine vérifié). */
export function mailFromAddress(): string {
  const explicit = process.env.EMAIL_FROM?.trim();
  if (explicit) return explicit;
  // Sans EMAIL_DOMAIN explicite, on envoie depuis le domaine canonique du
  // site (SPF/DKIM doivent y être configurés).
  const domain = (
    process.env.EMAIL_DOMAIN?.trim() || domainFromOrigin(resolveSiteOrigin())
  ).replace(/^https?:\/\//, "");
  return `Nukhba <no-reply@${domain}>`;
}

/**
 * Adresse de réponse appliquée quand l'appelant n'en fournit pas.
 *
 * Les e-mails transactionnels (codes livrés, confirmations de commande)
 * partent de `no-reply@…`. Un client qui clique « Répondre » écrit donc à
 * une boîte inexistante : le message est rejeté (550 5.1.1) et le support
 * perd le fil. `EMAIL_REPLY_TO` corrige cela sans changer l'expéditeur
 * (qui doit rester sur le domaine vérifié pour SPF/DKIM).
 *
 * Aucune valeur par défaut : on n'invente pas une adresse qui n'existe pas.
 */
export function mailReplyTo(): string | null {
  const explicit = process.env.EMAIL_REPLY_TO?.trim();
  return explicit || null;
}

/** Contrôle de forme minimal d'une adresse e-mail. */
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

/**
 * Destination configurée pour les notifications internes, **si elle est
 * valide**.
 *
 * Constat de production du 29/10/2026 : la variable `LEAD_NOTIFICATION_EMAIL`
 * contenait littéralement `LEAD_NOTIFICATION_EMAIL` (le nom collé à la place
 * de la valeur). Toutes les notifications partaient donc vers une adresse
 * inexistante — sans que rien ne le signale. Une valeur qui n'a pas la forme
 * d'une adresse est désormais ignorée, et signalée par `/api/health`.
 */
export function configuredLeadRecipient(): string | null {
  const raw = process.env.LEAD_NOTIFICATION_EMAIL?.trim();
  if (!raw) return null;
  return looksLikeEmail(raw) ? raw : null;
}

/** Adresse qui reçoit les notifications internes (demandes, alertes). */
export function mailLeadRecipient(siteEmail: string): string {
  return configuredLeadRecipient() ?? siteEmail;
}

/** Fournisseur actif, déduit des variables d'environnement. */
export function activeMailProvider(): MailProvider {
  if (process.env.RESEND_API_KEY?.trim()) return "resend";
  if (process.env.SMTP_HOST?.trim()) return "smtp";
  return "none";
}

export function isMailConfigured(): boolean {
  return activeMailProvider() !== "none";
}

async function sendWithResend(message: OutgoingEmail): Promise<MailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { provider: "resend", ok: false, error: "RESEND_API_KEY manquant" };
  }
  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: mailFromAddress(),
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(message.replyTo || mailReplyTo()
          ? { reply_to: message.replyTo || mailReplyTo() }
          : {}),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return {
        provider: "resend",
        ok: false,
        error: `HTTP ${response.status} — ${detail.slice(0, 200)}`,
      };
    }

    const payload = (await response.json().catch(() => null)) as {
      id?: string;
    } | null;
    return { provider: "resend", ok: true, id: payload?.id };
  } catch (error) {
    return { provider: "resend", ok: false, error: errorMessage(error) };
  }
}

async function sendWithSmtp(message: OutgoingEmail): Promise<MailResult> {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) {
    return { provider: "smtp", ok: false, error: "SMTP_HOST manquant" };
  }
  try {
    // Import dynamique : nodemailer n'est chargé que si le SMTP est utilisé.
    const nodemailer = await import("nodemailer");
    const port = Number(process.env.SMTP_PORT ?? 587);
    // Certains relais auto-signés ont un certificat non reconnu : on peut
    // désactiver la vérification via SMTP_TLS_REJECT_UNAUTHORIZED=false.
    const rejectUnauthorized = process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== "false";
    const transport = nodemailer.createTransport({
      host,
      port,
      secure: process.env.SMTP_SECURE === "true" || port === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" }
        : undefined,
      tls: { rejectUnauthorized },
    });

    const info = await transport.sendMail({
      from: mailFromAddress(),
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      replyTo: message.replyTo || mailReplyTo() || undefined,
    });

    return { provider: "smtp", ok: true, id: info.messageId };
  } catch (error) {
    return { provider: "smtp", ok: false, error: errorMessage(error) };
  }
}

/**
 * Envoie un e-mail. Ne lève jamais d'exception : un échec d'envoi ne doit
 * jamais faire échouer la demande du client.
 */
/** Renseignements d'envoi, sans secret : qui expédie et par quel canal. */
export interface MailDiagnostics {
  provider: MailProvider;
  configured: boolean;
  /** Expéditeur réellement utilisé (EMAIL_FROM ou domaine du site). */
  from: string;
  fromExplicit: boolean;
  domain: string;
  /** Adresse de réponse par défaut (null = réponses impossibles). */
  replyTo: string | null;
}

export function mailDiagnostics(): MailDiagnostics {
  const from = mailFromAddress();
  const domain = (process.env.EMAIL_DOMAIN?.trim() || domainFromOrigin(resolveSiteOrigin())).replace(
    /^https?:\/\//,
    "",
  );
  return {
    provider: activeMailProvider(),
    configured: isMailConfigured(),
    from,
    fromExplicit: Boolean(process.env.EMAIL_FROM?.trim()),
    domain,
    replyTo: mailReplyTo(),
  };
}

/**
 * E-mail de test, pour valider la configuration d'envoi depuis l'admin.
 *
 * Renvoie le verdict RÉEL du fournisseur : un `ok:true` + `id` signifie que
 * Resend/SMTP a accepté le message (l'identifiant permet de le retrouver
 * dans ses journaux) ; `ok:false` porte le refus exact.
 */
export async function sendTestEmail(to: string): Promise<MailResult> {
  const address = to.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
    return { provider: activeMailProvider(), ok: false, error: "Adresse de destination invalide." };
  }
  const diagnostics = mailDiagnostics();
  const text = [
    "Test d'envoi — boutique des codes & cartes cadeaux.",
    "",
    `Fournisseur : ${diagnostics.provider}`,
    `Expéditeur : ${diagnostics.from}`,
    `Domaine : ${diagnostics.domain}`,
    "",
    "Si vous lisez ce message, la livraison des codes par e-mail peut",
    "atteindre cette adresse. Vérifiez aussi le dossier spam : un domaine",
    "sans SPF/DKIM y tombe souvent.",
  ].join("\n");
  return sendEmail({
    to: address,
    subject: "Test d'envoi — Nukhba codes & cartes cadeaux",
    text,
    html: `<p>Test d'envoi — boutique des codes &amp; cartes cadeaux.</p>
<ul>
  <li>Fournisseur : <strong>${diagnostics.provider}</strong></li>
  <li>Expéditeur : <strong>${diagnostics.from}</strong></li>
  <li>Domaine : <strong>${diagnostics.domain}</strong></li>
</ul>
<p>Si vous lisez ce message, la livraison des codes par e-mail peut atteindre
cette adresse. Vérifiez aussi le dossier spam : un domaine sans SPF/DKIM y
tombe souvent.</p>`,
  });
}

export async function sendEmail(message: OutgoingEmail): Promise<MailResult> {
  const provider = activeMailProvider();
  if (provider === "resend") return sendWithResend(message);
  if (provider === "smtp") return sendWithSmtp(message);
  return {
    provider: "none",
    ok: false,
    error: "aucun fournisseur d'e-mail configuré (RESEND_API_KEY ou SMTP_HOST)",
  };
}
