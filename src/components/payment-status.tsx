"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Clock, Loader2, XCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface OrderStatus {
  ref: string;
  planName: string;
  amountLyd: string;
  amountUsd: string;
  currency: string;
  clientName: string | null;
  email: string | null;
  phone: string | null;
  payAddress: string | null;
  payCurrency: string | null;
  payAmount: string | null;
  paymentUrl: string | null;
  status: "pending" | "paid" | "failed" | "expired";
  ipnStatus: string | null;
  createdAt: string;
}

/**
 * Interroge le statut d'une commande (IPN à jour en base).
 * S'arrête dès que le paiement est confirmé — ou après
 * 10 minutes d'attente.
 */
export function PaymentStatus({ ref }: { ref: string }) {
  const { locale, t } = useI18n();
  const ar = locale === "ar";
  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!ref) return;
    let stopped = false;
    const deadline = Date.now() + 10 * 60 * 1000;

    const poll = async () => {
      try {
        const res = await fetch(`/api/payments/order/${encodeURIComponent(ref)}`);
        if (!res.ok) {
          if (!stopped) setNotFound(true);
          return;
        }
        const data = await res.json();
        if (stopped) return;
        setOrder(data.order);
        if (data.order.status !== "pending" || Date.now() > deadline) {
          clearInterval(timer);
        }
      } catch {
        /* on réessaie au prochain tick */
      }
    };

    poll();
    const timer = setInterval(poll, 3000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [ref]);

  const status = order?.status ?? "pending";

  if (notFound) {
    return (
      <div className="rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-8 text-center">
        <XCircle className="mx-auto h-10 w-10 text-red-400" />
        <h2 className="mt-4 text-xl font-black">
          {ar ? t.pay.notFoundAr : t.pay.notFoundEn}
        </h2>
      </div>
    );
  }

  return (
    <div className="rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-8 max-w-lg mx-auto text-center">
      {status === "paid" && (
        <>
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-500/15">
            <BadgeCheck className="h-8 w-8 text-emerald-400" />
          </span>
          <h2 className="mt-4 text-2xl font-black text-emerald-400">
            {ar ? t.pay.paidTitleAr : t.pay.paidTitleEn}
          </h2>
          <p className="mt-2 text-sm opacity-70 leading-relaxed">
            {ar ? t.pay.paidNoteAr : t.pay.paidNoteEn}
          </p>
        </>
      )}

      {status === "pending" && (
        <>
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[var(--accent)]/15">
            {order ? (
              <Clock className="h-8 w-8 text-[var(--accent)]" />
            ) : (
              <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
            )}
          </span>
          <h2 className="mt-4 text-2xl font-black">
            {ar ? t.pay.pendingTitleAr : t.pay.pendingTitleEn}
          </h2>
          <p className="mt-2 text-sm opacity-70 leading-relaxed">
            {ar ? t.pay.pendingNoteAr : t.pay.pendingNoteEn}
          </p>
          <span className="mt-4 inline-flex items-center gap-1.5 text-xs opacity-60">
            <Loader2 className="h-3 w-3 animate-spin" />
            {ar ? t.pay.liveAr : t.pay.liveEn}
          </span>
        </>
      )}

      {(status === "failed" || status === "expired") && (
        <>
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-red-500/15">
            <XCircle className="h-8 w-8 text-red-400" />
          </span>
          <h2 className="mt-4 text-2xl font-black">
            {ar
              ? status === "expired"
                ? t.pay.expiredTitleAr
                : t.pay.failedTitleAr
              : status === "expired"
                ? t.pay.expiredTitleEn
                : t.pay.failedTitleEn}
          </h2>
          <p className="mt-2 text-sm opacity-70 leading-relaxed">
            {ar ? t.pay.failedNoteAr : t.pay.failedNoteEn}
          </p>
        </>
      )}

      {order && (
        <dl className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--secondary)]/40 p-4 text-sm text-start space-y-2">
          <div className="flex justify-between gap-4">
            <dt className="opacity-60">{ar ? t.pay.orderAr : t.pay.orderEn}</dt>
            <dd className="font-bold" dir="ltr">{order.ref}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="opacity-60">{ar ? t.pay.planAr : t.pay.planEn}</dt>
            <dd className="font-bold">{order.planName}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="opacity-60">{ar ? t.pay.amountAr : t.pay.amountEn}</dt>
            <dd className="font-bold">
              {Number(order.amountLyd).toLocaleString("en-LY")} LYD{" "}
              <span className="opacity-50 font-normal">
                / ${order.amountUsd}
              </span>
            </dd>
          </div>
          {order.payCurrency && (
            <div className="flex justify-between gap-4">
              <dt className="opacity-60">{ar ? t.pay.cryptoAr : t.pay.cryptoEn}</dt>
              <dd className="font-bold" dir="ltr">
                {order.payAmount} {order.payCurrency.toUpperCase()}
              </dd>
            </div>
          )}
          {order.email && (
            <div className="flex justify-between gap-4">
              <dt className="opacity-60">{ar ? t.pay.emailAr : t.pay.emailEn}</dt>
              <dd className="font-bold" dir="ltr">{order.email}</dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}
