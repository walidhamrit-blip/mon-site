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

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const TIMEOUT_MS = 8000;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Expéditeur par défaut — à surcharger avec EMAIL_FROM (domaine vérifié). */
export function mailFromAddress(): string {
  const explicit = process.env.EMAIL_FROM?.trim();
  if (explicit) return explicit;
  const domain = (process.env.EMAIL_DOMAIN?.trim() || "nokhba.net.ly").replace(
    /^https?:\/\//,
    "",
  );
  return `Nukhba <no-reply@${domain}>`;
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
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
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
      replyTo: message.replyTo,
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
