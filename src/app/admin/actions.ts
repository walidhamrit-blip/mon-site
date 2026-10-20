"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import type { z } from "zod";
import { db, ensureSchema } from "@/db";
import { leads } from "@/db/schema";
import { ADMIN_COOKIE, checkPassword, createSessionToken, requireAdmin } from "@/lib/auth";
import { deleteSetting, getSiteData, getSiteDataCached, upsertSetting, SETTINGS_KEYS } from "@/lib/store";
import { ensureDemoSeoFields } from "@/lib/ai/seo-generator";
import { pingAllPublicPages } from "@/lib/indexnow";
import { sectorSeo } from "@/lib/sectors";
import { siteConfig } from "@/lib/config";
import { checkRateLimitHeaders } from "@/lib/rate-limit";
import {
  contentSchemas,
  leadStatusSchema,
  siteConfigSchema,
  type ContentSection,
} from "@/lib/validation";

export interface ActionResult {
  ok: boolean;
  error?: string;
  message?: string;
}

function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Données invalides";
  const path = issue.path.join(".") || "racine";
  return `${path} : ${issue.message}`;
}

function dbIssue(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  console.error("[admin]", msg);
  if (/DATABASE_URL|ECONNREFUSED|ENOTFOUND|connect|password|SASL/i.test(msg)) {
    return "Base de données inaccessible — vérifiez DATABASE_URL sur Vercel.";
  }
  return `Échec de l'enregistrement : ${msg.slice(0, 200)}`;
}

/* ---------------- Connexion / déconnexion ---------------- */

const LOGIN_LIMIT = { windowMs: 15 * 60 * 1000, max: 10, prefix: "login" } as const;

export async function login(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  // Limite par IP + empreinte UA. Un même attaquant derrière un NAT partagé
  // n'est pas confondu avec d'autres utilisateurs : la clé composite
  // (voir src/lib/rate-limit.ts) garde la limite par empreinte UA aussi.
  const h = await headers();
  const decision = checkRateLimitHeaders(LOGIN_LIMIT, h);
  if (!decision.allow) {
    return {
      ok: false,
      error: `Trop de tentatives. Réessayez dans ${Math.max(1, decision.retryAfterSec)} secondes.`,
    };
  }

  const result = checkPassword(String(formData.get("password") ?? ""));
  if (result === "unconfigured") {
    return {
      ok: false,
      error: "ADMIN_PASSWORD n'est pas configuré sur Vercel (Settings → Environment Variables).",
    };
  }
  if (result !== "ok") {
    return { ok: false, error: "Mot de passe incorrect." };
  }

  const token = await createSessionToken();
  const store = await cookies();
  const forwardedProto = h.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  const useSecureCookie =
    forwardedProto === "https" ||
    Boolean(process.env.VERCEL) ||
    (process.env.NODE_ENV === "production" && forwardedProto !== "http");
  // Préfixe `__Host-` sur HTTPS (Vercel / reverse-proxy TLS) : impose
  // `Path=/` et `Secure`. Sur HTTP local (`next start` hors TLS), on utilise
  // le cookie sans préfixe `__Host-` pour éviter un rejet navigateur.
  const cookieName = useSecureCookie ? `__Host-${ADMIN_COOKIE}` : ADMIN_COOKIE;
  store.set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: useSecureCookie,
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
  redirect("/admin");
}

export async function logout(): Promise<void> {
  const store = await cookies();
  for (const name of cookieCandidatesForDelete()) store.delete(name);
  redirect("/admin/login");
}

function cookieCandidatesForDelete(): string[] {
  return [`__Host-${ADMIN_COOKIE}`, ADMIN_COOKIE];
}

/* ---------------- Demandes (leads) ---------------- */

export async function updateLeadStatus(
  id: number,
  status: string,
): Promise<ActionResult> {
  await requireAdmin();
  const parsed = leadStatusSchema.safeParse(status);
  if (!parsed.success) return { ok: false, error: "Statut invalide." };
  try {
    await ensureSchema();
    await db.update(leads).set({ status: parsed.data }).where(eq(leads.id, id));
    revalidatePath("/admin/leads");
    revalidatePath("/admin");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: dbIssue(error) };
  }
}

