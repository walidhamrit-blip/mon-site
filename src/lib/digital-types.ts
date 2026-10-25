/**
 * Catalogue digital — codes logiciels, cartes cadeaux gaming, recharges.
 *
 * Ce module définit le DOMAINE, indépendamment du stockage et de
 * l'affichage. Il est le contrat entre :
 *  - la base de données (`src/db/schema.ts` + DDL `ensureSchema`) ;
 *  - l'API publique (`/api/digital/products`) ;
 *  - l'admin (`/admin/digital`) ;
 *  - la vitrine publique (`/codes`).
 *
 * Choix structurants pour une boutique de codes :
 *  - la devise de référence est l'USD (celle facturée par la passerelle) ;
 *  - chaque « dénomination » porte sa RÉGION (« global », « US », « EU »…) :
 *    une carte Steam européenne n'est pas interchangeable avec une carte
 *    américaine, et une erreur de région est le premier motif de litige ;
 *  - le statut `coming_soon` permet de publier la fiche avant l'ouverture
 *    des ventes (le catalogue vit, la caisse n'existe pas encore).
 */

/** Nature du produit digital. */
export const DIGITAL_KINDS = [
  /** Code d'activation logiciel (licence, abonnement, clé permanente). */
  "software_key",
  /** Carte cadeau (Steam, PlayStation, Amazon, Google Play…). */
  "gift_card",
  /** Recharge de monnaie de jeu (Robux, V-Bucks, Coins…). */
  "game_topup",
  /** Code d'abonnement (streaming, musique, cloud, VPN…). */
  "subscription_code",
] as const;

export type DigitalKind = (typeof DIGITAL_KINDS)[number];

/**
 * Libellés lisibles d'un type de produit (admin + filtres publics).
 * Le libellé « fr » sert au panneau d'administration, qui est en français.
 */
export const DIGITAL_KIND_LABELS: Record<
  DigitalKind,
  { ar: string; en: string; fr: string }
> = {
  software_key: { ar: "كود برمجي", en: "Software key", fr: "Code logiciel" },
  gift_card: { ar: "بطاقة هدايا", en: "Gift card", fr: "Carte cadeau" },
  game_topup: { ar: "شحن ألعاب", en: "Game top-up", fr: "Recharge de jeu" },
  subscription_code: {
    ar: "كود اشتراك",
    en: "Subscription code",
    fr: "Code d'abonnement",
  },
};

/**
 * Mode de livraison d'une fiche.
 *  - `manual` : le client paie, l'agence achète le code dans le tableau
 *    Reloadly puis le transmet (aucun débit automatique) ;
 *  - `auto`   : achat et livraison automatiques dès le paiement confirmé
 *    (nécessite un produit Reloadly relié à la fiche).
 */
export const DIGITAL_FULFILLMENTS = ["manual", "auto"] as const;
export type DigitalFulfillment = (typeof DIGITAL_FULFILLMENTS)[number];

/** Cycle de vie d'une fiche du catalogue. */
export const DIGITAL_STATUSES = ["draft", "coming_soon", "available", "archived"] as const;

export type DigitalStatus = (typeof DIGITAL_STATUSES)[number];

export const DIGITAL_STATUS_LABELS: Record<
  DigitalStatus,
  { ar: string; en: string; fr: string }
> = {
  draft: { ar: "مسودة", en: "Draft", fr: "Brouillon" },
  coming_soon: { ar: "قريباً", en: "Coming soon", fr: "Bientôt disponible" },
  available: { ar: "متاح", en: "Available", fr: "Disponible" },
  archived: { ar: "مؤرشف", en: "Archived", fr: "Archivé" },
};

/**
 * Régions de vente reconnues.
 *
 * `global` = valable partout. Les autres sont les zones d'un code-carte
 * classique (PlayStation, Xbox, Nintendo, Amazon, Google Play…).
 */
export const DIGITAL_REGIONS = [
  "global",
  "US",
  "CA",
  "UK",
  "EU",
  "TR",
  "SA",
  "AE",
  "EG",
  "LY",
  "MA",
  "DZ",
  "TN",
] as const;

