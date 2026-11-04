import { z } from "zod";
import { LEAD_STATUSES } from "@/lib/site-types";
import { DIGITAL_KINDS, DIGITAL_STATUSES } from "@/lib/digital-types";
import { DEFAULT_THEME_ID } from "@/lib/themes";

/* ---------- Nouvelle demande (formulaire public -> /api/lead) ---------- */

export const leadInputSchema = z.object({
  business: z.string().min(2).max(300),
  sector: z.string().min(2).max(100),
  need: z.string().min(1).max(100),
  budget: z.string().min(1).max(100),
  deadline: z.string().min(1).max(100),
  name: z.string().min(2).max(200),
  phone: z.string().min(6).max(50),
  email: z
    .string()
    .email("Email invalide")
    .max(200)
    .optional()
    .or(z.literal("")),
  message: z.string().max(4000).optional(),
  utm: z.string().max(1000).optional(),
  locale: z.string().max(10).optional(),
});

export type LeadInput = z.infer<typeof leadInputSchema>;

/* ---------- Contenu éditable ---------- */

export const demoSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug invalide (lettres minuscules, chiffres et tirets)"),
  sector: z.string().min(1).max(60),
  sectorAr: z.string().min(1).max(120),
  sectorEn: z.string().min(1).max(120),
  title: z.string().min(1).max(200),
  titleEn: z.string().min(1).max(200),
  description: z.string().min(1).max(500),
  descriptionEn: z.string().min(1).max(500),
  image: z.string().min(4).max(1000),
  color: z.string().regex(/^#[0-9a-fA-F]{3,8}$/, "Couleur hexadécimale attendue (#RRGGBB)"),
  features: z.array(z.string().max(200)).max(20),
  featuresEn: z.array(z.string().max(200)).max(20),
  previewUrl: z.string().max(1000),
  /** Formule utilisée pour classer le site (catégorie + prix). */
  planId: z.string().max(60).optional(),
  /** Numéro de catégorie affiché (1, 2, 3…). */
  categoryTier: z.coerce.number().int().min(1).max(99).optional(),
  /** Prix USD propre au projet (null / absent = prix de la catégorie). */
  priceUsd: z.coerce
    .number()
    .min(0)
    .max(1_000_000)
    .nullable()
    .optional(),
  /** SEO optionnel : valeur vide = fallback automatique côté page. */
  metaTitle: z.string().max(70).optional().or(z.literal("")),
  metaDescription: z.string().max(200).optional().or(z.literal("")),
  metaTitleEn: z.string().max(70).optional().or(z.literal("")),
  metaDescriptionEn: z.string().max(200).optional().or(z.literal("")),
  imageAltAr: z.string().max(150).optional().or(z.literal("")),
  imageAltEn: z.string().max(150).optional().or(z.literal("")),
});

export const faqSchema = z.object({
  qAr: z.string().min(1).max(500),
  qEn: z.string().min(1).max(500),
  aAr: z.string().min(1).max(3000),
  aEn: z.string().min(1).max(3000),
});

export const testimonialSchema = z.object({
  name: z.string().min(1).max(200),
  nameEn: z.string().min(1).max(200),
  role: z.string().min(1).max(300),
  roleEn: z.string().min(1).max(300),
  text: z.string().min(1).max(2000),
  textEn: z.string().min(1).max(2000),
  image: z.string().max(1000),
  rating: z.coerce.number().int().min(1).max(5),
  beforeAfter: z.object({ before: z.string().max(300), after: z.string().max(300) }),
  beforeAfterEn: z.object({ before: z.string().max(300), after: z.string().max(300) }),
});

/* ---------- Sections éditoriales de la page d'accueil ---------- */

export const heroSchema = z.object({
  badgeAr: z.string().max(300),
  badgeEn: z.string().max(300),
  title1Ar: z.string().max(200),
  title1En: z.string().max(200),
  title2Ar: z.string().max(200),
  title2En: z.string().max(200),
  title3Ar: z.string().max(200),
  title3En: z.string().max(200),
  subtitleAr: z.string().max(1000),
  subtitleEn: z.string().max(1000),
  ctaPrimaryAr: z.string().max(100),
  ctaPrimaryEn: z.string().max(100),
  ctaSecondaryAr: z.string().max(100),
  ctaSecondaryEn: z.string().max(100),
  trustedAr: z.string().max(300),
  trustedEn: z.string().max(300),
  ratingAr: z.string().max(100),
  ratingEn: z.string().max(100),
  chipsAr: z.array(z.string().max(200)).max(12),
  chipsEn: z.array(z.string().max(200)).max(12),
});

