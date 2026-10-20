"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ExternalLink,
  Layers,
  Plus,
  RotateCcw,
  Smartphone,
  Trash2,
} from "lucide-react";
import { resetContentSection, saveContentSection } from "@/app/admin/actions";
import type {
  LaunchStatus,
  ShowcasePageConfig,
  UpcomingCatalogItem,
} from "@/lib/site-types";
import { ADMIN_INPUT_CLS, ADMIN_TEXTAREA_CLS } from "../site-item-editor";

interface Props {
  initialAppsPage: ShowcasePageConfig;
  initialProductsPage: ShowcasePageConfig;
}

function makeBlankUpcomingItem(
  kind: "apps" | "products",
  existingCount: number,
): UpcomingCatalogItem {
  const n = existingCount + 1;
  if (kind === "apps") {
    return {
      id: `app-${Date.now().toString(36)}`,
      slug: `application-${n}`,
      status: "in_preparation",
      badgeAr: "قيد التحضير",
      badgeEn: "In Preparation",
      categoryAr: "تطبيقات ذكية",
      categoryEn: "Smart Apps",
      titleAr: "تطبيق جديد قيد التحضير",
      titleEn: "New Application in Preparation",
      descriptionAr:
        "وصف مختصر للتطبيق الجديد ومزاياه الرئيسية للعملاء في طرابلس وليبيا.",
      descriptionEn:
        "Short overview of the upcoming mobile & web application and its key benefits.",
      image:
        "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=1200&q=80",
      color: "#C6A664",
      platforms: ["iOS", "Android", "Web"],
      featuresAr: ["واجهة عربية وإنجليزية", "إشعارات فورية"],
      featuresEn: ["Arabic & English UI", "Instant push notifications"],
      progress: 70,
      priceHintUsd: null,
      demoUrl: "",
    };
  }
  return {
    id: `prod-${Date.now().toString(36)}`,
    slug: `produit-num-${n}`,
    status: "coming_soon",
    badgeAr: "قريباً",
    badgeEn: "Coming Soon",
    categoryAr: "برامج وأنظمة",
    categoryEn: "Software & SaaS",
    titleAr: "منتج رقمي أو برنامج جديد",
    titleEn: "New Digital Product / Software",
    descriptionAr:
      "وصف مختصر للبرنامج أو المنتج الرقمي القادم وأهم ما يقدّمه لأصحاب الأعمال.",
    descriptionEn:
      "Short overview of the upcoming software solution or digital kit.",
    image:
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80",
    color: "#C6A664",
    platforms: ["Web Cloud", "Desktop"],
    featuresAr: ["سهل الاستخدام", "دعم فني متواصل"],
    featuresEn: ["Easy setup", "Dedicated support"],
    progress: 75,
    priceHintUsd: null,
    demoUrl: "",
  };
}