export async function saveLeadNotes(
  id: number,
  notes: string,
): Promise<ActionResult> {
  await requireAdmin();
  try {
    await ensureSchema();
    await db
      .update(leads)
      .set({ notes: notes.trim() ? notes.trim().slice(0, 4000) : null })
      .where(eq(leads.id, id));
    revalidatePath("/admin/leads");
    return { ok: true, message: "Notes enregistrées." };
  } catch (error) {
    return { ok: false, error: dbIssue(error) };
  }
}

export async function deleteLead(id: number): Promise<ActionResult> {
  await requireAdmin();
  try {
    await ensureSchema();
    await db.delete(leads).where(eq(leads.id, id));
    revalidatePath("/admin/leads");
    revalidatePath("/admin");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: dbIssue(error) };
  }
}

/* ---------------- Configuration du site ---------------- */

export async function saveSiteConfig(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = siteConfigSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: `Configuration invalide — ${firstIssue(parsed.error)}` };
  }
  try {
    await upsertSetting(SETTINGS_KEYS.config, parsed.data);
    revalidatePath("/", "layout");
    // Notification IndexNow en arrière-plan (ne bloque pas la réponse admin).
    void pingAllPublicPages();
    return { ok: true, message: "Configuration enregistrée — le site public est à jour." };
  } catch (error) {
    return { ok: false, error: dbIssue(error) };
  }
}

export async function resetSiteConfig(): Promise<ActionResult> {
  await requireAdmin();
  try {
    await deleteSetting(SETTINGS_KEYS.config);
    revalidatePath("/", "layout");
    void pingAllPublicPages();
    return { ok: true, message: "Configuration réinitialisée aux valeurs par défaut." };
  } catch (error) {
    return { ok: false, error: dbIssue(error) };
  }
}

/* ---------------- Contenu éditable ---------------- */

const CONTENT_KEYS: Record<ContentSection, string> = {
  demos: SETTINGS_KEYS.demos,
  faqs: SETTINGS_KEYS.faqs,
  testimonials: SETTINGS_KEYS.testimonials,
  hero: SETTINGS_KEYS.hero,
  ribbon: SETTINGS_KEYS.ribbon,
  whyUs: SETTINGS_KEYS.whyUs,
  process: SETTINGS_KEYS.process,
  headings: SETTINGS_KEYS.headings,
};

export async function saveContentSection(
  section: ContentSection,
  input: unknown,
): Promise<ActionResult> {
  await requireAdmin();
  const schema = contentSchemas[section];
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: `Contenu invalide — ${firstIssue(parsed.error)}` };
  }

  let dataToStore: unknown = parsed.data;
  if (section === "demos") {
    const items = parsed.data as ( { slug: string } & Parameters<typeof ensureDemoSeoFields>[0] )[];
    const slugs = new Set<string>();
    for (const item of items) {
      if (slugs.has(item.slug)) {
        return { ok: false, error: `Slug dupliqué : « ${item.slug} » doit être unique.` };
      }
      slugs.add(item.slug);
    }
    // Automatisation SEO : complète automatiquement tout champ SEO vide
    // avec le gabarit optimisé bilingue avant l'enregistrement en base.
    dataToStore = items.map((item) => ensureDemoSeoFields(item));
  }

  try {
    await upsertSetting(CONTENT_KEYS[section], dataToStore);
    revalidatePath("/", "layout");
    void pingAllPublicPages();
    return { ok: true, message: "Contenu enregistré — le site public est à jour." };
  } catch (error) {
    return { ok: false, error: dbIssue(error) };
  }
}

export async function resetContentSection(
  section: ContentSection,
): Promise<ActionResult> {
  await requireAdmin();
  try {
    await deleteSetting(CONTENT_KEYS[section]);
    revalidatePath("/", "layout");
    void pingAllPublicPages();
    return { ok: true, message: "Contenu réinitialisé aux valeurs par défaut." };
  } catch (error) {
    return { ok: false, error: dbIssue(error) };
  }
}

/* ---------------- Génération auto fiche démo depuis un lead (Projet livré → Avis) ---------------- */

