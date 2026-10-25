# Vendre à la commande — intégration Reloadly

Ce document décrit la vente de codes (cartes cadeaux, abonnements, recharges)
**sans stock** : le client paie d'abord, le site achète le code chez
[Reloadly](https://dashboard.reloadly.com) avec le solde du compte marchand,
puis livre le code au client.

> ⚠️ Le tableau de bord Reloadly est un **compte marchand** : on n'y « connecte »
> pas le site avec l'e-mail/le mot de passe du compte. L'intégration utilise une
> **paire d'identifiants API** (`client id` + `client secret`) créée dans
> *Developers → API keys*, stockée **uniquement** côté serveur (variables
> d'environnement Vercel). Aucun mot de passe de tableau de bord n'est demandé
> ni stocké par le site.

---

## 1. Comment la vente fonctionne

```
Client                     Site (Nukhba)                  Reloadly
  │  choisit un code            │                              │
  ├────────────────────────────►│  /api/digital/checkout        │
  │                             │  • prix recalculé (catalogue) │
  │                             │  • commande + facture NOWPayments
  │  paie (USDT…)               │                              │
  ├────────────────────────────►│  IPN NOWPayments (signé)      │
  │                             │  • paiement vérifié + montant │
  │                             │  • POST /orders ─────────────►│  achat réel
  │                             │  • GET …/cards  ◄─────────────│  code + PIN
  │  e-mail : code + PIN        │  • codes chiffrés en base     │
  │  page /codes/commande       │  • e-mail au client           │
```

Points structurants :

- **Aucun achat avant paiement.** La facture crypto est créée sans toucher au
  solde Reloadly ; l'achat n'a lieu qu'à la réception de l'IPN confirmant le
  paiement (signature HMAC vérifiée, montant/devise contrôlés).
- **Prix serveur.** Le navigateur n'envoie qu'un identifiant de montant et une
  quantité ; le prix vient de `digital_denominations.price_usd`.
- **Idempotence.** La référence de commande (`DGC-…`) sert de
  `customIdentifier` chez Reloadly. Un IPN rejoué ne provoque pas de second
  achat : si une transaction existe déjà, le serveur récupère seulement les
  codes manquants.
- **Codes chiffrés.** Les numéros de carte et PIN sont stockés chiffrés en
  AES-256-GCM (`DIGITAL_CODES_SECRET`, sinon `SESSION_SECRET`) et ne sont
  lisibles que par le serveur. L'e-mail au client est la copie durable.
- **Aucune dépense silencieuse.** Toute condition anormale bascule la commande
  en **livraison manuelle** et envoie une alerte à l'agence :
  Reloadly non configuré, fiche non reliée à un produit, montant supérieur au
  plafond `RELOADLY_MAX_ORDER_USD` (300 $ par défaut), erreur fournisseur.
- **Sandbox par défaut.** Tant que `RELOADLY_SANDBOX` n'est pas explicitement
  `false`, le serveur vise `giftcards-sandbox.reloadly.com` : aucun argent réel
  n'est dépensé.

---

## 2. Configuration (10 minutes)

### 2.0 Quelle valeur mettre dans quelle variable ?

Deux variables, **deux valeurs différentes** — les inverser est l'erreur la plus
fréquente (« Access denied » / 401) :

| Nom exact de la variable | Valeur à coller | Où la trouver |
| --- | --- | --- |
| `RELOADLY_CLIENT_ID` | le **Client ID** (ex. `qwcLz3Xy…`, ~32 caractères) | dashboard Reloadly → *Developers* → *API keys* → ligne **Client ID** |
| `RELOADLY_CLIENT_SECRET` | le **Client Secret** (ex. `7kscVxQZ32-…`, contient des tirets) | même écran, ligne **Client Secret** |
| `RELOADLY_SANDBOX` | `true` pour TEST, `false` pour LIVE | bandeau du dashboard (TEST / LIVE) |

À ne **jamais** mettre dans ces variables :

- l'e-mail ou le **mot de passe du compte** Reloadly (le site n'en a pas besoin) ;
- le préfixe `Bearer `, des guillemets ou des espaces (le serveur les retire,
  mais autant coller la valeur brute) ;
- une clé **TEST** avec le mode `LIVE`, ou l'inverse : les deux environnements
  sont séparés et leurs jetons ne sont pas interchangeables.

### 2.1 Créer / récupérer les identifiants API

1. Connectez-vous au [tableau de bord Reloadly](https://dashboard.reloadly.com).
2. Basculez sur **TEST** (sandbox) pour commencer.
3. *Developers* (ou *API keys*) → copiez **Client ID** et **Client Secret**.
4. Ajoutez ces variables sur Vercel (*Settings → Environment Variables*,
   environnement **Production**) puis **redéployez** :

| Variable | Rôle | Défaut |
| --- | --- | --- |
| `RELOADLY_CLIENT_ID` | identifiant API (test ou live) | — |
| `RELOADLY_CLIENT_SECRET` | secret API (test ou live) | — |
| `RELOADLY_SANDBOX` | `true` = bac à sable, `false` = ventes réelles | `true` |
| `RELOADLY_MAX_ORDER_USD` | plafond d'un achat automatique | `300` |
| `DIGITAL_CODES_SECRET` | sel de chiffrement des codes | `SESSION_SECRET` |

> Les identifiants **TEST** et **LIVE** ne sont pas interchangeables : un jeton
> émis pour un environnement est refusé par l'autre
> (`Service not enabled within domain`). Si `/api/health` renvoie
> `reloadly.credentialsValid:false`, vérifiez d'abord cet appariement.

### 2.2 Relier une fiche du catalogue à un produit Reloadly

Dans l'admin → **Codes & Cartes cadeaux** :

1. Trouvez l'`ID produit` Reloadly du code à vendre (ex. carte Steam 50 USD
   États-Unis). Deux moyens :
   - le bouton **Rechercher sur Reloadly** de la fiche (recherche par nom de
     marque + pays, lecture seule) — cliquez sur **Utiliser** pour renseigner
     l'ID et le pays ;
   - ou le tableau de bord Reloadly (*Products*).
2. Ouvrez la fiche, renseignez :
   - **Livraison** : `Automatique (achat Reloadly)` ;
   - **Produit Reloadly (ID)** : ex. `1234` ;
   - **Pays Reloadly (ISO)** : ex. `US`.
3. Pour **chaque montant**, renseignez **Valeur Reloadly** (`unitPrice` exact
   attendu par Reloadly : `50`, `25`, `10`…). Sans ce champ, la valeur est
   déduite du premier nombre de la valeur faciale (« 50 USD » → 50).

   ⚠️ **Reloadly n'accepte que les valeurs de son produit** : les montants
   listés pour un produit `FIXED` (ex. `10, 20, 50, 100`), ou toute valeur
   dans la fourchette d'un produit `RANGE`. Envoyer autre chose renvoie
   `WRONG_PRODUCT_PRICE` (« Invalid price »). Sous la recherche Reloadly, le
   bloc **« Valeurs acceptées »** affiche la vérité du fournisseur et signale
   en rouge chaque montant refusé **avant** l'enregistrement.
4. Statut de la fiche : `Disponible`, et au moins un montant `Disponible`.

> Une fiche en mode `Automatique` sans ID produit retombe en livraison manuelle
> — c'est volontaire : on ne devine jamais un produit.

### 2.2.1 Fixer la marge : le prix se calcule tout seul

Une fois le produit Reloadly relié, chaque fiche affiche **« Marge nette (%) »**
et **« Valeurs acceptées »** (montants du fournisseur, frais, remise).

1. Saisir la marge nette visée (ex. `4`). **Tous les prix de la fiche sont
   recalculés immédiatement** ; vider le champ rend la main sur les prix.
2. Formule appliquée :

   ```
   coût réel  = valeurReloadly × (1 + fraisReloadly%) × (1 − remise%)
   prix vente = coût réel ÷ (1 − marge% − fraisPaiement%)
   ```

   `fraisPaiement%` = `PAYMENT_FEE_PERCENT` (1 % par défaut, NOWPayments).
   Le diviseur est essentiel : 4 % **sur la face** (20 → 20,80) ne laisse que
   ~2,9 % net ; 4 % **net** sur un coût de 20 donne 21,05 $.
3. Chaque montant affiche **coût réel, prix et marge nette obtenue** ; un prix
   inférieur au coût est signalé **« VENTE À PERTE »**, et l'enregistrement est
   **refusé** par le serveur tant que le prix reste sous le coût (si Reloadly
   est injoignable, la vérification est ignorée pour ne pas bloquer la saisie).

### 2.3 Vérifier la connexion

- Admin → **Commandes de codes** : carte « Connexion Reloadly » (environnement,
  solde marchand, plafond, commandes à livrer).
- `GET /api/health` : bloc `reloadly` (`configured`, `mode`,
  `credentialsValid`, `error`) — sans solde ni secret.

### 2.4 Passer en ventes réelles

1. Basculez le tableau de bord Reloadly sur **LIVE**, copiez les identifiants
   LIVE.
2. Sur Vercel : remplacez `RELOADLY_CLIENT_ID` / `RELOADLY_CLIENT_SECRET`,
   mettez `RELOADLY_SANDBOX=false`, redéployez.
3. **Vérifiez le solde** du compte LIVE (admin → Commandes de codes) : chaque
   commande payée débite ce solde. Un solde insuffisant → achat refusé →
   commande en livraison manuelle + alerte e-mail.
4. Faites un achat de contrôle avec le montant le plus bas du catalogue
   (ex. 5 $), puis vérifiez que le code arrive par e-mail et s'affiche sur
   `/codes/commande`.

---

## 3. Exploitation quotidienne

### Suivre une commande

- **Admin → Commandes de codes** : liste des commandes (statut, client,
  montant, transaction Reloadly, motif d'erreur, codes livrés).
- **Client** : `/codes/commande?ref=DGC-…&t=<jeton>` — la page de retour
  NOWPayments y mène automatiquement ; la dernière commande est aussi
  mémorisée sur l'appareil.

Statuts internes :

| Statut | Signification | Action |
| --- | --- | --- |
| `pending` | facture émise, paiement non confirmé | attendre (IPN) |
| `paid` | payé, achat en cours / code en émission | patienter, puis relancer |
| `manual` | payé, livraison humaine nécessaire | voir le motif affiché |
| `delivered` | code acheté, chiffré, e-mail envoyé | rien |
| `failed` | achat définitivement refusé | contacter le client |

### Débloquer une livraison

1. Ouvrir la commande dans l'admin et lire le **motif**.
2. Si l'achat n'a pas été fait : corriger la cause (identifiants, ID produit,
   solde, plafond) puis **Relancer la livraison**.

   La relance **relit la fiche** (mode de livraison, produit Reloadly, pays,
   valeur faciale) : une commande payée *avant* la configuration de la fiche
   (mode manuel, aucun produit relié) devient donc livrable automatiquement
   après correction, **sans nouveau paiement client**. Le prix payé
   (`unit_price_usd`, `total_usd`) reste figé, et le plafond
   `RELOADLY_MAX_ORDER_USD` se juge sur ce montant-là.
3. Si l'achat a été fait dans le tableau Reloadly : **Saisir les codes
   manuellement**, une carte par ligne :

   ```
   6120200345149064 | EFSDCEAFSD | https://activate.example/…
   6120200345149065 | XKCD1234
   ```

   Les codes sont chiffrés, la commande passe en `delivered` et le client reçoit
   l'e-mail automatiquement.
4. **Renvoyer l'e-mail** est disponible sur toute commande livrée.

### Le client ne reçoit pas ses codes

1. Admin → **Commandes de codes** → dépliez la commande : le bloc
   **« Codes livrés (n) »** affiche les codes réellement achetés. Ils sont
   donc toujours récupérables, même si l'e-mail n'arrive pas.
2. Ligne **« E-mail codes »** :
   - un **identifiant de message** (`message : …`) = le fournisseur a accepté
     le message ; l'échec est alors côté remise (domaine non vérifié,
     SPF/DKIM absents, spam) ;
   - un encart rouge **« E-mail non envoyé »** = refus explicite du
     fournisseur (clé invalide, quota, expéditeur non autorisé).
3. Carte **« Envoi des e-mails »** (même page) : affiche le canal
   (`resend` / `smtp`), l'expéditeur réel et le domaine. Le bouton
   **Envoyer le test** renvoie le verdict exact + l'identifiant du message.
4. `GET /api/health` → bloc `mail` (`provider`, `configured`, `from`,
   `domain`, `fromExplicit`) — aucun secret.

Causes fréquentes : `EMAIL_FROM` absent (expédition depuis
`no-reply@<domaine du site>`, non vérifié chez Resend), domaine sans
SPF/DKIM, ou adresse du client en spam. Corriger `EMAIL_FROM` avec une
adresse vérifiée est le remède le plus rapide.

### Rupture, erreur 4xx, doublon

- `customIdentifier` déjà utilisé : la commande a été achetée lors d'un appel
  précédent — l'admin vérifie la transaction, aucun second achat n'est lancé
  automatiquement.
- `404` produit : l'ID Reloadly n'existe plus ou n'est plus vendu dans ce pays
  → retirer le montant de la vente (bouton `Disponible`).
- `400` sur `unitPrice` (`WRONG_PRODUCT_PRICE`) : la valeur n'appartient pas
  aux dénominations du produit → corriger **Valeur Reloadly**. Ce contrôle est
  désormais fait **avant** l'achat : la caisse refuse la vente (message neutre
  pour le client) et la livraison bascule en manuel avec le motif explicite
  (« 5 USD n'est pas une valeur acceptée… valeurs possibles : 10, 20, 50 »).
  Aucun débit n'a lieu pour un prix refusé.

---

## 4. Sécurité

- Les identifiants Reloadly ne sont **jamais** envoyés au navigateur ni
  journalisés ; le jeton OAuth est mis en cache en mémoire du serveur.
- La création de commande est protégée par contrôle d'origine (CSRF) et limite
  de cadence (8 créations / 10 min / IP+UA).
- Le suivi exige le **jeton de suivi** (256 bits) ; seul son SHA-256 est stocké.
  Sans jeton valide, la réponse est `404` (aucune fuite d'existence).
- Les codes sont chiffrés en base ; les journaux ne contiennent que des
  identifiants de transaction, jamais de numéro de carte.
- Plafond par commande (`RELOADLY_MAX_ORDER_USD`) : au-delà, livraison manuelle.

---

## 5. Endpoints et fichiers

| Élément | Rôle |
| --- | --- |
| `POST /api/digital/checkout` | crée la commande + la facture crypto |
| `GET /api/digital/orders/[ref]` | statut + codes (jeton requis) |
| `POST /api/payments/ipn` | confirme le paiement puis déclenche l'achat |
| `src/lib/reloadly.ts` | client Reloadly (OAuth, produits, achats, codes) |
| `src/lib/digital-orders.ts` | commandes, devis serveur, livraison, chiffrement |
| `src/lib/digital-emails.ts` | e-mails client (codes) et agence (alerte) |
| `src/app/admin/(panel)/digital/orders` | pilotage des livraisons |
| `GET /api/admin/reloadly/products` | recherche du catalogue Reloadly (admin) |

## 6. Limites connues

- **Cartes cadeaux uniquement.** Les recharges téléphoniques (Airtime API) ne
  sont pas branchées : elles demandent un opérateur et un numéro, alors que le
  catalogue actuel décrit des codes.
- **Quantité 1 à 10** par commande.
- Un achat `PENDING`/`PROCESSING` chez Reloadly n'est pas relancé par un cron :
  la relance se fait depuis l'admin (bouton *Relancer la livraison*), ou
  automatiquement au prochain IPN de la même commande.
- Le taux de change du solde marchand est celui de Reloadly : le prix de vente
  USD du catalogue ne suit pas automatiquement le coût d'achat. Surveillez la
  marge (admin → Commandes de codes → montants) et ajustez les prix.
