import { assertLegacySupplierActive } from "@/lib/retired-supplier";
// Audit du catalogue et recalcul global des prix — partie SERVEUR.
//
// Principe : l'audit signale les PERTES EN PRIORITÉ, et cela même quand la
// fiche est incomplète (pas de marge, pas de produit Reloadly, livraison
// manuelle, produit illisible). Un montant vendu sous sa valeur faciale est
// déjà une perte : ce contrôle ne dépend d'aucun appel réseau.
//
// Coût retenu, du plus fiable au plus prudent :
//   1. `reloadly` : produit lu chez Reloadly → face × (1 + frais) × (1 − remise) ;
//   2. `stored`   : frais ET remise mémorisés sur la fiche (même formule) —
//      c'est ce qui évite le faux positif « 60 $ vendu 59,50 $ » quand une
//      remise Reloadly de 4,4 % rend la vente rentable ;
//   3. `face`     : valeur faciale seule (borne HAUTE du coût, remise inconnue) :
//      le dépassement n'est qu'une **vérification**, jamais une accusation ;
//   4. `none`     : aucune donnée → aucun jugement.
//
// Corollaire : une « perte » n'est déclarée qu'avec un coût **vérifié**
// (`reloadly` ou `stored`).
//
// Les prix recalculés (marge de la fiche + arrondi) sont produits ici, jamais
// repris du navigateur.

