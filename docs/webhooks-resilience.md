# Webhooks NOWPayments → fournisseurs : résilience et idempotence

> Réponse au point 1 du plan d'amélioration (novembre 2026).
>
> **Le risque** : un client paie en crypto via NOWPayments, mais l'appel API
> vers FazerCards (ou Reloadly) échoue — timeout, 5xx, rupture de stock,
> solde insuffisant. Sans file d'attente, la commande restait « payée »
> sans code jusqu'au prochain passage du cron quotidien, ou jusqu'à ce que
> le client rouvre sa page de suivi.

## Ce qui a changé, en une phrase

Le webhook ne livre plus la commande : il **constate le paiement, la met
en file dans Neon et répond vite**. Un job unique par commande est ensuite
traité juste après la réponse HTTP, puis repris avec backoff par le cron et
par le sondage du client ; chaque échec déclenche une **alerte Telegram
instantanée** et l'épuisement des retries bascule la commande en **revue
manuelle**, jamais en silence.

## Flux complet

```
NOWPayments
   │  POST /api/payments/ipn   (HMAC-SHA512 vérifiée AVANT lecture)
   ▼
1. idempotence webhook ......... webhook_events.event_key UNIQUE
   │                             doublon → 200 {duplicate:true}, rien n'est refait
2. paiement ................... orders.status = paid (update conditionnel)
3. commande digitale .......... digital_orders.fulfillment_status = paid_fulfilling
   │                             digital_orders.supplier = fazercards | reloadly
   │                             digital_orders.idempotency_key = DGC-… (UNIQUE)
4. mise en file ............... delivery_jobs (order_ref + idempotency_key UNIQUES)
   │                             ON CONFLICT DO NOTHING → un seul job, toujours
5. réponse HTTP (200) → after() traite le job (Next 16)
   ▼
deliverPaidDigitalOrder → FazerCards (Idempotency-Key = DGC-…) | Reloadly
   │
   ├─ livré ................... fulfillment_status = delivered (terminal)
   ├─ fournisseur « processing »  retry court (60 s), client prévenu
   ├─ échec transitoire ....... retry programmé (backoff) + alerte Telegram
   ├─ échec permanent ......... manual_review + alerte Telegram (action requise)
   └─ 6 échecs ................ manual_review + alerte Telegram (dead_letter)
```

## Statuts granulaires

| `fulfillment_status` | Sens | Colonne historique `status` |
| --- | --- | --- |
| `pending_payment` | Facture émise, fonds non confirmés | `pending` |
| `paid_fulfilling` | Paiement confirmé, achat en cours **ou retry programmé** | `paid` |
| `delivered` | Code transmis / crédit appliqué (terminal) | `delivered` |
| `manual_review` | Retries épuisés ou échec permanent : un humain agit | `manual` |

La colonne historique reste la source de vérité pour le code existant
(admin, suivi, reprise) ; `fulfillment_status` est la vue granulaire
demandée. **Les deux sont écrites ensemble** à chaque transition, et
`fulfillmentStatusFromLegacy()` traduit l'existant (rétro-remplissage
automatique au déploiement).

`delivered` est terminal : aucun événement ne le fait reculer (un code déjà
transmis ne se « dé-livre » pas).

## Idempotence : quatre verrous

1. **Événement webhook** — `webhook_events.event_key` = `nowpayments:<payment_id>:<statut>`, UNIQUE.
   Un rejeu NOWPayments (même événement) répond `200 {duplicate:true}` sans
   second e-mail ni second achat. Un échec de traitement supprime la ligne :
   le rejeu du fournisseur peut alors aboutir (sinon la commande resterait
   bloquée derrière un événement marqué « reçu »).
2. **Commande** — `digital_orders.idempotency_key` = référence `DGC-…`, UNIQUE.
3. **Job** — `delivery_jobs.order_ref` et `delivery_jobs.idempotency_key`, UNIQUE +
   `ON CONFLICT DO NOTHING` : IPN, cron, admin et sondage client peuvent
   mettre en file en parallèle, il n'existe qu'un job.
4. **Achat fournisseur** — inchangé et conservé : `Idempotency-Key` FazerCards
   (= référence de commande) et `customIdentifier` Reloadly. Un retry ne
   débite jamais deux fois.

Le worker réclame un job par **UPDATE conditionnel** (`status`, `claimed_at`)
avec un bail de 5 min : deux workers simultanés ne traitent jamais le même
job, et un job interrompu par la limite serverless redevient réclamable.

## Retries

| Élément | Valeur | Où |
| --- | --- | --- |
| Backoff | 60 s, 2 min, 4 min, 8 min, 16 min, plafond 30 min | `deliveryRetryDelayMs` |
| Jitter | ±20 % (évite les rafales synchronisées) | idem |
| Tentatives max | 6 | `DELIVERY_MAX_ATTEMPTS` |
| Bail de traitement | 5 min | `JOB_CLAIM_LEASE_MS` |
| Anti-spam alerte | 15 min par commande, escalade toujours envoyée | `telegram_alerted_at` |

**Classification des erreurs** (`classifyDeliveryError`) :

