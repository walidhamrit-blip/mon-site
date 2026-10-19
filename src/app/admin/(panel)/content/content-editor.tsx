"use client";
import { useState } from "react";
import type {
  Demo,
  Faq,
  HeroContent,
  PricingPlanData,
  ProcessStep,
  RibbonContent,
  SectionHeading,
  SectionHeadingId,
  SiteContent,
  Testimonial,
  WhyUsItem,
} from "@/lib/site-types";
import { resetContentSection, saveContentSection } from "@/app/admin/actions";
import { sectors } from "@/lib/content";
import { formatLyd, resolveDemoClassification } from "@/lib/classification";
import { formatUsd } from "@/lib/installments";
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Save,
  RotateCcw,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

type Tab =
  | "hero"
  | "ribbon"
  | "whyUs"
  | "demos"
  | "process"
  | "testimonials"
  | "faqs"
  | "headings";

const tabs: { id: Tab; label: string }[] = [
  { id: "hero", label: "Accueil (Hero)" },
  { id: "ribbon", label: "Bandeau services" },
  { id: "whyUs", label: "Pourquoi nous" },
  { id: "demos", label: "Démos" },
  { id: "process", label: "Processus" },
  { id: "testimonials", label: "Témoignages" },
  { id: "faqs", label: "FAQ" },
  { id: "headings", label: "Titres des sections" },
];

/** Sections dont les titres/sous-titres sont éditables. */
const headingFields: {
  id: SectionHeadingId;
  label: string;
  description: string;
  withNote?: boolean;
}[] = [
  { id: "why", label: "Pourquoi nous", description: "Section « Pourquoi nous ? »" },
  { id: "demos", label: "Galerie de démos", description: "Section des sites en démonstration" },
  {
    id: "identityCustomizer",
    label: "Studio d'identité — personnalisation",
    description: "Bannière de personnalisation en direct",
  },
  {
    id: "identityThemes",
    label: "Studio d'identité — thèmes",
    description: "Galerie des thèmes prêts à l'emploi",
  },
  {
    id: "process",
    label: "Processus",
    description: "Étapes de la méthode de travail",
    withNote: true,
  },
  {
    id: "pricing",
    label: "Tarifs",
    description: "Formules et prix",
    withNote: true,
  },
  {
    id: "flexPay",
    label: "Paiement flexible",
    description: "Section « payez ce que vous voulez »",
  },
  {
    id: "services",
    label: "Services à la carte",
    description: "Petites missions vendues au forfait",
  },
  {
    id: "testimonials",
    label: "Témoignages",
    description: "Avis des clients",
  },
  { id: "faq", label: "FAQ", description: "Questions fréquentes" },
  {
    id: "cta",
    label: "Appel à l'action",
    description: "Formulaire de demande final",
    withNote: true,
  },
];

/* ---------- éléments d'interface ---------- */