export type DigitalRegion = (typeof DIGITAL_REGIONS)[number];

/** Libellé lisible d'une région. */
export function regionLabel(region: string, locale: "ar" | "en"): string {
  switch (region.toUpperCase()) {
    case "GLOBAL":
      return locale === "ar" ? "عالمي" : "Global";
    case "US":
      return locale === "ar" ? "الولايات المتحدة" : "United States";
    case "CA":
      return locale === "ar" ? "كندا" : "Canada";
    case "UK":
      return locale === "ar" ? "المملكة المتحدة" : "United Kingdom";
    case "EU":
      return locale === "ar" ? "أوروبا" : "Europe";
    case "TR":
      return locale === "ar" ? "تركيا" : "Türkiye";
    case "SA":
      return locale === "ar" ? "السعودية" : "Saudi Arabia";
    case "AE":
      return locale === "ar" ? "الإمارات" : "UAE";
    case "EG":
      return locale === "ar" ? "مصر" : "Egypt";
    case "LY":
      return locale === "ar" ? "ليبيا" : "Libya";
    case "MA":
      return locale === "ar" ? "المغرب" : "Morocco";
    case "DZ":
      return locale === "ar" ? "الجزائر" : "Algeria";
    case "TN":
      return locale === "ar" ? "تونس" : "Tunisia";
    default:
      return region;
  }
}

/**
 * Une dénomination vendable : « 50 $ », « 500 Robux », « 1 mois »…
 * Chaque dénomination a son prix de vente en USD et sa région.
 */
export interface DigitalDenomination {
  /** Identifiant stable (sert de clé côté admin et côté API). */
  id: string;
  /** Libellé affiché sur la carte (« $10 », « 500 Robux »). */
  label: string;
  /** Valeur faciale communiquée à l'utilisateur (« 10 USD »). */
  faceValue: string;
  /** Région de validité du code. */
  region: string;
  /** Prix de vente en USD (devise de facturation). */
  priceUsd: number;
  /** Note facultative (« bon przez région uniquement »). */
  noteAr?: string;
  noteEn?: string;
  /** Disponible à la vente. */
  available: boolean;
  /**
   * Valeur faciale envoyée au fournisseur Reloadly (`unitPrice`), ex. 50
   * pour une carte « 50 USD ». Vide = déduite de `faceValue`.
   */
  reloadlyUnitPrice?: number | null;
  /**
   * Devise de la valeur faciale : « USD » par défaut, « TRY », « EGP »…
   * Une carte de 500 TRY ne vaut pas 500 $ : sans cette devise, l'audit
   * comparerait le prix à un nombre qui n'est pas de l'argent américain.
   */
  faceCurrency?: string | null;
  /**
   * Coût réel en USD lu chez Reloadly pour ce montant (`null` = inconnu).
   * C'est la SEULE base fiable pour une face non-USD.
   */
  supplierCostUsd?: number | null;
}

/** Fiche produit du catalogue digital. */
export interface DigitalProduct {
  /** Identifiant stable (clé primaire en base). */
  id: string;
  /** Slug d'URL — `/codes/<slug>`. */
  slug: string;
  /** Nature du produit. */
  kind: DigitalKind;
  /** Cycle de vie. */
  status: DigitalStatus;
  /** Plateforme / marque (« Steam », « PlayStation », « Roblox »…). */
  platform: string;
  /** Couleur de la carte (hex). */
  color: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  /** Visuel de la carte (URL absolue ou chemin `/...`). */
  image: string;
  /** Régions couvertes par la fiche. */
  regions: string[];
  featuresAr: string[];
  featuresEn: string[];
  /** Note de livraison (« code reçu par e-mail en quelques minutes »). */
  deliveryNoteAr: string;
  deliveryNoteEn: string;
  /** Dénominations vendables. */
  denominations: DigitalDenomination[];
  /** Ordre d'affichage dans le catalogue. */
  sortOrder: number;

  /* ---------- Livraison à la commande (Reloadly) ---------- */

