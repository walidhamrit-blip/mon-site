import Link from "next/link";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { orders } from "@/db/schema";
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  type OrderRow,
  type OrderStatus,
} from "@/lib/site-types";
import { OrdersTable } from "./orders-table";
import { CreditCard, RefreshCw, Search } from "lucide-react";

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

interface SearchParams {
  status?: string;
  q?: string;
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { status, q } = await searchParams;
  const activeStatus =
    status && (ORDER_STATUSES as readonly string[]).includes(status)
      ? (status as OrderStatus)
      : undefined;
  const query = (q ?? "").trim();

  let dbError: string | null = null;
  let rows: (typeof orders.$inferSelect)[] = [];
  const counts: Partial<Record<OrderStatus, number>> = {};
  let total = 0;
  let paidTotalUsd = 0;

  try {
    await ensureSchema();

    const conditions = [];
    if (activeStatus) conditions.push(eq(orders.status, activeStatus));
    if (query) {
      const pattern = `%${query}%`;
      conditions.push(
        or(
          ilike(orders.ref, pattern),
          ilike(orders.clientName, pattern),
          ilike(orders.email, pattern),
          ilike(orders.phone, pattern),
          ilike(orders.planName, pattern),
        ),
      );
    }

    rows = await db
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

    total = rows.length;
    paidTotalUsd = rows
      .filter((r) => r.status === "paid")
      .reduce((sum, r) => sum + (Number(r.amountUsd) || 0), 0);
  } catch (error) {
    dbError = error instanceof Error ? error.message.slice(0, 200) : String(error);
    console.error("[admin/orders]", dbError);
  }

  const orderRows: OrderRow[] = rows.map((o) => ({
    id: o.id,
    createdAt: o.createdAt instanceof Date ? o.createdAt.toISOString() : String(o.createdAt),
    dateFr: frDate(o.createdAt),
    ref: o.ref,
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

  const chipHref = (value?: string) => {
    const params = new URLSearchParams();
    if (value) params.set("status", value);
    if (query) params.set("q", query);
    const s = params.toString();
    return s ? `/admin/orders?${s}` : "/admin/orders";
  };

  const chips: { label: string; value?: string; count: number }[] = [
    { label: "Tous", value: undefined, count: total },
    ...ORDER_STATUSES.map((s) => ({
      label: ORDER_STATUS_LABELS[s],
      value: s as string,
      count: counts[s] ?? 0,
    })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-[#C6A664]" />
            Paiements crypto
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {total} commande{total > 1 ? "s" : ""} ·{" "}
            <span className="text-emerald-300 font-bold">
              ${paidTotalUsd.toLocaleString("en-US")}
            </span>{" "}
            encaissés via NOWPayments
          </p>
        </div>
        <Link
          href="/admin/orders"
          className="h-10 px-5 rounded-full border border-white/15 text-sm font-bold text-zinc-300 inline-flex items-center gap-2 hover:bg-white/5 transition-colors"
        >
          <RefreshCw className="h-4 w-4" /> Rafraîchir
        </Link>
      </div>

      {dbError && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          <strong className="font-bold">Base de données inaccessible :</strong>{" "}
          vérifiez <code className="px-1.5 py-0.5 rounded bg-black/30">DATABASE_URL</code> sur Vercel.
          <div className="mt-1 text-red-400/70 text-xs">{dbError}</div>
        </div>
      )}

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2">
        {chips.map((chip) => {
          const isActive = chip.value === activeStatus;
          return (
            <Link
              key={chip.label}
              href={chipHref(chip.value)}
              className={`h-9 px-4 rounded-full text-sm font-semibold inline-flex items-center gap-2 border transition-colors ${
                isActive
                  ? "bg-[#C6A664]/15 border-[#C6A664]/40 text-[#E8D5A9]"
                  : "bg-white/5 border-white/10 text-zinc-400 hover:text-white"
              }`}
            >
              {chip.label}
              <span className="text-xs opacity-60">{chip.count}</span>
            </Link>
          );
        })}

        <form action="/admin/orders" method="get" className="ms-auto flex items-center gap-2">
          {activeStatus && <input type="hidden" name="status" value={activeStatus} />}
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input
              name="q"
              defaultValue={query}
              placeholder="Référence, client, e-mail…"
              className="h-9 ps-9 pe-4 w-[230px] rounded-full border border-white/10 bg-black/40 text-sm text-white outline-none focus:border-[#C6A664]"
            />
          </div>
          <button
            type="submit"
            className="h-9 px-4 rounded-full bg-white/10 text-sm font-semibold text-white hover:bg-white/15 transition-colors cursor-pointer"
          >
            Rechercher
          </button>
        </form>
      </div>

      <OrdersTable orders={orderRows} />

      <p className="text-xs text-zinc-600">
        Les statuts se mettent à jour automatiquement via les
        notifications NOWPayments (IPN). La colonne « IPN (brut) »
        conserve le dernier statut reçu du réseau.
      </p>
    </div>
  );
}