function slugify(input: string): string {
  const lower = input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
  return lower.slice(0, 60).replace(/-+$/, "");
}

const NEED_TO_PLAN: Record<string, string> = {
  vitrine: "vitrine",
  "vitrine-plus": "vitrine-plus",
  shop: "boutique",
  redesign: "vitrine-plus",
};

const LEAD_SECTOR_TO_DEMO_SECTOR: Record<string, string> = {
  restaurant: "restaurant",
  clinic: "medical",
  medical: "medical",
  boutique: "beauty",
  beauty: "beauty",
  realestate: "hardware",
  education: "stationery",
  hotel: "appliances",
  electronics: "electronics",
  hardware: "hardware",
  furniture: "furniture",
  toys: "toys",
  appliances: "appliances",
  stationery: "stationery",
  sanitary: "sanitary",
  other: "other",
};

// Images placeholder par secteur (Unsplash optimisé)
const SECTOR_IMAGES: Record<string, string> = {
  medical: "https://demo-cabinet-medecin.vercel.app/images/doctor.jpg",
  restaurant: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=80",
  beauty: "https://hala-dun.vercel.app/images/hero-perfume.jpg",
  furniture: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1200&q=85",
  toys: "https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?q=80&w=1200&auto=format&fit=crop",
  appliances: "https://images.pexels.com/photos/6585763/pexels-photo-6585763.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=1200&h=800",
  electronics: "https://smartphine-demo.vercel.app/images/hero-phone.jpg",
  hardware: "https://m-et-outillage-modele-3.vercel.app/images/hero1.jpg",
  stationery: "https://al-manhaj-company.vercel.app/images/new/landscape-01.jpg",
  sanitary: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=80",
  other: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80&auto=format&fit=crop",
};

export interface GenerateDemoResult extends ActionResult {
  demoSlug?: string;
  whatsappUrl?: string;
  whatsappMessage?: string;
  demoUrl?: string;
}

