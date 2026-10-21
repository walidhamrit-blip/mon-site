# Abonnements mensuels en crypto — plan A (abonnements natifs NOWPayments)

> Statut : **plan validé, pas encore implémenté**.
> Périmètre : passerelle NOWPayments (déjà intégrée : facture `/invoice`, IPN signé HMAC-SHA512, table `orders`).
> Objectif : vendre des abonnements récurrents payés en crypto, sans construire notre propre moteur de facturation.

---

## 1. Principe

1. L'agence crée **un plan** chez NOWPayments (`POST /v1/subscriptions/plans`) : titre, `interval_day`, montant, devise, URLs d'IPN, de succès, d'annulation et de paiement partiel.
2. Pour chaque client, on crée **un abonnement** (`POST /v1/subscriptions` avec `subscription_plan_id` et `email`). NOWPayments envoie au client un lien de facture par e-mail. L'abonnement reste `Inactive` tant que la première facture n'est pas payée.
3. Le client choisit sa crypto sur la page NOWPayments et paie.
4. À chaque échéance, NOWPayments émet la facture suivante. Le client la paie (ou autorise le prélèvement automatique, voir §3).
5. Chaque événement de paiement arrive sur notre **IPN** (`/api/payments/ipn`). Le site met à jour l'abonnement et envoie les e-mails.

Sources : documentation et articles NOWPayments sur les abonnements (voir « Références » en fin de document).

---

## 2. Contraintes à connaître avant de coder

