import { asc, eq, inArray } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { digitalDenominations, digitalProducts } from "@/db/schema";
import { defaultDigitalProducts } from "@/lib/digital-seed";
import {
  PUBLIC_DIGITAL_STATUSES,
  type DigitalDenomination,
  type DigitalFulfillment,
  type DigitalProduct,
  type DigitalStatus,
} from "@/lib/digital-types";

/**
 * Accès au catalogue digital (codes logiciels & cartes cadeaux).
 *
 * Comme le reste du site, toute lecture est protégée : si la base est
 * indisponible, on retourne le catalogue par défaut (codé en dur) plutôt
 * que de casser la vitrine.
 *
 * Le catalogue par défaut est inséré en base au premier accès : l'admin
 * peut ensuite le modifier librement (les modifications ne sont jamais
 * écrasées par le catalogue par défaut).
 */

/**
 * Frais du processeur de paiement, en % (défaut 1 % — NOWPayments).
 * Override : `PAYMENT_FEE_PERCENT`. Sert au calcul du prix de vente.
 */
export function paymentFeePercent(): number {
  const raw = Number(process.env.PAYMENT_FEE_PERCENT);
  return Number.isFinite(raw) && raw >= 0 && raw < 20 ? raw : 1;
}

let seeded: Promise<void> | null = null;

/** Insère le catalogue par défaut s'il n'existe pas encore. */
async function ensureSeeded(): Promise<void> {
  if (!seeded) {
    seeded = (async () => {
      await ensureSchema();
      const existing = await db.select({ id: digitalProducts.id }).from(digitalProducts);
      const known = new Set(existing.map((row) => row.id));
      const missing = defaultDigitalProducts.filter((product) => !known.has(product.id));
      for (const product of missing) {
        await db
          .insert(digitalProducts)
          .values({
            id: product.id,
            slug: product.slug,
            kind: product.kind,
            status: product.status,
            platform: product.platform,
            color: product.color,
            titleAr: product.titleAr,
            titleEn: product.titleEn,
            descriptionAr: product.descriptionAr,
            descriptionEn: product.descriptionEn,
            image: product.image,
            regions: product.regions,
            featuresAr: product.featuresAr,
            featuresEn: product.featuresEn,
            deliveryNoteAr: product.deliveryNoteAr,
            deliveryNoteEn: product.deliveryNoteEn,
            sortOrder: product.sortOrder,
            fulfillment: product.fulfillment ?? "manual",
            reloadlyProductId: product.reloadlyProductId ?? null,
            reloadlyCountryCode: product.reloadlyCountryCode ?? "",
            marginPercent:
              product.marginPercent != null ? String(product.marginPercent) : null,
          })
          .onConflictDoNothing();
        if (product.denominations.length > 0) {
          await db.insert(digitalDenominations).values(
            product.denominations.map((denomination, index) => ({
              productId: product.id,
              label: denomination.label,
              faceValue: denomination.faceValue,
              region: denomination.region,
              priceUsd: denomination.priceUsd.toFixed(2),
              noteAr: denomination.noteAr ?? null,
              noteEn: denomination.noteEn ?? null,
              available: denomination.available ? 1 : 0,
              sortOrder: index,
              reloadlyUnitPrice:
                denomination.reloadlyUnitPrice != null
                  ? String(denomination.reloadlyUnitPrice)
                  : null,
            })),
          );
        }
      }
    })().catch((error) => {
      seeded = null; // permet de réessayer au prochain accès
      throw error;
    });
  }
  return seeded;
}

/** Normalise la marge pour la colonne texte (null si non renseignée). */
function marginToColumn(value: number | null | undefined): string | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? String(parsed) : null;
}

function toArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function rowToDenomination(row: typeof digitalDenominations.$inferSelect): DigitalDenomination {
  const price = Number(row.priceUsd);
  return {
    id: String(row.id),
    label: row.label,
    faceValue: row.faceValue,
    region: row.region,
    priceUsd: Number.isFinite(price) ? price : 0,
    noteAr: row.noteAr ?? undefined,
    noteEn: row.noteEn ?? undefined,
    available: row.available !== 0,
    reloadlyUnitPrice: row.reloadlyUnitPrice != null ? Number(row.reloadlyUnitPrice) : null,
  };
}