- `transient` → retry : timeout / erreur réseau (pas de code HTTP), 408,
  429, 5xx, messages inconnus (prudence : on réessaie avant d'abandonner) ;
- `permanent` → revue manuelle immédiate : 4xx métier, rupture de stock,
  solde insuffisant, prix refusé, identifiant joueur invalide, chiffrement
  non configuré, plafond d'achat dépassé ;
- `awaiting` → relecture courte : le fournisseur dit « processing/pending ».

## Alertes Telegram (`@NokhbaGamebot`)

`notifyTelegramDeliveryFailure` (dans `src/lib/telegram.ts`) envoie dans le
chat admin (`TELEGRAM_ADMIN_CHAT_ID`) :

- **Retry programmé** — information : référence, produit, montant encaissé,
  fournisseur, `tentative n/6`, motif, lien `/admin/digital/orders` ;
- **Revue manuelle** — action requise : même contenu + « Acheter le code chez
  le fournisseur et le transmettre depuis l'admin, ou rembourser le client ».

Le motif est **expurgé** avant envoi (`redactDeliveryReason` : masque les
chaînes longues type code/jeton, borne à 300 caractères). Une panne Telegram
n'empêche jamais une livraison ; l'e-mail agence existant
(`sendDigitalManualNotice`) continue de partir en parallèle.

Mise en place : `TELEGRAM_BOT_TOKEN` + `TELEGRAM_ADMIN_CHAT_ID`
(voir `docs/telegram-bot.md`). Sans ces variables, tout fonctionne à
l'identique, simplement sans notification.

## Qui fait avancer la file ?

| Déclencheur | Quand | Latence typique |
| --- | --- | --- |
| IPN (`after()`) | juste après la réponse du webhook | secondes |
| Sondage client (`/api/digital/orders/[ref]`, 15 s) | client sur la page de suivi | ≤ 15 s après l'échéance du retry |
| Cron `/api/cron/digital-orders` | planifié par `vercel.json` | dépend du plan |
| Bouton admin « Relancer » | action humaine | immédiate (hors file) |

⚠️ **Plan Vercel Hobby** : un cron ne peut pas être plus fréquent que
quotidien (le déploiement échoue sinon). Le cron quotidien reste alors un
filet ; la latence réelle vient de l'IPN et du sondage. Sur **Pro**, planifier
une exécution toutes les 5 minutes :

```json
{ "path": "/api/cron/digital-orders", "schedule": "*/5 * * * *" }
```

Diagnostic sans achat :

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  "https://nokhba.net.ly/api/cron/digital-orders?dry=1"
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  "https://nokhba.net.ly/api/cron/digital-orders?queue=0"   # reprise historique seule
```

`npm run doctor` affiche en plus l'état de la file (`queued`, `processing`,
`dead_letter`).

## Exploitation au quotidien

1. **Revue manuelle** — `/admin/digital/orders` affiche « Revue manuelle : N »
   et un badge par commande. Chaque ligne porte le motif, le compteur
   `n/6` et, si un retry est programmé, l'heure de la prochaine tentative.
2. **Relancer** — bouton « Relancer la livraison » : il passe par le module
   de livraison (idempotence fournisseur intacte) et sort la commande de la
   revue manuelle si l'achat aboutit.
3. **Livrer hors plateforme** — si le code a été acheté à la main (WhatsApp,
   téléphone), l'action existante enregistre le canal et la note ; le statut
   granulaire passe à `delivered`.
4. **Ne pas supprimer les lignes** `delivery_jobs` / `webhook_events` : elles
   sont le journal d'idempotence. Une purge éventuelle doit conserver au
   moins 90 jours (les rejeux NOWPayments sont bornés, mais une enquête
   après litige a besoin de cette trace).

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `src/lib/delivery-queue-core.ts` | noyau **pur** : statuts, transitions, backoff, classification, clés d'idempotence, décision de livraison |
| `src/lib/delivery-queue.ts` | exécution : enqueue, réclamation, retries, escalade, alertes, journal webhook |
| `src/app/api/payments/ipn/route.ts` | vérification de signature, idempotence, mise en file, `after()` |
| `src/lib/digital-orders.ts` | livraison (FazerCards/Reloadly), `manual_review`, statut granulaire public |
| `src/lib/digital-resume.ts` | reprise historique (webhook perdu avant la file) + alerte d'abandon |
| `src/app/api/cron/digital-orders/route.ts` | worker planifié (file + reprise) |
| `src/lib/telegram-core.ts` | `formatDeliveryFailureAlert` (pur, testé) |
| `src/lib/telegram.ts` | `notifyTelegramDeliveryFailure` (réseau, best-effort) |
| `src/db/schema.ts` + `src/db/index.ts` | colonnes, tables et DDL `CREATE TABLE IF NOT EXISTS` (aucune migration manuelle) |
| `scripts/delivery-queue.test.mjs` | 34 tests du noyau pur |

## Tests

```bash
node --test scripts/delivery-queue.test.mjs   # noyau de la file
node --test scripts/telegram-bot.test.mjs     # formatage de l'alerte
npm run test:digital                          # routage + livraison + reprise
```

Le schéma s'auto-migre : `ensureSchema()` crée `delivery_jobs`,
`webhook_events` et les nouvelles colonnes de `digital_orders`, puis
rétro-remplit `fulfillment_status` et `idempotency_key`. Aucun
`drizzle-kit push` n'est nécessaire sur Vercel.
