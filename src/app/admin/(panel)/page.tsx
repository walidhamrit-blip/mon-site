import Link from "next/link";
import { sql, desc } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { leads } from "@/db/schema";
import { StatusBadge } from "./status-badge";
import { ArrowRight, Inbox, Sparkles, Clock3, CheckCircle2 } from "lucide-react";

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

interface Stats {
  total: number;
  neu: number;
  wip: number;
  done: number;
  week: number;
}

export default async function AdminDashboard() {
  let dbError: string | null = null;
  let stats: Stats = { total: 0, neu: 0, wip: 0, done: 0, week: 0 };
  let days: { label: string; count: number }[] = [];
  let recent: (typeof leads.$inferSelect)[] = [];

  try {
    await ensureSchema();

    const [agg] = await db
      .select({
        total: sql<number>`count(*)::int`,
        neu: sql<number>`count(*) filter (where status = 'new')::int`,
        wip: sql<number>`count(*) filter (where status = 'in_progress')::int`,
        done: sql<number>`count(*) filter (where status = 'done')::int`,
        week: sql<number>`count(*) filter (where created_at > now() - interval '7 days')::int`,
      })
      .from(leads);
    stats = {
      total: Number(agg?.total ?? 0),
      neu: Number(agg?.neu ?? 0),
      wip: Number(agg?.wip ?? 0),
      done: Number(agg?.done ?? 0),
      week: Number(agg?.week ?? 0),
    };

    const seriesRes = await db.execute(sql`
      SELECT to_char(d, 'YYYY-MM-DD') AS day, count(l.id) AS cnt
      FROM generate_series(
        date_trunc('day', now()) - interval '13 days',
        date_trunc('day', now()),
        interval '1 day'
      ) d
      LEFT JOIN leads l ON l.created_at >= d AND l.created_at < d + interval '1 day'
      GROUP BY d
      ORDER BY d
    `);
    days = seriesRes.rows.map((row) => {
      const day = String((row as { day?: unknown }).day ?? "");
      return {
        label: `${day.slice(8, 10)}/${day.slice(5, 7)}`,
        count: Number((row as { cnt?: unknown }).cnt ?? 0),
      };
    });

    recent = await db.select().from(leads).orderBy(desc(leads.createdAt)).limit(6);
  } catch (error) {
    dbError = error instanceof Error ? error.message.slice(0, 200) : String(error);
    console.error("[admin/dashboard]", dbError);
  }

  const maxCount = Math.max(...days.map((d) => d.count), 1);
  const today = frDate(new Date()).split(" ")[0];

  const cards = [
    {
      label: "Total des demandes",
      value: stats.total,
      icon: Inbox,
      tone: "text-white",
    },
    {
      label: "Nouveaux",
      value: stats.neu,
      icon: Sparkles,
      tone: "text-blue-300",
    },
    {
      label: "En cours",
      value: stats.wip,
      icon: Clock3,
      tone: "text-amber-300",
    },
    {
      label: "Traitées",
      value: stats.done,
      icon: CheckCircle2,
      tone: "text-emerald-300",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">Tableau de bord</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Vue d’ensemble du site — {today}
          </p>
        </div>
        <Link
          href="/admin/leads"
          className="h-10 px-5 rounded-full bg-[#C6A664] text-black text-sm font-bold inline-flex items-center gap-2 hover:bg-[#B89652] transition-colors"
        >
          Toutes les demandes <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {dbError && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          <strong className="font-bold">Base de données inaccessible :</strong>{" "}
          vérifiez la variable <code className="px-1.5 py-0.5 rounded bg-black/30">DATABASE_URL</code>{" "}
          dans Vercel (Settings → Environment Variables) puis redéployez.
          <div className="mt-1 text-red-400/70 text-xs">{dbError}</div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-3xl border border-white/10 bg-[#121218] p-5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                {card.label}
              </span>
              <card.icon className={`h-4 w-4 ${card.tone}`} />
            </div>
            <div className="mt-3 text-3xl font-black text-white">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-4">
        {/* Activité14 jours */}
        <div className="rounded-3xl border border-white/10 bg-[#121218] p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-white">Activité — 14 derniers jours</h2>
            <span className="text-xs text-zinc-500">
              {stats.week} nouvelle{stats.week > 1 ? "s" : ""} cette semaine
            </span>
          </div>
          <div className="mt-5 flex items-end gap-1.5 h-36">
            {days.map((d) => (
              <div key={d.label} className="flex-1 flex flex-col items-center gap-1.5">
                <span className="text-[10px] text-zinc-500">{d.count || ""}</span>
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-[#C6A664] to-[#E8D5A9] transition-all"
                  style={{
                    height: `${Math.max(4, (d.count / maxCount) * 100)}%`,
                    opacity: d.count === 0 ? 0.15 : 1,
                  }}
                  title={`${d.label} : ${d.count} demande${d.count > 1 ? "s" : ""}`}
                />
                <span className="text-[9px] text-zinc-600">{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Dernières demandes */}
        <div className="rounded-3xl border border-white/10 bg-[#121218] p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-white">Dernières demandes</h2>
            <Link
              href="/admin/leads"
              className="text-xs text-[#C6A664] font-semibold hover:underline"
            >
              Tout voir →
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {recent.length === 0 && (
              <p className="text-sm text-zinc-600 py-6 text-center">
                Aucune demande pour l’instant. Les envois du formulaire de contact
                apparaîtront ici.
              </p>
            )}
            {recent.map((lead) => (
              <div
                key={lead.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-black/20 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-white truncate">
                    {lead.name}
                    <span className="text-zinc-500 font-normal"> — {lead.business}</span>
                  </div>
                  <div className="text-xs text-zinc-600">{frDate(lead.createdAt)}</div>
                </div>
                <StatusBadge status={lead.status} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
