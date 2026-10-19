"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import type { z } from "zod";
import { db, ensureSchema } from "@/db";
import { leads } from "@/db/schema";
import { ADMIN_COOKIE, checkPassword, createSessionToken, requireAdmin } from "@/lib/auth";
import { deleteSetting, upsertSetting, SETTINGS_KEYS } from "@/lib/store";
import { ensureDemoSeoFields } from "@/lib/ai/seo-generator";
import { pingAllPublicPages } from "@/lib/indexnow";
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

const loginAttempts = new Map<string, number[]>();

function allowAttempt(key: string): boolean {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const max = 10;
  const list = (loginAttempts.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= max) {
    loginAttempts.set(key, list);
    return false;
  }
  list.push(now);
  loginAttempts.set(key, list);
  return true;
}

export async function login(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "inconnu";
  if (!allowAttempt(`login:${ip}`)) {
    return {
      ok: false,
      error: "Trop de tentatives. Réessayez dans 15 minutes.",
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
  store.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
  redirect("/admin");
}

export async function logout(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
  redirect("/admin/login");
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
