// Révision du catalogue à partir du catalogue Reloadly — NOYAU PUR.
//
// Ce module ne touche ni à la base, ni au réseau, ni aux secrets : il
// rapproche un produit Reloadly d'une fiche existante, calcule les prix à
// partir d'une marge nette et produit une proposition « à valider ». Il est
// testable sans infrastructure (voir scripts/digital-sync.test.mjs).
//
// Règle de prudence : aucune suppression. Un montant que Reloadly n'accepte
// plus est DÉSACTIVÉ (`available: false`) et annoté — des commandes passées
// peuvent y faire référence.

import { computeSalePriceFromCost } from "@/lib/digital-order-core";
import {
  DIGITAL_KINDS,
  denominationUnitPrice,
  type DigitalDenomination,
  type DigitalKind,
  type DigitalProduct,
} from "@/lib/digital-types";

/** Produit du fournisseur, réduit à ce qui sert à tarifer. */
export interface SupplierProduct {
  productId: number;
  productName: string;
  brandName: string;
  countryCode: string;
  currencyCode: string;
  denominationType: string;
  fixedDenominations: number[];
  minDenomination: number | null;
  maxDenomination: number | null;
  senderFeePercentage?: number;
  discountPercentage?: number;
  /** Devise du compte marchand (`senderCurrencyCode`), ex. « USD ». */
  senderCurrencyCode?: string;
  /** Coût réel de chaque face, dans la devise du compte. */
  fixedSenderDenominations?: number[];
  /** Correspondance face locale → coût (`{ "500.00": 15.2 }`). */
  recipientToSenderMap?: Record<string, number>;
  /** Taux Reloadly face → coût, quand il est publié. */
  recipientToSenderRate?: number | null;
  global?: boolean;
  status?: string;
}

export interface SyncDenomination {
  label: string;
  faceValue: string;
  /** Devise de la valeur faciale (« USD », « TRY », « EGP »…). */
  faceCurrency: string;
  /** Région de validité (pays du produit, ou `global`). */
  region: string;
  /** Valeur faciale transmise à Reloadly. */
  reloadlyUnitPrice: number;
  /** Prix de vente calculé (marge nette appliquée). */
  priceUsd: number;
  /** Coût réel en USD (ce que Reloadly débite), `null` si inconnu. */
  cost: number;
  /** Coût réel en USD, mémorisé sur le montant (`null` = non vérifié). */
  supplierCostUsd: number | null;
  netMarginPercent: number;
  /** `added` = nouveau montant, `updated` = prix recalculé. */
  action: "added" | "updated";
}

export interface SyncProposal {
  /** Clé stable : id de la fiche existante, ou slug proposé. */
  key: string;
  action: "create" | "update";
  matchedFicheId: string | null;
  productId: number;
  country: string;
  currency: string;
  title: string;
  platform: string;
  kind: DigitalKind;
  marginPercent: number;
  /** Frais et remise publiés par Reloadly, mémorisés sur la fiche. */
  senderFeePercent: number;
  discountPercent: number;
  denominations: SyncDenomination[];
  /** Montants existants que Reloadly n'accepte pas (désactivés, pas supprimés). */
  disabledLabels: string[];
  notes: string[];
}

/* --------------------------------- Aides ---------------------------------- */

