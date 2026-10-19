import { z } from "zod";
import { LEAD_STATUSES } from "@/lib/site-types";
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
  .min(1)
  .max(12);

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
  .min(1)
  .max(12);

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

export const contentSchemas = {
  demos: z.array(demoSchema).max(50),
  faqs: z.array(faqSchema).max(50),
  testimonials: z.array(testimonialSchema).max(50),
  hero: heroSchema,
  ribbon: ribbonSchema,
  whyUs: whyUsSchema,
  process: processSchema,
  headings: sectionHeadingsSchema,
} as const;

export type ContentSection = keyof typeof contentSchemas;

/* ---------- Configuration du site (coordonnées + tarifs) ---------- */

const planSchema = z.object({
  id: z.string().min(1).max(60),
  name: z.string().min(1).max(200),
  nameEn: z.string().min(1).max(200),
  price: z.coerce.number().int().min(0).max(10_000_000),
  /**
   * Équivalent USD pour le paiement crypto (NOWPayments ne facture
   * pas en LYD). `null` / absent = formule non payable en crypto
   * (le bouton « Pay with crypto » et les paiements en tranches
   * ne s'affichent pas). Sans ce champ, l'enregistrement supprimait
   * silencieusement le prix USD saisi dans l'admin.
   */
  priceUsd: z.coerce
    .number()
    .int()
    .min(0)
    .max(1_000_000)
    .nullable()
    .optional(),
  originalPrice: z.coerce.number().int().min(0).max(10_000_000).nullable(),
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

export const siteConfigSchema = z.object({
  name: z.string().min(1).max(100),
  nameAr: z.string().min(1).max(100),
  tagline: z.string().max(200),
  domain: z.string().max(200),
  url: z.string().min(4).max(500),
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
    sitesDelivered: z.string().max(50),
    satisfaction: z.string().max(50),
    support: z.string().max(50),
  }),
  reservation: z.object({
    enabled: z.boolean(),
    depositUsd: z.coerce.number().min(0).max(10_000),
    depositLyd: z.coerce.number().min(0).max(1_000_000),
  }),
  /**
   * Apparence principale du site : thème principal, mode clair/sombre et
   * langue principale (défauts des visiteurs, choisis dans /admin).
   */
  appearance: z
    .object({
      themeId: z.string().min(1).max(40).default(DEFAULT_THEME_ID),
      mode: z.enum(["light", "dark"]).default("light"),
      defaultLocale: z.enum(["ar", "en"]).default("ar"),
    })
    .default({ themeId: DEFAULT_THEME_ID, mode: "light", defaultLocale: "ar" }),
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
        priceFromLyd: z.coerce.number().min(0).max(10_000_000),
        badgeAr: z.string().max(100).optional(),
        badgeEn: z.string().max(100).optional(),
        featuresAr: z.array(z.string().max(300)).max(30),
        featuresEn: z.array(z.string().max(300)).max(30),
      }),
    )
    .max(30),
});

/* ---------- Statut d'une demande ---------- */

export const leadStatusSchema = z.enum(LEAD_STATUSES);
