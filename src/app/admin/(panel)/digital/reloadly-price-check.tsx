"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, Info, Loader2 } from "lucide-react";
import {
  checkSupplierUnitPrice,
  formatPrices,
  type SupplierPriceProduct,
} from "@/lib/digital-order-core";
import { denominationUnitPrice, type DigitalDenomination } from "@/lib/digital-types";

interface ProductInfo extends SupplierPriceProduct {
  name?: string;
  country?: string;
}

interface LookupState {
  /** Produit pour lequel la réponse a été reçue (null = aucune requête). */
  productId: number | null;
  product?: ProductInfo;
  error?: string;
}

/**
 * Contrôle AVANT enregistrement des valeurs faciales Reloadly d'une fiche.
 *
 * Reloadly n'accepte que les montants exacts de son produit (`FIXED`) ou une
 * valeur dans sa fourchette (`RANGE`). Envoyer autre chose renvoyait
 * `WRONG_PRODUCT_PRICE` au moment de l'achat — donc APRÈS l'encaissement du
 * client. On affiche ici la vérité du fournisseur pendant la saisie.
 */
export function ReloadlyPriceCheck({
  productId,
  denominations,
}: {
  productId: number | null;
  denominations: DigitalDenomination[];
}) {
  const [lookup, setLookup] = useState<LookupState>({ productId: null });

  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    fetch(`/api/admin/reloadly/products?id=${productId}`, { cache: "no-store" })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          product?: ProductInfo;
          message?: string;
        };
        if (cancelled) return;
        if (!res.ok || !data.ok || !data.product) {
          setLookup({ productId, error: data.message ?? "Produit Reloadly illisible." });
          return;
        }
        setLookup({ productId, product: data.product });
      })
      .catch(() => {
        if (!cancelled) setLookup({ productId, error: "Serveur injoignable." });
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  if (!productId) {
    return (
      <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-[11.5px] leading-5 text-stone-600">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Aucun produit Reloadly relié : la fiche reste en livraison manuelle.
        Choisissez un produit ci-dessus pour activer l&apos;achat automatique.
      </p>
    );
  }

  // Pas encore de réponse pour CE produit : chargement (aucun setState ici).
  if (lookup.productId !== productId) {
    return (
      <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-stone-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Vérification des valeurs
        faciales auprès de Reloadly…
      </p>
    );
  }

  if (lookup.error || !lookup.product) {
    return (
      <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11.5px] leading-5 text-amber-800">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {lookup.error || "Produit Reloadly illisible."} Les valeurs faciales ne
        peuvent pas être vérifiées : contrôlez-les dans le tableau Reloadly.
      </p>
    );
  }

  const product = lookup.product;
  const currency = product.currencyCode ?? "";
  const isFixed = (product.denominationType ?? "").toUpperCase() === "FIXED";
  const accepted = isFixed
    ? `montants : ${formatPrices(product.fixedDenominations) || "—"}`
    : `prix libre : ${product.minDenomination ?? "?"}–${product.maxDenomination ?? "?"}`;

  const rows = denominations.map((denomination) => {
    const value = denominationUnitPrice(denomination);
    return { denomination, value, check: checkSupplierUnitPrice(product, value ?? 0) };
  });
  const invalid = rows.filter((row) => !row.check.ok);

  return (
    <div className="mt-2 rounded-lg border border-stone-200 bg-white px-3 py-2">
      <p className="text-[11.5px] leading-5 text-stone-600">
        <strong>Produit #{product.productId}</strong> · {product.name ?? ""}{" "}
        {product.country ? `· ${product.country}` : ""} {currency ? `· ${currency}` : ""} ·{" "}
        <span className="font-bold">{accepted}</span>
      </p>

      <ul className="mt-1.5 space-y-1">
        {rows.map(({ denomination, value, check }) => (
          <li
            key={denomination.id}
            className={`flex items-start gap-1.5 text-[11.5px] leading-5 ${
              check.ok ? "text-emerald-700" : "text-red-700"
            }`}
          >
            {check.ok ? (
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            ) : (
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            )}
            <span>
              <strong>{denomination.label}</strong>{" "}
              {value == null ? "— valeur Reloadly absente" : `→ ${value}`} · {check.message}
            </span>
          </li>
        ))}
      </ul>

      {invalid.length > 0 && (
        <p className="mt-1.5 rounded-md bg-red-50 px-2 py-1.5 text-[11.5px] font-bold leading-5 text-red-700">
          {invalid.length} montant{invalid.length > 1 ? "s" : ""} ne sera
          {invalid.length > 1 ? "ont" : ""} pas accepté
          {invalid.length > 1 ? "s" : ""} par Reloadly : l&apos;achat échouerait
          après le paiement du client. Corrigez la « Valeur Reloadly » avant
          d&apos;enregistrer.
        </p>
      )}
    </div>
  );
}
