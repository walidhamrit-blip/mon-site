import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { getDigitalCatalog, paymentFeePercent } from "@/lib/digital-store";
import { DigitalEditor } from "./digital-editor";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Codes & cartes cadeaux — Administration",
  robots: { index: false, follow: false },
};

export default async function AdminDigitalPage() {
  const products = await getDigitalCatalog({ publicOnly: false });
  return (
    <div className="space-y-4">
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
      <DigitalEditor initialProducts={products} paymentFeePercent={paymentFeePercent()} />
    </div>
  );
}
