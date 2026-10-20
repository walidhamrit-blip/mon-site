import type { ReactNode } from "react";
import { sql } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { leads, orders } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { AdminNav } from "./admin-nav";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Administration",
  robots: { index: false, follow: false },
};

export default async function AdminPanelLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAdmin();

  let newLeads = 0;
  let paidOrders = 0;
  try {
    await ensureSchema();
    const [[leadAgg], [orderAgg]] = await Promise.all([
      db.select({
        newCount: sql<number>`count(*) filter (where ${leads.status} = 'new')::int`,
      }).from(leads),
      db.select({
        paidCount: sql<number>`count(*) filter (where ${orders.status} = 'paid')::int`,
      }).from(orders),
    ]);
    newLeads = Number(leadAgg?.newCount ?? 0);
    paidOrders = Number(orderAgg?.paidCount ?? 0);
  } catch {
    // La bannière d'état de la base s'affiche dans la page.
  }

  return (
    <div
      dir="ltr"
      style={{ colorScheme: "light" }}
      className="min-h-screen bg-[#F6F5F1] text-stone-900 lg:flex"
    >
      <AdminNav newLeads={newLeads} paidOrders={paidOrders} />
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
        {children}
      </main>
    </div>
  );
}
