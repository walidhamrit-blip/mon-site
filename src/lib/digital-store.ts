import { asc, eq, inArray } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { digitalDenominations, digitalProducts } from "@/db/schema";
import { defaultDigitalProducts } from "@/lib/digital-seed";
import { fazercardsConfigured } from "@/lib/fazercards";
import { getFazercardsDigitalCatalog } from "@/lib/fazercards-catalog";
import {
  PUBLIC_DIGITAL_STATUSES,
  type DigitalDenomination,
  type DigitalFulfillment,
  type DigitalProduct,
  type DigitalStatus,
} from "@/lib/digital-types";

const DEFAULT_DIGITAL_PRODUCT_IMAGES = new Map(
  defaultDigitalProducts.map((product) => [product.id, product.image]),
);

/**
 * État de santé du catalogue public.
 *
 * Panne vécue le 29/10/2026 : le quota de calcul Neon était épuisé, la base
 * était suspendue, et la boutique affichait **8 fiches de démonstration
 * périmées** sans le moindre signe de panne — ni pour le visiteur, ni pour
 * le propriétaire, ni pour le sitemap. On enregistre donc le dernier échec
 * de lecture pour pouvoir :
 *  - afficher un bandeau « boutique momentanément indisponible » au lieu
 *    d'un faux catalogue (les commandes ne pourraient de toute façon pas
 *    être enregistrées) ;
 *  - retirer les fiches du sitemap pendant la panne (ne pas apprendre à
 *    Google que le catalogue fait 8 produits) ;
 *  - exposer l'état dans `/api/health` et dans `npm run doctor`.
 *
 * L'état est mémorisé par instance : un rendu réussi le remet à zéro.
 */
interface CatalogFailure {
  at: number;
  message: string;
}

let catalogFailure: CatalogFailure | null = null;

export interface DigitalCatalogStatus {
  /** Vrai quand une base est configurée mais qu'elle ne répond plus. */
  degraded: boolean;
  reason: "database_unreachable" | null;
  message: string | null;
  /** Horodatage ISO du premier échec encore en cours. */
  since: string | null;
}

/** Une base est-elle censée répondre ? (sinon : mode démo local/CI) */
export function databaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function recordCatalogFailure(error: unknown): void {
  // Sans DATABASE_URL (CI, `next build`, poste de dev sans base), le repli
  // sur les fiches codées en dur est le fonctionnement normal : ce n'est
  // pas une panne, et afficher un bandeau serait trompeur.
  if (!databaseConfigured()) return;
  catalogFailure = {
    at: catalogFailure?.at ?? Date.now(),
    message: error instanceof Error ? error.message : String(error),
  };
}

function clearCatalogFailure(): void {
  catalogFailure = null;
}

/** État courant, sans requête supplémentaire (aucune consommation Neon). */
export function digitalCatalogStatus(): DigitalCatalogStatus {
  if (!catalogFailure) {
    return { degraded: false, reason: null, message: null, since: null };
  }
  return {
    degraded: true,
    reason: "database_unreachable",
    message: catalogFailure.message,
    since: new Date(catalogFailure.at).toISOString(),
  };
}

/**
 * Mémo du catalogue public (2 min).
 *
 * `/codes` est rendu à chaque requête (`force-dynamic`, indispensable pour
 * voir le catalogue fournisseur). Sans mémo, chaque visite — et chaque
 * passage d'un robot — refaisait une lecture en base. Deux minutes suffisent
 * largement pour une boutique : les écritures admin invalident le mémo
 * explicitement, et le fournisseur a déjà son propre cache.
 */
const PUBLIC_CATALOG_TTL_MS = 120_000;
let publicCatalogCache: { products: DigitalProduct[]; at: number } | null = null;

/** À appeler après toute écriture du catalogue (admin, cron, seed). */
export function clearPublicCatalogCache(): void {
  publicCatalogCache = null;
}

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
            supplierFeePercent: percentToColumn(product.supplierFeePercent),
            supplierDiscountPercent: percentToColumn(product.supplierDiscountPercent),
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
              faceCurrency: denomination.faceCurrency
                ? String(denomination.faceCurrency).toUpperCase().slice(0, 3)
                : null,
              supplierCostUsd: costToColumn(denomination.supplierCostUsd),
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

/** Normalise un pourcentage fournisseur pour la colonne texte. */
function percentToColumn(value: number | null | undefined): string | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? String(parsed) : null;
}

/** Coût USD en colonne texte (null si absent ou incohérent). */
function costToColumn(value: number | null | undefined): string | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed.toFixed(2) : null;
}

/** Lit un coût USD stocké en texte (null si absent ou illisible). */
function columnToCost(value: string | null): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** Lit un pourcentage stocké en texte (null si absent ou illisible). */
function columnToPercent(value: string | null): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
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
    faceCurrency: row.faceCurrency ? String(row.faceCurrency).toUpperCase() : null,
    supplierCostUsd: columnToCost(row.supplierCostUsd),
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
    // Les anciennes lignes ont été semées avant l'ajout des visuels et
    // contiennent donc une chaîne vide. On leur applique l'image locale par
    // défaut sans écraser une image personnalisée enregistrée dans l'admin.
    image:
      row.image.trim() || DEFAULT_DIGITAL_PRODUCT_IMAGES.get(row.id) || "",
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
    supplierFeePercent: columnToPercent(row.supplierFeePercent),
    supplierDiscountPercent: columnToPercent(row.supplierDiscountPercent),
    // Les fiches de la base sont les fiches historiques, reliées à Reloadly.
    supplier: "reloadly",
  };
}

