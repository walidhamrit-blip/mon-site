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
   */
  priceUsd?: number | null;
  /**
   * Réglages SEO optionnels. Un champ vide / absent = génération
   * automatique depuis le titre et la description du projet.
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
  /**
   * Prix du modèle en USD — devise unique du site (1 USD = 1 USDT au
   * paiement crypto). `null` (champ vidé dans l'admin) = formule non
   * payable en ligne.
   */
  priceUsd?: number | null;
  /** Pourcentage appliqué au prix du modèle pour calculer les frais de personnalisation. */
  customizationPercent?: number | null;
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

/**
 * Profils d'avis et demandes d'avis.
 *
 * Aucune note n'est stockée ici : uniquement des **URL de profils réels**
 * (validées par `src/lib/trust.ts`) et l'interrupteur d'envoi de la demande
 * d'avis après livraison. Une note saisie à la main serait une note non
 * sourcée — précisément ce que l'audit A11 a retiré du site.
 */
export interface TrustConfigData {
  /** Profil Trustpilot (`https://fr.trustpilot.com/review/<domaine>`). */
  trustpilotUrl: string;
  /**
   * Lien direct « écrire un avis » (`https://www.trustpilot.com/evaluate/<domaine>`),
   * facultatif. Utilisé en priorité dans les e-mails d'invitation : un clic de
   * moins entre la livraison et l'avis.
   */
  trustpilotReviewUrl: string;
  /** Fiche Scamadviser (`https://www.scamadviser.com/check-website/<domaine>`). */
  scamadviserUrl: string;
  /** Lien « laisser un avis » du profil Google Business. */
  googleReviewUrl: string;
  /** Envoie la demande d'avis dans les e-mails de livraison. */
  reviewInvites: boolean;
  /**
   * Identifiant du compte Trustpilot (business unit) — indispensable au
   * widget. Visible dans l'URL du logo de la fiche publique.
   */
  businessUnitId: string;
  /** Gabarit du widget : nom lisible (`micro-combo`…) ou identifiant. */
  widgetTemplate: string;
  /**
   * Nombre d'avis à partir duquel le widget s'affiche. `1` évite le
   * « 0,0 / 5 » d'un profil vide ; `0` force l'affichage.
   */
  widgetMinReviews: number;
}

/**
 * Identité légale affichée sur `/mentions-legales`.
 *
 * Chaque champ vide est simplement **omis** de la page : mieux vaut une
 * mention absente qu'un numéro de registre inventé.
 */
export interface LegalConfigData {
  /** Raison sociale (si différente du nom de marque). */
  companyName: string;
  /** Numéro d'immatriculation (registre de commerce). */
  registrationNumber: string;
  /** Autorité / ville d'immatriculation. */
  registrationAuthority: string;
  /** Responsable de la publication. */
  publisherName: string;
  /** Hébergeur du site. */
  hostName: string;
  hostWebsite: string;
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
  /**
   * Marché de référence (ville, pays, fuseau, devise locale, zone de
   * service). C'est ce bloc qui rend le site « réglable » hors Libye :
   * tout le SEO local, l'horodatage et les libellés en découlent.
   */
  market: MarketConfigData;
  /** Affichage des prix dans plusieurs devises (facturation toujours en USD). */
  currency: CurrencyConfigData;
  pricing: {
    currency: string;
    currencyEn: string;
    plans: PricingPlanData[];
  };
  theme: {
    accent: string;
    accentHover: string;
  };
  appearance: {
    themeId: string;
    mode: "light" | "dark";
    /** Langue de référence (HTML + SEO). "auto" = langue du marché. */
    primaryLocale: "auto" | "ar" | "en";
    /** Ancien champ, conservé pour les configurations existantes. */
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
    // A11 : pas de champs « sites livrés / satisfaction / note / avis /
    // support 24/7 » — chiffres non sourcés, retirés de la config, de
    // l'admin et des flux llms. Voir src/lib/config.ts.
  };
  reservation: {
    enabled: boolean;
    depositUsd: number;
  };
  flexiblePayment: FlexiblePaymentConfig;
  standaloneServices: StandaloneService[];
  fazercards: {
    maxOrderUsd: number;
    /** Interrupteur opérationnel persistant, indépendant des autres réglages. */
    phoneCardPaymentsEnabled: boolean;
    phoneCardRateMode: "auto" | "manual";
    phoneCardManualRateLyd: number | null;
    phoneCardManualRateUpdatedAt: string | null;
  };
  /** Profils d'avis (Trustpilot, Google, Scamadviser) + demandes d'avis. */
  trust: TrustConfigData;
  /** Identité légale publiée sur /mentions-legales. */
  legal: LegalConfigData;
}

