"use client";
import { useState } from "react";
import type { Demo, Faq, SiteContent, Testimonial } from "@/lib/site-types";
import { resetContentSection, saveContentSection } from "@/app/admin/actions";
import { sectors } from "@/lib/content";
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

type Tab = "demos" | "testimonials" | "faqs";

const tabs: { id: Tab; label: string }[] = [
  { id: "demos", label: "Démos" },
  { id: "testimonials", label: "Témoignages" },
  { id: "faqs", label: "FAQ" },
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

/* ---------- éditeur ---------- */

function newDemo(existing: Demo[]): Demo {
  let slug = `nouveau-projet-${Date.now().toString(36)}`;
  while (existing.some((d) => d.slug === slug)) slug = `${slug}-2`;
  return {
    slug,
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

function moveItem<T>(list: T[], index: number, dir: -1 | 1): T[] {
  const target = index + dir;
  if (target < 0 || target >= list.length) return list;
  const copy = [...list];
  [copy[index], copy[target]] = [copy[target], copy[index]];
  return copy;
}

export function ContentEditor({ initial }: { initial: SiteContent }) {
  const [tab, setTab] = useState<Tab>("demos");
  const [draft, setDraft] = useState<SiteContent>(() => structuredClone(initial));
  const [busy, setBusy] = useState<"" | Tab | "reset">("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const setDemo = (i: number, patch: Partial<Demo>) =>
    setDraft((d) => ({ ...d, demos: d.demos.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  const setFaq = (i: number, patch: Partial<Faq>) =>
    setDraft((d) => ({ ...d, faqs: d.faqs.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  const setTestimonial = (i: number, patch: Partial<Testimonial>) =>
    setDraft((d) => ({
      ...d,
      testimonials: d.testimonials.map((x, j) => (j === i ? { ...x, ...patch } : x)),
    }));

  const onDelete = (kind: Tab, index: number) => {
    if (kind === "demos" && draft.demos.length <= 1) {
      alert("Il doit rester au moins une démo sur le site.");
      return;
    }
    setDraft((d) => {
      const list = kind === "demos" ? d.demos : kind === "faqs" ? d.faqs : d.testimonials;
      const filtered = list.filter((_, j) => j !== index);
      return kind === "demos"
        ? { ...d, demos: filtered as Demo[] }
        : kind === "faqs"
          ? { ...d, faqs: filtered as Faq[] }
          : { ...d, testimonials: filtered as Testimonial[] };
    });
  };

  const onMove = (kind: Tab, index: number, dir: -1 | 1) =>
    setDraft((d) =>
      kind === "demos"
        ? { ...d, demos: moveItem(d.demos, index, dir) }
        : kind === "faqs"
          ? { ...d, faqs: moveItem(d.faqs, index, dir) }
          : { ...d, testimonials: moveItem(d.testimonials, index, dir) },
    );

  const buildPayload = () => {
    const clean = (list: string[]) => list.map((s) => s.trim()).filter(Boolean);
    if (tab === "demos") {
      return draft.demos.map((d) => ({
        ...d,
        slug: d.slug.trim(),
        features: clean(d.features),
        featuresEn: clean(d.featuresEn),
      }));
    }
    if (tab === "faqs") return draft.faqs;
    return draft.testimonials;
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
            <span className="ms-2 text-xs opacity-60">
              {tab === t.id
                ? t.id === "demos"
                  ? draft.demos.length
                  : t.id === "faqs"
                    ? draft.faqs.length
                    : draft.testimonials.length
                : ""}
            </span>
          </button>
        ))}
      </div>

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
          {draft.demos.map((demo, i) => (
            <ItemCard
              key={i}
              index={i}
              count={draft.demos.length}
              title={demo.titleEn || demo.title}
              subtitle={`/${demo.slug} — ${demo.sector}`}
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
                <Field label="Lien aperçu" dir="ltr" value={demo.previewUrl} onChange={(v) => setDemo(i, { previewUrl: v })} />
              </div>
              <div className="mt-4 grid lg:grid-cols-2 gap-4">
                <Area label="Description (arabe)" dir="rtl" value={demo.description} onChange={(v) => setDemo(i, { description: v })} />
                <Area label="Description (anglaise)" dir="ltr" value={demo.descriptionEn} onChange={(v) => setDemo(i, { descriptionEn: v })} />
                <Lines label="Points forts (arabe)" value={demo.features} onChange={(v) => setDemo(i, { features: v })} />
                <Lines label="Points forts (anglais)" value={demo.featuresEn} onChange={(v) => setDemo(i, { featuresEn: v })} />
              </div>
            </ItemCard>
          ))}
          <button
            type="button"
            onClick={() => setDraft((d) => ({ ...d, demos: [...d.demos, newDemo(d.demos)] }))}
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
