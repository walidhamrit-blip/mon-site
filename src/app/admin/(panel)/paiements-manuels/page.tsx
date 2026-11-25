import Link from "next/link";
import type { Metadata } from "next";
import { ManualPaymentsTable } from "./manual-payments-table";
import { listManualPayments } from "@/lib/manual-payments";


export const metadata: Metadata = {
  title: "Paiements manuels — Admin",
};

export const dynamic = "force-dynamic";

/**
 * File de vérification des virements manuels (Skrill / Neteller / Airtm / D17 / Volet / WebMoney / Kashy), tous tunnels confondus :
 * codes digitaux, projets web, abonnements.
 */
export default async function AdminManualPaymentsPage() {
  let rows: Awaited<ReturnType<typeof listManualPayments>> = [];
  let error: string | null = null;
  try {
    rows = await listManualPayments(200);
  } catch (cause) {
    error = cause instanceof Error ? cause.message : String(cause);
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[20px] font-black text-stone-900">Paiements manuels</h1>
          <p className="mt-1 max-w-3xl text-[12.5px] leading-6 text-stone-600">
            Virements et transferts reçus hors passerelle (Binance Pay, OKX, Bybit, RedotPay, USDT direct, Skrill, Neteller, Airtm, D17, Volet, WebMoney et Kashy). Rien
            n’est livré et aucun achat fournisseur n’est déclenché avant votre
            acceptation.
          </p>
        </div>
        <Link
          href="/admin/settings?tab=manual-payments"
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-[#C6A664]/50 bg-[#C6A664]/10 px-4 py-2.5 text-xs font-bold text-[#8A6D2F] transition-colors hover:bg-[#C6A664]/20"
        >
          Configurer les comptes →
        </Link>
      </header>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12.5px] font-semibold text-red-800">
          Impossible de charger la file : {error}
        </p>
      ) : (
        <ManualPaymentsTable rows={rows} />
      )}
    </div>
  );
}
