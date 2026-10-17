import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth";
import { AdminNav } from "./admin-nav";

export const metadata = {
  title: "Administration",
  robots: { index: false, follow: false },
};

// Layout du panneau d'administration : toute page sous /admin/(panel)
// redirige vers la connexion si la session est invalide.
export default async function PanelLayout({ children }: { children: ReactNode }) {
  await requireAdmin();

  return (
    <div dir="ltr" className="min-h-screen bg-[#0A0A0F] text-zinc-100">
      <AdminNav />
      <div className="lg:ps-64">
        <main className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
