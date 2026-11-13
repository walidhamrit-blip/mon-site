// Budget d'appels sortants vers le fournisseur de paiement — côté serveur.
//
// Deux niveaux, complémentaires :
//   1. `claimProviderSync(ref)` : throttle DURABLE par commande. Pose
//      `digital_orders.last_provider_sync_at` par un UPDATE conditionnel :
//      seul l'appel qui « gagne » interroge NOWPayments. Un compteur en
//      mémoire ne peut pas faire ce travail sur Vercel (une instance est
//      éphémère, donc un compteur repart de zéro à chaque requête froide).
//   2. `claimProviderBudget()` : plafond GLOBAL par instance. Toutes les
//      commandes réunies, on ne dépasse pas N appels par fenêtre. La limite
//      est par instance (comme `rate-limit.ts`) : elle protège du pic et de
//      l'abus, pas d'un trafic mondial coordonné — c'est documenté et
//      assumé, un backend partagé serait nécessaire pour aller plus loin.
//
// Les deux fonctions ne lèvent jamais : en cas d'erreur base, on REFUSE
// l'appel sortant (dégradation silencieuse côté client, la page continue
// d'afficher l'état en base) plutôt que de laisser filer la facture.

import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { orders } from "@/db/schema";
import {
  PROVIDER_BUDGET_DEFAULTS,
  RECONCILE_BACKOFF_MS,
  decideProviderBudget,
  decideReconcileThrottle,
} from "@/lib/provider-budget-core";

/* ------------------------- 1. Throttle par commande ----------------------- */

export interface ProviderSyncClaim {
  /** `true` = cet appel a le droit d'interroger le fournisseur. */
  sync: boolean;
  /** Secondes avant la prochaine interrogation possible (si refusé). */
  retryAfterSec: number;
}

const inFlight = new Map<string, number>();
const IN_FLIGHT_TTL_MS = 30_000;

/**
 * Réserve le droit d'interroger le fournisseur pour cette commande.
 *
 * No-op total si `lastSyncAt` est renseigné et trop récent : aucun appel
 * sortant, aucune écriture. Sinon l'UPDATE conditionnel garantit qu'une
 * seule requête concurrente obtient le créneau.
 */
export async function claimProviderSync(
  ref: string,
  options: { lastSyncAt?: Date | null; since?: Date | null; now?: Date } = {},
): Promise<ProviderSyncClaim> {
  const clean = (ref ?? "").trim().toUpperCase();
  if (!clean) return { sync: false, retryAfterSec: 30 };

  const now = options.now ?? new Date();
  const decision = decideReconcileThrottle({
    lastSyncAt: options.lastSyncAt ?? null,
    since: options.since ?? null,
    now,
  });
  if (!decision.sync) {
    return { sync: false, retryAfterSec: Math.max(1, Math.ceil(decision.waitMs / 1000)) };
  }

  // Garde anti-concurrence intra-instance : deux requêtes simultanées sur la
  // même commande (double onglet) ne doivent pas réserver deux fois, car les
  // deux auraient lu le même `lastSyncAt` avant que l'une ait écrit.
  const inFlightUntil = inFlight.get(clean);
  if (inFlightUntil && inFlightUntil > now.getTime()) {
    return { sync: false, retryAfterSec: 5 };
  }

  try {
    await ensureSchema();
    // Réservation ATOMIQUE : l'UPDATE ne prend que les lignes dont l'horloge
    // est encore celle qu'on a lue (ou absente). La deuxième requête
    // concurrente ne réclame donc aucune ligne.
    const cutoff = new Date(now.getTime() - RECONCILE_BACKOFF_MS[decision.step]);
    const claimed = await db
      .update(orders)
      .set({ lastProviderSyncAt: now })
      .where(
        and(
          eq(orders.ref, clean),
          or(
            isNull(orders.lastProviderSyncAt),
            lt(orders.lastProviderSyncAt, cutoff),
          ),
        ),
      )
      .returning({ id: orders.id });

    if (claimed.length === 0) {
      // Créneau pris entre-temps (autre instance ou autre onglet).
      return { sync: false, retryAfterSec: Math.max(1, Math.ceil(decision.waitMs / 1000)) };
    }

    inFlight.set(clean, now.getTime() + IN_FLIGHT_TTL_MS);
    return { sync: true, retryAfterSec: 0 };
  } catch (error) {
    console.warn(
      "[provider][throttle] réserve impossible :",
      error instanceof Error ? error.message : error,
    );
    // Refuser est le choix sûr : mieux vaut un état en base qu'un appel
    // sortant non plafonné et une facture imprévue.
    return { sync: false, retryAfterSec: 60 };
  }
}