/** Normalise une marque pour comparer « Google Play » et « google-play ». */
export function brandKey(value: string): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Vrai si les deux libellés désignent la même marque. */
export function sameBrand(a: string, b: string): boolean {
  const left = brandKey(a);
  const right = brandKey(b);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

/** Symbole monétaire quand il est évident, sinon code ISO. */
export function currencySymbol(currency: string): string {
  switch ((currency ?? "").toUpperCase()) {
    case "USD":
      return "$";
    case "EUR":
      return "€";
    case "GBP":
      return "£";
    default:
      return "";
  }
}

/** Libellé court d'un montant : `$20`, `€25`, `SAR 70`. */
export function faceLabel(currency: string, amount: number): string {
  const symbol = currencySymbol(currency);
  const value = Number.isInteger(amount) ? String(amount) : String(Math.round(amount * 100) / 100);
  return symbol ? `${symbol}${value}` : `${(currency ?? "").toUpperCase()} ${value}`.trim();
}

/** Nature de la fiche, déduite de la marque et du nom du produit. */
export function kindForProduct(product: SupplierProduct): DigitalKind {
  const haystack = `${product.brandName} ${product.productName}`.toLowerCase();
  if (/robux|v-?bucks|coins|top ?up|topup|recharge/.test(haystack)) return "game_topup";
  if (/nvidia|geforce|office|windows|licen[cs]e|software/.test(haystack)) return "software_key";
  if (/spotify|netflix|premium|plus|subscription|abonnement/.test(haystack)) {
    return "subscription_code";
  }
  return DIGITAL_KINDS.includes("gift_card") ? "gift_card" : "gift_card";
}

/** Région à afficher pour un montant (`global` ou code pays du produit). */
export function regionForProduct(product: SupplierProduct): string {
  const country = (product.countryCode ?? "").toUpperCase();
  return product.global || !country ? "global" : country;
}

/**
 * Retrouve la fiche qui correspond à un produit Reloadly.
 *
 * Priorité à l'identifiant produit (le lien explicite), puis au couple
 * marque + pays. On ne rapproche jamais deux marques différentes.
 */
export function matchFiche(
  product: SupplierProduct,
  fiches: DigitalProduct[],
): DigitalProduct | null {
  const byId = fiches.find(
    (fiche) => Number(fiche.reloadlyProductId) === Number(product.productId),
  );
  if (byId) return byId;

  const region = regionForProduct(product);
  return (
    fiches.find((fiche) => {
      if (!sameBrand(fiche.platform, product.brandName)) return false;
      const country = (fiche.reloadlyCountryCode ?? "").toUpperCase();
      if (country && country === region) return true;
      return region !== "global" && (fiche.regions ?? []).some((r) => r.toUpperCase() === region);
    }) ?? null
  );
}

/** Libellé de fiche pour un produit sans correspondance (`Steam · US`). */
export function newFicheTitle(product: SupplierProduct): string {
  const region = regionForProduct(product);
  const suffix = region === "global" ? "" : ` · ${region}`;
  return `${product.productName || product.brandName}${suffix}`.trim();
}

/** Identifiant de fiche proposé pour un nouveau produit (`steam-us`). */
export function newFicheId(product: SupplierProduct): string {
  const region = regionForProduct(product);
  const base = brandKey(product.brandName) || brandKey(product.productName) || "code";
  const slug = `${base}${region === "global" ? "" : `-${region.toLowerCase()}`}`;
  return slug.replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 100);
}

/* ------------------------------- Proposition ------------------------------ */

/**
 * Construit la proposition de montants pour un produit : une entrée par
 * valeur faciale acceptée, prix calculé depuis la marge nette.
 *
 * Les produits `RANGE` (prix libre) sont ignorés : il n'existe pas de liste
 * de montants à tarifer, la fiche doit être remplie à la main.
 */
/**
 * Coût RÉEL en USD d'une valeur faciale, d'après les données Reloadly.
 *
 * Le piège des cartes internationales : « 500 » sur une carte turque est en
 * livres turques, pas en dollars. Prendre ce nombre pour des dollars vend
 * la carte ~30× trop cher (c'est le bug Robux « 80 » à 83,50 $).
 *
 * Ordre de confiance :
 *  1. `fixedRecipientToSenderDenominationsMap` → coût exact publié ;
 *  2. `fixedSenderDenominations` au même index que la face ;
 *  3. taux `recipientCurrencyToSenderCurrencyExchangeRate` ;
 *  4. fiche en USD : face × (1 + frais) × (1 − remise) — formule historique.
 * Tout le reste renvoie `null` : mieux vaut « à vérifier » qu'un faux prix.
 */
export function supplierCostUsd(
  product: SupplierProduct,
  faceValue: number,
  index = -1,
): number | null {
  const faceCurrency = (product.currencyCode ?? "USD").toUpperCase();
  const senderCurrency = (product.senderCurrencyCode ?? "USD").toUpperCase();
  // La correspondance Reloadly est libellée dans la devise du COMPTE.
  const senderIsUsd = !senderCurrency || senderCurrency === "USD";

  if (faceCurrency !== "USD" && senderIsUsd) {
    const mapped = product.recipientToSenderMap?.[String(faceValue)];
    if (mapped != null && Number.isFinite(mapped) && mapped > 0) {
      return roundCents(mapped);
    }
    const fromIndex = product.fixedSenderDenominations?.[index];
    if (fromIndex != null && Number.isFinite(fromIndex) && fromIndex > 0) {
      return roundCents(fromIndex);
    }
    const rate = Number(product.recipientToSenderRate ?? 0);
    if (Number.isFinite(rate) && rate > 0) {
      return roundCents(faceValue * rate);
    }
    return null;
  }

  // Face déjà en dollars (ou compte non-USD : on ne devine pas).
  if (faceCurrency === "USD" && senderIsUsd) {
    return roundCents(
      faceValue *
        (1 + Number(product.senderFeePercentage ?? 0) / 100) *
        (1 - Number(product.discountPercentage ?? 0) / 100),
    );
  }
  return null;
}

