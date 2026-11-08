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
      await pool.query(`
        CREATE TABLE IF NOT EXISTS media_assets (
          id text PRIMARY KEY,
          mime_type text NOT NULL,
          data text NOT NULL,
          size_bytes integer NOT NULL,
          original_name text,
          created_at timestamptz NOT NULL DEFAULT now()
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
      // Colonnes ajoutées après la création initiale de la table : une base
      // déjà créée (par exemple le Preview) doit les recevoir aussi.
      await pool.query(`
        ALTER TABLE subscriptions
          ADD COLUMN IF NOT EXISTS canceled_at timestamptz,
          ADD COLUMN IF NOT EXISTS reminder_for timestamptz,
          ADD COLUMN IF NOT EXISTS overdue_notice_for timestamptz,
          ADD COLUMN IF NOT EXISTS expired_notice_for timestamptz
      `);
      await pool.query(
        "ALTER TABLE orders ADD COLUMN IF NOT EXISTS subscription_id integer REFERENCES subscriptions(id)",
      );
      await pool.query(
        "CREATE INDEX IF NOT EXISTS orders_subscription_id_idx ON orders (subscription_id)",
      );
      // Les IPN d'abonnement NOWPayments n'exposent pas d'identifiant
      // d'abonnement, seulement l'iid de la facture : on le mémorise dès la
      // création pour rattacher les paiements sans appel d'API supplémentaire.
      await pool.query(
        "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS first_invoice_id text",
      );
      await pool.query(
        "CREATE INDEX IF NOT EXISTS subscriptions_first_invoice_id_idx ON subscriptions (first_invoice_id)",
      );

      // Catalogue digital : fiches produits (codes logiciels, cartes cadeaux
      // gaming, recharges) + une ligne par dénomination (montant/région).
      await pool.query(`
        CREATE TABLE IF NOT EXISTS digital_products (
          id text PRIMARY KEY,
          slug text NOT NULL UNIQUE,
          kind text NOT NULL,
          status text NOT NULL DEFAULT 'coming_soon',
          platform text NOT NULL DEFAULT '',
          color text NOT NULL DEFAULT '#C6A664',
          title_ar text NOT NULL,
          title_en text NOT NULL,
          description_ar text NOT NULL DEFAULT '',
          description_en text NOT NULL DEFAULT '',
          image text NOT NULL DEFAULT '',
          regions jsonb NOT NULL DEFAULT '[]'::jsonb,
          features_ar jsonb NOT NULL DEFAULT '[]'::jsonb,
          features_en jsonb NOT NULL DEFAULT '[]'::jsonb,
          delivery_note_ar text NOT NULL DEFAULT '',
          delivery_note_en text NOT NULL DEFAULT '',
          sort_order integer NOT NULL DEFAULT 0,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS digital_denominations (
          id serial PRIMARY KEY,
          product_id text NOT NULL REFERENCES digital_products(id) ON DELETE CASCADE,
          label text NOT NULL,
          face_value text NOT NULL DEFAULT '',
          region text NOT NULL DEFAULT 'global',
          price_usd text NOT NULL,
          note_ar text,
          note_en text,
          available integer NOT NULL DEFAULT 1,
          sort_order integer NOT NULL DEFAULT 0
        )
      `);
      await pool.query(
        "CREATE INDEX IF NOT EXISTS digital_products_status_idx ON digital_products (status, sort_order)",
      );
      await pool.query(
        "CREATE INDEX IF NOT EXISTS digital_denominations_product_idx ON digital_denominations (product_id)",
      );

      // Livraison à la commande : colonnes de mappage vers le fournisseur
      // Reloadly (produit, pays) et mode de livraison de la fiche.
      await pool.query(
        "ALTER TABLE digital_products ADD COLUMN IF NOT EXISTS fulfillment text NOT NULL DEFAULT 'manual'",
      );
      await pool.query(
        "ALTER TABLE digital_products ADD COLUMN IF NOT EXISTS reloadly_product_id integer",
      );
      await pool.query(
        "ALTER TABLE digital_products ADD COLUMN IF NOT EXISTS reloadly_country_code text NOT NULL DEFAULT ''",
      );
      await pool.query(
        "ALTER TABLE digital_denominations ADD COLUMN IF NOT EXISTS reloadly_unit_price text",
      );

      // Commandes digitales : le client paie d'abord, le serveur achète le
      // code chez Reloadly ensuite. Les codes livrés sont chiffrés.
      await pool.query(`
        CREATE TABLE IF NOT EXISTS digital_orders (
          id serial PRIMARY KEY,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          ref text NOT NULL UNIQUE,
          tracking_token_hash text,
          product_id text NOT NULL,
          product_slug text NOT NULL DEFAULT '',
          product_title text NOT NULL,
          kind text NOT NULL DEFAULT 'gift_card',
          platform text NOT NULL DEFAULT '',
          denomination_id text NOT NULL DEFAULT '',
          denomination_label text NOT NULL DEFAULT '',
          region text NOT NULL DEFAULT 'global',
          face_value text NOT NULL DEFAULT '',
          quantity integer NOT NULL DEFAULT 1,
          unit_price_usd text NOT NULL,
          total_usd text NOT NULL,
          recipient_email text NOT NULL DEFAULT '',
          recipient_name text,
          recipient_phone text,
          locale text NOT NULL DEFAULT 'ar',
          status text NOT NULL DEFAULT 'pending',
          fulfillment text NOT NULL DEFAULT 'manual',
          reloadly_product_id integer,
          reloadly_unit_price text,
          reloadly_country_code text NOT NULL DEFAULT '',
          reloadly_transaction_id text UNIQUE,
          reloadly_status text,
          reloadly_response jsonb,
          codes_cipher text,
          delivered_at timestamptz,
          email_sent_at timestamptz,
          attempts integer NOT NULL DEFAULT 0,
          last_error text
        )
      `);
      await pool.query(
        "CREATE INDEX IF NOT EXISTS digital_orders_status_idx ON digital_orders (status, created_at DESC)",
      );
      await pool.query(
        "CREATE INDEX IF NOT EXISTS digital_orders_recipient_idx ON digital_orders (recipient_email)",
      );
      await pool.query(
        "ALTER TABLE orders ADD COLUMN IF NOT EXISTS digital_order_id integer",
      );
      // Diagnostic d'envoi des codes : identifiant du message chez le
      // fournisseur (à retrouver dans Resend/SMTP) et motif d'échec.
      await pool.query(
        "ALTER TABLE digital_orders ADD COLUMN IF NOT EXISTS email_provider_id text",
      );
      // Marge nette visée par fiche : permet de recalculer les prix de vente
      // depuis le coût réel (valeurs faciales + frais Reloadly).
      await pool.query(
        "ALTER TABLE digital_products ADD COLUMN IF NOT EXISTS margin_percent text",
      );
      // Frais et remise du fournisseur, mémorisés sur la fiche : sans eux, une
      // remise Reloadly rendait une vente rentable impossible à distinguer
      // d'une perte (faux positif constaté sur Spotify 60 USD à 59,50 $).
      await pool.query(
        "ALTER TABLE digital_products ADD COLUMN IF NOT EXISTS supplier_fee_percent text",
      );
      await pool.query(
        "ALTER TABLE digital_products ADD COLUMN IF NOT EXISTS supplier_discount_percent text",
      );
      // Faces non-USD (500 TRY, 250 EGP…) : sans devise ni coût réel, un prix
      // serait calculé sur un nombre qui n'est pas de l'argent américain.
      await pool.query(
        "ALTER TABLE digital_denominations ADD COLUMN IF NOT EXISTS face_currency text",
      );
      await pool.query(
        "ALTER TABLE digital_denominations ADD COLUMN IF NOT EXISTS supplier_cost_usd text",
      );
      await pool.query(
        "ALTER TABLE digital_orders ADD COLUMN IF NOT EXISTS email_last_error text",
      );
      // Soldes dus aux clients (trop-perçu d'une carte de recharge).
      // Le solde est dérivé des mouvements ; l'index unique (order_ref, kind)
      // rend le crédit d'un trop-perçu idempotent : réaccepter une carte ne
      // crédite jamais deux fois le même client.
      await pool.query(`
        CREATE TABLE IF NOT EXISTS client_credits (
          id serial PRIMARY KEY,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          client_key text NOT NULL UNIQUE,
          client_name text,
          client_email text,
          client_phone text,
          balance_lyd text NOT NULL DEFAULT '0.00',
          note text
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS client_credit_movements (
          id serial PRIMARY KEY,
          created_at timestamptz NOT NULL DEFAULT now(),
          credit_id integer NOT NULL REFERENCES client_credits (id) ON DELETE CASCADE,
          kind text NOT NULL,
          amount_lyd text NOT NULL,
          order_ref text,
          balance_after_lyd text NOT NULL DEFAULT '0.00',
          note text
        )
      `);
      await pool.query(
        "CREATE INDEX IF NOT EXISTS client_credit_movements_credit_idx ON client_credit_movements (credit_id, created_at DESC)",
      );
      // Index UNIQUE simple : en Postgres, plusieurs NULL sont autorisés, donc
      // les ajustements manuels (sans commande) restent possibles alors qu'un
      // même trop-perçu ne peut être crédité qu'une fois par commande.
      await pool.query(
        "CREATE UNIQUE INDEX IF NOT EXISTS client_credit_movements_order_kind_idx ON client_credit_movements (order_ref, kind)",
      );

      // Demandes d'utilisation d'un solde par le client : l'argent ne bouge
      // qu'après validation admin. Unique (order_ref, status) : pas deux
      // demandes en attente sur la même commande, pas de double validation.
      await pool.query(`
        CREATE TABLE IF NOT EXISTS client_credit_requests (
          id serial PRIMARY KEY,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          credit_id integer NOT NULL REFERENCES client_credits (id) ON DELETE CASCADE,
          order_ref text NOT NULL,
          amount_lyd text NOT NULL,
          status text NOT NULL DEFAULT 'pending',
          client_note text,
          admin_note text,
          reviewed_at timestamptz
        )
      `);
      await pool.query(
        "CREATE INDEX IF NOT EXISTS client_credit_requests_status_idx ON client_credit_requests (status, created_at DESC)",
      );
      await pool.query(
        "CREATE UNIQUE INDEX IF NOT EXISTS client_credit_requests_order_status_idx ON client_credit_requests (order_ref, status)",
      );

      // Livraison hors système (WhatsApp, téléphone…) : le code n'est pas
      // stocké, il faut donc savoir par quel canal il a été remis.
      await pool.query(
        "ALTER TABLE digital_orders ADD COLUMN IF NOT EXISTS delivery_channel text",
      );
      await pool.query(
        "ALTER TABLE digital_orders ADD COLUMN IF NOT EXISTS delivery_note text",
      );
      await pool.query(
        "CREATE INDEX IF NOT EXISTS orders_digital_order_id_idx ON orders (digital_order_id)",
      );
      await pool.query(
        "ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'nowpayments'",
      );

      // Cartes de recharge téléphonique : code chiffré + empreinte HMAC
      // unique contre la réutilisation. La validation reste humaine.
      await pool.query(`
        CREATE TABLE IF NOT EXISTS phone_card_payments (
          id serial PRIMARY KEY,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          order_ref text NOT NULL UNIQUE REFERENCES orders(ref) ON DELETE CASCADE,
          operator text NOT NULL,
          card_value_lyd text NOT NULL,
          quote_amount_usdt text,
          quote_rate_lyd text,
          quote_total_lyd text,
          quote_markup_percent integer,
          quote_source text,
          quote_rate_updated_at timestamptz,
          quote_fetched_at timestamptz,
          quote_references jsonb,
          code_cipher text NOT NULL,
          code_fingerprint text NOT NULL UNIQUE,
          code_hint text NOT NULL,
          status text NOT NULL DEFAULT 'pending',
          reviewed_at timestamptz,
          review_note text
        )
      `);
      await pool.query(`
        ALTER TABLE phone_card_payments
          ADD COLUMN IF NOT EXISTS quote_amount_usdt text,
          ADD COLUMN IF NOT EXISTS quote_rate_lyd text,
          ADD COLUMN IF NOT EXISTS quote_total_lyd text,
          ADD COLUMN IF NOT EXISTS quote_markup_percent integer,
          ADD COLUMN IF NOT EXISTS quote_source text,
          ADD COLUMN IF NOT EXISTS quote_rate_updated_at timestamptz,
          ADD COLUMN IF NOT EXISTS quote_fetched_at timestamptz,
          ADD COLUMN IF NOT EXISTS quote_references jsonb
      `);
      await pool.query(
        "CREATE INDEX IF NOT EXISTS phone_card_payments_status_idx ON phone_card_payments (status, created_at DESC)",
      );

      // Livraison des projets web : récapitulatif remis au client + validation
      // de recette horodatée (page publique /livraison/<ref>?t=<jeton>).
      await pool.query(`
        CREATE TABLE IF NOT EXISTS site_deliveries (
          id serial PRIMARY KEY,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          ref text NOT NULL UNIQUE,
          tracking_token_hash text NOT NULL,
          client_name text NOT NULL,
          email text,
          phone text,
          project_title text NOT NULL,
          amount_usd text NOT NULL DEFAULT '',
          links jsonb NOT NULL DEFAULT '[]'::jsonb,
          checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
          warranty_days integer NOT NULL DEFAULT 30,
          status text NOT NULL DEFAULT 'delivered',
          accepted_at timestamptz,
          accepted_by_name text,
          locale text,
          notes text
        )
      `);
      await pool.query(
        "CREATE INDEX IF NOT EXISTS site_deliveries_status_idx ON site_deliveries (status, created_at DESC)",
      );
      // Jeton chiffré : permet à l'admin de renvoyer le lien de validation
      // sans jamais le stocker en clair.
      await pool.query(
        "ALTER TABLE site_deliveries ADD COLUMN IF NOT EXISTS tracking_token_cipher text",
      );

      // Bot Telegram : abonnés (marketing) + journal des campagnes.
      await pool.query(`
        CREATE TABLE IF NOT EXISTS telegram_subscribers (
          id serial PRIMARY KEY,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          last_seen_at timestamptz NOT NULL DEFAULT now(),
          chat_id text NOT NULL UNIQUE,
          username text,
          first_name text,
          language text NOT NULL DEFAULT 'ar',
          source text,
          status text NOT NULL DEFAULT 'active',
          marketing_opt_in boolean NOT NULL DEFAULT false,
          opted_in_at timestamptz,
          last_message text
        )
      `);
      await pool.query(
        "CREATE INDEX IF NOT EXISTS telegram_subscribers_optin_idx \n          ON telegram_subscribers (marketing_opt_in, status)",
      );
      await pool.query(`
        CREATE TABLE IF NOT EXISTS telegram_campaigns (
          id serial PRIMARY KEY,
          created_at timestamptz NOT NULL DEFAULT now(),
          title text NOT NULL,
          body text NOT NULL,
          audience integer NOT NULL DEFAULT 0,
          sent integer NOT NULL DEFAULT 0,
          failed integer NOT NULL DEFAULT 0,
          blocked integer NOT NULL DEFAULT 0,
          status text NOT NULL DEFAULT 'sent'
        )
      `);
    })().catch((error) => {
      schemaReady = null; // permet de réessayer au prochain accès
      throw error;
    });
  }
  return schemaReady;
}

export const db = drizzle(pool);