/** Relâche la réservation (appel fournisseur terminé). */
export function releaseProviderSync(ref: string): void {
  inFlight.delete((ref ?? "").trim().toUpperCase());
}

/* ---------------------------- 2. Budget global ---------------------------- */

interface BudgetWindow {
  startedAt: number;
  used: number;
}

let budgetWindow: BudgetWindow | null = null;

/**
 * Réserve un appel sortant dans le budget de l'instance.
 * `true` = autorisé (le compteur est incrémenté), `false` = plafond atteint.
 */
/**
 * Plafond effectif : le défaut, ajustable par variable d'environnement pour
 * un pic prévu (campagne, lancement) sans redéployer de code.
 * `PROVIDER_BUDGET_PER_5MIN=0` désactive le plafond (déconseillé).
 */
function configuredBudget(): { limit: number; windowMs: number } {
  const windowMs = PROVIDER_BUDGET_DEFAULTS.windowMs;
  const raw = process.env.PROVIDER_BUDGET_PER_5MIN?.trim();
  if (!raw) return { limit: PROVIDER_BUDGET_DEFAULTS.limit, windowMs };
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { limit: PROVIDER_BUDGET_DEFAULTS.limit, windowMs };
  }
  // 0 = plafond désactivé, choix explicite de l'exploitant.
  return { limit: parsed === 0 ? Number.MAX_SAFE_INTEGER : parsed, windowMs };
}

export function claimProviderBudget(
  options: { limit?: number; windowMs?: number } = {},
): { allow: boolean; retryAfterSec: number; remaining: number } {
  const configured = configuredBudget();
  const limit = Math.max(1, options.limit ?? configured.limit);
  const windowMs = Math.max(1_000, options.windowMs ?? configured.windowMs);
  const now = Date.now();

  const decision = decideProviderBudget({
    used: budgetWindow?.used ?? 0,
    limit,
    windowMs,
    windowStartedAt: budgetWindow?.startedAt ?? null,
    now,
  });

  if (!decision.allow) {
    return { allow: false, retryAfterSec: decision.retryAfterSec, remaining: 0 };
  }

  budgetWindow = decision.reset
    ? { startedAt: now, used: 1 }
    : { startedAt: budgetWindow?.startedAt ?? now, used: (budgetWindow?.used ?? 0) + 1 };

  return { allow: true, retryAfterSec: 0, remaining: decision.remaining };
}

/** Remise à zéro du budget (tests, admin). */
export function resetProviderBudget(): void {
  budgetWindow = null;
}

/** Diagnostic du budget courant (route santé admin). */
export function providerBudgetStatus(options: { limit?: number; windowMs?: number } = {}) {
  const configured = configuredBudget();
  const limit = Math.max(1, options.limit ?? configured.limit);
  const windowMs = Math.max(1_000, options.windowMs ?? configured.windowMs);
  if (!budgetWindow) return { used: 0, limit, windowMs, resetsInSec: 0 };
  return {
    used: budgetWindow.used,
    limit,
    windowMs,
    resetsInSec: Math.max(
      0,
      Math.ceil((budgetWindow.startedAt + windowMs - Date.now()) / 1000),
    ),
  };
}

/**
 * Écritures admin qui doivent voir l'effet immédiatement : elles remettent
 * l'horloge de throttle à zéro pour que l'interrogation suivante ne soit pas
 * retardée par un créneau déjà consommé.
 */
export async function clearProviderSyncGate(ref: string): Promise<void> {
  const clean = (ref ?? "").trim().toUpperCase();
  if (!clean) return;
  try {
    await db
      .update(orders)
      .set({ lastProviderSyncAt: null })
      .where(eq(orders.ref, clean));
  } catch {
    /* best effort : ne jamais faire échouer une action admin pour un cache */
  }
}

/** `true` si la colonne de throttle existe (usage diagnostic / santé admin). */
export async function providerThrottleReady(): Promise<boolean> {
  try {
    await ensureSchema();
    const result = await db.execute<{ present: boolean }>(
      sql`select exists (
        select 1 from information_schema.columns
        where table_name = 'orders' and column_name = 'last_provider_sync_at'
      ) as present`,
    );
    return Boolean(result.rows[0]?.present);
  } catch {
    return false;
  }
}
