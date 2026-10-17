import { getSiteData } from "@/lib/store";
import type { SiteContent } from "@/lib/site-types";
import { ContentEditor } from "./content-editor";

export const dynamic = "force-dynamic";

export default async function ContentPage() {
  const { content } = await getSiteData();
  const initial = JSON.parse(JSON.stringify(content)) as SiteContent;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-white">Contenu</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Galerie de démos, témoignages et questions fréquentes affichés sur le site
          public. Laisser une liste vide revient aux valeurs par défaut.
        </p>
      </div>
      <ContentEditor initial={initial} />
    </div>
  );
}
