"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Blocks,
  Check,
  ExternalLink,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
} from "lucide-react";
import { resetContentSection, saveContentSection } from "@/app/admin/actions";
import { sectors } from "@/lib/content";
import type { Demo, PricingPlanData } from "@/lib/site-types";
import { SiteItemEditor, makeBlankDemo } from "../site-item-editor";

interface Props {
  initialDemos: Demo[];
  plans: PricingPlanData[];
  currency: string;
}

export function SitesManager({ initialDemos, plans, currency }: Props) {
  const router = useRouter();
  const [demos, setDemos] = useState<Demo[]>(initialDemos);
  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [openSlugs, setOpenSlugs] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState(false);
  const [aiBatchLoading, setAiBatchLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  const flash = (msg: string, kind: "ok" | "err") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 4000);
  };

  const addDemo = () => {
    const blank = makeBlankDemo(
      demos.map((d) => d.slug),
      plans,
    );
    setDemos([blank, ...demos]);
    setOpenSlugs((prev) => ({ ...prev, [blank.slug]: true }));
    setDirty(true);
  };

  const updateDemo = (idx: number, next: Demo) => {
    const copy = [...demos];
    copy[idx] = next;
    setDemos(copy);
    setDirty(true);
  };

  const moveDemo = (idx: number, delta: -1 | 1) => {
    const target = idx + delta;
    if (target < 0 || target >= demos.length) return;
    const copy = [...demos];
    [copy[idx], copy[target]] = [copy[target], copy[idx]];
    setDemos(copy);
    setDirty(true);
  };

  const deleteDemo = (idx: number) => {
    const item = demos[idx];
    if (
      !confirm(
        `Supprimer définitivement le site « ${item.titleEn || item.title} » ?`,
      )
    ) {
      return;
    }
    setDemos(demos.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const generateAllSeo = async () => {
    if (demos.length === 0) return;
    setAiBatchLoading(true);
    try {
      const res = await fetch("/api/admin/ai/seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "batch",
          demos,
          options: { overwrite: false },
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        flash(json.error ?? "Échec de la génération SEO globale.", "err");
        return;
      }
      setDemos(json.demos);
      setDirty(true);
      flash(
        `SEO généré pour ${json.generated ?? demos.length} site(s) — pensez à enregistrer.`,
        "ok",
      );
    } catch {
      flash("Erreur réseau lors de la génération SEO.", "err");
    } finally {
      setAiBatchLoading(false);
    }
  };

  const onSave = () => {
    startTransition(async () => {
      const res = await saveContentSection("demos", demos);
      if (res.ok) {
        setDirty(false);
        flash(res.message ?? "Galerie enregistrée.", "ok");
        router.refresh();
      } else {
        flash(res.error ?? "Échec de l’enregistrement.", "err");
      }
    });
  };

  const onReset = () => {
    if (
      !confirm(
        "Réinitialiser toute la galerie de sites aux 12 réalisations par défaut ?",
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await resetContentSection("demos");
      if (res.ok) {
        setDirty(false);
        flash(res.message ?? "Galerie réinitialisée.", "ok");
        router.refresh();
      } else {
        flash(res.error ?? "Erreur lors de la réinitialisation.", "err");
      }
    });
  };

  const indexedDemos = demos.map((demo, index) => ({ demo, index }));
  const visibleDemos = indexedDemos.filter(({ demo }) => {
    const matchSector = sectorFilter === "all" || demo.sector === sectorFilter;
    const q = search.trim().toLowerCase();
    const matchQuery =
      !q ||
      `${demo.title} ${demo.titleEn} ${demo.slug} ${demo.sectorEn}`
        .toLowerCase()
        .includes(q);
    return matchSector && matchQuery;
  });

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
            Portfolio client
          </span>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-stone-900 mt-0.5">
            Galerie des sites clients
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            {demos.length} site{demos.length > 1 ? "s" : ""} dans la galerie principale ·{" "}
            <Link
              href="/admin/sections"
              className="text-[#8A6D2F] font-semibold hover:underline inline-flex items-center gap-1"
            >
              <Blocks className="h-3.5 w-3.5" /> Gérer aussi les sections personnalisées
            </Link>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={aiBatchLoading || demos.length === 0}
            onClick={generateAllSeo}
            className="h-10 px-3.5 rounded-xl bg-[#FAF6EC] border border-[#C6A664]/50 text-[#7A5D20] text-xs font-bold inline-flex items-center gap-1.5 hover:bg-[#C6A664]/20 disabled:opacity-50 cursor-pointer"
          >
            {aiBatchLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Compléter tout le SEO IA
          </button>

          <button
            type="button"
            onClick={addDemo}
            className="h-10 px-4 rounded-xl bg-stone-900 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 hover:bg-stone-800 cursor-pointer shadow-xs"
          >
            <Plus className="h-4 w-4 text-[#E5CA87]" />
            Ajouter un site
          </button>

          <Link
            href="/demos"
            target="_blank"
            className="h-10 px-3.5 rounded-xl border border-stone-300 bg-white text-stone-700 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-stone-50"
          >
            Page /demos <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Recherche + filtre secteur */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-3.5 shadow-2xs">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-4 w-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrer par nom de site, slug ou secteur…"
            className="w-full h-9 rounded-xl bg-[#FAF9F6] border border-stone-200 pl-9 pr-3 text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#B8923F]"
          />
        </div>

        <select
          value={sectorFilter}
          onChange={(e) => setSectorFilter(e.target.value)}
          className="h-9 rounded-xl border border-stone-200 bg-[#FAF9F6] px-3 text-xs font-semibold text-stone-700 focus:outline-none focus:border-[#B8923F] cursor-pointer"
        >
          {sectors.map((s) => (
            <option key={s.id} value={s.id}>
              {s.id === "all" ? "Tous les secteurs" : `${s.labelEn} — ${s.labelAr}`}
            </option>
          ))}
        </select>
      </div>

      {/* Liste accordéon des sites */}
      {visibleDemos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center text-sm text-stone-500">
          {demos.length === 0
            ? "Aucun site dans la galerie. Cliquez sur « Ajouter un site » ou « Valeurs par défaut »."
            : "Aucun site ne correspond à votre filtre."}
        </div>
      ) : (
        <div className="space-y-2.5">
          {visibleDemos.map(({ demo, index }) => (
            <SiteItemEditor
              key={`${demo.slug}-${index}`}
              demo={demo}
              index={index}
              total={demos.length}
              plans={plans}
              currency={currency}
              expanded={Boolean(openSlugs[demo.slug])}
              onToggleExpand={() =>
                setOpenSlugs((prev) => ({
                  ...prev,
                  [demo.slug]: !prev[demo.slug],
                }))
              }
              onChange={(next) => updateDemo(index, next)}
              onMove={(delta) => moveDemo(index, delta)}
              onDelete={() => deleteDemo(index)}
              onFlash={flash}
            />
          ))}
        </div>
      )}

      {/* Barre d'enregistrement fixe */}
      <div className="fixed bottom-4 left-4 right-4 lg:left-80 lg:right-8 z-30">
        <div className="max-w-5xl mx-auto rounded-2xl border border-stone-300 bg-white/95 backdrop-blur px-4 py-3 shadow-xl flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-stone-600">
            {dirty ? (
              <span className="font-bold text-[#8A6D2F]">
                ● Modifications en attente — cliquez sur « Enregistrer » pour publier.
              </span>
            ) : (
              <span>Galerie synchronisée avec le site public.</span>
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
              {pending ? "Enregistrement…" : "Enregistrer la galerie"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
