"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Blocks,
  Check,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { resetContentSection, saveContentSection } from "@/app/admin/actions";

const WHY_ICON_IDS = ["zap", "palette", "sliders", "search", "headset"] as const;
import {
  SECTION_HEADING_IDS,
  type Demo,
  type Faq,
  type HeroContent,
  type PricingPlanData,
  type ProcessStep,
  type RibbonContent,
  type SectionHeadingId,
  type SectionHeadings,
  type SiteContent,
  type Testimonial,
  type WhyUsItem,
} from "@/lib/site-types";
import {
  ADMIN_INPUT_CLS,
  ADMIN_TEXTAREA_CLS,
  SiteItemEditor,
  makeBlankDemo,
} from "../site-item-editor";

type EditableTab =
  | "hero"
  | "ribbon"
  | "whyUs"
  | "process"
  | "testimonials"
  | "faqs"
  | "headings"
  | "demos";

const VALID_TABS: EditableTab[] = [
  "hero",
  "ribbon",
  "whyUs",
  "process",
  "testimonials",
  "faqs",
  "headings",
  "demos",
];

const HEADING_META: Record<
  SectionHeadingId,
  { label: string; hasNote?: boolean }
> = {
  why: { label: "Pourquoi nous choisir" },
  demos: { label: "Galerie des sites clients" },
  identityCustomizer: { label: "Personnalisateur d’identité" },
  identityThemes: { label: "Sélecteur des 6 thèmes (classés)" },
  process: { label: "Processus en 5 étapes", hasNote: true },
  pricing: { label: "Formules & Tarifs", hasNote: true },
  flexPay: { label: "Paiement flexible" },
  services: { label: "Services ouverts à la carte" },
  testimonials: { label: "Témoignages clients" },
  faq: { label: "Questions fréquentes (FAQ)" },
  cta: { label: "Appel à l’action & formulaire devis", hasNote: true },
};

const WHY_ICON_LABELS: Record<(typeof WHY_ICON_IDS)[number], string> = {
  zap: "Éclair — Rapidité",
  palette: "Palette — Design",
  sliders: "Curseurs — Sur-mesure",
  search: "Loupe — SEO Google",
  headset: "Casque — Support client",
};

interface Props {
  initial: SiteContent;
  plans: PricingPlanData[];
  currency: string;
  initialTab?: string;
}