function rowToProduct(
  row: typeof digitalProducts.$inferSelect,
  denominations: DigitalDenomination[],
): DigitalProduct {
  return {
    id: row.id,
    slug: row.slug,
    kind: row.kind as DigitalProduct["kind"],
    status: row.status as DigitalStatus,
    platform: row.platform,
    color: row.color,
    titleAr: row.titleAr,
    titleEn: row.titleEn,
    descriptionAr: row.descriptionAr,
    descriptionEn: row.descriptionEn,
    image: row.image,
    regions: toArray(row.regions),
    featuresAr: toArray(row.featuresAr),
    featuresEn: toArray(row.featuresEn),
    deliveryNoteAr: row.deliveryNoteAr,
    deliveryNoteEn: row.deliveryNoteEn,
    denominations,
    sortOrder: row.sortOrder,
    fulfillment: (row.fulfillment === "auto" ? "auto" : "manual") as DigitalFulfillment,
    reloadlyProductId: row.reloadlyProductId ?? null,
    reloadlyCountryCode: row.reloadlyCountryCode ?? "",
    marginPercent:
      row.marginPercent != null && Number.isFinite(Number(row.marginPercent))
        ? Number(row.marginPercent)
        : null,
  };
}

/**
 * Lit le catalogue.
 *
 * @param options.publicOnly limite aux fiches visibles publiquement
 *   (`coming_soon` et `available`) — les brouillons et les archives
 *   n'apparaissent jamais sur le site public.
 */
export async function getDigitalCatalog(
  options: { publicOnly?: boolean } = {},
): Promise<DigitalProduct[]> {
  const { publicOnly = true } = options;
  try {
    await ensureSeeded();
    const rows = await db
      .select()
      .from(digitalProducts)
      .orderBy(asc(digitalProducts.sortOrder), asc(digitalProducts.id));

    const visible = publicOnly
      ? rows.filter((row) =>
          (PUBLIC_DIGITAL_STATUSES as string[]).includes(row.status),
        )
      : rows;

    if (visible.length === 0) {
      return publicOnly ? defaultDigitalProducts : defaultDigitalProducts;
    }

    const ids = visible.map((row) => row.id);
    const denominationRows =
      ids.length > 0
        ? await db
            .select()
            .from(digitalDenominations)
            .where(inArray(digitalDenominations.productId, ids))
            .orderBy(asc(digitalDenominations.sortOrder), asc(digitalDenominations.id))
        : [];

    const byProduct = new Map<string, DigitalDenomination[]>();
    for (const row of denominationRows) {
      const list = byProduct.get(row.productId) ?? [];
      list.push(rowToDenomination(row));
      byProduct.set(row.productId, list);
    }

    return visible.map((row) => rowToProduct(row, byProduct.get(row.id) ?? []));
  } catch (error) {
    console.error(
      "[digital] lecture du catalogue impossible :",
      error instanceof Error ? error.message : error,
    );
    return defaultDigitalProducts;
  }
}

/** Fiche unique par slug (public : seules les fiches publiées sont visées). */
export async function getDigitalProductBySlug(
  slug: string,
): Promise<DigitalProduct | null> {
  const catalog = await getDigitalCatalog({ publicOnly: true });
  return catalog.find((product) => product.slug === slug) ?? null;
}

/** Fiche unique par identifiant interne (admin). */
export async function getDigitalProductById(id: string): Promise<DigitalProduct | null> {
  const catalog = await getDigitalCatalog({ publicOnly: false });
  return catalog.find((product) => product.id === id) ?? null;
}

