import Link from "next/link";
import { ShoppingBag, TriangleAlert } from "lucide-react";
import { getDigitalCatalog, paymentFeePercent } from "@/lib/digital-store";
import { faceValueLosses } from "@/lib/digital-audit";
import { nowPaymentsSandbox } from "@/lib/nowpayments";
import { reloadlyMode } from "@/lib/reloadly";
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
  const envMismatch = !nowPaymentsSandbox() && reloadlyMode() === "sandbox";
  // Contrôle immédiat SANS réseau. Deux niveaux distincts :
  //  • perte PROUVÉE = frais ET remise connus (mémorisés sur la fiche) ;
  //  • à VÉRIFIER   = prix sous la valeur faciale, remise inconnue — une
  //    remise Reloadly peut rendre la vente rentable (ex. 60 $ à 59,50 $).
  const rentability = faceValueLosses(products);
  const proven = rentability.filter((entry) => entry.verdict === "loss");
  const suspects = rentability.filter((entry) => entry.verdict === "suspect");
  const fichesOf = (entries: typeof rentability) =>
    Array.from(new Set(entries.map((entry) => entry.ficheTitle)));

  return (
    <div className="space-y-4">
      {envMismatch && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-[12.5px] leading-5 text-amber-950">
          <p className="inline-flex items-center gap-2 text-[13.5px] font-black text-amber-900">
            <TriangleAlert className="h-4 w-4" />
            Paiements réels NOWPayments + Reloadly encore en mode Sandbox (test)
          </p>
          <p className="mt-1">
            Les clients paient avec de vrais USDT, mais Reloadly émet encore des{" "}
            <strong>codes de test</strong>. Pour vendre en réel : passez votre tableau
            Reloadly sur <strong>LIVE</strong>, créditez le solde marchand, puis remplacez{" "}
            <code>RELOADLY_CLIENT_ID</code>, <code>RELOADLY_CLIENT_SECRET</code> et ajoutez{" "}
            <code>RELOADLY_SANDBOX=false</code> sur Vercel avant de redéployer.
          </p>
        </div>
      )}

      {proven.length > 0 && (
        <div className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3">
          <p className="inline-flex items-center gap-2 text-[13.5px] font-black text-red-800">
            <TriangleAlert className="h-4 w-4" />
            {proven.length} montant(s) vendus sous leur coût réel — perte d&apos;argent à chaque vente
          </p>
          <p className="mt-1 text-[12px] leading-5 text-red-800">
            {proven
              .slice(0, 6)
              .map((entry) => `${entry.ficheTitle} · ${entry.label} : ${entry.message}`)
              .join(" · ")}
            {proven.length > 6 ? ` … +${proven.length - 6}` : ""}
          </p>
          <p className="mt-1 text-[11.5px] text-red-700">
            Fiches concernées : {fichesOf(proven).slice(0, 8).join(", ")} — corrigez les prix
            (bloc « Audit &amp; recalcul ») ou désactivez ces montants.
          </p>
        </div>
      )}

      {suspects.length > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3">
          <p className="inline-flex items-center gap-2 text-[13.5px] font-black text-amber-900">
            <TriangleAlert className="h-4 w-4" />
            {suspects.length} montant(s) sous la valeur faciale — à vérifier, pas forcément une perte
          </p>
          <p className="mt-1 text-[12px] leading-5 text-amber-900">
            {suspects
              .slice(0, 6)
              .map((entry) => `${entry.ficheTitle} · ${entry.label} : ${entry.message}`)
              .join(" · ")}
            {suspects.length > 6 ? ` … +${suspects.length - 6}` : ""}
          </p>
          <p className="mt-1 text-[11.5px] text-amber-800">
            Frais et remise du fournisseur inconnus sur ces fiches. Lancez une révision du
            produit (« Réviser le catalogue depuis Reloadly ») : la remise sera mémorisée et
            l&apos;alerte disparaîtra si la vente est rentable.
          </p>
        </div>
      )}

      <CatalogAudit paymentFeePercent={paymentFeePercent()} />
      <ReloadlySync paymentFeePercent={paymentFeePercent()} />
      <DigitalEditor initialProducts={products} paymentFeePercent={paymentFeePercent()} />
    </div>
  );
}
