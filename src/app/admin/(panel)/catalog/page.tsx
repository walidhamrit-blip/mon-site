import { getSiteData } from "@/lib/store";
import { CatalogEditor } from "./catalog-editor";

export default async function AdminCatalogPage() {
  const { content } = await getSiteData();

  return (
    <CatalogEditor
      initialAppsPage={content.appsPage}
      initialProductsPage={content.productsPage}
    />
  );
}