/** Profil de marché éditable depuis /admin → Réglages. */
export interface MarketConfigData {
  id: string;
  countryCode: string;
  countryAr: string;
  countryEn: string;
  cityAr: string;
  cityEn: string;
  timezone: string;
  locale: string;
  currency: string;
  currencyAr: string;
  currencyEn: string;
  phonePrefix: string;
  lat: number;
  lng: number;
  localRadiusKm: number;
  /** true = le site se déclare accessible internationalement. */
  globalReach: boolean;
}

/** Devises d'affichage + taux de conversion (1 USD = X). */
export interface CurrencyConfigData {
  base: string;
  rates: Record<string, number>;
  enabled: string[];
}

export interface FlexiblePaymentConfig {
  enabled: boolean;
  minUsd: number;
  maxUsd: number;
  suggested: number[];
  noteAr: string;
  noteEn: string;
}

export interface StandaloneService {
  id: string;
  icon: string;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  priceFromUsd: number;
  badgeAr?: string;
  badgeEn?: string;
  featuresAr: string[];
  featuresEn: string[];
}

/* ---------- Sections de la page d'accueil ---------- */

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
  chipsAr: string[];
  chipsEn: string[];
}

export interface RibbonContent {
  taglineAr: string;
  taglineEn: string;
  items: { ar: string; en: string }[];
}

export interface WhyUsItem {
  icon: string;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
}

export interface ProcessStep {
  num: string;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  durationAr: string;
  durationEn: string;
}