function roundCents(value: number): number {
  return Math.round(value * 100 + 1e-9) / 100;
}

/**
 * Montants tarifés d'un produit Reloadly.
 *
 * Le prix de vente est TOUJOURS calculé à partir du coût réel en USD, jamais
 * à partir du nombre inscrit sur la carte. Un montant dont le coût USD est
 * inconnu est écarté de la proposition (il sera signalé « à vérifier ») :
 * on ne publie jamais un prix inventé.
 */
export function buildDenominations(
  product: SupplierProduct,
  marginPercent: number,
  paymentFeePercent: number,
  existing: DigitalDenomination[] = [],
): SyncDenomination[] {
  const region = regionForProduct(product);
  const currency = (product.currencyCode ?? "").toUpperCase();
  const values = (product.fixedDenominations ?? [])
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);

  const result: SyncDenomination[] = [];
  for (const [index, value] of values.entries()) {
    const costUsd = supplierCostUsd(product, value, index);
    if (costUsd == null || costUsd <= 0) continue;

    const breakdown = computeSalePriceFromCost(costUsd, marginPercent, paymentFeePercent);
    if (!breakdown.ok) continue;

    const label = faceLabel(currency, value);
    const same = existing.find((item) => denominationUnitPrice(item) === value);
    result.push({
      label,
      faceValue: `${value} ${currency}`.trim(),
      faceCurrency: currency || "USD",
      region,
      reloadlyUnitPrice: value,
      priceUsd: breakdown.price,
      cost: breakdown.cost,
      supplierCostUsd: costUsd,
      netMarginPercent: breakdown.netMarginPercent,
      action: same ? "updated" : "added",
    });
  }
  return result;
}

/** Montants de la fiche que le produit n'accepte pas (à désactiver). */
export function staleLabels(product: SupplierProduct, existing: DigitalDenomination[]): string[] {
  if ((product.denominationType ?? "").toUpperCase() !== "FIXED") return [];
  const accepted = new Set(product.fixedDenominations ?? []);
  if (accepted.size === 0) return [];
  return existing
    .filter((item) => item.available)
    .filter((item) => {
      const value = denominationUnitPrice(item);
      return value == null || !accepted.has(value);
    })
    .map((item) => item.label);
}

/** Proposition complète (création ou mise à jour) pour un produit. */
export function buildProposal(input: {
  product: SupplierProduct;
  fiche: DigitalProduct | null;
  marginPercent: number;
  paymentFeePercent: number;
}): SyncProposal {
  const { product, fiche, marginPercent, paymentFeePercent } = input;
  const denominations = buildDenominations(
    product,
    marginPercent,
    paymentFeePercent,
    fiche?.denominations ?? [],
  );
  const disabledLabels = fiche ? staleLabels(product, fiche.denominations) : [];
  const notes: string[] = [];

  if ((product.denominationType ?? "").toUpperCase() === "RANGE") {
    notes.push("Produit à prix libre : montants à définir à la main.");
  }
  if (denominations.length === 0) {
    notes.push("Aucun montant fixe exploitable dans le catalogue Reloadly.");
  }
  // Faces écartées faute de coût USD : on le dit, on n'invente pas un prix.
  const offered = (product.fixedDenominations ?? []).filter((value) => value > 0).length;
  const unpriced = Math.max(0, offered - denominations.length);
  if (unpriced > 0 && (product.currencyCode ?? "").toUpperCase() !== "USD") {
    notes.push(
      `${unpriced} montant(s) écarté(s) : coût réel en USD non publié par Reloadly pour une face en ${(product.currencyCode ?? "").toUpperCase()}. Aucun prix n'est inventé — vérifiez le produit chez Reloadly.`,
    );
  }
  if (disabledLabels.length > 0) {
    notes.push(`${disabledLabels.length} montant(s) non accepté(s) → désactivés (pas supprimés).`);
  }
  if (!fiche) {
    notes.push("Nouvelle fiche créée en « bientôt disponible » : à activer après contrôle.");
  }

  return {
    key: fiche?.id ?? newFicheId(product),
    action: fiche ? "update" : "create",
    matchedFicheId: fiche?.id ?? null,
    productId: product.productId,
    country: regionForProduct(product),
    currency: (product.currencyCode ?? "").toUpperCase(),
    title: fiche?.titleEn || newFicheTitle(product),
    platform: product.brandName || fiche?.platform || "",
    kind: fiche?.kind ?? kindForProduct(product),
    marginPercent,
    senderFeePercent: Number(product.senderFeePercentage ?? 0),
    discountPercent: Number(product.discountPercentage ?? 0),
    denominations,
    disabledLabels,
    notes,
  };
}

