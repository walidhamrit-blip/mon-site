import { z } from "zod";
import { LEAD_STATUSES } from "@/lib/site-types";

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

export const contentSchemas = {
  demos: z.array(demoSchema).max(50),
  faqs: z.array(faqSchema).max(50),
  testimonials: z.array(testimonialSchema).max(50),
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
});

/* ---------- Statut d'une demande ---------- */

export const leadStatusSchema = z.enum(LEAD_STATUSES);
