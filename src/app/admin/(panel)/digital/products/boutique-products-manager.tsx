"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  EyeOff,
  Gift,
  KeyRound,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Undo2,
  Upload,
  Zap,
} from "lucide-react";
import {
  deleteBoutiqueProductAction,
  resetBoutiqueProductAction,
  restoreBoutiqueProductAction,
  saveBoutiqueProductAction,
  saveBoutiqueProductsBatchAction,
} from "@/app/admin/actions";
import {
  DIGITAL_KINDS,
  DIGITAL_KIND_LABELS,
  DIGITAL_REGIONS,
  DIGITAL_STATUSES,
  DIGITAL_STATUS_LABELS,
  lowestPriceUsd,
  type DigitalDenomination,
  type DigitalKind,
  type DigitalProduct,
  type DigitalProductFaqItem,
  type DigitalProductSeo,
  type DigitalStatus,
} from "@/lib/digital-types";
import { ADMIN_INPUT_CLS, ADMIN_TEXTAREA_CLS } from "../../site-item-editor";

interface Props {
  initialProducts: DigitalProduct[];
  baseById: Record<string, DigitalProduct>;
  deletedProducts: DigitalProduct[];
  overriddenIds: string[];
  customIds: string[];
  source: "fazercards" | "stored";
  fetchedAt: string | null;
  maxOrderUsd: number;
  initialEditSlug?: string;
}

type SubTab = "general" | "denominations" | "seo" | "faq";
type StateFilter = "all" | "overridden" | "seo" | "custom" | "deleted";

const PAGE_SIZE = 24;

const COMMON_REGION_CODES = [
  ...Object.keys(DIGITAL_REGIONS),
  "MENA",
  "ROW",
];

const KIND_FR_LABELS: Record<DigitalKind, string> = {
  gift_card: "Carte cadeau",
  game_topup: "Recharge de jeu",
  software_key: "Clé jeu / logiciel",
  subscription_code: "Code d'abonnement",
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 110);
}

function hasSeoFields(seo?: DigitalProductSeo): boolean {
  if (!seo) return false;
  return Boolean(
    seo.seoTitleAr?.trim() ||
      seo.seoTitleEn?.trim() ||
      seo.seoDescriptionAr?.trim() ||
      seo.seoDescriptionEn?.trim() ||
      seo.geoSummaryAr?.trim() ||
      seo.geoSummaryEn?.trim() ||
      (seo.faqs && seo.faqs.length > 0),
  );
}

function makeBlankProduct(existingSlugs: string[]): DigitalProduct {
  const stamp = Date.now().toString(36);
  let slug = `nouveau-produit-${stamp}`;
  let n = 2;
  while (existingSlugs.includes(slug)) {
    slug = `nouveau-produit-${stamp}-${n}`;
    n += 1;
  }
  return {
    id: `custom-${stamp}`,
    slug,
    kind: "gift_card",
    status: "coming_soon",
    platform: "PlayStation",
    color: "#1B2838",
    titleAr: "بطاقة هدايا جديدة",
    titleEn: "New Gift Card",
    descriptionAr: "",
    descriptionEn: "",
    image: "",
    regions: ["GLOBAL"],
    featuresAr: [],
    featuresEn: [],
    deliveryNoteAr: "يُرسل الكود إلى بريدك الإلكتروني مباشرة بعد تأكيد الدفع.",
    deliveryNoteEn: "Code delivered by e-mail right after payment confirmation.",
    denominations: [
      {
        id: `denom-${stamp}-1`,
        label: "$10",
        faceValue: "10 USD",
        faceCurrency: "USD",
        region: "GLOBAL",
        priceUsd: 10.9,
        available: true,
        maxQuantity: 5,
        fields: [],
      },
    ],
    sortOrder: 0,
    fulfillment: "manual",
    supplier: "fazercards",
    supplierCategoryId: "",
    seo: {},
  };
}