/** Ajoute le fournisseur aux fiches de repli (codées en dur). */
function withSupplier(products: DigitalProduct[]): DigitalProduct[] {
  return products.map((product) => ({ ...product, supplier: product.supplier ?? "reloadly" }));
}

/**
 * Lit le catalogue.
 *
 * @param options.publicOnly limite aux fiches visibles publiquement
 *   (`coming_soon` et `available`) — les brouillons et les archives
 *   n'apparaissent jamais sur le site public.
 */
async function getStoredCatalog(
  options: { publicOnly?: boolean } = {},
): Promise<DigitalProduct[]> {
  const { publicOnly = true } = options;
  try {
    await ensureSeeded();
    const rows = await db
      .select()
      .from(digitalProducts)
      .orderBy(asc(digitalProducts.sortOrder), asc(digitalProducts.id));
    // La base répond : la panne éventuelle est terminée.
    clearCatalogFailure();

    const visible = publicOnly
      ? rows.filter((row) =>
          (PUBLIC_DIGITAL_STATUSES as string[]).includes(row.status),
        )
      : rows;

    if (visible.length === 0) {
      return withSupplier(defaultDigitalProducts);
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
    recordCatalogFailure(error);
    return withSupplier(defaultDigitalProducts);
  }
}

/**
 * Catalogue « live » du fournisseur (FazerCards).
 *
 * FazerCards est le fournisseur retenu : quand sa clé est configurée, c'est
 * SON catalogue qui est publié sur `/codes`, pas celui de la base (les
 * fiches historiques sont reliées à Reloadly, dont le compte a été fermé).
 *
 * Renvoie `null` — et la vitrine retombe alors sur la base — dans trois cas :
 *  - aucune clé fournisseur (site en mode catalogue historique) ;
 *  - build de production : un build ne doit pas dépendre d'une API tierce
 *    (lenteur, panne) ; les pages se rafraîchissent ensuite via ISR (60 s) ;
 *  - fournisseur injoignable ET aucun catalogue en cache.
 */
async function getLiveCatalog(): Promise<DigitalProduct[] | null> {
  if (!fazercardsConfigured()) return null;
  if (process.env.NEXT_PHASE === "phase-production-build") return null;
  try {
    // Rendu de page : jamais de synchronisation complète ici (elle dépasse
    // le temps d'exécution d'une fonction serverless). On lit la copie en
    // cache/base, rafraîchie par le cron.
    const { products, stale } = await getFazercardsDigitalCatalog({ noSync: true });
    if (stale) {
      console.warn("[digital] catalogue fournisseur servi depuis un cache périmé");
    }
    return products.length > 0 ? products : null;
  } catch (error) {
    console.error(
      "[digital] catalogue fournisseur indisponible, repli sur la base :",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/**
 * Lit le catalogue public.
 *
 * Source de vérité : le fournisseur (FazerCards) quand il est configuré ;
 * sinon la base (fiches historiques). L'administration, elle, travaille
 * toujours sur la base (`publicOnly: false`).
 *
 * @param options.publicOnly limite aux fiches visibles publiquement
 *   (`coming_soon` et `available`) — les brouillons et les archives
 *   n'apparaissent jamais sur le site public.
 */
export async function getDigitalCatalog(
  options: { publicOnly?: boolean } = {},
): Promise<DigitalProduct[]> {
  const { publicOnly = true } = options;
  if (!publicOnly) return getStoredCatalog({ publicOnly: false });

  // Mémo court : `/codes` est rendu à chaque requête, et sans lui chaque
  // visite (donc chaque passage de robot) relisait la base. Les écritures
  // invalident explicitement le mémo (voir `clearPublicCatalogCache`).
  const now = Date.now();
  if (publicCatalogCache && now - publicCatalogCache.at < PUBLIC_CATALOG_TTL_MS) {
    return publicCatalogCache.products;
  }

  const live = await getLiveCatalog();
  const products = live ?? (await getStoredCatalog({ publicOnly: true }));
  // On ne mémorise pas un repli dû à une panne : dès que la base revient,
  // la page doit le voir tout de suite plutôt qu'au bout de deux minutes.
  if (live || !digitalCatalogStatus().degraded) {
    publicCatalogCache = { products, at: now };
  }
  return products;
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
  clearPublicCatalogCache();
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
      supplierFeePercent: percentToColumn(product.supplierFeePercent),
      supplierDiscountPercent: percentToColumn(product.supplierDiscountPercent),
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
        supplierFeePercent: percentToColumn(product.supplierFeePercent),
        supplierDiscountPercent: percentToColumn(product.supplierDiscountPercent),
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
        faceCurrency: denomination.faceCurrency
          ? String(denomination.faceCurrency).toUpperCase().slice(0, 3)
          : null,
        supplierCostUsd: costToColumn(denomination.supplierCostUsd),
      })),
    );
  }
}

/** Supprime une fiche (et ses dénominations, en cascade). */
export async function deleteDigitalProduct(id: string): Promise<void> {
  clearPublicCatalogCache();
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
