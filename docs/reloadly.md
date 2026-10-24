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
4. Statut de la fiche : `Disponible`, et au moins un montant `Disponible`.

> Une fiche en mode `Automatique` sans ID produit retombe en livraison manuelle
> — c'est volontaire : on ne devine jamais un produit.

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
3. Si l'achat a été fait dans le tableau Reloadly : **Saisir les codes
   manuellement**, une carte par ligne :

   ```
   6120200345149064 | EFSDCEAFSD | https://activate.example/…
   6120200345149065 | XKCD1234
   ```

   Les codes sont chiffrés, la commande passe en `delivered` et le client reçoit
   l'e-mail automatiquement.
4. **Renvoyer l'e-mail** est disponible sur toute commande livrée.

### Rupture, erreur 4xx, doublon

- `customIdentifier` déjà utilisé : la commande a été achetée lors d'un appel
  précédent — l'admin vérifie la transaction, aucun second achat n'est lancé
  automatiquement.
- `404` produit : l'ID Reloadly n'existe plus ou n'est plus vendu dans ce pays
  → retirer le montant de la vente (bouton `Disponible`).
- `400` sur `unitPrice` : la valeur n'appartient pas aux dénominations du
  produit → corriger **Valeur Reloadly** (valeurs fixes du produit).

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
