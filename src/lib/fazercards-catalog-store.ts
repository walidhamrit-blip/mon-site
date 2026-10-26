// Persistance du catalogue FazerCards — côté serveur uniquement.
//
// Pourquoi une base et pas seulement un cache mémoire : une
// synchronisation complète coûte UN appel HTTP par catégorie (~123 pour le
// catalogue actuel). Dans une fonction serverless, cela dépasse le temps
// d'exécution autorisé : la page expirait et retombait silencieusement sur
// le catalogue historique (ou renvoyait une erreur 500).
//
// Le catalogue synchronisé est donc stocké dans la table `settings`
// (clé/valeur JSON, déjà présente — aucune migration). Le rendu des pages
// lit cette copie en une requête : rapide, stable, et partagée par toutes
// les instances. Le rafraîchissement est fait par un cron
// (`/api/cron/fazercards-catalog`) et, à défaut, à la demande.

import { eq } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { settings } from "@/db/schema";
import type { FazercardsSyncResult } from "@/lib/fazercards-catalog";

/** Clé de la ligne `settings` qui porte le catalogue. */
export const FAZERCARDS_CATALOG_SETTING_KEY = "fazercards:catalog";

/** Catalogue persisté : le résultat de synchro + son horodatage. */
export interface StoredFazercardsCatalog {
  result: FazercardsSyncResult;
  /** Date de la synchronisation qui a produit ce catalogue. */
  fetchedAt: number;
}

/** Valide la forme minimale relue depuis la base (donnée non fiable). */
function parseStored(value: unknown): StoredFazercardsCatalog | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as {
    products?: unknown;
    errors?: unknown;
    fetchedAt?: unknown;
  };
  if (!Array.isArray(raw.products) || raw.products.length === 0) return null;
  const fetchedAt = Number(raw.fetchedAt);
  if (!Number.isFinite(fetchedAt) || fetchedAt <= 0) return null;
  return {
    result: {
      products: raw.products as FazercardsSyncResult["products"],
      total: raw.products.length,
      errors: Array.isArray(raw.errors) ? (raw.errors as string[]) : [],
    },
    fetchedAt,
  };
}

/**
 * Lit le catalogue persisté. Renvoie `null` (jamais d'exception) si la base
 * est indisponible ou si la valeur est absente/illisible : l'appelant
 * décide alors de synchroniser ou de retomber sur le catalogue historique.
 */
export async function readStoredFazercardsCatalog(): Promise<StoredFazercardsCatalog | null> {
  try {
    await ensureSchema();
    const rows = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, FAZERCARDS_CATALOG_SETTING_KEY))
      .limit(1);
    return parseStored(rows[0]?.value);
  } catch (error) {
    console.warn(
      "[fazercards][catalogue] lecture en base impossible :",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/** Enregistre le catalogue (upsert sur la clé). Une synchro vide est ignorée. */
export async function writeStoredFazercardsCatalog(
  result: FazercardsSyncResult,
  fetchedAt = Date.now(),
): Promise<boolean> {
  if (result.products.length === 0) return false;
  try {
    await ensureSchema();
    const payload = {
      products: result.products,
      errors: result.errors.slice(0, 20),
      fetchedAt,
    };
    await db
      .insert(settings)
      .values({ key: FAZERCARDS_CATALOG_SETTING_KEY, value: payload, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: payload, updatedAt: new Date() },
      });
    return true;
  } catch (error) {
    console.warn(
      "[fazercards][catalogue] écriture en base impossible :",
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}