  /** Mode de livraison (défaut : `manual`). */
  fulfillment?: DigitalFulfillment;
  /** Identifiant du produit chez Reloadly. */
  reloadlyProductId?: number | null;
  /** Pays du produit Reloadly (ISO 2 lettres). */
  reloadlyCountryCode?: string;
  /**
   * Marge NETTE visée sur cette fiche, en % du prix payé (null = prix
   * saisis à la main). Sert au calcul automatique des prix de vente.
   */
  marginPercent?: number | null;
  /**
   * Frais du fournisseur (`senderFeePercentage`), mémorisés sur la fiche.
   * `null` = inconnus : le contrôle de perte reste prudent.
   */
  supplierFeePercent?: number | null;
  /**
   * Remise du fournisseur (`discountPercentage`), mémorisée sur la fiche.
   * Une remise peut rendre rentable un prix inférieur à la valeur faciale.
   */
  supplierDiscountPercent?: number | null;
}

/** Statuts visibles publiquement (le catalogue public ignore les brouillons). */
export const PUBLIC_DIGITAL_STATUSES: DigitalStatus[] = ["coming_soon", "available"];

/** Fiche « plate » servie par l'API publique (sans notes internes). */
export interface PublicDigitalProduct extends Omit<DigitalProduct, "deliveryNoteAr" | "deliveryNoteEn"> {
  deliveryNoteAr: string;
  deliveryNoteEn: string;
}

/**
 * Calcule le prix d'entrée d'une fiche (en USD) : la dénomination la moins
 * chère disponible. `null` si aucune dénomination n'est vendable.
 */
export function lowestPriceUsd(product: DigitalProduct): number | null {
  const prices = product.denominations
    .filter((d) => d.available && Number.isFinite(d.priceUsd) && d.priceUsd > 0)
    .map((d) => d.priceUsd);
  if (prices.length === 0) return null;
  return Math.min(...prices);
}

/** Prix le plus élevé d'une fiche (en USD), ou `null`. */
export function highestPriceUsd(product: DigitalProduct): number | null {
  const prices = product.denominations
    .filter((d) => d.available && Number.isFinite(d.priceUsd) && d.priceUsd > 0)
    .map((d) => d.priceUsd);
  if (prices.length === 0) return null;
  return Math.max(...prices);
}

/** Régions effectivement proposées par une fiche (dénominations disponibles). */
export function availableRegions(product: DigitalProduct): string[] {
  const regions = new Set<string>();
  for (const denomination of product.denominations) {
    if (denomination.available) regions.add(denomination.region.toUpperCase());
  }
  for (const region of product.regions) regions.add(region.toUpperCase());
  return Array.from(regions);
}

/** Slug normalisé : minuscules, tirets, sans accent. */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Mode de livraison effectif : un produit n'est acheté automatiquement
 * que si la fiche est en `auto` ET qu'un produit Reloadly est relié. Un
 * oubli de mappage retombe donc sur une livraison manuelle — jamais sur
 * un achat au hasard.
 */
export function effectiveFulfillment(product: DigitalProduct): DigitalFulfillment {
  if (product.fulfillment === "auto" && Number(product.reloadlyProductId) > 0) {
    return "auto";
  }
  return "manual";
}

/**
 * Vrai si la fiche peut être vendue en ligne : publiée (`available`) et
 * au moins un montant disponible. Les fiches « bientôt » restent en
 * liste d'attente.
 */
export function isSellable(product: DigitalProduct): boolean {
  return (
    product.status === "available" &&
    product.denominations.some(
      (denomination) =>
        denomination.available &&
        Number.isFinite(denomination.priceUsd) &&
        denomination.priceUsd > 0,
    )
  );
}

/**
 * Valeur faciale (Reloadly `unitPrice`) d'une dénomination : champ dédié
 * s'il est renseigné, sinon premier nombre trouvé dans `faceValue`
 * (« 50 USD », « 500 Robux » → 50 / 500).
 */
export function denominationUnitPrice(denomination: DigitalDenomination): number | null {
  const explicit = Number(denomination.reloadlyUnitPrice);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const match = denomination.faceValue.match(/\d+(?:[.,]\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0].replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
