"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  CopyPlus,
  ExternalLink,
  EyeOff,
  FolderPlus,
  Globe,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import {
  resetSectionsWorkspace,
  saveSectionsWorkspace,
} from "@/app/admin/actions";
import type {
  BuiltInSectionId,
  CustomSiteSection,
  Demo,
  HomeLayoutConfig,
  HomeSectionEntry,
  PricingPlanData,
} from "@/lib/site-types";
import {
  ADMIN_INPUT_CLS,
  ADMIN_TEXTAREA_CLS,
  SiteItemEditor,
  makeBlankDemo,
} from "../site-item-editor";

interface Props {
  initialLayout: HomeLayoutConfig;
  initialDemos: Demo[];
  plans: PricingPlanData[];
  currency: string;
}

const BUILTIN_META: Record<
  BuiltInSectionId,
  {
    label: string;
    desc: string;
    editHref?: string;
    hasSites?: boolean;
  }
> = {
  hero: {
    label: "Accueil — Bannière principale (Hero)",
    desc: "Grand titre d’accroche, boutons d’action et aperçu vitrine.",
    editHref: "/admin/content?tab=hero",
  },
  ribbon: {
    label: "Bandeau défilant des spécialités",
    desc: "Ruban horizontal animé mettant en avant vos expertises.",
    editHref: "/admin/content?tab=ribbon",
  },
  whyUs: {
    label: "Pourquoi nous choisir",
    desc: "Cartes d’arguments clés (rapidité, design, SEO, accompagnement).",
    editHref: "/admin/content?tab=whyUs",
  },
  demos: {
    label: "Galerie principale des sites clients",
    desc: "Vitrine interactive Desktop / Mobile avec filtrage par secteur.",
    hasSites: true,
  },
  identityStudio: {
    label: "Studio d’identité & Sélecteur de thèmes",
    desc: "Démonstration interactive des 8 palettes de couleurs et modes clair/sombre.",
    editHref: "/admin/content?tab=headings",
  },
  process: {
    label: "Processus en 5 étapes",
    desc: "Déroulement transparent du projet de l’appel découverte à la mise en ligne.",
    editHref: "/admin/content?tab=process",
  },
  pricing: {
    label: "Formules & Tarifs",
    desc: "Grille comparative des formules Vitrine, Vitrine+ et Boutique.",
    editHref: "/admin/settings?tab=pricing",
  },
  services: {
    label: "Services ouverts à la carte",
    desc: "Prestations ciblées (refonte, ajout de section, identité, slides).",
    editHref: "/admin/settings?tab=services",
  },
  testimonials: {
    label: "Témoignages & Résultats clients",
    desc: "Avis vérifiés avec comparatif Avant / Après.",
    editHref: "/admin/content?tab=testimonials",
  },
  faq: {
    label: "Questions fréquentes (FAQ)",
    desc: "Réponses détaillées + données structurées Google FAQ.",
    editHref: "/admin/content?tab=faqs",
  },
  cta: {
    label: "Formulaire de demande de devis",
    desc: "Formulaire de contact final connecté à l’onglet Demandes clients.",
    editHref: "/admin/content?tab=headings",
  },
};

