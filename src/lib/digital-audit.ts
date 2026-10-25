// Audit du catalogue et recalcul global des prix — partie SERVEUR.
//
// Principe : l'audit signale les PERTES EN PRIORITÉ, et cela même quand la
// fiche est incomplète (pas de marge, pas de produit Reloadly, livraison
// manuelle, produit illisible). Un montant vendu sous sa valeur faciale est
// déjà une perte : ce contrôle ne dépend d'aucun appel réseau.
//
// Coût retenu, du plus fiable au plus prudent :
//   1. `reloadly` : valeur faciale × (1 + frais Reloadly) × (1 − remise) ;
//   2. `face`     : la valeur faciale elle-même (borne basse, frais ignorés) ;
//   3. `none`     : aucune donnée → aucun jugement de perte.
//
// Les prix recalculés (marge de la fiche + arrondi) sont produits ici, jamais
// repris du navigateur.

import {
  checkSupplierUnitPrice,
  computeSalePrice,
  faceValueLosses,
  PRICE_ROUND_STEP,
} from "@/lib/digital-order-core";
import { getDigitalCatalog, upsertDigitalProduct } from "@/lib/digital-store";
import { denominationUnitPrice, type DigitalProduct } from "@/lib/digital-types";
import { getGiftCardProduct, reloadlyConfigured } from "@/lib/reloadly";

/** Gravité d'une anomalie : `loss` = perte d'argent certaine. */
export type IssueSeverity = "loss" | "warning" | "info";

export interface RecalcIssue {
  severity: IssueSeverity;
  message: string;
}

/** Origine du coût utilisé pour juger la rentabilité. */
export type CostSource = "reloadly" | "face" | "none";

/** Un montant audité / recalculé. */
export interface RecalcRow {
  ficheId: string;
  ficheTitle: string;
  slug: string;
  /** Produit Reloadly relié (0 si aucun). */
  productId: number;
  denominationId: string;
  denominationLabel: string;
  unitPrice: number | null;
  oldPrice: number;
  /** Prix recalculé (marge de la fiche + arrondi). `null` = incalculable. */
  newPrice: number | null;
  cost: number | null;
  costSource: CostSource;
  targetMarginPercent: number | null;
  netMarginPercent: number | null;
  /** Vrai si le prix actuel est sous le coût : perte à chaque vente. */
  loss: boolean;
  issues: RecalcIssue[];
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
  /** Synthèse : le premier chiffre à regarder dans l'admin. */
  summary: {
    losses: number;
    refused: number;
    unrounded: number;
    missingPrice: number;
    belowFace: number;
    fichesWithLoss: number;
    total: number;
  };
}

/** Le coût est-il un multiple du pas d'arrondi ? (pour l'affichage) */
function isRounded(price: number, step: number): boolean {
  if (!Number.isFinite(price) || price <= 0) return true;
  const remainder = Math.abs(price / step - Math.round(price / step));
  return remainder < 1e-6;
}

/** Arrondi au centime, robuste aux erreurs de flottants. */
function cents(value: number): number {
  return Math.round(value * 100 + 1e-9) / 100;
}

/** Réexport : le contrôle hors réseau vit dans le noyau pur (testable). */
export { faceValueLosses } from "@/lib/digital-order-core";

/**
 * Analyse les fiches et propose un prix recalculé pour chaque montant.
 *
 * Aucune fiche n'est exclue du contrôle de perte : l'absence de marge ou de
 * produit Reloadly ajoute une note, elle n'empêche pas de signaler une vente
 * à perte (c'était le défaut de la version précédente).
 */
