import { NextResponse } from "next/server";
import { z } from "zod";
import { db, ensureSchema } from "@/db";
import { leads } from "@/db/schema";
import { leadInputSchema } from "@/lib/validation";

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

  try {
    await ensureSchema();
    await db.insert(leads).values({
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
    });
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

  return NextResponse.json({ ok: true });
}