import {
  checkSupplierUnitPrice,
  computeSalePrice,
  computeSalePriceFromCost,
  denominationLabelFaceMismatch,
  faceValueLosses,
  PRICE_ROUND_STEP,
} from "@/lib/digital-order-core";
import { supplierCostUsd } from "@/lib/digital-sync-core";
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
export type CostSource = "reloadly" | "stored" | "face" | "none";

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
  /** Frais / remise du fournisseur lus chez Reloadly (mémorisés à l'application). */
  supplierFeePercent: number | null;
  supplierDiscountPercent: number | null;
  /** Devise de la face (« USD », « TRY »…) et coût USD vérifié. */
  faceCurrency: string;
  supplierCostUsd: number | null;
  /** Vrai si le prix actuel est sous un coût **vérifié** : perte certaine. */
  loss: boolean;
  /** Vrai si le prix est sous la valeur faciale sans remise connue : à vérifier. */
  suspect: boolean;
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
    suspects: number;
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
  assertLegacySupplierActive();
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

      // Frais/remise : produit Reloadly s'il est lisible, sinon valeurs
      // mémorisées sur la fiche (une remise oubliée transformait une vente
      // rentable en « perte »).
      const storedFee = fiche.supplierFeePercent;
      const storedDiscount = fiche.supplierDiscountPercent;
      const storedKnown =
        storedFee != null &&
        Number.isFinite(Number(storedFee)) &&
        storedDiscount != null &&
        Number.isFinite(Number(storedDiscount));
      const feePercent = supplier ? Number(supplier.senderFeePercentage ?? 0) : storedKnown ? Number(storedFee) : null;
      const discountPercent = supplier
        ? Number(supplier.discountPercentage ?? 0)
        : storedKnown
          ? Number(storedDiscount)
          : null;

      // Face non-USD (500 TRY, 250 EGP…) : le nombre inscrit sur la carte
      // n'est pas un montant en dollars. Le coût ne peut venir que de
      // Reloadly (correspondance publiée) ou du coût mémorisé.
      const faceCurrency = String(denomination.faceCurrency ?? "USD").trim().toUpperCase();
      const nonUsd = Boolean(faceCurrency) && faceCurrency !== "USD";

      let cost: number | null = null;
      let costSource: CostSource = "none";
      if (nonUsd) {
        const fromReloadly = supplier && unitPrice != null
          ? supplierCostUsd(
              {
                ...supplier,
                currencyCode: supplier.recipientCurrencyCode || faceCurrency,
                senderCurrencyCode: supplier.senderCurrencyCode,
                fixedSenderDenominations: supplier.fixedSenderDenominations,
                recipientToSenderMap: supplier.recipientToSenderMap,
                recipientToSenderRate: supplier.recipientToSenderRate,
              },
              unitPrice,
            )
          : null;
        const storedCost = Number(denomination.supplierCostUsd);
        if (fromReloadly != null && fromReloadly > 0) {
          cost = cents(fromReloadly);
          costSource = "reloadly";
        } else if (Number.isFinite(storedCost) && storedCost > 0) {
          cost = cents(storedCost);
          costSource = "stored";
        }
        if (cost == null) {
          issues.push({
            severity: "warning",
            message: `Carte en ${faceCurrency} : coût réel en USD inconnu — À VÉRIFIER, aucun prix ne peut être calculé tant que la révision Reloadly n'a pas mémorisé le coût.`,
          });
        }
      } else if (unitPrice != null && feePercent != null && discountPercent != null) {
        cost = cents(unitPrice * (1 + feePercent / 100) * (1 - discountPercent / 100));
        costSource = supplier ? "reloadly" : "stored";
      } else if (unitPrice != null) {
        // Borne haute du coût : la remise éventuelle n'est pas connue.
        cost = cents(unitPrice);
        costSource = "face";
      }

      let netMarginPercent: number | null = null;
      let newPrice: number | null = null;
      if (marginPercent != null && cost != null && (costSource === "reloadly" || costSource === "stored")) {
        // Le prix part TOUJOURS du coût réel en USD, jamais de la face locale.
        const breakdown = computeSalePriceFromCost(cost, marginPercent, paymentFeePercent);
        if (breakdown.ok) {
          newPrice = breakdown.price;
          netMarginPercent = breakdown.netMarginPercent;
        }
      } else if (marginPercent != null && unitPrice != null && supplier && !nonUsd) {
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

      // ---- PERTE : seulement sur un coût VÉRIFIÉ ------------------------
      // Un montant désactivé n'est pas vendu : pas d'alerte dessus.
      const verifiedCost = costSource === "reloadly" || costSource === "stored";
      const loss =
        denomination.available &&
        verifiedCost &&
        cost != null &&
        price > 0 &&
        cents(price) < cents(cost);
      const priced = denomination.available && price > 0;
      // Sous la face : « à vérifier » UNIQUEMENT pour les faces en dollars.
      // Comparer un prix en USD à une face en livres turques n'a aucun sens.
      const suspect =
        !loss &&
        priced &&
        !nonUsd &&
        unitPrice != null &&
        cents(price) < cents(unitPrice) &&
        costSource === "face";

      if (loss && cost != null) {
        const detail =
          costSource === "reloadly"
            ? `frais Reloadly ${feePercent ?? 0} %, remise ${discountPercent ?? 0} %`
            : `frais ${feePercent ?? 0} % et remise ${discountPercent ?? 0} % mémorisés sur la fiche`;
        issues.unshift({
          severity: "loss",
          message: `VENTE À PERTE : prix ${price.toFixed(2)} $ < coût ${cost.toFixed(2)} $ (${detail}) — perte de ${(
            cost - price
          ).toFixed(2)} $ par vente.`,
        });
      }
      if (suspect) {
        // Remise inconnue : simple vérification, jamais une accusation. On
        // chiffre le coût « si la remise était de 4,4 % » pour rendre le
        // message actionnable.
        const exampleCost = cents((unitPrice as number) * (1 - 0.044));
        issues.unshift({
          severity: "warning",
          message:
            `Prix ${price.toFixed(2)} $ sous la valeur faciale ${unitPrice} $ — À VÉRIFIER : ` +
            `remise Reloadly inconnue, cette vente peut être rentable (ex. remise 4,4 % → ` +
            `coût ${exampleCost.toFixed(2)} $). Relancez une révision du produit pour mémoriser la remise.`,
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
      const labelMismatch = denominationLabelFaceMismatch(denomination);
      if (labelMismatch) {
        issues.push({ severity: "warning", message: labelMismatch });
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
        supplierFeePercent: supplier ? Number(supplier.senderFeePercentage ?? 0) : null,
        supplierDiscountPercent: supplier ? Number(supplier.discountPercentage ?? 0) : null,
        faceCurrency: faceCurrency || "USD",
        supplierCostUsd:
          cost != null && (costSource === "reloadly" || costSource === "stored") ? cost : null,
        loss,
        suspect,
        issues,
      });
    }
  }

  const active = rows.filter((row) => row.oldPrice > 0);
  const losses = active.filter((row) => row.loss);
  const summary = {
    losses: losses.length,
    suspects: active.filter((row) => row.suspect).length,
    refused: active.filter((row) => row.issues.some((issue) => issue.message.startsWith("Refusé par Reloadly"))).length,
    unrounded: active.filter((row) => row.issues.some((issue) => issue.message.startsWith("Prix non arrondi"))).length,
    missingPrice: rows.filter((row) => row.newPrice == null).length,
    belowFace: active.filter(
      (row) => row.unitPrice != null && cents(row.oldPrice) < cents(row.unitPrice),
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
    const metaById = new Map(
      rows.map(
        (row) =>
          [
            row.denominationId,
            { faceCurrency: row.faceCurrency, supplierCostUsd: row.supplierCostUsd },
          ] as const,
      ),
    );
    // Frais / remise réellement lus chez Reloadly : on les mémorise sur la
    // fiche pour que le contrôle de rentabilité soit exact sans réseau.
    const fromReloadly = rows.find((row) => row.supplierDiscountPercent != null);
    const next: DigitalProduct = {
      ...fiche,
      ...(fromReloadly
        ? {
            supplierFeePercent: fromReloadly.supplierFeePercent,
            supplierDiscountPercent: fromReloadly.supplierDiscountPercent,
          }
        : {}),
      denominations: fiche.denominations.map((denomination) => {
        const price = priceById.get(denomination.id);
        const meta = metaById.get(denomination.id);
        const next = price == null ? denomination : { ...denomination, priceUsd: price };
        return meta
          ? {
              ...next,
              faceCurrency: meta.faceCurrency,
              supplierCostUsd: meta.supplierCostUsd,
            }
          : next;
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
