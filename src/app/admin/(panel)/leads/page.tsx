import Link from "next/link";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { leads } from "@/db/schema";
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  type LeadRow,
  type LeadStatus,
} from "@/lib/site-types";
import { LeadsTable } from "./leads-table";
import { Download, Inbox, Search } from "lucide-react";

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

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { status, q } = await searchParams;
  const activeStatus =
    status && (LEAD_STATUSES as readonly string[]).includes(status)
      ? (status as LeadStatus)
      : undefined;
  const query = (q ?? "").trim();

  let dbError: string | null = null;
  let rows: (typeof leads.$inferSelect)[] = [];
  let counts: Partial<Record<LeadStatus, number>> = {};
  let total = 0;

  try {
    await ensureSchema();

    const conditions = [];
    if (activeStatus) conditions.push(eq(leads.status, activeStatus));
    if (query) {
      const pattern = `%${query}%`;
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

    rows = await db
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
    console.error("[admin/leads]", dbError);
  }

  const leadsRows: LeadRow[] = rows.map((l) => ({
    id: l.id,
    createdAt: l.createdAt instanceof Date ? l.createdAt.toISOString() : String(l.createdAt),
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

  const chipHref = (value?: string) => {
    const params = new URLSearchParams();
    if (value) params.set("status", value);
    if (query) params.set("q", query);
    const s = params.toString();
    return s ? `/admin/leads?${s}` : "/admin/leads";
  };

  const chips: { label: string; value?: string; count: number }[] = [
    { label: "Tous", value: undefined, count: total },
    ...LEAD_STATUSES.map((s) => ({
      label: LEAD_STATUS_LABELS[s],
      value: s as string,
      count: counts[s] ?? 0,
    })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">Demandes</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {total} demande{total > 1 ? "s" : ""} reçue{total > 1 ? "s" : ""} via le site
          </p>
        </div>
        <a
          href="/admin/leads/export"
          className="h-10 px-5 rounded-full border border-white/15 text-sm font-bold text-zinc-300 inline-flex items-center gap-2 hover:bg-white/5 transition-colors"
        >
          <Download className="h-4 w-4" /> Exporter (CSV)
        </a>
      </div>

      {dbError && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          <strong className="font-bold">Base de données inaccessible :</strong> vérifiez{" "}
          <code className="px-1.5 py-0.5 rounded bg-black/30">DATABASE_URL</code> sur Vercel.
          <div className="mt-1 text-red-400/70 text-xs">{dbError}</div>
        </div>
      )}

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2">
        {chips.map((chip) => {
          const active = (chip.value ?? undefined) === activeStatus && !(chip.value === undefined && activeStatus);
          const isActive = chip.value === activeStatus;
          return (
            <Link
              key={chip.label}
              href={chipHref(chip.value)}
              className={`h-9 px-4 rounded-full text-sm font-semibold inline-flex items-center gap-2 border transition-colors ${
                isActive
                  ? "bg-[#C6A664]/15 border-[#C6A664]/40 text-[#E8D5A9]"
                  : "bg-white/5 border-white/10 text-zinc-400 hover:text-white"
              } ${active ? "ring-1 ring-[#C6A664]/40" : ""}`}
            >
              {chip.label}
              <span className="text-xs opacity-60">{chip.count}</span>
            </Link>
          );
        })}

        <form action="/admin/leads" method="get" className="ms-auto flex items-center gap-2">
          {activeStatus && <input type="hidden" name="status" value={activeStatus} />}
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input
              name="q"
              defaultValue={query}
              placeholder="Nom, activité, téléphone…"
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

      {/* Tableau */}
      {leadsRows.length === 0 && !dbError ? (
        <div className="rounded-3xl border border-white/10 bg-[#121218] p-12 text-center">
          <Inbox className="h-10 w-10 mx-auto text-zinc-600" />
          <p className="mt-4 font-bold text-white">
            {query || activeStatus ? "Aucun résultat pour ce filtre." : "Aucune demande pour l’instant."}
          </p>
          <p className="mt-1 text-sm text-zinc-500 max-w-[46ch] mx-auto">
            Les demandes envoyées depuis le formulaire de contact du site seront
            enregistrées ici automatiquement.
          </p>
        </div>
      ) : (
        <LeadsTable leads={leadsRows} />
      )}
    </div>
  );
}