/**
 * Applique une proposition à une fiche (ou en crée une).
 *
 * - montants existants reconnus : identifiant conservé (historique intact),
 *   prix et disponibilité mis à jour ;
 * - montants acceptés manquants : ajoutés ;
 * - montants non acceptés : désactivés et annotés, jamais supprimés.
 */
export function applyProposalToProduct(
  proposal: SyncProposal,
  fiche: DigitalProduct | null,
): DigitalProduct {
  const base: DigitalProduct = fiche ?? {
    id: proposal.key,
    slug: proposal.key,
    kind: proposal.kind,
    status: "coming_soon",
    platform: proposal.platform,
    color: "#C6A664",
    titleAr: proposal.title,
    titleEn: proposal.title,
    descriptionAr: "",
    descriptionEn: "",
    image: "",
    regions: [proposal.country],
    featuresAr: [],
    featuresEn: [],
    deliveryNoteAr: "تصلك الكود مباشرة على بريدك الإلكتروني خلال دقائق من تأكيد الدفع.",
    deliveryNoteEn:
      "Your code is delivered straight to your inbox within minutes of payment confirmation.",
    denominations: [],
    sortOrder: 900,
  };

  const existing = base.denominations ?? [];
  const accepted = new Set(proposal.denominations.map((item) => item.reloadlyUnitPrice));

  const kept: DigitalDenomination[] = existing.map((item) => {
    const value = denominationUnitPrice(item);
    if (value != null && !accepted.has(value)) {
      return {
        ...item,
        available: false,
        noteEn: `Désactivé automatiquement : ${value} n'est pas accepté par Reloadly (produit #${proposal.productId}).`,
      };
    }
    const match = proposal.denominations.find((entry) => entry.reloadlyUnitPrice === value);
    return match
      ? {
          ...item,
          priceUsd: match.priceUsd,
          reloadlyUnitPrice: match.reloadlyUnitPrice,
          faceCurrency: match.faceCurrency,
          supplierCostUsd: match.supplierCostUsd,
          available: true,
        }
      : item;
  });

  const added: DigitalDenomination[] = proposal.denominations
    .filter((entry) => !existing.some((item) => denominationUnitPrice(item) === entry.reloadlyUnitPrice))
    .map((entry, index) => ({
      id: `${proposal.key}-${entry.reloadlyUnitPrice}-${index + 1}`,
      label: entry.label,
      faceValue: entry.faceValue,
      faceCurrency: entry.faceCurrency,
      region: entry.region,
      priceUsd: entry.priceUsd,
      supplierCostUsd: entry.supplierCostUsd,
      available: true,
      reloadlyUnitPrice: entry.reloadlyUnitPrice,
    }));

  const regions = Array.from(
    new Set([...(base.regions ?? []), proposal.country].filter(Boolean)),
  );

  return {
    ...base,
    kind: proposal.kind,
    platform: proposal.platform || base.platform,
    regions,
    denominations: [...kept, ...added].sort(
      (a, b) => (denominationUnitPrice(a) ?? 0) - (denominationUnitPrice(b) ?? 0),
    ),
    fulfillment: "auto",
    reloadlyProductId: proposal.productId,
    reloadlyCountryCode: proposal.country === "global" ? "" : proposal.country,
    marginPercent: proposal.marginPercent,
    supplierFeePercent: proposal.senderFeePercent,
    supplierDiscountPercent: proposal.discountPercent,
  };
}
