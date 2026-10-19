// Types partagés entre le site public, le stockage (base de données)
// et le panneau d'administration. Aucune dépendance serveur ici.

export interface Demo {
  slug: string;
  sector: string;
  sectorAr: string;
  sectorEn: string;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  image: string;
  color: string;
  features: string[];
  featuresEn: string[];
  previewUrl: string;
  /**
   * Classification du projet : identifiant de la formule tarifaire
   * (« vitrine », « vitrine-plus », « boutique »…) qui définit la
   * catégorie et le prix affichés sur la fiche du site.
   */
  planId?: string;
  /**
   * Numéro de catégorie affiché (1, 2, 3…). Stocké séparément de la
   * formule pour rester stable même si l'ordre des tarifs change.
   */
  categoryTier?: number;
  /**
   * Prix USD propre à ce projet. Absent / null = prix de la catégorie.
   * Permet au propriétaire d'ajuster un prix au cas par cas depuis
   * le panneau d'administration.
   */
  priceUsd?: number | null;
}

export interface Faq {
  qAr: string;
  qEn: string;
  aAr: string;
  aEn: string;
}

export interface Testimonial {
  name: string;
  nameEn: string;
  role: string;
  roleEn: string;
  text: string;
  textEn: string;
  image: string;
  rating: number;
  beforeAfter: { before: string; after: string };
  beforeAfterEn: { before: string; after: string };
}

export interface PricingPlanData {
  id: string;
  name: string;
  nameEn: string;
  price: number;
  /**
   * Équivalent en devise fiat (USD par défaut) pour le paiement crypto.
   * `null` (champ vidé dans l'admin) = formule non payable en crypto.
   */
  priceUsd?: number | null;
  originalPrice: number | null;
  period: string;
  periodEn: string;
  description: string;
  descriptionEn: string;
  featured: boolean;
  badge?: string;
  badgeEn?: string;
  cta: string;
  ctaEn: string;
  features: string[];
  featuresEn: string[];
}

export interface SiteConfigData {
  name: string;
  nameAr: string;
  tagline: string;
  domain: string;
  url: string;
  email: string;
  phone: string;
  whatsapp: string;
  address: string;
  addressEn: string;
  hours: string;
  hoursEn: string;
  pricing: {
    currency: string;
    currencyEn: string;
    plans: PricingPlanData[];
  };
  theme: {
    accent: string;
    accentHover: string;
  };
  social: {
    instagram: string;
    facebook: string;
    whatsapp: string;
    tiktok: string;
  };
  stats: {
    delivery: string;
    deliveryEn: string;
    sitesDelivered: string;
    satisfaction: string;
    support: string;
  };
  /** Réservation prioritaire : petit acompte pour prendre une place. */
  reservation: {
    enabled: boolean;
    /** Montant de l'acompte facturé en USD (1 $ par défaut). */
    depositUsd: number;
    /** Équivalent affiché en Livre libyenne. */
    depositLyd: number;
  };
}

export interface SiteContent {
  demos: Demo[];
  faqs: Faq[];
  testimonials: Testimonial[];
}

/* ---------- Demandes (leads) ---------- */

export const LEAD_STATUSES = ["new", "in_progress", "done", "archived"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Nouveau",
  in_progress: "En cours",
  done: "Traité",
  archived: "Archivé",
};

export interface LeadRow {
  id: number;
  /** ISO string (serialisable vers un composant client) */
  createdAt: string;
  /** Date formatée côté serveur (fr-FR, fuseau Tripoli) */
  dateFr: string;
  name: string;
  business: string;
  phone: string;
  email: string | null;
  sector: string;
  need: string;
  budget: string;
  deadline: string;
  message: string | null;
  utm: string | null;
  locale: string | null;
  status: LeadStatus;
  notes: string | null;
}

/* ---------- Commandes (paiements crypto) ---------- */

/** Nature de la commande : formule complète ou réservation prioritaire. */
export const ORDER_KINDS = ["plan", "reservation"] as const;
export type OrderKind = (typeof ORDER_KINDS)[number];

export const ORDER_KIND_LABELS: Record<OrderKind, string> = {
  plan: "Formule",
  reservation: "Réservation",
};

export const ORDER_STATUSES = ["pending", "paid", "failed", "expired"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "En attente",
  paid: "Payé",
  failed: "Échoué",
  expired: "Expiré",
};

export interface OrderRow {
  id: number;
  createdAt: string;
  dateFr: string;
  ref: string;
  /** « plan » (formule complète) ou « reservation » (acompte prioritaire). */
  kind: OrderKind;
  /** Slug du site consulté pour une réservation. */
  demoSlug: string | null;
  planId: string;
  planName: string;
  amountLyd: string;
  amountUsd: string;
  currency: string;
  /** Nombre total de tranches (1 = paiement en une fois). */
  installments: number;
  /** Numéro de la tranche (1…installments). */
  installmentIndex: number;
  /** Référence commune aux tranches d'un même paiement. */
  groupRef: string | null;
  clientName: string | null;
  email: string | null;
  phone: string | null;
  paymentId: string | null;
  payAddress: string | null;
  payCurrency: string | null;
  payAmount: string | null;
  paymentUrl: string | null;
  status: OrderStatus;
  ipnStatus: string | null;
  utm: string | null;
  locale: string | null;
}