/** Crée ou met à jour une fiche et ses dénominations. */
export async function upsertDigitalProduct(product: DigitalProduct): Promise<void> {
  await ensureSchema();
  await db
    .insert(digitalProducts)
    .values({
      id: product.id,
      slug: product.slug,
      kind: product.kind,
      status: product.status,
      platform: product.platform,
      color: product.color,
      titleAr: product.titleAr,
      titleEn: product.titleEn,
      descriptionAr: product.descriptionAr,
      descriptionEn: product.descriptionEn,
      image: product.image,
      regions: product.regions,
      featuresAr: product.featuresAr,
      featuresEn: product.featuresEn,
      deliveryNoteAr: product.deliveryNoteAr,
      deliveryNoteEn: product.deliveryNoteEn,
      sortOrder: product.sortOrder,
      fulfillment: product.fulfillment === "auto" ? "auto" : "manual",
      reloadlyProductId:
        product.reloadlyProductId != null && Number(product.reloadlyProductId) > 0
          ? Math.trunc(Number(product.reloadlyProductId))
          : null,
      reloadlyCountryCode: (product.reloadlyCountryCode ?? "").toUpperCase().slice(0, 2),
      marginPercent: marginToColumn(product.marginPercent),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: digitalProducts.id,
      set: {
        slug: product.slug,
        kind: product.kind,
        status: product.status,
        platform: product.platform,
        color: product.color,
        titleAr: product.titleAr,
        titleEn: product.titleEn,
        descriptionAr: product.descriptionAr,
        descriptionEn: product.descriptionEn,
        image: product.image,
        regions: product.regions,
        featuresAr: product.featuresAr,
        featuresEn: product.featuresEn,
        deliveryNoteAr: product.deliveryNoteAr,
        deliveryNoteEn: product.deliveryNoteEn,
        sortOrder: product.sortOrder,
        fulfillment: product.fulfillment === "auto" ? "auto" : "manual",
        reloadlyProductId:
          product.reloadlyProductId != null && Number(product.reloadlyProductId) > 0
            ? Math.trunc(Number(product.reloadlyProductId))
            : null,
        reloadlyCountryCode: (product.reloadlyCountryCode ?? "").toUpperCase().slice(0, 2),
        marginPercent: marginToColumn(product.marginPercent),
        updatedAt: new Date(),
      },
    });

  // Les dénominations sont réécrites intégralement : l'admin gère une liste
  // simple, l'invariance des identifiants de ligne n'a aucune valeur ici.
  await db.delete(digitalDenominations).where(eq(digitalDenominations.productId, product.id));
  if (product.denominations.length > 0) {
    await db.insert(digitalDenominations).values(
      product.denominations.map((denomination, index) => ({
        productId: product.id,
        label: denomination.label,
        faceValue: denomination.faceValue,
        region: denomination.region,
        priceUsd: denomination.priceUsd.toFixed(2),
        noteAr: denomination.noteAr ?? null,
        noteEn: denomination.noteEn ?? null,
        available: denomination.available ? 1 : 0,
        sortOrder: index,
        reloadlyUnitPrice:
          denomination.reloadlyUnitPrice != null &&
          Number(denomination.reloadlyUnitPrice) > 0
            ? String(Number(denomination.reloadlyUnitPrice))
            : null,
      })),
    );
  }
}

/** Supprime une fiche (et ses dénominations, en cascade). */
export async function deleteDigitalProduct(id: string): Promise<void> {
  await ensureSchema();
  await db.delete(digitalProducts).where(eq(digitalProducts.id, id));
}

/** Liste des plateformes présentes au catalogue (pour les filtres publics). */
export async function getDigitalPlatforms(publicOnly = true): Promise<string[]> {
  const catalog = await getDigitalCatalog({ publicOnly });
  const platforms = new Set<string>();
  for (const product of catalog) {
    if (product.platform) platforms.add(product.platform);
  }
  return Array.from(platforms).sort((a, b) => a.localeCompare(b));
}

/** Liste des régions couvertes par le catalogue (pour les filtres publics). */
export async function getDigitalRegions(publicOnly = true): Promise<string[]> {
  const catalog = await getDigitalCatalog({ publicOnly });
  const regions = new Set<string>();
  for (const product of catalog) {
    for (const region of product.regions) regions.add(region.toUpperCase());
    for (const denomination of product.denominations) {
      if (denomination.available) regions.add(denomination.region.toUpperCase());
    }
  }
  return Array.from(regions).sort((a, b) => a.localeCompare(b));
}

/** Filtre les fiches par statut (admin). */
export function filterByStatus(
  products: DigitalProduct[],
  status: DigitalStatus | "all",
): DigitalProduct[] {
  if (status === "all") return products;
  return products.filter((product) => product.status === status);
}
