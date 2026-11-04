import { ClipboardCheck } from "lucide-react";
import { listDeliveries } from "@/lib/deliveries";
import { DeliveriesManager } from "./deliveries-manager";

export const dynamic = "force-dynamic";

/**
 * Livraisons & recette — remise des clés d'un projet web.
 *
 * Chaque dossier génère un lien privé `/livraison/<ref>?t=<jeton>` : le client
 * y consulte le récapitulatif et valide la recette d'un clic (horodaté).
 * Démarche complète : docs/livraison-site-apres-paiement-2026-11-04.md
 */
export default async function AdminDeliveriesPage() {
  let rows: Awaited<ReturnType<typeof listDeliveries>> = [];
  let dbError: string | null = null;
  try {
    rows = await listDeliveries();
  } catch (error) {
    dbError = error instanceof Error ? error.message.slice(0, 200) : String(error);
  }

  const pending = rows.filter((row) => row.status === "delivered").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-stone-900">
            Livraisons &amp; recette
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            Remise des clés d’un projet web : liens, éléments livrés, garantie et
            validation signée par le client.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700">
          <ClipboardCheck className="h-4 w-4 text-stone-500" />
          {pending} en attente de validation · {rows.length} dossier
          {rows.length > 1 ? "s" : ""}
        </span>
      </div>

      {dbError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Base de données inaccessible — vérifiez <code>DATABASE_URL</code> sur Vercel.
          <p className="mt-1 text-xs text-red-700">{dbError}</p>
        </div>
      ) : (
        <DeliveriesManager rows={rows} />
      )}
    </div>
  );
}
