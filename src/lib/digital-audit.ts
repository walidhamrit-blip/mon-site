// Audit du catalogue et recalcul global des prix — partie SERVEUR.
//
// Deux usages :
//   1. AUDIT : lister ce qui cloche dans les fiches enregistrées (prix sous
//      le coût, marge non appliquée, montant refusé par Reloadly, prix non
//      arrondi) sans avoir à déplier chaque fiche ;
//   2. RECALCUL : réappliquer marge + arrondi à tout le catalogue d'un coup.
//
// Les prix sont toujours recalculés ici, jamais repris du navigateur.

import { checkSupplierUnitPrice, computeSalePrice, PRICE_ROUND_STEP } from "@/lib/digital-order-core";
import { getDigitalCatalog, upsertDigitalProduct } from "@/lib/digital-store";
import { denominationUnitPrice, type DigitalProduct } from "@/lib/digital-types";
import { getGiftCardProduct, reloadlyConfigured } from "@/lib/reloadly";

/** Un montant audité / recalculé. */
export interface RecalcRow {
  ficheId: string;
  ficheTitle: string;
  slug: string;
  productId: number;
  denominationId: string;
  denominationLabel: string;
  unitPrice: number | null;
  oldPrice: number;
  /** Prix recalculé (marge de la fiche + arrondi). `null` = incalculable. */
  newPrice: number | null;
  cost: number | null;
  targetMarginPercent: number | null;
  netMarginPercent: number | null;
  /** Problèmes constatés sur la fiche **actuelle**. */
  issues: string[];
}

export interface RecalcSkip {
  ficheId: string;
  ficheTitle: string;
  reason: string;
}

export interface RecalcAnalysis {
  rows: RecalcRow[];
  skipped: RecalcSkip[];
  /** Nombre de prix qui changeraient réellement. */
  changes: number;
  warnings: string[];
  step: number;
}

/** Arrondi d'affichage : un prix est « rond » s'il est multiple du pas. */
function isRounded(price: number, step: number): boolean {
  if (!Number.isFinite(price) || price <= 0) return true;
  const remainder = Math.abs(price / step - Math.round(price / step));
  return remainder < 1e-6;
}

/**
 * Analyse les fiches reliées à Reloadly et propose un prix recalculé pour
 * chaque montant. Lecture seule chez le fournisseur (une requête par produit,
 * mutualisée entre les fiches).
 */
