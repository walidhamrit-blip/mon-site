import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl || "postgresql://localhost:5432/postgres",
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

// Crée automatiquement les tables du panneau d'administration au premier
// accès (sur Vercel comme en local) — aucun `drizzle-kit push` nécessaire.
// Si vous modifiez src/db/schema.ts, tenez ce DDL à jour en conséquence.
let schemaReady: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!databaseUrl) {
    return Promise.reject(new Error("DATABASE_URL is required"));
  }
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS leads (
          id serial PRIMARY KEY,
          created_at timestamptz NOT NULL DEFAULT now(),
          name text NOT NULL,
          business text NOT NULL,
          phone text NOT NULL,
          email text,
          sector text NOT NULL,
          need text NOT NULL,
          budget text NOT NULL,
          deadline text NOT NULL,
          message text,
          utm text,
          locale text,
          status text NOT NULL DEFAULT 'new',
          notes text
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS settings (
          key text PRIMARY KEY,
          value jsonb NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      await pool.query(
        "CREATE INDEX IF NOT EXISTS leads_created_at_idx ON leads (created_at DESC)",
      );
      await pool.query(
        "CREATE INDEX IF NOT EXISTS leads_status_idx ON leads (status)",
      );
    })().catch((error) => {
      schemaReady = null; // permet de réessayer au prochain accès
      throw error;
    });
  }
  return schemaReady;
}

export const db = drizzle(pool);
