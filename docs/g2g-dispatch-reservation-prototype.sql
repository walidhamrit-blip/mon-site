-- PROTOTYPE NON DEPLOYE : à installer uniquement dans une base de test dédiée.
-- Ne contient aucun code cadeau. Ne pas appliquer en production sans revue,
-- migration formelle, contrôle d'accès et tests PostgreSQL concurrents.
CREATE TABLE g2g_dispatch_reservation_prototype (
  order_id text NOT NULL CHECK (length(order_id) > 0),
  delivery_id text NOT NULL CHECK (length(delivery_id) > 0),
  supplier_order_id text NOT NULL CHECK (length(supplier_order_id) > 0),
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 100),
  expires_at timestamptz NOT NULL,
  reserved_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (order_id, delivery_id)
);
-- Une ligne est une intention permanente et non un bail récupérable.
-- Ni suppression, ni reset, ni reprise automatique ne sont prévus ici.
-- Accès refusé aux rôles clients Supabase ; aucune policy publique.
ALTER TABLE g2g_dispatch_reservation_prototype ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON g2g_dispatch_reservation_prototype FROM anon, authenticated;
