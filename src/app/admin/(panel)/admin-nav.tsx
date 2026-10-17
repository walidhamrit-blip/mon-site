"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Inbox,
  Settings2,
  FileText,
  LogOut,
  ExternalLink,
} from "lucide-react";
import { logout } from "@/app/admin/actions";

const links = [
  { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/admin/leads", label: "Demandes", icon: Inbox },
  { href: "/admin/settings", label: "Configuration", icon: Settings2 },
  { href: "/admin/content", label: "Contenu", icon: FileText },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav() {
  const pathname = usePathname();

  return (
    <>
      {/* Barre latérale (desktop) */}
      <aside className="hidden lg:flex fixed inset-y-0 start-0 z-40 w-64 flex-col border-e border-white/10 bg-[#0E0E14]">
        <div className="flex items-center gap-3 px-5 h-16 border-b border-white/10">
          <div className="h-9 w-9 rounded-xl bg-[#C6A664] text-black grid place-items-center font-black">
            N
          </div>
          <div className="leading-tight">
            <div className="font-black text-white">Nukhba</div>
            <div className="text-[11px] text-zinc-500 uppercase tracking-widest">Admin</div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {links.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 h-11 px-3.5 rounded-xl text-sm font-semibold transition-colors ${
                  active
                    ? "bg-[#C6A664]/15 text-[#E8D5A9] border border-[#C6A664]/30"
                    : "text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent"
                }`}
              >
                <link.icon className="h-4 w-4 flex-shrink-0" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 space-y-1 border-t border-white/10">
          <Link
            href="/"
            className="flex items-center gap-3 h-10 px-3.5 rounded-xl text-sm text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <ExternalLink className="h-4 w-4" /> Voir le site
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="w-full flex items-center gap-3 h-10 px-3.5 rounded-xl text-sm text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4" /> Déconnexion
            </button>
          </form>
        </div>
      </aside>

      {/* Barre supérieure (mobile) */}
      <header className="lg:hidden sticky top-0 z-40 bg-[#0E0E14]/95 backdrop-blur border-b border-white/10">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-[#C6A664] text-black grid place-items-center font-black text-sm">
              N
            </div>
            <span className="font-black text-white text-sm">Nukhba Admin</span>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="h-9 px-3 rounded-lg text-xs font-semibold text-zinc-400 hover:text-red-400 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" /> Quitter
            </button>
          </form>
        </div>
        <nav className="flex gap-1 px-3 pb-2 overflow-x-auto">
          {links.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 h-8 rounded-lg text-xs font-semibold inline-flex items-center whitespace-nowrap transition-colors ${
                  active
                    ? "bg-[#C6A664]/15 text-[#E8D5A9]"
                    : "text-zinc-400 hover:text-white bg-white/5"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </header>
    </>
  );
}
