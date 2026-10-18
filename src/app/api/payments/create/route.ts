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
import {
  isInstallmentCount,
  splitAmount,
  trancheRef,
} from "@/lib/installments";

/**
 * Crée une commande + un paiement NOWPayments.
 * Appelée depuis le dialogue de paiement crypto (pricing).
 * Le montant est calculé côté serveur d'après l'ID de la
 * formule : le client ne peut pas forcer le prix.
 *
 * Deux modes :
 *  - nouveau paiement (`planId`) : une commande par tranche est
 *    créée (1, 2 ou 3), seul le 1er versement est facturé tout de suite ;
 *  - tranche suivante (`orderRef`) : recrée un paiement NOWPayments
 *    pour une tranche déjà planifiée (lien renvoyé au client).
 */

const createPaymentSchema = z
  .object({
    planId: z.string().min(1).max(64).optional(),
    /** Référence d'une tranche existante à régler (2e, 3e versement…). */
    orderRef: z.string().min(3).max(80).optional(),
    /** 1 = paiement total, 2 ou 3 = paiement en tranches. */
    installments: z.number().int().min(1).max(3).optional(),
    name: z.string().max(120).optional(),
    email: z.string().email().max(254).optional(),
    phone: z.string().max(40).optional(),
    locale: z.enum(["ar", "en"]).optional(),
    utm: z.string().max(500).optional(),
  })
  .refine((data) => Boolean(data.planId || data.orderRef), {
    message: "planId ou orderRef requis",
  });

/** URL de base du site (succès/annulation/IPN). */
function siteBaseUrl(): string {
  // Variable privée (jamais exposée au navigateur) — en repli,
  // NEXT_PUBLIC_SITE_URL puis l'URL codée dans config.ts.
  const explicit =
    process.env.SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  return siteConfig.url.replace(/\/+$/, "");
}

function newOrderRef(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `NKH-${stamp}${rand}`;
}

/** Paramètres de paiement communs (retour NOWPayments → nos pages). */
function paymentUrls(ref: string) {
  const baseUrl = siteBaseUrl();
  return {
    ipnCallbackUrl: `${baseUrl}/api/payments/ipn`,
    successUrl: `${baseUrl}/pay/success?ref=${encodeURIComponent(ref)}`,
    cancelUrl: `${baseUrl}/pay/cancel?ref=${encodeURIComponent(ref)}`,
  };
}

/**
 * Facture une tranche existante (2e/3e versement) et met à jour
 * les informations de paiement de la commande.
 */