export async function analyseCatalogRecalc(paymentFeePercent: number): Promise<RecalcAnalysis> {
  if (!reloadlyConfigured()) {
    throw new Error(
      "RELOADLY_CLIENT_ID / RELOADLY_CLIENT_SECRET absents : le recalcul nécessite la connexion Reloadly (frais fournisseur).",
    );
  }

  const fiches = await getDigitalCatalog({ publicOnly: false });
  const rows: RecalcRow[] = [];
  const skipped: RecalcSkip[] = [];
  const warnings: string[] = [];

  // Un seul appel par produit Reloadly, quelle que soit le nombre de fiches.
  const products = new Map<number, Awaited<ReturnType<typeof getGiftCardProduct>> | null>();

  async function supplierFor(productId: number) {
    if (products.has(productId)) return products.get(productId) ?? null;
    try {
      const info = await getGiftCardProduct(productId);
      products.set(productId, info);
      return info;
    } catch (error) {
      products.set(productId, null);
      warnings.push(
        `Produit #${productId} illisible : ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  for (const fiche of fiches) {
    const productId = Number(fiche.reloadlyProductId);
    if (fiche.fulfillment !== "auto") {
      skipped.push({
        ficheId: fiche.id,
        ficheTitle: fiche.titleEn || fiche.id,
        reason: "Livraison manuelle : aucun coût fournisseur à appliquer.",
      });
      continue;
    }
    if (!Number.isInteger(productId) || productId <= 0) {
      skipped.push({
        ficheId: fiche.id,
        ficheTitle: fiche.titleEn || fiche.id,
        reason: "Aucun produit Reloadly relié.",
      });
      continue;
    }
    const marginPercent =
      fiche.marginPercent != null && Number.isFinite(Number(fiche.marginPercent))
        ? Number(fiche.marginPercent)
        : null;
    if (marginPercent == null) {
      skipped.push({
        ficheId: fiche.id,
        ficheTitle: fiche.titleEn || fiche.id,
        reason: "Aucune marge nette définie sur la fiche.",
      });
      continue;
    }
    if (fiche.denominations.length === 0) {
      skipped.push({
        ficheId: fiche.id,
        ficheTitle: fiche.titleEn || fiche.id,
        reason: "Aucun montant dans la fiche.",
      });
      continue;
    }

    const supplier = await supplierFor(productId);
    if (!supplier) {
      skipped.push({
        ficheId: fiche.id,
        ficheTitle: fiche.titleEn || fiche.id,
        reason: `Produit #${productId} illisible chez Reloadly.`,
      });
      continue;
    }

    for (const denomination of fiche.denominations) {
      const unitPrice = denominationUnitPrice(denomination);
      const issues: string[] = [];

      const breakdown = computeSalePrice({
        faceValue: unitPrice,
        senderFeePercent: supplier.senderFeePercentage,
        discountPercent: supplier.discountPercentage,
        marginPercent,
        paymentFeePercent,
      });

      if (unitPrice == null) {
        issues.push("Valeur Reloadly absente : prix non recalculable.");
      } else {
        const check = checkSupplierUnitPrice(supplier, unitPrice);
        if (!check.ok) issues.push(`Refusé par Reloadly — ${check.message}`);
      }
      if (breakdown.ok && denomination.priceUsd > 0 && denomination.priceUsd < breakdown.cost) {
        issues.push("Prix actuel sous le coût réel (vente à perte).");
      }
      if (!isRounded(denomination.priceUsd, PRICE_ROUND_STEP)) {
        issues.push("Prix actuel non arrondi (pas de 0,50).");
      }
      if (!denomination.available) issues.push("Montant désactivé.");

      rows.push({
        ficheId: fiche.id,
        ficheTitle: fiche.titleEn || fiche.id,
        slug: fiche.slug,
        productId,
        denominationId: denomination.id,
        denominationLabel: denomination.label,
        unitPrice,
        oldPrice: denomination.priceUsd,
        newPrice: breakdown.ok ? breakdown.price : null,
        cost: breakdown.ok ? breakdown.cost : null,
        targetMarginPercent: marginPercent,
        netMarginPercent: breakdown.ok ? breakdown.netMarginPercent : null,
        issues,
      });
    }
  }

  const changes = rows.filter(
    (row) => row.newPrice != null && Math.abs(row.newPrice - row.oldPrice) > 0.004,
  ).length;

  return { rows, skipped, changes, warnings, step: PRICE_ROUND_STEP };
}

export interface RecalcApplyResult {
  fiches: number;
  prices: number;
  errors: string[];
}

/**
 * Réapplique marge + arrondi aux fiches demandées.
 *
 * L'analyse est refaite ici : le navigateur n'envoie que des identifiants de
 * fiche, jamais un prix. Les montants non recalculables (valeur Reloadly
 * absente, produit illisible) sont laissés intacts.
 */
export async function applyCatalogRecalc(
  paymentFeePercent: number,
  ficheIds: string[],
): Promise<RecalcApplyResult> {
  const wanted = new Set(ficheIds.map((id) => String(id ?? "").trim()).filter(Boolean));
  const result: RecalcApplyResult = { fiches: 0, prices: 0, errors: [] };
  if (wanted.size === 0) return result;

  const analysis = await analyseCatalogRecalc(paymentFeePercent);
  const byFiche = new Map<string, RecalcRow[]>();
  for (const row of analysis.rows) {
    if (!wanted.has(row.ficheId) || row.newPrice == null) continue;
    const list = byFiche.get(row.ficheId) ?? [];
    list.push(row);
    byFiche.set(row.ficheId, list);
  }

  const fiches = await getDigitalCatalog({ publicOnly: false });
  const reference = new Map(fiches.map((fiche) => [fiche.id, fiche] as const));

  for (const [ficheId, rows] of byFiche) {
    const fiche = reference.get(ficheId);
    if (!fiche) {
      result.errors.push(`${ficheId} : fiche introuvable.`);
      continue;
    }
    const priceById = new Map(rows.map((row) => [row.denominationId, row.newPrice as number] as const));
    const next: DigitalProduct = {
      ...fiche,
      denominations: fiche.denominations.map((denomination) => {
        const price = priceById.get(denomination.id);
        return price == null ? denomination : { ...denomination, priceUsd: price };
      }),
    };
    try {
      await upsertDigitalProduct(next);
      result.fiches += 1;
      result.prices += rows.filter((row) => Math.abs(row.newPrice! - row.oldPrice) > 0.004).length;
    } catch (error) {
      result.errors.push(
        `${ficheId} : ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  return result;
}
