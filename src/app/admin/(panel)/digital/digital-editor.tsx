"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import {
  deleteDigitalProductAction,
  saveDigitalProduct,
} from "@/app/admin/actions";
import { computeSalePrice } from "@/lib/digital-order-core";
import {
  DIGITAL_FULFILLMENTS,
  DIGITAL_KINDS,
  DIGITAL_KIND_LABELS,
  DIGITAL_REGIONS,
  DIGITAL_STATUSES,
  DIGITAL_STATUS_LABELS,
  denominationUnitPrice,
  regionLabel,
  slugify,
  type DigitalDenomination,
  type DigitalProduct,
} from "@/lib/digital-types";
import { ReloadlyPriceCheck } from "./reloadly-price-check";
import { ReloadlyProductSearch } from "./reloadly-product-search";

/**
 * Éditeur du catalogue digital (admin).
 *
 * L'écran gère la fiche ET ses dénominations : chaque montant porte sa
 * région, son prix en USD et sa disponibilité. C'est exactement ce que la
 * future caisse consommera — le passage de « catalogue » à « vente » ne
 * demandera aucune reprise de données.
 */
/** Frais et remise publiés par Reloadly pour un produit relié. */
interface SupplierFees {
  senderFeePercentage: number;
  discountPercentage: number;
}

