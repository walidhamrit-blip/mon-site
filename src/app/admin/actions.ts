"use server";

import { LEGACY_SUPPLIER_RETIRED, RETIRED_SUPPLIER_MESSAGE } from "@/lib/retired-supplier";

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
  digitalProductSchema,
  leadStatusSchema,
  siteConfigSchema,
  type ContentSection,
} from "@/lib/validation";
import {
  deleteDigitalProduct,
  upsertDigitalProduct,
} from "@/lib/digital-store";
import {
  deliverDigitalOrderManually,
  deliverPaidDigitalOrder,
  resendDigitalCodesEmail,
} from "@/lib/digital-orders";
import { denominationUnitPrice, type DigitalProduct } from "@/lib/digital-types";
import { computeSalePrice } from "@/lib/digital-order-core";
import { getGiftCardProduct, reloadlyConfigured } from "@/lib/reloadly";
import { mailDiagnostics, sendTestEmail } from "@/lib/mailer";
import { applyDigitalSync, type SyncApplyResult, type SyncRequest } from "@/lib/digital-sync";
import { applyCatalogRecalc } from "@/lib/digital-audit";

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
  layout: SETTINGS_KEYS.layout,
  appsPage: SETTINGS_KEYS.appsPage,
  productsPage: SETTINGS_KEYS.productsPage,
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
    const items = parsed.data as ({ slug: string } & Parameters<typeof ensureDemoSeoFields>[0])[];
    const slugs = new Set<string>();
    for (const item of items) {
      if (slugs.has(item.slug)) {
        return { ok: false, error: `Slug dupliqué : « ${item.slug} » doit être unique.` };
      }
      slugs.add(item.slug);
    }
    dataToStore = items.map((item) => ensureDemoSeoFields(item));
  } else if (section === "layout") {
    const layoutData = parsed.data as z.infer<typeof contentSchemas.layout>;
    const secIds = new Set<string>();
    for (const sec of layoutData.customSections) {
      if (secIds.has(sec.id)) {
        return { ok: false, error: `Identifiant de section dupliqué : « ${sec.id} ».` };
      }
      secIds.add(sec.id);
    }
    dataToStore = {
      ...layoutData,
      customSections: layoutData.customSections.map((sec) => ({
        ...sec,
        sites: sec.sites.map((site) => ensureDemoSeoFields(site)),
      })),
    };
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

export async function saveSectionsWorkspace(input: {
  layout: unknown;
  demos: unknown;
}): Promise<ActionResult> {
  await requireAdmin();
  const parsedLayout = contentSchemas.layout.safeParse(input.layout);
  if (!parsedLayout.success) {
    return { ok: false, error: `Sections invalides — ${firstIssue(parsedLayout.error)}` };
  }
  const parsedDemos = contentSchemas.demos.safeParse(input.demos);
  if (!parsedDemos.success) {
    return { ok: false, error: `Sites invalides — ${firstIssue(parsedDemos.error)}` };
  }

  const demoSlugs = new Set<string>();
  for (const item of parsedDemos.data) {
    if (demoSlugs.has(item.slug)) {
      return { ok: false, error: `Slug dupliqué dans la galerie : « ${item.slug} ».` };
    }
    demoSlugs.add(item.slug);
  }

  const secIds = new Set<string>();
  for (const sec of parsedLayout.data.customSections) {
    if (secIds.has(sec.id)) {
      return { ok: false, error: `Identifiant de section dupliqué : « ${sec.id} ».` };
    }
    secIds.add(sec.id);
    const localSlugs = new Set<string>();
    for (const site of sec.sites) {
      if (localSlugs.has(site.slug)) {
        return {
          ok: false,
          error: `Slug dupliqué « ${site.slug} » dans la section « ${sec.titleEn || sec.titleAr} ».`,
        };
      }
      localSlugs.add(site.slug);
    }
  }

  const normalizedDemos = parsedDemos.data.map((d) => ensureDemoSeoFields(d));
  const normalizedLayout = {
    ...parsedLayout.data,
    customSections: parsedLayout.data.customSections.map((sec) => ({
      ...sec,
      sites: sec.sites.map((site) => ensureDemoSeoFields(site)),
    })),
  };

  try {
    await upsertSetting(SETTINGS_KEYS.demos, normalizedDemos);
    await upsertSetting(SETTINGS_KEYS.layout, normalizedLayout);
    revalidatePath("/", "layout");
    void pingAllPublicPages();
    return {
      ok: true,
      message: "Architecture des sections et sites enregistrée — le site public est à jour.",
    };
  } catch (error) {
    return { ok: false, error: dbIssue(error) };
  }
}

export async function resetSectionsWorkspace(): Promise<ActionResult> {
  await requireAdmin();
  try {
    await deleteSetting(SETTINGS_KEYS.layout);
    await deleteSetting(SETTINGS_KEYS.demos);
    revalidatePath("/", "layout");
    void pingAllPublicPages();
    return {
      ok: true,
      message: "Sections et galerie de sites réinitialisées aux valeurs par défaut.",
    };
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

/**
 * Applique la révision du catalogue Reloadly (fiches validées dans l'aperçu).
 *
 * L'analyse — donc les prix — est recalculée côté serveur : le navigateur
 * n'envoie que les clés des fiches retenues et les paramètres de l'analyse.
 */
export async function applyDigitalSyncAction(
  request: SyncRequest,
  keys: string[],
): Promise<ActionResult & { applied?: string[]; created?: number; updated?: number }> {
  await requireAdmin();
  if (LEGACY_SUPPLIER_RETIRED) return { ok: false, error: RETIRED_SUPPLIER_MESSAGE };
  try {
    const result: SyncApplyResult = await applyDigitalSync(request, keys);
    revalidatePath("/codes", "layout");
    revalidatePath("/admin/digital");
    void pingAllPublicPages();

    const parts: string[] = [];
    if (result.updated > 0) parts.push(`${result.updated} fiche(s) mise(s) à jour`);
    if (result.created > 0) parts.push(`${result.created} fiche(s) créée(s)`);
    const summary = parts.length > 0 ? parts.join(" · ") : "Aucune fiche modifiée";

    return {
      ok: result.errors.length === 0,
      message: result.errors.length === 0 ? `${summary}.` : `${summary}.`,
      error: result.errors.length > 0 ? result.errors.slice(0, 4).join(" | ") : undefined,
      applied: result.applied,
      created: result.created,
      updated: result.updated,
    };
  } catch (error) {
    return { ok: false, error: dbIssue(error) };
  }
}

/**
 * Réapplique marge + arrondi (pas de 0,50) aux fiches sélectionnées.
 *
 * Le recalcul est refait côté serveur : le navigateur n'envoie que des
 * identifiants de fiche et le taux de frais de paiement.
 */
export async function applyCatalogRecalcAction(
  paymentFeePercent: number,
  ficheIds: string[],
): Promise<ActionResult & { fiches?: number; prices?: number }> {
  await requireAdmin();
  if (LEGACY_SUPPLIER_RETIRED) return { ok: false, error: RETIRED_SUPPLIER_MESSAGE };
  try {
    const fee = Number(paymentFeePercent);
    const safeFee = Number.isFinite(fee) && fee >= 0 && fee < 20 ? fee : 1;
    const result = await applyCatalogRecalc(safeFee, ficheIds);
    revalidatePath("/codes", "layout");
    revalidatePath("/admin/digital");
    void pingAllPublicPages();

    const summary = `${result.fiches} fiche(s) · ${result.prices} prix ajusté(s)`;
    return {
      ok: result.errors.length === 0,
      message: result.errors.length === 0 ? `${summary}.` : `${summary}.`,
      error: result.errors.length > 0 ? result.errors.slice(0, 4).join(" | ") : undefined,
      fiches: result.fiches,
      prices: result.prices,
    };
  } catch (error) {
    return { ok: false, error: dbIssue(error) };
  }
}

/**
 * Liste les montants vendus sous leur coût réel (valeur Reloadly + frais).
 * Renvoie [] si le fournisseur est injoignable : la vérification ne doit
 * jamais empêcher un enregistrement légitime.
 */
async function findLosses(product: DigitalProduct, reloadlyProductId: number): Promise<string[]> {
  let supplier: { senderFeePercentage: number; discountPercentage: number };
  try {
    const info = await getGiftCardProduct(reloadlyProductId);
    supplier = {
      senderFeePercentage: Number(info.senderFeePercentage ?? 0),
      discountPercentage: Number(info.discountPercentage ?? 0),
    };
  } catch (error) {
    console.warn(
      "[admin][digital] coût non vérifiable :",
      error instanceof Error ? error.message : error,
    );
    return [];
  }

  const fee = Number(process.env.PAYMENT_FEE_PERCENT);
  const paymentFeePercent = Number.isFinite(fee) && fee >= 0 && fee < 20 ? fee : 1;

  return product.denominations
    .filter((denomination) => denomination.available)
    .filter((denomination) => {
      const breakdown = computeSalePrice({
        faceValue: denominationUnitPrice(denomination),
        senderFeePercent: supplier.senderFeePercentage,
        discountPercent: supplier.discountPercentage,
        // Marge 0 : on vérifie le prix face au coût, pas à la marge visée.
        marginPercent: 0,
        paymentFeePercent: 0,
      });
      if (!breakdown.ok) return false;
      return denomination.priceUsd > 0 && denomination.priceUsd < breakdown.cost;
    })
    .map((denomination) => `${denomination.label} (${denomination.priceUsd.toFixed(2)} $)`);
}

/* ---------------------------- Diagnostic e-mail --------------------------- */

export interface MailTestResult extends ActionResult {
  provider?: string;
  from?: string;
  id?: string;
}

/**
 * Envoie un e-mail de test depuis l'admin et rapporte le verdict RÉEL du
 * fournisseur (identifiant du message ou refus exact).
 *
 * C'est le seul moyen de distinguer « accepté par le fournisseur » de
 * « réellement remis » : un domaine non vérifié ou sans SPF/DKIM renvoie
 * souvent un identifiant puis échoue en silence.
 */
export async function sendTestEmailAction(to: string): Promise<MailTestResult> {
  await requireAdmin();
  const address = String(to ?? "").trim();
  const diagnostics = mailDiagnostics();

  if (!diagnostics.configured) {
    return {
      ok: false,
      provider: diagnostics.provider,
      from: diagnostics.from,
      error:
        "Aucun fournisseur d'e-mail configuré : ajoutez RESEND_API_KEY (ou SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS) en Production sur Vercel, puis redéployez.",
    };
  }
  if (!address) {
    return { ok: false, provider: diagnostics.provider, error: "Adresse de destination manquante." };
  }

  try {
    const result = await sendTestEmail(address);
    return result.ok
      ? {
          ok: true,
          provider: result.provider,
          from: diagnostics.from,
          id: result.id,
          message: `Accepté par ${result.provider}${result.id ? ` (message ${result.id})` : ""} — vérifiez la boîte et le dossier spam de ${address}.`,
        }
      : {
          ok: false,
          provider: result.provider,
          from: diagnostics.from,
          error: result.error ?? "Envoi refusé par le fournisseur.",
        };
  } catch (error) {
    return { ok: false, provider: diagnostics.provider, error: dbIssue(error) };
  }
}

/* ---------------- Catalogue digital (codes logiciels & cartes cadeaux) ---------------- */

/**
 * Crée ou met à jour une fiche du catalogue digital.
 *
 * Les dénominations (montants, régions, prix) sont réécrites avec la fiche :
 * l'admin gère une liste simple, l'historique des lignes n'a pas de valeur
 * ici — il n'y a pas encore de stock ni de commande rattachée.
 */
export async function saveDigitalProduct(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  if (LEGACY_SUPPLIER_RETIRED) return { ok: false, error: RETIRED_SUPPLIER_MESSAGE };
  const parsed = digitalProductSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: `Fiche invalide — ${firstIssue(parsed.error)}` };
  }
  try {
    const product = parsed.data as DigitalProduct;

    // Garde-fou financier : un montant vendu sous son coût réel fait perdre
    // de l'argent à chaque vente. On refuse l'enregistrement quand les frais
    // Reloadly sont lisibles ; si le fournisseur est injoignable, on laisse
    // passer (mieux vaut enregistrer que bloquer sur une vérification
    // facultative) — l'admin affiche alors l'alerte dans l'éditeur.
    if (product.fulfillment === "auto" && reloadlyConfigured()) {
      const reloadlyProductId = Number(product.reloadlyProductId);
      if (Number.isInteger(reloadlyProductId) && reloadlyProductId > 0) {
        const losses = await findLosses(product, reloadlyProductId);
        if (losses.length > 0) {
          return {
            ok: false,
            error: `Vente à perte refusée : ${losses.join(", ")}. Augmentez le prix ou retirez la marge.`,
          };
        }
      }
    }

    await upsertDigitalProduct(product);
    // La fiche produit est pré-générée (`generateStaticParams`) : sans
    // revalidation de son chemin, elle reste servie depuis le cache du build
    // — statut « bientôt disponible » et aucun bouton d'achat, même après
    // enregistrement. `type: "layout"` couvre /codes ET toutes les fiches
    // /codes/<slug> ; la seconde ligne vise explicitement la fiche modifiée.
    revalidatePath("/codes", "layout");
    revalidatePath(`/codes/${parsed.data.slug}`);
    revalidatePath("/admin/digital");
    void pingAllPublicPages();
    return {
      ok: true,
      message: `Fiche « ${parsed.data.titleAr} » enregistrée — le catalogue public est à jour.`,
    };
  } catch (error) {
    return { ok: false, error: dbIssue(error) };
  }
}

/** Supprime une fiche du catalogue digital (et ses dénominations). */
export async function deleteDigitalProductAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  const productId = String(id ?? "").trim();
  if (!productId) return { ok: false, error: "Fiche non identifiée." };
  try {
    await deleteDigitalProduct(productId);
    // Même raison que pour l'enregistrement : supprimer une fiche doit aussi
    // invalider son URL publique /codes/<slug> déjà pré-générée.
    revalidatePath("/codes", "layout");
    revalidatePath("/admin/digital");
    void pingAllPublicPages();
    return { ok: true, message: "Fiche supprimée du catalogue." };
  } catch (error) {
    return { ok: false, error: dbIssue(error) };
  }
}

