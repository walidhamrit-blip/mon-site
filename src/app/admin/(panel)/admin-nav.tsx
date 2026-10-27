"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Inbox,
  Wallet,
  Repeat,
  Blocks,
  Globe,
  AppWindow,
  FileText,
  Gift,
  ShoppingBag,
  Settings,
  ExternalLink,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { logout } from "@/app/admin/actions";

interface Props {
  newLeads: number;
  paidOrders: number;
}

interface NavGroup {
  title: string;
  items: {
    href: string;
    label: string;
    sublabel: string;
    icon: typeof LayoutDashboard;
    exact?: boolean;
    badge?: number;
    badgeTone?: "amber" | "emerald";
  }[];
}

export function AdminNav({ newLeads, paidOrders }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const groups: NavGroup[] = [
    {
      title: "Pilotage & Activité",
      items: [
        {
          href: "/admin",
          label: "Vue d’ensemble",
          sublabel: "Indicateurs & accès directs",
          icon: LayoutDashboard,
          exact: true,
        },
        {
          href: "/admin/leads",
          label: "Demandes clients",
          sublabel: "Devis, suivi & avis WhatsApp",
          icon: Inbox,
          badge: newLeads,
          badgeTone: "amber",
        },
        {
          href: "/admin/orders",
          label: "Paiements & acomptes",
          sublabel: "Transactions crypto & 1 $",
          icon: Wallet,
          badge: paidOrders,
          badgeTone: "emerald",
        },
        {
          href: "/admin/subscriptions",
          label: "Abonnements",
          sublabel: "Abonnés & revenu récurrent",
          icon: Repeat,
        },
      ],
    },
    {
      title: "Architecture & Catalogues",
      items: [
        {
          href: "/admin/sections",
          label: "Sections & Sites",
          sublabel: "Ajouter / supprimer sections & sites",
          icon: Blocks,
        },
        {
          href: "/admin/sites",
          label: "Galerie des sites",
          sublabel: "Portfolio client & SEO IA",
          icon: Globe,
        },
        {
          href: "/admin/catalog",
          label: "Applications & Logiciels",
          sublabel: "Pages Prochainement / En prép.",
          icon: AppWindow,
        },
        {
          href: "/admin/digital",
          label: "Codes & Cartes cadeaux",
          sublabel: "Catalogue digital & montants",
          icon: Gift,
        },
        {
          href: "/admin/digital/orders",
          label: "Commandes de codes",
          sublabel: "Livraison FazerCards & relances",
          icon: ShoppingBag,
        },
      ],
    },
    {
      title: "Contenus & Système",
      items: [
        {
          href: "/admin/content",
          label: "Textes, FAQ & Avis",
          sublabel: "Accueil, arguments & étapes",
          icon: FileText,
        },
        {
          href: "/admin/settings",
          label: "Réglages & Tarifs",
          sublabel: "Thème, contacts & formules",
          icon: Settings,
        },
      ],
    },
  ];

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  const navContent = (
    <div className="flex flex-col h-full justify-between gap-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between px-1">
          <Link
            href="/admin"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3"
          >
            <div className="h-9 w-9 rounded-xl bg-stone-900 text-[#E5CA87] grid place-items-center font-black shadow-xs">
              ن
            </div>
            <div>
              <div className="text-sm font-black tracking-tight text-stone-900">
                Nukhba Studio
              </div>
              <div className="text-[11px] font-medium text-stone-500">
                Panneau d’administration
              </div>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fermer le menu"
            className="lg:hidden h-8 w-8 rounded-lg border border-stone-200 grid place-items-center text-stone-500 hover:bg-stone-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="space-y-5">
          {groups.map((group) => (
            <div key={group.title}>
              <div className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-stone-400">
                {group.title}
              </div>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href, item.exact);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={`group flex items-center justify-between gap-2.5 rounded-xl px-3 py-2.5 transition-all ${
                        active
                          ? "bg-[#C6A664]/16 text-stone-950 ring-1 ring-[#C6A664]/45 shadow-2xs"
                          : "text-stone-600 hover:bg-stone-100/90 hover:text-stone-900"
                      }`}
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`h-8 w-8 rounded-lg grid place-items-center shrink-0 transition-colors ${
                            active
                              ? "bg-stone-900 text-[#E5CA87]"
                              : "bg-stone-100 text-stone-600 group-hover:bg-white"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[13px] font-bold leading-tight truncate">
                            {item.label}
                          </span>
                          <span className="block text-[11px] text-stone-400 leading-tight truncate mt-0.5">
                            {item.sublabel}
                          </span>
                        </span>
                      </span>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span
                          className={`min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold grid place-items-center shrink-0 ${
                            item.badgeTone === "emerald"
                              ? "bg-emerald-600 text-white"
                              : "bg-[#B8923F] text-white"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      <div className="space-y-1.5 border-t border-stone-200 pt-4 text-sm">
        <div className="grid grid-cols-3 gap-1 pb-1">
          <Link
            href="/"
            target="_blank"
            className="rounded-lg border border-stone-200 bg-[#FAF9F6] px-2 py-1.5 text-center text-[11px] font-semibold text-stone-700 hover:bg-stone-100"
          >
            Accueil ↗
          </Link>
          <Link
            href="/apps"
            target="_blank"
            className="rounded-lg border border-stone-200 bg-[#FAF9F6] px-2 py-1.5 text-center text-[11px] font-semibold text-stone-700 hover:bg-stone-100"
          >
            Apps ↗
          </Link>
          <Link
            href="/products"
            target="_blank"
            className="rounded-lg border border-stone-200 bg-[#FAF9F6] px-2 py-1.5 text-center text-[11px] font-semibold text-stone-700 hover:bg-stone-100"
          >
            Produits ↗
          </Link>
          <Link
            href="/codes"
            target="_blank"
            className="rounded-lg border border-stone-200 bg-[#FAF9F6] px-2 py-1.5 text-center text-[11px] font-semibold text-stone-700 hover:bg-stone-100"
          >
            Codes ↗
          </Link>
        </div>

        <Link
          href="/"
          target="_blank"
          className="flex items-center justify-between rounded-xl px-3 py-2 text-stone-600 hover:bg-stone-100 hover:text-stone-900 font-medium"
        >
          <span>Ouvrir le site public</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
        <form action={logout}>
          <button
            type="submit"
            className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-stone-500 hover:bg-red-50 hover:text-red-700 cursor-pointer font-medium transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>Déconnexion</span>
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {/* Barre mobile claire */}
      <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between border-b border-stone-200 bg-white/95 backdrop-blur px-4 h-14">
        <Link href="/admin" className="flex items-center gap-2 font-black text-stone-900">
          <span className="h-7 w-7 rounded-lg bg-stone-900 text-[#E5CA87] grid place-items-center text-sm">
            ن
          </span>
          <span>Nukhba Admin</span>
        </Link>
        <div className="flex items-center gap-2">
          {newLeads > 0 && (
            <Link
              href="/admin/leads?status=new"
              className="px-2.5 py-0.5 rounded-full bg-[#B8923F] text-white text-xs font-bold"
            >
              {newLeads} nouv.
            </Link>
          )}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Ouvrir le menu"
            className="h-9 w-9 rounded-lg border border-stone-200 bg-stone-50 grid place-items-center text-stone-700"
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Tiroir mobile */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="w-76 max-w-[85vw] bg-white border-r border-stone-200 p-4 overflow-y-auto shadow-2xl">
            {navContent}
          </div>
          <button
            type="button"
            aria-label="Fermer"
            onClick={() => setOpen(false)}
            className="flex-1 bg-stone-950/35 backdrop-blur-[1px]"
          />
        </div>
      )}

      {/* Colonne fixe bureau */}
      <aside className="hidden lg:block w-72 shrink-0 border-r border-stone-200/90 bg-white p-5 sticky top-0 h-screen overflow-y-auto">
        {navContent}
      </aside>
    </>
  );
}
