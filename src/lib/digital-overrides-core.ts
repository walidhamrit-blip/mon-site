import {
  PUBLIC_DIGITAL_STATUSES,
  type DigitalDenomination,
  type DigitalProduct,
  type DigitalProductSeo,
} from "@/lib/digital-types";

export const DIGITAL_OVERRIDES_SETTING_KEY = "digital:product-overrides";

export interface DigitalProductOverridesState {
  /** Fiches modifiées par l'admin, indexées par `product.id`. */
  overrides: Record<string, DigitalProduct>;
  /** Fiches ajoutées manuellement depuis l'admin. */
  customProducts: DigitalProduct[];
  /** Identifiants (`product.id`) de fiches masquées / supprimées par l'admin. */
  deletedIds: string[];
  /** Date ISO de dernière modification. */
  updatedAt?: string;
}

export const EMPTY_DIGITAL_OVERRIDES_STATE: DigitalProductOverridesState = {
  overrides: {},
  customProducts: [],
  deletedIds: [],
};

/** Normalise un état brut lu depuis `settings` (tolérant aux valeurs absentes ou partielles). */
export function normalizeDigitalOverridesState(
  raw: unknown,
): DigitalProductOverridesState {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      overrides: {},
      customProducts: [],
      deletedIds: [],
    };
  }
  const obj = raw as Record<string, unknown>;
  const overridesRaw =
    obj.overrides && typeof obj.overrides === "object" && !Array.isArray(obj.overrides)
      ? (obj.overrides as Record<string, unknown>)
      : {};
  const overrides: Record<string, DigitalProduct> = {};
  for (const [id, val] of Object.entries(overridesRaw)) {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      overrides[id] = val as DigitalProduct;
    }
  }
  const customProducts = Array.isArray(obj.customProducts)
    ? (obj.customProducts.filter(
        (item) => item && typeof item === "object" && !Array.isArray(item),
      ) as DigitalProduct[])
    : [];
  const deletedIds = Array.isArray(obj.deletedIds)
    ? Array.from(
        new Set(
          obj.deletedIds
            .map((id) => String(id ?? "").trim())
            .filter(Boolean),
        ),
      )
    : [];
  return {
    overrides,
    customProducts,
    deletedIds,
    ...(typeof obj.updatedAt === "string" ? { updatedAt: obj.updatedAt } : {}),
  };
}

/** Nettoie les champs SEO vides afin de laisser agir les générateurs automatiques quand un champ est effacé. */
export function cleanDigitalSeo(seo?: DigitalProductSeo | null): DigitalProductSeo | undefined {
  if (!seo || typeof seo !== "object") return undefined;
  const trimOrUndef = (v?: string) => {
    const s = (v ?? "").trim();
    return s.length > 0 ? s : undefined;
  };
  const listOrUndef = (arr?: string[]) => {
    if (!Array.isArray(arr)) return undefined;
    const cleaned = arr.map((item) => String(item ?? "").trim()).filter(Boolean);
    return cleaned.length > 0 ? cleaned : undefined;
  };
  const faqs = Array.isArray(seo.faqs)
    ? seo.faqs
        .map((f) => ({
          qAr: String(f?.qAr ?? "").trim(),
          aAr: String(f?.aAr ?? "").trim(),
          qEn: String(f?.qEn ?? "").trim(),
          aEn: String(f?.aEn ?? "").trim(),
        }))
        .filter((f) => (f.qAr && f.aAr) || (f.qEn && f.aEn))
    : undefined;

  const result: DigitalProductSeo = {
    ...(trimOrUndef(seo.seoTitleAr) ? { seoTitleAr: trimOrUndef(seo.seoTitleAr) } : {}),
    ...(trimOrUndef(seo.seoTitleEn) ? { seoTitleEn: trimOrUndef(seo.seoTitleEn) } : {}),
    ...(trimOrUndef(seo.seoDescriptionAr)
      ? { seoDescriptionAr: trimOrUndef(seo.seoDescriptionAr) }
      : {}),
    ...(trimOrUndef(seo.seoDescriptionEn)
      ? { seoDescriptionEn: trimOrUndef(seo.seoDescriptionEn) }
      : {}),
    ...(trimOrUndef(seo.h1Ar) ? { h1Ar: trimOrUndef(seo.h1Ar) } : {}),
    ...(trimOrUndef(seo.h1En) ? { h1En: trimOrUndef(seo.h1En) } : {}),
    ...(trimOrUndef(seo.imageAltAr) ? { imageAltAr: trimOrUndef(seo.imageAltAr) } : {}),
    ...(trimOrUndef(seo.imageAltEn) ? { imageAltEn: trimOrUndef(seo.imageAltEn) } : {}),
    ...(listOrUndef(seo.keywordsAr) ? { keywordsAr: listOrUndef(seo.keywordsAr) } : {}),
    ...(listOrUndef(seo.keywordsEn) ? { keywordsEn: listOrUndef(seo.keywordsEn) } : {}),
    ...(trimOrUndef(seo.geoSummaryAr) ? { geoSummaryAr: trimOrUndef(seo.geoSummaryAr) } : {}),
    ...(trimOrUndef(seo.geoSummaryEn) ? { geoSummaryEn: trimOrUndef(seo.geoSummaryEn) } : {}),
    ...(listOrUndef(seo.redeemStepsAr) ? { redeemStepsAr: listOrUndef(seo.redeemStepsAr) } : {}),
    ...(listOrUndef(seo.redeemStepsEn) ? { redeemStepsEn: listOrUndef(seo.redeemStepsEn) } : {}),
    ...(faqs && faqs.length > 0 ? { faqs } : {}),
  };

  return Object.keys(result).length > 0 ? result : undefined;
}