function makeCustomSectionId(title: string, existingIds: string[]): string {
  const base =
    title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "section-sites";
  const used = new Set(existingIds);
  if (!used.has(base)) return base;
  let i = 2;
  while (used.has(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}

export function SectionsStudio({
  initialLayout,
  initialDemos,
  plans,
  currency,
}: Props) {
  const router = useRouter();
  const [layout, setLayout] = useState<HomeLayoutConfig>(initialLayout);
  const [demos, setDemos] = useState<Demo[]>(initialDemos);
  const [openSectionKeys, setOpenSectionKeys] = useState<Record<string, boolean>>({});
  const [openSiteIds, setOpenSiteIds] = useState<Record<string, boolean>>({});
  const [creatingSection, setCreatingSection] = useState(false);
  const [newSecTitleAr, setNewSecTitleAr] = useState("");
  const [newSecTitleEn, setNewSecTitleEn] = useState("");
  const [newSecSubtitleAr, setNewSecSubtitleAr] = useState("");
  const [newSecSubtitleEn, setNewSecSubtitleEn] = useState("");
  const [newSecVariant, setNewSecVariant] = useState<"interactive" | "cards">("cards");
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);
  const [pending, startTransition] = useTransition();

  const flash = (msg: string, kind: "ok" | "err") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 4000);
  };

  const activeEntries = layout.entries.filter((e) => e.enabled);
  const removedEntries = layout.entries.filter((e) => !e.enabled);
  const customMap = new Map(layout.customSections.map((s) => [s.id, s]));

  const toggleSectionOpen = (key: string) =>
    setOpenSectionKeys((prev) => ({ ...prev, [key]: !prev[key] }));

  const toggleSiteOpen = (key: string) =>
    setOpenSiteIds((prev) => ({ ...prev, [key]: !prev[key] }));

  const moveActiveEntry = (key: string, delta: -1 | 1) => {
    const enabledList = layout.entries.filter((e) => e.enabled);
    const disabledList = layout.entries.filter((e) => !e.enabled);
    const idx = enabledList.findIndex((e) => e.key === key);
    const target = idx + delta;
    if (idx < 0 || target < 0 || target >= enabledList.length) return;
    const reordered = [...enabledList];
    [reordered[idx], reordered[target]] = [reordered[target], reordered[idx]];
    setLayout({ ...layout, entries: [...reordered, ...disabledList] });
    setDirty(true);
  };

  const setEntryEnabled = (key: string, enabled: boolean) => {
    setLayout({
      ...layout,
      entries: layout.entries.map((e) =>
        e.key === key ? { ...e, enabled } : e,
      ),
    });
    setDirty(true);
  };

  const createCustomSection = () => {
    const titleEn = newSecTitleEn.trim() || "Featured Client Websites";
    const titleAr = newSecTitleAr.trim() || "مواقع مختارة من أعمالنا";
    const id = makeCustomSectionId(
      titleEn,
      layout.customSections.map((s) => s.id),
    );
    const created: CustomSiteSection = {
      id,
      badgeAr: "مجموعة مختارة",
      badgeEn: "CURATED SHOWCASE",
      titleAr,
      titleEn,
      subtitleAr:
        newSecSubtitleAr.trim() ||
        "استكشف مجموعة مختارة من المواقع المصممة خصيصاً لهذا القطاع",
      subtitleEn:
        newSecSubtitleEn.trim() ||
        "Explore handpicked websites crafted specifically for this category",
      variant: newSecVariant,
      sites: [],
    };

    const entryKey = `custom:${id}`;
    const newEntry: HomeSectionEntry = {
      key: entryKey,
      kind: "custom",
      customId: id,
      enabled: true,
    };

    // Insère juste après la galerie principale si présente, sinon en haut
    const nextEntries = [...layout.entries];
    const demosIdx = nextEntries.findIndex((e) => e.key === "demos");
    if (demosIdx >= 0) {
      nextEntries.splice(demosIdx + 1, 0, newEntry);
    } else {
      nextEntries.unshift(newEntry);
    }

    setLayout({
      entries: nextEntries,
      customSections: [...layout.customSections, created],
    });
    setOpenSectionKeys((prev) => ({ ...prev, [entryKey]: true }));
    setNewSecTitleAr("");
    setNewSecTitleEn("");
    setNewSecSubtitleAr("");
    setNewSecSubtitleEn("");
    setCreatingSection(false);
    setDirty(true);
    flash(
      `Section « ${titleEn} » créée — ajoutez vos sites à l’intérieur puis enregistrez.`,
      "ok",
    );
  };

  const deleteCustomSection = (id: string, label: string) => {
    if (
      !confirm(
        `Supprimer définitivement la section « ${label} » et sa liste de sites ?`,
      )
    ) {
      return;
    }
    setLayout({
      entries: layout.entries.filter((e) => e.customId !== id),
      customSections: layout.customSections.filter((s) => s.id !== id),
    });
    setDirty(true);
  };

  const updateCustomSection = (
    id: string,
    patch: Partial<CustomSiteSection>,
  ) => {
    setLayout({
      ...layout,
      customSections: layout.customSections.map((s) =>
        s.id === id ? { ...s, ...patch } : s,
      ),
    });
    setDirty(true);
  };

  /* --- Opérations sur les sites de la galerie principale (`demos`) --- */
  const addSiteToMainDemos = () => {
    const blank = makeBlankDemo(
      demos.map((d) => d.slug),
      plans,
    );
    setDemos([blank, ...demos]);
    setOpenSectionKeys((prev) => ({ ...prev, demos: true }));
    setOpenSiteIds((prev) => ({ ...prev, [`main:${blank.slug}`]: true }));
    setDirty(true);
  };

  const updateMainDemo = (idx: number, next: Demo) => {
    const copy = [...demos];
    copy[idx] = next;
    setDemos(copy);
    setDirty(true);
  };

  const moveMainDemo = (idx: number, delta: -1 | 1) => {
    const target = idx + delta;
    if (target < 0 || target >= demos.length) return;
    const copy = [...demos];
    [copy[idx], copy[target]] = [copy[target], copy[idx]];
    setDemos(copy);
    setDirty(true);
  };

  const deleteMainDemo = (idx: number) => {
    const item = demos[idx];
    if (
      !confirm(
        `Supprimer le site « ${item.titleEn || item.title} » de la galerie principale ?`,
      )
    ) {
      return;
    }
    setDemos(demos.filter((_, i) => i !== idx));
    setDirty(true);
  };

  /* --- Opérations sur les sites d'une section personnalisée --- */
  const addBlankSiteToCustomSection = (sec: CustomSiteSection) => {
    const allSlugs = [
      ...demos.map((d) => d.slug),
      ...layout.customSections.flatMap((s) => s.sites.map((st) => st.slug)),
    ];
    const blank = makeBlankDemo(allSlugs, plans);
    updateCustomSection(sec.id, { sites: [blank, ...sec.sites] });
    setOpenSiteIds((prev) => ({ ...prev, [`${sec.id}:${blank.slug}`]: true }));
  };

  const importExistingDemoToSection = (
    sec: CustomSiteSection,
    sourceSlug: string,
  ) => {
    if (!sourceSlug) return;
    const found = demos.find((d) => d.slug === sourceSlug);
    if (!found) return;
    if (sec.sites.some((s) => s.slug === found.slug)) {
      flash("Ce site figure déjà dans cette section.", "err");
      return;
    }
    updateCustomSection(sec.id, {
      sites: [...sec.sites, { ...found }],
    });
    flash(`« ${found.titleEn || found.title} » ajouté à la section.`, "ok");
  };

  const updateCustomSite = (
    sec: CustomSiteSection,
    idx: number,
    next: Demo,
  ) => {
    const copy = [...sec.sites];
    copy[idx] = next;
    updateCustomSection(sec.id, { sites: copy });
  };

  const moveCustomSite = (
    sec: CustomSiteSection,
    idx: number,
    delta: -1 | 1,
  ) => {
    const target = idx + delta;
    if (target < 0 || target >= sec.sites.length) return;
    const copy = [...sec.sites];
    [copy[idx], copy[target]] = [copy[target], copy[idx]];
    updateCustomSection(sec.id, { sites: copy });
  };

  const deleteCustomSite = (sec: CustomSiteSection, idx: number) => {
    const item = sec.sites[idx];
    if (
      !confirm(
        `Retirer le site « ${item.titleEn || item.title} » de la section « ${sec.titleEn} » ?`,
      )
    ) {
      return;
    }
    updateCustomSection(sec.id, {
      sites: sec.sites.filter((_, i) => i !== idx),
    });
  };

  /* --- Sauvegarde & Réinitialisation --- */
  const onSaveAll = () => {
    startTransition(async () => {
      const res = await saveSectionsWorkspace({ layout, demos });
      if (res.ok) {
        setDirty(false);
        flash(res.message ?? "Architecture enregistrée.", "ok");
        router.refresh();
      } else {
        flash(res.error ?? "Échec de l’enregistrement.", "err");
      }
    });
  };

  const onResetAll = () => {
    if (
      !confirm(
        "Réinitialiser l’ordre des sections et la galerie de sites aux valeurs par défaut du code ?",
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await resetSectionsWorkspace();
      if (res.ok) {
        setDirty(false);
        flash(res.message ?? "Réinitialisé.", "ok");
        router.refresh();
      } else {
        flash(res.error ?? "Erreur lors de la réinitialisation.", "err");
      }
    });
  };

  return (
    <div className="space-y-6 pb-24">
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 rounded-xl px-4 py-3 text-xs font-semibold shadow-xl flex items-center gap-2 max-w-md ${
            toast.kind === "ok"
              ? "bg-stone-900 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          <Check className="h-3.5 w-3.5 text-[#E5CA87] shrink-0" />
          <span>{toast.msg}</span>
        </div>
      )}

      {/* En-tête de l'atelier Sections & Sites */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#8A6D2F]">
            Constructeur historique — données conservées
          </span>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-stone-900 mt-0.5">
            Sections & Sites par section
          </h1>
          <p className="text-sm text-stone-500 mt-1 max-w-2xl">
            L’accueil actuel a une composition fixe et trois parcours. Les réglages d’ordre et de visibilité de cet ancien constructeur ne pilotent plus l’accueil. Les données de sections et les fiches restent conservées pour compatibilité ; gérez les exemples publics depuis « Exemples & réalisations ».
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCreatingSection((v) => !v)}
            className="h-10 px-4 rounded-xl bg-stone-900 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 hover:bg-stone-800 cursor-pointer shadow-xs"
          >
            <FolderPlus className="h-4 w-4 text-[#E5CA87]" />
            + Ajouter une section de sites
          </button>
          <Link
            href="/"
            target="_blank"
            className="h-10 px-3.5 rounded-xl border border-stone-300 bg-white text-stone-700 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 hover:bg-stone-50"
          >
            Voir l’accueil <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Panneau de création rapide d'une nouvelle section */}
      {creatingSection && (
        <div className="rounded-2xl border-2 border-[#C6A664] bg-white p-5 sm:p-6 space-y-4 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-stone-900">
                Créer une nouvelle section de sites sur le site
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Cette section aura son propre titre bilingue et sa propre liste de sites (avec aperçu live Desktop/Mobile).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCreatingSection(false)}
              className="text-xs font-semibold text-stone-500 hover:text-stone-900 cursor-pointer"
            >
              Annuler
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-3.5">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-stone-600">
                Titre de la section (arabe)
              </span>
              <input
                dir="rtl"
                value={newSecTitleAr}
                onChange={(e) => setNewSecTitleAr(e.target.value)}
                placeholder="مثال: متاجر إلكترونية جديدة"
                className={ADMIN_INPUT_CLS}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-stone-600">
                Titre de la section (anglais)
              </span>
              <input
                value={newSecTitleEn}
                onChange={(e) => setNewSecTitleEn(e.target.value)}
                placeholder="ex: New E-Commerce Stores"
                className={ADMIN_INPUT_CLS}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-stone-600">
                Sous-titre (arabe — optionnel)
              </span>
              <input
                dir="rtl"
                value={newSecSubtitleAr}
                onChange={(e) => setNewSecSubtitleAr(e.target.value)}
                placeholder="وصف مختصر يظهر تحت العنوان"
                className={ADMIN_INPUT_CLS}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-stone-600">
                Sous-titre (anglais — optionnel)
              </span>
              <input
                value={newSecSubtitleEn}
                onChange={(e) => setNewSecSubtitleEn(e.target.value)}
                placeholder="Short subtitle displayed below heading"
                className={ADMIN_INPUT_CLS}
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-stone-600">
                Présentation visuelle :
              </span>
              <button
                type="button"
                onClick={() => setNewSecVariant("cards")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer ${
                  newSecVariant === "cards"
                    ? "bg-stone-900 text-white border-stone-900"
                    : "bg-stone-50 text-stone-600 border-stone-200"
                }`}
              >
                Grille de cartes vitrines (3 colonnes)
              </button>
              <button
                type="button"
                onClick={() => setNewSecVariant("interactive")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer ${
                  newSecVariant === "interactive"
                    ? "bg-stone-900 text-white border-stone-900"
                    : "bg-stone-50 text-stone-600 border-stone-200"
                }`}
              >
                Scène interactive + écran Live
              </button>
            </div>

            <button
              type="button"
              onClick={createCustomSection}
              className="h-10 px-5 rounded-xl bg-[#B8923F] text-white text-xs font-bold inline-flex items-center gap-1.5 hover:bg-[#A37F31] cursor-pointer shadow-xs"
            >
              <Plus className="h-4 w-4" /> Créer la section maintenant
            </button>
          </div>
        </div>
      )}

      {/* Liste ordonnée des sections actives sur la page d'accueil */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-stone-500">
            Sections activées dans l’ancien constructeur ({activeEntries.length})
          </h2>
          <span className="text-xs text-stone-400">
            Ordre réel de haut en bas sur la page publique
          </span>
        </div>

        {activeEntries.map((entry, idx) => {
          const isCustom = entry.kind === "custom";
          const customSec =
            isCustom && entry.customId
              ? customMap.get(entry.customId)
              : undefined;
          const builtinMeta =
            !isCustom && entry.builtinId
              ? BUILTIN_META[entry.builtinId]
              : undefined;

          if (isCustom && !customSec) return null;

          const hasSites = isCustom || Boolean(builtinMeta?.hasSites);
          const sitesCount = isCustom
            ? (customSec?.sites.length ?? 0)
            : demos.length;
          const isOpen = Boolean(openSectionKeys[entry.key]);

          return (
            <div
              key={entry.key}
              className={`rounded-2xl border bg-white transition-all shadow-2xs ${
                isOpen
                  ? "border-[#C6A664] ring-1 ring-[#C6A664]/30"
                  : "border-stone-200/90 hover:border-stone-300"
              }`}
            >
              {/* Ligne d'en-tête de la section */}
              <div className="p-4 sm:px-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="h-8 w-8 rounded-xl bg-stone-100 border border-stone-200 grid place-items-center text-xs font-black text-stone-700 shrink-0 tabular-nums">
                    {idx + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm sm:text-base font-black text-stone-900">
                        {isCustom
                          ? customSec!.titleEn || customSec!.titleAr
                          : builtinMeta?.label}
                      </span>
                      {isCustom ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-[#FAF6EC] text-[#7A5D20] border border-[#C6A664]/45 text-[11px] font-bold">
                          Section personnalisée
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 text-[11px] font-medium">
                          Section native
                        </span>
                      )}
                      {hasSites && (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold inline-flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          {sitesCount} site{sitesCount > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-stone-500 truncate mt-0.5">
                      {isCustom
                        ? `${customSec!.titleAr} — ${
                            customSec!.variant === "cards"
                              ? "Grille de cartes"
                              : "Scène interactive live"
                          }`
                        : builtinMeta?.desc}
                    </p>
                  </div>
                </div>

                {/* Boutons d'action sur la section */}
                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  {hasSites && (
                    <button
                      type="button"
                      onClick={() => toggleSectionOpen(entry.key)}
                      className={`h-8 px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                        isOpen
                          ? "bg-stone-900 text-white"
                          : "bg-[#FAF6EC] text-[#7A5D20] border border-[#C6A664]/45 hover:bg-[#C6A664]/20"
                      }`}
                    >
                      <span>
                        {isOpen
                          ? "Fermer les sites"
                          : `Gérer les sites (${sitesCount})`}
                      </span>
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                  )}

                  {!hasSites && builtinMeta?.editHref && (
                    <Link
                      href={builtinMeta.editHref}
                      className="h-8 px-3 rounded-lg border border-stone-200 bg-stone-50 text-xs font-semibold text-stone-700 hover:bg-stone-100 inline-flex items-center"
                    >
                      Éditer le contenu
                    </Link>
                  )}

                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveActiveEntry(entry.key, -1)}
                    title="Monter cette section"
                    className="h-8 w-8 rounded-lg border border-stone-200 bg-stone-50 grid place-items-center text-stone-600 hover:bg-stone-100 disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === activeEntries.length - 1}
                    onClick={() => moveActiveEntry(entry.key, 1)}
                    title="Descendre cette section"
                    className="h-8 w-8 rounded-lg border border-stone-200 bg-stone-50 grid place-items-center text-stone-600 hover:bg-stone-100 disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>

                  {isCustom ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setEntryEnabled(entry.key, false)}
                        title="Masquer sans supprimer"
                        className="h-8 px-2.5 rounded-lg border border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <EyeOff className="h-3.5 w-3.5" />
                        <span className="hidden md:inline">Masquer</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          deleteCustomSection(
                            customSec!.id,
                            customSec!.titleEn || customSec!.titleAr,
                          )
                        }
                        title="Supprimer définitivement cette section"
                        className="h-8 px-2.5 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Supprimer</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEntryEnabled(entry.key, false)}
                      title="Désactiver cette section dans l’ancien constructeur"
                      className="h-8 px-2.5 rounded-lg border border-red-200 bg-red-50/70 text-red-600 hover:bg-red-100 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Supprimer</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Panneau dépliable : édition de la section + ajout / suppression des sites */}
              {hasSites && isOpen && (
                <div className="border-t border-stone-200 bg-[#FAF9F6] p-4 sm:p-5 space-y-4 rounded-b-2xl">
                  {/* Réglages d'en-tête pour une section personnalisée */}
                  {isCustom && customSec && (
                    <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                          Paramètres & titres de la section
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              updateCustomSection(customSec.id, {
                                variant: "cards",
                              })
                            }
                            className={`px-3 py-1 rounded-lg text-xs font-semibold border cursor-pointer ${
                              customSec.variant === "cards"
                                ? "bg-stone-900 text-white border-stone-900"
                                : "bg-stone-50 text-stone-600 border-stone-200"
                            }`}
                          >
                            Grille de cartes
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateCustomSection(customSec.id, {
                                variant: "interactive",
                              })
                            }
                            className={`px-3 py-1 rounded-lg text-xs font-semibold border cursor-pointer ${
                              customSec.variant === "interactive"
                                ? "bg-stone-900 text-white border-stone-900"
                                : "bg-stone-50 text-stone-600 border-stone-200"
                            }`}
                          >
                            Scène interactive Live
                          </button>
                        </div>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-3">
                        <label className="block space-y-1">
                          <span className="text-xs font-semibold text-stone-600">
                             Surtitre / Badge (arabe)
                          </span>
                          <input
                            dir="rtl"
                            value={customSec.badgeAr}
                            onChange={(e) =>
                              updateCustomSection(customSec.id, {
                                badgeAr: e.target.value,
                              })
                            }
                            className={ADMIN_INPUT_CLS}
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-xs font-semibold text-stone-600">
                            Surtitre / Badge (anglais)
                          </span>
                          <input
                            value={customSec.badgeEn}
                            onChange={(e) =>
                              updateCustomSection(customSec.id, {
                                badgeEn: e.target.value,
                              })
                            }
                            className={ADMIN_INPUT_CLS}
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-xs font-semibold text-stone-600">
                            Titre (arabe)
                          </span>
                          <input
                            dir="rtl"
                            value={customSec.titleAr}
                            onChange={(e) =>
                              updateCustomSection(customSec.id, {
                                titleAr: e.target.value,
                              })
                            }
                            className={ADMIN_INPUT_CLS}
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-xs font-semibold text-stone-600">
                            Titre (anglais)
                          </span>
                          <input
                            value={customSec.titleEn}
                            onChange={(e) =>
                              updateCustomSection(customSec.id, {
                                titleEn: e.target.value,
                              })
                            }
                            className={ADMIN_INPUT_CLS}
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-xs font-semibold text-stone-600">
                            Sous-titre (arabe)
                          </span>
                          <textarea
                            dir="rtl"
                            rows={2}
                            value={customSec.subtitleAr}
                            onChange={(e) =>
                              updateCustomSection(customSec.id, {
                                subtitleAr: e.target.value,
                              })
                            }
                            className={ADMIN_TEXTAREA_CLS}
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-xs font-semibold text-stone-600">
                            Sous-titre (anglais)
                          </span>
                          <textarea
                            rows={2}
                            value={customSec.subtitleEn}
                            onChange={(e) =>
                              updateCustomSection(customSec.id, {
                                subtitleEn: e.target.value,
                              })
                            }
                            className={ADMIN_TEXTAREA_CLS}
                          />
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Barre d'ajout de sites dans la section */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs font-bold text-stone-700">
                      Sites présents dans cette section ({sitesCount})
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {isCustom && customSec && demos.length > 0 && (
                        <div className="inline-flex items-center gap-1.5">
                          <CopyPlus className="h-3.5 w-3.5 text-stone-500" />
                          <select
                            defaultValue=""
                            onChange={(e) => {
                              importExistingDemoToSection(
                                customSec,
                                e.target.value,
                              );
                              e.target.value = "";
                            }}
                            className="h-9 rounded-xl border border-stone-300 bg-white px-3 text-xs font-semibold text-stone-700 focus:outline-none focus:border-[#B8923F] cursor-pointer"
                          >
                            <option value="">
                              + Importer un site existant…
                            </option>
                            {demos.map((d) => (
                              <option key={d.slug} value={d.slug}>
                                {d.titleEn || d.title} ({d.slug})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          isCustom && customSec
                            ? addBlankSiteToCustomSection(customSec)
                            : addSiteToMainDemos()
                        }
                        className="h-9 px-3.5 rounded-xl bg-stone-900 text-white text-xs font-bold inline-flex items-center gap-1.5 hover:bg-stone-800 cursor-pointer shadow-2xs"
                      >
                        <Plus className="h-3.5 w-3.5 text-[#E5CA87]" />
                        Ajouter un site dans cette section
                      </button>
                    </div>
                  </div>

                  {/* Liste des sites de la section */}
                  {isCustom && customSec ? (
                    customSec.sites.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-stone-300 bg-white p-6 text-center text-xs text-stone-500">
                        Aucun site dans cette section pour l’instant. Cliquez sur{" "}
                        <strong className="text-stone-800">
                          « Ajouter un site dans cette section »
                        </strong>{" "}
                        ou importez un site existant ci-dessus.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {customSec.sites.map((site, sIdx) => {
                          const itemKey = `${customSec.id}:${site.slug}`;
                          return (
                            <SiteItemEditor
                              key={`${itemKey}-${sIdx}`}
                              demo={site}
                              index={sIdx}
                              total={customSec.sites.length}
                              plans={plans}
                              currency={currency}
                              expanded={Boolean(openSiteIds[itemKey])}
                              onToggleExpand={() => toggleSiteOpen(itemKey)}
                              onChange={(next) =>
                                updateCustomSite(customSec, sIdx, next)
                              }
                              onMove={(delta) =>
                                moveCustomSite(customSec, sIdx, delta)
                              }
                              onDelete={() => deleteCustomSite(customSec, sIdx)}
                              onFlash={flash}
                            />
                          );
                        })}
                      </div>
                    )
                  ) : demos.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-stone-300 bg-white p-6 text-center text-xs text-stone-500">
                      Aucun site dans la galerie principale. Cliquez sur{" "}
                      <strong className="text-stone-800">
                        « Ajouter un site dans cette section »
                      </strong>{" "}
                      pour en créer un nouveau.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {demos.map((site, sIdx) => {
                        const itemKey = `main:${site.slug}`;
                        return (
                          <SiteItemEditor
                            key={`${itemKey}-${sIdx}`}
                            demo={site}
                            index={sIdx}
                            total={demos.length}
                            plans={plans}
                            currency={currency}
                            expanded={Boolean(openSiteIds[itemKey])}
                            onToggleExpand={() => toggleSiteOpen(itemKey)}
                            onChange={(next) => updateMainDemo(sIdx, next)}
                            onMove={(delta) => moveMainDemo(sIdx, delta)}
                            onDelete={() => deleteMainDemo(sIdx)}
                            onFlash={flash}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sections retirées de l'accueil — restaurables en 1 clic */}
      {removedEntries.length > 0 && (
        <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3 shadow-2xs">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Sections retirées / masquées ({removedEntries.length})
            </h3>
            <p className="text-xs text-stone-400 mt-0.5">
              Ces sections ne s’affichent plus sur la page d’accueil. Vous pouvez les réintégrer en un clic à tout moment.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-2.5">
            {removedEntries.map((entry) => {
              const isCustom = entry.kind === "custom";
              const customSec =
                isCustom && entry.customId
                  ? customMap.get(entry.customId)
                  : undefined;
              const label = isCustom
                ? customSec?.titleEn || customSec?.titleAr || entry.key
                : entry.builtinId
                  ? BUILTIN_META[entry.builtinId].label
                  : entry.key;

              return (
                <div
                  key={entry.key}
                  className="rounded-xl border border-stone-200 bg-[#FAF9F6] px-3.5 py-2.5 flex items-center justify-between gap-2"
                >
                  <span className="text-xs font-semibold text-stone-700 truncate">
                    {label}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setEntryEnabled(entry.key, true)}
                      className="h-7 px-2.5 rounded-lg bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 cursor-pointer"
                    >
                      Réintégrer
                    </button>
                    {isCustom && customSec && (
                      <button
                        type="button"
                        onClick={() =>
                          deleteCustomSection(customSec.id, label)
                        }
                        className="h-7 px-2 rounded-lg text-red-600 hover:bg-red-50 text-xs font-semibold cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Barre d'enregistrement fixe en bas */}
      <div className="fixed bottom-4 left-4 right-4 lg:left-80 lg:right-8 z-30">
        <div className="max-w-5xl mx-auto rounded-2xl border border-stone-300 bg-white/95 backdrop-blur px-4 py-3 shadow-xl flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-stone-600">
            {dirty ? (
              <span className="font-bold text-[#8A6D2F]">
                ● Modifications non enregistrées — cliquez sur « Enregistrer » pour publier sur le site.
              </span>
            ) : (
              <span>
                Toutes les sections et tous les sites sont synchronisés.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={onResetAll}
              className="h-9 px-3.5 rounded-xl border border-stone-300 bg-stone-50 text-stone-600 text-xs font-semibold hover:bg-stone-100 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Valeurs par défaut
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={onSaveAll}
              className="h-9 px-5 rounded-xl bg-stone-900 text-white text-xs sm:text-sm font-bold hover:bg-stone-800 inline-flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-xs"
            >
              <Check className="h-4 w-4 text-[#E5CA87]" />
              {pending ? "Enregistrement…" : "Enregistrer sur le site"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
