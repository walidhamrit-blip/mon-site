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
  /**
   * Réglages SEO optionnels. Un champ vide / absent = génération
   * automatique depuis le titre et la description du projet
   * (voir src/lib/seo.ts et la page /demos/[slug]).
   */
  metaTitle?: string;
  metaDescription?: string;
  metaTitleEn?: string;
  metaDescriptionEn?: string;
  imageAltAr?: string;
  imageAltEn?: string;
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
  /**
   * Apparence principale du site — choisis depuis /admin → Réglages :
   * le thème principal, le mode clair/sombre et la langue principale.
   * Les visiteurs peuvent toujours basculer depuis les sélecteurs du site.
   */
  appearance: {
    /** Identifiant de la palette principale (voir src/lib/themes.ts). */
    themeId: string;
    /** Mode d'affichage principal. */
    mode: "light" | "dark";
    /** Langue principale du site. */
    defaultLocale: "ar" | "en";
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
  /**
   * Paiement flexible « 1 $ ou plus » : le client choisit son montant
   * (borné min/max) — pratique face aux limites minimales imposées par
   * certaines plateformes de crypto.
   */
  flexiblePayment: FlexiblePaymentConfig;
  /** Services libres / à la carte (restylage, diapositives, design…). */
  standaloneServices: StandaloneService[];
}

export interface FlexiblePaymentConfig {
  enabled: boolean;
  /** Montant minimal facturable en USD (1 $ par défaut). */
  minUsd: number;
  /** Montant maximal facturable en USD (garde-fou anti-abus). */
  maxUsd: number;
  /** Montants suggérés affichés en boutons rapides. */
  suggested: number[];
  /** Note affichée (limites minimales des réseaux crypto…). */
  noteAr: string;
  noteEn: string;
}

/** Service à la carte vendu au forfait (section « services libres »). */
export interface StandaloneService {
  id: string;
  /** Nom d'icône lucide (Palette, LayoutGrid, Presentation, PenTool, Rocket, Wrench). */
  icon: string;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  /** Prix de départ affiché (USD / LYD). */
  priceFromUsd: number;
  priceFromLyd: number;
  badgeAr?: string;
  badgeEn?: string;
  featuresAr: string[];
  featuresEn: string[];
}

/* ---------- Sections de la page d'accueil ---------- */

/** Textes du bloc d'accueil (Hero) — bilingue AR/EN. */
export interface HeroContent {
  badgeAr: string;
  badgeEn: string;
  title1Ar: string;
  title1En: string;
  title2Ar: string;
  title2En: string;
  title3Ar: string;
  title3En: string;
  subtitleAr: string;
  subtitleEn: string;
  ctaPrimaryAr: string;
  ctaPrimaryEn: string;
  ctaSecondaryAr: string;
  ctaSecondaryEn: string;
  trustedAr: string;
  trustedEn: string;
  ratingAr: string;
  ratingEn: string;
  /** Petites pastilles de réassurance (✓ …), une par ligne dans l'admin. */
  chipsAr: string[];
  chipsEn: string[];
}

/** Bandeau défilant des services / points forts. */
export interface RibbonContent {
  taglineAr: string;
  taglineEn: string;
  items: { ar: string; en: string }[];
}

/** Carte de la section « Pourquoi nous ? ». */
export interface WhyUsItem {
  /** Nom d'icône lucide : zap, palette, sliders, search, headset. */
  icon: string;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
}

/** Étape de la section « Processus ». */
export interface ProcessStep {
  num: string;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  durationAr: string;
  durationEn: string;
}

/**
 * Titres / sous-titres éditables des sections du site.
 * Chaque section possède un identifiant stable (voir SectionHeadingId).
 */
export interface SectionHeading {
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  /** Texte secondaire optionnel (ex. durée totale du processus, note tarifs). */
  noteAr?: string;
  noteEn?: string;
}

export const SECTION_HEADING_IDS = [
  "why",
  "demos",
  "identityCustomizer",
  "identityThemes",
  "process",
  "pricing",
  "flexPay",
  "services",
  "testimonials",
  "faq",
  "cta",
] as const;

export type SectionHeadingId = (typeof SECTION_HEADING_IDS)[number];

/** Ensemble des titres de sections, indexé par identifiant. */
export type SectionHeadings = Record<SectionHeadingId, SectionHeading>;

export interface SiteContent {
  demos: Demo[];
  faqs: Faq[];
  testimonials: Testimonial[];
  hero: HeroContent;
  ribbon: RibbonContent;
  whyUs: WhyUsItem[];
  process: ProcessStep[];
  headings: SectionHeadings;
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

/** Nature de la commande : formule complète, réservation ou paiement flexible. */
export const ORDER_KINDS = ["plan", "reservation", "flex"] as const;
export type OrderKind = (typeof ORDER_KINDS)[number];

export const ORDER_KIND_LABELS: Record<OrderKind, string> = {
  plan: "Formule",
  reservation: "Réservation",
  flex: "Paiement flexible",
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