/** Retire les coûts d'achat et identifiants internes fournisseur avant envoi au navigateur public. */
export function stripInternalProductFields(product: DigitalProduct): DigitalProduct {
  const { supplierCategoryId: _cat, ...restProduct } = product;
  void _cat;
  return {
    ...restProduct,
    denominations: (product.denominations ?? []).map((denomination) => {
      const {
        supplierCostUsd: _cost,
        supplierOfferId: _offer,
        ...publicDenom
      } = denomination;
      void _cost;
      void _offer;
      return publicDenom;
    }),
  };
}

/** Fusionne une fiche source (fournisseur ou base) avec sa surcharge enregistrée par l'admin. */
export function mergeProductWithOverride(
  base: DigitalProduct,
  override: DigitalProduct,
  options: { keepInternalFields?: boolean } = {},
): DigitalProduct {
  const baseById = new Map<string, DigitalDenomination>();
  for (const denom of base.denominations ?? []) {
    baseById.set(denom.id, denom);
    if (denom.supplierOfferId) {
      baseById.set(denom.supplierOfferId, denom);
    }
  }

  const mergedDenominations: DigitalDenomination[] = (
    Array.isArray(override.denominations) ? override.denominations : base.denominations
  ).map((denom) => {
    const source =
      baseById.get(denom.id) ??
      (denom.supplierOfferId ? baseById.get(denom.supplierOfferId) : undefined);
    const merged: DigitalDenomination = {
      ...source,
      ...denom,
      supplierCostUsd: source?.supplierCostUsd ?? denom.supplierCostUsd ?? null,
      supplierOfferId: denom.supplierOfferId || source?.supplierOfferId || denom.id,
    };
    return merged;
  });

  const mergedProduct: DigitalProduct = {
    ...base,
    ...override,
    id: base.id,
    supplier: override.supplier ?? base.supplier,
    supplierCategoryId: override.supplierCategoryId || base.supplierCategoryId,
    denominations: mergedDenominations,
    seo: cleanDigitalSeo(override.seo ?? base.seo),
  };

  return options.keepInternalFields
    ? mergedProduct
    : stripInternalProductFields(mergedProduct);
}

/**
 * Applique les surcharges, les suppressions et les fiches personnalisées sur
 * un catalogue de fiches digitales.
 */
export function applyDigitalOverrides(
  baseProducts: readonly DigitalProduct[],
  state: DigitalProductOverridesState,
  options: { publicOnly?: boolean; keepInternalFields?: boolean } = {},
): DigitalProduct[] {
  const publicOnly = options.publicOnly !== false;
  const keepInternal = options.keepInternalFields === true;
  const deletedSet = new Set(state.deletedIds);
  const seenIds = new Set<string>();
  const out: DigitalProduct[] = [];

  for (const base of baseProducts) {
    seenIds.add(base.id);
    if (deletedSet.has(base.id)) continue;
    const override = state.overrides[base.id];
    const resolved = override
      ? mergeProductWithOverride(base, override, { keepInternalFields: keepInternal })
      : keepInternal
        ? { ...base, seo: cleanDigitalSeo(base.seo) }
        : stripInternalProductFields({ ...base, seo: cleanDigitalSeo(base.seo) });
    if (publicOnly && !PUBLIC_DIGITAL_STATUSES.includes(resolved.status)) {
      continue;
    }
    out.push(resolved);
  }

  for (const custom of state.customProducts) {
    if (!custom?.id || seenIds.has(custom.id) || deletedSet.has(custom.id)) {
      continue;
    }
    seenIds.add(custom.id);
    const resolved = keepInternal
      ? { ...custom, seo: cleanDigitalSeo(custom.seo) }
      : stripInternalProductFields({ ...custom, seo: cleanDigitalSeo(custom.seo) });
    if (publicOnly && !PUBLIC_DIGITAL_STATUSES.includes(resolved.status)) {
      continue;
    }
    out.push(resolved);
  }

  // Garantit l'unicité des slugs publics après personnalisation.
  const usedSlugs = new Set<string>();
  const deduped = out.map((product) => {
    let candidate = product.slug.trim() || product.id.toLowerCase();
    if (!usedSlugs.has(candidate)) {
      usedSlugs.add(candidate);
      return product;
    }
    let idx = 2;
    while (usedSlugs.has(`${candidate}-${idx}`)) idx += 1;
    candidate = `${candidate}-${idx}`;
    usedSlugs.add(candidate);
    return { ...product, slug: candidate };
  });

  deduped.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  return deduped;
}