export const ribbonSchema = z.object({
  taglineAr: z.string().max(300),
  taglineEn: z.string().max(300),
  items: z
    .array(
      z.object({
        ar: z.string().max(200),
        en: z.string().max(200),
      }),
    )
    .max(30),
});

export const whyUsSchema = z
  .array(
    z.object({
      icon: z.string().max(40),
      titleAr: z.string().min(1).max(200),
      titleEn: z.string().min(1).max(200),
      descAr: z.string().max(1000),
      descEn: z.string().max(1000),
    }),
  )
  .max(20);

export const processSchema = z
  .array(
    z.object({
      num: z.string().max(10),
      titleAr: z.string().min(1).max(200),
      titleEn: z.string().min(1).max(200),
      descAr: z.string().max(1000),
      descEn: z.string().max(1000),
      durationAr: z.string().max(100),
      durationEn: z.string().max(100),
    }),
  )
  .max(20);

export const sectionHeadingSchema = z.object({
  titleAr: z.string().max(300),
  titleEn: z.string().max(300),
  subtitleAr: z.string().max(1000),
  subtitleEn: z.string().max(1000),
  noteAr: z.string().max(300).optional(),
  noteEn: z.string().max(300).optional(),
});

export const sectionHeadingsSchema = z.object({
  why: sectionHeadingSchema,
  demos: sectionHeadingSchema,
  identityCustomizer: sectionHeadingSchema,
  identityThemes: sectionHeadingSchema,
  process: sectionHeadingSchema,
  pricing: sectionHeadingSchema,
  flexPay: sectionHeadingSchema,
  services: sectionHeadingSchema,
  testimonials: sectionHeadingSchema,
  faq: sectionHeadingSchema,
  cta: sectionHeadingSchema,
});

export const customSiteSectionSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Identifiant de section invalide"),
  badgeAr: z.string().max(200),
  badgeEn: z.string().max(200),
  titleAr: z.string().min(1).max(300),
  titleEn: z.string().min(1).max(300),
  subtitleAr: z.string().max(1000),
  subtitleEn: z.string().max(1000),
  variant: z.enum(["interactive", "cards"]),
  sites: z.array(demoSchema).max(60),
});

export const homeLayoutSchema = z.object({
  entries: z
    .array(
      z.object({
        key: z.string().min(1).max(120),
        kind: z.enum(["builtin", "custom"]),
        builtinId: z
          .enum([
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
          ])
          .optional(),
        customId: z.string().max(100).optional(),
        enabled: z.boolean(),
      }),
    )
    .max(60),
  customSections: z.array(customSiteSectionSchema).max(40),
});

