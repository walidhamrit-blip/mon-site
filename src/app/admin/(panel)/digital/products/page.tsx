import { getAdminBoutiqueCatalog } from "@/lib/digital-store";
import { resolveFazercardsMaxOrderUsd } from "@/lib/store";
import { BoutiqueProductsManager } from "./boutique-products-manager";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Modifier les produits & SEO/GEO — Administration",
  robots: { index: false, follow: false },
};

export default async function AdminBoutiqueProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const [params, catalog, maxOrderUsd] = await Promise.all([
    searchParams,
    getAdminBoutiqueCatalog(),
    resolveFazercardsMaxOrderUsd(),
  ]);

  return (
    <BoutiqueProductsManager
      initialProducts={catalog.products}
      baseById={catalog.baseById}
      deletedProducts={catalog.deletedProducts}
      overriddenIds={catalog.overriddenIds}
      customIds={catalog.customIds}
      source={catalog.source}
      fetchedAt={catalog.fetchedAt}
      maxOrderUsd={maxOrderUsd}
      initialEditSlug={params.edit}
    />
  );
}