/** Forme minimale d'une fiche FazerCards brute utilisée à la caisse et à la validation d'ID. */
export interface FazercardsCheckoutCatalogItem {
  id: string;
  slug: string;
  categoryId: string;
  kind: DigitalProduct["kind"];
  platform: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  image: string;
  regions: string[];
  denominations: {
    id: string;
    label: string;
    faceValue: string;
    region: string;
    priceUsd: number;
    supplierCostUsd: number | null;
    supplierOfferId: string;
    available: boolean;
    maxOrderQuantity: number;
    fields: { key: string; label: string; type: string }[];
  }[];
}

/**
 * Résout une fiche FazerCards pour la caisse (`/api/fazercards/checkout`) ou
 * la vérification d'ID (`/api/fazercards/validate-id`), en appliquant les
 * prix, disponibilités, statuts et champs modifiés par l'admin.
 */
export function resolveFazercardsCheckoutProduct<T extends FazercardsCheckoutCatalogItem>(
  rawProducts: readonly T[],
  state: DigitalProductOverridesState,
  slugOrId: string,
): T | null {
  const key = slugOrId.trim();
  if (!key) return null;
  const deletedSet = new Set(state.deletedIds);

  for (const raw of rawProducts) {
    if (deletedSet.has(raw.id)) continue;
    const override = state.overrides[raw.id];
    const matchesRaw = raw.id === key || raw.slug === key;
    const matchesOverride = override?.slug === key || override?.id === key;
    if (!matchesRaw && !matchesOverride) continue;

    if (override) {
      // Une fiche passée en brouillon, archivée ou « bientôt disponible » ne peut pas être achetée.
      if (override.status !== "available") return null;

      const rawById = new Map(raw.denominations.map((d) => [d.id, d]));
      const mergedDenoms = (
        Array.isArray(override.denominations) ? override.denominations : []
      ).map((denom) => {
        const source =
          rawById.get(denom.id) ??
          (denom.supplierOfferId ? rawById.get(denom.supplierOfferId) : undefined);
        return {
          ...source,
          id: denom.id,
          label: denom.label,
          faceValue: denom.faceValue || denom.label,
          region: denom.region || source?.region || "GLOBAL",
          priceUsd: denom.priceUsd,
          // On conserve toujours le coût fournisseur réel pour le garde-fou de solde.
          supplierCostUsd: source?.supplierCostUsd ?? denom.supplierCostUsd ?? null,
          supplierOfferId: denom.supplierOfferId || source?.supplierOfferId || denom.id,
          available: denom.available,
          maxOrderQuantity: Math.max(
            1,
            denom.maxQuantity ?? source?.maxOrderQuantity ?? 10,
          ),
          fields: denom.fields ?? source?.fields ?? [],
        };
      });

      return {
        ...raw,
        slug: override.slug || raw.slug,
        kind: override.kind || raw.kind,
        categoryId: override.supplierCategoryId || raw.categoryId,
        platform: override.platform || raw.platform,
        titleAr: override.titleAr || raw.titleAr,
        titleEn: override.titleEn || raw.titleEn,
        descriptionAr: override.descriptionAr || raw.descriptionAr,
        descriptionEn: override.descriptionEn || raw.descriptionEn,
        image: override.image ?? raw.image,
        regions: override.regions?.length ? override.regions : raw.regions,
        denominations: mergedDenoms as T["denominations"],
      };
    }

    return raw;
  }

  // Recherche également parmi les fiches personnalisées reliées à FazerCards.
  for (const custom of state.customProducts) {
    if (deletedSet.has(custom.id)) continue;
    if (custom.id !== key && custom.slug !== key) continue;
    if (custom.status !== "available") return null;
    if (custom.supplier !== "fazercards" || !custom.supplierCategoryId) return null;

    const synthetic: FazercardsCheckoutCatalogItem = {
      id: custom.id,
      slug: custom.slug,
      categoryId: custom.supplierCategoryId,
      kind: custom.kind,
      platform: custom.platform,
      titleAr: custom.titleAr,
      titleEn: custom.titleEn,
      descriptionAr: custom.descriptionAr,
      descriptionEn: custom.descriptionEn,
      image: custom.image,
      regions: custom.regions,
      denominations: (custom.denominations ?? []).map((denom) => ({
        id: denom.id,
        label: denom.label,
        faceValue: denom.faceValue || denom.label,
        region: denom.region || "GLOBAL",
        priceUsd: denom.priceUsd,
        supplierCostUsd: denom.supplierCostUsd ?? null,
        supplierOfferId: denom.supplierOfferId || denom.id,
        available: denom.available,
        maxOrderQuantity: Math.max(1, denom.maxQuantity ?? 10),
        fields: denom.fields ?? [],
      })),
    };
    return synthetic as T;
  }

  return null;
}
