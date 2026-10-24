import { getDigitalCatalog } from "@/lib/digital-store";
import { DigitalEditor } from "./digital-editor";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Codes & cartes cadeaux — Administration",
  robots: { index: false, follow: false },
};

export default async function AdminDigitalPage() {
  const products = await getDigitalCatalog({ publicOnly: false });
  return <DigitalEditor initialProducts={products} />;
}