export function CatalogEditor({
  initialAppsPage,
  initialProductsPage,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"apps" | "products">("apps");
  const [appsPage, setAppsPage] = useState<ShowcasePageConfig>(initialAppsPage);
  const [productsPage, setProductsPage] =
    useState<ShowcasePageConfig>(initialProductsPage);
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});
  const [dirtyApps, setDirtyApps] = useState(false);
  const [dirtyProducts, setDirtyProducts] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  const flash = (msg: string, kind: "ok" | "err") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 4000);
  };

  const currentPage = tab === "apps" ? appsPage : productsPage;
  const isDirty = tab === "apps" ? dirtyApps : dirtyProducts;

  const setCurrentPage = (next: ShowcasePageConfig) => {
    if (tab === "apps") {
      setAppsPage(next);
      setDirtyApps(true);
    } else {
      setProductsPage(next);
      setDirtyProducts(true);
    }
  };

  const addItem = () => {
    const blank = makeBlankUpcomingItem(tab, currentPage.items.length);
    setCurrentPage({
      ...currentPage,
      items: [blank, ...currentPage.items],
    });
    setOpenIds((prev) => ({ ...prev, [blank.id]: true }));
  };

  const updateItem = (idx: number, patch: Partial<UpcomingCatalogItem>) => {
    const copy = [...currentPage.items];
    copy[idx] = { ...copy[idx], ...patch };
    setCurrentPage({ ...currentPage, items: copy });
  };

  const moveItem = (idx: number, delta: -1 | 1) => {
    const target = idx + delta;
    if (target < 0 || target >= currentPage.items.length) return;
    const copy = [...currentPage.items];
    [copy[idx], copy[target]] = [copy[target], copy[idx]];
    setCurrentPage({ ...currentPage, items: copy });
  };

  const deleteItem = (idx: number) => {
    const item = currentPage.items[idx];
    if (
      !confirm(
        `Supprimer « ${item.titleEn || item.titleAr} » de cette page ?`,
      )
    ) {
      return;
    }
    setCurrentPage({
      ...currentPage,
      items: currentPage.items.filter((_, i) => i !== idx),
    });
  };

  const onSave = () => {
    const sectionKey = tab === "apps" ? "appsPage" : "productsPage";
    startTransition(async () => {
      const res = await saveContentSection(sectionKey, currentPage);
      if (res.ok) {
        if (tab === "apps") setDirtyApps(false);
        else setDirtyProducts(false);
        flash(res.message ?? "Page enregistrée.", "ok");
        router.refresh();
      } else {
        flash(res.error ?? "Échec de l’enregistrement.", "err");
      }
    });
  };

  const onReset = () => {
    const sectionKey = tab === "apps" ? "appsPage" : "productsPage";
    if (!confirm("Réinitialiser cette page à ses valeurs par défaut ?")) return;
    startTransition(async () => {
      const res = await resetContentSection(sectionKey);
      if (res.ok) {
        if (tab === "apps") setDirtyApps(false);
        else setDirtyProducts(false);
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
            Pages « En préparation / Prochainement »
          </span>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-stone-900 mt-0.5">
            Applications & Produits numériques
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            Pilotez les textes, statuts (« En préparation », « Prochainement », « Disponible ») et fiches de vos 2 nouvelles pages publiques.
          </p>
        </div>

        <Link
          href={tab === "apps" ? "/apps" : "/products"}
          target="_blank"
          className="h-10 px-4 rounded-xl border border-stone-300 bg-white text-stone-800 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 hover:bg-stone-50"
        >
          Voir {tab === "apps" ? "/apps" : "/products"}{" "}
          <ExternalLink className="h-3.5 w-3.5 text-[#8A6D2F]" />
        </Link>
      </div>

      {/* Sélecteur d'onglet entre les 2 pages */}
      <div className="grid sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setTab("apps")}
          className={`rounded-2xl border p-4 text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
            tab === "apps"
              ? "border-[#C6A664] bg-white ring-1 ring-[#C6A664]/40 shadow-sm"
              : "border-stone-200 bg-white/70 hover:bg-white"
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className={`h-10 w-10 rounded-xl grid place-items-center ${
                tab === "apps"
                  ? "bg-stone-900 text-[#E5CA87]"
                  : "bg-stone-100 text-stone-600"
              }`}
            >
              <Smartphone className="h-5 w-5" />
            </span>
            <div>
              <div className="text-sm font-black text-stone-900">
                Page « Nos applications »
              </div>
              <div className="text-xs text-stone-500">
                /apps · {appsPage.items.length} application
                {appsPage.items.length > 1 ? "s" : ""}
              </div>
            </div>
          </div>
          {dirtyApps && (
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setTab("products")}
          className={`rounded-2xl border p-4 text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
            tab === "products"
              ? "border-[#C6A664] bg-white ring-1 ring-[#C6A664]/40 shadow-sm"
              : "border-stone-200 bg-white/70 hover:bg-white"
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className={`h-10 w-10 rounded-xl grid place-items-center ${
                tab === "products"
                  ? "bg-stone-900 text-[#E5CA87]"
                  : "bg-stone-100 text-stone-600"
              }`}
            >
              <Layers className="h-5 w-5" />
            </span>
            <div>
              <div className="text-sm font-black text-stone-900">
                Page « Produits numériques & logiciels »
              </div>
              <div className="text-xs text-stone-500">
                /products · {productsPage.items.length} produit
                {productsPage.items.length > 1 ? "s" : ""}
              </div>
            </div>
          </div>
          {dirtyProducts && (
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
          )}
        </button>
      </div>

      {/* Bloc 1 : En-tête & bannière de statut de la page */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4 shadow-2xs">
        <h2 className="text-sm font-black text-stone-900">
          En-tête & mention « En préparation / Prochainement »
        </h2>

        <div className="grid sm:grid-cols-2 gap-3.5">
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-stone-600">
              Badge de statut en haut (arabe — ex: قيد التحضير • قريباً)
            </span>
            <input
              dir="rtl"
              value={currentPage.statusBadgeAr}
              onChange={(e) =>
                setCurrentPage({ ...currentPage, statusBadgeAr: e.target.value })
              }
              className={ADMIN_INPUT_CLS}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-stone-600">
              Badge de statut en haut (anglais — ex: In Preparation • Coming Soon)
            </span>
            <input
              value={currentPage.statusBadgeEn}
              onChange={(e) =>
                setCurrentPage({ ...currentPage, statusBadgeEn: e.target.value })
              }
              className={ADMIN_INPUT_CLS}
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-stone-600">
              Titre principal (arabe)
            </span>
            <input
              dir="rtl"
              value={currentPage.titleAr}
              onChange={(e) =>
                setCurrentPage({ ...currentPage, titleAr: e.target.value })
              }
              className={ADMIN_INPUT_CLS}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-stone-600">
              Titre principal (anglais)
            </span>
            <input
              value={currentPage.titleEn}
              onChange={(e) =>
                setCurrentPage({ ...currentPage, titleEn: e.target.value })
              }
              className={ADMIN_INPUT_CLS}
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-stone-600">
              Accroche dorée après le titre (arabe)
            </span>
            <input
              dir="rtl"
              value={currentPage.highlightAr}
              onChange={(e) =>
                setCurrentPage({ ...currentPage, highlightAr: e.target.value })
              }
              className={ADMIN_INPUT_CLS}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-stone-600">
              Accroche dorée après le titre (anglais)
            </span>
            <input
              value={currentPage.highlightEn}
              onChange={(e) =>
                setCurrentPage({ ...currentPage, highlightEn: e.target.value })
              }
              className={ADMIN_INPUT_CLS}
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-stone-600">
              Sous-titre descriptif (arabe)
            </span>
            <textarea
              dir="rtl"
              rows={2}
              value={currentPage.subtitleAr}
              onChange={(e) =>
                setCurrentPage({ ...currentPage, subtitleAr: e.target.value })
              }
              className={ADMIN_TEXTAREA_CLS}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-stone-600">
              Sous-titre descriptif (anglais)
            </span>
            <textarea
              rows={2}
              value={currentPage.subtitleEn}
              onChange={(e) =>
                setCurrentPage({ ...currentPage, subtitleEn: e.target.value })
              }
              className={ADMIN_TEXTAREA_CLS}
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-stone-600">
              Bandeau d’information « Prochainement » (arabe)
            </span>
            <input
              dir="rtl"
              value={currentPage.bannerNoteAr}
              onChange={(e) =>
                setCurrentPage({ ...currentPage, bannerNoteAr: e.target.value })
              }
              className={ADMIN_INPUT_CLS}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-stone-600">
              Bandeau d’information « Coming Soon » (anglais)
            </span>
            <input
              value={currentPage.bannerNoteEn}
              onChange={(e) =>
                setCurrentPage({ ...currentPage, bannerNoteEn: e.target.value })
              }
              className={ADMIN_INPUT_CLS}
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-stone-600">
              Texte du bouton d’alerte WhatsApp (arabe)
            </span>
            <input
              dir="rtl"
              value={currentPage.ctaLabelAr}
              onChange={(e) =>
                setCurrentPage({ ...currentPage, ctaLabelAr: e.target.value })
              }
              className={ADMIN_INPUT_CLS}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-stone-600">
              Texte du bouton d’alerte WhatsApp (anglais)
            </span>
            <input
              value={currentPage.ctaLabelEn}
              onChange={(e) =>
                setCurrentPage({ ...currentPage, ctaLabelEn: e.target.value })
              }
              className={ADMIN_INPUT_CLS}
            />
          </label>
        </div>
      </div>

      {/* Bloc 2 : Cartes d'applications ou de produits numériques */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-black text-stone-900">
            {tab === "apps"
              ? `Liste des applications (${currentPage.items.length})`
              : `Liste des produits numériques & logiciels (${currentPage.items.length})`}
          </h2>
          <button
            type="button"
            onClick={addItem}
            className="h-9 px-4 rounded-xl bg-stone-900 text-white text-xs font-bold inline-flex items-center gap-1.5 hover:bg-stone-800 cursor-pointer shadow-xs"
          >
            <Plus className="h-4 w-4 text-[#E5CA87]" />
            {tab === "apps"
              ? "+ Ajouter une application"
              : "+ Ajouter un produit / logiciel"}
          </button>
        </div>

        {currentPage.items.map((item, idx) => {
          const open = Boolean(openIds[item.id]);
          return (
            <div
              key={item.id}
              className={`rounded-2xl border bg-white transition-all shadow-2xs ${
                open ? "border-[#C6A664]" : "border-stone-200/90"
              }`}
            >
              <div className="px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setOpenIds((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                  }
                  className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                >
                  <span
                    className="h-8 w-8 rounded-xl shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-stone-900 truncate">
                        {item.titleEn || item.titleAr}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                        {item.badgeEn || item.badgeAr}
                      </span>
                    </div>
                    <div className="text-xs text-stone-500 truncate mt-0.5">
                      <span dir="rtl">{item.titleAr}</span> ·{" "}
                      {item.platforms.join(" · ")}
                    </div>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-stone-400 transition-transform ${
                      open ? "rotate-180 text-stone-900" : ""
                    }`}
                  />
                </button>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveItem(idx, -1)}
                    className="h-8 w-8 rounded-lg border border-stone-200 bg-stone-50 grid place-items-center text-stone-600 hover:bg-stone-100 disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === currentPage.items.length - 1}
                    onClick={() => moveItem(idx, 1)}
                    className="h-8 w-8 rounded-lg border border-stone-200 bg-stone-50 grid place-items-center text-stone-600 hover:bg-stone-100 disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteItem(idx)}
                    className="h-8 px-2.5 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Supprimer</span>
                  </button>
                </div>
              </div>

              {open && (
                <div className="p-4 sm:p-5 border-t border-stone-200 bg-[#FCFBF9] space-y-4 rounded-b-2xl">
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    <label className="block space-y-1">
                      <span className="text-xs font-semibold text-stone-600">
                        Statut
                      </span>
                      <select
                        value={item.status}
                        onChange={(e) => {
                          const st = e.target.value as LaunchStatus;
                          const badgeAr =
                            st === "available"
                              ? "متاح الآن"
                              : st === "in_preparation"
                                ? "قيد التحضير"
                                : "قريباً";
                          const badgeEn =
                            st === "available"
                              ? "Available Now"
                              : st === "in_preparation"
                                ? "In Preparation"
                                : "Coming Soon";
                          updateItem(idx, { status: st, badgeAr, badgeEn });
                        }}
                        className={ADMIN_INPUT_CLS}
                      >
                        <option value="in_preparation">
                          En cours de préparation
                        </option>
                        <option value="coming_soon">Prochainement</option>
                        <option value="available">Disponible maintenant</option>
                      </select>
                    </label>

                    <label className="block space-y-1">
                      <span className="text-xs font-semibold text-stone-600">
                        Slug (identifiant)
                      </span>
                      <input
                        value={item.slug}
                        onChange={(e) =>
                          updateItem(idx, {
                            slug: e.target.value
                              .toLowerCase()
                              .replace(/[^a-z0-9-]+/g, "-"),
                          })
                        }
                        className={ADMIN_INPUT_CLS}
                      />
                    </label>

                    <label className="block space-y-1">
                      <span className="text-xs font-semibold text-stone-600">
                        Avancement % (0 = masqué)
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={item.progress ?? ""}
                        onChange={(e) =>
                          updateItem(idx, {
                            progress:
                              e.target.value.trim() === ""
                                ? null
                                : Number(e.target.value),
                          })
                        }
                        placeholder="ex: 80"
                        className={ADMIN_INPUT_CLS}
                      />
                    </label>

                    <label className="block space-y-1">
                      <span className="text-xs font-semibold text-stone-600">
                        Couleur (#hex)
                      </span>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={
                            /^#[0-9a-fA-F]{6}$/.test(item.color)
                              ? item.color
                              : "#C6A664"
                          }
                          onChange={(e) =>
                            updateItem(idx, { color: e.target.value })
                          }
                          className="h-10 w-12 rounded-xl border border-stone-300 bg-white p-1 cursor-pointer"
                        />
                        <input
                          value={item.color}
                          onChange={(e) =>
                            updateItem(idx, { color: e.target.value })
                          }
                          className={ADMIN_INPUT_CLS}
                        />
                      </div>
                    </label>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3.5">
                    <label className="block space-y-1">
                      <span className="text-xs font-semibold text-stone-600">
                        Badge personnalisé (arabe)
                      </span>
                      <input
                        dir="rtl"
                        value={item.badgeAr}
                        onChange={(e) =>
                          updateItem(idx, { badgeAr: e.target.value })
                        }
                        className={ADMIN_INPUT_CLS}
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-xs font-semibold text-stone-600">
                        Badge personnalisé (anglais)
                      </span>
                      <input
                        value={item.badgeEn}
                        onChange={(e) =>
                          updateItem(idx, { badgeEn: e.target.value })
                        }
                        className={ADMIN_INPUT_CLS}
                      />
                    </label>

                    <label className="block space-y-1">
                      <span className="text-xs font-semibold text-stone-600">
                        Catégorie (arabe)
                      </span>
                      <input
                        dir="rtl"
                        value={item.categoryAr}
                        onChange={(e) =>
                          updateItem(idx, { categoryAr: e.target.value })
                        }
                        className={ADMIN_INPUT_CLS}
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-xs font-semibold text-stone-600">
                        Catégorie (anglais)
                      </span>
                      <input
                        value={item.categoryEn}
                        onChange={(e) =>
                          updateItem(idx, { categoryEn: e.target.value })
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
                        value={item.titleAr}
                        onChange={(e) =>
                          updateItem(idx, { titleAr: e.target.value })
                        }
                        className={ADMIN_INPUT_CLS}
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-xs font-semibold text-stone-600">
                        Titre (anglais)
                      </span>
                      <input
                        value={item.titleEn}
                        onChange={(e) =>
                          updateItem(idx, { titleEn: e.target.value })
                        }
                        className={ADMIN_INPUT_CLS}
                      />
                    </label>

                    <label className="block space-y-1">
                      <span className="text-xs font-semibold text-stone-600">
                        Image de couverture (URL https://...)
                      </span>
                      <input
                        value={item.image}
                        onChange={(e) =>
                          updateItem(idx, { image: e.target.value })
                        }
                        className={ADMIN_INPUT_CLS}
                      />
                    </label>

                    <label className="block space-y-1">
                      <span className="text-xs font-semibold text-stone-600">
                        Plateformes (séparées par virgule : iOS, Android, Web)
                      </span>
                      <input
                        value={item.platforms.join(", ")}
                        onChange={(e) =>
                          updateItem(idx, {
                            platforms: e.target.value
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                        className={ADMIN_INPUT_CLS}
                      />
                    </label>

                    <label className="block space-y-1">
                      <span className="text-xs font-semibold text-stone-600">
                        Prix indicatif USD (optionnel — vide = non affiché)
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={item.priceHintUsd ?? ""}
                        onChange={(e) =>
                          updateItem(idx, {
                            priceHintUsd:
                              e.target.value.trim() === ""
                                ? null
                                : Number(e.target.value),
                          })
                        }
                        className={ADMIN_INPUT_CLS}
                      />
                    </label>

                    <label className="block space-y-1">
                      <span className="text-xs font-semibold text-stone-600">
                        Lien d’aperçu en ligne (optionnel https://...)
                      </span>
                      <input
                        value={item.demoUrl ?? ""}
                        onChange={(e) =>
                          updateItem(idx, { demoUrl: e.target.value })
                        }
                        placeholder="Laisser vide tant qu'en préparation"
                        className={ADMIN_INPUT_CLS}
                      />
                    </label>

                    <label className="block space-y-1">
                      <span className="text-xs font-semibold text-stone-600">
                        Description (arabe)
                      </span>
                      <textarea
                        dir="rtl"
                        rows={3}
                        value={item.descriptionAr}
                        onChange={(e) =>
                          updateItem(idx, { descriptionAr: e.target.value })
                        }
                        className={ADMIN_TEXTAREA_CLS}
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-xs font-semibold text-stone-600">
                        Description (anglais)
                      </span>
                      <textarea
                        rows={3}
                        value={item.descriptionEn}
                        onChange={(e) =>
                          updateItem(idx, { descriptionEn: e.target.value })
                        }
                        className={ADMIN_TEXTAREA_CLS}
                      />
                    </label>

                    <label className="block space-y-1">
                      <span className="text-xs font-semibold text-stone-600">
                        Points forts (arabe — un par ligne)
                      </span>
                      <textarea
                        dir="rtl"
                        rows={3}
                        value={item.featuresAr.join("\n")}
                        onChange={(e) =>
                          updateItem(idx, {
                            featuresAr: e.target.value
                              .split("\n")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                        className={ADMIN_TEXTAREA_CLS}
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-xs font-semibold text-stone-600">
                        Points forts (anglais — un par ligne)
                      </span>
                      <textarea
                        rows={3}
                        value={item.featuresEn.join("\n")}
                        onChange={(e) =>
                          updateItem(idx, {
                            featuresEn: e.target.value
                              .split("\n")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                        className={ADMIN_TEXTAREA_CLS}
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Barre d'enregistrement fixe */}
      <div className="fixed bottom-4 left-4 right-4 lg:left-80 lg:right-8 z-30">
        <div className="max-w-5xl mx-auto rounded-2xl border border-stone-300 bg-white/95 backdrop-blur px-4 py-3 shadow-xl flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-stone-600">
            {isDirty ? (
              <span className="font-bold text-[#8A6D2F]">
                ● Modifications en attente sur la page «{" "}
                {tab === "apps" ? "Nos applications" : "Produits numériques"} ».
              </span>
            ) : (
              <span>Page synchronisée avec le site public.</span>
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
              {pending ? "Enregistrement…" : "Enregistrer la page"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
