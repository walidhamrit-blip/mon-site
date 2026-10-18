import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { orders } from "@/db/schema";
import { siteConfig } from "@/lib/config";
import {
  createPayment,
  nowPaymentsConfigured,
  type CreatedPayment,
} from "@/lib/nowpayments";

/**
 * Crée une commande + un paiement NOWPayments.
 * Appelée depuis le dialogue de paiement crypto (pricing).
 * Le montant est calculé côté serveur d'après l'ID de la
 * formule : le client ne peut pas forcer le prix.
 */

const createPaymentSchema = z.object({
  planId: z.string().min(1).max(64),
  name: z.string().max(120).optional(),
  email: z.string().email().max(254).optional(),
  phone: z.string().max(40).optional(),
  locale: z.enum(["ar", "en"]).optional(),
  utm: z.string().max(500).optional(),
});

/** URL de base du site (succès/annulation/IPN). */
function siteBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  return siteConfig.url.replace(/\/+$/, "");
}

function newOrderRef(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `NKH-${stamp}${rand}`;
}

export async function POST(req: Request) {
  if (!nowPaymentsConfigured()) {
    return NextResponse.json(
      { ok: false, error: "gateway_not_configured" },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = createPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const plan = siteConfig.pricing.plans.find((p) => p.id === data.planId);
  if (!plan || !plan.priceUsd || plan.priceUsd <= 0) {
    return NextResponse.json(
      { ok: false, error: "plan_not_payable" },
      { status: 400 },
    );
  }

  const ref = newOrderRef();
  const baseUrl = siteBaseUrl();

  // 1) Commande en base (statut « en attente »).
  let orderId: number;
  try {
    await ensureSchema();
    const inserted = await db
      .insert(orders)
      .values({
        ref,
        planId: plan.id,
        planName: plan.nameEn,
        amountLyd: String(plan.price),
        amountUsd: String(plan.priceUsd),
        currency: "usd",
        clientName: data.name || null,
        email: data.email || null,
        phone: data.phone || null,
        utm: data.utm || null,
        locale: data.locale ?? null,
      })
      .returning({ id: orders.id });
    orderId = inserted[0]?.id ?? 0;
  } catch (error) {
    console.error("[payments] création commande impossible :", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });
  }

  // 2) Paiement chez NOWPayments.
  let payment: CreatedPayment;
  try {
    payment = await createPayment({
      priceAmount: plan.priceUsd,
      orderId: ref,
      orderDescription: `${siteConfig.name} — ${plan.nameEn} plan`,
      ipnCallbackUrl: `${baseUrl}/api/payments/ipn`,
      successUrl: `${baseUrl}/pay/success?ref=${ref}`,
      cancelUrl: `${baseUrl}/pay/cancel?ref=${ref}`,
    });
  } catch (error) {
    console.error("[payments] NOWPayments refusé :", error instanceof Error ? error.message : error);
    // La commande n'a pas de paiement : on la retire pour ne pas
    // laisser de lignes orphelines.
    await db.delete(orders).where(eq(orders.id, orderId)).catch(() => null);
    return NextResponse.json(
      { ok: false, error: "gateway_error" },
      { status: 502 },
    );
  }

  // 3) Lien payement ↔ commande.
  try {
    await db
      .update(orders)
      .set({
        paymentId: payment.payment_id || null,
        payAddress: payment.pay_address || null,
        payCurrency: payment.pay_currency || null,
        payAmount: payment.pay_amount != null ? String(payment.pay_amount) : null,
        paymentUrl: payment.payment_url || null,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));
  } catch (error) {
    console.error("[payments] lien commande impossible :", error instanceof Error ? error.message : error);
  }

  return NextResponse.json({
    ok: true,
    orderRef: ref,
    paymentId: payment.payment_id,
    paymentUrl: payment.payment_url,
    payAddress: payment.pay_address,
    payCurrency: payment.pay_currency,
    payAmount: payment.pay_amount,
    priceAmount: payment.price_amount,
    priceCurrency: payment.price_currency,
  });
}