export function BoutiqueProductsManager({
  initialProducts,
  baseById,
  deletedProducts: initialDeleted,
  overriddenIds: initialOverriddenIds,
  customIds: initialCustomIds,
  source,
  fetchedAt,
  maxOrderUsd,
  initialEditSlug,
}: Props) {
  const router = useRouter();
  const [products, setProducts] = useState<DigitalProduct[]>(initialProducts);
  const [deletedProducts, setDeletedProducts] =
    useState<DigitalProduct[]>(initialDeleted);
  const [overriddenSet, setOverriddenSet] = useState<Set<string>>(
    () => new Set(initialOverriddenIds),
  );
  const [customSet, setCustomSet] = useState<Set<string>>(
    () => new Set(initialCustomIds),
  );

  const [search, setSearch] = useState(() => initialEditSlug ?? "");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [stateFilter, setStateFilter] = useState<StateFilter>("all");
  const [page, setPage] = useState(1);

  const [openIds, setOpenIds] = useState<Record<string, boolean>>(() => {
    if (!initialEditSlug) return {};
    const match = initialProducts.find(
      (p) => p.slug === initialEditSlug || p.id === initialEditSlug,
    );
    return match ? { [match.id]: true } : {};
  });
  const [subTabs, setSubTabs] = useState<Record<string, SubTab>>({});
  const [dirtyIds, setDirtyIds] = useState<Record<string, boolean>>({});
  const [rewriteEditorialById, setRewriteEditorialById] = useState<
    Record<string, boolean>
  >({});
  const [batchRewriteEditorial, setBatchRewriteEditorial] = useState(true);
  const [customRegionInput, setCustomRegionInput] = useState<Record<string, string>>({});

  const [optimizingId, setOptimizingId] = useState<string | null>(null);
  const [batchOptimizing, setBatchOptimizing] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [uploadingImageId, setUploadingImageId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(
    null,
  );

  const flash = (msg: string, kind: "ok" | "err") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 4500);
  };

  const counts = useMemo(() => {
    let giftCards = 0;
    let topups = 0;
    let keys = 0;
    let subs = 0;
    let seoOptimized = 0;
    for (const p of products) {
      if (p.kind === "gift_card") giftCards += 1;
      else if (p.kind === "game_topup") topups += 1;
      else if (p.kind === "software_key") keys += 1;
      else if (p.kind === "subscription_code") subs += 1;
      if (hasSeoFields(p.seo)) seoOptimized += 1;
    }
    return {
      total: products.length,
      giftCards,
      topups,
      keys,
      subs,
      overridden: overriddenSet.size,
      custom: customSet.size,
      seoOptimized,
      deleted: deletedProducts.length,
    };
  }, [products, overriddenSet, customSet, deletedProducts]);

  const filtered = useMemo(() => {
    if (stateFilter === "deleted") {
      const q = search.trim().toLowerCase();
      if (!q) return deletedProducts;
      return deletedProducts.filter((p) =>
        `${p.titleEn} ${p.titleAr} ${p.platform} ${p.slug} ${p.id}`
          .toLowerCase()
          .includes(q),
      );
    }

    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (kindFilter !== "all" && p.kind !== kindFilter) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (stateFilter === "overridden" && !overriddenSet.has(p.id)) return false;
      if (stateFilter === "custom" && !customSet.has(p.id)) return false;
      if (stateFilter === "seo" && !hasSeoFields(p.seo)) return false;
      if (!q) return true;
      const hay = `${p.titleEn} ${p.titleAr} ${p.platform} ${p.slug} ${p.id} ${p.regions.join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [
    products,
    deletedProducts,
    search,
    kindFilter,
    statusFilter,
    stateFilter,
    overriddenSet,
    customSet,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = useMemo(
    () =>
      filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage],
  );

  const patchProduct = (productId: string, updater: (prev: DigitalProduct) => DigitalProduct) => {
    setProducts((prev) =>
      prev.map((item) => (item.id === productId ? updater(item) : item)),
    );
    setDirtyIds((prev) => ({ ...prev, [productId]: true }));
  };

  /** Importe une image depuis le PC via /api/admin/media et la colle dans la fiche. */
  const uploadProductImage = async (productId: string, file: File) => {
    if (file.size > 4 * 1024 * 1024) {
      flash("Image trop volumineuse : 4 Mo maximum.", "err");
      return;
    }
    setUploadingImageId(productId);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/admin/media", { method: "POST", body });
      const result = (await response.json()) as { ok?: boolean; url?: string; error?: string };
      if (!response.ok || !result.ok || !result.url) {
        throw new Error(result.error || "Import impossible.");
      }
      patchProduct(productId, (prev) => ({ ...prev, image: result.url ?? "" }));
      flash("Image importée et optimisée — pensez à enregistrer la fiche.", "ok");
    } catch (error) {
      flash(error instanceof Error ? error.message : "Import impossible.", "err");
    } finally {
      setUploadingImageId(null);
    }
  };

  const addNewProduct = () => {
    const blank = makeBlankProduct(products.map((p) => p.slug));
    setProducts((prev) => [blank, ...prev]);
    setCustomSet((prev) => new Set(prev).add(blank.id));
    setStateFilter("all");
    setKindFilter("all");
    setStatusFilter("all");
    setSearch("");
    setPage(1);
    setOpenIds((prev) => ({ ...prev, [blank.id]: true }));
    setDirtyIds((prev) => ({ ...prev, [blank.id]: true }));
  };

  const saveSingleProduct = (product: DigitalProduct) => {
    const isBaseProduct = Boolean(baseById[product.id]) && !customSet.has(product.id);
    setSavingId(product.id);
    startTransition(async () => {
      try {
        const res = await saveBoutiqueProductAction(product, { isBaseProduct });
        if (res.ok) {
          setDirtyIds((prev) => ({ ...prev, [product.id]: false }));
          if (isBaseProduct) {
            setOverriddenSet((prev) => new Set(prev).add(product.id));
          } else {
            setCustomSet((prev) => new Set(prev).add(product.id));
          }
          flash(res.message ?? "Fiche enregistrée.", "ok");
          router.refresh();
        } else {
          flash(res.error ?? "Échec de l’enregistrement.", "err");
        }
      } finally {
        setSavingId(null);
      }
    });
  };

  const resetToSupplier = (product: DigitalProduct) => {
    const base = baseById[product.id];
    if (!base) return;
    if (
      !confirm(
        `Réinitialiser « ${product.titleEn} » aux valeurs d’origine du fournisseur ? Toutes vos modifications sur cette fiche seront effacées.`,
      )
    ) {
      return;
    }
    setSavingId(product.id);
    startTransition(async () => {
      try {
        const res = await resetBoutiqueProductAction(product.id);
        if (res.ok) {
          setProducts((prev) =>
            prev.map((item) => (item.id === product.id ? base : item)),
          );
          setDirtyIds((prev) => ({ ...prev, [product.id]: false }));
          setOverriddenSet((prev) => {
            const next = new Set(prev);
            next.delete(product.id);
            return next;
          });
          flash(res.message ?? "Fiche réinitialisée.", "ok");
          router.refresh();
        } else {
          flash(res.error ?? "Impossible de réinitialiser la fiche.", "err");
        }
      } finally {
        setSavingId(null);
      }
    });
  };

  const deleteOrHideProduct = (product: DigitalProduct) => {
    const isBaseProduct = Boolean(baseById[product.id]) && !customSet.has(product.id);
    const question = isBaseProduct
      ? `Masquer « ${product.titleEn} » de la boutique publique ? (Vous pourrez la restaurer à tout moment depuis l’onglet Masqués.)`
      : `Supprimer définitivement la fiche personnalisée « ${product.titleEn} » ?`;
    if (!confirm(question)) return;

    setSavingId(product.id);
    startTransition(async () => {
      try {
        const res = await deleteBoutiqueProductAction(product.id, isBaseProduct);
        if (res.ok) {
          setProducts((prev) => prev.filter((item) => item.id !== product.id));
          if (isBaseProduct && baseById[product.id]) {
            setDeletedProducts((prev) => [baseById[product.id], ...prev]);
          }
          flash(res.message ?? "Fiche retirée.", "ok");
          router.refresh();
        } else {
          flash(res.error ?? "Opération impossible.", "err");
        }
      } finally {
        setSavingId(null);
      }
    });
  };

  const restoreDeleted = (product: DigitalProduct) => {
    setSavingId(product.id);
    startTransition(async () => {
      try {
        const res = await restoreBoutiqueProductAction(product.id);
        if (res.ok) {
          setDeletedProducts((prev) => prev.filter((p) => p.id !== product.id));
          setProducts((prev) => [product, ...prev]);
          flash(res.message ?? "Fiche restaurée.", "ok");
          router.refresh();
        } else {
          flash(res.error ?? "Restauration impossible.", "err");
        }
      } finally {
        setSavingId(null);
      }
    });
  };

  const optimizeProductSeoGeo = async (product: DigitalProduct) => {
    const rewriteEditorial = rewriteEditorialById[product.id] ?? true;
    setOptimizingId(product.id);
    try {
      const res = await fetch("/api/admin/ai/digital-seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "single",
          product,
          rewriteEditorial,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        source?: string;
        product?: DigitalProduct;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.product) {
        flash(json.error ?? "Échec de l’optimisation SEO / GEO.", "err");
        return;
      }
      patchProduct(product.id, () => json.product!);
      setSubTabs((prev) => ({ ...prev, [product.id]: "seo" }));
      flash(
        `SEO & GEO optimisés (${json.source === "openai" ? "IA OpenAI" : "moteur structuré SEO/GEO"}) — vérifiez puis cliquez sur Enregistrer.`,
        "ok",
      );
    } catch {
      flash("Erreur réseau pendant l’optimisation SEO / GEO.", "err");
    } finally {
      setOptimizingId(null);
    }
  };

  const optimizeBatchSeoGeo = async () => {
    const targets = pageItems;
    if (targets.length === 0) return;
    if (
      !confirm(
        `Optimiser et enregistrer automatiquement le SEO & GEO des ${targets.length} fiche(s) affichées sur cette page ?`,
      )
    ) {
      return;
    }

    setBatchOptimizing(true);
    try {
      const res = await fetch("/api/admin/ai/digital-seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "batch",
          products: targets,
          rewriteEditorial: batchRewriteEditorial,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        products?: DigitalProduct[];
        error?: string;
      };
      if (!res.ok || !json.ok || !json.products) {
        flash(json.error ?? "Échec de l’optimisation en lot.", "err");
        return;
      }

      const byId = new Map(json.products.map((p) => [p.id, p]));
      const savePayload = json.products.map((p) => ({
        product: p,
        isBaseProduct: Boolean(baseById[p.id]) && !customSet.has(p.id),
      }));

      const saveRes = await saveBoutiqueProductsBatchAction(savePayload);
      if (!saveRes.ok) {
        flash(saveRes.error ?? "Échec de l’enregistrement du lot.", "err");
        return;
      }

      setProducts((prev) => prev.map((p) => byId.get(p.id) ?? p));
      setOverriddenSet((prev) => {
        const next = new Set(prev);
        for (const p of json.products!) {
          if (baseById[p.id] && !customSet.has(p.id)) next.add(p.id);
        }
        return next;
      });
      setDirtyIds((prev) => {
        const next = { ...prev };
        for (const p of json.products!) next[p.id] = false;
        return next;
      });
      flash(
        `SEO & GEO optimisés et enregistrés pour ${json.products.length} fiche(s).`,
        "ok",
      );
      router.refresh();
    } catch {
      flash("Erreur réseau pendant l’optimisation en lot.", "err");
    } finally {
      setBatchOptimizing(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
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

      {/* En-tête */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#8A6D2F]">
            Boutique digitale · Éditeur complet & SEO / GEO
          </span>
          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight">
            Cartes cadeaux, recharges & produits digitaux
          </h1>
          <p className="text-sm text-stone-500 mt-1 max-w-3xl leading-relaxed">
            Modifiez tous les champs des fiches de la boutique{" "}
            <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs font-mono text-stone-800">
              /codes
            </code>{" "}
            (titres AR/EN, descriptions, images, régions, montants, prix USD, champs acheteur,
            statuts, étapes d’activation, FAQ et balises SEO/GEO). Vos modifications survivent aux
            synchronisations quotidiennes du fournisseur.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-stone-500">
            <span>
              Source active :{" "}
              <strong className="text-stone-800">
                {source === "fazercards" ? "Catalogue FazerCards" : "Catalogue stocké"}
              </strong>
              {fetchedAt
                ? ` (synchro du ${new Date(fetchedAt).toLocaleString("fr-FR")})`
                : ""}
            </span>
            <span>·</span>
            <span>
              Commande max FazerCards :{" "}
              <strong className="text-stone-800">{maxOrderUsd.toFixed(2)} $</strong>{" "}
              <Link
                href="/admin/settings?tab=fazercards"
                className="font-semibold text-[#8A6D2F] underline underline-offset-2"
              >
                (modifier dans Réglages)
              </Link>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/codes"
            target="_blank"
            className="h-9 px-3.5 rounded-xl border border-stone-200 bg-white text-xs font-semibold text-stone-700 hover:bg-stone-50 inline-flex items-center gap-1.5"
          >
            Voir /codes
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
          <Link
            href="/admin/digital"
            className="h-9 px-3.5 rounded-xl border border-stone-200 bg-white text-xs font-semibold text-stone-700 hover:bg-stone-50 inline-flex items-center gap-1.5"
          >
            Solde & synchro FazerCards
          </Link>
          <button
            type="button"
            onClick={addNewProduct}
            className="h-9 px-4 rounded-xl bg-stone-900 text-white text-xs font-bold hover:bg-stone-800 inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="h-3.5 w-3.5 text-[#E5CA87]" />
            Nouveau produit
          </button>
        </div>
      </div>

      {/* Compteurs rapides */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <StatCard
          label="Total fiches"
          value={counts.total}
          active={kindFilter === "all" && stateFilter === "all"}
          onClick={() => {
            setKindFilter("all");
            setStateFilter("all");
            setPage(1);
          }}
        />
        <StatCard
          label="Cartes cadeaux"
          value={counts.giftCards}
          active={kindFilter === "gift_card" && stateFilter !== "deleted"}
          onClick={() => {
            setStateFilter("all");
            setKindFilter(kindFilter === "gift_card" ? "all" : "gift_card");
            setPage(1);
          }}
        />
        <StatCard
          label="Recharges jeux"
          value={counts.topups}
          active={kindFilter === "game_topup" && stateFilter !== "deleted"}
          onClick={() => {
            setStateFilter("all");
            setKindFilter(kindFilter === "game_topup" ? "all" : "game_topup");
            setPage(1);
          }}
        />
        <StatCard
          label="Clés & abonnements"
          value={counts.keys + counts.subs}
          active={kindFilter === "software_key" && stateFilter !== "deleted"}
          onClick={() => {
            setStateFilter("all");
            setKindFilter(kindFilter === "software_key" ? "all" : "software_key");
            setPage(1);
          }}
        />
        <StatCard
          label="Modifiées (admin)"
          value={counts.overridden + counts.custom}
          active={stateFilter === "overridden"}
          onClick={() => {
            setStateFilter(stateFilter === "overridden" ? "all" : "overridden");
            setPage(1);
          }}
        />
        <StatCard
          label="SEO / GEO optimisés"
          value={counts.seoOptimized}
          active={stateFilter === "seo"}
          onClick={() => {
            setStateFilter(stateFilter === "seo" ? "all" : "seo");
            setPage(1);
          }}
        />
      </div>

      {/* Barre de recherche, filtres et optimisation SEO/GEO en lot */}
      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs space-y-3">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
          <div className="relative">
            <Search className="h-4 w-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Rechercher par nom (AR/EN), marque (PlayStation, Steam, PUBG…), slug, région…"
              className={`${ADMIN_INPUT_CLS} pl-9`}
            />
          </div>

          <select
            value={kindFilter}
            onChange={(e) => {
              setKindFilter(e.target.value);
              setPage(1);
            }}
            className={ADMIN_INPUT_CLS}
          >
            <option value="all">Toutes catégories</option>
            {DIGITAL_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_FR_LABELS[k]}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className={ADMIN_INPUT_CLS}
          >
            <option value="all">Tous les statuts</option>
            {DIGITAL_STATUSES.map((st) => (
              <option key={st} value={st}>
                {DIGITAL_STATUS_LABELS[st].fr}
              </option>
            ))}
          </select>

          <select
            value={stateFilter}
            onChange={(e) => {
              setStateFilter(e.target.value as StateFilter);
              setPage(1);
            }}
            className={ADMIN_INPUT_CLS}
          >
            <option value="all">Toutes les fiches</option>
            <option value="overridden">Modifiées ({counts.overridden})</option>
            <option value="seo">SEO / GEO actifs ({counts.seoOptimized})</option>
            <option value="custom">Personnalisées ({counts.custom})</option>
            <option value="deleted">Masquées / Corbeille ({counts.deleted})</option>
          </select>
        </div>

        {stateFilter !== "deleted" && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-3">
            <div className="text-xs text-stone-500">
              <strong>{filtered.length}</strong> fiche(s) trouvée(s) · page{" "}
              <strong>{currentPage}</strong> sur <strong>{totalPages}</strong>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-1.5 text-xs text-stone-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={batchRewriteEditorial}
                  onChange={(e) => setBatchRewriteEditorial(e.target.checked)}
                  className="rounded border-stone-300"
                />
                Réécrire aussi les titres & descriptions visibles
              </label>
              <button
                type="button"
                disabled={batchOptimizing || pageItems.length === 0}
                onClick={optimizeBatchSeoGeo}
                className="h-9 px-3.5 rounded-xl border border-[#C6A664] bg-[#C6A664]/15 text-[#6F5620] text-xs font-bold hover:bg-[#C6A664]/25 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {batchOptimizing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Optimiser SEO & GEO de la page ({pageItems.length})
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Vue Corbeille / Masqués */}
      {stateFilter === "deleted" ? (
        <div className="space-y-3">
          {pageItems.length === 0 ? (
            <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-500">
              Aucune fiche masquée pour le moment.
            </div>
          ) : (
            pageItems.map((product) => (
              <div
                key={product.id}
                className="rounded-2xl border border-stone-200 bg-white p-4 flex flex-wrap items-center justify-between gap-3"
              >
                <div>
                  <p className="text-sm font-bold text-stone-900">
                    {product.titleEn}{" "}
                    <span className="text-stone-400 font-normal">
                      ({product.titleAr})
                    </span>
                  </p>
                  <p className="text-xs text-stone-500 font-mono">
                    {product.slug} · {KIND_FR_LABELS[product.kind]}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={savingId === product.id || pending}
                  onClick={() => restoreDeleted(product)}
                  className="h-9 px-3.5 rounded-xl bg-stone-900 text-white text-xs font-bold hover:bg-stone-800 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Undo2 className="h-3.5 w-3.5 text-[#E5CA87]" />
                  Restaurer dans la boutique
                </button>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Liste principale des fiches éditables */
        <div className="space-y-3">
          {pageItems.length === 0 && (
            <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-500">
              Aucun produit ne correspond à votre recherche.
            </div>
          )}

          {pageItems.map((product) => {
            const isOpen = Boolean(openIds[product.id]);
            const isDirty = Boolean(dirtyIds[product.id]);
            const isOverridden = overriddenSet.has(product.id);
            const isCustom = customSet.has(product.id);
            const hasSeo = hasSeoFields(product.seo);
            const activeTab: SubTab = subTabs[product.id] ?? "general";
            const entryUsd = lowestPriceUsd(product);
            const availableDenomsCount = product.denominations.filter(
              (d) => d.available,
            ).length;
            const KindIcon =
              product.kind === "gift_card"
                ? Gift
                : product.kind === "game_topup"
                  ? Zap
                  : KeyRound;
            const rewriteEditorial = rewriteEditorialById[product.id] ?? true;

            return (
              <div
                key={product.id}
                className={`rounded-2xl border bg-white shadow-xs transition-colors ${
                  isDirty
                    ? "border-[#C6A664] ring-1 ring-[#C6A664]/40"
                    : "border-stone-200"
                }`}
              >
                {/* Ligne de résumé de la fiche */}
                <div className="p-4 flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenIds((prev) => ({ ...prev, [product.id]: !isOpen }))
                    }
                    className="flex items-center gap-3 text-left min-w-0 flex-1 cursor-pointer"
                  >
                    <span
                      className="h-10 w-10 rounded-xl shrink-0 grid place-items-center text-white font-extrabold text-xs shadow-xs"
                      style={{ backgroundColor: product.color || "#172554" }}
                    >
                      <KindIcon className="h-4 w-4" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-extrabold text-stone-900 truncate">
                          {product.titleEn}
                        </span>
                        <span
                          dir="rtl"
                          className="text-xs font-semibold text-stone-500 truncate"
                        >
                          · {product.titleAr}
                        </span>
                        {isDirty && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                            Non enregistré
                          </span>
                        )}
                        {isOverridden && (
                          <span className="rounded-full bg-[#C6A664]/20 px-2 py-0.5 text-[10px] font-bold text-[#7A5E21]">
                            Modifié
                          </span>
                        )}
                        {isCustom && (
                          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800">
                            Personnalisé
                          </span>
                        )}
                        {hasSeo && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            SEO/GEO
                          </span>
                        )}
                      </div>

                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11.5px] text-stone-500">
                        <span>{KIND_FR_LABELS[product.kind]}</span>
                        <span>·</span>
                        <span className="font-medium text-stone-700">
                          {product.platform || "—"}
                        </span>
                        <span>·</span>
                        <span>
                          {DIGITAL_STATUS_LABELS[product.status]?.fr ?? product.status}
                        </span>
                        <span>·</span>
                        <span>
                          {availableDenomsCount}/{product.denominations.length} montant(s)
                          {entryUsd != null ? ` · dès ${entryUsd.toFixed(2)} $` : ""}
                        </span>
                        <span>·</span>
                        <span className="font-mono text-[11px]">
                          {product.regions.join(", ")}
                        </span>
                      </div>
                    </div>
                  </button>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={optimizingId === product.id}
                      onClick={() => {
                        setOpenIds((prev) => ({ ...prev, [product.id]: true }));
                        void optimizeProductSeoGeo(product);
                      }}
                      title="Optimiser automatiquement le SEO & GEO (Google + moteurs IA)"
                      className="h-8 px-3 rounded-xl border border-[#C6A664] bg-[#C6A664]/15 text-[#6F5620] text-xs font-bold hover:bg-[#C6A664]/25 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {optimizingId === product.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      Optimiser SEO & GEO
                    </button>

                    {isDirty && (
                      <button
                        type="button"
                        disabled={savingId === product.id || pending}
                        onClick={() => saveSingleProduct(product)}
                        className="h-8 px-3 rounded-xl bg-stone-900 text-white text-xs font-bold hover:bg-stone-800 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {savingId === product.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5 text-[#E5CA87]" />
                        )}
                        Enregistrer
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        setOpenIds((prev) => ({ ...prev, [product.id]: !isOpen }))
                      }
                      className="h-8 px-2.5 rounded-xl border border-stone-200 bg-stone-50 text-xs font-semibold text-stone-700 hover:bg-stone-100 inline-flex items-center gap-1 cursor-pointer"
                    >
                      {isOpen ? (
                        <>
                          Fermer <ChevronUp className="h-3.5 w-3.5" />
                        </>
                      ) : (
                        <>
                          Modifier <ChevronDown className="h-3.5 w-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Panneau d'édition intégrale (tous les champs) */}
                {isOpen && (
                  <div className="border-t border-stone-200 bg-stone-50/50 p-4 sm:p-5 space-y-5">
                    {/* Barre d'onglets internes + actions de la fiche */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap gap-1.5">
                        {(
                          [
                            { id: "general", label: "1. Identité & Textes (AR/EN)" },
                            {
                              id: "denominations",
                              label: `2. Montants & Prix (${product.denominations.length})`,
                            },
                            { id: "seo", label: "3. SEO & GEO (Google + IA)" },
                            {
                              id: "faq",
                              label: `4. Étapes & FAQ (${product.seo?.faqs?.length ?? 0})`,
                            },
                          ] as { id: SubTab; label: string }[]
                        ).map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() =>
                              setSubTabs((prev) => ({ ...prev, [product.id]: t.id }))
                            }
                            className={`h-8 px-3 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                              activeTab === t.id
                                ? "bg-stone-900 text-white"
                                : "bg-white border border-stone-200 text-stone-600 hover:bg-stone-100"
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <label className="inline-flex items-center gap-1.5 text-[11.5px] text-stone-600 cursor-pointer mr-1">
                          <input
                            type="checkbox"
                            checked={rewriteEditorial}
                            onChange={(e) =>
                              setRewriteEditorialById((prev) => ({
                                ...prev,
                                [product.id]: e.target.checked,
                              }))
                            }
                            className="rounded border-stone-300"
                          />
                          Inclure titres/descriptions dans l’optimisation
                        </label>

                        <Link
                          href={`/codes/${product.slug}`}
                          target="_blank"
                          className="h-8 px-2.5 rounded-xl border border-stone-200 bg-white text-xs font-semibold text-stone-700 hover:bg-stone-100 inline-flex items-center gap-1"
                        >
                          Voir la fiche
                          <ExternalLink className="h-3 w-3" />
                        </Link>

                        {isOverridden && baseById[product.id] && (
                          <button
                            type="button"
                            disabled={savingId === product.id || pending}
                            onClick={() => resetToSupplier(product)}
                            className="h-8 px-2.5 rounded-xl border border-stone-200 bg-white text-xs font-semibold text-stone-600 hover:bg-stone-100 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <RotateCcw className="h-3 w-3" />
                            Réinitialiser fournisseur
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={savingId === product.id || pending}
                          onClick={() => deleteOrHideProduct(product)}
                          className="h-8 px-2.5 rounded-xl border border-red-200 bg-red-50 text-xs font-semibold text-red-700 hover:bg-red-100 inline-flex items-center gap-1 cursor-pointer"
                        >
                          {isCustom ? (
                            <>
                              <Trash2 className="h-3 w-3" /> Supprimer
                            </>
                          ) : (
                            <>
                              <EyeOff className="h-3 w-3" /> Masquer
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* ONGLET 1 : IDENTITÉ & TEXTES */}
                    {activeTab === "general" && (
                      <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
                        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                          <Field label="Catégorie (kind)">
                            <select
                              value={product.kind}
                              onChange={(e) =>
                                patchProduct(product.id, (prev) => ({
                                  ...prev,
                                  kind: e.target.value as DigitalKind,
                                }))
                              }
                              className={ADMIN_INPUT_CLS}
                            >
                              {DIGITAL_KINDS.map((k) => (
                                <option key={k} value={k}>
                                  {KIND_FR_LABELS[k]}
                                </option>
                              ))}
                            </select>
                          </Field>

                          <Field label="Statut de publication">
                            <select
                              value={product.status}
                              onChange={(e) =>
                                patchProduct(product.id, (prev) => ({
                                  ...prev,
                                  status: e.target.value as DigitalStatus,
                                }))
                              }
                              className={ADMIN_INPUT_CLS}
                            >
                              {DIGITAL_STATUSES.map((st) => (
                                <option key={st} value={st}>
                                  {DIGITAL_STATUS_LABELS[st].fr}
                                </option>
                              ))}
                            </select>
                          </Field>

                          <Field label="Plateforme / Marque">
                            <input
                              value={product.platform}
                              onChange={(e) =>
                                patchProduct(product.id, (prev) => ({
                                  ...prev,
                                  platform: e.target.value,
                                }))
                              }
                              placeholder="PlayStation, Steam, PUBG Mobile…"
                              className={ADMIN_INPUT_CLS}
                            />
                          </Field>

                          <Field label="Ordre d’affichage (tri)">
                            <input
                              type="number"
                              value={product.sortOrder ?? 0}
                              onChange={(e) =>
                                patchProduct(product.id, (prev) => ({
                                  ...prev,
                                  sortOrder: Number(e.target.value) || 0,
                                }))
                              }
                              className={ADMIN_INPUT_CLS}
                            />
                          </Field>
                        </div>

                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                          <Field label="Slug URL (/codes/<slug>)">
                            <div className="flex gap-1.5">
                              <input
                                dir="ltr"
                                value={product.slug}
                                onChange={(e) =>
                                  patchProduct(product.id, (prev) => ({
                                    ...prev,
                                    slug: slugify(e.target.value) || prev.slug,
                                  }))
                                }
                                className={`${ADMIN_INPUT_CLS} font-mono text-xs`}
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  patchProduct(product.id, (prev) => ({
                                    ...prev,
                                    slug:
                                      slugify(prev.titleEn || prev.platform) ||
                                      prev.slug,
                                  }))
                                }
                                title="Générer depuis le titre anglais"
                                className="px-2.5 rounded-xl border border-stone-200 bg-stone-50 text-[11px] font-semibold text-stone-600 hover:bg-stone-100 shrink-0 cursor-pointer"
                              >
                                Auto
                              </button>
                            </div>
                          </Field>

                          <Field label="Couleur de la carte (#RRGGBB)">
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={
                                  /^#[0-9a-fA-F]{6}$/.test(product.color)
                                    ? product.color
                                    : "#172554"
                                }
                                onChange={(e) =>
                                  patchProduct(product.id, (prev) => ({
                                    ...prev,
                                    color: e.target.value,
                                  }))
                                }
                                className="h-9 w-11 rounded-lg border border-stone-200 cursor-pointer p-0.5 bg-white"
                              />
                              <input
                                dir="ltr"
                                value={product.color}
                                onChange={(e) =>
                                  patchProduct(product.id, (prev) => ({
                                    ...prev,
                                    color: e.target.value,
                                  }))
                                }
                                className={`${ADMIN_INPUT_CLS} font-mono text-xs`}
                              />
                            </div>
                          </Field>

                          <Field label="Image / Visuel (URL ou chemin /…)">
                            <div className="flex items-center gap-2">
                              <input
                                dir="ltr"
                                value={product.image}
                                onChange={(e) =>
                                  patchProduct(product.id, (prev) => ({
                                    ...prev,
                                    image: e.target.value,
                                  }))
                                }
                                placeholder="/digital-products/steam.svg ou https://…"
                                className={`${ADMIN_INPUT_CLS} font-mono text-xs`}
                              />
                              <label
                                title="Importer une image depuis mon PC"
                                aria-label="Importer une image depuis mon PC"
                                className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg border border-stone-300 bg-white text-stone-600 transition-colors hover:border-[#E5CA87] hover:text-[#8A6D2F]"
                              >
                                {uploadingImageId === product.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Upload className="h-4 w-4" />
                                )}
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp,image/avif"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    e.target.value = "";
                                    if (file) void uploadProductImage(product.id, file);
                                  }}
                                />
                              </label>
                            </div>
                          </Field>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-3.5">
                          <Field label="Titre (Arabe)">
                            <input
                              dir="rtl"
                              value={product.titleAr}
                              onChange={(e) =>
                                patchProduct(product.id, (prev) => ({
                                  ...prev,
                                  titleAr: e.target.value,
                                }))
                              }
                              className={ADMIN_INPUT_CLS}
                            />
                          </Field>

                          <Field label="Titre (Anglais)">
                            <input
                              dir="ltr"
                              value={product.titleEn}
                              onChange={(e) =>
                                patchProduct(product.id, (prev) => ({
                                  ...prev,
                                  titleEn: e.target.value,
                                }))
                              }
                              className={ADMIN_INPUT_CLS}
                            />
                          </Field>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-3.5">
                          <Field label="Description complète (Arabe)">
                            <textarea
                              dir="rtl"
                              rows={4}
                              value={product.descriptionAr}
                              onChange={(e) =>
                                patchProduct(product.id, (prev) => ({
                                  ...prev,
                                  descriptionAr: e.target.value,
                                }))
                              }
                              className={ADMIN_TEXTAREA_CLS}
                            />
                          </Field>

                          <Field label="Description complète (Anglais)">
                            <textarea
                              dir="ltr"
                              rows={4}
                              value={product.descriptionEn}
                              onChange={(e) =>
                                patchProduct(product.id, (prev) => ({
                                  ...prev,
                                  descriptionEn: e.target.value,
                                }))
                              }
                              className={ADMIN_TEXTAREA_CLS}
                            />
                          </Field>
                        </div>

                        {/* Régions */}
                        <div className="space-y-2">
                          <span className="block text-xs font-semibold text-stone-600">
                            Régions couvertes par la fiche
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {Array.from(
                              new Set([...COMMON_REGION_CODES, ...product.regions]),
                            ).map((code) => {
                              const selected = product.regions.includes(code);
                              return (
                                <button
                                  key={code}
                                  type="button"
                                  onClick={() =>
                                    patchProduct(product.id, (prev) => {
                                      const exists = prev.regions.includes(code);
                                      const next = exists
                                        ? prev.regions.filter((r) => r !== code)
                                        : [...prev.regions, code];
                                      return {
                                        ...prev,
                                        regions: next.length > 0 ? next : ["GLOBAL"],
                                      };
                                    })
                                  }
                                  className={`px-2.5 py-1 rounded-lg border text-xs font-bold cursor-pointer transition-colors ${
                                    selected
                                      ? "border-stone-900 bg-stone-900 text-white"
                                      : "border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100"
                                  }`}
                                >
                                  {code}
                                </button>
                              );
                            })}
                            <div className="inline-flex items-center gap-1">
                              <input
                                dir="ltr"
                                value={customRegionInput[product.id] ?? ""}
                                onChange={(e) =>
                                  setCustomRegionInput((prev) => ({
                                    ...prev,
                                    [product.id]: e.target.value.toUpperCase(),
                                  }))
                                }
                                placeholder="Autre code (ex. FR)…"
                                className="h-7 w-32 rounded-lg border border-stone-200 px-2 text-xs font-mono"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const raw = (customRegionInput[product.id] ?? "")
                                    .trim()
                                    .toUpperCase();
                                  if (!raw) return;
                                  patchProduct(product.id, (prev) => ({
                                    ...prev,
                                    regions: Array.from(new Set([...prev.regions, raw])),
                                  }));
                                  setCustomRegionInput((prev) => ({
                                    ...prev,
                                    [product.id]: "",
                                  }));
                                }}
                                className="h-7 px-2.5 rounded-lg border border-stone-200 bg-stone-100 text-xs font-semibold text-stone-700 hover:bg-stone-200 cursor-pointer"
                              >
                                + Ajouter
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Points forts & notes de livraison */}
                        <div className="grid sm:grid-cols-2 gap-3.5">
                          <Field label="Points forts — 1 par ligne (Arabe)">
                            <textarea
                              dir="rtl"
                              rows={4}
                              value={product.featuresAr.join("\n")}
                              onChange={(e) =>
                                patchProduct(product.id, (prev) => ({
                                  ...prev,
                                  featuresAr: e.target.value
                                    .split("\n")
                                    .map((s) => s.trim())
                                    .filter(Boolean),
                                }))
                              }
                              className={ADMIN_TEXTAREA_CLS}
                            />
                          </Field>

                          <Field label="Points forts — 1 par ligne (Anglais)">
                            <textarea
                              dir="ltr"
                              rows={4}
                              value={product.featuresEn.join("\n")}
                              onChange={(e) =>
                                patchProduct(product.id, (prev) => ({
                                  ...prev,
                                  featuresEn: e.target.value
                                    .split("\n")
                                    .map((s) => s.trim())
                                    .filter(Boolean),
                                }))
                              }
                              className={ADMIN_TEXTAREA_CLS}
                            />
                          </Field>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-3.5">
                          <Field label="Note de livraison (Arabe)">
                            <input
                              dir="rtl"
                              value={product.deliveryNoteAr}
                              onChange={(e) =>
                                patchProduct(product.id, (prev) => ({
                                  ...prev,
                                  deliveryNoteAr: e.target.value,
                                }))
                              }
                              className={ADMIN_INPUT_CLS}
                            />
                          </Field>

                          <Field label="Note de livraison (Anglais)">
                            <input
                              dir="ltr"
                              value={product.deliveryNoteEn}
                              onChange={(e) =>
                                patchProduct(product.id, (prev) => ({
                                  ...prev,
                                  deliveryNoteEn: e.target.value,
                                }))
                              }
                              className={ADMIN_INPUT_CLS}
                            />
                          </Field>
                        </div>

                        {/* Paramètres techniques fournisseur & marge */}
                        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3.5 border-t border-stone-100 pt-3">
                          <Field label="ID interne">
                            <input
                              dir="ltr"
                              readOnly={!isCustom}
                              value={product.id}
                              className={`${ADMIN_INPUT_CLS} font-mono text-xs bg-stone-50 text-stone-500`}
                            />
                          </Field>

                          <Field label="Fournisseur">
                            <select
                              value={product.supplier ?? "fazercards"}
                              onChange={(e) =>
                                patchProduct(product.id, (prev) => ({
                                  ...prev,
                                  supplier: e.target.value as "fazercards" | "reloadly",
                                }))
                              }
                              className={ADMIN_INPUT_CLS}
                            >
                              <option value="fazercards">FazerCards</option>
                              <option value="reloadly">Historique / Manuel</option>
                            </select>
                          </Field>

                          <Field label="Mode de livraison">
                            <select
                              value={product.fulfillment ?? "auto"}
                              onChange={(e) =>
                                patchProduct(product.id, (prev) => ({
                                  ...prev,
                                  fulfillment: e.target.value as "auto" | "manual",
                                }))
                              }
                              className={ADMIN_INPUT_CLS}
                            >
                              <option value="auto">Automatique (API)</option>
                              <option value="manual">Manuelle (agence)</option>
                            </select>
                          </Field>

                          <Field label="Category ID FazerCards (achat auto)">
                            <input
                              dir="ltr"
                              value={product.supplierCategoryId ?? ""}
                              onChange={(e) =>
                                patchProduct(product.id, (prev) => ({
                                  ...prev,
                                  supplierCategoryId: e.target.value,
                                }))
                              }
                              placeholder="Ex. 142 ou psn-us"
                              className={`${ADMIN_INPUT_CLS} font-mono text-xs`}
                            />
                          </Field>
                        </div>
                      </div>
                    )}

                    {/* ONGLET 2 : MONTANTS & PRIX (DÉNOMINATIONS) */}
                    {activeTab === "denominations" && (
                      <DenominationsEditor
                        product={product}
                        onChange={(nextDenoms, nextMargin) =>
                          patchProduct(product.id, (prev) => ({
                            ...prev,
                            denominations: nextDenoms,
                            ...(nextMargin !== undefined
                              ? { marginPercent: nextMargin }
                              : {}),
                          }))
                        }
                      />
                    )}

                    {/* ONGLET 3 : SEO & GEO */}
                    {activeTab === "seo" && (
                      <SeoGeoEditor
                        product={product}
                        optimizing={optimizingId === product.id}
                        onOptimize={() => void optimizeProductSeoGeo(product)}
                        onChange={(nextSeo) =>
                          patchProduct(product.id, (prev) => ({
                            ...prev,
                            seo: nextSeo,
                          }))
                        }
                      />
                    )}

                    {/* ONGLET 4 : ÉTAPES D'UTILISATION & FAQ */}
                    {activeTab === "faq" && (
                      <StepsAndFaqEditor
                        product={product}
                        optimizing={optimizingId === product.id}
                        onOptimize={() => void optimizeProductSeoGeo(product)}
                        onChange={(nextSeo) =>
                          patchProduct(product.id, (prev) => ({
                            ...prev,
                            seo: nextSeo,
                          }))
                        }
                      />
                    )}

                    {/* Pied d'enregistrement de la fiche */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <span className="text-xs text-stone-500">
                        {isDirty
                          ? "● Modifications non enregistrées sur cette fiche."
                          : "Fiche synchronisée avec la boutique publique."}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={optimizingId === product.id}
                          onClick={() => void optimizeProductSeoGeo(product)}
                          className="h-9 px-4 rounded-xl border border-[#C6A664] bg-[#C6A664]/15 text-[#6F5620] text-xs font-bold hover:bg-[#C6A664]/25 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {optimizingId === product.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5" />
                          )}
                          Optimiser SEO & GEO
                        </button>
                        <button
                          type="button"
                          disabled={savingId === product.id || pending}
                          onClick={() => saveSingleProduct(product)}
                          className="h-9 px-5 rounded-xl bg-stone-900 text-white text-xs sm:text-sm font-bold hover:bg-stone-800 inline-flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-xs"
                        >
                          {savingId === product.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4 text-[#E5CA87]" />
                          )}
                          Enregistrer cette fiche
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="h-9 px-3.5 rounded-xl border border-stone-200 bg-white text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-40 cursor-pointer"
          >
            ← Précédent
          </button>
          <span className="text-xs text-stone-600 px-2">
            Page <strong>{currentPage}</strong> / {totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="h-9 px-3.5 rounded-xl border border-stone-200 bg-white text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-40 cursor-pointer"
          >
            Suivant →
          </button>
        </div>
      )}
    </div>
  );
}

