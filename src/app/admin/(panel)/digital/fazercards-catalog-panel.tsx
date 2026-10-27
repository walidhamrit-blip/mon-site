import Link from "next/link";
import { ArrowUpRight, Package, ShieldCheck } from "lucide-react";
import type { DigitalProduct } from "@/lib/digital-types";
import { MARGIN_TIERS, MIN_RETAIL_USD } from "@/lib/fazercards-pricing";

/**
 * Panneau du catalogue FazerCards dans l'administration.
 *
 * ⚠️ Pourquoi ce panneau existe.
 *
 * L'éditeur historique (`DigitalEditor`) travaille sur la table
 * `digital_products` — les fiches Reloadly. Depuis la bascule, la boutique
 * publique ne sert PLUS ces fiches : elle sert le catalogue FazerCards, lu
 * chez le fournisseur. Résultat déroutant pour l'exploitant : l'admin
 * n'affichait que les anciennes fiches et laissait croire que la boutique
 * était vide ou « revenue à Reloadly ».
 *
 * Ce panneau rend visible ce que le client voit réellement (source
 * fournisseur), en lecture seule : les prix y sont CALCULÉS par le barème,
 * pas saisis, et modifier une fiche ici n'aurait aucun effet.
 */
export function FazercardsCatalogPanel({
  products,
  error,
  stale,
  fetchedAt,
}: {
  products: DigitalProduct[];
  error?: string;
  stale?: boolean;
  fetchedAt?: string | null;
}) {
  const denominations = products.flatMap((product) =>
    product.denominations.filter((item) => item.available),
  );
  const prices = denominations
    .map((item) => item.priceUsd)
    .filter((value) => Number.isFinite(value) && value > 0);
  const min = prices.length > 0 ? Math.min(...prices) : 0;
  const max = prices.length > 0 ? Math.max(...prices) : 0;

  // Répartition par tranche de marge, à partir du coût fournisseur.
  const tiers = MARGIN_TIERS.map((tier) => ({
    ...tier,
    count: denominations.filter((item) => {
      const cost = item.supplierCostUsd ?? 0;
      if (cost <= 0) return false;
      const upper = tier.maxCostUsd;
      return upper === null ? cost >= 60 : cost < upper;
    }).length,
  }));

  const sample = products.slice(0, 24);

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-2xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="inline-flex items-center gap-2 text-[15px] font-black text-stone-900">
            <Package className="h-4 w-4 text-[#B8923F]" />
            Catalogue réellement vendu — FazerCards
          </h2>
          <p className="mt-1 max-w-2xl text-[12px] leading-5 text-stone-600">
            C&apos;est cette liste que le client voit sur{" "}
            <Link href="/codes" className="font-bold text-[#8A6D2F] hover:underline">
              /codes
            </Link>
            . Elle vient du fournisseur, pas de la base : les prix sont calculés
            par le barème (marge dégressive + plancher), jamais saisis à la main.
            {fetchedAt ? ` Dernière synchronisation : ${fetchedAt}.` : ""}
          </p>
        </div>
        <Link
          href="/codes"
          target="_blank"
          className="inline-flex items-center gap-1 rounded-lg border border-stone-300 px-3 py-2 text-[12px] font-bold text-stone-700 hover:bg-stone-50"
        >
          Voir la boutique
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {error && (
        <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] leading-5 text-amber-950">
          <strong>Catalogue fournisseur indisponible :</strong> {error}
          <br />
          Vérifiez <code>FAZERCARDS_API_KEY</code> et le solde du compte. En
          attendant, la boutique publique sert la dernière copie connue.
        </div>
      )}

      {stale && !error && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11.5px] leading-5 text-amber-900">
          Copie servie depuis le cache : les prix peuvent dater de la dernière
          synchronisation. Utilisez <code>/api/fazercards/catalog?refresh=1</code>{" "}
          pour forcer une mise à jour.
        </div>
      )}

      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Fiches", value: products.length.toString() },
          { label: "Montants vendables", value: denominations.length.toString() },
          {
            label: "Prix min",
            value: min > 0 ? `${min.toFixed(2)} $` : "—",
          },
          {
            label: "Prix max",
            value: max > 0 ? `${max.toFixed(2)} $` : "—",
          },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2">
            <dt className="text-[10.5px] font-bold uppercase tracking-wide text-stone-500">
              {item.label}
            </dt>
            <dd className="text-[15px] font-black text-stone-900">{item.value}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-stone-500">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
        Prix public minimum {MIN_RETAIL_USD.toFixed(2)} $. Barème :
        {tiers.map((tier) => (
          <span key={tier.marginPercent} className="font-bold text-stone-700">
            {tier.marginPercent} % ({tier.count})
          </span>
        ))}
      </p>

      {sample.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-xl border border-stone-200">
          <table className="w-full text-left text-[12px]">
            <thead className="bg-stone-50 text-[10.5px] uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-3 py-2 font-bold">Fiche</th>
                <th className="px-3 py-2 font-bold">Montants</th>
                <th className="px-3 py-2 font-bold">Prix à partir de</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {sample.map((product) => {
                const available = product.denominations.filter((item) => item.available);
                const lowest = available.length > 0
                  ? Math.min(...available.map((item) => item.priceUsd))
                  : 0;
                return (
                  <tr key={product.slug}>
                    <td className="px-3 py-1.5 font-bold text-stone-800">
                      {product.platform}
                    </td>
                    <td className="px-3 py-1.5 text-stone-600">{available.length}</td>
                    <td className="px-3 py-1.5 text-stone-800">
                      {lowest > 0 ? `${lowest.toFixed(2)} $` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {products.length > sample.length && (
            <p className="border-t border-stone-100 bg-stone-50 px-3 py-1.5 text-[11px] text-stone-500">
              … et {products.length - sample.length} autres fiches.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
