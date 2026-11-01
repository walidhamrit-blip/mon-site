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
  // Catalogue réellement vendu : celui du fournisseur. Il ne vient PAS de la
  // base : le panneau fournisseur est la seule source de vente.
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
    liveError = "FAZERCARDS_API_KEY absent : configurez le fournisseur actif. Aucun ancien fournisseur ne doit être réactivé.";
  }
  // Couverture du plafond de vente par le solde fournisseur : sans ce
  // contrôle, une vente peut être encaissée alors que l'achat fournisseur est
  // impossible (le solde est débité du COÛT, pas du prix de vente).
  const balance = await getFazercardsBalanceStatus();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black text-stone-900">Boutique digitale — FazerCards</h1>
      <p className="text-sm text-stone-600">Gérez le catalogue actuel, le solde et la disponibilité. Les anciennes commandes restent consultables ; aucun ancien fournisseur n’est utilisé pour les nouvelles ventes.</p>
      <FazercardsBalancePanel status={balance} />

      <FazercardsCardIdFinder />

      <FazercardsCatalogPanel
        products={liveProducts}
        error={liveError}
        stale={liveStale}
        fetchedAt={liveFetchedAt}
      />


    </div>
  );
}