async function payExistingOrder(orderRef: string) {
  await ensureSchema();
  const wanted = orderRef.trim().toUpperCase();
  const rows = await db
    .select()
    .from(orders)
    .where(eq(orders.ref, wanted))
    .limit(1);
  const order = rows[0];

  if (!order) {
    return NextResponse.json(
      { ok: false, error: "order_not_found" },
      { status: 404 },
    );
  }
  if (order.status === "paid") {
    return NextResponse.json(
      { ok: false, error: "order_already_paid" },
      { status: 409 },
    );
  }

  const amount = Number(order.amountUsd);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { ok: false, error: "invalid_amount" },
      { status: 400 },
    );
  }

  const label =
    order.installments > 1
      ? `${siteConfig.name} — ${order.planName} (${order.installmentIndex}/${order.installments})`
      : `${siteConfig.name} — ${order.planName} plan`;

  let payment: CreatedPayment;
  try {
    payment = await createPayment({
      priceAmount: amount,
      // Une nouvelle tentative ne doit pas réutiliser l'order_id
      // déjà envoyé à NOWPayments.
      orderId: order.paymentId
        ? `${order.ref}-${Date.now().toString(36).toUpperCase()}`
        : order.ref,
      orderDescription: label,
      ...paymentUrls(order.ref),
    });
  } catch (error) {
    console.error(
      "[payments] NOWPayments refusé (tranche) :",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { ok: false, error: "gateway_error" },
      { status: 502 },
    );
  }

  try {
    await db
      .update(orders)
      .set({
        status: "pending",
        ipnStatus: null,
        paymentId: payment.payment_id || null,
        payAddress: payment.pay_address || null,
        payCurrency: payment.pay_currency || null,
        payAmount:
          payment.pay_amount != null ? String(payment.pay_amount) : null,
        paymentUrl: payment.payment_url || null,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));
  } catch (error) {
    console.error(
      "[payments] lien commande impossible :",
      error instanceof Error ? error.message : error,
    );
  }

  return NextResponse.json({
    ok: true,
    orderRef: order.ref,
    groupRef: order.groupRef ?? order.ref,
    installments: order.installments,
    installmentIndex: order.installmentIndex,
    trancheAmountUsd: amount,
    paymentId: payment.payment_id,
    paymentUrl: payment.payment_url,
    payAddress: payment.pay_address,
    payCurrency: payment.pay_currency,
    payAmount: payment.pay_amount,
    priceAmount: payment.price_amount,
    priceCurrency: payment.price_currency,
  });
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

  // ── Mode « tranche suivante » : commande déjà planifiée ──
  if (data.orderRef) {
    try {
      return await payExistingOrder(data.orderRef);
    } catch (error) {
      console.error(
        "[payments] paiement d'une tranche impossible :",
        error instanceof Error ? error.message : error,
      );
      return NextResponse.json(
        { ok: false, error: "save_failed" },
        { status: 500 },
      );
    }
  }

  // ── Mode « nouveau paiement » : total ou plan en tranches ──
  const plan = siteConfig.pricing.plans.find((p) => p.id === data.planId);
  if (!plan || !plan.priceUsd || plan.priceUsd <= 0) {
    return NextResponse.json(
      { ok: false, error: "plan_not_payable" },
      { status: 400 },
    );
  }

  const count =
    data.installments && isInstallmentCount(data.installments)
      ? data.installments
      : 1;
  const usdTranches = splitAmount(plan.priceUsd, count);
  const lydTranches = splitAmount(plan.price, count);

  const baseRef = newOrderRef();

  // 1) Une commande par tranche (statut « en attente »).
  //    Seule la première est facturée immédiatement ; les autres
  //    restent planifiées et payables depuis la page de suivi.
  let firstOrderId: number;
  try {
    await ensureSchema();
    const inserted = await db
      .insert(orders)
      .values(
        usdTranches.map((usd, index) => ({
          ref: trancheRef(baseRef, index + 1),
          groupRef: baseRef,
          planId: plan.id,
          planName: plan.nameEn,
          amountLyd: String(lydTranches[index] ?? plan.price),
          amountUsd: String(usd),
          currency: "usd",
          installments: count,
          installmentIndex: index + 1,
          clientName: data.name || null,
          email: data.email || null,
          phone: data.phone || null,
          utm: data.utm || null,
          locale: data.locale ?? null,
        })),
      )
      .returning({ id: orders.id, ref: orders.ref });
    firstOrderId =
      inserted.find((row) => row.ref === baseRef)?.id ?? inserted[0]?.id ?? 0;
  } catch (error) {
    console.error(
      "[payments] création commande impossible :",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });
  }

  // 2) Paiement chez NOWPayments pour la première tranche.
  let payment: CreatedPayment;
  try {
    payment = await createPayment({
      priceAmount: usdTranches[0],
      orderId: baseRef,
      orderDescription:
        count > 1
          ? `${siteConfig.name} — ${plan.nameEn} (1/${count})`
          : `${siteConfig.name} — ${plan.nameEn} plan`,
      ...paymentUrls(baseRef),
    });
  } catch (error) {
    console.error("[payments] NOWPayments refusé :", error instanceof Error ? error.message : error);
    // Aucun paiement : on retire tout le groupe de tranches pour ne
    // pas laisser de lignes orphelines.
    await db.delete(orders).where(eq(orders.groupRef, baseRef)).catch(() => null);
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
      .where(eq(orders.id, firstOrderId));
  } catch (error) {
    console.error("[payments] lien commande impossible :", error instanceof Error ? error.message : error);
  }

  return NextResponse.json({
    ok: true,
    orderRef: baseRef,
    groupRef: baseRef,
    installments: count,
    installmentIndex: 1,
    trancheAmountUsd: usdTranches[0],
    paymentId: payment.payment_id,
    paymentUrl: payment.payment_url,
    payAddress: payment.pay_address,
    payCurrency: payment.pay_currency,
    payAmount: payment.pay_amount,
    priceAmount: payment.price_amount,
    priceCurrency: payment.price_currency,
  });
}
