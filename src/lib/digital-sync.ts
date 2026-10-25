// Révision du catalogue à partir du catalogue Reloadly — partie SERVEUR.
//
// Lecture seule chez le fournisseur (aucun achat) : on liste les produits des
// marques/pays demandés, on rapproche chaque produit d'une fiche existante,
// puis on calcule les prix à partir d'une marge nette. Rien n'est écrit sans
// validation explicite de l'admin (`applyDigitalSync`).

import { listGiftCardProducts, reloadlyConfigured } from "@/lib/reloadly";
import { getDigitalCatalog, upsertDigitalProduct } from "@/lib/digital-store";
import {
  applyProposalToProduct,
  buildProposal,
  matchFiche,
  sameBrand,
  type SupplierProduct,
  type SyncProposal,
} from "@/lib/digital-sync-core";

/** Nombre de produits Reloadly lus au maximum par analyse. */
export const MAX_SCANNED_PRODUCTS = 150;

export interface SyncRequest {
  marginPercent: number;
  /** Marques visées (« Steam », « PlayStation »…). */
  brands: string[];
  /** Pays visés (`US`, `SA`, `global`…). Vide = pas de filtre. */
  countries: string[];
  /** Frais du processeur de paiement, en %. */
  paymentFeePercent: number;
}

export interface SyncAnalysis {
  proposals: SyncProposal[];
  scanned: number;
  skipped: number;
  errors: string[];
}

function toSupplierProduct(raw: {
  productId: number;
  productName: string;
  brandName: string;
  countryCode: string;
  currencyCode: string;
  denominationType: string;
  fixedDenominations: number[];
  minDenomination: number | null;
  maxDenomination: number | null;
  senderFeePercentage: number;
  discountPercentage: number;
  senderCurrencyCode?: string;
  fixedSenderDenominations?: number[];
  recipientToSenderMap?: Record<string, number>;
  recipientToSenderRate?: number | null;
  global: boolean;
  status: string;
}): SupplierProduct {
  return {
    productId: raw.productId,
    productName: raw.productName,
    brandName: raw.brandName,
    countryCode: raw.countryCode,
    currencyCode: raw.currencyCode,
    denominationType: raw.denominationType,
    fixedDenominations: raw.fixedDenominations,
    minDenomination: raw.minDenomination,
    maxDenomination: raw.maxDenomination,
    senderFeePercentage: raw.senderFeePercentage,
    discountPercentage: raw.discountPercentage,
    senderCurrencyCode: raw.senderCurrencyCode,
    fixedSenderDenominations: raw.fixedSenderDenominations,
    recipientToSenderMap: raw.recipientToSenderMap,
    recipientToSenderRate: raw.recipientToSenderRate,
    global: raw.global,
    status: raw.status,
  };
}

/**
 * Compare le catalogue Reloadly (marques/pays demandés) aux fiches locales et
 * renvoie une proposition par produit retenu. Aucune écriture.
 */
export async function analyseDigitalSync(request: SyncRequest): Promise<SyncAnalysis> {
  if (!reloadlyConfigured()) {
    throw new Error(
      "RELOADLY_CLIENT_ID / RELOADLY_CLIENT_SECRET absents : la révision du catalogue nécessite la connexion Reloadly.",
    );
  }

  const brands = request.brands.map((brand) => brand.trim()).filter(Boolean);
  const countries = Array.from(
    new Set(request.countries.map((country) => country.trim().toUpperCase()).filter(Boolean)),
  );
  const marginPercent = Number(request.marginPercent);

  const errors: string[] = [];
  const found = new Map<number, SupplierProduct>();

  // Sans pays précisé, on interroge le global puis quelques pays majeurs.
  const targets = countries.length > 0 ? countries : ["US"];
  for (const country of targets) {
    for (let page = 1; page <= 3; page += 1) {
      try {
        const { products } = await listGiftCardProducts({
          countryCode: country === "GLOBAL" ? undefined : country,
          page,
          size: 100,
        });
        for (const item of products) {
          if (found.size >= MAX_SCANNED_PRODUCTS) break;
          const brandOk = brands.length === 0 || brands.some((brand) => sameBrand(brand, item.brandName));
          if (!brandOk) continue;
          const status = (item.status ?? "").toUpperCase();
          if (status && status !== "ACTIVE") continue;
          if (found.has(item.productId)) continue;
          found.set(item.productId, toSupplierProduct(item));
        }
        if (products.length < 100) break;
      } catch (error) {
        errors.push(
          `${country} (page ${page}) : ${error instanceof Error ? error.message : String(error)}`,
        );
        break;
      }
    }
  }

  const products = Array.from(found.values());
  const fiches = await getDigitalCatalog({ publicOnly: false });

  const proposals: SyncProposal[] = [];
  let skipped = 0;
  for (const product of products) {
    const fiche = matchFiche(product, fiches);
    const proposal = buildProposal({
      product,
      fiche,
      marginPercent,
      paymentFeePercent: request.paymentFeePercent,
    });
    if (proposal.denominations.length === 0) {
      skipped += 1;
      continue;
    }
    proposals.push(proposal);
  }

  // Les mises à jour passent avant les créations : on corrige l'existant.
  proposals.sort((a, b) => {
    if (a.action !== b.action) return a.action === "update" ? -1 : 1;
    return a.title.localeCompare(b.title);
  });

  return { proposals, scanned: products.length, skipped, errors };
}

export interface SyncApplyResult {
  updated: number;
  created: number;
  errors: string[];
  applied: string[];
}

/**
 * Applique les fiches validées par l'admin.
 *
 * Le navigateur n'envoie QUE les clés retenues : l'analyse (donc les prix)
 * est **recalculée côté serveur** avec les mêmes paramètres. Un prix affiché
 * dans le navigateur ne peut donc jamais devenir un prix de vente.
 */
export async function applyDigitalSync(
  request: SyncRequest,
  keys: string[],
): Promise<SyncApplyResult> {
  const wanted = new Set(keys.map((key) => String(key ?? "").trim()).filter(Boolean));
  const result: SyncApplyResult = { updated: 0, created: 0, errors: [], applied: [] };
  if (wanted.size === 0) return result;

  const analysis = await analyseDigitalSync(request);
  const fiches = await getDigitalCatalog({ publicOnly: false });
  const byId = new Map(fiches.map((fiche) => [fiche.id, fiche] as const));

  for (const proposal of analysis.proposals) {
    if (!wanted.has(proposal.key)) continue;
    const fiche = byId.get(proposal.key) ?? null;
    try {
      const next = applyProposalToProduct(proposal, fiche);
      await upsertDigitalProduct(next);
      if (fiche) result.updated += 1;
      else result.created += 1;
      result.applied.push(proposal.key);
    } catch (error) {
      result.errors.push(
        `${proposal.key} : ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  return result;
}
