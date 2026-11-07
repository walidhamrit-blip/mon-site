import { Wallet } from "lucide-react";
import {
  listClientCredits,
  listCreditMovements,
  totalOutstandingLyd,
} from "@/lib/client-credits";
import { displayLyd } from "@/lib/client-credits-core";
import { ClientCreditsManager } from "./client-credits-manager";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Soldes clients — Administration",
  robots: { index: false, follow: false },
};

/**
 * Soldes dus aux clients.
 *
 * Cas d'origine : un client paie une carte de recharge de 30,00 LYD pour une
 * commande de 17,96 LYD. Les 12,04 LYD restants lui appartiennent : ils sont
 * suivis ici, mouvement par mouvement, jusqu'à utilisation ou remboursement.
 */
export default async function AdminClientCreditsPage() {
  let credits: Awaited<ReturnType<typeof listClientCredits>> = [];
  let movements: Awaited<ReturnType<typeof listCreditMovements>> = [];
  let total = "0.00";
  let dbError: string | null = null;

  try {
    [credits, movements, total] = await Promise.all([
      listClientCredits(200),
      listCreditMovements(100),
      totalOutstandingLyd(),
    ]);
  } catch (error) {
    dbError = error instanceof Error ? error.message.slice(0, 240) : String(error);
  }

  const withBalance = credits.filter((credit) => Number(credit.balanceLyd) > 0).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-black tracking-tight text-stone-900">Soldes clients</h1>
          <p className="mt-1 max-w-2xl text-sm text-stone-600">
            Argent dû aux clients — trop-perçu d&rsquo;une carte de recharge, geste commercial.
            Chaque variation est un <strong>mouvement</strong> : rien ne se modifie à la main sans
            trace.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700">
          <Wallet className="h-4 w-4 text-stone-500" />
          {displayLyd(total)} dus · {withBalance} client{withBalance > 1 ? "s" : ""}
        </span>
      </div>

      {dbError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Base de données inaccessible — vérifiez <code>DATABASE_URL</code> sur Vercel.
          <p className="mt-1 text-xs text-red-700">{dbError}</p>
        </div>
      ) : (
        <ClientCreditsManager credits={credits} movements={movements} />
      )}
    </div>
  );
}
