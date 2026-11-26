# Conception de la persistance durable d'envoi G2G (étape 1 — non appliquée)

> **Statut** : conception et module isolé uniquement. Aucune migration SQL n'a
> été exécutée en production, `ensureSchema()` n'a pas été modifié, aucun
> raccordement au cron de livraison n'est activé et `automaticDeliveryVerified()`
> retourne toujours `false`.

## 1. Lacunes constatées avant raccordement

1. **Échéance G2G non persistée** : `parseG2gDeliveryEvent()` extrait `expired_at`
   depuis `order.api_delivery`, mais `src/app/api/webhooks/g2g/route.ts` et la
   table `g2g_deliveries` ne possèdent pas encore de colonne `expires_at`. Or le
   worker asynchrone (`/api/cron/g2g-delivery`) ne peut pas vérifier l'expiration
   avant envoi sans cette valeur durable.
2. **Bail de file insuffisant contre un double POST** : `delivery_claimed_at`
   sur `g2g_deliveries` expire au bout de 5 minutes (`G2G_DELIVERY_LEASE_MS`).
   Si un premier worker subit une latence réseau, un timeout ou un crash pendant
   `POST /v2/orders/{order_id}/delivery`, un second worker peut reprendre la
   ligne après 5 minutes : sans verrou permanent commité avant l'appel réseau,
   il risquerait d'émettre un second `POST`.
3. **Absence de `reference_id` durable et d'états d'envoi incertain** : le contrat
   G2G *Deliver Code* attend un `reference_id` stable par unité livrée, et un
   accusé HTTP du `POST` ne vaut pas preuve de livraison finale (seul
   `GET /v2/orders/{order_id}/delivery/{delivery_id}` avec vérification des
   identifiants, du statut `delivered` et de `delivered_qty` confirme la remise).

## 2. Modèle de persistance conçu

Fichiers préparés (désactivés en production) :

- `docs/sql/g2g-dispatch-intent-migration-draft.sql` — brouillon SQL non exécuté ;
- `src/lib/g2g-dispatch-intent.ts` — fonctions pures et primitives SQL à client
  injecté, sans aucun appelant dans les routes ou crons de production ;
- `scripts/g2g-dispatch-intent.test.mjs` — tests unitaires et structurels.

### 2.1 Colonne `g2g_deliveries.expires_at`

- Type `timestamptz` nullable.
- Les lignes historiques ou synthétiques (`expired_at = 0`) restent à `NULL` via
  `parseG2gExpiresAt()`.
- **Règle fail-closed** : toute livraison dont `expires_at` est `NULL` ou
  `<= clock_timestamp()` est refusée à l'envoi automatique et orientée en
  revue manuelle.

### 2.2 Table `g2g_dispatch_intents`

- Clé primaire `(order_id, delivery_id)` + contrainte `UNIQUE (delivery_id)` +
  contrainte `UNIQUE (reference_id)`.
- Aucune colonne de code cadeau, aucun secret, aucune suppression ni remise à zéro.
- `reference_id` calculé de façon déterministe et résistante aux collisions par
  `buildStableDispatchReferenceId(orderId, deliveryId)` (`g2g-ref-<id>-<sha256_16>`),
  puis persisté dans l'`INSERT` avant `COMMIT`.
- Sécurité Supabase : `ENABLE ROW LEVEL SECURITY` et
  `REVOKE ALL ON TABLE g2g_dispatch_intents FROM anon, authenticated`.

### 2.3 Machine d'états monotone (sans réémission automatique)

L'absence de ligne signifie qu'aucune tentative d'envoi n'a jamais été réservée.
Dès l'`INSERT ... WHERE expires_at > clock_timestamp() ON CONFLICT DO NOTHING`
commité sur connexion PostgreSQL exclusive :

| État | Signification | Suite autorisée |
| --- | --- | --- |
| `dispatching` | Créneau unique réservé et commité avant `POST` | Contrôle frais pré-POST puis `POST` unique → `acknowledged`, `unknown` ou `aborted` ; en reprise après crash, **jamais de second `POST`**, lecture `g2gGetDeliveryStatus` uniquement (`confirmed` ou `manual_review`) |
| `acknowledged` | Accusé HTTP du `POST` reçu (non suffisant pour conclure) | Lecture séparée `g2gGetDeliveryStatus` → `confirmed` ou `manual_review` |
| `unknown` | Timeout, coupure réseau ou crash pendant/après `POST` | **Aucun second `POST`** ; lecture `g2gGetDeliveryStatus` → `confirmed` ou `manual_review` |
| `aborted` | Annulation / expiration détectée entre `COMMIT` et `POST` (aucun `POST` émis) | Terminal (revue humaine) |
| `confirmed` | `delivery_status = 'delivered'` et `delivered_qty = quantity` vérifiés | Terminal |
| `manual_review` | Anomalie, livraison partielle, expiration ou doute persistant | Terminal (alerte Telegram + rapprochement humain) |

Si la réponse du `COMMIT` PostgreSQL lui-même est perdue (`status: "uncertain"`),
le worker courant n'émet **aucun** `POST` et oriente immédiatement vers une
revue humaine.

## 3. Étapes restantes avant tout pilote réel

1. Revue et accord explicite sur ce schéma SQL, puis essai sur la base dédiée
   `g2g-test` uniquement (concurrence inter-processus, expiration, rollback,
   crash après `COMMIT`, privilèges RLS).
2. Préparation du raccordement derrière les garde-fous (`automaticDeliveryVerified()`
   maintenu à `false`, `G2G_AUTO_DELIVERY` vide, `api_qty = 0`), limité à la
   seule offre `G1795521210943KM` (`google_play_tr` / `25_try`), l'offre
   `G1795076410074VF` restant définitivement bloquée.
3. Vérification en lecture seule des frais réels G2G (commission catégorie +
   éventuels frais fixes par commande + frais de retrait/conversion) sur l'offre
   à `1,00 USD` face au coût FazerCards déclaré de `0,49 USD`.
