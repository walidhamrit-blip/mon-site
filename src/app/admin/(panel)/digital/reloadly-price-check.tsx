"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, Info, Loader2 } from "lucide-react";
import {
  checkSupplierUnitPrice,
  computeSalePrice,
  formatPrices,
  type SupplierPriceProduct,
} from "@/lib/digital-order-core";
import { denominationUnitPrice, type DigitalDenomination } from "@/lib/digital-types";

/**
 * Produit tel que renvoyé par `/api/admin/reloadly/products` (forme publique).
 * Attention : l'API parle `type` / `currency` — le noyau, lui, attend
 * `denominationType` / `currencyCode`.
 */
export interface ReloadlyProductInfo {
  productId: number;
  name?: string;
  country?: string;
  currency?: string;
  type?: string;
  fixedDenominations: number[];
  minDenomination: number | null;
  maxDenomination: number | null;
  senderFeePercentage?: number;
  discountPercentage?: number;
}

interface LookupState {
  /** Produit pour lequel la réponse a été reçue (null = aucune requête). */
  productId: number | null;
  product?: ReloadlyProductInfo;
  error?: string;
}

const money = (value: number) => `${value.toFixed(2)} $`;

/**
 * Contrôle AVANT enregistrement des valeurs faciales Reloadly d'une fiche,
 * et calcul du prix de vente à partir de la marge nette.
 *
 * Reloadly n'accepte que les montants exacts de son produit (`FIXED`) ou une
 * valeur dans sa fourchette (`RANGE`). Envoyer autre chose renvoyait
 * `WRONG_PRODUCT_PRICE` au moment de l'achat — donc APRÈS l'encaissement du
 * client. On affiche ici la vérité du fournisseur pendant la saisie.
 */
export function ReloadlyPriceCheck({
  productId,
  denominations,
  marginPercent,
  paymentFeePercent,
  onLoaded,
}: {
  productId: number | null;
  denominations: DigitalDenomination[];
  marginPercent: number | null;
  paymentFeePercent: number;
  onLoaded?: (fees: { senderFeePercentage: number; discountPercentage: number }) => void;
}) {
  const [lookup, setLookup] = useState<LookupState>({ productId: null });

  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    fetch(`/api/admin/reloadly/products?id=${productId}`, { cache: "no-store" })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          product?: ReloadlyProductInfo;
          message?: string;
        };
        if (cancelled) return;
        if (!res.ok || !data.ok || !data.product) {
          setLookup({ productId, error: data.message ?? "Produit Reloadly illisible." });
          return;
        }
        setLookup({ productId, product: data.product });
        onLoaded?.({
          senderFeePercentage: Number(data.product.senderFeePercentage ?? 0),
          discountPercentage: Number(data.product.discountPercentage ?? 0),
        });
      })
      .catch(() => {
        if (!cancelled) setLookup({ productId, error: "Serveur injoignable." });
      });
    return () => {
      cancelled = true;
    };
    // `onLoaded` est recréé à chaque rendu : on ne le met pas en dépendance
    // pour éviter une boucle de requêtes (la fiche, elle, ne change pas).
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        faciales et des frais auprès de Reloadly…
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

  const info = lookup.product;
  // L'API renvoie `type` / `currency` ; le noyau attend les noms Reloadly.
  const supplier: SupplierPriceProduct = {
    denominationType: info.type ?? "",
    fixedDenominations: info.fixedDenominations ?? [],
    minDenomination: info.minDenomination,
    maxDenomination: info.maxDenomination,
    currencyCode: info.currency ?? "",
    productId: info.productId,
  };
  const currency = supplier.currencyCode;
  const isFixed = (supplier.denominationType ?? "").toUpperCase() === "FIXED";
  const accepted = isFixed
    ? `montants : ${formatPrices(supplier.fixedDenominations) || "—"}`
    : `prix libre : ${supplier.minDenomination ?? "?"}–${supplier.maxDenomination ?? "?"}`;
  const senderFee = Number(info.senderFeePercentage ?? 0);
  const discount = Number(info.discountPercentage ?? 0);

  const rows = denominations.map((denomination) => {
    const value = denominationUnitPrice(denomination);
    const price = Number(denomination.priceUsd);
    const breakdown = computeSalePrice({
      faceValue: value,
      senderFeePercent: senderFee,
      discountPercent: discount,
      marginPercent: marginPercent ?? 0,
      paymentFeePercent,
    });
    const cost = breakdown.ok ? breakdown.cost : null;
    const belowCost = cost != null && price > 0 && price < cost;
    const realMargin =
      cost != null && price > 0
        ? Math.round(((price * (1 - paymentFeePercent / 100) - cost) / price) * 1000) / 10
        : null;
    return {
      denomination,
      value,
      check: checkSupplierUnitPrice(supplier, value ?? 0),
      cost,
      belowCost,
      realMargin,
    };
  });
  const invalid = rows.filter((row) => !row.check.ok);
  const lossLeaders = rows.filter((row) => row.belowCost);

  return (
    <div className="mt-2 rounded-lg border border-stone-200 bg-white px-3 py-2">
      <p className="text-[11.5px] leading-5 text-stone-600">
        <strong>Produit #{info.productId}</strong> · {info.name ?? ""}{" "}
        {info.country ? `· ${info.country}` : ""} {currency ? `· ${currency}` : ""} ·{" "}
        <span className="font-bold">{accepted}</span>
        {senderFee > 0 || discount > 0 ? (
          <>
            {" "}
            · frais Reloadly <strong>{senderFee} %</strong>
            {discount > 0 ? <> · remise <strong>{discount} %</strong></> : null}
          </>
        ) : null}
      </p>

      <ul className="mt-1.5 space-y-1">
        {rows.map(({ denomination, value, check, cost, belowCost, realMargin }) => (
          <li
            key={denomination.id}
            className={`flex items-start gap-1.5 text-[11.5px] leading-5 ${
              !check.ok || belowCost ? "text-red-700" : "text-stone-600"
            }`}
          >
            {!check.ok || belowCost ? (
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            ) : (
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
            )}
            <span>
              <strong>{denomination.label}</strong>{" "}
              {value == null ? "— valeur Reloadly absente" : `→ ${value}`}
              {cost != null ? (
                <>
                  {" "}
                  · coût {money(cost)} · prix {money(Number(denomination.priceUsd) || 0)}
                  {realMargin != null ? ` · marge nette ${realMargin} %` : null}
                  {belowCost ? " · VENTE À PERTE" : null}
                </>
              ) : null}
              {!check.ok ? ` · ${check.message}` : null}
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

      {lossLeaders.length > 0 && (
        <p className="mt-1.5 rounded-md bg-red-50 px-2 py-1.5 text-[11.5px] font-bold leading-5 text-red-700">
          {lossLeaders.length} montant{lossLeaders.length > 1 ? "s" : ""} vendu
          {lossLeaders.length > 1 ? "s" : ""} sous le coût réel
          {lossLeaders.length > 1 ? "s" : ""} : chaque vente vous fait perdre de
          l&apos;argent. Renseignez une marge nette ou remontez le prix.
        </p>
      )}
    </div>
  );
}