/* ---------------- Commandes digitales (livraison Reloadly) ---------------- */

/**
 * Relance la livraison d'une commande de code.
 *
 * Sans achat préalable : achète le code chez Reloadly (si la fiche est en
 * livraison automatique) puis envoie l'e-mail au client.
 * Avec un achat déjà enregistré mais sans codes : récupère seulement les
 * codes — jamais de second débit.
 */
export async function retryDigitalDeliveryAction(ref: string): Promise<ActionResult> {
  await requireAdmin();
  const orderRef = String(ref ?? "").trim().toUpperCase();
  if (!orderRef) return { ok: false, error: "Référence manquante." };

  try {
    const result = await deliverPaidDigitalOrder(orderRef, { force: true });
    revalidatePath("/admin/digital/orders");
    switch (result.outcome) {
      case "delivered":
        return { ok: true, message: `Commande ${orderRef} livrée — e-mail envoyé au client.` };
      case "already_delivered":
        return { ok: true, message: `Commande ${orderRef} déjà livrée.` };
      case "awaiting_codes":
        return {
          ok: false,
          error: result.message ?? "Le fournisseur n'a pas encore émis le code — réessayez dans quelques minutes.",
        };
      case "manual":
        return { ok: false, error: result.message ?? "Livraison manuelle requise (voir le motif)." };
      case "failed":
        return { ok: false, error: result.message ?? "Achat refusé par le fournisseur." };
      case "not_paid":
        return { ok: false, error: "Le paiement n'est pas encore confirmé." };
      default:
        return { ok: false, error: "Commande introuvable." };
    }
  } catch (error) {
    return { ok: false, error: dbIssue(error) };
  }
}

