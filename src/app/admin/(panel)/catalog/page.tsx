import { getSiteData } from "@/lib/store";
import { CatalogEditor } from "./catalog-editor";

export default async function AdminCatalogPage() {
  const { content } = await getSiteData();

  return (
    <div className="space-y-4">
      <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Pages secondaires /apps et /products : ce catalogue de projets à venir est distinct de la boutique /codes. Pour les produits vendus, utilisez « Catalogue & fournisseurs » dans Boutique digitale.
      </p>
    <CatalogEditor
      initialAppsPage={content.appsPage}
      initialProductsPage={content.productsPage}
    />
    </div>
  );
}
