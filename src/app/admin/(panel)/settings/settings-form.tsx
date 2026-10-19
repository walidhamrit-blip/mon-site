"use client";
import { useState, type FormEvent } from "react";
import type { SiteConfigData, PricingPlanData } from "@/lib/site-types";
import { resetSiteConfig, saveSiteConfig } from "@/app/admin/actions";
import { DEFAULT_THEME_ID, THEMES } from "@/lib/themes";
import { ThemePreview } from "@/components/theme-switcher";
import {
  Save,
  RotateCcw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  Sun,
  Moon,
  Plus,
  Trash2,
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
  hint,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  nullable?: boolean;
  hint?: string;
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
      {hint && <span className="mt-1 block text-[11px] text-zinc-600">{hint}</span>}
    </label>
  );
}

function AreaField({
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
      <span className="text-xs font-semibold text-zinc-400">{label}</span>
      <textarea
        rows={rows}
        dir={dir}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-2xl border border-white/10 bg-black/40 p-3 text-sm text-white outline-none focus:border-[#C6A664] resize-y leading-6"
      />
      {hint && <span className="mt-1 block text-[11px] text-zinc-600">{hint}</span>}
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

/** Icônes proposées pour les services à la carte. */
const SERVICE_ICONS = ["Palette", "LayoutGrid", "Presentation", "PenTool", "Rocket", "Wrench"];

function newStandaloneService(): SiteConfigData["standaloneServices"][number] {
  return {
    id: `service-${Date.now().toString(36)}`,
    icon: "Palette",
    titleAr: "خدمة جديدة",
    titleEn: "New service",
    descAr: "وصف الخدمة…",
    descEn: "Service description…",
    priceFromUsd: 19,
    priceFromLyd: 110,
    badgeAr: "",
    badgeEn: "",
    featuresAr: ["ميزة أولى"],
    featuresEn: ["First feature"],
  };
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

  const setFlex = (patch: Partial<SiteConfigData["flexiblePayment"]>) =>
    setDraft((d) => ({
      ...d,
      flexiblePayment: { ...d.flexiblePayment, ...patch },
    }));

  const setService = (
    index: number,
    patch: Partial<SiteConfigData["standaloneServices"][number]>,
  ) =>
    setDraft((d) => ({
      ...d,
      standaloneServices: d.standaloneServices.map((service, i) =>
        i === index ? { ...service, ...patch } : service,
      ),
    }));

  const moveService = (index: number, dir: -1 | 1) =>
    setDraft((d) => {
      const services = [...d.standaloneServices];
      const target = index + dir;
      if (target < 0 || target >= services.length) return d;
      [services[index], services[target]] = [services[target], services[index]];
      return { ...d, standaloneServices: services };
    });

  const removeService = (index: number) =>
    setDraft((d) => ({
      ...d,
      standaloneServices: d.standaloneServices.filter((_, i) => i !== index),
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
      flexiblePayment: {
        ...draft.flexiblePayment,
        suggested: draft.flexiblePayment.suggested.filter(
          (value) => Number.isFinite(value) && value > 0,
        ),
      },
      standaloneServices: draft.standaloneServices.map((service) => ({
        ...service,
        badgeAr: service.badgeAr?.trim() || undefined,
        badgeEn: service.badgeEn?.trim() || undefined,
        featuresAr: clean(service.featuresAr),
        featuresEn: clean(service.featuresEn),
      })),
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
        "Réinitialiser toute la configuration (apparence, coordonnées, réseaux, tarifs, paiement flexible, services à la carte, réservation) aux valeurs par défaut du code ?",
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
  const appearance = c.appearance ?? {
    themeId: DEFAULT_THEME_ID,
    mode: "light" as const,
    defaultLocale: "ar" as const,
  };
  const setAppearance = (patch: Partial<SiteConfigData["appearance"]>) =>
    set("appearance", { ...appearance, ...patch });

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Card
        title="Apparence & langue"
        description="Choisissez le thème principal du site, son mode clair/sombre et sa langue principale. Ces valeurs s'appliquent par défaut à tous les visiteurs — chacun peut toujours basculer depuis les sélecteurs du site (son choix est alors mémorisé sur son appareil)."
      >
        <div className="space-y-5">
          <div>
            <span className="text-xs font-semibold text-zinc-400">
              Thème principal (palette de couleurs)
            </span>
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {THEMES.map((theme) => {
                const active = appearance.themeId === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setAppearance({ themeId: theme.id })}
                    aria-pressed={active}
                    className={`text-start rounded-2xl border p-2 transition-colors cursor-pointer ${
                      active
                        ? "border-[#C6A664] bg-[#C6A664]/10"
                        : "border-white/10 hover:border-[#C6A664]/50"
                    }`}
                  >
                    <ThemePreview theme={theme} className="w-full" />
                    <span className="mt-1.5 flex items-center gap-1">
                      <span className="text-[11px] font-bold text-white truncate">
                        {theme.labelEn}
                      </span>
                      {active && (
                        <CheckCircle2 className="h-3 w-3 text-[#C6A664] flex-shrink-0" />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
            <span className="mt-1.5 block text-[11px] text-zinc-600">
              Chaque thème existe en version claire et sombre — le mode se choisit
              ci-dessous, indépendamment du thème.
            </span>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <span className="text-xs font-semibold text-zinc-400">
                Mode d’affichage principal
              </span>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(["light", "dark"] as const).map((mode) => {
                  const active = appearance.mode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setAppearance({ mode })}
                      aria-pressed={active}
                      className={`h-11 rounded-2xl border text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                        active
                          ? "border-[#C6A664] bg-[#C6A664]/15 text-white"
                          : "border-white/10 text-zinc-400 hover:text-white hover:border-white/25"
                      }`}
                    >
                      {mode === "light" ? (
                        <Sun className="h-4 w-4" />
                      ) : (
                        <Moon className="h-4 w-4" />
                      )}
                      {mode === "light" ? "Clair" : "Sombre"}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <span className="text-xs font-semibold text-zinc-400">
                Langue principale du site
              </span>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(
                  [
                    ["ar", "العربية — Arabe"],
                    ["en", "English — Anglais"],
                  ] as const
                ).map(([value, label]) => {
                  const active = appearance.defaultLocale === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setAppearance({ defaultLocale: value })}
                      aria-pressed={active}
                      className={`h-11 rounded-2xl border text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                        active
                          ? "border-[#C6A664] bg-[#C6A664]/15 text-white"
                          : "border-white/10 text-zinc-400 hover:text-white hover:border-white/25"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <span className="mt-1.5 block text-[11px] text-zinc-600">
                Langue affichée par défaut à l’ouverture du site — chaque visiteur
                peut ensuite basculer (son choix est mémorisé).
              </span>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Coordonnées" description="Informations de contact et identité affichées partout sur le site.">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Nom (arabe)" value={c.nameAr} dir="rtl" onChange={(v) => set("nameAr", v)} />
          <Field label="Nom (latin)" value={c.name} dir="ltr" onChange={(v) => set("name", v)} />
          <Field label="Signature / tagline" value={c.tagline} onChange={(v) => set("tagline", v)} />
          <Field label="Domaine" value={c.domain} dir="ltr" hint="ex. nokhba.net.ly" onChange={(v) => set("domain", v)} />
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
        description="Les prix et formules de la section tarifs. L’ordre de cette liste définit le numéro de catégorie (1, 2, 3…) utilisé pour classer chaque site du portfolio. L’identifiant (id) de chaque formule est technique : ne le modifiez pas."
      >
        <div className="grid sm:grid-cols-2 gap-4 max-w-[420px]">
          <Field label="Devise principale (arabe)" value={c.pricing.currency} dir="rtl" hint="Le dollar ($) par défaut — devise du prix principal" onChange={(v) => setDraft((d) => ({ ...d, pricing: { ...d.pricing, currency: v } }))} />
          <Field label="Devise principale (anglais)" value={c.pricing.currencyEn} dir="ltr" hint="The dollar ($) by default — main price currency" onChange={(v) => setDraft((d) => ({ ...d, pricing: { ...d.pricing, currencyEn: v } }))} />
        </div>

        <div className="mt-6 space-y-5">
          {c.pricing.plans.map((plan, index) => (
            <div
              key={plan.id}
              className="rounded-3xl border border-white/10 bg-black/30 p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="px-2.5 py-1 rounded-lg bg-white/10 text-zinc-300 text-xs font-black border border-white/15">
                    Catégorie {index + 1}
                  </span>
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
                <NumberField label="Prix indicatif (LYD)" value={plan.price} hint="Équivalent affiché en Livre libyenne" onChange={(v) => setPlan(index, { price: v ?? 0 })} />
                <NumberField label="Prix principal (USD)" value={plan.priceUsd ?? null} nullable hint="Prix affiché et facturé en dollar via la passerelle. Laissé vide : formule non payable en ligne" onChange={(v) => setPlan(index, { priceUsd: v })} />
                <NumberField label="Prix barré indicatif (LYD, optionnel)" value={plan.originalPrice} nullable onChange={(v) => setPlan(index, { originalPrice: v })} />
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

      <Card
        title="Paiement flexible « 1 $ ou plus »"
        description="Section où le client choisit lui-même le montant à payer (acompte, solde, soutien…). Utile aussi pour contourner les minimums imposés par certains réseaux crypto."
      >
        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 cursor-pointer">
          <input
            type="checkbox"
            checked={c.flexiblePayment.enabled}
            onChange={(event) =>
              setFlex({ enabled: event.target.checked })
            }
            className="h-4 w-4 accent-[#C6A664]"
          />
          <span>
            <span className="block text-sm font-bold text-white">
              Afficher la section de paiement flexible
            </span>
            <span className="block text-[11px] text-zinc-500">
              Décochez pour la masquer sur le site public
            </span>
          </span>
        </label>

        <div className="mt-4 grid sm:grid-cols-3 gap-4">
          <NumberField
            label="Montant minimum (USD)"
            value={c.flexiblePayment.minUsd}
            hint="1 $ par défaut"
            onChange={(v) => setFlex({ minUsd: v ?? 0 })}
          />
          <NumberField
            label="Montant maximum (USD)"
            value={c.flexiblePayment.maxUsd}
            hint="Garde-fou anti-abus"
            onChange={(v) => setFlex({ maxUsd: v ?? 0 })}
          />
          <Field
            label="Montants suggérés (USD)"
            dir="ltr"
            value={c.flexiblePayment.suggested.join(", ")}
            hint="Séparés par des virgules — ex. 1, 5, 10, 25"
            onChange={(v) =>
              setFlex({
                suggested: v
                  .split(/[,\s]+/)
                  .map((part) => Number(part))
                  .filter((value) => Number.isFinite(value) && value > 0),
              })
            }
          />
        </div>

        <div className="mt-4 grid lg:grid-cols-2 gap-4">
          <AreaField
            label="Note affichée (arabe)"
            dir="rtl"
            value={c.flexiblePayment.noteAr}
            onChange={(v) => setFlex({ noteAr: v })}
          />
          <AreaField
            label="Note affichée (anglais)"
            dir="ltr"
            value={c.flexiblePayment.noteEn}
            onChange={(v) => setFlex({ noteEn: v })}
          />
        </div>
      </Card>

      <Card
        title="Services à la carte"
        description="Petites missions vendues au forfait, affichées dans la section « services libres » du site. L’ordre de la liste est celui du site ; chaque service possède un identifiant technique (ne le modifiez pas)."
      >
        <div className="space-y-5">
          {c.standaloneServices.map((service, index) => (
            <div
              key={service.id}
              className="rounded-3xl border border-white/10 bg-black/30 p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="px-2.5 py-1 rounded-lg bg-white/10 text-zinc-300 text-xs font-black border border-white/15">
                    {index + 1}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-[#C6A664]/15 text-[#E8D5A9] text-xs font-black border border-[#C6A664]/30">
                    {service.id}
                  </span>
                  <span className="font-bold text-white">
                    {service.titleEn || service.titleAr}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => moveService(index, -1)}
                    disabled={index === 0}
                    className="h-8 w-8 rounded-lg border border-white/10 text-zinc-400 hover:text-white grid place-items-center disabled:opacity-30 cursor-pointer"
                    aria-label="Monter"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveService(index, 1)}
                    disabled={index === c.standaloneServices.length - 1}
                    className="h-8 w-8 rounded-lg border border-white/10 text-zinc-400 hover:text-white grid place-items-center disabled:opacity-30 cursor-pointer"
                    aria-label="Descendre"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeService(index)}
                    className="h-8 w-8 rounded-lg border border-white/10 text-zinc-500 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10 grid place-items-center transition-colors cursor-pointer"
                    aria-label="Supprimer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <label className="block">
                  <span className="text-xs font-semibold text-zinc-400">Icône</span>
                  <select
                    value={service.icon}
                    onChange={(e) => setService(index, { icon: e.target.value })}
                    className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-black/40 px-3.5 text-sm text-white outline-none focus:border-[#C6A664] cursor-pointer"
                  >
                    {SERVICE_ICONS.map((icon) => (
                      <option key={icon} value={icon}>
                        {icon}
                      </option>
                    ))}
                  </select>
                </label>
                <Field
                  label="Titre (arabe)"
                  dir="rtl"
                  value={service.titleAr}
                  onChange={(v) => setService(index, { titleAr: v })}
                />
                <Field
                  label="Titre (anglais)"
                  dir="ltr"
                  value={service.titleEn}
                  onChange={(v) => setService(index, { titleEn: v })}
                />
                <NumberField
                  label="Prix de départ (USD)"
                  value={service.priceFromUsd}
                  onChange={(v) => setService(index, { priceFromUsd: v ?? 0 })}
                />
                <NumberField
                  label="Équivalent (LYD)"
                  value={service.priceFromLyd}
                  onChange={(v) => setService(index, { priceFromLyd: v ?? 0 })}
                />
                <Field
                  label="Badge (arabe, optionnel)"
                  dir="rtl"
                  value={service.badgeAr ?? ""}
                  onChange={(v) => setService(index, { badgeAr: v })}
                />
                <Field
                  label="Badge (anglais, optionnel)"
                  dir="ltr"
                  value={service.badgeEn ?? ""}
                  onChange={(v) => setService(index, { badgeEn: v })}
                />
              </div>

              <div className="mt-4 grid lg:grid-cols-2 gap-4">
                <AreaField
                  label="Description (arabe)"
                  dir="rtl"
                  value={service.descAr}
                  onChange={(v) => setService(index, { descAr: v })}
                />
                <AreaField
                  label="Description (anglais)"
                  dir="ltr"
                  value={service.descEn}
                  onChange={(v) => setService(index, { descEn: v })}
                />
                <LinesField
                  label="Points forts (arabe)"
                  value={service.featuresAr}
                  onChange={(v) => setService(index, { featuresAr: v })}
                />
                <LinesField
                  label="Points forts (anglais)"
                  value={service.featuresEn}
                  onChange={(v) => setService(index, { featuresEn: v })}
                />
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={() =>
              setDraft((d) => ({
                ...d,
                standaloneServices: [
                  ...d.standaloneServices,
                  newStandaloneService(),
                ],
              }))
            }
            className="h-11 px-5 rounded-2xl border border-dashed border-white/20 text-sm font-bold text-zinc-400 hover:text-white hover:border-[#C6A664]/50 inline-flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Ajouter un service
          </button>
        </div>
      </Card>

      <Card
        title="Réservation prioritaire"
        description="Petit acompte pour prendre une place en avance dans le planning. La proposition apparaît sur chaque site consulté (galerie, fiche et visionneuse plein écran) et l’acompte est déduit du prix final."
      >
        <div className="grid sm:grid-cols-3 gap-4 items-start">
          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 cursor-pointer">
            <input
              type="checkbox"
              checked={c.reservation.enabled}
              onChange={(event) =>
                set("reservation", {
                  ...c.reservation,
                  enabled: event.target.checked,
                })
              }
              className="h-4 w-4 accent-[#C6A664]"
            />
            <span>
              <span className="block text-sm font-bold text-white">
                Activer la réservation
              </span>
              <span className="block text-[11px] text-zinc-500">
                Bouton et dialogue visible sur le site public
              </span>
            </span>
          </label>
          <NumberField
            label="Acompte (USD)"
            value={c.reservation.depositUsd}
            hint="Facturé via NOWPayments (1 $ par défaut)"
            onChange={(v) =>
              set("reservation", { ...c.reservation, depositUsd: v ?? 0 })
            }
          />
          <NumberField
            label="Équivalent affiché (LYD)"
            value={c.reservation.depositLyd}
            hint="Montant indicatif en Livre libyenne"
            onChange={(v) =>
              set("reservation", { ...c.reservation, depositLyd: v ?? 0 })
            }
          />
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-zinc-600">
          Les catégories et leurs prix se règlent dans la carte « Tarifs »
          ci-dessus (l’ordre = numéro de catégorie). Le rattachement d’un site à
          une catégorie, et son éventuel prix propre, se modifient dans
          « Contenu » → onglet « Démos ».
        </p>
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