function Field({
  label,
  value,
  onChange,
  dir,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  dir?: "ltr" | "rtl";
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-zinc-400">{label}</span>
      <input
        value={value}
        dir={dir}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 h-10 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-white outline-none focus:border-[#C6A664] transition-colors"
      />
    </label>
  );
}

function Area({
  label,
  value,
  onChange,
  dir,
  rows = 3,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  dir?: "ltr" | "rtl";
  rows?: number;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-zinc-400">
        {label} {hint && <span className="text-zinc-600">{hint}</span>}
      </span>
      <textarea
        rows={rows}
        dir={dir}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 p-3 text-sm text-white outline-none focus:border-[#C6A664] resize-y leading-6"
      />
    </label>
  );
}

function Lines({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-zinc-400">
        {label} <span className="text-zinc-600">(un par ligne)</span>
      </span>
      <textarea
        rows={rows}
        dir="auto"
        value={value.join("\n")}
        onChange={(e) => onChange(e.target.value.split("\n"))}
        className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 p-3 text-sm text-white outline-none focus:border-[#C6A664] resize-y leading-6"
      />
    </label>
  );
}

/**
 * Champ SEO avec compteur de caractères et signal de la zone d'affichage
 * Google (vert = optimal, ambre = à vérifier, rouge = trop long).
 * Une valeur vide déclenche le fallback automatique côté page publique.
 */
function SeoField({
  label,
  value,
  onChange,
  max,
  rows = 2,
  placeholder,
  dir = "rtl",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max: number;
  rows?: number;
  placeholder?: string;
  dir?: "ltr" | "rtl";
}) {
  const len = value.length;
  const tone =
    len === 0
      ? "text-zinc-500"
      : len <= max
        ? "text-emerald-400"
        : "text-red-400";
  return (
    <label className="block">
      <span className="flex items-center justify-between gap-2 text-xs font-semibold text-zinc-400">
        <span>{label}</span>
        <span className={`font-mono ${tone}`}>
          {len}/{max}
        </span>
      </span>
      <textarea
        rows={rows}
        dir={dir}
        value={value}
        maxLength={max + 30}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 p-3 text-sm text-white outline-none focus:border-[#C6A664] resize-y leading-6"
      />
    </label>
  );
}

function ItemCard({
  title,
  subtitle,
  index,
  count,
  onMove,
  onDelete,
  children,
}: {
  title: string;
  subtitle?: string;
  index: number;
  count: number;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="h-7 w-7 rounded-lg bg-white/5 border border-white/10 text-zinc-400 text-xs font-black grid place-items-center flex-shrink-0">
            {index + 1}
          </span>
          <div className="min-w-0">
            <div className="font-bold text-white truncate">{title}</div>
            {subtitle && <div className="text-xs text-zinc-600 truncate">{subtitle}</div>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            className="h-8 w-8 rounded-lg border border-white/10 text-zinc-400 hover:text-white grid place-items-center disabled:opacity-30 cursor-pointer"
            aria-label="Monter"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === count - 1}
            className="h-8 w-8 rounded-lg border border-white/10 text-zinc-400 hover:text-white grid place-items-center disabled:opacity-30 cursor-pointer"
            aria-label="Descendre"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="h-8 w-8 rounded-lg border border-white/10 text-zinc-500 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10 grid place-items-center transition-colors cursor-pointer"
            aria-label="Supprimer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-black/30 p-5">
      <h2 className="font-black text-white">{title}</h2>
      {description && (
        <p className="mt-1 text-xs text-zinc-500 leading-5">{description}</p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/* ---------- éditeur ---------- */

function newDemo(existing: Demo[], plans: PricingPlanData[]): Demo {
  let slug = `nouveau-projet-${Date.now().toString(36)}`;
  while (existing.some((d) => d.slug === slug)) slug = `${slug}-2`;
  return {
    slug,
    planId: plans[0]?.id ?? "vitrine",
    categoryTier: 1,
    priceUsd: null,
    sector: "other",
    sectorAr: "قطاع جديد",
    sectorEn: "New sector",
    title: "Nouveau projet",
    titleEn: "New project",
    description: "Description du démonstrateur…",
    descriptionEn: "Demo description…",
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80&auto=format&fit=crop",
    color: "#C6A664",
    features: ["Fonctionnalité 1", "Fonctionnalité 2"],
    featuresEn: ["Feature 1", "Feature 2"],
    previewUrl: "#",
  };
}

function newTestimonial(): Testimonial {
  return {
    name: "Nom du client",
    nameEn: "Client name",
    role: "Entreprise — ville",
    roleEn: "Company — city",
    text: "Témoignage…",
    textEn: "Testimonial…",
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&q=80&auto=format&fit=crop&crop=face",
    rating: 5,
    beforeAfter: { before: "Avant", after: "Après" },
    beforeAfterEn: { before: "Before", after: "After" },
  };
}

function newFaq(): Faq {
  return {
    qAr: "سؤال جديد؟",
    qEn: "New question?",
    aAr: "الجواب…",
    aEn: "Answer…",
  };
}

function newWhyUs(): WhyUsItem {
  return {
    icon: "zap",
    titleAr: "ميزة جديدة",
    titleEn: "New advantage",
    descAr: "وصف الميزة…",
    descEn: "Advantage description…",
  };
}

function newProcess(index: number): ProcessStep {
  return {
    num: String(index + 1).padStart(2, "0"),
    titleAr: "خطوة جديدة",
    titleEn: "New step",
    descAr: "وصف الخطوة…",
    descEn: "Step description…",
    durationAr: "يوم واحد",
    durationEn: "1 day",
  };
}

function moveItem<T>(list: T[], index: number, dir: -1 | 1): T[] {
  const target = index + dir;
  if (target < 0 || target >= list.length) return list;
  const copy = [...list];
  [copy[index], copy[target]] = [copy[target], copy[index]];
  return copy;
}

export function ContentEditor({
  initial,
  plans,
}: {
  initial: SiteContent;
  plans: PricingPlanData[];
}) {
  const [tab, setTab] = useState<Tab>("demos");
  const [draft, setDraft] = useState<SiteContent>(() => structuredClone(initial));
  const [busy, setBusy] = useState<"" | Tab | "reset">("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const setHero = (patch: Partial<HeroContent>) =>
    setDraft((d) => ({ ...d, hero: { ...d.hero, ...patch } }));

  const setRibbon = (patch: Partial<RibbonContent>) =>
    setDraft((d) => ({ ...d, ribbon: { ...d.ribbon, ...patch } }));

  const setRibbonItem = (i: number, patch: Partial<RibbonContent["items"][number]>) =>
    setDraft((d) => ({
      ...d,
      ribbon: {
        ...d.ribbon,
        items: d.ribbon.items.map((item, j) =>
          j === i ? { ...item, ...patch } : item,
        ),
      },
    }));

  const setWhyUs = (i: number, patch: Partial<WhyUsItem>) =>
    setDraft((d) => ({
      ...d,
      whyUs: d.whyUs.map((item, j) => (j === i ? { ...item, ...patch } : item)),
    }));

  const setProcess = (i: number, patch: Partial<ProcessStep>) =>
    setDraft((d) => ({
      ...d,
      process: d.process.map((item, j) => (j === i ? { ...item, ...patch } : item)),
    }));

  const setHeading = (id: SectionHeadingId, patch: Partial<SectionHeading>) =>
    setDraft((d) => ({
      ...d,
      headings: { ...d.headings, [id]: { ...d.headings[id], ...patch } },
    }));

  const setDemo = (i: number, patch: Partial<Demo>) =>
    setDraft((d) => ({ ...d, demos: d.demos.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  const setFaq = (i: number, patch: Partial<Faq>) =>
    setDraft((d) => ({ ...d, faqs: d.faqs.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  const setTestimonial = (i: number, patch: Partial<Testimonial>) =>
    setDraft((d) => ({
      ...d,
      testimonials: d.testimonials.map((x, j) => (j === i ? { ...x, ...patch } : x)),
    }));

  const onDelete = (
    kind: "demos" | "faqs" | "testimonials" | "whyUs" | "process",
    index: number,
  ) => {
    const lists = {
      demos: draft.demos,
      faqs: draft.faqs,
      testimonials: draft.testimonials,
      whyUs: draft.whyUs,
      process: draft.process,
    };
    if (
      (kind === "demos" || kind === "whyUs" || kind === "process") &&
      lists[kind].length <= 1
    ) {
      alert("Il doit rester au moins un élément dans cette section.");
      return;
    }
    setDraft((d) => {
      switch (kind) {
        case "demos":
          return { ...d, demos: d.demos.filter((_, j) => j !== index) };
        case "faqs":
          return { ...d, faqs: d.faqs.filter((_, j) => j !== index) };
        case "testimonials":
          return { ...d, testimonials: d.testimonials.filter((_, j) => j !== index) };
        case "whyUs":
          return { ...d, whyUs: d.whyUs.filter((_, j) => j !== index) };
        case "process":
          return { ...d, process: d.process.filter((_, j) => j !== index) };
      }
    });
  };

  const onMove = (
    kind: "demos" | "faqs" | "testimonials" | "whyUs" | "process",
    index: number,
    dir: -1 | 1,
  ) =>
    setDraft((d) => {
      switch (kind) {
        case "demos":
          return { ...d, demos: moveItem(d.demos, index, dir) };
        case "faqs":
          return { ...d, faqs: moveItem(d.faqs, index, dir) };
        case "testimonials":
          return { ...d, testimonials: moveItem(d.testimonials, index, dir) };
        case "whyUs":
          return { ...d, whyUs: moveItem(d.whyUs, index, dir) };
        case "process":
          return { ...d, process: moveItem(d.process, index, dir) };
      }
    });

  const buildPayload = () => {
    const clean = (list: string[]) => list.map((s) => s.trim()).filter(Boolean);
    switch (tab) {
      case "hero":
        return {
          ...draft.hero,
          chipsAr: clean(draft.hero.chipsAr),
          chipsEn: clean(draft.hero.chipsEn),
        };
      case "ribbon": {
        const items = draft.ribbon.items
          .map((item) => ({ ar: item.ar.trim(), en: item.en.trim() }))
          .filter((item) => item.ar || item.en);
        return { ...draft.ribbon, items };
      }
      case "whyUs":
        return draft.whyUs;
      case "process":
        return draft.process;
      case "headings":
        return draft.headings;
      case "demos":
        return draft.demos.map((d) => ({
          ...d,
          slug: d.slug.trim(),
          features: clean(d.features),
          featuresEn: clean(d.featuresEn),
        }));
      case "faqs":
        return draft.faqs;
      case "testimonials":
        return draft.testimonials;
    }
  };

  const onSave = async () => {
    setBusy(tab);
    setMsg(null);
    const res = await saveContentSection(tab, buildPayload());
    setBusy("");
    setMsg(
      res.ok
        ? { kind: "ok", text: res.message ?? "Enregistré." }
        : { kind: "err", text: res.error ?? "Erreur inconnue." },
    );
  };

  const onReset = async () => {
    if (
      !confirm(
        `Réinitialiser « ${tabs.find((t) => t.id === tab)?.label} » aux valeurs par défaut du code ?`,
      )
    ) {
      return;
    }
    setBusy("reset");
    setMsg(null);
    const res = await resetContentSection(tab);
    setBusy("");
    if (res.ok) window.location.reload();
    else setMsg({ kind: "err", text: res.error ?? "Erreur inconnue." });
  };

  const sectorOptions = sectors.filter((s) => s.id !== "all");

  const tabCount = (id: Tab): number | null => {
    switch (id) {
      case "ribbon":
        return draft.ribbon.items.length;
      case "whyUs":
        return draft.whyUs.length;
      case "demos":
        return draft.demos.length;
      case "process":
        return draft.process.length;
      case "testimonials":
        return draft.testimonials.length;
      case "faqs":
        return draft.faqs.length;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-5">
      {/* Onglets */}
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setMsg(null);
            }}
            className={`h-10 px-5 rounded-full text-sm font-bold border transition-colors cursor-pointer ${
              tab === t.id
                ? "bg-[#C6A664]/15 border-[#C6A664]/40 text-[#E8D5A9]"
                : "bg-white/5 border-white/10 text-zinc-400 hover:text-white"
            }`}
          >
            {t.label}
            {tab === t.id && tabCount(t.id) !== null && (
              <span className="ms-2 text-xs opacity-60">{tabCount(t.id)}</span>
            )}
          </button>
        ))}
      </div>

      {/* ---------- ACCUEIL (HERO) ---------- */}
      {tab === "hero" && (
        <div className="space-y-4">
          <Panel
            title="Bloc d'accueil"
            description="Le premier écran du site : badge, grand titre, sous-titre et boutons. Chaque texte existe en arabe et en anglais."
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <Field
                label="Badge (arabe)"
                dir="rtl"
                value={draft.hero.badgeAr}
                onChange={(v) => setHero({ badgeAr: v })}
              />
              <Field
                label="Badge (anglais)"
                dir="ltr"
                value={draft.hero.badgeEn}
                onChange={(v) => setHero({ badgeEn: v })}
              />
              <Field
                label="Titre — ligne 1 (arabe)"
                dir="rtl"
                value={draft.hero.title1Ar}
                onChange={(v) => setHero({ title1Ar: v })}
              />
              <Field
                label="Titre — ligne 1 (anglais)"
                dir="ltr"
                value={draft.hero.title1En}
                onChange={(v) => setHero({ title1En: v })}
              />
              <Field
                label="Titre — ligne 2 (arabe)"
                dir="rtl"
                value={draft.hero.title2Ar}
                onChange={(v) => setHero({ title2Ar: v })}
              />
              <Field
                label="Titre — ligne 2 (anglais)"
                dir="ltr"
                value={draft.hero.title2En}
                onChange={(v) => setHero({ title2En: v })}
              />
              <Field
                label="Titre — ligne 3, en italique (arabe)"
                dir="rtl"
                value={draft.hero.title3Ar}
                onChange={(v) => setHero({ title3Ar: v })}
              />
              <Field
                label="Titre — ligne 3, en italique (anglais)"
                dir="ltr"
                value={draft.hero.title3En}
                onChange={(v) => setHero({ title3En: v })}
              />
            </div>
            <div className="mt-4 grid lg:grid-cols-2 gap-4">
              <Area
                label="Sous-titre (arabe)"
                dir="rtl"
                value={draft.hero.subtitleAr}
                onChange={(v) => setHero({ subtitleAr: v })}
              />
              <Area
                label="Sous-titre (anglais)"
                dir="ltr"
                value={draft.hero.subtitleEn}
                onChange={(v) => setHero({ subtitleEn: v })}
              />
            </div>
          </Panel>

          <Panel
            title="Boutons & réassurance"
            description="Libellés des deux boutons, preuve sociale et petites pastilles affichées sous le titre."
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <Field
                label="Bouton principal (arabe)"
                dir="rtl"
                value={draft.hero.ctaPrimaryAr}
                onChange={(v) => setHero({ ctaPrimaryAr: v })}
              />
              <Field
                label="Bouton principal (anglais)"
                dir="ltr"
                value={draft.hero.ctaPrimaryEn}
                onChange={(v) => setHero({ ctaPrimaryEn: v })}
              />
              <Field
                label="Bouton secondaire (arabe)"
                dir="rtl"
                value={draft.hero.ctaSecondaryAr}
                onChange={(v) => setHero({ ctaSecondaryAr: v })}
              />
              <Field
                label="Bouton secondaire (anglais)"
                dir="ltr"
                value={draft.hero.ctaSecondaryEn}
                onChange={(v) => setHero({ ctaSecondaryEn: v })}
              />
              <Field
                label="Preuve sociale (arabe)"
                dir="rtl"
                value={draft.hero.trustedAr}
                onChange={(v) => setHero({ trustedAr: v })}
              />
              <Field
                label="Preuve sociale (anglais)"
                dir="ltr"
                value={draft.hero.trustedEn}
                onChange={(v) => setHero({ trustedEn: v })}
              />
              <Field
                label="Note / étoiles (arabe)"
                dir="rtl"
                value={draft.hero.ratingAr}
                onChange={(v) => setHero({ ratingAr: v })}
              />
              <Field
                label="Note / étoiles (anglais)"
                dir="ltr"
                value={draft.hero.ratingEn}
                onChange={(v) => setHero({ ratingEn: v })}
              />
            </div>
            <div className="mt-4 grid lg:grid-cols-2 gap-4">
              <Lines
                label="Pastilles de réassurance (arabe)"
                value={draft.hero.chipsAr}
                onChange={(v) => setHero({ chipsAr: v })}
              />
              <Lines
                label="Pastilles de réassurance (anglais)"
                value={draft.hero.chipsEn}
                onChange={(v) => setHero({ chipsEn: v })}
              />
            </div>
          </Panel>
        </div>
      )}

      {/* ---------- BANDEAU DE SERVICES ---------- */}
      {tab === "ribbon" && (
        <div className="space-y-4">
          <Panel
            title="Bandeau défilant"
            description="Le ruban de services qui défile sous le bloc d'accueil. Ajoutez, modifiez ou supprimez les éléments."
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <Field
                label="Accroche (arabe)"
                dir="rtl"
                value={draft.ribbon.taglineAr}
                onChange={(v) => setRibbon({ taglineAr: v })}
              />
              <Field
                label="Accroche (anglais)"
                dir="ltr"
                value={draft.ribbon.taglineEn}
                onChange={(v) => setRibbon({ taglineEn: v })}
              />
            </div>

            <div className="mt-4 space-y-3">
              {draft.ribbon.items.map((item, i) => (
                <div
                  key={i}
                  className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end rounded-2xl border border-white/10 bg-black/20 p-3"
                >
                  <Field
                    label={`Élément ${i + 1} (arabe)`}
                    dir="rtl"
                    value={item.ar}
                    onChange={(v) => setRibbonItem(i, { ar: v })}
                  />
                  <Field
                    label={`Élément ${i + 1} (anglais)`}
                    dir="ltr"
                    value={item.en}
                    onChange={(v) => setRibbonItem(i, { en: v })}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setRibbon({ items: draft.ribbon.items.filter((_, j) => j !== i) })
                    }
                    disabled={draft.ribbon.items.length <= 1}
                    className="h-10 w-10 rounded-xl border border-white/10 text-zinc-500 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10 grid place-items-center transition-colors cursor-pointer disabled:opacity-30"
                    aria-label="Supprimer l'élément"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                setRibbon({ items: [...draft.ribbon.items, { ar: "", en: "" }] })
              }
              className="mt-4 h-11 px-5 rounded-2xl border border-dashed border-white/20 text-sm font-bold text-zinc-400 hover:text-white hover:border-[#C6A664]/50 inline-flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Ajouter un élément
            </button>
          </Panel>
        </div>
      )}

      {/* ---------- POURQUOI NOUS ---------- */}
      {tab === "whyUs" && (
        <div className="space-y-4">
          {draft.whyUs.map((item, i) => (
            <ItemCard
              key={i}
              index={i}
              count={draft.whyUs.length}
              title={item.titleEn || item.titleAr}
              subtitle={item.icon}
              onMove={(dir) => onMove("whyUs", i, dir)}
              onDelete={() => onDelete("whyUs", i)}
            >
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <label className="block">
                  <span className="text-xs font-semibold text-zinc-400">Icône</span>
                  <select
                    value={item.icon}
                    onChange={(e) => setWhyUs(i, { icon: e.target.value })}
                    className="mt-1.5 h-10 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-white outline-none focus:border-[#C6A664] cursor-pointer"
                  >
                    {["zap", "palette", "sliders", "search", "headset"].map((icon) => (
                      <option key={icon} value={icon}>
                        {icon}
                      </option>
                    ))}
                  </select>
                </label>
                <Field
                  label="Titre (arabe)"
                  dir="rtl"
                  value={item.titleAr}
                  onChange={(v) => setWhyUs(i, { titleAr: v })}
                />
                <Field
                  label="Titre (anglais)"
                  dir="ltr"
                  value={item.titleEn}
                  onChange={(v) => setWhyUs(i, { titleEn: v })}
                />
              </div>
              <div className="mt-4 grid lg:grid-cols-2 gap-4">
                <Area
                  label="Description (arabe)"
                  dir="rtl"
                  value={item.descAr}
                  onChange={(v) => setWhyUs(i, { descAr: v })}
                />
                <Area
                  label="Description (anglais)"
                  dir="ltr"
                  value={item.descEn}
                  onChange={(v) => setWhyUs(i, { descEn: v })}
                />
              </div>
            </ItemCard>
          ))}
          <button
            type="button"
            onClick={() => setDraft((d) => ({ ...d, whyUs: [...d.whyUs, newWhyUs()] }))}
            className="h-11 px-5 rounded-2xl border border-dashed border-white/20 text-sm font-bold text-zinc-400 hover:text-white hover:border-[#C6A664]/50 inline-flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Ajouter une carte
          </button>
        </div>
      )}

      {/* ---------- PROCESSUS ---------- */}
      {tab === "process" && (
        <div className="space-y-4">
          {draft.process.map((step, i) => (
            <ItemCard
              key={i}
              index={i}
              count={draft.process.length}
              title={step.titleEn || step.titleAr}
              subtitle={`Étape ${step.num} — ${step.durationEn}`}
              onMove={(dir) => onMove("process", i, dir)}
              onDelete={() => onDelete("process", i)}
            >
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Field
                  label="Numéro affiché"
                  dir="ltr"
                  value={step.num}
                  placeholder="01"
                  onChange={(v) => setProcess(i, { num: v })}
                />
                <Field
                  label="Titre (arabe)"
                  dir="rtl"
                  value={step.titleAr}
                  onChange={(v) => setProcess(i, { titleAr: v })}
                />
                <Field
                  label="Titre (anglais)"
                  dir="ltr"
                  value={step.titleEn}
                  onChange={(v) => setProcess(i, { titleEn: v })}
                />
                <Field
                  label="Durée (arabe)"
                  dir="rtl"
                  value={step.durationAr}
                  onChange={(v) => setProcess(i, { durationAr: v })}
                />
                <Field
                  label="Durée (anglais)"
                  dir="ltr"
                  value={step.durationEn}
                  onChange={(v) => setProcess(i, { durationEn: v })}
                />
              </div>
              <div className="mt-4 grid lg:grid-cols-2 gap-4">
                <Area
                  label="Description (arabe)"
                  dir="rtl"
                  value={step.descAr}
                  onChange={(v) => setProcess(i, { descAr: v })}
                />
                <Area
                  label="Description (anglais)"
                  dir="ltr"
                  value={step.descEn}
                  onChange={(v) => setProcess(i, { descEn: v })}
                />
              </div>
            </ItemCard>
          ))}
          <button
            type="button"
            onClick={() =>
              setDraft((d) => ({
                ...d,
                process: [...d.process, newProcess(d.process.length)],
              }))
            }
            className="h-11 px-5 rounded-2xl border border-dashed border-white/20 text-sm font-bold text-zinc-400 hover:text-white hover:border-[#C6A664]/50 inline-flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Ajouter une étape
          </button>
        </div>
      )}

      {/* ---------- TITRES DES SECTIONS ---------- */}
      {tab === "headings" && (
        <div className="space-y-4">
          <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs leading-5 text-zinc-400">
            Modifiez ici les titres, sous-titres et notes de chaque section du site.
            Les contenus (démos, témoignages, FAQ, étapes…) se règlent dans leurs
            onglets respectifs.
          </p>
          {headingFields.map(({ id, label, description, withNote }) => {
            const value = draft.headings[id];
            return (
              <Panel key={id} title={label} description={description}>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field
                    label="Titre (arabe)"
                    dir="rtl"
                    value={value.titleAr}
                    onChange={(v) => setHeading(id, { titleAr: v })}
                  />
                  <Field
                    label="Titre (anglais)"
                    dir="ltr"
                    value={value.titleEn}
                    onChange={(v) => setHeading(id, { titleEn: v })}
                  />
                </div>
                <div className="mt-4 grid lg:grid-cols-2 gap-4">
                  <Area
                    label="Sous-titre (arabe)"
                    dir="rtl"
                    value={value.subtitleAr}
                    onChange={(v) => setHeading(id, { subtitleAr: v })}
                  />
                  <Area
                    label="Sous-titre (anglais)"
                    dir="ltr"
                    value={value.subtitleEn}
                    onChange={(v) => setHeading(id, { subtitleEn: v })}
                  />
                </div>
                {withNote && (
                  <div className="mt-4 grid sm:grid-cols-2 gap-4">
                    <Field
                      label="Note (arabe)"
                      dir="rtl"
                      value={value.noteAr ?? ""}
                      onChange={(v) => setHeading(id, { noteAr: v })}
                    />
                    <Field
                      label="Note (anglais)"
                      dir="ltr"
                      value={value.noteEn ?? ""}
                      onChange={(v) => setHeading(id, { noteEn: v })}
                    />
                  </div>
                )}
              </Panel>
            );
          })}
        </div>
      )}

      {/* ---------- DÉMOS ---------- */}
      {tab === "demos" && (
        <div className="space-y-4">
          <datalist id="sector-ids">
            {sectorOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.labelEn}
              </option>
            ))}
          </datalist>
          {draft.demos.map((demo, i) => {
            const preview = resolveDemoClassification(demo, plans);
            return (
            <ItemCard
              key={i}
              index={i}
              count={draft.demos.length}
              title={demo.titleEn || demo.title}
              subtitle={
                preview
                  ? `/${demo.slug} — Catégorie ${preview.tier} · ${preview.nameEn} · ${
                      preview.priceUsd != null
                        ? `$${formatUsd(preview.priceUsd)}`
                        : `${formatLyd(preview.priceLyd)} LYD`
                    }`
                  : `/${demo.slug} — ${demo.sector}`
              }
              onMove={(dir) => onMove("demos", i, dir)}
              onDelete={() => onDelete("demos", i)}
            >
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Field label="Titre (arabe)" dir="rtl" value={demo.title} onChange={(v) => setDemo(i, { title: v })} />
                <Field label="Titre (latin)" dir="ltr" value={demo.titleEn} onChange={(v) => setDemo(i, { titleEn: v })} />
                <Field label="Slug (URL)" dir="ltr" value={demo.slug} placeholder="mon-projet" onChange={(v) => setDemo(i, { slug: v.toLowerCase().replace(/\s+/g, "-") })} />
                <label className="block">
                  <span className="text-xs font-semibold text-zinc-400">Identifiant secteur</span>
                  <input
                    list="sector-ids"
                    value={demo.sector}
                    dir="ltr"
                    onChange={(e) => setDemo(i, { sector: e.target.value })}
                    className="mt-1.5 h-10 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-white outline-none focus:border-[#C6A664]"
                  />
                </label>
                <Field label="Libellé secteur (arabe)" dir="rtl" value={demo.sectorAr} onChange={(v) => setDemo(i, { sectorAr: v })} />
                <Field label="Libellé secteur (latin)" dir="ltr" value={demo.sectorEn} onChange={(v) => setDemo(i, { sectorEn: v })} />
                <Field label="Image (URL)" dir="ltr" value={demo.image} onChange={(v) => setDemo(i, { image: v })} />
                <label className="block">
                  <span className="text-xs font-semibold text-zinc-400">Couleur</span>
                  <div className="mt-1.5 flex gap-2">
                    <input
                      type="color"
                      value={/^#[0-9a-fA-F]{6}$/.test(demo.color) ? demo.color : "#C6A664"}
                      onChange={(e) => setDemo(i, { color: e.target.value })}
                      className="h-10 w-12 rounded-xl border border-white/10 bg-black/40 cursor-pointer p-1"
                    />
                    <input
                      value={demo.color}
                      dir="ltr"
                      onChange={(e) => setDemo(i, { color: e.target.value })}
                      className="h-10 flex-1 min-w-0 rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-white outline-none focus:border-[#C6A664]"
                    />
                  </div>
                </label>
                <Field
                  label="URL du site réel (https://… pour visite interactive en direct, ou #)"
                  dir="ltr"
                  placeholder="https://mon-site-client.vercel.app/"
                  value={demo.previewUrl}
                  onChange={(v) => setDemo(i, { previewUrl: v })}
                />
              </div>
              {(() => {
                const classification = resolveDemoClassification(demo, plans);
                const planIndex = plans.findIndex((plan) => plan.id === demo.planId);
                // Une formule supprimée ou renommée ne doit pas laisser le
                // sélecteur vide : on retombe sur la catégorie du projet.
                const effectivePlanId =
                  planIndex >= 0
                    ? (demo.planId as string)
                    : (plans[Math.min(plans.length - 1, Math.max(0, (demo.categoryTier ?? 1) - 1))]
                        ?.id ?? plans[0]?.id ?? "");
                return (
                  <div className="mt-4 rounded-2xl border border-[#C6A664]/25 bg-[#C6A664]/5 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-[#E8D5A9]">
                          Classification &amp; prix du site
                        </div>
                        <p className="mt-0.5 text-[11px] text-zinc-500">
                          La catégorie suit la formule choisie ; le prix reprend son
                          prix USD, sauf prix personnalisé ci-dessous.
                        </p>
                      </div>
                      {classification && (
                        <span className="rounded-full border border-[#C6A664]/30 bg-black/30 px-3 py-1 text-[11px] font-bold text-[#E8D5A9]">
                          Catégorie {classification.tier} · {classification.nameEn} ·{" "}
                          {classification.priceUsd != null
                            ? `$${formatUsd(classification.priceUsd)}`
                            : "—"}{" "}
                          / {formatLyd(classification.priceLyd)} LYD
                        </span>
                      )}
                    </div>
                    <div className="mt-4 grid sm:grid-cols-3 gap-4">
                      <label className="block">
                        <span className="text-xs font-semibold text-zinc-400">
                          Formule / catégorie
                        </span>
                        <select
                          value={effectivePlanId}
                          onChange={(event) => {
                            const index = plans.findIndex(
                              (plan) => plan.id === event.target.value,
                            );
                            setDemo(i, {
                              planId: event.target.value,
                              ...(index >= 0 ? { categoryTier: index + 1 } : {}),
                            });
                          }}
                          className="mt-1.5 h-10 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-white outline-none focus:border-[#C6A664] cursor-pointer"
                        >
                          {plans.map((plan, index) => (
                            <option key={plan.id} value={plan.id}>
                              Catégorie {index + 1} — {plan.nameEn}
                              {plan.priceUsd ? ` ($${formatUsd(plan.priceUsd)})` : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold text-zinc-400">
                          Numéro de catégorie
                        </span>
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={
                            demo.categoryTier ??
                            (planIndex >= 0 ? planIndex + 1 : 1)
                          }
                          onChange={(event) => {
                            const value = Number(event.target.value);
                            setDemo(i, {
                              categoryTier:
                                Number.isFinite(value) && value >= 1
                                  ? Math.floor(value)
                                  : undefined,
                            });
                          }}
                          className="mt-1.5 h-10 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-white outline-none focus:border-[#C6A664]"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold text-zinc-400">
                          Prix USD du projet{" "}
                          <span className="text-zinc-600">(vide = prix catégorie)</span>
                        </span>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={demo.priceUsd ?? ""}
                          placeholder={
                            plans.find((plan) => plan.id === demo.planId)?.priceUsd != null
                              ? String(plans.find((plan) => plan.id === demo.planId)?.priceUsd)
                              : "prix de la catégorie"
                          }
                          onChange={(event) => {
                            if (event.target.value === "") {
                              setDemo(i, { priceUsd: null });
                              return;
                            }
                            const value = Number(event.target.value);
                            setDemo(i, {
                              priceUsd: Number.isFinite(value) ? value : null,
                            });
                          }}
                          className="mt-1.5 h-10 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-white outline-none focus:border-[#C6A664]"
                        />
                      </label>
                    </div>
                  </div>
                );
              })()}

              <div className="mt-4 grid lg:grid-cols-2 gap-4">
                <Area label="Description (arabe)" dir="rtl" value={demo.description} onChange={(v) => setDemo(i, { description: v })} />
                <Area label="Description (anglaise)" dir="ltr" value={demo.descriptionEn} onChange={(v) => setDemo(i, { descriptionEn: v })} />
                <Lines label="Points forts (arabe)" value={demo.features} onChange={(v) => setDemo(i, { features: v })} />
                <Lines label="Points forts (anglais)" value={demo.featuresEn} onChange={(v) => setDemo(i, { featuresEn: v })} />
              </div>

              <div className="mt-4 rounded-2xl border border-sky-400/25 bg-sky-400/5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-sky-300">
                      Référencement Google &amp; IA (SEO)
                    </div>
                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      Champs optionnels. Laissez vide pour utiliser
                      automatiquement le titre et la description du projet.
                    </p>
                  </div>
                  <span className="rounded-full border border-sky-400/30 bg-black/30 px-3 py-1 text-[11px] font-bold text-sky-300">
                    /{demo.slug}
                  </span>
                </div>
                <div className="mt-4 grid lg:grid-cols-2 gap-4">
                  <SeoField
                    label="Titre SEO (balise title, ≤ 60 recommandé)"
                    max={60}
                    rows={2}
                    dir="rtl"
                    value={demo.metaTitle ?? ""}
                    placeholder={`${demo.title} — معرض موقع حي من نخبة`}
                    onChange={(v) => setDemo(i, { metaTitle: v })}
                  />
                  <SeoField
                    label="Description SEO (meta description, ≤ 160 recommandé)"
                    max={160}
                    rows={3}
                    dir="rtl"
                    value={demo.metaDescription ?? ""}
                    placeholder={demo.description}
                    onChange={(v) => setDemo(i, { metaDescription: v })}
                  />
                </div>
              </div>
            </ItemCard>
            );
          })}
          <button
            type="button"
            onClick={() =>
              setDraft((d) => ({ ...d, demos: [...d.demos, newDemo(d.demos, plans)] }))
            }
            className="h-11 px-5 rounded-2xl border border-dashed border-white/20 text-sm font-bold text-zinc-400 hover:text-white hover:border-[#C6A664]/50 inline-flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Ajouter une démo
          </button>
        </div>
      )}

      {/* ---------- TÉMOIGNAGES ---------- */}
      {tab === "testimonials" && (
        <div className="space-y-4">
          {draft.testimonials.map((item, i) => (
            <ItemCard
              key={i}
              index={i}
              count={draft.testimonials.length}
              title={item.nameEn || item.name}
              subtitle={item.roleEn}
              onMove={(dir) => onMove("testimonials", i, dir)}
              onDelete={() => onDelete("testimonials", i)}
            >
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Field label="Nom (arabe)" dir="rtl" value={item.name} onChange={(v) => setTestimonial(i, { name: v })} />
                <Field label="Nom (latin)" dir="ltr" value={item.nameEn} onChange={(v) => setTestimonial(i, { nameEn: v })} />
                <Field label="Rôle / entreprise (arabe)" dir="rtl" value={item.role} onChange={(v) => setTestimonial(i, { role: v })} />
                <Field label="Rôle / entreprise (latin)" dir="ltr" value={item.roleEn} onChange={(v) => setTestimonial(i, { roleEn: v })} />
                <Field label="Photo (URL)" dir="ltr" value={item.image} onChange={(v) => setTestimonial(i, { image: v })} />
                <label className="block">
                  <span className="text-xs font-semibold text-zinc-400">Note (étoiles)</span>
                  <select
                    value={item.rating}
                    onChange={(e) => setTestimonial(i, { rating: Number(e.target.value) })}
                    className="mt-1.5 h-10 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-white outline-none focus:border-[#C6A664] cursor-pointer"
                  >
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>
                        {n} étoile{n > 1 ? "s" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-4 grid lg:grid-cols-2 gap-4">
                <Area label="Témoignage (arabe)" dir="rtl" value={item.text} onChange={(v) => setTestimonial(i, { text: v })} />
                <Area label="Témoignage (anglais)" dir="ltr" value={item.textEn} onChange={(v) => setTestimonial(i, { textEn: v })} />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Avant (arabe)" dir="rtl" value={item.beforeAfter.before} onChange={(v) => setTestimonial(i, { beforeAfter: { ...item.beforeAfter, before: v } })} />
                  <Field label="Après (arabe)" dir="rtl" value={item.beforeAfter.after} onChange={(v) => setTestimonial(i, { beforeAfter: { ...item.beforeAfter, after: v } })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Avant (latin)" dir="ltr" value={item.beforeAfterEn.before} onChange={(v) => setTestimonial(i, { beforeAfterEn: { ...item.beforeAfterEn, before: v } })} />
                  <Field label="Après (latin)" dir="ltr" value={item.beforeAfterEn.after} onChange={(v) => setTestimonial(i, { beforeAfterEn: { ...item.beforeAfterEn, after: v } })} />
                </div>
              </div>
            </ItemCard>
          ))}
          <button
            type="button"
            onClick={() => setDraft((d) => ({ ...d, testimonials: [...d.testimonials, newTestimonial()] }))}
            className="h-11 px-5 rounded-2xl border border-dashed border-white/20 text-sm font-bold text-zinc-400 hover:text-white hover:border-[#C6A664]/50 inline-flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Ajouter un témoignage
          </button>
        </div>
      )}

      {/* ---------- FAQ ---------- */}
      {tab === "faqs" && (
        <div className="space-y-4">
          {draft.faqs.map((item, i) => (
            <ItemCard
              key={i}
              index={i}
              count={draft.faqs.length}
              title={item.qEn || item.qAr}
              subtitle={item.qAr}
              onMove={(dir) => onMove("faqs", i, dir)}
              onDelete={() => onDelete("faqs", i)}
            >
              <div className="grid lg:grid-cols-2 gap-4">
                <Field label="Question (arabe)" dir="rtl" value={item.qAr} onChange={(v) => setFaq(i, { qAr: v })} />
                <Field label="Question (anglaise)" dir="ltr" value={item.qEn} onChange={(v) => setFaq(i, { qEn: v })} />
                <Area label="Réponse (arabe)" dir="rtl" value={item.aAr} onChange={(v) => setFaq(i, { aAr: v })} />
                <Area label="Réponse (anglaise)" dir="ltr" value={item.aEn} onChange={(v) => setFaq(i, { aEn: v })} />
              </div>
            </ItemCard>
          ))}
          <button
            type="button"
            onClick={() => setDraft((d) => ({ ...d, faqs: [...d.faqs, newFaq()] }))}
            className="h-11 px-5 rounded-2xl border border-dashed border-white/20 text-sm font-bold text-zinc-400 hover:text-white hover:border-[#C6A664]/50 inline-flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Ajouter une question
          </button>
        </div>
      )}

      {/* Barre d'enregistrement */}
      <div className="sticky bottom-4 z-10 rounded-3xl border border-white/10 bg-[#121218]/95 backdrop-blur p-4 flex flex-wrap items-center gap-3 shadow-2xl">
        {msg && (
          <span
            className={`text-sm font-semibold inline-flex items-center gap-2 ${
              msg.kind === "ok" ? "text-emerald-300" : "text-red-300"
            }`}
          >
            {msg.kind === "ok" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            {msg.text}
          </span>
        )}
        <div className="ms-auto flex items-center gap-2.5">
          <button
            type="button"
            onClick={onReset}
            disabled={busy !== ""}
            className="h-11 px-4 rounded-2xl border border-white/10 text-sm font-semibold text-zinc-400 hover:text-red-400 hover:border-red-500/30 inline-flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
          >
            {busy === "reset" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            Réinitialiser
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={busy !== ""}
            className="h-11 px-6 rounded-2xl bg-[#C6A664] text-black text-sm font-black inline-flex items-center gap-2 hover:bg-[#B89652] transition-colors cursor-pointer disabled:opacity-60"
          >
            {busy === tab ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