export function ContentEditor({
  initial,
  plans,
  currency,
  initialTab,
}: Props) {
  const router = useRouter();
  const resolvedInitialTab: EditableTab = VALID_TABS.includes(
    initialTab as EditableTab,
  )
    ? (initialTab as EditableTab)
    : "hero";

  const [tab, setTab] = useState<EditableTab>(resolvedInitialTab);
  const [hero, setHero] = useState<HeroContent>(initial.hero);
  const [ribbon, setRibbon] = useState<RibbonContent>(initial.ribbon);
  const [whyUs, setWhyUs] = useState<WhyUsItem[]>(initial.whyUs);
  const [process, setProcess] = useState<ProcessStep[]>(initial.process);
  const [testimonials, setTestimonials] = useState<Testimonial[]>(
    initial.testimonials,
  );
  const [faqs, setFaqs] = useState<Faq[]>(initial.faqs);
  const [headings, setHeadings] = useState<SectionHeadings>(initial.headings);
  const [demos, setDemos] = useState<Demo[]>(initial.demos);
  const [openDemoSlugs, setOpenDemoSlugs] = useState<Record<string, boolean>>(
    {},
  );
  const [dirtyMap, setDirtyMap] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  const markDirty = (t: EditableTab) =>
    setDirtyMap((prev) => ({ ...prev, [t]: true }));

  const flash = (msg: string, kind: "ok" | "err") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 4000);
  };

  const tabItems: { id: EditableTab; label: string; count?: number }[] = [
    { id: "hero", label: "Hero d’accueil" },
    { id: "ribbon", label: "Bandeau défilant", count: ribbon.items.length },
    { id: "whyUs", label: "Pourquoi nous", count: whyUs.length },
    { id: "process", label: "Étapes", count: process.length },
    { id: "testimonials", label: "Témoignages", count: testimonials.length },
    { id: "faqs", label: "FAQ", count: faqs.length },
    { id: "headings", label: "Titres de sections" },
    { id: "demos", label: "Sites clients", count: demos.length },
  ];

  const payloadForTab = (t: EditableTab): unknown => {
    switch (t) {
      case "hero":
        return hero;
      case "ribbon":
        return ribbon;
      case "whyUs":
        return whyUs;
      case "process":
        return process;
      case "testimonials":
        return testimonials;
      case "faqs":
        return faqs;
      case "headings":
        return headings;
      case "demos":
        return demos;
    }
  };

  const onSave = () => {
    startTransition(async () => {
      const res = await saveContentSection(tab, payloadForTab(tab));
      if (res.ok) {
        setDirtyMap((prev) => ({ ...prev, [tab]: false }));
        flash(res.message ?? "Contenu enregistré.", "ok");
        router.refresh();
      } else {
        flash(res.error ?? "Échec de l’enregistrement.", "err");
      }
    });
  };

  const onReset = () => {
    if (
      !confirm(
        "Réinitialiser cet onglet à ses valeurs par défaut d’origine ?",
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await resetContentSection(tab);
      if (res.ok) {
        setDirtyMap((prev) => ({ ...prev, [tab]: false }));
        flash("Valeurs par défaut restaurées.", "ok");
        router.refresh();
      } else {
        flash(res.error ?? "Erreur.", "err");
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

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#8A6D2F]">
            Édition éditoriale bilingue
          </span>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-stone-900 mt-0.5">
            Textes, FAQ & Témoignages
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            Modifiez tous les textes bilingues (arabe & anglais) de votre site. Pour ajouter ou supprimer des sections entières, rendez-vous dans{" "}
            <Link
              href="/admin/sections"
              className="text-[#8A6D2F] font-semibold hover:underline inline-flex items-center gap-1"
            >
              <Blocks className="h-3.5 w-3.5" /> Sections & Sites
            </Link>
            .
          </p>
        </div>
      </div>

      {/* Onglets clairs et lisibles */}
      <div className="flex flex-wrap gap-1.5 rounded-2xl border border-stone-200 bg-white p-2 shadow-2xs">
        {tabItems.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                active
                  ? "bg-stone-900 text-white shadow-2xs"
                  : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
              }`}
            >
              <span>{item.label}</span>
              {item.count !== undefined && (
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] ${
                    active
                      ? "bg-white/20 text-white"
                      : "bg-stone-100 text-stone-500"
                  }`}
                >
                  {item.count}
                </span>
              )}
              {dirtyMap[item.id] && (
                <span className="h-2 w-2 rounded-full bg-amber-400" />
              )}
            </button>
          );
        })}
      </div>

      {/* --- ONGLET HERO --- */}
      {tab === "hero" && (
        <div className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 space-y-4 shadow-2xs">
          <h2 className="text-sm font-black text-stone-900">
            Bannière principale d’accueil (Hero)
          </h2>
          <div className="grid sm:grid-cols-2 gap-3.5">
            <Field label="Badge au-dessus du titre (arabe)">
              <input
                dir="rtl"
                value={hero.badgeAr}
                onChange={(e) => {
                  setHero({ ...hero, badgeAr: e.target.value });
                  markDirty("hero");
                }}
                className={ADMIN_INPUT_CLS}
              />
            </Field>
            <Field label="Badge au-dessus du titre (anglais)">
              <input
                value={hero.badgeEn}
                onChange={(e) => {
                  setHero({ ...hero, badgeEn: e.target.value });
                  markDirty("hero");
                }}
                className={ADMIN_INPUT_CLS}
              />
            </Field>

            <Field label="Titre ligne 1 (arabe)">
              <input
                dir="rtl"
                value={hero.title1Ar}
                onChange={(e) => {
                  setHero({ ...hero, title1Ar: e.target.value });
                  markDirty("hero");
                }}
                className={ADMIN_INPUT_CLS}
              />
            </Field>
            <Field label="Titre ligne 1 (anglais)">
              <input
                value={hero.title1En}
                onChange={(e) => {
                  setHero({ ...hero, title1En: e.target.value });
                  markDirty("hero");
                }}
                className={ADMIN_INPUT_CLS}
              />
            </Field>

            <Field label="Titre ligne 2 — couleur d'accent (arabe)">
              <input
                dir="rtl"
                value={hero.title2Ar}
                onChange={(e) => {
                  setHero({ ...hero, title2Ar: e.target.value });
                  markDirty("hero");
                }}
                className={ADMIN_INPUT_CLS}
              />
            </Field>
            <Field label="Titre ligne 2 — couleur d'accent (anglais)">
              <input
                value={hero.title2En}
                onChange={(e) => {
                  setHero({ ...hero, title2En: e.target.value });
                  markDirty("hero");
                }}
                className={ADMIN_INPUT_CLS}
              />
            </Field>

            <Field label="Titre ligne 3 (arabe)">
              <input
                dir="rtl"
                value={hero.title3Ar}
                onChange={(e) => {
                  setHero({ ...hero, title3Ar: e.target.value });
                  markDirty("hero");
                }}
                className={ADMIN_INPUT_CLS}
              />
            </Field>
            <Field label="Titre ligne 3 (anglais)">
              <input
                value={hero.title3En}
                onChange={(e) => {
                  setHero({ ...hero, title3En: e.target.value });
                  markDirty("hero");
                }}
                className={ADMIN_INPUT_CLS}
              />
            </Field>

            <Field label="Sous-titre (arabe)">
              <textarea
                dir="rtl"
                rows={3}
                value={hero.subtitleAr}
                onChange={(e) => {
                  setHero({ ...hero, subtitleAr: e.target.value });
                  markDirty("hero");
                }}
                className={ADMIN_TEXTAREA_CLS}
              />
            </Field>
            <Field label="Sous-titre (anglais)">
              <textarea
                rows={3}
                value={hero.subtitleEn}
                onChange={(e) => {
                  setHero({ ...hero, subtitleEn: e.target.value });
                  markDirty("hero");
                }}
                className={ADMIN_TEXTAREA_CLS}
              />
            </Field>

            <Field label="Bouton principal (arabe)">
              <input
                dir="rtl"
                value={hero.ctaPrimaryAr}
                onChange={(e) => {
                  setHero({ ...hero, ctaPrimaryAr: e.target.value });
                  markDirty("hero");
                }}
                className={ADMIN_INPUT_CLS}
              />
            </Field>
            <Field label="Bouton principal (anglais)">
              <input
                value={hero.ctaPrimaryEn}
                onChange={(e) => {
                  setHero({ ...hero, ctaPrimaryEn: e.target.value });
                  markDirty("hero");
                }}
                className={ADMIN_INPUT_CLS}
              />
            </Field>

            <Field label="Bouton secondaire (arabe)">
              <input
                dir="rtl"
                value={hero.ctaSecondaryAr}
                onChange={(e) => {
                  setHero({ ...hero, ctaSecondaryAr: e.target.value });
                  markDirty("hero");
                }}
                className={ADMIN_INPUT_CLS}
              />
            </Field>
            <Field label="Bouton secondaire (anglais)">
              <input
                value={hero.ctaSecondaryEn}
                onChange={(e) => {
                  setHero({ ...hero, ctaSecondaryEn: e.target.value });
                  markDirty("hero");
                }}
                className={ADMIN_INPUT_CLS}
              />
            </Field>

            <Field label="Confiance client (arabe)">
              <input
                dir="rtl"
                value={hero.trustedAr}
                onChange={(e) => {
                  setHero({ ...hero, trustedAr: e.target.value });
                  markDirty("hero");
                }}
                className={ADMIN_INPUT_CLS}
              />
            </Field>
            <Field label="Confiance client (anglais)">
              <input
                value={hero.trustedEn}
                onChange={(e) => {
                  setHero({ ...hero, trustedEn: e.target.value });
                  markDirty("hero");
                }}
                className={ADMIN_INPUT_CLS}
              />
            </Field>

            <Field label="Note moyenne (arabe)">
              <input
                dir="rtl"
                value={hero.ratingAr}
                onChange={(e) => {
                  setHero({ ...hero, ratingAr: e.target.value });
                  markDirty("hero");
                }}
                className={ADMIN_INPUT_CLS}
              />
            </Field>
            <Field label="Note moyenne (anglais)">
              <input
                value={hero.ratingEn}
                onChange={(e) => {
                  setHero({ ...hero, ratingEn: e.target.value });
                  markDirty("hero");
                }}
                className={ADMIN_INPUT_CLS}
              />
            </Field>

            <Field label="Pastilles de réassurance (arabe — une par ligne)">
              <textarea
                dir="rtl"
                rows={3}
                value={hero.chipsAr.join("\n")}
                onChange={(e) => {
                  setHero({
                    ...hero,
                    chipsAr: e.target.value
                      .split("\n")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  });
                  markDirty("hero");
                }}
                className={ADMIN_TEXTAREA_CLS}
              />
            </Field>
            <Field label="Pastilles de réassurance (anglais — une par ligne)">
              <textarea
                rows={3}
                value={hero.chipsEn.join("\n")}
                onChange={(e) => {
                  setHero({
                    ...hero,
                    chipsEn: e.target.value
                      .split("\n")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  });
                  markDirty("hero");
                }}
                className={ADMIN_TEXTAREA_CLS}
              />
            </Field>
          </div>
        </div>
      )}

      {/* --- ONGLET RIBBON --- */}
      {tab === "ribbon" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3.5 shadow-2xs">
            <h2 className="text-sm font-black text-stone-900">
              Accroche du bandeau défilant
            </h2>
            <div className="grid sm:grid-cols-2 gap-3.5">
              <Field label="Accroche (arabe)">
                <input
                  dir="rtl"
                  value={ribbon.taglineAr}
                  onChange={(e) => {
                    setRibbon({ ...ribbon, taglineAr: e.target.value });
                    markDirty("ribbon");
                  }}
                  className={ADMIN_INPUT_CLS}
                />
              </Field>
              <Field label="Accroche (anglais)">
                <input
                  value={ribbon.taglineEn}
                  onChange={(e) => {
                    setRibbon({ ...ribbon, taglineEn: e.target.value });
                    markDirty("ribbon");
                  }}
                  className={ADMIN_INPUT_CLS}
                />
              </Field>
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-stone-900">
                Mots-clés défilants ({ribbon.items.length})
              </h3>
              <button
                type="button"
                onClick={() => {
                  setRibbon({
                    ...ribbon,
                    items: [
                      ...ribbon.items,
                      { ar: "خدمة جديدة", en: "New service" },
                    ],
                  });
                  markDirty("ribbon");
                }}
                className="h-8 px-3 rounded-lg bg-stone-900 text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" /> Ajouter
              </button>
            </div>

            <div className="space-y-2">
              {ribbon.items.map((it, idx) => (
                <div
                  key={idx}
                  className="grid sm:grid-cols-[1fr_1fr_auto] gap-2 items-center"
                >
                  <input
                    dir="rtl"
                    value={it.ar}
                    onChange={(e) => {
                      const next = [...ribbon.items];
                      next[idx] = { ...it, ar: e.target.value };
                      setRibbon({ ...ribbon, items: next });
                      markDirty("ribbon");
                    }}
                    className={ADMIN_INPUT_CLS}
                  />
                  <input
                    value={it.en}
                    onChange={(e) => {
                      const next = [...ribbon.items];
                      next[idx] = { ...it, en: e.target.value };
                      setRibbon({ ...ribbon, items: next });
                      markDirty("ribbon");
                    }}
                    className={ADMIN_INPUT_CLS}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setRibbon({
                        ...ribbon,
                        items: ribbon.items.filter((_, i) => i !== idx),
                      });
                      markDirty("ribbon");
                    }}
                    className="h-10 px-3 rounded-xl border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 text-xs font-semibold cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- ONGLET WHY US --- */}
      {tab === "whyUs" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-stone-900">
              Cartes « Pourquoi nous choisir » ({whyUs.length})
            </h2>
            <button
              type="button"
              onClick={() => {
                setWhyUs([
                  ...whyUs,
                  {
                    icon: "zap",
                    titleAr: "ميزة جديدة",
                    titleEn: "New advantage",
                    descAr: "وصف مختصر للميزة",
                    descEn: "Short description of this advantage",
                  },
                ]);
                markDirty("whyUs");
              }}
              className="h-9 px-3.5 rounded-xl bg-stone-900 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> Ajouter une carte
            </button>
          </div>

          {whyUs.map((item, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3.5 shadow-2xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black text-stone-700">
                  Carte #{idx + 1}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => {
                      const next = [...whyUs];
                      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                      setWhyUs(next);
                      markDirty("whyUs");
                    }}
                    className="h-8 w-8 rounded-lg border border-stone-200 bg-stone-50 grid place-items-center disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === whyUs.length - 1}
                    onClick={() => {
                      const next = [...whyUs];
                      [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                      setWhyUs(next);
                      markDirty("whyUs");
                    }}
                    className="h-8 w-8 rounded-lg border border-stone-200 bg-stone-50 grid place-items-center disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setWhyUs(whyUs.filter((_, i) => i !== idx));
                      markDirty("whyUs");
                    }}
                    className="h-8 px-2.5 rounded-lg border border-red-200 bg-red-50 text-red-600 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Supprimer
                  </button>
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-3.5">
                <Field label="Icône">
                  <select
                    value={item.icon}
                    onChange={(e) => {
                      const next = [...whyUs];
                      next[idx] = { ...item, icon: e.target.value };
                      setWhyUs(next);
                      markDirty("whyUs");
                    }}
                    className={ADMIN_INPUT_CLS}
                  >
                    {WHY_ICON_IDS.map((id) => (
                      <option key={id} value={id}>
                        {WHY_ICON_LABELS[id]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Titre (arabe)">
                  <input
                    dir="rtl"
                    value={item.titleAr}
                    onChange={(e) => {
                      const next = [...whyUs];
                      next[idx] = { ...item, titleAr: e.target.value };
                      setWhyUs(next);
                      markDirty("whyUs");
                    }}
                    className={ADMIN_INPUT_CLS}
                  />
                </Field>
                <Field label="Titre (anglais)">
                  <input
                    value={item.titleEn}
                    onChange={(e) => {
                      const next = [...whyUs];
                      next[idx] = { ...item, titleEn: e.target.value };
                      setWhyUs(next);
                      markDirty("whyUs");
                    }}
                    className={ADMIN_INPUT_CLS}
                  />
                </Field>
              </div>
              <div className="grid sm:grid-cols-2 gap-3.5">
                <Field label="Description (arabe)">
                  <textarea
                    dir="rtl"
                    rows={2}
                    value={item.descAr}
                    onChange={(e) => {
                      const next = [...whyUs];
                      next[idx] = { ...item, descAr: e.target.value };
                      setWhyUs(next);
                      markDirty("whyUs");
                    }}
                    className={ADMIN_TEXTAREA_CLS}
                  />
                </Field>
                <Field label="Description (anglais)">
                  <textarea
                    rows={2}
                    value={item.descEn}
                    onChange={(e) => {
                      const next = [...whyUs];
                      next[idx] = { ...item, descEn: e.target.value };
                      setWhyUs(next);
                      markDirty("whyUs");
                    }}
                    className={ADMIN_TEXTAREA_CLS}
                  />
                </Field>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- ONGLET PROCESS --- */}
      {tab === "process" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-stone-900">
              Étapes du processus ({process.length})
            </h2>
            <button
              type="button"
              onClick={() => {
                const n = String(process.length + 1).padStart(2, "0");
                setProcess([
                  ...process,
                  {
                    num: n,
                    titleAr: "خطوة جديدة",
                    titleEn: "New step",
                    descAr: "وصف الخطوة",
                    descEn: "Step description",
                    durationAr: "يوم واحد",
                    durationEn: "1 day",
                  },
                ]);
                markDirty("process");
              }}
              className="h-9 px-3.5 rounded-xl bg-stone-900 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> Ajouter une étape
            </button>
          </div>

          {process.map((step, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3.5 shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-stone-700">
                  Étape #{step.num}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => {
                      const next = [...process];
                      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                      setProcess(next);
                      markDirty("process");
                    }}
                    className="h-8 w-8 rounded-lg border border-stone-200 bg-stone-50 grid place-items-center disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === process.length - 1}
                    onClick={() => {
                      const next = [...process];
                      [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                      setProcess(next);
                      markDirty("process");
                    }}
                    className="h-8 w-8 rounded-lg border border-stone-200 bg-stone-50 grid place-items-center disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProcess(process.filter((_, i) => i !== idx));
                      markDirty("process");
                    }}
                    className="h-8 px-2.5 rounded-lg border border-red-200 bg-red-50 text-red-600 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Supprimer
                  </button>
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-3.5">
                <Field label="Numéro affiché">
                  <input
                    value={step.num}
                    onChange={(e) => {
                      const next = [...process];
                      next[idx] = { ...step, num: e.target.value };
                      setProcess(next);
                      markDirty("process");
                    }}
                    className={ADMIN_INPUT_CLS}
                  />
                </Field>
                <Field label="Durée (arabe)">
                  <input
                    dir="rtl"
                    value={step.durationAr}
                    onChange={(e) => {
                      const next = [...process];
                      next[idx] = { ...step, durationAr: e.target.value };
                      setProcess(next);
                      markDirty("process");
                    }}
                    className={ADMIN_INPUT_CLS}
                  />
                </Field>
                <Field label="Durée (anglais)">
                  <input
                    value={step.durationEn}
                    onChange={(e) => {
                      const next = [...process];
                      next[idx] = { ...step, durationEn: e.target.value };
                      setProcess(next);
                      markDirty("process");
                    }}
                    className={ADMIN_INPUT_CLS}
                  />
                </Field>
              </div>

              <div className="grid sm:grid-cols-2 gap-3.5">
                <Field label="Titre (arabe)">
                  <input
                    dir="rtl"
                    value={step.titleAr}
                    onChange={(e) => {
                      const next = [...process];
                      next[idx] = { ...step, titleAr: e.target.value };
                      setProcess(next);
                      markDirty("process");
                    }}
                    className={ADMIN_INPUT_CLS}
                  />
                </Field>
                <Field label="Titre (anglais)">
                  <input
                    value={step.titleEn}
                    onChange={(e) => {
                      const next = [...process];
                      next[idx] = { ...step, titleEn: e.target.value };
                      setProcess(next);
                      markDirty("process");
                    }}
                    className={ADMIN_INPUT_CLS}
                  />
                </Field>
                <Field label="Description (arabe)">
                  <textarea
                    dir="rtl"
                    rows={2}
                    value={step.descAr}
                    onChange={(e) => {
                      const next = [...process];
                      next[idx] = { ...step, descAr: e.target.value };
                      setProcess(next);
                      markDirty("process");
                    }}
                    className={ADMIN_TEXTAREA_CLS}
                  />
                </Field>
                <Field label="Description (anglais)">
                  <textarea
                    rows={2}
                    value={step.descEn}
                    onChange={(e) => {
                      const next = [...process];
                      next[idx] = { ...step, descEn: e.target.value };
                      setProcess(next);
                      markDirty("process");
                    }}
                    className={ADMIN_TEXTAREA_CLS}
                  />
                </Field>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- ONGLET TESTIMONIALS --- */}
      {tab === "testimonials" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-stone-900">
              Témoignages clients ({testimonials.length})
            </h2>
            <button
              type="button"
              onClick={() => {
                setTestimonials([
                  {
                    name: "عميل جديد",
                    nameEn: "New Client",
                    role: "صاحب مشروع",
                    roleEn: "Business Owner",
                    text: "تجربة ممتازة ونتائج سريعة.",
                    textEn: "Great experience and fast results.",
                    image:
                      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80&auto=format&fit=crop&crop=face",
                    rating: 5,
                    beforeAfter: { before: "قبل الموقع", after: "بعد الموقع" },
                    beforeAfterEn: {
                      before: "Before website",
                      after: "After website",
                    },
                  },
                  ...testimonials,
                ]);
                markDirty("testimonials");
              }}
              className="h-9 px-3.5 rounded-xl bg-stone-900 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> Ajouter un avis
            </button>
          </div>

          {testimonials.map((t, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3.5 shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-stone-900">
                  {t.nameEn || t.name}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setTestimonials(testimonials.filter((_, i) => i !== idx));
                    markDirty("testimonials");
                  }}
                  className="h-8 px-2.5 rounded-lg border border-red-200 bg-red-50 text-red-600 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Supprimer
                </button>
              </div>

              <div className="grid sm:grid-cols-2 gap-3.5">
                <Field label="Nom (arabe)">
                  <input
                    dir="rtl"
                    value={t.name}
                    onChange={(e) => {
                      const next = [...testimonials];
                      next[idx] = { ...t, name: e.target.value };
                      setTestimonials(next);
                      markDirty("testimonials");
                    }}
                    className={ADMIN_INPUT_CLS}
                  />
                </Field>
                <Field label="Nom (anglais)">
                  <input
                    value={t.nameEn}
                    onChange={(e) => {
                      const next = [...testimonials];
                      next[idx] = { ...t, nameEn: e.target.value };
                      setTestimonials(next);
                      markDirty("testimonials");
                    }}
                    className={ADMIN_INPUT_CLS}
                  />
                </Field>
                <Field label="Rôle / Entreprise (arabe)">
                  <input
                    dir="rtl"
                    value={t.role}
                    onChange={(e) => {
                      const next = [...testimonials];
                      next[idx] = { ...t, role: e.target.value };
                      setTestimonials(next);
                      markDirty("testimonials");
                    }}
                    className={ADMIN_INPUT_CLS}
                  />
                </Field>
                <Field label="Rôle / Entreprise (anglais)">
                  <input
                    value={t.roleEn}
                    onChange={(e) => {
                      const next = [...testimonials];
                      next[idx] = { ...t, roleEn: e.target.value };
                      setTestimonials(next);
                      markDirty("testimonials");
                    }}
                    className={ADMIN_INPUT_CLS}
                  />
                </Field>
                <Field label="Photo (URL)">
                  <input
                    value={t.image}
                    onChange={(e) => {
                      const next = [...testimonials];
                      next[idx] = { ...t, image: e.target.value };
                      setTestimonials(next);
                      markDirty("testimonials");
                    }}
                    className={ADMIN_INPUT_CLS}
                  />
                </Field>
                <Field label="Note sur 5">
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={t.rating}
                    onChange={(e) => {
                      const next = [...testimonials];
                      next[idx] = { ...t, rating: Number(e.target.value) };
                      setTestimonials(next);
                      markDirty("testimonials");
                    }}
                    className={ADMIN_INPUT_CLS}
                  />
                </Field>
                <Field label="Témoignage (arabe)">
                  <textarea
                    dir="rtl"
                    rows={2}
                    value={t.text}
                    onChange={(e) => {
                      const next = [...testimonials];
                      next[idx] = { ...t, text: e.target.value };
                      setTestimonials(next);
                      markDirty("testimonials");
                    }}
                    className={ADMIN_TEXTAREA_CLS}
                  />
                </Field>
                <Field label="Témoignage (anglais)">
                  <textarea
                    rows={2}
                    value={t.textEn}
                    onChange={(e) => {
                      const next = [...testimonials];
                      next[idx] = { ...t, textEn: e.target.value };
                      setTestimonials(next);
                      markDirty("testimonials");
                    }}
                    className={ADMIN_TEXTAREA_CLS}
                  />
                </Field>
                <Field label="Avant / Après (arabe)">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      dir="rtl"
                      value={t.beforeAfter.before}
                      onChange={(e) => {
                        const next = [...testimonials];
                        next[idx] = {
                          ...t,
                          beforeAfter: {
                            ...t.beforeAfter,
                            before: e.target.value,
                          },
                        };
                        setTestimonials(next);
                        markDirty("testimonials");
                      }}
                      className={ADMIN_INPUT_CLS}
                    />
                    <input
                      dir="rtl"
                      value={t.beforeAfter.after}
                      onChange={(e) => {
                        const next = [...testimonials];
                        next[idx] = {
                          ...t,
                          beforeAfter: {
                            ...t.beforeAfter,
                            after: e.target.value,
                          },
                        };
                        setTestimonials(next);
                        markDirty("testimonials");
                      }}
                      className={ADMIN_INPUT_CLS}
                    />
                  </div>
                </Field>
                <Field label="Before / After (anglais)">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={t.beforeAfterEn.before}
                      onChange={(e) => {
                        const next = [...testimonials];
                        next[idx] = {
                          ...t,
                          beforeAfterEn: {
                            ...t.beforeAfterEn,
                            before: e.target.value,
                          },
                        };
                        setTestimonials(next);
                        markDirty("testimonials");
                      }}
                      className={ADMIN_INPUT_CLS}
                    />
                    <input
                      value={t.beforeAfterEn.after}
                      onChange={(e) => {
                        const next = [...testimonials];
                        next[idx] = {
                          ...t,
                          beforeAfterEn: {
                            ...t.beforeAfterEn,
                            after: e.target.value,
                          },
                        };
                        setTestimonials(next);
                        markDirty("testimonials");
                      }}
                      className={ADMIN_INPUT_CLS}
                    />
                  </div>
                </Field>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- ONGLET FAQS --- */}
      {tab === "faqs" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-stone-900">
              Questions fréquentes ({faqs.length})
            </h2>
            <button
              type="button"
              onClick={() => {
                setFaqs([
                  {
                    qAr: "سؤال جديد؟",
                    qEn: "New question?",
                    aAr: "الإجابة هنا.",
                    aEn: "Answer here.",
                  },
                  ...faqs,
                ]);
                markDirty("faqs");
              }}
              className="h-9 px-3.5 rounded-xl bg-stone-900 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> Ajouter une question
            </button>
          </div>

          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3 shadow-2xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-stone-700">
                  Question #{idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setFaqs(faqs.filter((_, i) => i !== idx));
                    markDirty("faqs");
                  }}
                  className="h-8 px-2.5 rounded-lg border border-red-200 bg-red-50 text-red-600 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Supprimer
                </button>
              </div>

              <div className="grid sm:grid-cols-2 gap-3.5">
                <Field label="Question (arabe)">
                  <input
                    dir="rtl"
                    value={faq.qAr}
                    onChange={(e) => {
                      const next = [...faqs];
                      next[idx] = { ...faq, qAr: e.target.value };
                      setFaqs(next);
                      markDirty("faqs");
                    }}
                    className={ADMIN_INPUT_CLS}
                  />
                </Field>
                <Field label="Question (anglais)">
                  <input
                    value={faq.qEn}
                    onChange={(e) => {
                      const next = [...faqs];
                      next[idx] = { ...faq, qEn: e.target.value };
                      setFaqs(next);
                      markDirty("faqs");
                    }}
                    className={ADMIN_INPUT_CLS}
                  />
                </Field>
                <Field label="Réponse (arabe)">
                  <textarea
                    dir="rtl"
                    rows={2}
                    value={faq.aAr}
                    onChange={(e) => {
                      const next = [...faqs];
                      next[idx] = { ...faq, aAr: e.target.value };
                      setFaqs(next);
                      markDirty("faqs");
                    }}
                    className={ADMIN_TEXTAREA_CLS}
                  />
                </Field>
                <Field label="Réponse (anglais)">
                  <textarea
                    rows={2}
                    value={faq.aEn}
                    onChange={(e) => {
                      const next = [...faqs];
                      next[idx] = { ...faq, aEn: e.target.value };
                      setFaqs(next);
                      markDirty("faqs");
                    }}
                    className={ADMIN_TEXTAREA_CLS}
                  />
                </Field>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- ONGLET HEADINGS --- */}
      {tab === "headings" && (
        <div className="space-y-3">
          {SECTION_HEADING_IDS.map((id) => {
            const meta = HEADING_META[id];
            const h = headings[id];
            return (
              <div
                key={id}
                className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3 shadow-2xs"
              >
                <h3 className="text-sm font-black text-stone-900">
                  {meta.label}
                </h3>
                <div className="grid sm:grid-cols-2 gap-3.5">
                  <Field label="Titre (arabe)">
                    <input
                      dir="rtl"
                      value={h.titleAr}
                      onChange={(e) => {
                        setHeadings({
                          ...headings,
                          [id]: { ...h, titleAr: e.target.value },
                        });
                        markDirty("headings");
                      }}
                      className={ADMIN_INPUT_CLS}
                    />
                  </Field>
                  <Field label="Titre (anglais)">
                    <input
                      value={h.titleEn}
                      onChange={(e) => {
                        setHeadings({
                          ...headings,
                          [id]: { ...h, titleEn: e.target.value },
                        });
                        markDirty("headings");
                      }}
                      className={ADMIN_INPUT_CLS}
                    />
                  </Field>
                  <Field label="Sous-titre (arabe)">
                    <textarea
                      dir="rtl"
                      rows={2}
                      value={h.subtitleAr}
                      onChange={(e) => {
                        setHeadings({
                          ...headings,
                          [id]: { ...h, subtitleAr: e.target.value },
                        });
                        markDirty("headings");
                      }}
                      className={ADMIN_TEXTAREA_CLS}
                    />
                  </Field>
                  <Field label="Sous-titre (anglais)">
                    <textarea
                      rows={2}
                      value={h.subtitleEn}
                      onChange={(e) => {
                        setHeadings({
                          ...headings,
                          [id]: { ...h, subtitleEn: e.target.value },
                        });
                        markDirty("headings");
                      }}
                      className={ADMIN_TEXTAREA_CLS}
                    />
                  </Field>
                  {meta.hasNote && (
                    <>
                      <Field label="Mention complémentaire (arabe)">
                        <input
                          dir="rtl"
                          value={h.noteAr ?? ""}
                          onChange={(e) => {
                            setHeadings({
                              ...headings,
                              [id]: { ...h, noteAr: e.target.value },
                            });
                            markDirty("headings");
                          }}
                          className={ADMIN_INPUT_CLS}
                        />
                      </Field>
                      <Field label="Mention complémentaire (anglais)">
                        <input
                          value={h.noteEn ?? ""}
                          onChange={(e) => {
                            setHeadings({
                              ...headings,
                              [id]: { ...h, noteEn: e.target.value },
                            });
                            markDirty("headings");
                          }}
                          className={ADMIN_INPUT_CLS}
                        />
                      </Field>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* --- ONGLET SITES (accélérateur direct) --- */}
      {tab === "demos" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-black text-stone-900">
              Sites clients ({demos.length})
            </h2>
            <button
              type="button"
              onClick={() => {
                const blank = makeBlankDemo(
                  demos.map((d) => d.slug),
                  plans,
                );
                setDemos([blank, ...demos]);
                setOpenDemoSlugs((prev) => ({ ...prev, [blank.slug]: true }));
                markDirty("demos");
              }}
              className="h-9 px-3.5 rounded-xl bg-stone-900 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> Ajouter un site
            </button>
          </div>

          {demos.map((demo, idx) => (
            <SiteItemEditor
              key={`${demo.slug}-${idx}`}
              demo={demo}
              index={idx}
              total={demos.length}
              plans={plans}
              currency={currency}
              expanded={Boolean(openDemoSlugs[demo.slug])}
              onToggleExpand={() =>
                setOpenDemoSlugs((prev) => ({
                  ...prev,
                  [demo.slug]: !prev[demo.slug],
                }))
              }
              onChange={(next) => {
                const copy = [...demos];
                copy[idx] = next;
                setDemos(copy);
                markDirty("demos");
              }}
              onMove={(delta) => {
                const target = idx + delta;
                if (target < 0 || target >= demos.length) return;
                const copy = [...demos];
                [copy[idx], copy[target]] = [copy[target], copy[idx]];
                setDemos(copy);
                markDirty("demos");
              }}
              onDelete={() => {
                if (
                  !confirm(
                    `Supprimer « ${demo.titleEn || demo.title} » ?`,
                  )
                ) {
                  return;
                }
                setDemos(demos.filter((_, i) => i !== idx));
                markDirty("demos");
              }}
              onFlash={flash}
            />
          ))}
        </div>
      )}

      {/* Barre d'enregistrement fixe */}
      <div className="fixed bottom-4 left-4 right-4 lg:left-80 lg:right-8 z-30">
        <div className="max-w-5xl mx-auto rounded-2xl border border-stone-300 bg-white/95 backdrop-blur px-4 py-3 shadow-xl flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-stone-600">
            {dirtyMap[tab] ? (
              <span className="font-bold text-[#8A6D2F]">
                ● Modifications en attente sur cet onglet.
              </span>
            ) : (
              <span>Onglet synchronisé avec le site public.</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={onReset}
              className="h-9 px-3.5 rounded-xl border border-stone-300 bg-stone-50 text-stone-600 text-xs font-semibold hover:bg-stone-100 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Valeurs par défaut
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={onSave}
              className="h-9 px-5 rounded-xl bg-stone-900 text-white text-xs sm:text-sm font-bold hover:bg-stone-800 inline-flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-xs"
            >
              <Check className="h-4 w-4 text-[#E5CA87]" />
              {pending ? "Enregistrement…" : "Enregistrer l’onglet"}
            </button>
          </div>
        </div>
      </div>
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