| Sujet | Ce qu'il faut savoir | Conséquence |
|---|---|---|
| **Périodicité** | Un « mois » = intervalle de 30 ou 31 jours, pas une date fixe du calendrier. | Si on veut facturer le 1er de chaque mois, il faut un autre modèle (option B, non retenue). |
| **Prélèvement automatique** | Disponible via ChangeNOW **uniquement** pour les intervalles 1, 7, 30/31 et 365 jours. Autres intervalles : facture manuelle à chaque cycle. | Pour un plan mensuel (30 ou 31 jours), le prélèvement automatique est possible, mais il dépend de l'autorisation du client. |
| **Période de grâce** | 0 à 5 jours, et ne peut pas dépasser la période de l'abonnement. | À régler dans le plan. Pendant la grâce, l'accès reste ouvert et une relance part. |
| **Devise** | NOWPayments ne supporte pas la LYD. Facturation en USD, avec équivalent LYD indicatif sur le site. | Cohérent avec `NOWPAYMENTS_CURRENCY=usd`. |
| **Frais** | Environ 0,5 à 1 % par transaction selon la crypto (à confirmer sur le compte). | À intégrer dans la grille tarifaire. |
| **Annulation** | Nécessite un jeton JWT (identifiants `NOWPAYMENTS_EMAIL` / `NOWPAYMENTS_PASSWORD`), en plus de la clé API. À confirmer dans la doc officielle. | Déjà partiellement géré par `nowPaymentsJwt()`. |
| **Format de l'IPN d'abonnement** | Non confirmé dans nos sources (la doc IPN classique est connue, le payload « abonnement » ne l'est pas). | **À vérifier sur un compte sandbox avant tout code définitif.** |
| **Environnements** | Sandbox et production ne sont pas interchangeables. | Tests en `NOWPAYMENTS_SANDBOX=true`. |

---

## 3. Dette technique existante à corriger avant les abonnements

Le document d'audit des paiements (`docs/production-vercel.md`, §7) signale des points qui deviennent critiques avec des renouvellements :

- **Machine à états IPN** : les transitions doivent être monotones et idempotentes (une notification tardive ne doit jamais faire repasser un abonnement `active` en `pending`).
- **Montant et devise** : contrôle sur chaque paiement, y compris les renouvellements.
- **`confirmed` vs `finished`** : décision explicite (le plan actuel le traite comme « en attente »).
- **Suivi public** : l'endpoint de suivi ne doit pas exposer de données personnelles pour les abonnés.

---

## 4. Modèle de données

Nouvelle table `subscriptions` (à créer dans `ensureSchema()`, comme les autres tables) :

| Colonne | Rôle |
|---|---|
| `id` (serial) | Clé interne |
| `ref` (unique) | Référence lisible (ex. `ABO-…`) |
| `tracking_token_hash` | SHA-256 du jeton de l'espace abonné (jamais le jeton en clair) |
| `plan_id` / `plan_name` | Plan choisi (identifiant local) |
| `nowpayments_plan_id` | Identifiant du plan chez NOWPayments |
| `nowpayments_subscription_id` (unique) | Identifiant de l'abonnement chez NOWPayments |
| `email`, `client_name`, `phone` | Coordonnées du client |
| `amount_usd`, `currency` | Montant par cycle |
| `status` | `inactive` · `active` · `past_due` · `canceled` |
| `current_period_end` | Fin de la période payée |
| `last_payment_id` | Dernier `payment_id` reçu |
| `created_at`, `updated_at` | Traçabilité |

Côté `orders` : ajouter `subscription_id` (nullable) pour rattacher chaque paiement à son abonnement. Un paiement d'abonnement reste une ligne `orders`, ce qui réutilise l'admin « Paiements & réservations ».

---

## 5. Découpage en étapes

### Étape 0 — Décisions produit (bloquant)
- Liste des plans (noms, prix USD, frais de personnalisation éventuels).
- Intervalle : **30 jours** (renouvellement automatique possible) ou **31 jours**.
- Période de grâce (0 à 5 jours) et comportement pendant la grâce.
- Règles d'annulation (immédiate, ou à la fin de la période payée).
- Mode de souscription : lien envoyé par NOWPayments (plan A pur) ou page de souscription sur le site.

### Étape 1 — Compte et sandbox NOWPayments
- Adresse de réception configurée.
- URL d'IPN déclarée : `https://nokhba.net.ly/api/payments/ipn`.
- Clé API **sandbox** et `NOWPAYMENTS_SANDBOX=true` pour les essais.
- Vérifier le payload réel de l'IPN d'abonnement et la procédure d'annulation sur sandbox.

### Étape 2 — Schéma de données
- Ajouter la table `subscriptions` et la colonne `orders.subscription_id` dans `ensureSchema()` et `src/db/schema.ts`.
- Migration idempotente (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`).

### Étape 3 — Création des plans
- Fonction `createSubscriptionPlan()` dans `src/lib/nowpayments.ts` (appel `POST /v1/subscriptions/plans`).
- Plans définis dans `src/lib/config.ts` (ou en admin), avec synchronisation : le plan n'est créé chez NOWPayments qu'une fois, son identifiant est stocké.
- Une modification de prix ne touche que les nouveaux cycles (règle NOWPayments).

### Étape 4 — Souscription
- Route serveur `POST /api/subscriptions/create` :
  - protection CSRF (`enforceSameOrigin`, `lib/csrf.ts`) ;
  - validation du plan côté serveur (le navigateur ne choisit jamais le prix) ;
  - création de la ligne `subscriptions` en `inactive` ;
  - appel `POST /v1/subscriptions` (`subscription_plan_id`, `email`) ;
  - envoi de l'e-mail de bienvenue avec le lien de suivi.
- Limitation de débit par e-mail / IP pour éviter les abus.

### Étape 5 — IPN d'abonnement
- Étendre `/api/payments/ipn` :
  - reconnaître un paiement lié à un abonnement (identifiant d'abonnement dans le payload, à confirmer) ;
  - transitions monotones : `inactive → active`, `active → past_due` après la grâce, `→ canceled` ;
  - à chaque paiement confirmé, recalculer `current_period_end` ;
  - contrôle montant et devise ;
  - idempotence (même schéma que la mise à jour conditionnelle actuelle).
- Tests unitaires sur les fonctions pures : transitions, calcul de période, contrôle de montant.

### Étape 6 — Espace abonné
- Lien magique envoyé par e-mail (jeton haché en base, comme le suivi de commande).
- Page « Mon abonnement » : statut, prochaine échéance, paiement de la facture en cours, annulation.
- Aucune donnée personnelle dans les réponses publiques.

### Étape 7 — Relances et e-mails
- J-3 avant l'échéance : rappel avec lien de paiement.
- Échéance dépassée : e-mail « paiement en retard », puis suspension après la grâce.
- Annulation : confirmation au client et notification à l'agence (`LEAD_NOTIFICATION_EMAIL`).
- Le cron de relance s'appuie sur Vercel Cron (ou équivalent VPS).

### Étape 8 — Administration
- Liste des abonnés avec filtres par statut.
- Indicateurs : abonnés actifs, impayés, revenu mensuel récurrent.
- Action manuelle : annuler, renvoyer le lien, marquer comme payé (avec trace d'audit).

### Étape 9 — Tests et mise en production
- Scénarios sandbox : première facture payée, renouvellement, paiement partiel, échec et grâce, annulation, IPN dupliquée et désordonnée.
- Vérifier `/api/health` (`nowpayments.apiKeyValid`).
- Passage en production : clé production, `NOWPAYMENTS_SANDBOX` vide, `SITE_URL` défini.

---

## 6. Points de vigilance

- **Pas de prélèvement sans autorisation** : sauf option ChangeNOW, le client paie chaque cycle. Prévoir des relances et accepter un taux d'impayés plus élevé qu'en carte bancaire.
- **Volatilité** : le prix est fixé en USD, le montant crypto varie au moment du paiement. Le client doit le savoir.
- **Cadre légal et bancaire en Libye** : à vérifier avant lancement (usage de la crypto, facturation, TVA éventuelle).
- **Ne jamais faire confiance au navigateur** pour le prix, l'intervalle ou le statut.

---

## Références

- NOWPayments — *What is Recurring Payments API* : https://nowpayments.io/blog/recurring-payments-api
- NOWPayments — *How to Set Up Recurring Crypto Payments* : https://nowpayments.io/blog/how-to-create-recurring-crypto-payments
- NOWPayments — *IPN and how to setup* : https://nowpayments.zendesk.com/hc/en-us/articles/21395546303389-IPN-and-how-to-setup
- Client TypeScript tiers (référence pour les endpoints JWT) : https://github.com/ferdiansyah0611/nowpayments-native