export interface SectionHeading {
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  subtitleEn: string;
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

export type SectionHeadings = Record<SectionHeadingId, SectionHeading>;

/* ---------- Architecture dynamique des sections & sites personnalisés ---------- */

export const BUILTIN_SECTION_IDS = [
  "hero",
  "ribbon",
  "whyUs",
  "demos",
  "identityStudio",
  "process",
  "pricing",
  "services",
  "testimonials",
  "faq",
  "cta",
] as const;

export type BuiltInSectionId = (typeof BUILTIN_SECTION_IDS)[number];

/**
 * Section personnalisée créée depuis /admin : possède son propre en-tête
 * bilingue et sa propre liste de sites (avec aperçu interactif en direct,
 * mode plein écran Desktop/Mobile et réservation).
 */
export interface CustomSiteSection {
  id: string;
  badgeAr: string;
  badgeEn: string;
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  /** Mode d'affichage : galerie interactive avec écran live ou grille de cartes. */
  variant: "interactive" | "cards";
  /** Liste des sites appartenant à cette section. */
  sites: Demo[];
}

export interface HomeSectionEntry {
  /** Clé unique : ex. "demos" ou "custom:mes-projets". */
  key: string;
  kind: "builtin" | "custom";
  builtinId?: BuiltInSectionId;
  customId?: string;
  enabled: boolean;
}

export interface HomeLayoutConfig {
  entries: HomeSectionEntry[];
  customSections: CustomSiteSection[];
}

/* ---------- Pages « Nos applications » & « Produits numériques & logiciels » ---------- */

export const LAUNCH_STATUSES = [
  "in_preparation",
  "coming_soon",
  "available",
] as const;

export type LaunchStatus = (typeof LAUNCH_STATUSES)[number];

export interface UpcomingCatalogItem {
  id: string;
  slug: string;
  status: LaunchStatus;
  badgeAr: string;
  badgeEn: string;
  categoryAr: string;
  categoryEn: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  image: string;
  color: string;
  platforms: string[];
  featuresAr: string[];
  featuresEn: string[];
  progress?: number | null;
  priceHintUsd?: number | null;
  demoUrl?: string;
}

export interface ShowcasePageConfig {
  statusBadgeAr: string;
  statusBadgeEn: string;
  titleAr: string;
  titleEn: string;
  highlightAr: string;
  highlightEn: string;
  subtitleAr: string;
  subtitleEn: string;
  bannerNoteAr: string;
  bannerNoteEn: string;
  ctaLabelAr: string;
  ctaLabelEn: string;
  items: UpcomingCatalogItem[];
}

/* ---------- Bannières & visuels des sections ---------- */

export const VISUAL_IMAGE_IDS = [
  "homeHero",
  "webBanner",
  "storeBanner",
  "gatewayWebsites",
  "gatewayGiftCards",
  "gatewayTopUps",
] as const;

export type VisualImageId = (typeof VISUAL_IMAGE_IDS)[number];

export interface SiteVisualImage {
  /** Chemin local (/visuals/… ou /api/media/…) ou URL HTTPS absolue. */
  src: string;
  altAr: string;
  altEn: string;
}

export type SiteVisuals = Record<VisualImageId, SiteVisualImage>;

export interface SiteContent {
  demos: Demo[];
  faqs: Faq[];
  testimonials: Testimonial[];
  hero: HeroContent;
  ribbon: RibbonContent;
  whyUs: WhyUsItem[];
  process: ProcessStep[];
  headings: SectionHeadings;
  layout: HomeLayoutConfig;
  appsPage: ShowcasePageConfig;
  productsPage: ShowcasePageConfig;
  visuals: SiteVisuals;
}

/**
 * Fusionne sans doublon les sites de la galerie principale et ceux des
 * sections personnalisées actives (pur TypeScript — utilisable côté client et serveur).
 */
export function collectAllDemos(
  content: Pick<SiteContent, "demos" | "layout">,
): Demo[] {
  const seen = new Set<string>();
  const all: Demo[] = [];
  for (const d of content.demos) {
    if (!seen.has(d.slug)) {
      seen.add(d.slug);
      all.push(d);
    }
  }
  const activeCustomIds = new Set(
    content.layout.entries
      .filter((e) => e.kind === "custom" && e.enabled && e.customId)
      .map((e) => e.customId as string),
  );
  for (const sec of content.layout.customSections) {
    if (!activeCustomIds.has(sec.id)) continue;
    for (const d of sec.sites) {
      if (!seen.has(d.slug)) {
        seen.add(d.slug);
        all.push(d);
      }
    }
  }
  return all;
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
  createdAt: string;
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

export const ORDER_KINDS = ["plan", "reservation", "flex", "subscription", "digital"] as const;
export type OrderKind = (typeof ORDER_KINDS)[number];

export const ORDER_KIND_LABELS: Record<OrderKind, string> = {
  plan: "Formule",
  reservation: "Réservation",
  flex: "Paiement flexible",
  subscription: "Abonnement",
  digital: "Code / carte cadeau",
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
  kind: OrderKind;
  demoSlug: string | null;
  planId: string;
  planName: string;
  amountLyd: string;
  amountUsd: string;
  currency: string;
  installments: number;
  installmentIndex: number;
  groupRef: string | null;
  clientName: string | null;
  email: string | null;
  phone: string | null;
  paymentId: string | null;
  payAddress: string | null;
  payCurrency: string | null;
  payAmount: string | null;
  paymentUrl: string | null;
  paymentMethod: "nowpayments" | "phone_card";
  status: OrderStatus;
  ipnStatus: string | null;
  utm: string | null;
  locale: string | null;
}
