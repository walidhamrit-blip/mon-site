import Link from "next/link";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { Download } from "lucide-react";
import { db, ensureSchema } from "@/db";
import { leads } from "@/db/schema";
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  type LeadRow,
  type LeadStatus,
} from "@/lib/site-types";
import { LeadsTable } from "./leads-table";

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
  searchParams: Promise<{ status?: string; q?: string }>;
}

export default async function AdminLeadsPage({ searchParams }: Props) {
  const params = await searchParams;
  const activeStatus =
    params.status && (LEAD_STATUSES as readonly string[]).includes(params.status)
      ? (params.status as LeadStatus)
      : undefined;
  const search = (params.q ?? "").trim();

  let dbError: string | null = null;
  let rawRows: (typeof leads.$inferSelect)[] = [];
  const counts: Partial<Record<LeadStatus, number>> = {};
  let total = 0;

  try {
    await ensureSchema();
    const conditions = [];
    if (activeStatus) conditions.push(eq(leads.status, activeStatus));
    if (search) {
      const pattern = `%${search}%`;
      conditions.push(
        or(
          ilike(leads.name, pattern),
          ilike(leads.business, pattern),
          ilike(leads.phone, pattern),
          ilike(leads.email, pattern),
          ilike(leads.message, pattern),
        ),
      );
    }

    rawRows = await db
      .select()
      .from(leads)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(leads.createdAt))
      .limit(500);

    const countRows = await db
      .select({
        status: leads.status,
        count: sql<number>`count(*)::int`,
      })
      .from(leads)
      .groupBy(leads.status);
    for (const row of countRows) {
      const key = LEAD_STATUSES.find((s) => s === row.status);
      if (key) counts[key] = Number(row.count);
    }
    total = Object.values(counts).reduce((a, b) => a + b, 0);
  } catch (error) {
    dbError = error instanceof Error ? error.message.slice(0, 200) : String(error);
  }

  const rows: LeadRow[] = rawRows.map((l) => ({
    id: l.id,
    createdAt:
      l.createdAt instanceof Date
        ? l.createdAt.toISOString()
        : String(l.createdAt),
    dateFr: frDate(l.createdAt),
    name: l.name,
    business: l.business,
    phone: l.phone,
    email: l.email,
    sector: l.sector,
    need: l.need,
    budget: l.budget,
    deadline: l.deadline,
    message: l.message,
    utm: l.utm,
    locale: l.locale,
    status: (LEAD_STATUSES as readonly string[]).includes(l.status)
      ? (l.status as LeadStatus)
      : "new",
    notes: l.notes,
  }));

  const tabs: { value: LeadStatus | undefined; label: string; count: number }[] = [
    { value: undefined, label: "Toutes", count: total },
    ...LEAD_STATUSES.map((s) => ({
      value: s,
      label: LEAD_STATUS_LABELS[s],
      count: counts[s] ?? 0,
    })),
  ];

  const hrefFor = (nextStatus: LeadStatus | undefined) => {
    const sp = new URLSearchParams();
    if (nextStatus) sp.set("status", nextStatus);
    if (search) sp.set("q", search);
    const qs = sp.toString();
    return `/admin/leads${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-stone-900">
            Demandes clients
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            {total} demande{total > 1 ? "s" : ""} reçue{total > 1 ? "s" : ""} au total
          </p>
        </div>
        <a
          href="/admin/leads/export"
          className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-stone-300 bg-white text-sm font-semibold text-stone-700 hover:bg-stone-50 shadow-2xs"
        >
          <Download className="h-4 w-4 text-stone-500" />
          Exporter en CSV
        </a>
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

        <form action="/admin/leads" method="get" className="flex gap-2">
          {activeStatus && (
            <input type="hidden" name="status" value={activeStatus} />
          )}
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Nom, activité, téléphone…"
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

      {dbError && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900">
          Lecture impossible : <code className="font-semibold">{dbError}</code>
        </div>
      )}

      <LeadsTable rows={rows} />
    </div>
  );
}