export function DigitalEditor({
  initialProducts,
  paymentFeePercent,
}: {
  initialProducts: DigitalProduct[];
  /** Frais du processeur de paiement, en % (NOWPayments par défaut). */
  paymentFeePercent: number;
}) {
  const [products, setProducts] = useState<DigitalProduct[]>(initialProducts);
  // Frais Reloadly par fiche, renseignés par la vérification des montants.
  const [fees, setFees] = useState<Record<string, SupplierFees>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [busy, startTransition] = useTransition();
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);

  const flash = (msg: string, kind: "ok" | "err") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 4000);
  };

  const visible = useMemo(
    () =>
      statusFilter === "all"
        ? products
        : products.filter((product) => product.status === statusFilter),
    [products, statusFilter],
  );

  const patch = (id: string, next: Partial<DigitalProduct>) => {
    setProducts((prev) =>
      prev.map((product) => (product.id === id ? { ...product, ...next } : product)),
    );
  };

  const patchDenomination = (
    productId: string,
    denominationId: string,
    next: Partial<DigitalDenomination>,
  ) => {
    setProducts((prev) =>
      prev.map((product) =>
        product.id !== productId
          ? product
          : {
              ...product,
              denominations: product.denominations.map((denomination) =>
                denomination.id === denominationId
                  ? { ...denomination, ...next }
                  : denomination,
              ),
            },
      ),
    );
  };

  /**
   * Recalcule les prix de vente d'une fiche à partir de sa marge nette et du
   * coût réel chez Reloadly (valeur faciale + frais du fournisseur).
   *
   * Le prix enregistré reste la source de vérité côté caisse : on écrit donc
   * le résultat dans `priceUsd` au lieu de le recalculer à chaque paiement.
   */
  const recalcPrices = (product: DigitalProduct, marginPercent: number | null): DigitalProduct => {
    if (marginPercent == null || !Number.isFinite(marginPercent)) return product;
    const supplier = fees[product.id] ?? { senderFeePercentage: 0, discountPercentage: 0 };
    return {
      ...product,
      denominations: product.denominations.map((denomination) => {
        const face = denominationUnitPrice(denomination);
        const computed = computeSalePrice({
          faceValue: face,
          senderFeePercent: supplier.senderFeePercentage,
          discountPercent: supplier.discountPercentage,
          marginPercent,
          paymentFeePercent,
        });
        return computed.ok ? { ...denomination, priceUsd: computed.price } : denomination;
      }),
    };
  };

  const setMargin = (product: DigitalProduct, raw: string) => {
    const margin = raw.trim() === "" ? null : Number(raw.replace(",", "."));
    const valid = margin != null && Number.isFinite(margin) && margin >= 0;
    setProducts((prev) =>
      prev.map((item) =>
        item.id !== product.id
          ? item
          : recalcPrices(
              { ...item, marginPercent: valid ? (margin as number) : null },
              valid ? (margin as number) : null,
            ),
      ),
    );
  };

  const addDenomination = (productId: string) => {
    setProducts((prev) =>
      prev.map((product) =>
        product.id !== productId
          ? product
          : {
              ...product,
              denominations: [
                ...product.denominations,
                {
                  id: `${productId}-${product.denominations.length + 1}-${Date.now()}`,
                  label: "$10",
                  faceValue: "10 USD",
                  region: "global",
                  priceUsd: 10,
                  available: true,
                },
              ],
            },
      ),
    );
  };

  const removeDenomination = (productId: string, denominationId: string) => {
    setProducts((prev) =>
      prev.map((product) =>
        product.id !== productId
          ? product
          : {
              ...product,
              denominations: product.denominations.filter(
                (denomination) => denomination.id !== denominationId,
              ),
            },
      ),
    );
  };

  const addProduct = () => {
    const id = `nouveau-${Date.now()}`;
    const product: DigitalProduct = {
      id,
      slug: id,
      kind: "gift_card",
      status: "draft",
      platform: "",
      color: "#C6A664",
      titleAr: "منتج جديد",
      titleEn: "New product",
      descriptionAr: "",
      descriptionEn: "",
      image: "",
      regions: ["global"],
      featuresAr: [],
      featuresEn: [],
      deliveryNoteAr: "",
      deliveryNoteEn: "",
      denominations: [],
      sortOrder: products.length * 10 + 10,
      fulfillment: "manual",
      reloadlyProductId: null,
      reloadlyCountryCode: "",
    };
    setProducts((prev) => [...prev, product]);
    setExpandedId(id);
  };

  const save = (product: DigitalProduct) => {
    startTransition(async () => {
      const payload = {
        ...product,
        slug: slugify(product.slug || product.titleEn || product.id),
        id: slugify(product.id),
      };
      const result = await saveDigitalProduct(payload);
      if (result.ok) {
        setProducts((prev) =>
          prev.map((item) => (item.id === product.id ? payload : item)),
        );
        flash(result.message ?? "Fiche enregistrée.", "ok");
      } else {
        flash(result.error ?? "Échec de l'enregistrement.", "err");
      }
    });
  };

  const remove = (product: DigitalProduct) => {
    if (!confirm(`Supprimer définitivement « ${product.titleAr} » du catalogue ?`)) {
      return;
    }
    startTransition(async () => {
      const result = await deleteDigitalProductAction(product.id);
      if (result.ok) {
        setProducts((prev) => prev.filter((item) => item.id !== product.id));
        flash(result.message ?? "Fiche supprimée.", "ok");
      } else {
        flash(result.error ?? "Échec de la suppression.", "err");
      }
    });
  };

  const inputCls =
    "h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm outline-none focus:border-[#B8923F] focus:ring-2 focus:ring-[#C6A664]/25";
  const labelCls = "mb-1 block text-[11px] font-bold uppercase tracking-wide text-stone-500";

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-black tracking-tight text-stone-900">
            Codes &amp; cartes cadeaux
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            Catalogue des codes logiciels, cartes cadeaux gaming et recharges. Les
            prix sont en USD (devise de facturation) ; chaque montant porte sa
            région.
          </p>
        </div>
        <button
          type="button"
          onClick={addProduct}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-stone-900 px-4 text-sm font-bold text-[#E5CA87] transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Nouvelle fiche
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="h-9 rounded-lg border border-stone-300 bg-white px-3 text-sm font-semibold text-stone-700"
        >
          <option value="all">Tous les statuts</option>
          {DIGITAL_STATUSES.map((status) => (
            <option key={status} value={status}>
              {DIGITAL_STATUS_LABELS[status].fr}
            </option>
          ))}
        </select>
        <span className="text-sm text-stone-500">
          {visible.length} fiche{visible.length === 1 ? "" : "s"}
        </span>
      </div>

      {toast && (
        <div
          className={`rounded-lg border px-4 py-2.5 text-sm font-semibold ${
            toast.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div className="space-y-3">
        {visible.map((product) => {
          const open = expandedId === product.id;
          return (
            <div
              key={product.id}
              className="overflow-hidden rounded-xl border border-stone-200 bg-white"
            >
              <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[11px] font-black text-white"
                  style={{ backgroundColor: product.color }}
                >
                  {product.platform.slice(0, 2).toUpperCase() || "•"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-stone-900">
                    {product.titleAr}
                  </div>
                  <div className="truncate text-[12px] text-stone-500">
                    {product.platform || "—"} · /codes/{product.slug} ·{" "}
                    {product.denominations.length} montant
                    {product.denominations.length === 1 ? "" : "s"}
                  </div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                    product.status === "available"
                      ? "bg-emerald-100 text-emerald-800"
                      : product.status === "coming_soon"
                        ? "bg-amber-100 text-amber-800"
                        : product.status === "draft"
                          ? "bg-stone-100 text-stone-600"
                          : "bg-stone-200 text-stone-700"
                  }`}
                >
                  {DIGITAL_STATUS_LABELS[product.status].fr}
                </span>
                <button
                  type="button"
                  onClick={() => setExpandedId(open ? null : product.id)}
                  aria-label={open ? "Replier" : "Modifier"}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50"
                >
                  {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => remove(product)}
                  aria-label="Supprimer"
                  className="grid h-8 w-8 place-items-center rounded-lg border border-stone-200 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {open && (
                <div className="space-y-5 border-t border-stone-200 bg-[#FAF9F6] p-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <label className="block">
                      <span className={labelCls}>Titre (AR)</span>
                      <input
                        className={inputCls}
                        value={product.titleAr}
                        onChange={(event) =>
                          patch(product.id, { titleAr: event.target.value })
                        }
                      />
                    </label>
                    <label className="block">
                      <span className={labelCls}>Titre (EN)</span>
                      <input
                        className={inputCls}
                        value={product.titleEn}
                        onChange={(event) =>
                          patch(product.id, { titleEn: event.target.value })
                        }
                      />
                    </label>
                    <label className="block">
                      <span className={labelCls}>Plateforme</span>
                      <input
                        className={inputCls}
                        value={product.platform}
                        onChange={(event) =>
                          patch(product.id, { platform: event.target.value })
                        }
                      />
                    </label>
                    <label className="block">
                      <span className={labelCls}>Slug</span>
                      <input
                        className={inputCls}
                        value={product.slug}
                        onChange={(event) =>
                          patch(product.id, { slug: slugify(event.target.value) })
                        }
                      />
                    </label>
                    <label className="block">
                      <span className={labelCls}>Type</span>
                      <select
                        className={inputCls}
                        value={product.kind}
                        onChange={(event) =>
                          patch(product.id, {
                            kind: event.target.value as DigitalProduct["kind"],
                          })
                        }
                      >
                        {DIGITAL_KINDS.map((kind) => (
                          <option key={kind} value={kind}>
                            {DIGITAL_KIND_LABELS[kind].fr}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className={labelCls}>Statut</span>
                      <select
                        className={inputCls}
                        value={product.status}
                        onChange={(event) =>
                          patch(product.id, {
                            status: event.target.value as DigitalProduct["status"],
                          })
                        }
                      >
                        {DIGITAL_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {DIGITAL_STATUS_LABELS[status].fr}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className={labelCls}>Couleur</span>
                      <input
                        className={inputCls}
                        value={product.color}
                        onChange={(event) =>
                          patch(product.id, { color: event.target.value })
                        }
                      />
                    </label>
                    <label className="block">
                      <span className={labelCls}>Ordre d&apos;affichage</span>
                      <input
                        type="number"
                        className={inputCls}
                        value={product.sortOrder}
                        onChange={(event) =>
                          patch(product.id, { sortOrder: Number(event.target.value) || 0 })
                        }
                      />
                    </label>
                    <label className="block">
                      <span className={labelCls}>Livraison</span>
                      <select
                        className={inputCls}
                        value={product.fulfillment ?? "manual"}
                        onChange={(event) =>
                          patch(product.id, {
                            fulfillment: event.target.value as "manual" | "auto",
                          })
                        }
                      >
                        {DIGITAL_FULFILLMENTS.map((mode) => (
                          <option key={mode} value={mode}>
                            {mode === "auto"
                              ? "Automatique (achat Reloadly)"
                              : "Manuelle (agence)"}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className={labelCls}>Produit Reloadly (ID)</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        placeholder="ex. 1234"
                        className={inputCls}
                        value={product.reloadlyProductId ?? ""}
                        onChange={(event) =>
                          patch(product.id, {
                            reloadlyProductId: event.target.value
                              ? Number(event.target.value)
                              : null,
                          })
                        }
                      />
                    </label>
                    <label className="block">
                      <span className={labelCls}>Pays Reloadly (ISO)</span>
                      <input
                        maxLength={2}
                        placeholder="US"
                        className={`${inputCls} uppercase`}
                        value={product.reloadlyCountryCode ?? ""}
                        onChange={(event) =>
                          patch(product.id, {
                            reloadlyCountryCode: event.target.value
                              .replace(/[^a-zA-Z]/g, "")
                              .toUpperCase(),
                          })
                        }
                      />
                    </label>
                  </div>

                  <ReloadlyProductSearch
                    defaultCountry={product.reloadlyCountryCode}
                    onSelect={({ productId, countryCode }) =>
                      patch(product.id, {
                        reloadlyProductId: productId,
                        reloadlyCountryCode: countryCode,
                      })
                    }
                  />

                  <div className="mt-2 grid gap-2 sm:grid-cols-[160px_1fr] sm:items-end">
                    <label className="block">
                      <span className={labelCls}>Marge nette (%)</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="50"
                        placeholder="ex. 4"
                        className={inputCls}
                        value={product.marginPercent ?? ""}
                        onChange={(event) => setMargin(product, event.target.value)}
                      />
                    </label>
                    <p className="rounded-lg bg-[#FAF9F6] px-3 py-2 text-[11.5px] leading-5 text-stone-600">
                      Renseignez la marge : <strong>les prix de vente de tous les
                      montants sont recalculés automatiquement</strong> à partir du coût
                      réel (valeur Reloadly + frais du fournisseur) et des frais de
                      paiement ({paymentFeePercent} %). Videz le champ pour reprendre la
                      main sur les prix.
                    </p>
                  </div>

                  <ReloadlyPriceCheck
                    productId={product.reloadlyProductId ?? null}
                    denominations={product.denominations}
                    paymentFeePercent={paymentFeePercent}
                    marginPercent={product.marginPercent ?? null}
                    onLoaded={(fees) => {
                      setFees((prev) => ({ ...prev, [product.id]: fees }));
                      // Les frais arrivent après le premier rendu : on réaligne
                      // les prix déjà calculés pour qu'ils en tiennent compte.
                      if (product.marginPercent != null) {
                        setProducts((prev) =>
                          prev.map((item) =>
                            item.id !== product.id
                              ? item
                              : {
                                  ...item,
                                  denominations: item.denominations.map((denomination) => {
                                    const computed = computeSalePrice({
                                      faceValue: denominationUnitPrice(denomination),
                                      senderFeePercent: fees.senderFeePercentage,
                                      discountPercent: fees.discountPercentage,
                                      marginPercent: product.marginPercent as number,
                                      paymentFeePercent,
                                    });
                                    return computed.ok
                                      ? { ...denomination, priceUsd: computed.price }
                                      : denomination;
                                  }),
                                },
                          ),
                        );
                      }
                    }}
                  />

                  <p className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-[11.5px] leading-5 text-stone-600">
                    <strong>Vente à la commande :</strong> en mode automatique, le
                    serveur achète le code chez Reloadly{" "}
                    <em>après</em> confirmation du paiement (solde marchand requis) ;
                    l&apos;ID produit et la « valeur Reloadly » de chaque montant
                    doivent correspondre au catalogue Reloadly. Sans ID produit, la
                    fiche retombe en livraison manuelle. Les commandes se pilotent
                    dans{" "}
                    <a
                      href="/admin/digital/orders"
                      className="font-bold text-[#7A5D20] underline"
                    >
                      Commandes de codes
                    </a>
                    .
                  </p>

                  <label className="block">
                    <span className={labelCls}>Description (AR)</span>
                    <textarea
                      rows={2}
                      className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#B8923F]"
                      value={product.descriptionAr}
                      onChange={(event) =>
                        patch(product.id, { descriptionAr: event.target.value })
                      }
                    />
                  </label>
                  <label className="block">
                    <span className={labelCls}>Description (EN)</span>
                    <textarea
                      rows={2}
                      className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#B8923F]"
                      value={product.descriptionEn}
                      onChange={(event) =>
                        patch(product.id, { descriptionEn: event.target.value })
                      }
                    />
                  </label>

                  <div>
                    <span className={labelCls}>Régions couvertes</span>
                    <div className="flex flex-wrap gap-1.5">
                      {DIGITAL_REGIONS.map((region) => {
                        const active = product.regions.some(
                          (item) => item.toUpperCase() === region,
                        );
                        return (
                          <button
                            key={region}
                            type="button"
                            onClick={() =>
                              patch(product.id, {
                                regions: active
                                  ? product.regions.filter(
                                      (item) => item.toUpperCase() !== region,
                                    )
                                  : [...product.regions, region],
                              })
                            }
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                              active
                                ? "border-[#B8923F] bg-[#C6A664]/20 text-stone-900"
                                : "border-stone-300 bg-white text-stone-500"
                            }`}
                          >
                            {regionLabel(region, "en")}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Dénominations */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className={labelCls}>Montants & régions</span>
                      <button
                        type="button"
                        onClick={() => addDenomination(product.id)}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-stone-300 bg-white px-3 text-[12px] font-bold text-stone-700 hover:bg-stone-50"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Montant
                      </button>
                    </div>
                    {product.denominations.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-stone-300 px-3 py-4 text-center text-[12px] text-stone-500">
                        Aucun montant défini — la fiche s&apos;affichera sans prix.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {product.denominations.map((denomination) => (
                          <div
                            key={denomination.id}
                            className="grid items-end gap-2 rounded-lg border border-stone-200 bg-white p-2.5 sm:grid-cols-[1fr_1fr_1fr_0.8fr_1fr_auto]"
                          >
                            <label className="block">
                              <span className="text-[10px] font-bold uppercase text-stone-400">
                                Libellé
                              </span>
                              <input
                                className="h-9 w-full rounded-md border border-stone-300 px-2 text-[13px] outline-none focus:border-[#B8923F]"
                                value={denomination.label}
                                onChange={(event) =>
                                  patchDenomination(product.id, denomination.id, {
                                    label: event.target.value,
                                  })
                                }
                              />
                            </label>
                            <label className="block">
                              <span className="text-[10px] font-bold uppercase text-stone-400">
                                Région
                              </span>
                              <select
                                className="h-9 w-full rounded-md border border-stone-300 bg-white px-2 text-[13px] outline-none focus:border-[#B8923F]"
                                value={denomination.region}
                                onChange={(event) =>
                                  patchDenomination(product.id, denomination.id, {
                                    region: event.target.value,
                                  })
                                }
                              >
                                {DIGITAL_REGIONS.map((region) => (
                                  <option key={region} value={region}>
                                    {regionLabel(region, "en")}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="block">
                              <span className="text-[10px] font-bold uppercase text-stone-400">
                                Prix (USD)
                              </span>
                              <input
                                type="number"
                                step="0.01"
                                className="h-9 w-full rounded-md border border-stone-300 px-2 text-[13px] outline-none focus:border-[#B8923F]"
                                value={denomination.priceUsd}
                                onChange={(event) =>
                                  patchDenomination(product.id, denomination.id, {
                                    priceUsd: Number(event.target.value) || 0,
                                  })
                                }
                              />
                            </label>
                            <label className="block">
                              <span className="text-[10px] font-bold uppercase text-stone-400">
                                Valeur Reloadly
                              </span>
                              <input
                                type="number"
                                step="0.01"
                                inputMode="decimal"
                                placeholder={denomination.faceValue || "50"}
                                className="h-9 w-full rounded-md border border-stone-300 px-2 text-[13px] outline-none focus:border-[#B8923F]"
                                value={denomination.reloadlyUnitPrice ?? ""}
                                onChange={(event) =>
                                  patchDenomination(product.id, denomination.id, {
                                    reloadlyUnitPrice: event.target.value
                                      ? Number(event.target.value)
                                      : null,
                                  })
                                }
                              />
                            </label>
                            <label className="block">
                              <span className="text-[10px] font-bold uppercase text-stone-400">
                                Disponible
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  patchDenomination(product.id, denomination.id, {
                                    available: !denomination.available,
                                  })
                                }
                                className={`flex h-9 w-full items-center justify-center gap-1.5 rounded-md border text-[12px] font-bold ${
                                  denomination.available
                                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                    : "border-stone-300 bg-stone-50 text-stone-500"
                                }`}
                              >
                                {denomination.available ? (
                                  <>
                                    <Check className="h-3.5 w-3.5" /> Oui
                                  </>
                                ) : (
                                  <>
                                    <X className="h-3.5 w-3.5" /> Non
                                  </>
                                )}
                              </button>
                            </label>
                            <button
                              type="button"
                              onClick={() =>
                                removeDenomination(product.id, denomination.id)
                              }
                              aria-label="Retirer le montant"
                              className="grid h-9 w-9 place-items-center rounded-md border border-stone-200 text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => save(product)}
                      disabled={busy}
                      className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-stone-900 px-4 text-sm font-bold text-[#E5CA87] transition-opacity hover:opacity-90 disabled:opacity-60"
                    >
                      <Save className="h-4 w-4" />
                      Enregistrer
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
