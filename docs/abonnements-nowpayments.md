# Abonnements mensuels en crypto — plan A (abonnements natifs NOWPayments)

> Statut : **étapes 0 à 6 réalisées** (décisions, schéma, plans, souscription client, IPN d'abonnement, espace abonné). Restent à faire : annulation par le client, relances e-mail, liste admin, lien de navigation, et validation réelle sur sandbox NOWPayments.
> Périmètre : passerelle NOWPayments (déjà intégrée : facture `/invoice`, IPN signé HMAC-SHA512, table `orders`).
> Objectif : vendre des abonnements récurrents payés en crypto, sans construire notre propre moteur de facturation.

## 0. Décisions validées

| Offre | Mensuel (30 j) | Annuel (365 j) |
|---|---|---|
| Vitrine | 10 $ | 69 $ |
| Vitrine+ | 12 $ | 89 $ |
| Boutique | 25 $ | 199 $ |

- Période de grâce : **5 jours**. Décision finale : la passerelle NOWPayments limite la grâce à 5 jours (et à la durée de l'abonnement). Le client en est averti avant de s'abonner (case à cocher obligatoire) et après (page de suivi, réponse de l'API). Une fois la grâce écoulée, l'abonnement est suspendu et le client peut **s'abonner de nouveau**.
- Le catalogue est défini dans `src/lib/subscription-plans.ts`. Les identifiants locaux sont `vitrine-monthly`, `vitrine-annual`, `vitrine-plus-monthly`, etc.
- Ces abonnements sont des offres distinctes des tarifs ponctuels de `config.ts` (300 / 510 / 880 $).

## Mise à jour — souscription, IPN et espace abonné (étapes 4 à 6)

**Décisions appliquées** : grâce = 5 jours ; client averti et case à cocher obligatoire ; réabonnement possible après expiration.

**Règles de statut** (`src/lib/subscription-lifecycle.ts`)
- Statut affiché : `inactive` (facture en attente) → `active` (période payée) → `grace` (échéance dépassée, accès maintenu, 5 jours) → `expired` (accès suspendu). L'annulation par le client est une date (`canceled_at`), détaillée dans la mise à jour suivante.
- Un paiement après expiration démarre une nouvelle période à partir du paiement. Un paiement anticipé prolonge la période courante depuis l'échéance (les jours déjà payés ne sont pas perdus).
- Un abonnement **en attente de paiement** ou **actif/en grâce** bloque une nouvelle souscription à la même formule pour la même adresse (évite les doubles factures). Après expiration ou annulation, le réabonnement est autorisé.

**Souscription** — `POST /api/subscriptions/create`
- Validation serveur (formule, e-mail, nom, téléphone, acceptation de la grâce) ; origine vérifiée ; limitation de débit.
- Création de l'abonné en base, puis `POST /v1/subscriptions` chez NOWPayments (qui envoie la facture par e-mail).
- Échec côté passerelle : 502 avec la cause, et la ligne locale est supprimée (aucun abonné fantôme).
- Réponse : référence `ABO-…`, lien de suivi `/abonnements/suivi?ref=…&t=…` (jeton affiché une seule fois), rappel de la règle de grâce.

**IPN d'abonnement** — `/api/payments/ipn`
- Branche séparée, déclenchée par l'identifiant d'abonnement dans la notification (`subscription_id`, ou `recurring_payment_id`). Le flux des commandes ponctuelles n'est pas modifié.
- Signature vérifiée avant tout traitement (inchangé).
- Statut « terminé » uniquement, montant et devise contrôlés contre le prix du plan.
- Idempotence : un même `payment_id` n'est enregistré qu'une fois ; verrou sur la ligne d'abonné pour les notifications simultanées.
- Chaque paiement crée une commande `kind = subscription` (visible dans l'admin, nouvel onglet « Abonnement »).
- Première activation : e-mail « paiement confirmé » à l'agence (même gabarit que les commandes).
- Statuts `failed`/`expired`/`refunded` : aucun changement d'accès. Statuts en cours : ignorés en attente.

**Espace abonné** — `/abonnements/suivi`
- Accès par référence + jeton (SHA-256 en base, jamais en clair). Mauvais jeton = même réponse que référence inconnue.
- Affiche statut, fin de période, dernier jour d'accès, grâce de 5 jours, e-mail masqué, et bouton de réabonnement si besoin.

**Tests**
- `npm run test:subscriptions` : 13 tests (catalogue, périodes, grâce, statuts, identifiant IPN).
- Scénario d'intégration (`.scratch/subscriptions-integration.ts`, non versionné) : vraie base PostgreSQL, vraies routes, faux serveur NOWPayments. 38 contrôles + notifications simultanées : tous passent.

**À valider sur sandbox NOWPayments avant production** (non testable depuis l'environnement de développement) :
1. Nom exact du champ identifiant l'abonnement dans l'IPN (`subscription_id` supposé).
2. Présence de `price_amount` / `price_currency` dans les IPN d'abonnement (exigés par le contrôle de montant ; sans eux, le paiement est refusé et signalé dans les journaux).
3. En-têtes d'authentification de `POST /v1/subscriptions/plans` (clé API seule, ou JWT).
4. Que NOWPayments ne résilie pas l'abonnement avant nos 5 jours de grâce.

**Reste à faire avant production** : validation sur sandbox NOWPayments (voir la liste « Non confirmé » ci-dessous), et contrôle visuel de la page admin. Le code des points annoncés (annulation, relances, admin, navigation) est en place.

## Mise à jour — annulation, relances, administration, navigation

- **Annulation client** : `POST /api/subscriptions/cancel` (même origine, limitation de débit, référence + jeton de suivi). Elle appelle `DELETE /v1/subscriptions/{id}` (JWT envoyé si configuré).
  - Échec de la passerelle : **502**, aucune modification locale.
  - 404 de la passerelle : traité comme annulé (déjà supprimé côté NOWPayments).
  - Succès : `canceled_at` posé, statut stocké inchangé, accès jusqu'à `current_period_end`, **sans grâce**, **sans remboursement**. Idempotent.
  - Bouton sur `/abonnements/suivi`, visible si l'abonnement est actif ou en grâce et non annulé.
- **Relances** : `GET /api/cron/subscriptions`, en `Authorization: Bearer $CRON_SECRET`, planifié chaque jour à 08:00 UTC (`vercel.json`). Sans `CRON_SECRET` : 503. Mauvais secret : 401.
  - Rappel à J-3 avant l'échéance (`reminder_for`) ;
  - avis « en retard » pendant la grâce (`overdue_notice_for`) ;
  - avis « suspendu » après la grâce (`expired_notice_for`).
  - Une seule relance par échéance. Le marqueur n'est posé qu'après un envoi réussi : un échec est retenté au passage suivant.
  - Abonnements annulés ou en attente de paiement : aucune relance.
  - Les e-mails renvoient vers `/abonnements` ; aucun lien de suivi tokenisé n'est envoyé par e-mail.
  - Gabarits FR et AR dans `src/lib/subscription-emails.ts`.
- **Administration** : `/admin/subscriptions` (entrée « Abonnements » du menu). Compteurs par statut, revenu mensuel récurrent (prix × 30 ÷ durée du cycle : un cycle annuel de 69 $ compte 5,67 $ par mois), tableau des 300 dernières souscriptions.
- **Navigation** : lien « Abonnements » dans la barre du site (FR et AR).

**Tests**
- `npm run test:subscriptions` : 21/21 (catalogue, périodes, grâce, annulation, relances, revenu mensuel, IPN, gabarits).
- Scénario d'intégration (dans `.scratch/`, non versionné) : 45/45, sur PostgreSQL et un mock NOWPayments qui couvre `POST /v1/auth`, les plans, `POST /v1/subscriptions` et `DELETE /v1/subscriptions/{id}`. Les handlers des routes sont appelés directement, et l'API Resend est simulée.

**Décisions par défaut (à valider)**
- Après annulation : accès jusqu'à la fin de la période payée, sans grâce, sans remboursement.
- Relances : J-3, retard pendant la grâce, suspension après la grâce.
- Pas de lien de suivi dans les e-mails.
- Revenu mensuel : prix × 30 ÷ durée du cycle (et non ÷ 12).

**Non confirmé en sandbox NOWPayments**
- Nom du champ identifiant l'abonnement dans l'IPN (`subscription_id` supposé) et présence de `price_amount` / `price_currency`.
- Méthode d'annulation : `DELETE` retenu ; une source tierce indique `POST`.
- Authentification de création de plan (clé API ou JWT).
- Absence de résiliation par NOWPayments avant la fin de la grâce.
- Envoi par NOWPayments de la facture de renouvellement par e-mail (hypothèse des relances).

---

## Réalisé (commits précédents)

- `src/lib/subscription-plans.ts` : catalogue et règles pures (fin de période, grâce, état d'accès).
- `src/lib/nowpayments.ts` : `createSubscriptionPlan`, `updateSubscriptionPlan`, `getSubscriptionPlanRemote`, `createSubscription`.
- `src/db/index.ts` et `src/db/schema.ts` : tables `subscription_plans` et `subscriptions`, colonne `orders.subscription_id`, migrations idempotentes.
- `src/lib/subscriptions.ts` : `syncSubscriptionPlans()`, idempotente (création, mise à jour de prix par PATCH, rien si inchangé).
- `POST /api/admin/subscriptions/sync` : déclenche la synchronisation (admin + même origine).
- `scripts/subscription-plans.test.mjs` (`npm run test:subscriptions`) : 6 tests sur le catalogue et la grâce.

**Non testé en réel** : l'API NOWPayments n'est pas joignable depuis l'environnement de développement. Les en-têtes d'authentification (clé API, ou jeton JWT quand les identifiants sont présents) et les champs de réponse sont à valider en sandbox avant la mise en production.

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
| **Période de grâce** | 0 à 5 jours, et ne peut pas dépasser la période de l'abonnement. | Fixée à **5 jours** (décision validée). Pendant la grâce, l'accès reste ouvert. |
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
| `status` | `inactive` (facture en attente) · `active`. Les états `grace` et `expired` sont **dérivés** de `current_period_end` à chaque lecture. |
| `canceled_at` | Renouvellement annulé par le client (l'accès reste ouvert jusqu'à la fin de période). |
| `reminder_for`, `overdue_notice_for`, `expired_notice_for` | Échéance pour laquelle chaque relance a été envoyée (anti-doublon). |
| `current_period_end` | Fin de la période payée |
| `last_payment_id` | Dernier `payment_id` reçu |
| `created_at`, `updated_at` | Traçabilité |

Côté `orders` : ajouter `subscription_id` (nullable) pour rattacher chaque paiement à son abonnement. Un paiement d'abonnement reste une ligne `orders`, ce qui réutilise l'admin « Paiements & réservations ».

---

## 5. Découpage en étapes

### Étape 0 — Décisions produit (✅ validées, voir §0)
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

### Étape 2 — Schéma de données (✅ réalisée)
- Ajouter la table `subscriptions` et la colonne `orders.subscription_id` dans `ensureSchema()` et `src/db/schema.ts`.
- Migration idempotente (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`).

### Étape 3 — Création des plans (✅ réalisée)
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
