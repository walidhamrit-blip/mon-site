-- Vérifier une livraison de code précise (boutique digitale Nukhba)
-- À coller dans Neon → SQL Editor, APRÈS avoir vidé l'éditeur (Ctrl+A, Suppr).
--
-- Remplace DGC-XXXXXXXXXXXX par la référence de la commande (24 hexadécimaux).
-- Exemple : DGC-9B5E402D92954C26368D14E2
--
-- Ces requêtes sont en LECTURE SEULE : aucun UPDATE, aucun DELETE.
-- Aucune colonne qualifiée (`alias.colonne`) : certains éditeurs transforment
-- `o.codes_cipher` en lien cliquable (`o.codes` est un vrai domaine).
-- Les alias sont donc en MAJUSCULES ; Postgres les ramène en minuscules.

-- ---------------------------------------------------------------------------
-- 1) La commande elle-même (statut, codes, e-mail)
-- ---------------------------------------------------------------------------
SELECT O.ref,
       O.status,
       O.fulfillment,
       O.kind,
       O.product_title,
       O.denomination_label,
       O.quantity,
       O.total_usd,
       O.created_at,
       O.delivered_at,
       (O.codes_cipher IS NOT NULL) AS codes_stockes,
       O.email_sent_at,
       O.email_provider_id,
       O.email_last_error,
       O.attempts,
       O.last_error
  FROM digital_orders O
 WHERE upper(O.ref) = upper('DGC-XXXXXXXXXXXX');

-- ---------------------------------------------------------------------------
-- 2) Le paiement lié (NOWPayments ou carte téléphonique)
-- ---------------------------------------------------------------------------
SELECT ref, kind, status, payment_method, ipn_status, amount_usd, created_at
  FROM orders
 WHERE upper(ref) = upper('DGC-XXXXXXXXXXXX');

-- ---------------------------------------------------------------------------
-- 3) La carte téléphonique, si le paiement en est un
-- ---------------------------------------------------------------------------
SELECT order_ref, operator, card_value_lyd, status, reviewed_at, review_note
  FROM phone_card_payments
 WHERE upper(order_ref) = upper('DGC-XXXXXXXXXXXX');

-- ---------------------------------------------------------------------------
-- 4) Variante « tout en une ligne » (alias en majuscules, sans risque de lien)
-- ---------------------------------------------------------------------------
SELECT O.ref,
       O.status              AS commande_statut,
       O.delivered_at,
       (O.codes_cipher IS NOT NULL) AS codes_stockes,
       O.email_sent_at,
       P.status              AS paiement_statut,
       P.payment_method,
       PC.status             AS carte_statut,
       PC.reviewed_at        AS carte_verifiee_le
  FROM digital_orders O
  LEFT JOIN orders P ON P.digital_order_id = O.id
  LEFT JOIN phone_card_payments PC ON PC.order_ref = O.ref
 WHERE upper(O.ref) = upper('DGC-XXXXXXXXXXXX');

-- Lecture du résultat :
--   carte_statut = approved + paiement_statut = paid
--   + commande_statut = manual + delivered_at vide + codes_stockes = false
--   ⇒ payé, NON livré : acheter le code puis le saisir dans /admin/digital/orders.
