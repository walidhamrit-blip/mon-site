import Link from "next/link";
import { ShoppingBag, TriangleAlert } from "lucide-react";
import { getDigitalCatalog, paymentFeePercent } from "@/lib/digital-store";
import { faceValueLosses } from "@/lib/digital-audit";
import { nowPaymentsSandbox } from "@/lib/nowpayments";
import { reloadlyMode } from "@/lib/reloadly";
import { DigitalEditor } from "./digital-editor";
import { ReloadlySync } from "./reloadly-sync";
import { CatalogAudit } from "./catalog-audit";
import { FazercardsCatalogPanel } from "./fazercards-catalog-panel";
import { FazercardsBalancePanel } from "./fazercards-balance-panel";
import { FazercardsCardIdFinder } from "./fazercards-card-id-finder";
import { getFazercardsBalanceStatus } from "@/lib/fazercards-balance";
import { getFazercardsDigitalCatalog } from "@/lib/fazercards-catalog";
import { fazercardsConfigured } from "@/lib/fazercards";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Codes & cartes cadeaux — Administration",
  robots: { index: false, follow: false },
};

export default async function AdminDigitalPage() {
  const products = await getDigitalCatalog({ publicOnly: false });

  // Catalogue réellement vendu : celui du fournisseur. Il ne vient PAS de la
  // base, donc l'éditeur ci-dessous ne le montre pas — d'où ce panneau dédié.
  let liveProducts: Awaited<ReturnType<typeof getFazercardsDigitalCatalog>>["products"] = [];
  let liveError: string | undefined;
  let liveStale = false;
  let liveFetchedAt: string | null = null;
  if (fazercardsConfigured()) {
    try {
      const live = await getFazercardsDigitalCatalog({ noSync: true });
      liveProducts = live.products;
      liveStale = live.stale;
      liveFetchedAt = live.fetchedAt ?? null;
    } catch (error) {
      liveError = error instanceof Error ? error.message : String(error);
    }
  } else {
    liveError = "FAZERCARDS_API_KEY absent : la boutique publique sert le catalogue de la base.";
  }
  // Couverture du plafond de vente par le solde fournisseur : sans ce
  // contrôle, une vente peut être encaissée alors que l'achat fournisseur est
  // impossible (le solde est débité du COÛT, pas du prix de vente).
  const balance = await getFazercardsBalanceStatus();

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
            Les clients paient de vrais USDT, mais Reloadly est encore en{" "}
            <strong>mode test</strong>. Ce fournisseur n&apos;est plus utilisé : les
            ventes automatiques passent par <strong>FazerCards</strong> (voir le
            panneau « Catalogue réellement vendu »). Les fiches Reloadly ne servent
            plus qu&apos;aux commandes passées — inutile de migrer les identifiants
            vers LIVE.
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

      <FazercardsBalancePanel status={balance} />

      <FazercardsCardIdFinder />

      <FazercardsCatalogPanel
        products={liveProducts}
        error={liveError}
        stale={liveStale}
        fetchedAt={liveFetchedAt}
      />

      <CatalogAudit paymentFeePercent={paymentFeePercent()} />
      <div className="rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-[12px] leading-5 text-stone-700">
        <p className="font-black text-stone-800">
          Section ci-dessous : fiches historiques de la base (Reloadly) — NON vendues
        </p>
        <p className="mt-1">
          Depuis la bascule sur FazerCards, la boutique publique ne sert plus ces
          fiches : elles restent modifiables ici pour l&apos;archive et les
          commandes passées, mais les modifier ne change rien à ce que voit le
          client. Le catalogue vendu est celui du panneau « FazerCards » ci-dessus.
        </p>
      </div>

      <ReloadlySync paymentFeePercent={paymentFeePercent()} />
      <DigitalEditor initialProducts={products} paymentFeePercent={paymentFeePercent()} />
    </div>
  );
}
