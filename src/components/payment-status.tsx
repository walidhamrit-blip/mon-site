"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Clock, Loader2, XCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { formatUsd } from "@/lib/installments";

interface OrderStatus {
  ref: string;
  kind?: "plan" | "reservation" | "flex";
  planName: string;
  amountLyd: string;
  amountUsd: string;
  currency: string;
  installments?: number;
  installmentIndex?: number;
  /** E-mail déjà masqué par le serveur (`w***@example.com`). */
  emailMasked: string | null;
  payCurrency: string | null;
  payAmount: string | null;
  status: "pending" | "paid" | "failed" | "expired";
  ipnStatus: string | null;
  createdAt: string;
}

interface Tranche {
  ref: string;
  installmentIndex: number;
  installments: number;
  amountUsd: string;
  amountLyd: string;
  status: "pending" | "paid" | "failed" | "expired";
  paymentUrl: string | null;
}

/**
 * Interroge le statut d'une commande (IPN à jour en base).
 * S'arrête dès que le paiement est confirmé — ou après
 * 10 minutes d'attente.
 *
 * ⚠️ La prop s'appelle `orderRef` (et non `ref`) : React 19 réserve
 * `ref` comme prop spéciale — la passer depuis un Server Component
 * fait planter la page avec « Refs cannot be used in Server
 * Components, nor passed to Client Components ».
 */
export function PaymentStatus({
  orderRef,
  trackingToken,
}: {
  orderRef: string;
  trackingToken?: string;
}) {
  const { locale, t } = useI18n();
  const ar = locale === "ar";
  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [tranches, setTranches] = useState<Tranche[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [paying, setPaying] = useState<string | null>(null);
  const [payError, setPayError] = useState("");

  useEffect(() => {
    if (!orderRef) return;
    let stopped = false;
    const deadline = Date.now() + 10 * 60 * 1000;

    const poll = async () => {
      try {
        const res = await fetch(`/api/payments/order/${encodeURIComponent(orderRef)}`, {
          headers: trackingToken
            ? { "x-order-tracking-token": trackingToken }
            : undefined,
        });
        if (!res.ok) {
          // Seul un vrai 404 est définitif ; une erreur transitoire
          // (500, réseau) laisse le polling réessayer.
          if (res.status === 404 && !stopped) setNotFound(true);
          return;
        }
        const data = await res.json();
        if (stopped) return;
        setNotFound(false);
        setOrder(data.order);
        setTranches(Array.isArray(data.tranches) ? data.tranches : []);
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
  }, [orderRef, trackingToken]);

  const status = order?.status ?? "pending";

  /** Ouvre le paiement NOWPayments d'une tranche planifiée. */
  const payTranche = async (tranche: string) => {
    setPayError("");
    setPaying(tranche);
    try {
      const res = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderRef: tranche,
          trackingToken: trackingToken || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok || !data.paymentUrl) {
        // Cause exacte : code serveur + détail (statut/message NOWPayments).
        const code: string = data.error ?? `http_${res.status}`;
        const detail: { status?: number | null; message?: string } =
          data.detail ?? {};
        const hint =
          code === "save_failed"
            ? ar
              ? t.checkout.hintDbAr
              : t.checkout.hintDbEn
            : code === "gateway_not_configured"
              ? ar
                ? t.checkout.hintKeyAr
                : t.checkout.hintKeyEn
              : ar
                ? t.pay.trancheErrorAr
                : t.pay.trancheErrorEn;
        const statusPart =
          detail.status != null ? ` · HTTP ${detail.status}` : "";
        const messagePart = detail.message
          ? ` — ${String(detail.message).slice(0, 200)}`
          : "";
        setPayError(`${hint} [${code}${statusPart}]${messagePart}`);
        setPaying(null);
        return;
      }
      window.location.assign(data.paymentUrl);
    } catch {
      setPayError(ar ? t.pay.trancheErrorAr : t.pay.trancheErrorEn);
      setPaying(null);
    }
  };

  const unpaidUsd = tranches
    .filter((tranche) => tranche.status !== "paid")
    .reduce((sum, tranche) => sum + (Number(tranche.amountUsd) || 0), 0);
  const allPaid =
    tranches.length > 1 && tranches.every((tranche) => tranche.status === "paid");

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
          {order.kind === "reservation" && (
            <div className="flex justify-between gap-4">
              <dt className="opacity-60">
                {ar ? "نوع الطلب" : "Order type"}
              </dt>
              <dd className="font-bold text-emerald-400">
                {ar ? "حجز أولوية — عربون" : "Priority reservation — deposit"}
              </dd>
            </div>
          )}
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
          {order.emailMasked && (
            <div className="flex justify-between gap-4">
              <dt className="opacity-60">{ar ? t.pay.emailAr : t.pay.emailEn}</dt>
              <dd className="font-bold" dir="ltr">{order.emailMasked}</dd>
            </div>
          )}
        </dl>
      )}

      {tranches.length > 1 && (
        <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--secondary)]/40 p-4 text-start">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-black">
              {ar ? t.pay.tranchesTitleAr : t.pay.tranchesTitleEn}
            </h3>
            {!allPaid && (
              <span className="text-xs opacity-60">
                {ar ? t.pay.remainingAr : t.pay.remainingEn}:{" "}
                <strong className="text-[var(--accent)]" dir="ltr">
                  ${formatUsd(unpaidUsd)}
                </strong>
              </span>
            )}
          </div>

          {allPaid ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-400">
              <BadgeCheck className="h-4 w-4" />
              {ar ? t.pay.allTranchesPaidAr : t.pay.allTranchesPaidEn}
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {tranches.map((tranche) => (
                <li
                  key={tranche.ref}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-bold">
                      {ar ? t.pay.trancheAr : t.pay.trancheEn}{" "}
                      {tranche.installmentIndex}/{tranche.installments}
                    </div>
                    <div className="text-xs opacity-60" dir="ltr">
                      ${formatUsd(Number(tranche.amountUsd) || 0)}
                    </div>
                  </div>

                  {tranche.status === "paid" ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400">
                      <BadgeCheck className="h-3.5 w-3.5" />
                      {ar ? t.pay.tranchePaidAr : t.pay.tranchePaidEn}
                    </span>
                  ) : tranche.status === "pending" && tranche.paymentUrl ? (
                    <a
                      href={tranche.paymentUrl}
                      className="h-8 px-3 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] text-xs font-bold inline-flex items-center hover:bg-[var(--accent-hover)] transition-colors"
                    >
                      {ar ? t.pay.trancheOpenAr : t.pay.trancheOpenEn}
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => payTranche(tranche.ref)}
                      disabled={paying !== null}
                      className="h-8 px-3 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-60 hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
                    >
                      {paying === tranche.ref && (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      )}
                      {ar ? t.pay.payTrancheAr : t.pay.payTrancheEn}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {payError && (
            <p className="mt-3 text-xs font-semibold text-red-400">{payError}</p>
          )}
        </div>
      )}
    </div>
  );
}
