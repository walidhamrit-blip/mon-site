"use client";

import { useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ExternalLink,
  Loader2,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { sectors } from "@/lib/content";
import { resolveDemoClassification } from "@/lib/classification";
import { WEBSITE_BASE_PRICE_USD } from "@/lib/website-offer";
import type { Demo, PricingPlanData } from "@/lib/site-types";

export const ADMIN_INPUT_CLS =
  "w-full h-10 rounded-xl bg-[#FAF9F6] border border-stone-300 px-3 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:bg-white focus:border-[#B8923F] focus:ring-2 focus:ring-[#C6A664]/20";

export const ADMIN_TEXTAREA_CLS =
  "w-full rounded-xl bg-[#FAF9F6] border border-stone-300 p-3 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:bg-white focus:border-[#B8923F] focus:ring-2 focus:ring-[#C6A664]/20";

export function makeBlankDemo(
  existingSlugs: string[],
  plans: PricingPlanData[],
): Demo {
  const used = new Set(existingSlugs);
  let idx = existingSlugs.length + 1;
  let slug = `site-${idx}`;
  while (used.has(slug)) {
    idx += 1;
    slug = `site-${idx}`;
  }
  return {
    slug,
    sector: "other",
    sectorAr: "أعمال وخدمات",
    sectorEn: "Business & Services",
    title: "مشروع جديد",
    titleEn: "New Website Project",
    description: "وصف مختصر للموقع وأهم المزايا التي يقدمها للعملاء",
    descriptionEn: "Short description of the website and its key client features",
    image:
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&q=80&auto=format&fit=crop",
    color: "#C6A664",
    features: ["تصميم متجاوب", "ربط واتساب مباشر"],
    featuresEn: ["Responsive design", "Direct WhatsApp"],
    previewUrl: "#",
    planId: plans[0]?.id ?? "vitrine",
    categoryTier: 1,
    priceUsd: null,
  };
}

interface SiteItemEditorProps {
  demo: Demo;
  index: number;
  total: number;
  plans: PricingPlanData[];
  currency: string;
  expanded: boolean;
  onToggleExpand: () => void;
  onChange: (next: Demo) => void;
  onMove: (delta: -1 | 1) => void;
  onDelete: () => void;
  onFlash?: (msg: string, kind: "ok" | "err") => void;
}

export function SiteItemEditor({
  demo,
  index,
  total,
  plans,
  currency,
  expanded,
  onToggleExpand,
  onChange,
  onMove,
  onDelete,
  onFlash,
}: SiteItemEditorProps) {
  const [seoOpen, setSeoOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const imageFileInput = useRef<HTMLInputElement>(null);

  const sectorOptions = sectors.filter((s) => s.id !== "all");
  const classification = resolveDemoClassification(demo, plans);
  const seoFilled = [
    demo.metaTitle,
    demo.metaDescription,
    demo.metaTitleEn,
    demo.metaDescriptionEn,
    demo.imageAltAr,
    demo.imageAltEn,
  ].filter((v) => Boolean(v && v.trim())).length;
  const seoScore = Math.round((seoFilled / 6) * 100);
  const isLive = Boolean(
    demo.previewUrl && demo.previewUrl !== "#" && /^https?:\/\//i.test(demo.previewUrl),
  );

  const onSectorChange = (sectorId: string) => {
    const found = sectorOptions.find((s) => s.id === sectorId);
    onChange({
      ...demo,
      sector: sectorId,
      sectorAr: found ? found.labelAr : demo.sectorAr,
      sectorEn: found ? found.labelEn : demo.sectorEn,
    });
  };

  const uploadImage = async (file: File) => {
    if (file.size > 4 * 1024 * 1024) {
      onFlash?.("Image trop volumineuse : 4 Mo maximum.", "err");
      return;
    }
    setImageUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/admin/media", {
        method: "POST",
        body,
      });
      const result = (await response.json()) as {
        ok?: boolean;
        url?: string;
        error?: string;
      };
      if (!response.ok || !result.ok || !result.url) {
        throw new Error(result.error || "Import impossible.");
      }
      onChange({ ...demo, image: result.url });
      onFlash?.(
        "Image importée. Cliquez sur « Enregistrer la galerie » pour publier.",
        "ok",
      );
    } catch (error) {
      onFlash?.(
        error instanceof Error ? error.message : "Import impossible.",
        "err",
      );
    } finally {
      setImageUploading(false);
      if (imageFileInput.current) imageFileInput.current.value = "";
    }
  };

  const generateAiSeo = async () => {
    setAiLoading(true);
    try {
      const res = await fetch("/api/admin/ai/seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "single",
          demo,
          options: { overwrite: true },
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        onFlash?.(json.error ?? "Échec de la génération SEO", "err");
        return;
      }
      onChange({ ...demo, ...json.fields });
      onFlash?.("Champs SEO générés avec succès.", "ok");
    } catch {
      onFlash?.("Erreur réseau lors de la génération SEO.", "err");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div
      className={`rounded-2xl border transition-[border-color,box-shadow] ${
        expanded
          ? "border-[#C6A664] bg-white shadow-sm"
          : "border-stone-200/90 bg-white hover:border-stone-300"
      }`}
    >
      {/* En-tête compact et lisible */}
      <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
        >
          <span
            className="h-9 w-9 rounded-xl border border-stone-200 shrink-0 shadow-2xs overflow-hidden bg-stone-100 relative grid place-items-center"
            style={{ backgroundColor: `${demo.color}18` }}
          >
            <span
              className="h-3.5 w-3.5 rounded-full"
              style={{ backgroundColor: demo.color }}
            />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-stone-900 truncate">
                {demo.titleEn || demo.title}
              </span>
              {isLive ? (
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                  LIVE
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-500 text-[10px] font-medium">
                  Image seule
                </span>
              )}
              {classification && (
                <span className="px-2 py-0.5 rounded-full bg-[#FAF6EC] text-[#7A5D20] border border-[#C6A664]/40 text-[10px] font-bold">
                  Offre unique
                  {classification.priceUsd != null
                    ? ` · modèle ${classification.priceUsd} ${currency}`
                    : ""}
                </span>
              )}
            </div>
            <div className="text-xs text-stone-500 truncate mt-0.5">
              <span dir="rtl">{demo.title}</span> · <code className="text-[11px]">{demo.slug}</code>
            </div>
          </div>

          <ChevronDown
            className={`h-4 w-4 text-stone-400 shrink-0 transition-transform ${
              expanded ? "rotate-180 text-stone-900" : ""
            }`} aria-hidden="true" />
        </button>

        {/* Actions rapides : ordre + aperçu + suppression directe */}
        <div className="flex items-center gap-1 shrink-0">
          {isLive && (
            <a
              href={demo.previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Ouvrir le site en direct"
              className="h-8 w-8 rounded-lg border border-stone-200 bg-stone-50 grid place-items-center text-stone-600 hover:bg-stone-100 hover:text-stone-900"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}
          <button
            type="button"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            title="Monter ce site"
            className="h-8 w-8 rounded-lg border border-stone-200 bg-stone-50 grid place-items-center text-stone-600 hover:bg-stone-100 disabled:opacity-30 cursor-pointer"
          >
            <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
            title="Descendre ce site"
            className="h-8 w-8 rounded-lg border border-stone-200 bg-stone-50 grid place-items-center text-stone-600 hover:bg-stone-100 disabled:opacity-30 cursor-pointer"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Supprimer ce site de la section"
            className="h-8 px-2.5 rounded-lg border border-red-200 bg-red-50/70 text-red-600 hover:bg-red-100 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Supprimer</span>
          </button>
        </div>
      </div>

      {/* Formulaire complet dépliable */}
      {expanded && (
        <div className="px-4 sm:px-5 pb-5 pt-4 border-t border-stone-200/80 space-y-4 bg-[#FCFBF9] rounded-b-2xl">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            <Field label="Slug (identifiant URL unique)">
              <input
                value={demo.slug}
                onChange={(e) =>
                  onChange({
                    ...demo,
                    slug: e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-]+/g, "-")
                      .replace(/^-+/, ""),
                  })
                }
                placeholder="ex: clinique-andalus"
                className={ADMIN_INPUT_CLS}
              />
            </Field>

            <Field label="Secteur d'activité">
              <select
                value={demo.sector}
                onChange={(e) => onSectorChange(e.target.value)}
                className={ADMIN_INPUT_CLS}
              >
                {sectorOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.labelEn} — {s.labelAr}
                  </option>
                ))}
                <option value="other">Autre secteur personnalisé</option>
              </select>
            </Field>

            <Field label="Couleur d'accent (#hex)">
              <div className="flex gap-2">
                <input
                  type="color"
                  value={
                    /^#[0-9a-fA-F]{6}$/.test(demo.color) ? demo.color : "#C6A664"
                  }
                  onChange={(e) => onChange({ ...demo, color: e.target.value })}
                  className="h-10 w-12 rounded-xl border border-stone-300 bg-white p-1 cursor-pointer"
                />
                <input
                  value={demo.color}
                  onChange={(e) => onChange({ ...demo, color: e.target.value })}
                  className={ADMIN_INPUT_CLS}
                />
              </div>
            </Field>

            <p className="text-xs leading-6 text-stone-500">{`Offre unique pour tous les designs : ${WEBSITE_BASE_PRICE_USD} $, personnalisation initiale incluse. Aucun prix propre au modèle ; les modules de gestion sont chiffrés séparément.`}</p>

            <Field label="URL du site en direct (https://... ou #)">
              <input
                value={demo.previewUrl}
                onChange={(e) => onChange({ ...demo, previewUrl: e.target.value })}
                placeholder="https://mon-client.vercel.app"
                className={ADMIN_INPUT_CLS}
              />
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-3.5">
            <Field label="Libellé secteur (arabe)">
              <input
                dir="rtl"
                value={demo.sectorAr}
                onChange={(e) => onChange({ ...demo, sectorAr: e.target.value })}
                className={ADMIN_INPUT_CLS}
              />
            </Field>
            <Field label="Libellé secteur (anglais)">
              <input
                value={demo.sectorEn}
                onChange={(e) => onChange({ ...demo, sectorEn: e.target.value })}
                className={ADMIN_INPUT_CLS}
              />
            </Field>

            <Field label="Titre du site (arabe)">
              <input
                dir="rtl"
                value={demo.title}
                onChange={(e) => onChange({ ...demo, title: e.target.value })}
                className={ADMIN_INPUT_CLS}
              />
            </Field>
            <Field label="Titre du site (anglais)">
              <input
                value={demo.titleEn}
                onChange={(e) => onChange({ ...demo, titleEn: e.target.value })}
                className={ADMIN_INPUT_CLS}
              />
            </Field>

            <Field label="Image miniature">
              <div className="flex gap-2">
                <input
                  value={demo.image}
                  onChange={(e) => onChange({ ...demo, image: e.target.value })}
                  placeholder="URL https://... ou image importée"
                  className={`${ADMIN_INPUT_CLS} min-w-0 flex-1`}
                />
                <input
                  ref={imageFileInput}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  className="sr-only"
                  tabIndex={-1}
                  aria-label="Choisir une image sur votre ordinateur"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadImage(file);
                  }}
                />
                <button
                  type="button"
                  disabled={imageUploading}
                  onClick={() => imageFileInput.current?.click()}
                  className="h-10 shrink-0 rounded-xl border border-stone-300 bg-white px-3 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-60 inline-flex items-center gap-1.5"
                >
                  {imageUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Upload className="h-4 w-4" aria-hidden="true" />
                  )}
                  <span className="hidden xl:inline">
                    {imageUploading ? "Import…" : "Depuis l’ordinateur"}
                  </span>
                  <span className="xl:hidden">Importer</span>
                </button>
              </div>
              <p className="mt-1 text-[11px] text-stone-500">
                JPG, PNG, WebP ou AVIF — 4 Mo maximum.
              </p>
            </Field>
            <div className="hidden sm:flex items-end">
              {demo.image && (
                <div className="h-10 px-3 rounded-xl border border-stone-200 bg-white flex items-center gap-2 text-xs text-stone-500 truncate w-full">
                  <span className="h-6 w-9 rounded bg-stone-100 overflow-hidden shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={demo.image}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </span>
                  <span className="truncate">{demo.image}</span>
                </div>
              )}
            </div>

            <Field label="Description (arabe)">
              <textarea
                dir="rtl"
                rows={2}
                value={demo.description}
                onChange={(e) => onChange({ ...demo, description: e.target.value })}
                className={ADMIN_TEXTAREA_CLS}
              />
            </Field>
            <Field label="Description (anglais)">
              <textarea
                rows={2}
                value={demo.descriptionEn}
                onChange={(e) =>
                  onChange({ ...demo, descriptionEn: e.target.value })
                }
                className={ADMIN_TEXTAREA_CLS}
              />
            </Field>

            <Field label="Points forts (arabe — un par ligne)">
              <textarea
                dir="rtl"
                rows={3}
                value={demo.features.join("\n")}
                onChange={(e) =>
                  onChange({
                    ...demo,
                    features: e.target.value
                      .split("\n")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                className={ADMIN_TEXTAREA_CLS}
              />
            </Field>
            <Field label="Points forts (anglais — un par ligne)">
              <textarea
                rows={3}
                value={demo.featuresEn.join("\n")}
                onChange={(e) =>
                  onChange({
                    ...demo,
                    featuresEn: e.target.value
                      .split("\n")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                className={ADMIN_TEXTAREA_CLS}
              />
            </Field>
          </div>

          {/* Volet SEO optionnel + Assistant IA */}
          <div className="rounded-xl border border-stone-200 bg-white p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setSeoOpen((v) => !v)}
                className="flex items-center gap-2 text-xs font-bold text-stone-700 cursor-pointer"
              >
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${
                    seoOpen ? "rotate-180" : ""
                  }`} aria-hidden="true" />
                <span>Référencement Google (SEO)</span>
                <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 text-[10px]">
                  {seoScore}% complété
                </span>
              </button>

              <button
                type="button"
                disabled={aiLoading}
                onClick={generateAiSeo}
                className="h-8 px-3 rounded-lg bg-[#FAF6EC] border border-[#C6A664]/45 text-[#7A5D20] text-xs font-bold inline-flex items-center gap-1.5 hover:bg-[#C6A664]/20 disabled:opacity-50 cursor-pointer"
              >
                {aiLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                Générer SEO IA
              </button>
            </div>

            {seoOpen && (
              <div className="mt-3.5 pt-3.5 border-t border-stone-100 grid sm:grid-cols-2 gap-3">
                <Field label="Meta Title (AR)">
                  <input
                    dir="rtl"
                    value={demo.metaTitle ?? ""}
                    onChange={(e) =>
                      onChange({ ...demo, metaTitle: e.target.value })
                    }
                    placeholder="تلقائي إذا تُرك فارغاً"
                    className={ADMIN_INPUT_CLS}
                  />
                </Field>
                <Field label="Meta Title (EN)">
                  <input
                    value={demo.metaTitleEn ?? ""}
                    onChange={(e) =>
                      onChange({ ...demo, metaTitleEn: e.target.value })
                    }
                    placeholder="Auto-generated if empty"
                    className={ADMIN_INPUT_CLS}
                  />
                </Field>
                <Field label="Meta Description (AR)">
                  <textarea
                    dir="rtl"
                    rows={2}
                    value={demo.metaDescription ?? ""}
                    onChange={(e) =>
                      onChange({ ...demo, metaDescription: e.target.value })
                    }
                    className={ADMIN_TEXTAREA_CLS}
                  />
                </Field>
                <Field label="Meta Description (EN)">
                  <textarea
                    rows={2}
                    value={demo.metaDescriptionEn ?? ""}
                    onChange={(e) =>
                      onChange({ ...demo, metaDescriptionEn: e.target.value })
                    }
                    className={ADMIN_TEXTAREA_CLS}
                  />
                </Field>
                <Field label="Texte alternatif image (AR)">
                  <input
                    dir="rtl"
                    value={demo.imageAltAr ?? ""}
                    onChange={(e) =>
                      onChange({ ...demo, imageAltAr: e.target.value })
                    }
                    className={ADMIN_INPUT_CLS}
                  />
                </Field>
                <Field label="Texte alternatif image (EN)">
                  <input
                    value={demo.imageAltEn ?? ""}
                    onChange={(e) =>
                      onChange({ ...demo, imageAltEn: e.target.value })
                    }
                    className={ADMIN_INPUT_CLS}
                  />
                </Field>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="block text-xs font-semibold text-stone-600">{label}</span>
      {children}
    </label>
  );
}
