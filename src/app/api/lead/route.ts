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
  } catch (error) {
    console.error(
      "[lead] enregistrement impossible :",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { ok: false, error: "save_failed" },
      { status: 500 },
    );
  }

  // Webhook optionnel (Formspree, Make, Zapier…) : WEBHOOK_URL sur Vercel.
  // Validation anti-SSRF : on refuse localhost/RFC1918/loopback pour
  // éviter qu'un attaquant ayant accès aux variables d'env transforme
  // le serveur en relais vers des services internes.
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
  // Un échec d'envoi ne doit jamais invalider la demande déjà enregistrée.
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

  return NextResponse.json({ ok: true });
}
