"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { resetSiteConfig, saveSiteConfig } from "@/app/admin/actions";
import { useTheme } from "@/components/theme-provider";
import { THEMES } from "@/lib/themes";

const SERVICE_ICON_IDS = [
  "Palette",
  "LayoutGrid",
  "Presentation",
  "PenTool",
  "Rocket",
  "Wrench",
  "Sparkles",
] as const;
import type {
  PricingPlanData,
  SiteConfigData,
  StandaloneService,
} from "@/lib/site-types";
import { ADMIN_INPUT_CLS, ADMIN_TEXTAREA_CLS } from "../site-item-editor";

type SettingsTab = "appearance" | "contact" | "pricing" | "flex";

interface Props {
  initial: SiteConfigData;
  initialTab?: string;
}

export function SettingsForm({ initial, initialTab }: Props) {
  const router = useRouter();
  const { resetToSiteDefaults } = useTheme();
  const resolveTab = (raw?: string): SettingsTab => {
    if (raw === "contact") return "contact";
    if (raw === "pricing") return "pricing";
    if (raw === "flex" || raw === "services") return "flex";
    return "appearance";
  };

  const [tab, setTab] = useState<SettingsTab>(resolveTab(initialTab));
  const [form, setForm] = useState<SiteConfigData>(initial);
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  const flash = (msg: string, kind: "ok" | "err") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 4000);
  };

  const patch = (next: Partial<SiteConfigData>) => {
    setForm((prev) => ({ ...prev, ...next }));
    setDirty(true);
  };

  const onSave = () => {
    startTransition(async () => {
      const res = await saveSiteConfig(form);
      if (res.ok) {
        resetToSiteDefaults(
          form.appearance.mode as "light" | "dark",
          form.appearance.themeId,
        );
        setDirty(false);
        flash(res.message ?? "Configuration enregistrée.", "ok");
        router.refresh();
      } else {
        flash(res.error ?? "Échec de l’enregistrement.", "err");
      }
    });
  };

  const onReset = () => {
    if (
      !confirm(
        "Réinitialiser tous les réglages et tarifs aux valeurs par défaut ?",
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await resetSiteConfig();
      if (res.ok) {
        setDirty(false);
        flash("Configuration réinitialisée.", "ok");
        router.refresh();
      } else {
        flash(res.error ?? "Erreur.", "err");
      }
    });
  };

  const updatePlan = (idx: number, next: Partial<PricingPlanData>) => {
    const copy = [...form.pricing.plans];
    copy[idx] = { ...copy[idx], ...next };
    patch({ pricing: { ...form.pricing, plans: copy } });
  };

  const updateService = (idx: number, next: Partial<StandaloneService>) => {
    const copy = [...form.standaloneServices];
    copy[idx] = { ...copy[idx], ...next };
    patch({ standaloneServices: copy });
  };

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: "appearance", label: "Apparence & Chiffres clés" },
    { id: "contact", label: "Identité, Contact & Réseaux" },
    { id: "pricing", label: "Formules & Réservation 1 $" },
    { id: "flex", label: "Paiement libre & Services à la carte" },
  ];

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

      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-[#8A6D2F]">
          Configuration globale
        </span>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-stone-900 mt-0.5">
          Réglages & Tarification
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          Personnalisez le thème du site public, vos coordonnées, vos formules et vos options de paiement.
        </p>
      </div>

      {/* Onglets clairs */}
      <div className="flex flex-wrap gap-1.5 rounded-2xl border border-stone-200 bg-white p-2 shadow-2xs">
        {tabs.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                active
                  ? "bg-stone-900 text-white shadow-2xs"
                  : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* --- TAB 1 : APPARENCE & CHIFFRES CLÉS --- */}
      {tab === "appearance" && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 space-y-5 shadow-2xs">
            <div>
              <h2 className="text-sm font-black text-stone-900">
                Palette de couleurs par défaut du site public
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Définit le thème initial vu par vos nouveaux visiteurs (l’espace d’administration reste toujours en mode clair haute lisibilité).
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {THEMES.map((theme) => {
                const selected = form.appearance.themeId === theme.id;
                const tokens =
                  form.appearance.mode === "dark" ? theme.dark : theme.light;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() =>
                      patch({
                        appearance: { ...form.appearance, themeId: theme.id },
                        theme: {
                          accent: tokens.accent,
                          accentHover: tokens["accent-hover"],
                        },
                      })
                    }
                    className={`rounded-2xl border p-3.5 text-left transition-all cursor-pointer ${
                      selected
                        ? "border-[#C6A664] ring-2 ring-[#C6A664]/35 bg-[#FCFBF8]"
                        : "border-stone-200 bg-white hover:border-stone-300"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-5 w-5 rounded-full border border-black/10"
                          style={{ backgroundColor: tokens.background }}
                        />
                        <span
                          className="h-5 w-5 rounded-full border border-black/10"
                          style={{ backgroundColor: tokens.primary }}
                        />
                        <span
                          className="h-5 w-5 rounded-full border border-black/10"
                          style={{ backgroundColor: tokens.accent }}
                        />
                      </div>
                      {selected && (
                        <Check className="h-4 w-4 text-[#8A6D2F]" />
                      )}
                    </div>
                    <div className="text-xs font-bold text-stone-900">
                      {theme.labelEn}
                    </div>
                    <div className="text-[11px] text-stone-500 mt-0.5" dir="rtl">
                      {theme.labelAr}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-stone-100">
              <Field label="Mode d’affichage par défaut (site visiteur)">
                <select
                  value={form.appearance.mode}
                  onChange={(e) =>
                    patch({
                      appearance: {
                        ...form.appearance,
                        mode: e.target.value as "light" | "dark",
                      },
                    })
                  }
                  className={ADMIN_INPUT_CLS}
                >
                  <option value="light">Mode clair (Light)</option>
                  <option value="dark">Mode sombre (Dark)</option>
                </select>
              </Field>

              <Field label="Langue par défaut du site">
                <select
                  value={form.appearance.defaultLocale}
                  onChange={(e) =>
                    patch({
                      appearance: {
                        ...form.appearance,
                        defaultLocale: e.target.value as "ar" | "en",
                      },
                    })
                  }
                  className={ADMIN_INPUT_CLS}
                >
                  <option value="ar">Arabe (RTL)</option>
                  <option value="en">Anglais (LTR)</option>
                </select>
              </Field>
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 space-y-4 shadow-2xs">
            <h2 className="text-sm font-black text-stone-900">
              Chiffres clés affichés sur le site
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              <Field label="Délai moyen (arabe)">
                <input
                  dir="rtl"
                  value={form.stats.delivery}
                  onChange={(e) =>
                    patch({
                      stats: { ...form.stats, delivery: e.target.value },
                    })
                  }
                  className={ADMIN_INPUT_CLS}
                />
              </Field>
              <Field label="Délai moyen (anglais)">
                <input
                  value={form.stats.deliveryEn}
                  onChange={(e) =>
                    patch({
                      stats: { ...form.stats, deliveryEn: e.target.value },
                    })
                  }
                  className={ADMIN_INPUT_CLS}
                />
              </Field>
              <Field label="Sites livrés">
                <input
                  value={form.stats.sitesDelivered}
                  onChange={(e) =>
                    patch({
                      stats: { ...form.stats, sitesDelivered: e.target.value },
                    })
                  }
                  className={ADMIN_INPUT_CLS}
                />
              </Field>
              <Field label="Taux de satisfaction">
                <input
                  value={form.stats.satisfaction}
                  onChange={(e) =>
                    patch({
                      stats: { ...form.stats, satisfaction: e.target.value },
                    })
                  }
                  className={ADMIN_INPUT_CLS}
                />
              </Field>
              <Field label="Disponibilité support">
                <input
                  value={form.stats.support}
                  onChange={(e) =>
                    patch({
                      stats: { ...form.stats, support: e.target.value },
                    })
                  }
                  className={ADMIN_INPUT_CLS}
                />
              </Field>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 2 : CONTACT & RÉSEAUX --- */}
      {tab === "contact" && (
        <div className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 space-y-5 shadow-2xs">
          <h2 className="text-sm font-black text-stone-900">
            Marque, Coordonnées & Réseaux sociaux
          </h2>
          <div className="grid sm:grid-cols-2 gap-3.5">
            <Field label="Nom de la marque (latin)">
              <input
                value={form.name}
                onChange={(e) => patch({ name: e.target.value })}
                className={ADMIN_INPUT_CLS}
              />
            </Field>
            <Field label="Nom de la marque (arabe)">
              <input
                dir="rtl"
                value={form.nameAr}
                onChange={(e) => patch({ nameAr: e.target.value })}
                className={ADMIN_INPUT_CLS}
              />
            </Field>
            <Field label="Slogan">
              <input
                dir="rtl"
                value={form.tagline}
                onChange={(e) => patch({ tagline: e.target.value })}
                className={ADMIN_INPUT_CLS}
              />
            </Field>
            <Field label="Domaine affiché">
              <input
                value={form.domain}
                onChange={(e) => patch({ domain: e.target.value })}
                className={ADMIN_INPUT_CLS}
              />
            </Field>
            <Field label="URL canonique (https://...)">
              <input
                value={form.url}
                onChange={(e) => patch({ url: e.target.value })}
                className={ADMIN_INPUT_CLS}
              />
            </Field>
            <Field label="Email de contact">
              <input
                type="email"
                value={form.email}
                onChange={(e) => patch({ email: e.target.value })}
                className={ADMIN_INPUT_CLS}
              />
            </Field>
            <Field label="Téléphone affiché">
              <input
                value={form.phone}
                onChange={(e) => patch({ phone: e.target.value })}
                className={ADMIN_INPUT_CLS}
              />
            </Field>
            <Field label="Numéro WhatsApp (chiffres internationaux sans +)">
              <input
                value={form.whatsapp}
                onChange={(e) =>
                  patch({ whatsapp: e.target.value.replace(/[^0-9]/g, "") })
                }
                className={ADMIN_INPUT_CLS}
              />
            </Field>
            <Field label="Adresse (arabe)">
              <input
                dir="rtl"
                value={form.address}
                onChange={(e) => patch({ address: e.target.value })}
                className={ADMIN_INPUT_CLS}
              />
            </Field>
            <Field label="Adresse (anglais)">
              <input
                value={form.addressEn}
                onChange={(e) => patch({ addressEn: e.target.value })}
                className={ADMIN_INPUT_CLS}
              />
            </Field>
            <Field label="Horaires (arabe)">
              <input
                dir="rtl"
                value={form.hours}
                onChange={(e) => patch({ hours: e.target.value })}
                className={ADMIN_INPUT_CLS}
              />
            </Field>
            <Field label="Horaires (anglais)">
              <input
                value={form.hoursEn}
                onChange={(e) => patch({ hoursEn: e.target.value })}
                className={ADMIN_INPUT_CLS}
              />
            </Field>
          </div>

          <div className="pt-4 border-t border-stone-100 grid sm:grid-cols-2 gap-3.5">
            <Field label="Lien Instagram">
              <input
                value={form.social.instagram}
                onChange={(e) =>
                  patch({
                    social: { ...form.social, instagram: e.target.value },
                  })
                }
                className={ADMIN_INPUT_CLS}
              />
            </Field>
            <Field label="Lien Facebook">
              <input
                value={form.social.facebook}
                onChange={(e) =>
                  patch({
                    social: { ...form.social, facebook: e.target.value },
                  })
                }
                className={ADMIN_INPUT_CLS}
              />
            </Field>
            <Field label="Lien WhatsApp direct">
              <input
                value={form.social.whatsapp}
                onChange={(e) =>
                  patch({
                    social: { ...form.social, whatsapp: e.target.value },
                  })
                }
                className={ADMIN_INPUT_CLS}
              />
            </Field>
            <Field label="Lien TikTok">
              <input
                value={form.social.tiktok}
                onChange={(e) =>
                  patch({
                    social: { ...form.social, tiktok: e.target.value },
                  })
                }
                className={ADMIN_INPUT_CLS}
              />
            </Field>
          </div>
        </div>
      )}

      {/* --- TAB 3 : FORMULES & RÉSERVATION 1 $ --- */}
      {tab === "pricing" && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black text-stone-900">
                  Réservation prioritaire (acompte déductible)
                </h2>
                <p className="text-xs text-stone-500">
                  Bouton « Réserver ma place » sur les fiches de sites.
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-bold text-stone-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.reservation.enabled}
                  onChange={(e) =>
                    patch({
                      reservation: {
                        ...form.reservation,
                        enabled: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4 accent-stone-900"
                />
                Activer
              </label>
            </div>
            <div className="grid sm:grid-cols-2 gap-3.5">
              <Field label="Montant acompte USD ($)">
                <input
                  type="number"
                  step="0.5"
                  min={0.5}
                  value={form.reservation.depositUsd}
                  onChange={(e) =>
                    patch({
                      reservation: {
                        ...form.reservation,
                        depositUsd: Number(e.target.value),
                      },
                    })
                  }
                  className={ADMIN_INPUT_CLS}
                />
              </Field>
              <Field label="Équivalent indicatif LYD">
                <input
                  type="number"
                  min={0}
                  value={form.reservation.depositLyd}
                  onChange={(e) =>
                    patch({
                      reservation: {
                        ...form.reservation,
                        depositLyd: Number(e.target.value),
                      },
                    })
                  }
                  className={ADMIN_INPUT_CLS}
                />
              </Field>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-black text-stone-900">
              Formules tarifaires ({form.pricing.plans.length})
            </h2>
            <button
              type="button"
              onClick={() => {
                const n = form.pricing.plans.length + 1;
                patch({
                  pricing: {
                    ...form.pricing,
                    plans: [
                      ...form.pricing.plans,
                      {
                        id: `formule-${n}`,
                        name: "باقة جديدة",
                        nameEn: "New Package",
                        price: 1500,
                        priceUsd: 290,
                        originalPrice: null,
                        period: "دفعة واحدة",
                        periodEn: "one-time",
                        description: "وصف مختصر للباقة",
                        descriptionEn: "Short package description",
                        featured: false,
                        cta: "اختر الباقة",
                        ctaEn: "Choose plan",
                        features: ["تصميم متجاوب"],
                        featuresEn: ["Responsive design"],
                      },
                    ],
                  },
                });
              }}
              className="h-9 px-3.5 rounded-xl bg-stone-900 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> Ajouter une formule
            </button>
          </div>

          {form.pricing.plans.map((plan, idx) => (
            <div
              key={plan.id}
              className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4 shadow-2xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-700 text-xs font-bold">
                    Catégorie {idx + 1}
                  </span>
                  <span className="text-sm font-black text-stone-900">
                    {plan.nameEn} — {plan.name}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-700 mr-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={plan.featured}
                      onChange={(e) =>
                        updatePlan(idx, { featured: e.target.checked })
                      }
                      className="h-4 w-4 accent-stone-900"
                    />
                    Mise en avant
                  </label>
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => {
                      const copy = [...form.pricing.plans];
                      [copy[idx - 1], copy[idx]] = [copy[idx], copy[idx - 1]];
                      patch({ pricing: { ...form.pricing, plans: copy } });
                    }}
                    className="h-8 w-8 rounded-lg border border-stone-200 bg-stone-50 grid place-items-center disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === form.pricing.plans.length - 1}
                    onClick={() => {
                      const copy = [...form.pricing.plans];
                      [copy[idx + 1], copy[idx]] = [copy[idx], copy[idx + 1]];
                      patch({ pricing: { ...form.pricing, plans: copy } });
                    }}
                    className="h-8 w-8 rounded-lg border border-stone-200 bg-stone-50 grid place-items-center disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  {form.pricing.plans.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        patch({
                          pricing: {
                            ...form.pricing,
                            plans: form.pricing.plans.filter(
                              (_, i) => i !== idx,
                            ),
                          },
                        })
                      }
                      className="h-8 px-2.5 rounded-lg border border-red-200 bg-red-50 text-red-600 text-xs font-semibold cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <Field label="Nom (arabe)">
                  <input
                    dir="rtl"
                    value={plan.name}
                    onChange={(e) => updatePlan(idx, { name: e.target.value })}
                    className={ADMIN_INPUT_CLS}
                  />
                </Field>
                <Field label="Nom (anglais)">
                  <input
                    value={plan.nameEn}
                    onChange={(e) =>
                      updatePlan(idx, { nameEn: e.target.value })
                    }
                    className={ADMIN_INPUT_CLS}
                  />
                </Field>
                <Field label="Prix USD ($ — vide = sur devis)">
                  <input
                    type="number"
                    min={0}
                    value={plan.priceUsd ?? ""}
                    onChange={(e) =>
                      updatePlan(idx, {
                        priceUsd:
                          e.target.value.trim() === ""
                            ? null
                            : Number(e.target.value),
                      })
                    }
                    className={ADMIN_INPUT_CLS}
                  />
                </Field>
                <Field label="Prix LYD (équivalent)">
                  <input
                    type="number"
                    min={0}
                    value={plan.price}
                    onChange={(e) =>
                      updatePlan(idx, { price: Number(e.target.value) })
                    }
                    className={ADMIN_INPUT_CLS}
                  />
                </Field>
              </div>

              <div className="grid sm:grid-cols-2 gap-3.5">
                <Field label="Description (arabe)">
                  <input
                    dir="rtl"
                    value={plan.description}
                    onChange={(e) =>
                      updatePlan(idx, { description: e.target.value })
                    }
                    className={ADMIN_INPUT_CLS}
                  />
                </Field>
                <Field label="Description (anglais)">
                  <input
                    value={plan.descriptionEn}
                    onChange={(e) =>
                      updatePlan(idx, { descriptionEn: e.target.value })
                    }
                    className={ADMIN_INPUT_CLS}
                  />
                </Field>
                <Field label="Inclus (arabe — une ligne par avantage)">
                  <textarea
                    dir="rtl"
                    rows={4}
                    value={plan.features.join("\n")}
                    onChange={(e) =>
                      updatePlan(idx, {
                        features: e.target.value
                          .split("\n")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    className={ADMIN_TEXTAREA_CLS}
                  />
                </Field>
                <Field label="Inclus (anglais — une ligne par avantage)">
                  <textarea
                    rows={4}
                    value={plan.featuresEn.join("\n")}
                    onChange={(e) =>
                      updatePlan(idx, {
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
            </div>
          ))}
        </div>
      )}

      {/* --- TAB 4 : PAIEMENT LIBRE & SERVICES À LA CARTE --- */}
      {tab === "flex" && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black text-stone-900">
                  Paiement flexible (montant libre choisi par le client)
                </h2>
                <p className="text-xs text-stone-500">
                  Permet un règlement rapide du montant convenu sur WhatsApp.
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-bold text-stone-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.flexiblePayment.enabled}
                  onChange={(e) =>
                    patch({
                      flexiblePayment: {
                        ...form.flexiblePayment,
                        enabled: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4 accent-stone-900"
                />
                Activer
              </label>
            </div>

            <div className="grid sm:grid-cols-3 gap-3.5">
              <Field label="Minimum USD ($)">
                <input
                  type="number"
                  step="0.5"
                  min={0.5}
                  value={form.flexiblePayment.minUsd}
                  onChange={(e) =>
                    patch({
                      flexiblePayment: {
                        ...form.flexiblePayment,
                        minUsd: Number(e.target.value),
                      },
                    })
                  }
                  className={ADMIN_INPUT_CLS}
                />
              </Field>
              <Field label="Maximum USD ($)">
                <input
                  type="number"
                  min={1}
                  value={form.flexiblePayment.maxUsd}
                  onChange={(e) =>
                    patch({
                      flexiblePayment: {
                        ...form.flexiblePayment,
                        maxUsd: Number(e.target.value),
                      },
                    })
                  }
                  className={ADMIN_INPUT_CLS}
                />
              </Field>
              <Field label="Montants suggérés (séparés par virgule)">
                <input
                  value={form.flexiblePayment.suggested.join(", ")}
                  onChange={(e) =>
                    patch({
                      flexiblePayment: {
                        ...form.flexiblePayment,
                        suggested: e.target.value
                          .split(",")
                          .map((s) => Number(s.trim()))
                          .filter((n) => Number.isFinite(n) && n > 0),
                      },
                    })
                  }
                  className={ADMIN_INPUT_CLS}
                />
              </Field>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-black text-stone-900">
              Services ouverts à la carte ({form.standaloneServices.length})
            </h2>
            <button
              type="button"
              onClick={() => {
                patch({
                  standaloneServices: [
                    ...form.standaloneServices,
                    {
                      id: `srv-${Date.now().toString(36)}`,
                      icon: "sparkles",
                      titleAr: "خدمة جديدة",
                      titleEn: "New Standalone Service",
                      descAr: "وصف مختصر للخدمة",
                      descEn: "Short description of the standalone service",
                      priceFromUsd: 49,
                      priceFromLyd: 290,
                      featuresAr: ["تسليم سريع"],
                      featuresEn: ["Fast delivery"],
                    },
                  ],
                });
              }}
              className="h-9 px-3.5 rounded-xl bg-stone-900 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> Ajouter un service
            </button>
          </div>

          {form.standaloneServices.map((srv, idx) => (
            <div
              key={srv.id}
              className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3.5 shadow-2xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-black text-stone-900">
                  {srv.titleEn} — {srv.titleAr}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    patch({
                      standaloneServices: form.standaloneServices.filter(
                        (_, i) => i !== idx,
                      ),
                    })
                  }
                  className="h-8 px-2.5 rounded-lg border border-red-200 bg-red-50 text-red-600 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Supprimer
                </button>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <Field label="Icône">
                  <select
                    value={srv.icon}
                    onChange={(e) => updateService(idx, { icon: e.target.value })}
                    className={ADMIN_INPUT_CLS}
                  >
                    {SERVICE_ICON_IDS.map((iconId) => (
                      <option key={iconId} value={iconId}>
                        {iconId}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Prix dès USD ($)">
                  <input
                    type="number"
                    min={1}
                    value={srv.priceFromUsd}
                    onChange={(e) =>
                      updateService(idx, {
                        priceFromUsd: Number(e.target.value),
                      })
                    }
                    className={ADMIN_INPUT_CLS}
                  />
                </Field>
                <Field label="Prix dès LYD">
                  <input
                    type="number"
                    min={0}
                    value={srv.priceFromLyd}
                    onChange={(e) =>
                      updateService(idx, {
                        priceFromLyd: Number(e.target.value),
                      })
                    }
                    className={ADMIN_INPUT_CLS}
                  />
                </Field>
                <Field label="Titre (anglais)">
                  <input
                    value={srv.titleEn}
                    onChange={(e) =>
                      updateService(idx, { titleEn: e.target.value })
                    }
                    className={ADMIN_INPUT_CLS}
                  />
                </Field>
              </div>

              <div className="grid sm:grid-cols-3 gap-3.5">
                <Field label="Titre (arabe)">
                  <input
                    dir="rtl"
                    value={srv.titleAr}
                    onChange={(e) =>
                      updateService(idx, { titleAr: e.target.value })
                    }
                    className={ADMIN_INPUT_CLS}
                  />
                </Field>
                <Field label="Description (arabe)">
                  <input
                    dir="rtl"
                    value={srv.descAr}
                    onChange={(e) =>
                      updateService(idx, { descAr: e.target.value })
                    }
                    className={ADMIN_INPUT_CLS}
                  />
                </Field>
                <Field label="Description (anglais)">
                  <input
                    value={srv.descEn}
                    onChange={(e) =>
                      updateService(idx, { descEn: e.target.value })
                    }
                    className={ADMIN_INPUT_CLS}
                  />
                </Field>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Barre d'enregistrement fixe */}
      <div className="fixed bottom-4 left-4 right-4 lg:left-80 lg:right-8 z-30">
        <div className="max-w-5xl mx-auto rounded-2xl border border-stone-300 bg-white/95 backdrop-blur px-4 py-3 shadow-xl flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-stone-600">
            {dirty ? (
              <span className="font-bold text-[#8A6D2F]">
                ● Modifications globales en attente d’enregistrement.
              </span>
            ) : (
              <span>Configuration synchronisée avec le site public.</span>
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
              {pending ? "Enregistrement…" : "Enregistrer les réglages"}
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
