import Link from "next/link";
import { ShoppingBag, TriangleAlert } from "lucide-react";
import { getDigitalCatalog, paymentFeePercent } from "@/lib/digital-store";
import { faceValueLosses } from "@/lib/digital-audit";
import { DigitalEditor } from "./digital-editor";
import { ReloadlySync } from "./reloadly-sync";
import { CatalogAudit } from "./catalog-audit";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Codes & cartes cadeaux — Administration",
  robots: { index: false, follow: false },
};

export default async function AdminDigitalPage() {
  const products = await getDigitalCatalog({ publicOnly: false });
  // Contrôle immédiat SANS réseau : un prix inférieur à la valeur faciale est
  // déjà une perte, inutile d'attendre l'analyse Reloadly pour le voir.
  const losses = faceValueLosses(products);
  const lossFiches = Array.from(new Set(losses.map((loss) => loss.ficheTitle)));

  return (
    <div className="space-y-4">
      {losses.length > 0 && (
        <div className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3">
          <p className="inline-flex items-center gap-2 text-[13.5px] font-black text-red-800">
            <TriangleAlert className="h-4 w-4" />
            {losses.length} montant(s) vendus sous leur valeur faciale — perte d&apos;argent à chaque vente
          </p>
          <p className="mt-1 text-[12px] leading-5 text-red-800">
            {losses
              .slice(0, 6)
              .map(
                (loss) =>
                  `${loss.ficheTitle} · ${loss.label} : ${loss.price.toFixed(2)} $ pour une valeur de ${loss.face} $`,
              )
              .join(" · ")}
            {losses.length > 6 ? ` … +${losses.length - 6}` : ""}
          </p>
          <p className="mt-1 text-[11.5px] text-red-700">
            Fiches concernées : {lossFiches.slice(0, 8).join(", ")}
            {lossFiches.length > 8 ? ` … +${lossFiches.length - 8}` : ""} — corrigez les
            prix (bloc « Audit &amp; recalcul ») ou désactivez ces montants.
          </p>
        </div>
      )}
      <Link
        href="/admin/digital/orders"
        className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-bold text-stone-800 shadow-2xs transition-colors hover:border-[#C6A664]"
      >
        <span className="inline-flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 text-[#8A6D2F]" />
          Commandes de codes — livraison Reloadly
        </span>
        <span className="text-[12px] font-semibold text-stone-500">
          Solde, relances et codes livrés →
        </span>
      </Link>
      <CatalogAudit paymentFeePercent={paymentFeePercent()} />
      <ReloadlySync paymentFeePercent={paymentFeePercent()} />
      <DigitalEditor initialProducts={products} paymentFeePercent={paymentFeePercent()} />
    </div>
  );
}
