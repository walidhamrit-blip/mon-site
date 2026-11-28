-- BROUILLON DE MIGRATION — NON APPLIQUE EN PRODUCTION.
--
-- Ne pas executer en production et ne pas referencer dans src/db/index.ts
-- (ensureSchema) tant que :
--   1. la conception n'a pas ete revue et validee ;
--   2. les essais PostgreSQL (concurrence, expiration, rollback, crash,
--      privileges) n'ont pas ete rejoues sur la base dediee g2g-test ;
--   3. l'accord explicite de l'utilisateur n'a pas ete donne.
--
-- Cette migration ne stocke jamais de code cadeau, de cle API ou d'URL.

-- 1. Persistance fiable de l'echeance G2G issue de order.api_delivery (expired_at).
--    Les lignes historiques restent a NULL : toute valeur NULL ou <= clock_timestamp()
--    interdit strictement l'achat et l'envoi automatiques (fail-closed -> revue humaine).
ALTER TABLE g2g_deliveries
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- 2. Intention d'envoi unique, permanente et non recuperable par bail.
--    Contrairement au bail de 5 minutes de la file (delivery_claimed_at),
--    une ligne inseree et commitee dans g2g_dispatch_intents consomme
--    definitivement l'unique droit de tenter POST /v2/orders/{order_id}/delivery.
--    Aucune suppression, aucun reset et aucun retour a un etat pre-envoi.
CREATE TABLE IF NOT EXISTS g2g_dispatch_intents (
  order_id text NOT NULL CHECK (length(btrim(order_id)) BETWEEN 1 AND 128),
  delivery_id text NOT NULL UNIQUE CHECK (length(btrim(delivery_id)) BETWEEN 1 AND 128),
  offer_id text NOT NULL CHECK (
    length(btrim(offer_id)) BETWEEN 1 AND 64
    AND upper(btrim(offer_id)) <> 'G1795076410074VF'
  ),
  supplier_order_id text NOT NULL CHECK (length(btrim(supplier_order_id)) BETWEEN 1 AND 128),
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 100),
  reference_id text NOT NULL UNIQUE CHECK (length(btrim(reference_id)) BETWEEN 16 AND 128),
  expires_at timestamptz NOT NULL,
  state text NOT NULL
    CHECK (state IN ('dispatching', 'acknowledged', 'unknown', 'confirmed', 'aborted', 'manual_review')),
  reserved_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  acknowledged_at timestamptz,
  confirmed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_detail text CHECK (last_detail IS NULL OR length(last_detail) <= 500),
  PRIMARY KEY (order_id, delivery_id)
);

CREATE INDEX IF NOT EXISTS g2g_dispatch_intents_state_idx
  ON g2g_dispatch_intents (state, updated_at DESC);

-- Verrouillage des roles clients Supabase lorsqu'ils existent (compatible
-- Supabase et PostgreSQL standard / Neon / Vercel Postgres).
ALTER TABLE g2g_dispatch_intents ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE g2g_dispatch_intents FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE g2g_dispatch_intents FROM authenticated;
  END IF;
END $$;
