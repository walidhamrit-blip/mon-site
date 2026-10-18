import { NextResponse } from "next/server";
import { z } from "zod";
import { db, ensureSchema } from "@/db";
import { leads } from "@/db/schema";
import { leadInputSchema } from "@/lib/validation";
import { getSiteData } from "@/lib/store";
import { leadEmailContext, sendLeadEmails } from "@/lib/lead-emails";

export async function POST(req: Request) {
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
  const webhook = process.env.WEBHOOK_URL;
  if (webhook) {
    try {
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, source: "nukhba-site" }),
      });
    } catch (error) {
      console.warn(
        "[lead] webhook en échec :",
        error instanceof Error ? error.message : error,
      );
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