export async function generateDemoFromLead(leadId: number): Promise<GenerateDemoResult> {
  await requireAdmin();
  try {
    await ensureSchema();
    const rows = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
    const lead = rows[0];
    if (!lead) return { ok: false, error: "Demande introuvable." };

    // Récupère config + contenu actuels
    const { config, content } = await getSiteData();
    const existingDemos = content.demos ?? [];

    // Détermine secteur
    const rawSector = (lead.sector || "").trim().toLowerCase();
    const demoSectorId = LEAD_SECTOR_TO_DEMO_SECTOR[rawSector] ?? (sectorSeo[rawSector] ? rawSector : "other");
    const sectorInfo = sectorSeo[demoSectorId];
    const sectorAr = sectorInfo?.labelAr ?? lead.sector;
    const sectorEn = sectorInfo?.labelEn ?? lead.sector;

    // Plan / catégorie via need
    const rawNeed = (lead.need || "").trim().toLowerCase();
    const planId = NEED_TO_PLAN[rawNeed] ?? "vitrine-plus";
    const planIndex = config.pricing.plans.findIndex((p) => p.id === planId);
    const categoryTier = planIndex >= 0 ? planIndex + 1 : 2;

    // Génère slug unique
    let baseSlug = slugify(lead.business || lead.name || `projet-${lead.id}`);
    if (!baseSlug || baseSlug.length < 3) baseSlug = `projet-${lead.id}-${Date.now().toString(36)}`;
    // Si business arabe pur, slug sera vide — on fallback
    if (!/^[a-z0-9]/.test(baseSlug)) baseSlug = `projet-${lead.id}-${Date.now().toString(36).slice(0, 4)}`;
    let slug = baseSlug;
    const existingSlugs = new Set(existingDemos.map((d) => d.slug));
    let counter = 2;
    while (existingSlugs.has(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter += 1;
    }

    // Contenu de la fiche
    const business = lead.business?.trim() || lead.name?.trim() || "Projet livré";
    const title = `${business} — موقع من إنجاز نخبة`;
    const titleEn = `${business} — website by Nukhba`;
    const needLabelAr =
      lead.need === "vitrine"
        ? "موقع واجهة"
        : lead.need === "vitrine-plus"
          ? "واجهة بلس مع حجز"
          : lead.need === "shop"
            ? "متجر إلكتروني متكامل"
            : lead.need;
    const budgetLabel = lead.budget || "—";
    const deadlineLabel = lead.deadline || "—";

    const description =
      `موقع ${business} في طرابلس — ${needLabelAr} أنجزته وكالة نخبة لصالح ${lead.name} (${lead.business}). القطاع: ${lead.sector}، الميزانية: ${budgetLabel}، المدة: ${deadlineLabel}. ${lead.message ? lead.message.slice(0, 200) : ""}`.slice(0, 480);
    const descriptionEn =
      `${business} website in Tripoli — ${lead.need} delivered by Nukhba for ${lead.name} (${lead.business}). Sector: ${lead.sector}, Budget: ${budgetLabel}, Deadline: ${deadlineLabel}. ${lead.message ? lead.message.slice(0, 200) : ""}`.slice(0, 480);

    const image = SECTOR_IMAGES[demoSectorId] ?? SECTOR_IMAGES.other;
    const color = sectorInfo ? (existingDemos.find((d) => d.sector === demoSectorId)?.color ?? "#C6A664") : "#C6A664";

    // Crée l'objet Demo avec SEO auto-complété
    const rawDemo = {
      slug,
      sector: demoSectorId,
      sectorAr,
      sectorEn,
      title,
      titleEn,
      description,
      descriptionEn,
      image,
      color,
      features: ["تصميم حسب الهوية", "متجاوب 100% — موبايل أولاً", "تحسين SEO محلي", "تواصل واتساب مباشر"],
      featuresEn: ["Brand-aligned design", "100% responsive — mobile first", "Local SEO optimized", "Direct WhatsApp contact"],
      previewUrl: "#",
      planId,
      categoryTier,
      priceUsd: null as number | null,
    };

    const demoWithSeo = ensureDemoSeoFields(rawDemo as Parameters<typeof ensureDemoSeoFields>[0]);

    // Sauvegarde — ajoute au début pour visibilité
    const newDemos = [demoWithSeo, ...existingDemos];
    await upsertSetting(SETTINGS_KEYS.demos, newDemos);
    revalidatePath("/", "layout");
    void pingAllPublicPages();

    // Message WhatsApp avis Google
    const baseUrl = config.url.replace(/\/+$/, "") || siteConfig.url;
    const demoUrl = `${baseUrl}/demos/${slug}`;
    // Lien d'avis Google — utilise la localisation Tripoli (GeoCoordinates du site)
    // L'admin pourra remplacer par son lien g.page réel dans les réglages futurs
    const googleReviewUrl = `https://www.google.com/maps/search/?api=1&query=32.8872,13.1913`;
    // Fallback si Google Business Profile configuré avec lien direct — on garde générique pour l'instant

    const whatsappMessage =
      `مرحبا ${lead.name} 👋\n` +
      `شكرًا لثقتك بنخبة — موقع ${business} الآن مباشر 🎉\n` +
      `${demoUrl}\n\n` +
      `هل تمنحنا دقيقة لتقييم تجربتك على خرائط Google؟ رأيك يساعدنا كثيرًا ويثبت جودة عملنا لعملاء جدد في طرابلس 🙏\n` +
      `⭐ اترك رأيك هنا: ${googleReviewUrl}\n\n` +
      `سننشر أيضًا شهادتك (بموافقتك) على موقعنا مع before/after. شكرًا مقدمًا!\n` +
      `— فريق نخبة | Nukhba Premium Web Agency`;

    const phoneDigits = lead.phone.replace(/[^0-9]/g, "");
    const whatsappUrl = `https://wa.me/${phoneDigits}?text=${encodeURIComponent(whatsappMessage)}`;

    return {
      ok: true,
      message: `Fiche « ${business} » créée (/demos/${slug}) — message WhatsApp prêt.`,
      demoSlug: slug,
      demoUrl,
      whatsappUrl,
      whatsappMessage,
    };
  } catch (error) {
    return { ok: false, error: dbIssue(error) };
  }
}
