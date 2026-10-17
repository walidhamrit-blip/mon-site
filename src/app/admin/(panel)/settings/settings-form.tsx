"use client";
import { useState, type FormEvent } from "react";
import type { SiteConfigData, PricingPlanData } from "@/lib/site-types";
import { resetSiteConfig, saveSiteConfig } from "@/app/admin/actions";
import {
  Save,
  RotateCcw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

/* ---------- petits éléments d'interface ---------- */

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-[#121218] p-5 sm:p-6">
      <h2 className="font-black text-white">{title}</h2>
      {description && <p className="mt-1 text-sm text-zinc-500">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  hint,
  type = "text",
  dir,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  type?: string;
  dir?: "ltr" | "rtl";
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-zinc-400">{label}</span>
      <input
        type={type}
        value={value}
        dir={dir}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-black/40 px-3.5 text-sm text-white outline-none focus:border-[#C6A664] transition-colors"
      />
      {hint && <span className="mt-1 block text-[11px] text-zinc-600">{hint}</span>}
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  nullable,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  nullable?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-zinc-400">{label}</span>
      <input
        type="number"
        min={0}
        value={value ?? ""}
        onChange={(e) => {
          if (e.target.value === "") {
            onChange(nullable ? null : 0);
            return;
          }
          const n = Number(e.target.value);
          onChange(Number.isFinite(n) ? n : null);
        }}
        className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-black/40 px-3.5 text-sm text-white outline-none focus:border-[#C6A664] transition-colors"
      />
    </label>
  );
}

function LinesField({
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
        className="mt-1.5 w-full rounded-2xl border border-white/10 bg-black/40 p-3 text-sm text-white outline-none focus:border-[#C6A664] resize-y leading-6"
      />
    </label>
  );
}

/* ---------- formulaire ---------- */

export function SettingsForm({ initial }: { initial: SiteConfigData }) {
  const [draft, setDraft] = useState<SiteConfigData>(() => structuredClone(initial));
  const [busy, setBusy] = useState<"" | "save" | "reset">("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const set = <K extends keyof SiteConfigData>(key: K, value: SiteConfigData[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const setSocial = (key: keyof SiteConfigData["social"], value: string) =>
    setDraft((d) => ({ ...d, social: { ...d.social, [key]: value } }));

  const setStats = (key: keyof SiteConfigData["stats"], value: string) =>
    setDraft((d) => ({ ...d, stats: { ...d.stats, [key]: value } }));

  const setPlan = (index: number, patch: Partial<PricingPlanData>) =>
    setDraft((d) => ({
      ...d,
      pricing: {
        ...d.pricing,
        plans: d.pricing.plans.map((p, i) => (i === index ? { ...p, ...patch } : p)),
      },
    }));

  const movePlan = (index: number, dir: -1 | 1) =>
    setDraft((d) => {
      const plans = [...d.pricing.plans];
      const target = index + dir;
      if (target < 0 || target >= plans.length) return d;
      [plans[index], plans[target]] = [plans[target], plans[index]];
      return { ...d, pricing: { ...d.pricing, plans } };
    });

  const buildPayload = (): SiteConfigData => {
    const clean = (list: string[]) => list.map((s) => s.trim()).filter(Boolean);
    return {
      ...draft,
      pricing: {
        ...draft.pricing,
        plans: draft.pricing.plans.map((p) => ({
          ...p,
          badge: p.badge?.trim() || undefined,
          badgeEn: p.badgeEn?.trim() || undefined,
          features: clean(p.features),
          featuresEn: clean(p.featuresEn),
        })),
      },
    };
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy("save");
    setMsg(null);
    const res = await saveSiteConfig(buildPayload());
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
        "Réinitialiser toute la configuration (coordonnées, réseaux, tarifs) aux valeurs par défaut du code ?",
      )
    ) {
      return;
    }
    setBusy("reset");
    setMsg(null);
    const res = await resetSiteConfig();
    setBusy("");
    if (res.ok) window.location.reload();
    else setMsg({ kind: "err", text: res.error ?? "Erreur inconnue." });
  };

  const c = draft;

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Card title="Coordonnées" description="Informations de contact et identité affichées partout sur le site.">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Nom (arabe)" value={c.nameAr} dir="rtl" onChange={(v) => set("nameAr", v)} />
          <Field label="Nom (latin)" value={c.name} dir="ltr" onChange={(v) => set("name", v)} />
          <Field label="Signature / tagline" value={c.tagline} onChange={(v) => set("tagline", v)} />
          <Field label="Domaine" value={c.domain} dir="ltr" hint="ex. nukhba.ly" onChange={(v) => set("domain", v)} />
          <Field label="URL complète" value={c.url} dir="ltr" hint="https://…" onChange={(v) => set("url", v)} />
          <Field label="Email" value={c.email} dir="ltr" type="email" onChange={(v) => set("email", v)} />
          <Field label="Téléphone" value={c.phone} dir="ltr" onChange={(v) => set("phone", v)} />
          <Field label="WhatsApp" value={c.whatsapp} dir="ltr" hint="Numéro sans « + », ex. 218912345678" onChange={(v) => set("whatsapp", v)} />
          <Field label="Horaires (arabe)" value={c.hours} dir="rtl" onChange={(v) => set("hours", v)} />
          <Field label="Horaires (anglais)" value={c.hoursEn} dir="ltr" onChange={(v) => set("hoursEn", v)} />
          <Field label="Adresse (arabe)" value={c.address} dir="rtl" onChange={(v) => set("address", v)} />
          <Field label="Adresse (anglais)" value={c.addressEn} dir="ltr" onChange={(v) => set("addressEn", v)} />
        </div>
      </Card>

      <Card title="Réseaux sociaux" description="Liens utilisés dans le pied de page.">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Instagram" value={c.social.instagram} dir="ltr" onChange={(v) => setSocial("instagram", v)} />
          <Field label="Facebook" value={c.social.facebook} dir="ltr" onChange={(v) => setSocial("facebook", v)} />
          <Field label="TikTok" value={c.social.tiktok} dir="ltr" onChange={(v) => setSocial("tiktok", v)} />
          <Field label="Lien WhatsApp" value={c.social.whatsapp} dir="ltr" hint="https://wa.me/…" onChange={(v) => setSocial("whatsapp", v)} />
        </div>
      </Card>

      <Card title="Chiffres de réassurance" description="Les quatre chiffres mis en avant sur le site.">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Field label="Livraison (AR)" value={c.stats.delivery} dir="rtl" onChange={(v) => setStats("delivery", v)} />
          <Field label="Livraison (EN)" value={c.stats.deliveryEn} onChange={(v) => setStats("deliveryEn", v)} />
          <Field label="Sites livrés" value={c.stats.sitesDelivered} dir="ltr" onChange={(v) => setStats("sitesDelivered", v)} />
          <Field label="Satisfaction" value={c.stats.satisfaction} dir="ltr" onChange={(v) => setStats("satisfaction", v)} />
          <Field label="Support" value={c.stats.support} dir="ltr" onChange={(v) => setStats("support", v)} />
        </div>
      </Card>

      <Card
        title="Tarifs"
        description="Les prix et formules de la section tarifs. L’identifiant (id) de chaque formule est technique : ne le modifiez pas."
      >
        <div className="grid sm:grid-cols-2 gap-4 max-w-[420px]">
          <Field label="Devise (arabe)" value={c.pricing.currency} dir="rtl" onChange={(v) => setDraft((d) => ({ ...d, pricing: { ...d.pricing, currency: v } }))} />
          <Field label="Devise (anglais)" value={c.pricing.currencyEn} dir="ltr" onChange={(v) => setDraft((d) => ({ ...d, pricing: { ...d.pricing, currencyEn: v } }))} />
        </div>

        <div className="mt-6 space-y-5">
          {c.pricing.plans.map((plan, index) => (
            <div
              key={plan.id}
              className="rounded-3xl border border-white/10 bg-black/30 p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-1 rounded-lg bg-[#C6A664]/15 text-[#E8D5A9] text-xs font-black border border-[#C6A664]/30">
                    {plan.id}
                  </span>
                  <span className="font-bold text-white">{plan.nameEn}</span>
                  {plan.featured && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-bold">
                      Mise en avant
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => movePlan(index, -1)}
                    disabled={index === 0}
                    className="h-8 w-8 rounded-lg border border-white/10 text-zinc-400 hover:text-white grid place-items-center disabled:opacity-30 cursor-pointer"
                    aria-label="Monter"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => movePlan(index, 1)}
                    disabled={index === c.pricing.plans.length - 1}
                    className="h-8 w-8 rounded-lg border border-white/10 text-zinc-400 hover:text-white grid place-items-center disabled:opacity-30 cursor-pointer"
                    aria-label="Descendre"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <label className="flex items-center gap-2 ms-2 text-xs font-semibold text-zinc-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={plan.featured}
                      onChange={(e) => setPlan(index, { featured: e.target.checked })}
                      className="accent-[#C6A664]"
                    />
                    En vedette
                  </label>
                </div>
              </div>

              <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Field label="Nom (arabe)" value={plan.name} dir="rtl" onChange={(v) => setPlan(index, { name: v })} />
                <Field label="Nom (latin)" value={plan.nameEn} dir="ltr" onChange={(v) => setPlan(index, { nameEn: v })} />
                <NumberField label={`Prix (${c.pricing.currencyEn})`} value={plan.price} onChange={(v) => setPlan(index, { price: v ?? 0 })} />
                <NumberField label="Prix barré (optionnel)" value={plan.originalPrice} nullable onChange={(v) => setPlan(index, { originalPrice: v })} />
                <Field label="Badge (arabe, optionnel)" value={plan.badge ?? ""} dir="rtl" onChange={(v) => setPlan(index, { badge: v })} />
                <Field label="Badge (anglais, optionnel)" value={plan.badgeEn ?? ""} dir="ltr" onChange={(v) => setPlan(index, { badgeEn: v })} />
                <Field label="Description (arabe)" value={plan.description} dir="rtl" onChange={(v) => setPlan(index, { description: v })} />
                <Field label="Description (anglaise)" value={plan.descriptionEn} dir="ltr" onChange={(v) => setPlan(index, { descriptionEn: v })} />
                <Field label="Bouton (arabe)" value={plan.cta} dir="rtl" onChange={(v) => setPlan(index, { cta: v })} />
                <Field label="Bouton (anglais)" value={plan.ctaEn} dir="ltr" onChange={(v) => setPlan(index, { ctaEn: v })} />
                <Field label="Période (arabe)" value={plan.period} dir="rtl" onChange={(v) => setPlan(index, { period: v })} />
                <Field label="Période (anglaise)" value={plan.periodEn} dir="ltr" onChange={(v) => setPlan(index, { periodEn: v })} />
              </div>

              <div className="mt-4 grid lg:grid-cols-2 gap-4">
                <LinesField label="Arguments (arabe)" value={plan.features} onChange={(v) => setPlan(index, { features: v })} />
                <LinesField label="Arguments (anglais)" value={plan.featuresEn} onChange={(v) => setPlan(index, { featuresEn: v })} />
              </div>
            </div>
          ))}
        </div>
      </Card>

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
            type="submit"
            disabled={busy !== ""}
            className="h-11 px-6 rounded-2xl bg-[#C6A664] text-black text-sm font-black inline-flex items-center gap-2 hover:bg-[#B89652] transition-colors cursor-pointer disabled:opacity-60"
          >
            {busy === "save" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Enregistrer
          </button>
        </div>
      </div>
    </form>
  );
}
