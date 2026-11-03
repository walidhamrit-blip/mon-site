import { eq } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { settings } from "@/db/schema";
import {
  DIGITAL_OVERRIDES_SETTING_KEY,
  EMPTY_DIGITAL_OVERRIDES_STATE,
  applyDigitalOverrides,
  cleanDigitalSeo,
  normalizeDigitalOverridesState,
  type DigitalProductOverridesState,
} from "@/lib/digital-overrides-core";
import type { DigitalProduct } from "@/lib/digital-types";

const OVERRIDES_CACHE_TTL_MS = 15_000;

let overridesCache: {
  state: DigitalProductOverridesState;
  readAt: number;
} | null = null;

export function invalidateDigitalOverridesCache(): void {
  overridesCache = null;
}

function dbReady(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

/**
 * Lit les surcharges et fiches personnalisées de la boutique depuis `settings`.
 * Ne lève jamais en lecture : si la base n'est pas configurée ou momentanément
 * indisponible, retourne un état vide afin de ne jamais casser le rendu public.
 */
export async function readDigitalOverrides(
  options: { fresh?: boolean } = {},
): Promise<DigitalProductOverridesState> {
  if (
    !options.fresh &&
    overridesCache &&
    Date.now() - overridesCache.readAt < OVERRIDES_CACHE_TTL_MS
  ) {
    return overridesCache.state;
  }

  if (!dbReady()) {
    return EMPTY_DIGITAL_OVERRIDES_STATE;
  }

  try {
    await ensureSchema();
    const rows = await db
      .select()
      .from(settings)
      .where(eq(settings.key, DIGITAL_OVERRIDES_SETTING_KEY))
      .limit(1);
    const state = normalizeDigitalOverridesState(rows[0]?.value);
    overridesCache = { state, readAt: Date.now() };
    return state;
  } catch (error) {
    console.warn(
      "[digital-overrides] lecture impossible :",
      error instanceof Error ? error.message : error,
    );
    return overridesCache?.state ?? EMPTY_DIGITAL_OVERRIDES_STATE;
  }
}

/** Écrit l'état complet des surcharges dans la table `settings`. */
export async function writeDigitalOverrides(
  state: DigitalProductOverridesState,
): Promise<DigitalProductOverridesState> {
  await ensureSchema();
  const next: DigitalProductOverridesState = {
    overrides: state.overrides,
    customProducts: state.customProducts,
    deletedIds: Array.from(new Set(state.deletedIds)),
    updatedAt: new Date().toISOString(),
  };
  await db
    .insert(settings)
    .values({
      key: DIGITAL_OVERRIDES_SETTING_KEY,
      value: next,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: settings.key,
      set: {
        value: next,
        updatedAt: new Date(),
      },
    });
  overridesCache = { state: next, readAt: Date.now() };
  return next;
}

/**
 * Enregistre la modification d'une fiche produit (fournisseur ou personnalisée).
 * Si `isCustom` est vrai (ou si l'identifiant commence par `custom-` et n'est
 * pas une fiche fournisseur), la fiche est stockée dans `customProducts`.
 */
export async function upsertDigitalProductOverride(
  product: DigitalProduct,
  options: { isBaseProduct: boolean },
): Promise<DigitalProductOverridesState> {
  const current = await readDigitalOverrides({ fresh: true });
  const cleaned: DigitalProduct = {
    ...product,
    seo: cleanDigitalSeo(product.seo),
  };
  const deletedIds = current.deletedIds.filter((id) => id !== cleaned.id);

  if (options.isBaseProduct) {
    const overrides = {
      ...current.overrides,
      [cleaned.id]: cleaned,
    };
    const customProducts = current.customProducts.filter((c) => c.id !== cleaned.id);
    return writeDigitalOverrides({
      overrides,
      customProducts,
      deletedIds,
    });
  }

  const existingIdx = current.customProducts.findIndex((c) => c.id === cleaned.id);
  const customProducts = [...current.customProducts];
  if (existingIdx >= 0) {
    customProducts[existingIdx] = cleaned;
  } else {
    customProducts.unshift(cleaned);
  }
  const overrides = { ...current.overrides };
  delete overrides[cleaned.id];

  return writeDigitalOverrides({
    overrides,
    customProducts,
    deletedIds,
  });
}

/** Enregistre un lot de fiches modifiées (ex. optimisation SEO/GEO en lot). */
export async function upsertDigitalProductOverridesBatch(
  items: { product: DigitalProduct; isBaseProduct: boolean }[],
): Promise<DigitalProductOverridesState> {
  const current = await readDigitalOverrides({ fresh: true });
  const overrides = { ...current.overrides };
  const customProducts = [...current.customProducts];
  const deletedSet = new Set(current.deletedIds);

  for (const { product, isBaseProduct } of items) {
    const cleaned: DigitalProduct = {
      ...product,
      seo: cleanDigitalSeo(product.seo),
    };
    deletedSet.delete(cleaned.id);
    if (isBaseProduct) {
      overrides[cleaned.id] = cleaned;
    } else {
      const idx = customProducts.findIndex((c) => c.id === cleaned.id);
      if (idx >= 0) customProducts[idx] = cleaned;
      else customProducts.push(cleaned);
    }
  }

  return writeDigitalOverrides({
    overrides,
    customProducts,
    deletedIds: Array.from(deletedSet),
  });
}

/** Réinitialise une fiche fournisseur à ses valeurs d'origine (supprime sa surcharge). */
export async function resetDigitalProductOverride(
  productId: string,
): Promise<DigitalProductOverridesState> {
  const current = await readDigitalOverrides({ fresh: true });
  const overrides = { ...current.overrides };
  delete overrides[productId];
  const deletedIds = current.deletedIds.filter((id) => id !== productId);
  return writeDigitalOverrides({
    overrides,
    customProducts: current.customProducts,
    deletedIds,
  });
}

/**
 * Supprime une fiche personnalisée ou masque une fiche fournisseur de la boutique.
 */
export async function removeDigitalProduct(
  productId: string,
  options: { isBaseProduct: boolean },
): Promise<DigitalProductOverridesState> {
  const current = await readDigitalOverrides({ fresh: true });
  const overrides = { ...current.overrides };
  delete overrides[productId];
  const customProducts = current.customProducts.filter((c) => c.id !== productId);
  const deletedIds = options.isBaseProduct
    ? Array.from(new Set([...current.deletedIds, productId]))
    : current.deletedIds.filter((id) => id !== productId);
  return writeDigitalOverrides({
    overrides,
    customProducts,
    deletedIds,
  });
}

/** Restaure une fiche fournisseur précédemment masquée. */
export async function restoreDigitalProduct(
  productId: string,
): Promise<DigitalProductOverridesState> {
  const current = await readDigitalOverrides({ fresh: true });
  const deletedIds = current.deletedIds.filter((id) => id !== productId);
  return writeDigitalOverrides({
    overrides: current.overrides,
    customProducts: current.customProducts,
    deletedIds,
  });
}

export { applyDigitalOverrides };
