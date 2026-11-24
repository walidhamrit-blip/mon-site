import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { orders, paygatePayments } from "@/db/schema";
import { pageLocale } from "@/lib/locale-server";
import type { LocalePageProps } from "@/lib/locale";
import { getSiteDataCached } from "@/lib/store";
import { pageMetadata } from "@/lib/seo";
import { maskEmail } from "@/lib/order-tracking";
import {
  fetchPayGateActiveProviders,
  payGateCallbackSecret,
  reconcilePayGateOrder,
  resolveLivePayGateConfig,
} from "@/lib/paygate";
import { verifyPayGateCheckoutToken } from "@/lib/paygate-core";
import { CardCheckoutClient } from "./card-checkout-client";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ ref: string }>;
} & LocalePageProps): Promise<Metadata> {
  const { ref } = await params;
  const { config } = await getSiteDataCached();
  const locale = await pageLocale(config, searchParams);
  return pageMetadata(config, {
    path: `/pay/card/${encodeURIComponent(ref)}`,
    locale,
    title: locale === "ar" ? "الدفع بالبطاقة — نخبة" : "Card Checkout — Nukhba",
    description:
      locale === "ar"
        ? "إتمام الدفع الآمن بالبطاقة البنكية أو Apple Pay أو Google Pay."
        : "Complete your secure payment by Visa, Mastercard, Apple Pay, or Google Pay.",
    noindex: true,
  });
}

export default async function PayGateCardPage({
  params,
  searchParams,
}: {
  params: Promise<{ ref: string }>;
  searchParams: Promise<{
    k?: string;
    err?: string;
    tried?: string;
    lang?: string;
  }>;
}) {
  const { ref: rawRef } = await params;
  const query = await searchParams;
  const ref = (rawRef ?? "").trim().toUpperCase();
  const token = (query.k ?? "").trim();

  if (!ref || !token || !verifyPayGateCheckoutToken(ref, token, payGateCallbackSecret())) {
    notFound();
  }

  await ensureSchema();
  const [order] = await db.select().from(orders).where(eq(orders.ref, ref)).limit(1);
  if (!order || order.paymentMethod !== "paygate") {
    notFound();
  }

  const [session] = await db
    .select()
    .from(paygatePayments)
    .where(eq(paygatePayments.orderRef, ref))
    .limit(1);
  if (!session) {
    notFound();
  }

  const reconciled =
    order.status === "paid"
      ? order
      : await reconcilePayGateOrder(order).catch(() => order);

  const livePayGate = await resolveLivePayGateConfig();
  const billedUsd = Number(session.billedAmountUsd) || Number(order.amountUsd) || 15;
  const providers =
    reconciled.status === "paid"
      ? []
      : await fetchPayGateActiveProviders(billedUsd, livePayGate);

  return (
    <main className="pt-6 min-h-[72vh]">
      <div className="mx-auto max-w-[960px] px-4 sm:px-6 lg:px-8 py-10">
        <CardCheckoutClient
          orderRef={ref}
          checkoutToken={token}
          orderKind={reconciled.kind}
          planName={reconciled.planName}
          maskedEmail={order.email ? (maskEmail(order.email) ?? "") : ""}
          billedUsd={billedUsd}
          initialStatus={reconciled.status}
          forcedProvider={livePayGate.provider}
          providers={providers}
          errorCode={query.err ?? null}
          triedProvider={query.tried ?? null}
        />
      </div>
    </main>
  );
}
