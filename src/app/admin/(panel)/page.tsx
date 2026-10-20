import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import {
  Inbox,
  Clock,
  CheckCircle2,
  TrendingUp,
  ArrowRight,
  AlertTriangle,
  Wallet,
  Blocks,
  Globe,
  AppWindow,
  Settings,
  FileText,
  ExternalLink,
} from "lucide-react";
import { db, ensureSchema } from "@/db";
import { leads, orders } from "@/db/schema";
import { getSiteData } from "@/lib/store";
import {
  LEAD_STATUSES,
  collectAllDemos,
  type LeadStatus,
} from "@/lib/site-types";
import { StatusBadge } from "./status-badge";

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

export default async function AdminDashboardPage() {
  let dbError: string | null = null;
  let totalLeads = 0;
  let newLeads = 0;
  let wipLeads = 0;
  let doneLeads = 0;
  let weekLeads = 0;
  let paidOrders = 0;
  let pendingOrders = 0;
  let paidTotalUsd = 0;
  let daily: { day: string; count: number }[] = [];
  let recent: (typeof leads.$inferSelect)[] = [];

  const { content } = await getSiteData();

  try {
    await ensureSchema();

    const [[leadAgg], [orderAgg], recentRows, dayRows] = await Promise.all([
      db
        .select({
          total: sql<number>`count(*)::int`,
          neu: sql<number>`count(*) filter (where ${leads.status} = 'new')::int`,
          wip: sql<number>`count(*) filter (where ${leads.status} = 'in_progress')::int`,
          done: sql<number>`count(*) filter (where ${leads.status} = 'done')::int`,
          week: sql<number>`count(*) filter (where ${leads.createdAt} >= now() - interval '7 days')::int`,
        })
        .from(leads),
      db
        .select({
          paid: sql<number>`count(*) filter (where ${orders.status} = 'paid')::int`,
          pending: sql<number>`count(*) filter (where ${orders.status} = 'pending')::int`,
          paidUsd: sql<number>`coalesce(sum(nullif(${orders.amountUsd}, '')::numeric) filter (where ${orders.status} = 'paid'), 0)::float`,
        })
        .from(orders),
      db.select().from(leads).orderBy(desc(leads.createdAt)).limit(6),
      db.execute(sql`
        select to_char(d::date, 'YYYY-MM-DD') as day,
               coalesce(c.cnt, 0)::int as count
        from generate_series(current_date - interval '13 days', current_date, interval '1 day') d
        left join (
          select date_trunc('day', created_at)::date as dt, count(*) as cnt
          from leads
          where created_at >= current_date - interval '13 days'
          group by 1
        ) c on c.dt = d::date
        order by d asc
      `),
    ]);

    totalLeads = Number(leadAgg?.total ?? 0);
    newLeads = Number(leadAgg?.neu ?? 0);
    wipLeads = Number(leadAgg?.wip ?? 0);
    doneLeads = Number(leadAgg?.done ?? 0);
    weekLeads = Number(leadAgg?.week ?? 0);
    paidOrders = Number(orderAgg?.paid ?? 0);
    pendingOrders = Number(orderAgg?.pending ?? 0);
    paidTotalUsd = Number(orderAgg?.paidUsd ?? 0);
    recent = recentRows;
    daily = (dayRows.rows as { day: string; count: number }[]).map((r) => ({
      day: String(r.day),
      count: Number(r.count ?? 0),
    }));
  } catch (error) {
    dbError = error instanceof Error ? error.message.slice(0, 180) : String(error);
  }

  const activeSectionsCount = content.layout.entries.filter((e) => e.enabled).length;
  const customSectionsCount = content.layout.customSections.length;
  const totalSitesCount = collectAllDemos(content).length;
  const totalAppsCount = content.appsPage.items.length;
  const totalProductsCount = content.productsPage.items.length;

  const cards = [
    {
      label: "Nouvelles demandes",
      value: newLeads,
      hint: "À contacter en priorité",
      icon: Inbox,
      tone: "bg-amber-50 text-amber-800 border-amber-200",
      href: "/admin/leads?status=new",
    },
    {
      label: "En cours de suivi",
      value: wipLeads,
      hint: "Devis ou production",
      icon: Clock,
      tone: "bg-sky-50 text-sky-800 border-sky-200",
      href: "/admin/leads?status=in_progress",
    },
    {
      label: "Projets traités",
      value: doneLeads,
      hint: `${totalLeads} demandes au total`,
      icon: CheckCircle2,
      tone: "bg-emerald-50 text-emerald-800 border-emerald-200",
      href: "/admin/leads?status=done",
    },
    {
      label: "Paiements confirmés",
      value: paidOrders,
      hint: `${Math.round(paidTotalUsd).toLocaleString("fr-FR")} $ · ${pendingOrders} en attente`,
      icon: Wallet,
      tone: "bg-stone-100 text-stone-800 border-stone-200",
      href: "/admin/orders?status=paid",
    },
    {
      label: "Activité 7 jours",
      value: weekLeads,
      hint: "Demandes reçues",
      icon: TrendingUp,
      tone: "bg-[#C6A664]/15 text-[#7C5E22] border-[#C6A664]/35",
      href: "/admin/leads",
    },
  ];

  const workspaceCards = [
    {
      href: "/admin/sections",
      icon: Blocks,
      badge: `${activeSectionsCount} sections actives · ${customSectionsCount} perso`,
      title: "Sections & Sites par section",
      desc: "Ajoutez de nouvelles sections, réordonnez ou supprimez des sections, et ajoutez/supprimez les sites à l’intérieur de chacune.",
    },
    {
      href: "/admin/sites",
      icon: Globe,
      badge: `${totalSitesCount} sites publiés`,
      title: "Galerie des sites clients",
      desc: "Gérez les fiches réalisations, URLs live, aperçus, catégories tarifaires et génération SEO IA.",
    },
    {
      href: "/admin/catalog",
      icon: AppWindow,
      badge: `${totalAppsCount} apps · ${totalProductsCount} logiciels`,
      title: "Applications & Produits numériques",
      desc: "Pilotez les pages « Nos applications » et « Produits numériques & logiciels » (En préparation / Prochainement).",
    },
    {
      href: "/admin/content",
      icon: FileText,
      badge: `${content.faqs.length} FAQ · ${content.testimonials.length} avis`,
      title: "Textes, FAQ & Témoignages",
      desc: "Modifiez le Hero d’accueil, le bandeau défilant, les arguments clés, les étapes et les avis clients.",
    },
    {
      href: "/admin/settings",
      icon: Settings,
      badge: "Thème, contacts & tarifs",
      title: "Réglages & Tarification",
      desc: "Palette de couleurs par défaut, WhatsApp, formules tarifaires, paiement libre et services à la carte.",
    },
  ];

  const maxDay = Math.max(1, ...daily.map((d) => d.count));

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#8C6D2F]">
            Espace d’administration Nukhba
          </span>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-stone-900 mt-0.5">
            Vue d’ensemble
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            Pilotez l’architecture des sections, le catalogue de sites, les pages à venir et vos demandes clients.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/sections"
            className="h-10 px-4 rounded-xl bg-stone-900 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 hover:bg-stone-800 shadow-xs"
          >
            <Blocks className="h-4 w-4 text-[#E5CA87]" />
            Gérer sections & sites
          </Link>
          <Link
            href="/"
            target="_blank"
            className="h-10 px-4 rounded-xl border border-stone-300 bg-white text-stone-700 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 hover:bg-stone-50"
          >
            Voir le site <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {dbError && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 flex gap-3 shadow-2xs">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm space-y-1">
            <div className="font-bold text-amber-900">
              Base de données non connectée sur cet environnement
            </div>
            <p className="text-amber-800/90 text-xs leading-relaxed">
              Le site public fonctionne normalement avec ses contenus par défaut. Pour activer l’enregistrement persistant, configurez{" "}
              <code className="text-amber-950 font-semibold">DATABASE_URL</code>. Détail :{" "}
              <code className="text-amber-900/80">{dbError}</code>
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {cards.map(({ label, value, hint, icon: Icon, tone, href }) => (
          <Link
            key={label}
            href={href}
            className="group rounded-2xl border border-stone-200/90 bg-white p-4 hover:border-[#C6A664] hover:shadow-md transition-all shadow-2xs"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-stone-500">{label}</span>
              <span
                className={`h-8 w-8 rounded-xl border grid place-items-center shrink-0 ${tone}`}
              >
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3 text-3xl font-black tracking-tight tabular-nums text-stone-900">
              {value}
            </div>
            <div className="mt-1 text-xs text-stone-500">{hint}</div>
          </Link>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-stone-500">
            Pôles d’édition du site
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {workspaceCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.href}
                href={card.href}
                className="group rounded-2xl border border-stone-200/90 bg-white p-5 hover:border-[#C6A664] hover:shadow-md transition-all flex flex-col justify-between gap-4 shadow-2xs"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="h-10 w-10 rounded-xl bg-[#FAF8F3] border border-[#C6A664]/35 text-[#8A6D2F] grid place-items-center group-hover:bg-stone-900 group-hover:text-[#E5CA87] transition-colors">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-stone-100 text-stone-700 text-[11px] font-semibold">
                      {card.badge}
                    </span>
                  </div>
                  <h3 className="text-base font-black text-stone-900 group-hover:text-[#8A6D2F] transition-colors">
                    {card.title}
                  </h3>
                  <p className="mt-1.5 text-xs text-stone-500 leading-relaxed">
                    {card.desc}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-stone-900 group-hover:translate-x-0.5 transition-transform">
                  Ouvrir l’espace <ArrowRight className="h-3.5 w-3.5 text-[#B8923F]" />
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_1.45fr] gap-5 items-start">
        {daily.length > 0 ? (
          <div className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-stone-900">
                Demandes sur 14 jours
              </h2>
              <span className="text-xs text-stone-500">Par jour</span>
            </div>
            <div className="grid grid-cols-14 gap-1.5 items-end h-32">
              {daily.map((d) => (
                <div
                  key={d.day}
                  className="flex flex-col items-center gap-1 h-full justify-end"
                  title={`${d.day} : ${d.count}`}
                >
                  <div
                    className="w-full rounded-t-md bg-[#C6A664] transition-all"
                    style={{
                      height: `${Math.max(d.count > 0 ? 12 : 4, (d.count / maxDay) * 100)}%`,
                      opacity: d.count > 0 ? 1 : 0.2,
                    }}
                  />
                  <span className="text-[10px] text-stone-400 tabular-nums">
                    {d.day.slice(8)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-2xs">
            <h2 className="text-sm font-bold text-stone-900 mb-2">
              Raccourcis vers les pages publiques
            </h2>
            <p className="text-xs text-stone-500 mb-4 leading-relaxed">
              Vérifiez à tout moment le rendu public des pages du site :
            </p>
            <div className="space-y-2 text-xs font-semibold">
              <Link
                href="/apps"
                target="_blank"
                className="flex items-center justify-between rounded-xl border border-stone-200 bg-[#FAF9F6] px-3.5 py-2.5 text-stone-800 hover:border-[#C6A664]"
              >
                <span>Page « Nos applications » (/apps)</span>
                <ExternalLink className="h-3.5 w-3.5 text-[#8A6D2F]" />
              </Link>
              <Link
                href="/products"
                target="_blank"
                className="flex items-center justify-between rounded-xl border border-stone-200 bg-[#FAF9F6] px-3.5 py-2.5 text-stone-800 hover:border-[#C6A664]"
              >
                <span>Page « Produits numériques & logiciels » (/products)</span>
                <ExternalLink className="h-3.5 w-3.5 text-[#8A6D2F]" />
              </Link>
              <Link
                href="/demos"
                target="_blank"
                className="flex items-center justify-between rounded-xl border border-stone-200 bg-[#FAF9F6] px-3.5 py-2.5 text-stone-800 hover:border-[#C6A664]"
              >
                <span>Galerie complète des réalisations (/demos)</span>
                <ExternalLink className="h-3.5 w-3.5 text-[#8A6D2F]" />
              </Link>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-stone-200/90 bg-white overflow-hidden shadow-2xs">
          <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
            <h2 className="text-sm font-bold text-stone-900">Dernières demandes</h2>
            <Link
              href="/admin/leads"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#8A6D2F] hover:underline"
            >
              Tout voir <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="p-8 text-center text-sm text-stone-500">
              Aucune demande enregistrée pour le moment.
            </p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {recent.map((lead) => {
                const status = (LEAD_STATUSES as readonly string[]).includes(
                  lead.status,
                )
                  ? (lead.status as LeadStatus)
                  : "new";
                return (
                  <li
                    key={lead.id}
                    className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-sm hover:bg-stone-50/80"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-stone-900 truncate">
                        {lead.business}{" "}
                        <span className="text-stone-500 font-normal">
                          — {lead.name}
                        </span>
                      </div>
                      <div className="text-xs text-stone-500 truncate mt-0.5">
                        {lead.phone} · {lead.need} · {lead.budget}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-stone-400 tabular-nums">
                        {frDate(lead.createdAt)}
                      </span>
                      <StatusBadge status={status} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
