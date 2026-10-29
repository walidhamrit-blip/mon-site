import { NextResponse } from "next/server";
import { z } from "zod";
import { db, ensureSchema } from "@/db";
import { leads } from "@/db/schema";
import { leadInputSchema } from "@/lib/validation";
import { getSiteData } from "@/lib/store";
import { leadEmailContext, sendLeadEmails } from "@/lib/lead-emails";
import { checkRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/csrf";
import { isValidWebhookUrl } from "@/lib/webhook-validate";

/* Limite la cadence de soumission du formulaire de contact par IP+UA.
 * Bloque les bots qui bombardent la base avec des leads factices. */
const LEAD_LIMIT = {
  windowMs: 10 * 60 * 1000,
  max: 5,
  // Anti-rafale : au moins 3 s entre deux soumissions du même client.
  minIntervalMs: 3000,
  prefix: "lead",
} as const;

export async function POST(req: Request) {
  // Anti-CSRF : la création de lead déclenche un e-mail et alimente la
  // base — il est important de vérifier l'Origine (sinon un site tiers
  // pourrait spammer la base en POSTant vers /api/lead avec le referer
  // du site Nukhba, ce qui tromperait le webhook tiers éventuel).
  if (!enforceSameOrigin(req)) {
    return NextResponse.json(
      { ok: false, error: "csrf" },
      { status: 403 },
    );
  }

  const decision = checkRateLimit(LEAD_LIMIT, req);
  if (!decision.allow) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, decision.retryAfterSec)),
        },
      },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = leadInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const data = parsed.data;
  let leadId = 0;
  let saved = false;

  /*
   * Enregistrement en base — mais un échec ne doit plus faire perdre la
   * demande.
   *
   * Incident du 29/10/2026 : la base était suspendue (quota Neon épuisé) ;
   * le formulaire répondait 500 et AUCUN e-mail n'était envoyé, parce que
   * l'envoi venait après l'insertion. Des demandes clients ont été perdues
   * en silence. Désormais : on tente l'insertion, on envoie les e-mails dans
   * tous les cas, et on ne répond « échec » que si les deux ont échoué.
   */
  try {
    await ensureSchema();
    const inserted = await db
      .insert(leads)
      .values({
        name: data.name,
        business: data.business,
        phone: data.phone,
        email: data.email || null,
        sector: data.sector,
        need: data.need,
        budget: data.budget,
        deadline: data.deadline,
        message: data.message || null,
        utm: data.utm || null,
        locale: data.locale || null,
      })
      .returning({ id: leads.id });
    leadId = inserted[0]?.id ?? 0;
    saved = true;
  } catch (error) {
    console.error(
      "[lead] enregistrement impossible (la demande sera transmise par e-mail) :",
      error instanceof Error ? error.message : error,
    );
  }

  // Webhook optionnel (Formspree, Make, Zapier…) : WEBHOOK_URL sur Vercel.
  // Validation anti-SSRF : on refuse localhost/RFC1918/loopback pour
  // éviter qu'un attaquant ayant accès aux variables d'env transforme le
  // serveur en relais vers des services internes.
  const webhook = process.env.WEBHOOK_URL?.trim();
  if (webhook) {
    if (!isValidWebhookUrl(webhook)) {
      console.warn("[lead] WEBHOOK_URL invalide (protocole/hôte refusé) — ignoré.");
    } else {
      try {
        await fetch(webhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...data, source: "nukhba-site" }),
          signal: AbortSignal.timeout(5000),
        });
      } catch (error) {
        console.warn(
          "[lead] webhook en échec :",
          error instanceof Error ? error.message : error,
        );
      }
    }
  }

  // E-mails : notification à l'agence + accusé de réception au client.
  // Ils partent que la demande ait pu être enregistrée ou non : c'est le
  // dernier filet avant la perte définitive.
  let notified = false;
  try {
    const { config } = await getSiteData();
    const outcome = await sendLeadEmails(
      {
        id: leadId,
        name: data.name,
        business: data.business,
        phone: data.phone,
        email: data.email || null,
        sector: data.sector,
        need: data.need,
        budget: data.budget,
        deadline: data.deadline,
        message: data.message || null,
        utm: data.utm || null,
        locale: data.locale || null,
        createdAt: new Date().toISOString(),
      },
      leadEmailContext(config),
    );
    notified = outcome.notification.ok;
    if (!outcome.notification.ok) {
      console.warn("[lead] notification non envoyée :", outcome.notification.error);
    }
    if (outcome.receipt && !outcome.receipt.ok) {
      console.warn(
        "[lead] accusé de réception non envoyé :",
        outcome.receipt.error,
      );
    }
  } catch (error) {
    console.warn(
      "[lead] e-mails impossibles :",
      error instanceof Error ? error.message : error,
    );
  }

  /*
   * Ni base ni e-mail : la demande n'a atterri nulle part. On le dit
   * franchement (503) pour que l'interface propose le WhatsApp — mieux vaut
   * un client redirigé qu'un client qui croit avoir été entendu.
   */
  if (!saved && !notified) {
    return NextResponse.json(
      { ok: false, error: "unavailable", fallback: "whatsapp" },
      { status: 503 },
    );
  }

  // `saved: false` + `ok: true` = la demande est arrivée par e-mail mais
  // n'a pas pu être stockée : le client n'a rien à refaire.
  return NextResponse.json({ ok: true, saved });
}