/** Renvoie l'e-mail contenant les codes d'une commande livrée. */
export async function resendDigitalEmailAction(ref: string): Promise<ActionResult> {
  await requireAdmin();
  const orderRef = String(ref ?? "").trim().toUpperCase();
  if (!orderRef) return { ok: false, error: "Référence manquante." };
  try {
    const result = await resendDigitalCodesEmail(orderRef);
    if (!result.ok) {
      return { ok: false, error: result.error ?? "Envoi impossible." };
    }
    return { ok: true, message: `Codes renvoyés au client (${orderRef}).` };
  } catch (error) {
    return { ok: false, error: dbIssue(error) };
  }
}

/**
 * Enregistre des codes achetés à la main et les transmet au client.
 * L'e-mail part automatiquement (comme pour une livraison Reloadly).
 */
/**
 * Clôture une recharge de jeu livrée SANS code.
 *
 * Une recharge crédite le compte du joueur : il n'y a aucun code à saisir.
 * Sans cette action, l'admin devait inventer un faux code pour sortir la
 * commande de l'état « livraison manuelle ».
 */
export async function closeDigitalOrderWithoutCodeAction(
  ref: string,
): Promise<ActionResult> {
  await requireAdmin();
  const orderRef = String(ref ?? "").trim().toUpperCase();
  if (!orderRef) return { ok: false, error: "Référence manquante." };
  try {
    const result = await deliverDigitalOrderManually(orderRef, "", {
      withoutCodes: true,
    });
    revalidatePath("/admin/digital/orders");
    if (!result.ok) return { ok: false, error: result.error ?? "Clôture impossible." };
    return {
      ok: true,
      message: result.error
        ? `Recharge clôturée. ${result.error}`
        : "Recharge clôturée et client prévenu par e-mail.",
    };
  } catch (error) {
    return { ok: false, error: dbIssue(error) };
  }
}

export async function manualDigitalDeliveryAction(
  ref: string,
  codes: string,
): Promise<ActionResult> {
  await requireAdmin();
  const orderRef = String(ref ?? "").trim().toUpperCase();
  if (!orderRef) return { ok: false, error: "Référence manquante." };
  try {
    const result = await deliverDigitalOrderManually(orderRef, String(codes ?? ""));
    revalidatePath("/admin/digital/orders");
    if (!result.ok) return { ok: false, error: result.error ?? "Enregistrement impossible." };
    return {
      ok: true,
      message: result.error
        ? `${result.delivered} code(s) enregistré(s). ${result.error}`
        : `${result.delivered} code(s) enregistré(s) et envoyé(s) au client.`,
    };
  } catch (error) {
    return { ok: false, error: dbIssue(error) };
  }
}
