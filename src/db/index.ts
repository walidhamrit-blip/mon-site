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
      await pool.query(`
        CREATE TABLE IF NOT EXISTS orders (
          id serial PRIMARY KEY,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          ref text NOT NULL UNIQUE,
          tracking_token_hash text,
          kind text NOT NULL DEFAULT 'plan',
          demo_slug text,
          plan_id text NOT NULL,
          plan_name text NOT NULL,
          amount_lyd text NOT NULL,
          amount_usd text NOT NULL,
          currency text NOT NULL DEFAULT 'usd',
          installments integer NOT NULL DEFAULT 1,
          installment_index integer NOT NULL DEFAULT 1,
          group_ref text,
          client_name text,
          email text,
          phone text,
          payment_id text UNIQUE,
          pay_address text,
          pay_currency text,
          pay_amount text,
          payment_url text,
          status text NOT NULL DEFAULT 'pending',
          ipn_status text,
          utm text,
          locale text
        )
      `);
      await pool.query(
        "CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders (created_at DESC)",
      );
      await pool.query(
        "CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status)",
      );
      // Colonnes ajoutées pour le paiement en tranches — ALTER ... IF NOT
      // EXISTS met à niveau les bases créées par une version antérieure.
      await pool.query(
        "ALTER TABLE orders ADD COLUMN IF NOT EXISTS installments integer NOT NULL DEFAULT 1",
      );
      await pool.query(
        "ALTER TABLE orders ADD COLUMN IF NOT EXISTS installment_index integer NOT NULL DEFAULT 1",
      );
      await pool.query(
        "ALTER TABLE orders ADD COLUMN IF NOT EXISTS group_ref text",
      );
      await pool.query(
        "CREATE INDEX IF NOT EXISTS orders_group_ref_idx ON orders (group_ref)",
      );
      // Réservations prioritaires (acompte) : nature de la commande et
      // site du portfolio concerné.
      await pool.query(
        "ALTER TABLE orders ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'plan'",
      );
      await pool.query(
        "ALTER TABLE orders ADD COLUMN IF NOT EXISTS demo_slug text",
      );
      await pool.query(
        "CREATE INDEX IF NOT EXISTS orders_kind_idx ON orders (kind)",
      );
      // Jeton de suivi public : seule l'empreinte SHA-256 est stockée.
      await pool.query(
        "ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_token_hash text",
      );
      // Abonnements (mensuel / annuel) : plans synchronisés avec NOWPayments
      // et abonnés. Un paiement d'abonnement reste une ligne `orders`,
      // rattachée à son abonné par `subscription_id`.
      await pool.query(`
        CREATE TABLE IF NOT EXISTS subscription_plans (
          id text PRIMARY KEY,
          nowpayments_plan_id text UNIQUE,
          tier text NOT NULL,
          cycle text NOT NULL,
          title text NOT NULL,
          price_usd text NOT NULL,
          interval_day integer NOT NULL,
          grace_days integer NOT NULL,
          synced_at timestamptz,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS subscriptions (
          id serial PRIMARY KEY,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          ref text NOT NULL UNIQUE,
          tracking_token_hash text,
          plan_id text NOT NULL REFERENCES subscription_plans(id),
          email text NOT NULL,
          client_name text,
          phone text,
          nowpayments_subscription_id text UNIQUE,
          status text NOT NULL DEFAULT 'inactive',
          current_period_start timestamptz,
          current_period_end timestamptz,
          last_payment_id text,
          canceled_at timestamptz,
          reminder_for timestamptz,
          overdue_notice_for timestamptz,
          expired_notice_for timestamptz
        )
      `);
      await pool.query(
        "CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON subscriptions (status)",
      );
      await pool.query(
        "ALTER TABLE orders ADD COLUMN IF NOT EXISTS subscription_id integer REFERENCES subscriptions(id)",
      );
      await pool.query(
        "CREATE INDEX IF NOT EXISTS orders_subscription_id_idx ON orders (subscription_id)",
      );
    })().catch((error) => {
      schemaReady = null; // permet de réessayer au prochain accès
      throw error;
    });
  }
  return schemaReady;
}

export const db = drizzle(pool);