/* ----------------------------- Sous-composants ----------------------------- */

function StatCard({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-3 text-left transition-colors cursor-pointer ${
        active
          ? "border-[#8A6D2F] bg-[#C6A664]/12"
          : "border-stone-200 bg-white hover:bg-stone-50"
      }`}
    >
      <div className="text-[11px] font-semibold text-stone-500">{label}</div>
      <div className="mt-0.5 text-xl font-extrabold text-stone-900">{value}</div>
    </button>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="flex items-center justify-between gap-2 text-xs font-semibold text-stone-600">
        <span>{label}</span>
        {hint}
      </span>
      {children}
    </label>
  );
}

function CharBadge({ len, max }: { len: number; max: number }) {
  const over = len > max;
  return (
    <span
      className={`font-mono text-[11px] ${
        over ? "text-red-600 font-bold" : len > 0 ? "text-emerald-700" : "text-stone-400"
      }`}
    >
      {len}/{max}
    </span>
  );
}

function DenominationsEditor({
  product,
  onChange,
}: {
  product: DigitalProduct;
  onChange: (next: DigitalDenomination[], nextMargin?: number | null) => void;
}) {
  const [marginInput, setMarginInput] = useState<string>(
    product.marginPercent != null ? String(product.marginPercent) : "12",
  );

  const updateDenom = (idx: number, patch: Partial<DigitalDenomination>) => {
    const copy = [...product.denominations];
    copy[idx] = { ...copy[idx], ...patch };
    onChange(copy);
  };

  const moveDenom = (idx: number, delta: -1 | 1) => {
    const target = idx + delta;
    if (target < 0 || target >= product.denominations.length) return;
    const copy = [...product.denominations];
    [copy[idx], copy[target]] = [copy[target], copy[idx]];
    onChange(copy);
  };

  const removeDenom = (idx: number) => {
    onChange(product.denominations.filter((_, i) => i !== idx));
  };

  const addDenom = () => {
    const stamp = Date.now().toString(36);
    const defaultRegion = product.regions[0] || "GLOBAL";
    onChange([
      ...product.denominations,
      {
        id: `offer-${stamp}`,
        label: "$10",
        faceValue: "10 USD",
        faceCurrency: "USD",
        region: defaultRegion,
        priceUsd: 10.9,
        available: true,
        maxQuantity: 10,
        fields: [],
      },
    ]);
  };

  const applyMarginToAll = () => {
    const pct = Number(marginInput);
    if (!Number.isFinite(pct) || pct < 0) return;
    const updated = product.denominations.map((d) => {
      if (d.supplierCostUsd == null || d.supplierCostUsd <= 0) return d;
      const raw = d.supplierCostUsd * (1 + pct / 100);
      const rounded = Math.ceil(raw * 20) / 20; // pas de 0,05 $
      return {
        ...d,
        priceUsd: Math.round(Math.max(0.5, rounded) * 100) / 100,
      };
    });
    onChange(updated, pct);
  };

  return (
    <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-extrabold text-stone-900">
            Montants, régions, prix USD & champs acheteur
          </h3>
          <p className="text-xs text-stone-500">
            Le prix en USD saisi ici est le montant exact facturé au client à la caisse.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-2.5 py-1">
            <span className="text-[11px] font-semibold text-stone-600">
              Marge sur coût (%) :
            </span>
            <input
              type="number"
              min={0}
              max={300}
              step="0.5"
              value={marginInput}
              onChange={(e) => setMarginInput(e.target.value)}
              className="h-7 w-16 rounded-lg border border-stone-200 bg-white px-2 text-xs font-mono"
            />
            <button
              type="button"
              onClick={applyMarginToAll}
              className="h-7 px-2.5 rounded-lg bg-stone-900 text-white text-[11px] font-bold hover:bg-stone-800 cursor-pointer"
            >
              Recalculer
            </button>
          </div>

          <button
            type="button"
            onClick={() =>
              onChange(product.denominations.map((d) => ({ ...d, available: true })))
            }
            className="h-8 px-2.5 rounded-xl border border-stone-200 bg-stone-50 text-xs font-semibold text-stone-700 hover:bg-stone-100 cursor-pointer"
          >
            Tout activer
          </button>
          <button
            type="button"
            onClick={addDenom}
            className="h-8 px-3 rounded-xl bg-stone-900 text-white text-xs font-bold hover:bg-stone-800 inline-flex items-center gap-1 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 text-[#E5CA87]" />
            Ajouter un montant
          </button>
        </div>
      </div>

      {product.denominations.length === 0 ? (
        <p className="text-xs text-stone-500 py-4 text-center">
          Aucun montant configuré. Cliquez sur « Ajouter un montant ».
        </p>
      ) : (
        <div className="space-y-3">
          {product.denominations.map((denom, idx) => {
            const cost = denom.supplierCostUsd;
            const loss =
              cost != null && cost > 0 && denom.priceUsd > 0 && denom.priceUsd < cost;
            const profitUsd =
              cost != null && cost > 0 ? denom.priceUsd - cost : null;

            return (
              <div
                key={`${denom.id}-${idx}`}
                className={`rounded-xl border p-3.5 space-y-3 ${
                  loss
                    ? "border-red-300 bg-red-50/40"
                    : denom.available
                      ? "border-stone-200 bg-stone-50/50"
                      : "border-stone-200 bg-stone-100/70 opacity-75"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <label className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={denom.available}
                        onChange={(e) =>
                          updateDenom(idx, { available: e.target.checked })
                        }
                        className="rounded border-stone-300"
                      />
                      Disponible
                    </label>
                    <span className="font-mono text-[11px] text-stone-500">
                      ID: {denom.id}
                    </span>
                    {cost != null && cost > 0 && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          loss
                            ? "bg-red-100 text-red-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        Coût fournisseur : {cost.toFixed(2)} $ ·{" "}
                        {profitUsd != null
                          ? `${profitUsd >= 0 ? "+" : ""}${profitUsd.toFixed(2)} $`
                          : ""}
                      </span>
                    )}
                    {loss && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Prix inférieur au coût fournisseur !
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveDenom(idx, -1)}
                      disabled={idx === 0}
                      className="p-1 rounded-lg border border-stone-200 bg-white text-stone-600 hover:bg-stone-100 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveDenom(idx, 1)}
                      disabled={idx === product.denominations.length - 1}
                      className="p-1 rounded-lg border border-stone-200 bg-white text-stone-600 hover:bg-stone-100 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeDenom(idx)}
                      className="p-1 rounded-lg border border-red-200 bg-white text-red-600 hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
                  <Field label="Libellé affiché">
                    <input
                      value={denom.label}
                      onChange={(e) => updateDenom(idx, { label: e.target.value })}
                      placeholder="$10 / 60 UC"
                      className={ADMIN_INPUT_CLS}
                    />
                  </Field>

                  <Field label="Valeur faciale">
                    <input
                      value={denom.faceValue}
                      onChange={(e) =>
                        updateDenom(idx, { faceValue: e.target.value })
                      }
                      placeholder="10 USD"
                      className={ADMIN_INPUT_CLS}
                    />
                  </Field>

                  <Field label="Devise faciale">
                    <input
                      dir="ltr"
                      value={denom.faceCurrency ?? ""}
                      onChange={(e) =>
                        updateDenom(idx, {
                          faceCurrency: e.target.value.toUpperCase() || null,
                        })
                      }
                      placeholder="USD"
                      className={`${ADMIN_INPUT_CLS} font-mono text-xs`}
                    />
                  </Field>

                  <Field label="Région">
                    <input
                      dir="ltr"
                      value={denom.region}
                      onChange={(e) =>
                        updateDenom(idx, {
                          region: e.target.value.toUpperCase() || "GLOBAL",
                        })
                      }
                      placeholder="GLOBAL, US…"
                      className={`${ADMIN_INPUT_CLS} font-mono text-xs`}
                    />
                  </Field>

                  <Field label="Prix de vente ($ USD)">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      dir="ltr"
                      value={denom.priceUsd}
                      onChange={(e) =>
                        updateDenom(idx, {
                          priceUsd: Number(e.target.value) || 0,
                        })
                      }
                      className={`${ADMIN_INPUT_CLS} font-mono font-bold`}
                    />
                  </Field>

                  <Field label="Qté max / commande">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      dir="ltr"
                      value={denom.maxQuantity ?? 10}
                      onChange={(e) =>
                        updateDenom(idx, {
                          maxQuantity: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                      className={`${ADMIN_INPUT_CLS} font-mono`}
                    />
                  </Field>
                </div>

                <div className="grid sm:grid-cols-3 gap-2.5">
                  <Field label="Note montant (Arabe, optionnel)">
                    <input
                      dir="rtl"
                      value={denom.noteAr ?? ""}
                      onChange={(e) =>
                        updateDenom(idx, { noteAr: e.target.value })
                      }
                      className={ADMIN_INPUT_CLS}
                    />
                  </Field>

                  <Field label="Note montant (Anglais, optionnel)">
                    <input
                      dir="ltr"
                      value={denom.noteEn ?? ""}
                      onChange={(e) =>
                        updateDenom(idx, { noteEn: e.target.value })
                      }
                      className={ADMIN_INPUT_CLS}
                    />
                  </Field>

                  <Field label="Offer ID fournisseur">
                    <input
                      dir="ltr"
                      value={denom.supplierOfferId ?? denom.id}
                      onChange={(e) =>
                        updateDenom(idx, { supplierOfferId: e.target.value })
                      }
                      className={`${ADMIN_INPUT_CLS} font-mono text-xs`}
                    />
                  </Field>
                </div>

                {/* Champs acheteur (recharges Player ID / Zone ID) */}
                {(product.kind === "game_topup" ||
                  (denom.fields && denom.fields.length > 0)) && (
                  <div className="space-y-2 border-t border-stone-200/70 pt-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-stone-600">
                        Champs demandés au client avant paiement (ex. Player ID, Server)
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updateDenom(idx, {
                            fields: [
                              ...(denom.fields ?? []),
                              { key: "player_id", label: "Player ID", type: "text" },
                            ],
                          })
                        }
                        className="text-[11px] font-bold text-[#8A6D2F] hover:underline cursor-pointer"
                      >
                        + Ajouter un champ client
                      </button>
                    </div>
                    {(denom.fields ?? []).map((f, fIdx) => (
                      <div key={fIdx} className="grid grid-cols-[1fr_1fr_100px_auto] gap-2">
                        <input
                          dir="ltr"
                          value={f.key}
                          onChange={(e) => {
                            const nextFields = [...(denom.fields ?? [])];
                            nextFields[fIdx] = { ...f, key: e.target.value };
                            updateDenom(idx, { fields: nextFields });
                          }}
                          placeholder="Clé API (player_id)"
                          className={`${ADMIN_INPUT_CLS} font-mono text-xs`}
                        />
                        <input
                          value={f.label}
                          onChange={(e) => {
                            const nextFields = [...(denom.fields ?? [])];
                            nextFields[fIdx] = { ...f, label: e.target.value };
                            updateDenom(idx, { fields: nextFields });
                          }}
                          placeholder="Libellé affiché (Player ID)"
                          className={ADMIN_INPUT_CLS}
                        />
                        <select
                          value={f.type || "text"}
                          onChange={(e) => {
                            const nextFields = [...(denom.fields ?? [])];
                            nextFields[fIdx] = { ...f, type: e.target.value };
                            updateDenom(idx, { fields: nextFields });
                          }}
                          className={ADMIN_INPUT_CLS}
                        >
                          <option value="text">Texte</option>
                          <option value="number">Nombre</option>
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            updateDenom(idx, {
                              fields: (denom.fields ?? []).filter(
                                (_, i) => i !== fIdx,
                              ),
                            })
                          }
                          className="px-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SeoGeoEditor({
  product,
  optimizing,
  onOptimize,
  onChange,
}: {
  product: DigitalProduct;
  optimizing: boolean;
  onOptimize: () => void;
  onChange: (next: DigitalProductSeo) => void;
}) {
  const seo = product.seo ?? {};
  const patch = (next: Partial<DigitalProductSeo>) => onChange({ ...seo, ...next });

  return (
    <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-extrabold text-stone-900">
            Optimisation SEO (Google/Bing) & GEO (ChatGPT, Perplexity, AI Overviews)
          </h3>
          <p className="text-xs text-stone-500">
            Laissez un champ vide pour utiliser le modèle automatique, ou cliquez sur
            « Optimiser SEO & GEO » pour générer des textes sur-mesure calibrés.
          </p>
        </div>

        <button
          type="button"
          disabled={optimizing}
          onClick={onOptimize}
          className="h-9 px-4 rounded-xl border border-[#C6A664] bg-[#C6A664]/15 text-[#6F5620] text-xs font-bold hover:bg-[#C6A664]/25 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          {optimizing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          Générer / Optimiser SEO & GEO
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-3.5">
        <Field label="Titre H1 & Nom structuré Product (Arabe)">
          <input
            dir="rtl"
            value={seo.h1Ar ?? ""}
            onChange={(e) => patch({ h1Ar: e.target.value })}
            placeholder="Ex. بطاقة هدايا بلايستيشن PlayStation (الولايات المتحدة)"
            className={ADMIN_INPUT_CLS}
          />
        </Field>

        <Field label="Titre H1 & Nom structuré Product (Anglais)">
          <input
            dir="ltr"
            value={seo.h1En ?? ""}
            onChange={(e) => patch({ h1En: e.target.value })}
            placeholder="Ex. PlayStation Gift Card (United States)"
            className={ADMIN_INPUT_CLS}
          />
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-3.5">
        <Field
          label="Balise Meta Title SERP (Arabe)"
          hint={<CharBadge len={(seo.seoTitleAr ?? "").length} max={60} />}
        >
          <input
            dir="rtl"
            value={seo.seoTitleAr ?? ""}
            onChange={(e) => patch({ seoTitleAr: e.target.value })}
            placeholder="≤ 60 caractères recommandés"
            className={ADMIN_INPUT_CLS}
          />
        </Field>

        <Field
          label="Balise Meta Title SERP (Anglais)"
          hint={<CharBadge len={(seo.seoTitleEn ?? "").length} max={60} />}
        >
          <input
            dir="ltr"
            value={seo.seoTitleEn ?? ""}
            onChange={(e) => patch({ seoTitleEn: e.target.value })}
            placeholder="≤ 60 characters recommended"
            className={ADMIN_INPUT_CLS}
          />
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-3.5">
        <Field
          label="Meta Description Google (Arabe)"
          hint={<CharBadge len={(seo.seoDescriptionAr ?? "").length} max={155} />}
        >
          <textarea
            dir="rtl"
            rows={3}
            value={seo.seoDescriptionAr ?? ""}
            onChange={(e) => patch({ seoDescriptionAr: e.target.value })}
            placeholder="≤ 155 caractères recommandés"
            className={ADMIN_TEXTAREA_CLS}
          />
        </Field>

        <Field
          label="Meta Description Google (Anglais)"
          hint={<CharBadge len={(seo.seoDescriptionEn ?? "").length} max={155} />}
        >
          <textarea
            dir="ltr"
            rows={3}
            value={seo.seoDescriptionEn ?? ""}
            onChange={(e) => patch({ seoDescriptionEn: e.target.value })}
            placeholder="≤ 155 characters recommended"
            className={ADMIN_TEXTAREA_CLS}
          />
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-3.5">
        <Field
          label="Texte alternatif de l’image — Alt (Arabe)"
          hint={<CharBadge len={(seo.imageAltAr ?? "").length} max={125} />}
        >
          <input
            dir="rtl"
            value={seo.imageAltAr ?? ""}
            onChange={(e) => patch({ imageAltAr: e.target.value })}
            className={ADMIN_INPUT_CLS}
          />
        </Field>

        <Field
          label="Texte alternatif de l’image — Alt (Anglais)"
          hint={<CharBadge len={(seo.imageAltEn ?? "").length} max={125} />}
        >
          <input
            dir="ltr"
            value={seo.imageAltEn ?? ""}
            onChange={(e) => patch({ imageAltEn: e.target.value })}
            className={ADMIN_INPUT_CLS}
          />
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-3.5">
        <Field label="Résumé « Answer-First » GEO — Moteurs IA & llms-full.txt (Arabe)">
          <textarea
            dir="rtl"
            rows={4}
            value={seo.geoSummaryAr ?? ""}
            onChange={(e) => patch({ geoSummaryAr: e.target.value })}
            placeholder="فقرة حقائق مركّزة لمحركات الذكاء الاصطناعي (المنصة، النطاق، السعر بالدولار/USDT، وآلية التسليم)."
            className={ADMIN_TEXTAREA_CLS}
          />
        </Field>

        <Field label="Résumé « Answer-First » GEO — Moteurs IA & llms-full.txt (Anglais)">
          <textarea
            dir="ltr"
            rows={4}
            value={seo.geoSummaryEn ?? ""}
            onChange={(e) => patch({ geoSummaryEn: e.target.value })}
            placeholder="Fact-dense paragraph cited by ChatGPT, Perplexity & Google AI Overviews (platform, region, USD/USDT price, delivery mode)."
            className={ADMIN_TEXTAREA_CLS}
          />
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-3.5">
        <Field label="Mots-clés SEO ciblés — 1 par ligne (Arabe)">
          <textarea
            dir="rtl"
            rows={3}
            value={(seo.keywordsAr ?? []).join("\n")}
            onChange={(e) =>
              patch({
                keywordsAr: e.target.value
                  .split(/\n|,|،/)
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            className={ADMIN_TEXTAREA_CLS}
          />
        </Field>

        <Field label="Mots-clés SEO ciblés — 1 par ligne (Anglais)">
          <textarea
            dir="ltr"
            rows={3}
            value={(seo.keywordsEn ?? []).join("\n")}
            onChange={(e) =>
              patch({
                keywordsEn: e.target.value
                  .split(/\n|,/)
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            className={ADMIN_TEXTAREA_CLS}
          />
        </Field>
      </div>
    </div>
  );
}

function StepsAndFaqEditor({
  product,
  optimizing,
  onOptimize,
  onChange,
}: {
  product: DigitalProduct;
  optimizing: boolean;
  onOptimize: () => void;
  onChange: (next: DigitalProductSeo) => void;
}) {
  const seo = product.seo ?? {};
  const faqs = seo.faqs ?? [];

  const updateFaq = (idx: number, patch: Partial<DigitalProductFaqItem>) => {
    const copy = [...faqs];
    copy[idx] = { ...copy[idx], ...patch };
    onChange({ ...seo, faqs: copy });
  };

  const addFaq = () => {
    onChange({
      ...seo,
      faqs: [
        ...faqs,
        {
          qAr: "",
          aAr: "",
          qEn: "",
          aEn: "",
        },
      ],
    });
  };

  const removeFaq = (idx: number) => {
    onChange({
      ...seo,
      faqs: faqs.filter((_, i) => i !== idx),
    });
  };

  return (
    <div className="space-y-5 rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-extrabold text-stone-900">
            Étapes d’activation & FAQ structurée (Schema.org FAQPage)
          </h3>
          <p className="text-xs text-stone-500">
            Ces étapes et questions s’affichent sur la fiche produit et alimentent le balisage JSON-LD.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={optimizing}
            onClick={onOptimize}
            className="h-8 px-3 rounded-xl border border-[#C6A664] bg-[#C6A664]/15 text-[#6F5620] text-xs font-bold hover:bg-[#C6A664]/25 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Pré-remplir via SEO & GEO
          </button>
          <button
            type="button"
            onClick={addFaq}
            className="h-8 px-3 rounded-xl bg-stone-900 text-white text-xs font-bold hover:bg-stone-800 inline-flex items-center gap-1 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 text-[#E5CA87]" />
            Ajouter une FAQ
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3.5">
        <Field label="Étapes d’utilisation — 1 étape par ligne (Arabe)">
          <textarea
            dir="rtl"
            rows={4}
            value={(seo.redeemStepsAr ?? []).join("\n")}
            onChange={(e) =>
              onChange({
                ...seo,
                redeemStepsAr: e.target.value
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            placeholder="Laissez vide pour les étapes automatiques selon le type de produit"
            className={ADMIN_TEXTAREA_CLS}
          />
        </Field>

        <Field label="Étapes d’utilisation — 1 étape par ligne (Anglais)">
          <textarea
            dir="ltr"
            rows={4}
            value={(seo.redeemStepsEn ?? []).join("\n")}
            onChange={(e) =>
              onChange({
                ...seo,
                redeemStepsEn: e.target.value
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            placeholder="Leave empty for automatic steps tailored to product kind"
            className={ADMIN_TEXTAREA_CLS}
          />
        </Field>
      </div>

      <div className="space-y-3 border-t border-stone-100 pt-3">
        <span className="block text-xs font-bold text-stone-700">
          Questions fréquentes personnalisées ({faqs.length})
        </span>
        {faqs.length === 0 ? (
          <p className="text-xs text-stone-500">
            Aucune FAQ personnalisée enregistrée (les 5–6 questions automatiques de la boutique sont
            utilisées). Cliquez sur « Pré-remplir via SEO & GEO » ou « Ajouter une FAQ » pour les
            personnaliser.
          </p>
        ) : (
          faqs.map((faq, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-stone-200 bg-stone-50/60 p-3.5 space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-700">
                  Question #{idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeFaq(idx)}
                  className="text-xs font-semibold text-red-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="h-3 w-3" /> Supprimer
                </button>
              </div>
              <div className="grid sm:grid-cols-2 gap-2.5">
                <Field label="Question (Arabe)">
                  <input
                    dir="rtl"
                    value={faq.qAr}
                    onChange={(e) => updateFaq(idx, { qAr: e.target.value })}
                    className={ADMIN_INPUT_CLS}
                  />
                </Field>
                <Field label="Question (Anglais)">
                  <input
                    dir="ltr"
                    value={faq.qEn}
                    onChange={(e) => updateFaq(idx, { qEn: e.target.value })}
                    className={ADMIN_INPUT_CLS}
                  />
                </Field>
              </div>
              <div className="grid sm:grid-cols-2 gap-2.5">
                <Field label="Réponse (Arabe)">
                  <textarea
                    dir="rtl"
                    rows={2}
                    value={faq.aAr}
                    onChange={(e) => updateFaq(idx, { aAr: e.target.value })}
                    className={ADMIN_TEXTAREA_CLS}
                  />
                </Field>
                <Field label="Réponse (Anglais)">
                  <textarea
                    dir="ltr"
                    rows={2}
                    value={faq.aEn}
                    onChange={(e) => updateFaq(idx, { aEn: e.target.value })}
                    className={ADMIN_TEXTAREA_CLS}
                  />
                </Field>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
