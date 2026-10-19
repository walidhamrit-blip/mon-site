import { getSiteData } from "@/lib/store";
import type { PricingPlanData, SiteContent } from "@/lib/site-types";
import { ContentEditor } from "./content-editor";

export const dynamic = "force-dynamic";

export default async function ContentPage() {
  const { config, content } = await getSiteData();
  const initial = JSON.parse(JSON.stringify(content)) as SiteContent;
  const plans = JSON.parse(
    JSON.stringify(config.pricing.plans),
  ) as PricingPlanData[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-white">Contenu &amp; sections</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Toutes les sections du site public : bloc d&apos;accueil, bandeau de
          services, « Pourquoi nous », démos, processus, témoignages, FAQ, ainsi
          que les titres de chaque section. Chaque démo possède une classification
          (catégorie + prix) modifiable dans sa fiche. Laisser une liste vide
          revient aux valeurs par défaut.
        </p>
      </div>
      <ContentEditor initial={initial} plans={plans} />
    </div>
  );
}
