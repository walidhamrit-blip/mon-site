import { eq } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { settings } from "@/db/schema";

/**
 * Journal des alignements de prix — trace des changements EFFECTIVEMENT servis.
 *
 * Pourquoi un journal alors que les prix sont calculés à la volée ? Parce
 * qu'un prix qui bouge sans trace est ingérable : on doit pouvoir répondre à
 * « pourquoi la carte PSN 50 coûtait 50,50 $ hier et 45,24 $ aujourd'hui ? ».
 *
 * Le journal n'est alimenté que par les écrans d'administration (jamais par le
 * rendu public) : une visite de `/admin/digital/alignment` compare les prix
 * servis à ceux du dernier relevé et n'ajoute une ligne que s'ils diffèrent.
 * Le fichier reste donc silencieux, sans écriture en base côté visiteur.
 */

export const ALIGNMENT_LOG_KEY = "digital:price-alignment-log";

/** Nombre maximal d'entrées conservées (les plus récentes d'abord). */
export const ALIGNMENT_LOG_LIMIT = 200;

export interface AlignmentLogEntry {
  /** Date ISO de constatation du changement. */
  at: string;
  /** Produit concerné (libellé lisible). */
  product: string;
  /** Montant concerné (« 50 $ · US »). */
  denomination: string;
  /** Prix servi au relevé précédent. */
  from: number;
  /** Prix servi à ce relevé. */
  to: number;
  /** Référence de marché au moment du changement. */
  benchmarkUsd: number | null;
  /** Canal de la référence (« Eneba », « Valeur faciale »…). */
  channel: string | null;
}

export interface AlignmentLogState {
  entries: AlignmentLogEntry[];
  updatedAt?: string;
}

const EMPTY_LOG: AlignmentLogState = { entries: [] };

export function normalizeAlignmentLog(raw: unknown): AlignmentLogState {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return EMPTY_LOG;
  const obj = raw as Record<string, unknown>;
  const entries = Array.isArray(obj.entries)
    ? (obj.entries
        .filter((entry): entry is AlignmentLogEntry => {
          if (!entry || typeof entry !== "object") return false;
          const candidate = entry as Record<string, unknown>;
          return (
            typeof candidate.at === "string" &&
            typeof candidate.product === "string" &&
            typeof candidate.denomination === "string" &&
            typeof candidate.from === "number" &&
            typeof candidate.to === "number"
          );
        })
        .slice(0, ALIGNMENT_LOG_LIMIT))
    : [];
  return {
    entries,
    ...(typeof obj.updatedAt === "string" ? { updatedAt: obj.updatedAt } : {}),
  };
}

function dbReady(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

/** Lit le journal. Ne lève jamais : un journal absent n'est pas une panne. */
export async function readAlignmentLog(): Promise<AlignmentLogState> {
  if (!dbReady()) return EMPTY_LOG;
  try {
    await ensureSchema();
    const rows = await db
      .select()
      .from(settings)
      .where(eq(settings.key, ALIGNMENT_LOG_KEY))
      .limit(1);
    return normalizeAlignmentLog(rows[0]?.value);
  } catch (error) {
    console.warn(
      "[alignment-log] lecture impossible :",
      error instanceof Error ? error.message : error,
    );
    return EMPTY_LOG;
  }
}

export interface AlignmentSnapshotRow {
  product: string;
  denomination: string;
  servedUsd: number;
  benchmarkUsd: number | null;
  channel: string | null;
}

/**
 * Compare les prix servis à ceux du relevé précédent et journalise les écarts.
 *
 * @returns le journal à jour (ou l'ancien si la base est indisponible).
 */
export async function recordAlignmentSnapshot(
  rows: readonly AlignmentSnapshotRow[],
): Promise<AlignmentLogState> {
  if (!dbReady() || rows.length === 0) return EMPTY_LOG;
  const current = await readAlignmentLog();
  const previous = new Map<string, number>();
  // Le dernier prix connu de chaque montant est la première occurrence du
  // journal (entrées les plus récentes d'abord).
  for (const entry of current.entries) {
    const key = `${entry.product}::${entry.denomination}`;
    if (!previous.has(key)) previous.set(key, entry.to);
  }

  const at = new Date().toISOString();
  const fresh: AlignmentLogEntry[] = [];
  for (const row of rows) {
    const key = `${row.product}::${row.denomination}`;
    const before = previous.get(key);
    if (before == null) continue; // première observation : rien à comparer
    if (Math.abs(before - row.servedUsd) <= 0.004) continue;
    fresh.push({
      at,
      product: row.product,
      denomination: row.denomination,
      from: Math.round(before * 100) / 100,
      to: Math.round(row.servedUsd * 100) / 100,
      benchmarkUsd: row.benchmarkUsd,
      channel: row.channel,
    });
  }

  // Premier relevé : on enregistre l'état de référence sans le présenter
  // comme un changement (aucune entrée, mais les prix sont mémorisés dans
  // une entrée technique à `from === to`).
  const baseline = current.entries.length === 0
    ? rows.map<AlignmentLogEntry>((row) => ({
        at,
        product: row.product,
        denomination: row.denomination,
        from: Math.round(row.servedUsd * 100) / 100,
        to: Math.round(row.servedUsd * 100) / 100,
        benchmarkUsd: row.benchmarkUsd,
        channel: row.channel,
      }))
    : [];

  if (fresh.length === 0 && baseline.length === 0) return current;

  const entries = [...fresh, ...baseline, ...current.entries].slice(0, ALIGNMENT_LOG_LIMIT);
  const next: AlignmentLogState = { entries, updatedAt: at };
  try {
    await ensureSchema();
    await db
      .insert(settings)
      .values({ key: ALIGNMENT_LOG_KEY, value: next, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: next, updatedAt: new Date() },
      });
  } catch (error) {
    console.warn(
      "[alignment-log] écriture impossible :",
      error instanceof Error ? error.message : error,
    );
    return current;
  }
  return next;
}
