import Link from "next/link";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { orders } from "@/db/schema";
import {
  ORDER_KINDS,
  ORDER_KIND_LABELS,
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  type OrderKind,
  type OrderRow,
  type OrderStatus,
} from "@/lib/site-types";
import { OrdersTable } from "./orders-table";

export const dynamic = "force-dynamic";

function frDate(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  try {
    return d.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Africa/Tripoli",
    });
  } catch {
    return d.toLocaleString("fr-FR");
  }
}

interface Props {
  searchParams: Promise<{ status?: string; kind?: string; type?: string; q?: string }>;
}

export default async function AdminOrdersPage({ searchParams }: Props) {
  const params = await searchParams;
  const activeStatus =
    params.status && (ORDER_STATUSES as readonly string[]).includes(params.status)
      ? (params.status as OrderStatus)
      : undefined;
  const rawKind = params.kind ?? params.type;
  const activeKind =
    rawKind && (ORDER_KINDS as readonly string[]).includes(rawKind)
      ? (rawKind as OrderKind)
      : undefined;
  const search = (params.q ?? "").trim();

  let rawRows: (typeof orders.$inferSelect)[] = [];
  const counts: Partial<Record<OrderStatus, number>> = {};
  let paidCount = 0;
  let pendingCount = 0;
  let paidTotalUsd = 0;
  let dbError: string | null = null;

  try {
    await ensureSchema();
    const conditions = [];
    if (activeStatus) conditions.push(eq(orders.status, activeStatus));
    if (activeKind) conditions.push(eq(orders.kind, activeKind));
    if (search) {
      const pattern = `%${search}%`;
      conditions.push(
        or(
          ilike(orders.ref, pattern),
          ilike(orders.clientName, pattern),
          ilike(orders.email, pattern),
          ilike(orders.phone, pattern),
          ilike(orders.planName, pattern),
          ilike(orders.demoSlug, pattern),
        ),
      );
    }

    rawRows = await db
      .select()
      .from(orders)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(orders.createdAt))
      .limit(500);

    const countRows = await db
      .select({
        status: orders.status,
        count: sql<number>`count(*)::int`,
      })
      .from(orders)
      .groupBy(orders.status);
    for (const row of countRows) {
      if ((ORDER_STATUSES as readonly string[]).includes(row.status)) {
        counts[row.status as OrderStatus] = Number(row.count);
      }
    }
    paidCount = counts.paid ?? 0;
    pendingCount = counts.pending ?? 0;
    paidTotalUsd = rawRows
      .filter((r) => r.status === "paid")
      .reduce((sum, r) => sum + (Number(r.amountUsd) || 0), 0);
  } catch (error) {
    dbError = error instanceof Error ? error.message.slice(0, 200) : String(error);
  }

  const rows: OrderRow[] = rawRows.map((o) => ({
    id: o.id,
    createdAt:
      o.createdAt instanceof Date
        ? o.createdAt.toISOString()
        : String(o.createdAt),
    dateFr: frDate(o.createdAt),
    ref: o.ref,
    kind: (ORDER_KINDS as readonly string[]).includes(o.kind)
      ? (o.kind as OrderKind)
      : "plan",
    demoSlug: o.demoSlug,
    planId: o.planId,
    planName: o.planName,
    amountLyd: o.amountLyd,
    amountUsd: o.amountUsd,
    currency: o.currency,
    installments: o.installments,
    installmentIndex: o.installmentIndex,
    groupRef: o.groupRef,
    clientName: o.clientName,
    email: o.email,
    phone: o.phone,
    paymentId: o.paymentId,
    payAddress: o.payAddress,
    payCurrency: o.payCurrency,
    payAmount: o.payAmount,
    paymentUrl: o.paymentUrl,
    status: (ORDER_STATUSES as readonly string[]).includes(o.status)
      ? (o.status as OrderStatus)
      : "pending",
    ipnStatus: o.ipnStatus,
    utm: o.utm,
    locale: o.locale,
  }));

  const tabs: { value: OrderStatus | undefined; label: string; count: number }[] = [
    { value: undefined, label: "Toutes", count: rows.length },
    ...ORDER_STATUSES.map((s) => ({
      value: s,
      label: ORDER_STATUS_LABELS[s],
      count: counts[s] ?? 0,
    })),
  ];

  const kindTabs: { value: OrderKind | undefined; label: string }[] = [
    { value: undefined, label: "Tous types" },
    ...ORDER_KINDS.map((k) => ({ value: k, label: ORDER_KIND_LABELS[k] })),
  ];

  const hrefFor = (
    nextStatus: OrderStatus | undefined,
    nextKind: OrderKind | undefined = activeKind,
  ) => {
    const sp = new URLSearchParams();
    if (nextStatus) sp.set("status", nextStatus);
    if (nextKind) sp.set("kind", nextKind);
    if (search) sp.set("q", search);
    const qs = sp.toString();
    return `/admin/orders${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-stone-900">
            Paiements & réservations
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            {rows.length} commande{rows.length > 1 ? "s" : ""} affichée
            {rows.length > 1 ? "s" : ""} · {paidCount} confirmée
            {paidCount > 1 ? "s" : ""} ({Math.round(paidTotalUsd * 100) / 100} $) ·{" "}
            {pendingCount} en attente
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {tabs.map((tab) => {
            const active = tab.value === activeStatus;
            return (
              <Link
                key={tab.label}
                href={hrefFor(tab.value)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                  active
                    ? "bg-stone-900 text-white shadow-2xs"
                    : "bg-white text-stone-600 border border-stone-200 hover:bg-stone-100 hover:text-stone-900"
                }`}
              >
                <span>{tab.label}</span>
                <span className="opacity-70">{tab.count}</span>
              </Link>
            );
          })}
        </div>

        <form action="/admin/orders" method="get" className="flex gap-2">
          {activeStatus && (
            <input type="hidden" name="status" value={activeStatus} />
          )}
          {activeKind && (
            <input type="hidden" name="kind" value={activeKind} />
          )}
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Référence, client, ID paiement…"
            className="h-9 w-56 sm:w-64 rounded-xl bg-white border border-stone-300 px-3 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#B8923F]"
          />
          <button
            type="submit"
            className="h-9 px-3.5 rounded-xl bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 cursor-pointer"
          >
            Rechercher
          </button>
        </form>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {kindTabs.map((tab) => {
          const active = tab.value === activeKind;
          return (
            <Link
              key={tab.label}
              href={hrefFor(activeStatus, tab.value)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                active
                  ? "bg-[#C6A664]/20 text-[#7A5D20] border border-[#C6A664]/50"
                  : "bg-white text-stone-600 border border-stone-200 hover:bg-stone-100"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {dbError && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900">
          Lecture impossible : <code className="font-semibold">{dbError}</code>
        </div>
      )}

      <OrdersTable rows={rows} />
    </div>
  );
}
