# Garde-fous des appels sortants — NOWPayments

> Durcissement transverse (novembre 2026), en complément des points 1, 2 et 4
> du plan. Aucun changement visible pour un client honnête ; le risque fermé
> est interne, financier et silencieux.

## 1. Le problème

Deux routes publiques interrogent NOWPayments à chaque appel tant que le
paiement est `pending` :

| Route | Déclencheur | Accès |
|---|---|---|
| `GET /api/digital/orders/{ref}` | page de suivi des codes (sondage toutes les 15 s) | référence + jeton de suivi |
| `GET /api/payments/order/{ref}` | page de paiement / suivi de projet | jeton de suivi **ou** *legacy* (commandes antérieures sans empreinte) |

Chaîne concernée : `reconcileDigitalOrderOnPoll` → `getPayment(paymentId)`
→ `GET https://api.nowpayments.io/v1/payment/{id}`.

Conséquences mesurables, sans aucune malveillance :

- **un onglet de suivi laissé ouvert** = 4 appels sortants par minute,
  indéfiniment, tant que la commande reste `pending` ;
- **plusieurs onglets / appareils** : linéaire ;
- **un lien de suivi rejoué** (partagé, mis en favori, scripté) : non borné.
  Pour les commandes *legacy*, aucune empreinte n'étant stockée, l'accès est
  même possible sans jeton ;
- le quota et la facturation NOWPayments sont **partagés par tout le site** :
  les épuiser ne dégrade pas seulement le suivi, mais aussi la **création de
  factures** — donc la vente elle-même.

Aucun de ces appels n'apportait d'information neuve : l'IPN reste la source de
vérité, et le cron `digital-orders` reprend déjà les commandes bloquées.

## 2. Ce qui a été mis en place

### a) Throttle durable par commande

`claimProviderSync(ref)` réserve le droit d'appeler le fournisseur en posant
`orders.last_provider_sync_at` par un **UPDATE conditionnel** :

```sql
UPDATE orders SET last_provider_sync_at = now()
WHERE ref = $1
  AND (last_provider_sync_at IS NULL OR last_provider_sync_at < now() - interval)
RETURNING id
```

- **zéro ligne renvoyée = aucune réservation** → pas d'appel sortant ;
- l'atomicité de l'UPDATE fait le travail qu'un verrou mémoire ne peut pas
  faire sur Vercel (instance éphémère, plusieurs instances en parallèle) ;
- une carte `in-flight` de 30 s couvre en plus deux onglets simultanés sur la
  **même** instance.

L'intervalle dépend de l'âge de la commande (`decideReconcileThrottle`) :

| Âge de la commande | Intervalle minimal entre deux appels |
|---|---|
| 0 – 1 min | 30 s |
| 1 – 3 min | 60 s |
| 3 – 7 min | 2 min |
| 7 min – 1 h | 5 min |
| > 1 h | 10 min (plafond) |

Justification : c'est au démarrage que le client regarde sa page ; ensuite le
cron prend le relais. On reste réactif là où ça compte, et quasi silencieux
là où ça ne sert plus à rien.

### b) Plafond global par instance

`claimProviderBudget()` borne les appels sortants **toutes commandes
confondues** : 240 appels / 5 min par défaut (≈ 0,8 appel/s), réglable par
`PROVIDER_BUDGET_PER_5MIN`, désactivable (`= 0`) pour un pic prévu.

Limite assumée et documentée : la fenêtre vit en mémoire du processus, donc
**par instance** (même compromis que `src/lib/rate-limit.ts`). Pour un plafond
réellement global il faudrait un backend partagé (Redis/Upstash) ; le besoin
actuel ne le justifie pas.

### c) Dégradation silencieuse, jamais d'erreur

Quand le créneau ou le budget est refusé, la route **répond normalement** avec
l'état lu en base :

- le client voit toujours sa commande, sa progression, ses codes si livrés ;
- aucun `429`, aucune page d'erreur : une protection anti-abus ne doit pas
  ressembler à une panne ;
- la livraison reste garantie par l'IPN et par le cron `digital-orders`.

### d) Observabilité

`GET /api/health` (mode complet : admin ou `CRON_SECRET`) expose :

```json
"providerCalls": {
  "throttleReady": true,
  "budget": { "used": 12, "limit": 240, "windowMs": 300000, "resetsInSec": 240 }
}
```

Deux avertissements apparaissent dans `warnings` :

- colonne de throttle absente (migration non appliquée) — sans elle, le
  garde-fou est inopérant ;
- plafond atteint sur la fenêtre courante — à distinguer d'un pic légitime.

## 3. Choix de conception

- **Une seule colonne, sur `orders`** : les deux routes interrogent la *ligne
  de paiement* (`orders`), pas la commande digitale. Dupliquer l'horloge sur
  `digital_orders` aurait créé deux sources de vérité incohérentes.
- **Pas de reconstruction de l'état depuis le fournisseur à chaque affichage** :
  le suivi sert d'abord la base. Le rafraîchissement distant est une
  commodité (rattraper un IPN perdu), pas la source de vérité.
- **Réserver avant d'appeler, relâcher dans `finally`** : un appel qui traîne
  (timeout 10 s) ne doit pas bloquer la commande plus longtemps que son
  créneau.
- **Les actions admin ne sont pas ralenties** : `resendDigitalCodesEmail`
  remet l'horloge à zéro (`clearProviderSyncGate`) pour que la vérification
  demandée par l'opérateur soit immédiate.
- **Un échec base refuse l'appel** : mieux vaut servir un état légèrement daté
  que laisser filer une facture non plafonnée.

## 4. Ce qui n'a pas changé

- L'IPN NOWPayments reste la source de vérité, avec sa signature HMAC vérifiée
  avant lecture (point 1).
- Le cron `digital-orders` continue de reprendre les commandes bloquées.
- Le bouton « renvoyer les codes » de l'admin court-circuite le throttle.
- Aucune donnée personnelle supplémentaire n'est stockée : la colonne ne
  contient qu'un horodatage technique.

## 5. Vérifications

```bash
node --test scripts/provider-budget.test.mjs   # 24 tests (noyau + câblage)
npm test                                       # suite complète
npx tsc --noEmit && npx next build
```

Non vérifié ici, et à faire en recette : le comportement réel d'une commande
`pending` soumise à un sondage toutes les 15 s pendant 10 minutes, avec
`providerCalls.budget.used` observé sur `/api/health` (attendu : 4 appels puis
espacement, jamais un appel par sondage).
