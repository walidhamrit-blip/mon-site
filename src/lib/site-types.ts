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
  /** Équivalent en devise fiat (USD par défaut) pour le paiement crypto. */
  priceUsd?: number;
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
  planId: string;
  planName: string;
  amountLyd: string;
  amountUsd: string;
  currency: string;
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