export async function analyseCatalogRecalc(paymentFeePercent: number): Promise<RecalcAnalysis> {
  const fiches = await getDigitalCatalog({ publicOnly: false });
  const rows: RecalcRow[] = [];
  const skipped: RecalcSkip[] = [];
  const warnings: string[] = [];
  const reachable = reloadlyConfigured();

  if (!reachable) {
    warnings.push(
      "RELOADLY_CLIENT_ID / RELOADLY_CLIENT_SECRET absents : coût estimé sur la seule valeur faciale, frais du fournisseur ignorés.",
    );
  }

  // Un seul appel par produit Reloadly, quelle que soit le nombre de fiches.
  const products = new Map<number, Awaited<ReturnType<typeof getGiftCardProduct>> | null>();

  async function supplierFor(productId: number) {
    if (!reachable) return null;
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
    const ficheTitle = fiche.titleEn || fiche.id;

    if (fiche.denominations.length === 0) {
      skipped.push({ ficheId: fiche.id, ficheTitle, reason: "Aucun montant dans la fiche." });
      continue;
    }

    const productIdRaw = Number(fiche.reloadlyProductId);
    const productId = Number.isInteger(productIdRaw) && productIdRaw > 0 ? productIdRaw : 0;
    const supplier = productId > 0 && fiche.fulfillment === "auto" ? await supplierFor(productId) : null;

    const marginPercent =
      fiche.marginPercent != null && Number.isFinite(Number(fiche.marginPercent))
        ? Number(fiche.marginPercent)
        : null;

    const ficheNotes: RecalcIssue[] = [];
    if (fiche.fulfillment !== "auto") {
      ficheNotes.push({
        severity: "info",
        message: "Livraison manuelle : coût estimé sur la valeur faciale (frais du fournisseur non appliqués).",
      });
    } else if (productId === 0) {
      ficheNotes.push({
        severity: "warning",
        message: "Aucun produit Reloadly relié : coût estimé sur la valeur faciale.",
      });
    } else if (!supplier) {
      ficheNotes.push({
        severity: "warning",
        message: `Produit #${productId} illisible chez Reloadly : coût estimé sur la valeur faciale.`,
      });
    }
    if (marginPercent == null) {
      ficheNotes.push({
        severity: "warning",
        message: "Aucune marge nette définie : prix recalculé impossible (les pertes restent signalées).",
      });
    }
    if (supplier && supplier.currencyCode && supplier.currencyCode.toUpperCase() !== "USD") {
      ficheNotes.push({
        severity: "warning",
        message: `Produit en ${supplier.currencyCode.toUpperCase()} : les prix doivent être convertis en USD (valeurs probablement multipliées).`,
      });
    }

    for (const denomination of fiche.denominations) {
      const unitPrice = denominationUnitPrice(denomination);
      const price = denomination.priceUsd;
      const issues: RecalcIssue[] = [...ficheNotes];

      // Coût : Reloadly si lisible, sinon la valeur faciale (borne basse).
      let cost: number | null = null;
      let costSource: CostSource = "none";
      if (supplier && unitPrice != null) {
        cost = cents(unitPrice * (1 + Number(supplier.senderFeePercentage ?? 0) / 100) *
          (1 - Number(supplier.discountPercentage ?? 0) / 100));
        costSource = "reloadly";
      } else if (unitPrice != null) {
        cost = cents(unitPrice);
        costSource = "face";
      }

      let netMarginPercent: number | null = null;
      let newPrice: number | null = null;
      if (marginPercent != null && unitPrice != null && supplier) {
        const breakdown = computeSalePrice({
          faceValue: unitPrice,
          senderFeePercent: supplier.senderFeePercentage,
          discountPercent: supplier.discountPercentage,
          marginPercent,
          paymentFeePercent,
        });
        if (breakdown.ok) {
          newPrice = breakdown.price;
          netMarginPercent = breakdown.netMarginPercent;
        }
      }

      // ---- PERTE : le contrôle qui compte -------------------------------
      // Un montant désactivé n'est pas vendu : pas d'alerte de perte dessus.
      const loss = denomination.available && cost != null && price > 0 && cents(price) < cents(cost);
      if (loss) {
        issues.unshift({
          severity: "loss",
          message: `VENTE À PERTE : prix ${price.toFixed(2)} $ < coût ${(cost as number).toFixed(2)} $ (${
            costSource === "reloadly" ? "frais Reloadly inclus" : "valeur faciale, frais non connus"
          }) — perte de ${((cost as number) - price).toFixed(2)} $ par vente.`,
        });
      }
      if (
        denomination.available &&
        unitPrice != null &&
        price > 0 &&
        cents(price) < cents(unitPrice) &&
        !loss
      ) {
        issues.unshift({
          severity: "loss",
          message: `Prix ${price.toFixed(2)} $ inférieur à la valeur faciale ${unitPrice} : le client reçoit plus qu'il ne paie.`,
        });
      }

      if (unitPrice == null) {
        issues.push({ severity: "warning", message: "Valeur Reloadly absente : coût réel inconnu." });
      } else if (supplier) {
        const check = checkSupplierUnitPrice(supplier, unitPrice);
        if (!check.ok) {
          issues.push({ severity: "warning", message: `Refusé par Reloadly — ${check.message}` });
        }
      }
      if (!isRounded(price, PRICE_ROUND_STEP)) {
        issues.push({ severity: "info", message: "Prix non arrondi (pas de 0,50)." });
      }
      if (!denomination.available) {
        issues.push({ severity: "info", message: "Montant désactivé (hors vente)." });
      }

      rows.push({
        ficheId: fiche.id,
        ficheTitle,
        slug: fiche.slug,
        productId,
        denominationId: denomination.id,
        denominationLabel: denomination.label,
        unitPrice,
        oldPrice: price,
        newPrice,
        cost,
        costSource,
        targetMarginPercent: marginPercent,
        netMarginPercent,
        loss,
        issues,
      });
    }
  }

  const active = rows.filter((row) => row.oldPrice > 0);
  const losses = active.filter((row) => row.loss);
  const summary = {
    losses: losses.length,
    refused: active.filter((row) => row.issues.some((issue) => issue.message.startsWith("Refusé par Reloadly"))).length,
    unrounded: active.filter((row) => row.issues.some((issue) => issue.message.startsWith("Prix non arrondi"))).length,
    missingPrice: rows.filter((row) => row.newPrice == null).length,
    belowFace: rows.filter(
      (row) =>
        row.issues.some((issue) => issue.message.startsWith("Prix ")) &&
        row.unitPrice != null &&
        row.oldPrice > 0 &&
        cents(row.oldPrice) < cents(row.unitPrice),
    ).length,
    fichesWithLoss: new Set(losses.map((row) => row.ficheId)).size,
    total: rows.length,
  };

  const changes = rows.filter(
    (row) => row.newPrice != null && Math.abs(row.newPrice - row.oldPrice) > 0.004,
  ).length;

  return { rows, skipped, changes, warnings, step: PRICE_ROUND_STEP, summary };
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