export const upcomingCatalogItemSchema = z.object({
  id: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug invalide (lettres minuscules, chiffres et tirets)"),
  status: z.enum(["in_preparation", "coming_soon", "available"]),
  badgeAr: z.string().max(120),
  badgeEn: z.string().max(120),
  categoryAr: z.string().max(120),
  categoryEn: z.string().max(120),
  titleAr: z.string().min(1).max(240),
  titleEn: z.string().min(1).max(240),
  descriptionAr: z.string().min(1).max(1200),
  descriptionEn: z.string().min(1).max(1200),
  image: z.string().min(4).max(1000),
  color: z.string().regex(/^#[0-9a-fA-F]{3,8}$/, "Couleur hexadécimale attendue (#RRGGBB)"),
  platforms: z.array(z.string().max(100)).max(12),
  featuresAr: z.array(z.string().max(200)).max(16),
  featuresEn: z.array(z.string().max(200)).max(16),
  progress: z.coerce.number().int().min(0).max(100).nullable().optional(),
  priceHintUsd: z.coerce.number().min(0).max(1_000_000).nullable().optional(),
  demoUrl: z.string().max(1000).optional().or(z.literal("")),
});

export const showcasePageSchema = z.object({
  statusBadgeAr: z.string().max(200),
  statusBadgeEn: z.string().max(200),
  titleAr: z.string().min(1).max(300),
  titleEn: z.string().min(1).max(300),
  highlightAr: z.string().max(300),
  highlightEn: z.string().max(300),
  subtitleAr: z.string().max(1500),
  subtitleEn: z.string().max(1500),
  bannerNoteAr: z.string().max(1000),
  bannerNoteEn: z.string().max(1000),
  ctaLabelAr: z.string().max(120),
  ctaLabelEn: z.string().max(120),
  items: z.array(upcomingCatalogItemSchema).max(60),
});

export const visualImageSchema = z.object({
  src: z
    .string()
    .trim()
    .min(1, "Ajoutez une image ou une URL")
    .max(1500)
    .refine((value) => {
      if (value.startsWith("/")) {
        return !value.startsWith("//") && !/[\\\u0000-\u001f]/.test(value);
      }
      try {
        return new URL(value).protocol === "https:";
      } catch {
        return false;
      }
    }, "Utilisez un chemin local (/…) ou une URL HTTPS"),
  altAr: z.string().max(240),
  altEn: z.string().max(240),
});

export const siteVisualsSchema = z.object({
  homeHero: visualImageSchema,
  webBanner: visualImageSchema,
  storeBanner: visualImageSchema,
  gatewayWebsites: visualImageSchema,
  gatewayGiftCards: visualImageSchema,
  gatewayTopUps: visualImageSchema,
});

export const contentSchemas = {
  demos: z.array(demoSchema).max(80),
  faqs: z.array(faqSchema).max(60),
  testimonials: z.array(testimonialSchema).max(60),
  hero: heroSchema,
  ribbon: ribbonSchema,
  whyUs: whyUsSchema,
  process: processSchema,
  headings: sectionHeadingsSchema,
  layout: homeLayoutSchema,
  appsPage: showcasePageSchema,
  productsPage: showcasePageSchema,
  visuals: siteVisualsSchema,
} as const;

export type ContentSection = keyof typeof contentSchemas;

/* ---------- Configuration du site (coordonnées + tarifs) ---------- */

const planSchema = z.object({
  id: z.string().min(1).max(60),
  name: z.string().min(1).max(200),
  nameEn: z.string().min(1).max(200),
  /**
   * Prix USD de la formule — devise unique du site, facturée telle
   * quelle par NOWPayments (1 USD = 1 USDT). `null` / absent = formule
   * non payable en crypto (le bouton « Pay with crypto » et les
   * paiements en tranches ne s'affichent pas).
   */
  priceUsd: z.coerce
    .number()
    .int()
    .min(0)
    .max(1_000_000)
    .nullable()
    .optional(),
  /** Personnalisation en pourcentage du prix modèle ; null/absent = devis avant paiement. */
  customizationPercent: z.coerce.number().min(0).max(100).nullable().optional(),
  period: z.string().max(100),
  periodEn: z.string().max(100),
  description: z.string().max(500),
  descriptionEn: z.string().max(500),
  featured: z.boolean(),
  badge: z.string().max(100).optional(),
  badgeEn: z.string().max(100).optional(),
  cta: z.string().max(100),
  ctaEn: z.string().max(100),
  features: z.array(z.string().max(300)).max(20),
  featuresEn: z.array(z.string().max(300)).max(20),
});

/* ---------- Marché & devises ---------- */

export const marketSchema = z.object({
  id: z.string().min(1).max(40),
  countryCode: z.string().min(2).max(4),
  countryAr: z.string().min(1).max(80),
  countryEn: z.string().min(1).max(80),
  cityAr: z.string().min(1).max(80),
  cityEn: z.string().min(1).max(80),
  timezone: z.string().min(1).max(60),
  locale: z.string().min(2).max(12),
  currency: z.string().min(2).max(8),
  currencyAr: z.string().max(12),
  currencyEn: z.string().max(12),
  phonePrefix: z.string().max(12),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  localRadiusKm: z.coerce.number().min(0).max(20_000),
  globalReach: z.boolean().default(true),
});

export const currencyConfigSchema = z.object({
  base: z.string().min(2).max(8),
  rates: z.record(z.string(), z.coerce.number().positive().max(1_000_000)),
  enabled: z.array(z.string().min(2).max(8)).min(1).max(12),
});

export const siteConfigSchema = z.object({
  name: z.string().min(1).max(100),
  nameAr: z.string().min(1).max(100),
  tagline: z.string().max(200),
  domain: z
    .string()
    .trim()
    .max(200)
    .regex(
      /^(?=.{1,200}$)[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i,
      "domaine invalide (ex. exemple.com)",
    ),
  url: z
    .string()
    .trim()
    .min(8)
    .max(500)
    .refine(
      (value) => {
        try {
          const parsed = new URL(value);
          return parsed.protocol === "https:" || parsed.protocol === "http:";
        } catch {
          return false;
        }
      },
      "URL absolue invalide (ex. https://exemple.com)",
    ),
  email: z.string().max(200),
  phone: z.string().max(100),
  whatsapp: z.string().max(100),
  address: z.string().max(400),
  addressEn: z.string().max(400),
  hours: z.string().max(200),
  hoursEn: z.string().max(200),
  pricing: z.object({
    currency: z.string().max(20),
    currencyEn: z.string().max(20),
    plans: z.array(planSchema).min(1).max(12),
  }),
  social: z.object({
    instagram: z.string().max(500),
    facebook: z.string().max(500),
    whatsapp: z.string().max(500),
    tiktok: z.string().max(500),
  }),
  stats: z.object({
    delivery: z.string().max(50),
    deliveryEn: z.string().max(50),
    // A11 : anciens champs non sourcés (sitesDelivered, satisfaction,
    // support) retirés — les clés héritées en base sont ignorées.
  }),
  reservation: z.object({
    enabled: z.boolean(),
    depositUsd: z.coerce.number().min(0).max(10_000),
  }),
  /**
   * Apparence principale du site : thème principal, mode clair/sombre et
   * langue principale (défauts des visiteurs, choisis dans /admin).
   */
  appearance: z
    .object({
      themeId: z.string().min(1).max(40).default(DEFAULT_THEME_ID),
      mode: z.enum(["light", "dark"]).default("light"),
      /**
       * Langue de référence du site. "auto" suit le marché : c'est le
       * réglage recommandé (arabe pour la Libye), surchargeable en un clic.
       */
      primaryLocale: z.enum(["auto", "ar", "en"]).default("auto"),
      defaultLocale: z.enum(["ar", "en"]).default("ar"),
    })
    .default({
      themeId: DEFAULT_THEME_ID,
      mode: "light",
      primaryLocale: "auto",
      defaultLocale: "ar",
    }),
  /** Paiement flexible « 1 $ ou plus » (section dédiée du site). */
  flexiblePayment: z
    .object({
      enabled: z.boolean(),
      minUsd: z.coerce.number().min(0).max(1_000_000),
      maxUsd: z.coerce.number().min(0).max(10_000_000),
      suggested: z
        .array(z.coerce.number().min(0).max(10_000_000))
        .max(30),
      noteAr: z.string().max(1000),
      noteEn: z.string().max(1000),
    })
    .refine((value) => value.maxUsd >= value.minUsd, {
      message: "Le montant maximum doit être supérieur ou égal au minimum.",
      path: ["maxUsd"],
    }),
  /**
   * Marché de référence (ville, pays, fuseau, devise locale…) :
   * c'est ce qui permet d'ouvrir le site à d'autres pays sans redéploiement.
   */
  market: marketSchema,
  /** Affichage des prix dans plusieurs devises (la facturation reste en USD). */
  currency: currencyConfigSchema,
  /** Services libres / à la carte vendus au forfait. */
  standaloneServices: z
    .array(
      z.object({
        id: z.string().min(1).max(60),
        icon: z.string().max(40),
        titleAr: z.string().min(1).max(200),
        titleEn: z.string().min(1).max(200),
        descAr: z.string().max(1000),
        descEn: z.string().max(1000),
        priceFromUsd: z.coerce.number().min(0).max(1_000_000),
        badgeAr: z.string().max(100).optional(),
        badgeEn: z.string().max(100).optional(),
        featuresAr: z.array(z.string().max(300)).max(30),
        featuresEn: z.array(z.string().max(300)).max(30),
      }),
    )
    .max(30),
  /** Paramètres FazerCards modifiables dans /admin → Réglages. */
  fazercards: z
    .object({
      maxOrderUsd: z.coerce
        .number()
        .min(1.5, "La valeur maximale doit être d'au moins 1,50 $.")
        .max(10_000, "La valeur maximale ne peut pas dépasser 10 000 $."),
    })
    .default({ maxOrderUsd: 25 }),
});

/* ---------- Statut d'une demande ---------- */

export const leadStatusSchema = z.enum(LEAD_STATUSES);

/* ---------- Catalogue digital (codes logiciels & cartes cadeaux) ---------- */

export const digitalDenominationSchema = z.object({
  id: z.string().min(1).max(100),
  label: z.string().min(1).max(120),
  faceValue: z.string().max(120).default(""),
  region: z.string().min(1).max(20),
  priceUsd: z.coerce.number().min(0).max(1_000_000),
  noteAr: z.string().max(300).optional(),
  noteEn: z.string().max(300).optional(),
  available: z.boolean(),
  /** Valeur faciale Reloadly (unitPrice) ; vide = déduite de faceValue. */
  reloadlyUnitPrice: z.coerce.number().min(0).max(100_000).nullable().optional(),
  /** Devise de la face (« USD », « TRY »…) ; vide = USD. */
  faceCurrency: z
    .string()
    .max(3)
    .transform((value) => value.trim().toUpperCase())
    .nullable()
    .optional(),
  /** Coût réel en USD lu chez Reloadly (jamais saisi à la main). */
  supplierCostUsd: z.coerce.number().min(0).max(100_000).nullable().optional(),
});

export const digitalProductSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Identifiant invalide (minuscules, chiffres, tirets)"),
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug invalide (minuscules, chiffres, tirets)"),
  kind: z.enum(DIGITAL_KINDS),
  status: z.enum(DIGITAL_STATUSES),
  platform: z.string().max(120),
  color: z.string().regex(/^#[0-9a-fA-F]{3,8}$/, "Couleur hexadécimale attendue (#RRGGBB)"),
  titleAr: z.string().min(1).max(240),
  titleEn: z.string().min(1).max(240),
  descriptionAr: z.string().max(1200),
  descriptionEn: z.string().max(1200),
  image: z.string().max(1000),
  regions: z.array(z.string().max(20)).max(20),
  featuresAr: z.array(z.string().max(300)).max(20),
  featuresEn: z.array(z.string().max(300)).max(20),
  deliveryNoteAr: z.string().max(500),
  deliveryNoteEn: z.string().max(500),
  denominations: z.array(digitalDenominationSchema).max(60),
  sortOrder: z.coerce.number().int().min(0).max(9999),
  /** Livraison : `manual` (agence) ou `auto` (achat Reloadly). */
  fulfillment: z.enum(["manual", "auto"]).optional(),
  /** Produit Reloadly relié à la fiche (achat automatique). */
  reloadlyProductId: z.coerce.number().int().min(0).max(9_999_999).nullable().optional(),
  reloadlyCountryCode: z.string().max(2).optional(),
  /** Marge nette visée, en % du prix payé (null = prix manuels). */
  marginPercent: z.coerce.number().min(0).max(50).nullable().optional(),
  /** Frais / remise publiés par Reloadly (null = inconnus). */
  supplierFeePercent: z.coerce.number().min(0).max(100).nullable().optional(),
  supplierDiscountPercent: z.coerce.number().min(0).max(100).nullable().optional(),
});

/* ---------- Éditeur complet de la boutique (/admin/digital/products) ---------- */

export const digitalProductFaqSchema = z.object({
  qAr: z.string().max(400).default(""),
  aAr: z.string().max(2000).default(""),
  qEn: z.string().max(400).default(""),
  aEn: z.string().max(2000).default(""),
});

export const digitalProductSeoSchema = z.object({
  seoTitleAr: z.string().max(180).optional(),
  seoTitleEn: z.string().max(180).optional(),
  seoDescriptionAr: z.string().max(350).optional(),
  seoDescriptionEn: z.string().max(350).optional(),
  h1Ar: z.string().max(240).optional(),
  h1En: z.string().max(240).optional(),
  imageAltAr: z.string().max(200).optional(),
  imageAltEn: z.string().max(200).optional(),
  keywordsAr: z.array(z.string().max(120)).max(30).optional(),
  keywordsEn: z.array(z.string().max(120)).max(30).optional(),
  geoSummaryAr: z.string().max(1500).optional(),
  geoSummaryEn: z.string().max(1500).optional(),
  redeemStepsAr: z.array(z.string().max(500)).max(12).optional(),
  redeemStepsEn: z.array(z.string().max(500)).max(12).optional(),
  faqs: z.array(digitalProductFaqSchema).max(20).optional(),
});

export const boutiqueBuyerFieldSchema = z.object({
  key: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(140),
  type: z.string().trim().min(1).max(40).default("text"),
});

export const boutiqueDenominationSchema = z.object({
  id: z.string().trim().min(1).max(160),
  label: z.string().trim().min(1).max(160),
  faceValue: z.string().max(160).default(""),
  region: z.string().trim().min(1).max(32).default("GLOBAL"),
  priceUsd: z.coerce.number().min(0).max(1_000_000),
  noteAr: z.string().max(400).optional(),
  noteEn: z.string().max(400).optional(),
  available: z.boolean().default(true),
  reloadlyUnitPrice: z.coerce.number().min(0).max(100_000).nullable().optional(),
  faceCurrency: z
    .string()
    .max(16)
    .transform((value) => {
      const cleaned = value.trim().toUpperCase();
      return cleaned || null;
    })
    .nullable()
    .optional(),
  supplierCostUsd: z.coerce.number().min(0).max(100_000).nullable().optional(),
  supplierOfferId: z.string().trim().max(160).optional(),
  maxQuantity: z.coerce.number().int().min(1).max(100).nullable().optional(),
  fields: z.array(boutiqueBuyerFieldSchema).max(15).optional(),
});

export const boutiqueProductSchema = z.object({
  id: z.string().trim().min(1).max(160),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(140)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug invalide (minuscules, chiffres, tirets)"),
  kind: z.enum(DIGITAL_KINDS),
  status: z.enum(DIGITAL_STATUSES),
  platform: z.string().trim().max(140).default(""),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{3,8}$/, "Couleur hexadécimale attendue (#RRGGBB)")
    .default("#172554"),
  titleAr: z.string().trim().min(1).max(260),
  titleEn: z.string().trim().min(1).max(260),
  descriptionAr: z.string().max(4000).default(""),
  descriptionEn: z.string().max(4000).default(""),
  image: z.string().trim().max(1000).default(""),
  regions: z.array(z.string().trim().min(1).max(32)).max(40).default(["GLOBAL"]),
  featuresAr: z.array(z.string().max(400)).max(30).default([]),
  featuresEn: z.array(z.string().max(400)).max(30).default([]),
  deliveryNoteAr: z.string().max(1000).default(""),
  deliveryNoteEn: z.string().max(1000).default(""),
  denominations: z.array(boutiqueDenominationSchema).max(300).default([]),
  sortOrder: z.coerce.number().int().min(-1000).max(100_000).default(0),
  fulfillment: z.enum(["manual", "auto"]).optional(),
  supplier: z.enum(["fazercards", "reloadly"]).optional(),
  supplierCategoryId: z.string().trim().max(160).optional(),
  marginPercent: z.coerce.number().min(0).max(500).nullable().optional(),
  seo: digitalProductSeoSchema.optional(),
});


/* ---------- Livraison d'un projet web (dossier remis au client) ---------- */
//
// Le contrôle fin des URL (http/https uniquement) est fait côté serveur par
// `sanitizeDeliveryLinks` : une validation zod seule laisserait passer
// `javascript:…` qui serait cliqué depuis la page de livraison.

export const deliveryInputSchema = z.object({
  clientName: z.string().trim().min(2, "Nom du client trop court").max(120),
  projectTitle: z.string().trim().min(2, "Intitulé du projet trop court").max(160),
  email: z
    .string()
    .trim()
    .email("E-mail invalide")
    .max(200)
    .optional()
    .or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  amountUsd: z.string().trim().max(20).optional().or(z.literal("")),
  links: z
    .array(z.object({ label: z.string().trim().max(120), url: z.string().trim().max(600) }))
    .max(12)
    .optional(),
  checklist: z
    .array(z.object({ label: z.string().trim().max(120) }))
    .max(30)
    .optional(),
  warrantyDays: z.number().int().min(1).max(365).optional(),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type DeliveryInput = z.infer<typeof deliveryInputSchema>;
