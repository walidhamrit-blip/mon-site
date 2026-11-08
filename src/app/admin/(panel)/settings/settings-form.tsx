"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
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
import { THEMES, resolveThemeId } from "@/lib/themes";
import { MARKET_PRESETS } from "@/lib/market";
import { CURRENCY_CATALOG, DEFAULT_RATES } from "@/lib/currency";

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
import { PhoneCardPaymentsToggle } from "../phone-card-payments-toggle";

type SettingsTab =
  | "appearance"
  | "contact"
  | "market"
  | "pricing"
  | "flex"
  | "fazercards"
  | "trust";

interface Props {
  initial: SiteConfigData;
  initialTab?: string;
}

export function SettingsForm({ initial, initialTab }: Props) {
  const router = useRouter();
  const { resetToSiteDefaults } = useTheme();
  const resolveTab = (raw?: string): SettingsTab => {
    if (raw === "contact") return "contact";
    if (raw === "market" || raw === "currency") return "market";
    if (raw === "pricing") return "pricing";
    if (raw === "flex" || raw === "services") return "flex";
    if (raw === "fazercards" || raw === "boutique" || raw === "digital") {
      return "fazercards";
    }
    if (raw === "trust" || raw === "avis" || raw === "reviews" || raw === "legal") {
      return "trust";
    }
    return "appearance";
  };

  const [tab, setTab] = useState<SettingsTab>(resolveTab(initialTab));
  const [form, setForm] = useState<SiteConfigData>({
    ...initial,
    fazercards: {
      maxOrderUsd:
        Number.isFinite(Number(initial.fazercards?.maxOrderUsd)) &&
        Number(initial.fazercards?.maxOrderUsd) > 0
          ? Number(initial.fazercards.maxOrderUsd)
          : 25,
      phoneCardPaymentsEnabled: initial.fazercards?.phoneCardPaymentsEnabled !== false,
      phoneCardRateMode: initial.fazercards?.phoneCardRateMode === "manual" ? "manual" : "auto",
      phoneCardManualRateLyd:
        Number.isFinite(Number(initial.fazercards?.phoneCardManualRateLyd)) &&
        Number(initial.fazercards?.phoneCardManualRateLyd) > 0
          ? Number(initial.fazercards.phoneCardManualRateLyd)
          : null,
      phoneCardManualRateUpdatedAt:
        typeof initial.fazercards?.phoneCardManualRateUpdatedAt === "string"
          ? initial.fazercards.phoneCardManualRateUpdatedAt
          : null,
    },
  });
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
    { id: "market", label: "Marché & Devises" },
    { id: "pricing", label: "Formules & Réservation 1 $" },
    { id: "flex", label: "Paiement libre & Services à la carte" },
    { id: "fazercards", label: "Boutique & FazerCards" },
    { id: "trust", label: "Avis & Mentions légales" },
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
                const selected = resolveThemeId(form.appearance.themeId) === theme.id;
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

              <Field label="Langue de référence (HTML + SEO)">
                <select
                  value={form.appearance.primaryLocale}
                  onChange={(e) =>
                    patch({
                      appearance: {
                        ...form.appearance,
                        primaryLocale: e.target.value as "auto" | "ar" | "en",
                      },
                    })
                  }
                  className={ADMIN_INPUT_CLS}
                >
                  <option value="auto">Auto — langue du marché (recommandé)</option>
                  <option value="ar">Arabe (RTL)</option>
                  <option value="en">Anglais (LTR)</option>
                </select>
                <p className="mt-1.5 text-[11px] leading-5 text-stone-500">
                  C&apos;est la langue servie aux moteurs de recherche
                  (titre, description, <code>&lt;html lang&gt;</code>) et le
                  défaut du site. « Auto » suit le pays du marché : arabe pour
                  la Libye. Le visiteur peut toujours basculer la langue.
                </p>
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
              {/* A11 : « sites livrés », « satisfaction » et « support
                  24/7 » retirés — chiffres non sourcés, ne doivent pas
                  être réintroduits via l'admin. */}
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

      {/* --- ONGLET : AVIS & MENTIONS LÉGALES --- */}
      {tab === "trust" && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 space-y-5 shadow-2xs">
            <div>
              <h2 className="text-sm font-black text-stone-900">
                Profils d’avis (Trustpilot, Google, Scamadviser)
              </h2>
              <p className="text-xs text-stone-500 mt-1 leading-5">
                Collez ici l’adresse <strong>publique</strong> de vos profils, une fois
                créés. Tant qu’un champ est vide, aucun lien n’est affiché sur le site
                et aucun avis n’est demandé par e-mail : un lien vers un profil qui
                n’existe pas encore dégrade la confiance au lieu de la construire.
                <br />
                Aucune note n’est saisie à la main : la moyenne affichée doit venir
                de la plateforme elle-même.
              </p>
            </div>

            <div className="grid gap-3.5">
              <Field label="Profil Trustpilot (https://fr.trustpilot.com/review/votre-domaine)">
                <input
                  value={form.trust.trustpilotUrl}
                  onChange={(e) =>
                    patch({ trust: { ...form.trust, trustpilotUrl: e.target.value } })
                  }
                  placeholder="https://fr.trustpilot.com/review/exemple.com"
                  className={ADMIN_INPUT_CLS}
                />
              </Field>
              <Field label="Lien direct « écrire un avis » Trustpilot (facultatif, https://www.trustpilot.com/evaluate/votre-domaine)">
                <input
                  value={form.trust.trustpilotReviewUrl}
                  onChange={(e) =>
                    patch({
                      trust: { ...form.trust, trustpilotReviewUrl: e.target.value },
                    })
                  }
                  placeholder="https://www.trustpilot.com/evaluate/exemple.com"
                  className={ADMIN_INPUT_CLS}
                />
                <span className="mt-1 block text-[11px] leading-4 text-stone-500">
                  C’est ce lien qui part dans les e-mails de demande d’avis : il
                  ouvre directement le formulaire, sans repasser par la fiche.
                  Laissez vide pour envoyer la fiche publique.
                </span>
              </Field>
              <Field label="Lien « laisser un avis » Google (fiche Google Business)">
                <input
                  value={form.trust.googleReviewUrl}
                  onChange={(e) =>
                    patch({ trust: { ...form.trust, googleReviewUrl: e.target.value } })
                  }
                  placeholder="https://g.page/r/…/review"
                  className={ADMIN_INPUT_CLS}
                />
              </Field>
              <Field label="Fiche Scamadviser (https://www.scamadviser.com/check-website/votre-domaine)">
                <input
                  value={form.trust.scamadviserUrl}
                  onChange={(e) =>
                    patch({ trust: { ...form.trust, scamadviserUrl: e.target.value } })
                  }
                  placeholder="https://www.scamadviser.com/check-website/exemple.com"
                  className={ADMIN_INPUT_CLS}
                />
              </Field>
            </div>

            <div className="rounded-xl border border-stone-200 bg-stone-50 p-3.5 space-y-3.5">
              <div>
                <p className="text-[12.5px] font-black text-stone-800">
                  Widget Trustpilot (TrustBox)
                </p>
                <p className="text-[11.5px] leading-4 text-stone-500 mt-0.5">
                  Le badge lit la note publique de la fiche. Il reste masqué
                  tant qu’il n’y a pas assez d’avis : un profil vide afficherait
                  « 0,0 / 5 », ce qui dégrade la confiance.
                </p>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <Field label="Identifiant du compte Trustpilot">
                  <input
                    value={form.trust.businessUnitId}
                    onChange={(e) =>
                      patch({
                        trust: {
                          ...form.trust,
                          businessUnitId: e.target.value.trim(),
                        },
                      })
                    }
                    placeholder="6aed0b0c0156593a344109f3"
                    className={ADMIN_INPUT_CLS}
                  />
                </Field>
                <Field label="Gabarit du widget">
                  <select
                    value={form.trust.widgetTemplate}
                    onChange={(e) =>
                      patch({
                        trust: { ...form.trust, widgetTemplate: e.target.value },
                      })
                    }
                    className={ADMIN_INPUT_CLS}
                  >
                    <option value="micro-combo">Micro combo — note + étoiles + avis</option>
                    <option value="micro-star">Micro étoiles — étoiles seules</option>
                    <option value="micro-review-count">Micro compteur — nombre d’avis</option>
                    <option value="micro-trustscore">Micro TrustScore — note seule</option>
                    <option value="mini">Mini — encart complet</option>
                    <option value="review-collector">Collecteur — appeler à écrire un avis</option>
                    <option value="starter">Starter — liste d’avis</option>
                  </select>
                </Field>
                <Field label="Afficher à partir de (nombre d’avis)">
                  <input
                    type="number"
                    min={0}
                    max={1000}
                    value={form.trust.widgetMinReviews}
                    onChange={(e) =>
                      patch({
                        trust: {
                          ...form.trust,
                          widgetMinReviews: Math.max(0, Number(e.target.value) || 0),
                        },
                      })
                    }
                    className={ADMIN_INPUT_CLS}
                  />
                </Field>
              </div>
            </div>

            <label className="flex items-start gap-2.5 rounded-xl border border-stone-200 bg-stone-50 p-3.5">
              <input
                type="checkbox"
                checked={form.trust.reviewInvites}
                onChange={(e) =>
                  patch({ trust: { ...form.trust, reviewInvites: e.target.checked } })
                }
                className="mt-0.5 h-4 w-4 accent-[#B8923F]"
              />
              <span className="text-[12.5px] leading-5 text-stone-700">
                <strong className="font-black">Demander un avis après livraison</strong>
                <br />
                Ajoute un bloc bilingue « comment était votre expérience ? » dans
                l’e-mail des codes et dans le reçu de recette d’un site. La demande
                s’adresse à <strong>tous</strong> les clients livrés (jamais aux seuls
                clients satisfaits), sans contrepartie et sans consigne de note.
                Nécessite au moins un profil Trustpilot ou Google ci-dessus.
              </span>
            </label>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 space-y-5 shadow-2xs">
            <div>
              <h2 className="text-sm font-black text-stone-900">
                Identité légale — page /mentions-legales
              </h2>
              <p className="text-xs text-stone-500 mt-1 leading-5">
                Ces informations sont ce que vérifient un client méfiant… et les
                algorithmes de réputation. Un champ laissé vide est
                <strong> omis</strong> de la page : rien n’est inventé.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-3.5">
              <Field label="Raison sociale (si différente de la marque)">
                <input
                  value={form.legal.companyName}
                  onChange={(e) =>
                    patch({ legal: { ...form.legal, companyName: e.target.value } })
                  }
                  className={ADMIN_INPUT_CLS}
                />
              </Field>
              <Field label="Responsable de la publication">
                <input
                  value={form.legal.publisherName}
                  onChange={(e) =>
                    patch({ legal: { ...form.legal, publisherName: e.target.value } })
                  }
                  className={ADMIN_INPUT_CLS}
                />
              </Field>
              <Field label="Numéro de registre de commerce">
                <input
                  value={form.legal.registrationNumber}
                  onChange={(e) =>
                    patch({ legal: { ...form.legal, registrationNumber: e.target.value } })
                  }
                  className={ADMIN_INPUT_CLS}
                />
              </Field>
              <Field label="Autorité / ville d’immatriculation">
                <input
                  value={form.legal.registrationAuthority}
                  onChange={(e) =>
                    patch({ legal: { ...form.legal, registrationAuthority: e.target.value } })
                  }
                  placeholder="مصلحة السجل التجاري — طرابلس"
                  className={ADMIN_INPUT_CLS}
                />
              </Field>
              <Field label="Hébergeur">
                <input
                  value={form.legal.hostName}
                  onChange={(e) =>
                    patch({ legal: { ...form.legal, hostName: e.target.value } })
                  }
                  className={ADMIN_INPUT_CLS}
                />
              </Field>
              <Field label="Site de l’hébergeur (https://…)">
                <input
                  value={form.legal.hostWebsite}
                  onChange={(e) =>
                    patch({ legal: { ...form.legal, hostWebsite: e.target.value } })
                  }
                  className={ADMIN_INPUT_CLS}
                />
              </Field>
            </div>
          </div>
        </div>
      )}

      {/* --- ONGLET : MARCHÉ & DEVISES (portée mondiale) --- */}
      {tab === "market" && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 space-y-5 shadow-2xs">
            <div>
              <h2 className="text-sm font-black text-stone-900">
                Marché de référence
              </h2>
              <p className="mt-1 text-[12.5px] leading-5 text-stone-500">
                Tout ce qui était codé en dur sur Tripoli / Libye en découle :
                métadonnées SEO, données structurées, fuseau horaire des
                échéances, lien Google Maps et libellés du site. Changer de
                marché ici suffit — aucun redéploiement nécessaire.
              </p>
            </div>

            <Field label="Marché prédéfini (applique un profil complet)">
              <select
                value={form.market.id}
                onChange={(e) => {
                  const preset = MARKET_PRESETS.find((m) => m.id === e.target.value);
                  if (!preset) return;
                  patch({
                    market: {
                      ...form.market,
                      ...preset,
                      globalReach: form.market.globalReach,
                    },
                  });
                }}
                className={ADMIN_INPUT_CLS}
              >
                {MARKET_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.cityEn} — {preset.countryEn} ({preset.currency})
                  </option>
                ))}
              </select>
            </Field>

            <label className="flex items-start gap-2.5 rounded-xl border border-stone-200 bg-[#FAF9F6] p-3.5">
              <input
                type="checkbox"
                checked={form.market.globalReach}
                onChange={(e) =>
                  patch({ market: { ...form.market, globalReach: e.target.checked } })
                }
                className="mt-0.5 h-4 w-4 accent-[#B8923F]"
              />
              <span className="text-[12.5px] leading-5 text-stone-700">
                <strong className="font-black">Positionnement international</strong>
                <br />
                Le site se déclare accessible mondialement : zone desservie
                « Worldwide » dans les données structurées, formulation
                internationale dans les descriptions, et devise de facturation
                en dollars. Gardez-le actif même en restant ancré à Tripoli.
              </span>
            </label>

            <div className="grid gap-3.5 sm:grid-cols-2">
              <Field label="Ville (arabe)">
                <input
                  dir="rtl"
                  value={form.market.cityAr}
                  onChange={(e) =>
                    patch({ market: { ...form.market, cityAr: e.target.value } })
                  }
                  className={ADMIN_INPUT_CLS}
                />
              </Field>
              <Field label="Ville (anglais)">
                <input
                  value={form.market.cityEn}
                  onChange={(e) =>
                    patch({ market: { ...form.market, cityEn: e.target.value } })
                  }
                  className={ADMIN_INPUT_CLS}
                />
              </Field>
              <Field label="Pays (arabe)">
                <input
                  dir="rtl"
                  value={form.market.countryAr}
                  onChange={(e) =>
                    patch({ market: { ...form.market, countryAr: e.target.value } })
                  }
                  className={ADMIN_INPUT_CLS}
                />
              </Field>
              <Field label="Pays (anglais)">
                <input
                  value={form.market.countryEn}
                  onChange={(e) =>
                    patch({ market: { ...form.market, countryEn: e.target.value } })
                  }
                  className={ADMIN_INPUT_CLS}
                />
              </Field>
              <Field label="Code pays (ISO)">
                <input
                  value={form.market.countryCode}
                  onChange={(e) =>
                    patch({
                      market: {
                        ...form.market,
                        countryCode: e.target.value.toUpperCase().slice(0, 4),
                      },
                    })
                  }
                  className={ADMIN_INPUT_CLS}
                />
              </Field>
              <Field label="Fuseau horaire (IANA)">
                <input
                  value={form.market.timezone}
                  onChange={(e) =>
                    patch({ market: { ...form.market, timezone: e.target.value } })
                  }
                  className={ADMIN_INPUT_CLS}
                />
              </Field>
              <Field label="Langue du marché (BCP-47)">
                <input
                  value={form.market.locale}
                  onChange={(e) =>
                    patch({ market: { ...form.market, locale: e.target.value } })
                  }
                  className={ADMIN_INPUT_CLS}
                />
              </Field>
              <Field label="Indicatif téléphonique">
                <input
                  value={form.market.phonePrefix}
                  onChange={(e) =>
                    patch({ market: { ...form.market, phonePrefix: e.target.value } })
                  }
                  className={ADMIN_INPUT_CLS}
                />
              </Field>
              <Field label="Latitude">
                <input
                  type="number"
                  step="0.0001"
                  value={form.market.lat}
                  onChange={(e) =>
                    patch({
                      market: { ...form.market, lat: Number(e.target.value) || 0 },
                    })
                  }
                  className={ADMIN_INPUT_CLS}
                />
              </Field>
              <Field label="Longitude">
                <input
                  type="number"
                  step="0.0001"
                  value={form.market.lng}
                  onChange={(e) =>
                    patch({
                      market: { ...form.market, lng: Number(e.target.value) || 0 },
                    })
                  }
                  className={ADMIN_INPUT_CLS}
                />
              </Field>
              <Field label="Rayon de service local (km) — 0 = aucune zone locale">
                <input
                  type="number"
                  value={form.market.localRadiusKm}
                  onChange={(e) =>
                    patch({
                      market: {
                        ...form.market,
                        localRadiusKm: Number(e.target.value) || 0,
                      },
                    })
                  }
                  className={ADMIN_INPUT_CLS}
                />
              </Field>
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 space-y-5 shadow-2xs">
            <div>
              <h2 className="text-sm font-black text-stone-900">
                Devises d&apos;affichage
              </h2>
              <p className="mt-1 text-[12.5px] leading-5 text-stone-500">
                La facturation reste en dollars (c&apos;est ce qu&apos;encaisse la
                passerelle). Ces taux servent uniquement à convertir les prix
                affichés dans la devise choisie par le visiteur. 1 USD = X.
              </p>
            </div>

            <Field label="Devises proposées dans le sélecteur">
              <div className="flex flex-wrap gap-2 pt-1">
                {(Object.keys(CURRENCY_CATALOG) as (keyof typeof CURRENCY_CATALOG)[]).map(
                  (code) => {
                    const active = form.currency.enabled.includes(code);
                    return (
                      <button
                        key={code}
                        type="button"
                        onClick={() =>
                          patch({
                            currency: {
                              ...form.currency,
                              enabled: active
                                ? form.currency.enabled.filter((c) => c !== code)
                                : [...form.currency.enabled, code],
                              rates: {
                                ...form.currency.rates,
                                [code]: form.currency.rates[code] ?? DEFAULT_RATES[code],
                              },
                            },
                          })
                        }
                        className={`rounded-full border px-3 py-1.5 text-[12px] font-bold transition-colors ${
                          active
                            ? "border-[#B8923F] bg-[#C6A664]/25 text-stone-900"
                            : "border-stone-300 bg-white text-stone-500"
                        }`}
                      >
                        {CURRENCY_CATALOG[code].shortEn} ·{" "}
                        {CURRENCY_CATALOG[code].labelEn}
                      </button>
                    );
                  },
                )}
              </div>
            </Field>

            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {form.currency.enabled.map((code) => (
                <Field key={code} label={`Taux — 1 USD = ? ${code}`}>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    value={form.currency.rates[code] ?? 1}
                    onChange={(e) =>
                      patch({
                        currency: {
                          ...form.currency,
                          rates: {
                            ...form.currency.rates,
                            [code]: Number(e.target.value) || 1,
                          },
                        },
                      })
                    }
                    className={ADMIN_INPUT_CLS}
                  />
                </Field>
              ))}
            </div>

            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-[12px] leading-5 text-amber-900">
              Un taux erroné affiche un prix faux : vérifiez les taux avant de
              publier. Le taux du dollar est toujours forcé à 1.
            </p>
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
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-black text-stone-900">
                Modèle + personnalisation ({form.pricing.plans.length} formules)
              </h2>
              <p className="mt-1 text-xs text-stone-500">
                La personnalisation est calculée en pourcentage du prix du modèle (20 % par défaut). Champ vide = devis final requis avant tout paiement.
              </p>
            </div>
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
                        priceUsd: 290,
                        customizationPercent: 20,
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

              <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
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
                <Field label="Prix du modèle USD ($ — vide = sur devis)">
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
                <Field label="Personnalisation (% du modèle — vide = devis)">
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    max={100}
                    value={plan.customizationPercent ?? ""}
                    onChange={(e) =>
                      updatePlan(idx, {
                        customizationPercent:
                          e.target.value.trim() === ""
                            ? null
                            : Number(e.target.value),
                      })
                    }
                    placeholder="20 %"
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

      {tab === "fazercards" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 shadow-xs space-y-5">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#8A6D2F]">
                Boutique digitale · FazerCards
              </span>
              <h2 className="mt-1 text-lg font-extrabold text-stone-900">
                Plafond de commande maximale chez FazerCards
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-stone-500 leading-relaxed max-w-2xl">
                Définit le montant maximal en USD autorisé pour une seule commande dans la boutique{" "}
                <span className="font-mono text-stone-700">/codes</span> (par défaut{" "}
                <strong>25 $</strong>). Au-delà de ce montant, l’achat en ligne est bloqué avant la
                facturation crypto et le client est invité à réduire la quantité ou à vous contacter
                sur WhatsApp. Ce réglage prend effet immédiatement sans redéploiement.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 items-end">
              <Field label="Valeur maximale d’une commande FazerCards ($ USD)">
                <div className="relative">
                  <input
                    type="number"
                    min={1.5}
                    max={10000}
                    step="0.5"
                    dir="ltr"
                    value={form.fazercards?.maxOrderUsd ?? 25}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      patch({
                        fazercards: {
                          ...form.fazercards,
                          maxOrderUsd: Number.isFinite(val) ? val : 0,
                        },
                      });
                    }}
                    className={`${ADMIN_INPUT_CLS} pr-14 font-mono text-base font-bold`}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-bold text-stone-400">
                    USD $
                  </span>
                </div>
              </Field>

              <div className="space-y-1.5">
                <span className="block text-xs font-semibold text-stone-600">
                  Valeurs rapides
                </span>
                <div className="flex flex-wrap gap-2">
                  {[15, 25, 50, 100, 250].map((preset) => {
                    const active = Number(form.fazercards?.maxOrderUsd) === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() =>
                          patch({
                            fazercards: {
                              ...form.fazercards,
                              maxOrderUsd: preset,
                            },
                          })
                        }
                        className={`h-9 px-3.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                          active
                            ? "border-[#8A6D2F] bg-[#8A6D2F] text-white"
                            : "border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100"
                        }`}
                      >
                        {preset} $
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 text-xs text-amber-900 space-y-1 leading-relaxed">
              <p className="font-semibold">
                Cohérence avec votre solde fournisseur FazerCards
              </p>
              <p>
                Assurez-vous que votre solde revendeur FazerCards couvre le coût fournisseur d’une
                commande à{" "}
                <strong>
                  {Number(form.fazercards?.maxOrderUsd ?? 25).toFixed(2)} $
                </strong>{" "}
                afin que toutes les ventes jusqu’à ce plafond soient livrées automatiquement.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <Link
                href="/admin/digital"
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100"
              >
                Voir le solde & la couverture FazerCards →
              </Link>
              <Link
                href="/admin/digital/products"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#C6A664]/50 bg-[#C6A664]/10 px-3.5 py-2 text-xs font-semibold text-[#8A6D2F] hover:bg-[#C6A664]/20"
              >
                Modifier les cartes cadeaux & produits (SEO/GEO) →
              </Link>
            </div>
          </div>

          <PhoneCardPaymentsToggle enabled={initial.fazercards?.phoneCardPaymentsEnabled !== false} />

          <div className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 shadow-xs space-y-5">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#8A6D2F]">
                Cartes téléphoniques · Prix en LYD
              </span>
              <h2 className="mt-1 text-lg font-extrabold text-stone-900">
                Taux du marché parallèle et majoration de 20 %
              </h2>
              <p className="mt-1 max-w-3xl text-xs sm:text-sm text-stone-500 leading-relaxed">
                Le client voit et accepte un devis indicatif calculé ainsi :{" "}
                <strong className="text-stone-800">total USDT × taux LYD × 120 %</strong>.
                Les 20 % compensent la détérioration de valeur à la revente des cartes. Ce devis
                ne remplace pas la vérification manuelle du crédit.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Source du taux">
                <select
                  value={form.fazercards?.phoneCardRateMode ?? "auto"}
                  onChange={(e) =>
                    patch({
                      fazercards: {
                        ...form.fazercards,
                        phoneCardRateMode: e.target.value === "manual" ? "manual" : "auto",
                      },
                    })
                  }
                  className={ADMIN_INPUT_CLS}
                >
                  <option value="auto">Médiane Telegram + Fulus/secours manuel</option>
                  <option value="manual">Taux manuel uniquement</option>
                </select>
              </Field>
              <Field label="Taux manuel : 1 USD / USDT = … LYD">
                <input
                  type="number"
                  min={0.0001}
                  max={10000}
                  step="0.0001"
                  dir="ltr"
                  value={form.fazercards?.phoneCardManualRateLyd ?? ""}
                  onChange={(e) => {
                    const value = e.target.value === "" ? null : e.target.valueAsNumber;
                    patch({
                      fazercards: {
                        ...form.fazercards,
                        phoneCardManualRateLyd:
                          value == null || !Number.isFinite(value) ? null : value,
                      },
                    });
                  }}
                  placeholder="Ex. 9.84"
                  className={`${ADMIN_INPUT_CLS} font-mono text-base font-bold`}
                />
              </Field>
            </div>

            {form.fazercards?.phoneCardManualRateUpdatedAt && (
              <p className="text-xs text-stone-500">
                Dernière modification du taux manuel :{" "}
                {new Date(form.fazercards.phoneCardManualRateUpdatedAt).toLocaleString("fr-FR", {
                  timeZone: "Africa/Tripoli",
                })}
                {" "}(heure de Tripoli).
              </p>
            )}

            <div className="rounded-xl border border-[#C6A664]/40 bg-[#C6A664]/10 px-4 py-3 text-xs leading-relaxed text-stone-700">
              {Number(form.fazercards?.phoneCardManualRateLyd) > 0 ? (
                <p dir="ltr" className="font-mono font-bold text-stone-900">
                  5 USDT → {(5 * Number(form.fazercards.phoneCardManualRateLyd) * 1.2).toFixed(2)} LYD
                  {" · "}
                  10 USDT → {(10 * Number(form.fazercards.phoneCardManualRateLyd) * 1.2).toFixed(2)} LYD
                </p>
              ) : (
                <p>Saisissez un taux manuel pour afficher les exemples de 5 et 10 USDT.</p>
              )}
              <p className="mt-2">
                En mode automatique, le serveur calcule la médiane des dollars en espèces publiés par
                <code> @dollar_ly</code>, <code>@lydollar</code> et <code>@suqalmushir</code>.
                Au moins deux publications de moins de 36 heures, cohérentes entre elles à 3 %,
                sont exigées. Les dates incohérentes, chèques et taux bancaires sont ignorés.
                <code> FULUS_API_KEY</code> est un secours facultatif ; le taux manuel ci-dessus
                prend ensuite le relais. Sans aucun taux disponible, le dépôt est bloqué plutôt que
                d’inventer un prix.
              </p>
            </div>
          </div>
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
