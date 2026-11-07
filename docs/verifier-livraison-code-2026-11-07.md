# Vérifier qu'un code a bien été livré — fiche de contrôle

Date : 7 novembre 2026 · Contexte : boutique digitale Nukhba (`/codes`), livraison à la
commande via FazerCards / Reloadly, paiement NOWPayments ou carte téléphonique.

> **En une phrase :** le badge « Livré » ne prouve rien à lui seul. Une livraison est
> établie quand **trois faits** sont vrais en même temps — paiement encaissé, code reçu
> et enregistré, client capable de voir ce code — puis confirmée par un quatrième :
> **le code a été utilisé sans contestation**.

---

## 1. Les trois preuves, et où elles vivent

| Preuve | Où la lire | Champ / écran | Ce que ça ne prouve **pas** |
|---|---|---|---|
| Paiement encaissé | Admin `/admin/orders` · table `orders` | `status = paid` | que le code existe |
| Code reçu et stocké | Admin `/admin/digital/orders` · table `digital_orders` | `codes_cipher` non vide, `delivered_at` | que le code est valide chez le fournisseur |
| Code remis au client | Même écran + e-mail | `email_sent_at`, `email_provider_id`, page `/codes/commande` | que le client l'a **lu** (spam, adresse erronée) |
| Code **utilisé** | Tableau du fournisseur / retour client | rachat réussi | — c'est la preuve finale |

Deux cas légitimes à ne pas confondre avec un échec :

- **recharge de jeu** (`kind = game_topup`) : le crédit part sur le compte du joueur,
  **aucun code n'est attendu** ;
- **paiement par carte téléphonique** (`phone_card_payments`) : la carte est vérifiée
  **à la main** avant toute livraison, la commande reste donc en attente un moment.

---

## 2. Niveau 1 — l'admin (30 secondes)

1. Ouvrir `/admin/digital/orders`.
2. Repérer la référence `DGC-…` (majuscules, 12 caractères hexadécimaux).
3. Ouvrir la ligne et lire, dans l'ordre :

| Ce que tu vois | Interprétation |
|---|---|
| Badge **Livré** + section « Codes livrés (n) » avec n ≥ 1 | code bien enregistré |
| « Livrée le » renseigné | date de livraison en base |
| « E-mail codes » : date + `message : re_…` | e-mail **accepté** par le fournisseur, avec identifiant de message |
| Bandeau rouge **« E-mail non envoyé : … »** | code livré, e-mail jamais parti → **le client ne sait rien** |
| Bandeau orange **« Motif : … »** | dernière erreur fournisseur (solde, plafond, produit non relié) |
| Badge **Payé — livraison en cours** | encaissé, pas encore livré → à traiter |
| Badge **Livré** mais « Codes livrés » absent | incohérence : faux positif du statut |

Actions disponibles sur la même ligne : **Renvoyer l'e-mail**, **livrer manuellement**
(saisie des codes achetés chez le fournisseur), **clôturer sans code** (recharges de jeu).

---

## 3. Niveau 2 — la commande (10 secondes, reproductible)

```bash
npm ci                      # une seule fois
npm run delivery:check -- DGC-XXXXXXXXXXXX
npm run delivery:check -- --audit --days=30    # bilan, toutes les commandes
npm run delivery:check -- DGC-… --json         # sortie machine (CI, tableau de bord)
```

Le script affiche la base réellement interrogée (hôte), le produit, le paiement lié,
l'état des codes, la date de livraison, l'e-mail (date + identifiant de message),
puis un **verdict** et les actions à faire. Il ne divulgue jamais un code ni une
adresse e-mail complète.

| Code de sortie | Signification |
|---|---|
| `0` | livré (ou audit sans incident) |
| `1` | payé non livré, échec, ou référence introuvable |
| `2` | `DATABASE_URL` absente / base injoignable |

⚠️ Le script lit `DATABASE_URL` de `l'environnement`, puis `.env.local`, puis `.env`.
Si `.env.local` pointe une **Preview**, tu inspectes une autre base que la production :
la ligne « Base : … » est là pour ça. Comparer production et preview est le piège n°1.

Fichiers : [`scripts/check-delivery.mjs`](../scripts/check-delivery.mjs) (CLI),
[`scripts/delivery-check-core.mjs`](../scripts/delivery-check-core.mjs) (règles),
[`scripts/delivery-check.test.mjs`](../scripts/delivery-check.test.mjs) (tests).

---

## 3 bis. Où lancer la commande (dépôt sur GitHub, pas de terminal familier)

Le dépôt est public : `https://github.com/walidhamrit-blip/mon-site`, branche
`arena/97cdd8ce-mon-site` (le script n'est pas encore sur `main`).

### A. Aucun terminal — éditeur SQL de Neon (2 minutes)

1. `console.neon.tech` → le projet de production → **SQL Editor**.
2. Coller la requête n°1 du §5 ci-dessous, en remplaçant la référence.
3. Lire la ligne : `carte_statut = approved`, `payment_status = paid`,
   `status = manual`, `delivered_at` vide ⇒ **payé, non livré** (normal).

C'est le chemin le plus court quand on veut juste une réponse.

### B. Terminal minimal — sans cloner le projet (5 minutes)

Prérequis : **Node.js ≥ 22** (nodejs.org). Vérifier : `node --version`.

```bash
mkdir verif-livraison && cd verif-livraison
curl -fsSLO https://raw.githubusercontent.com/walidhamrit-blip/mon-site/arena/97cdd8ce-mon-site/scripts/check-delivery.mjs
curl -fsSLO https://raw.githubusercontent.com/walidhamrit-blip/mon-site/arena/97cdd8ce-mon-site/scripts/delivery-check-core.mjs
npm install --no-save --package-lock=false pg      # seule dépendance : pg
echo 'DATABASE_URL="postgresql://…?sslmode=require"' > .env.local
node check-delivery.mjs DGC-XXXXXXXXXXXX
```

Aucun `npm ci`, aucun Next.js : le script ne dépend que de `pg` (le chargement
de `.env.local` est intégré).

Sous **Windows PowerShell** (pas `cmd`) :

```powershell
New-Item -ItemType Directory verif-livraison; Set-Location verif-livraison
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/walidhamrit-blip/mon-site/arena/97cdd8ce-mon-site/scripts/check-delivery.mjs" -OutFile check-delivery.mjs
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/walidhamrit-blip/mon-site/arena/97cdd8ce-mon-site/scripts/delivery-check-core.mjs" -OutFile delivery-check-core.mjs
npm install --no-save --package-lock=false pg
Set-Content .env.local 'DATABASE_URL="postgresql://…?sslmode=require"'
node check-delivery.mjs DGC-XXXXXXXXXXXX
```

### C. Clone complet (si tu travailles déjà sur le dépôt)

```bash
git clone https://github.com/walidhamrit-blip/mon-site.git
cd mon-site
git switch arena/97cdd8ce-mon-site     # le script n'existe pas encore sur main
npm ci                                 # installation complète (~1 min)
echo 'DATABASE_URL="postgresql://…?sslmode=require"' >> .env.local
npm run delivery:check -- DGC-XXXXXXXXXXXX
```

### D. Depuis un navigateur ou une tablette

GitHub → onglet **Code** → **Codespaces** → *New codespace* sur la branche
`arena/97cdd8ce-mon-site`, puis dans le terminal du Codespace : `npm ci`,
`.env.local`, `npm run delivery:check -- …`. Neon est joignable depuis un
Codespace (contrairement à l'agent Arena, dont la sortie réseau est limitée).

### Règles à respecter

- **La chaîne `DATABASE_URL` est un secret** (elle contient le mot de passe de la
  base). Elle va dans `.env.local`, fichier **déjà ignoré par Git** — jamais dans
  un commit, une capture d'écran partagée ou une conversation.
- Lancer la commande à la racine du dossier qui contient `.env.local`.
- Le script est **en lecture seule** (uniquement des `SELECT`) : il ne peut rien
  modifier dans la base.
- Il n'affiche ni code cadeau, ni adresse e-mail complète, ni mot de passe.

---

## 4. Niveau 3 — côté client (le seul test qui compte vraiment)

Demander au client d'ouvrir le lien reçu après paiement :

```
https://nokhba.net.ly/codes/commande?ref=DGC-…&t=<jeton>
```

- Si la page affiche **« Livré » + le(s) code(s)**, la remise est effective.
- Si la page répond **« introuvable »**, ce n'est **pas** la preuve d'une non-livraison :
  sans jeton valide, l'API renvoie volontairement 404 (anti-énumération des références).
  Le jeton est le seul secret qui ouvre la commande, et seul son **hash** est en base.
- **Jeton perdu** (nouvel appareil, e-mail égaré) : le client a de toute façon les codes
  dans l'e-mail « 🎁 Vos codes … » ; sinon, utiliser **Renvoyer l'e-mail** dans
  `/admin/digital/orders`, ou transmettre le code depuis la fiche admin.
  Limite connue : il n'existe pas de bouton qui **régénère** le lien `/codes/commande`
  (le bouton « Lien de suivi » de `/admin/orders` régénère le lien de la commande de
  site `/pay/success`, pas celui des codes).

**Preuve finale** : le client utilise le code. S'il dit qu'il ne fonctionne pas,
demander une capture d'écran du message du fournisseur (remplacement sous 48 h prévu
par la politique de vente) — un code « livré » peut être expiré, mal régionnalisé ou
déjà utilisé.

---

## 4 bis. Cas particulier — carte téléphonique **acceptée** : le code n'est pas livré

C'est le piège le plus fréquent, et il est **volontaire** dans le code : accepter une
carte de recharge ne déclenche aucun achat. L'approbation fait exactement trois choses
(`reviewPhoneCardPayment`, `src/lib/phone-card-payments.ts`) :

| Effet de l'approbation | Valeur |
|---|---|
| Vérification de la carte | `phone_card_payments.status = approved`, `reviewed_at`, note |
| Paiement de la commande | `orders.status = paid`, `ipn_status = phone_card_approved` |
| Commande digitale | `digital_orders.status = manual`, `fulfillment = manual` |

Ce qui n'est **pas** fait, et qu'il ne faut pas attendre :

- ❌ **aucun achat** chez le fournisseur — le statut est `manual` justement pour que le
  cron de reprise (`RESUME_STATUSES = pending, paid`) ne l'achète jamais tout seul ;
- ❌ **aucun e-mail avec code** — le client n'a reçu que « ⏳ Paiement reçu », il attend ;
- ❌ **pas de bouton « Relancer la livraison »** sur une commande carte téléphonique
  (il est masqué pour ce moyen de paiement) : la seule voie est la saisie manuelle.

### Les 5 gestes, dans cet ordre

1. **Acheter le code** chez le fournisseur (FazerCards), au montant, à la région et à la
   devise de la commande — solde marchand suffisant, montant sous le plafond.
2. **Saisir le code** : `/admin/digital/orders` → la ligne de la commande (badge
   **« À livrer manuellement »**) → **« Saisir les codes manuellement »**.
   Format : un code par ligne, `numéro | PIN | URL d'activation` (comme livré par le
   fournisseur), autant de lignes que la quantité commandée.
3. **« Enregistrer et envoyer au client »** → le code est chiffré, la commande passe
   `delivered`, `delivered_at` est posé, l'e-mail part et son verdict est journalisé.
4. **Contrôler la ligne** : badge **Livré**, « Codes livrés (n) », « E-mail codes » avec
   une date et un `message : re_…`. Un bandeau rouge « E-mail non envoyé » ⇒
   **Renvoyer l'e-mail**.
5. **Confirmer** : `npm run delivery:check -- <REF>` doit répondre **✅ LIVRÉ**, et le
   client doit voir son code sur `/codes/commande` (ou dans l'e-mail).

### Variantes

- **Recharge de jeu (`game_topup`)** : aucun code n'existe. Créditer le **Player ID**
  affiché dans la fiche, puis **« Clôturer sans code »** — le client reçoit « recharge
  créditée ».
- **Carte refusée** : la commande passe `failed`, aucun code ne doit être acheté ;
  prévenir le client avec le motif.
- **Code refusé par le fournisseur** (déjà utilisé, mauvaise région) : réacheter et
  **relivrer** ; le client garde l'ancien e-mail, l'envoyer explicitement en précisant
  le remplacement.
- **Annulation** : impossible une fois `delivered` — la vérification refuse de modifier
  le paiement d'une commande livrée.

### Ce que dit désormais le script

| Situation | Verdict |
|---|---|
| carte en attente de vérification | ⚠️ `phone_card_unverified` — livraison verrouillée |
| carte acceptée, aucun code saisi | ❌ `phone_card_approved_not_delivered` — acheter puis saisir |
| carte refusée | ❌ `phone_card_rejected` — ne rien livrer |
| carte acceptée **et** code livré | ✅ `delivered` |
| livré hors système (WhatsApp…) | ✅ `off_platform_delivered` |
| livré hors système mais e-mail non parti | ⚠️ `off_platform_no_email` |

---

## 4 ter. Cas particulier — code transmis **hors du site** (WhatsApp)

Beaucoup de ventes se concluent sur WhatsApp : on achète la carte chez le fournisseur et
on l'envoie directement. Jusqu'ici la commande restait « À livrer manuellement » à vie,
la page de suivi affichait « code en cours de préparation » et le client ne recevait
aucune preuve écrite.

Nouveau geste dans `/admin/digital/orders` : **« Livré hors système (WhatsApp…) »**,
disponible dès que la commande n'a **aucun code enregistré** (et que la carte
téléphonique, s'il y en a une, est acceptée). Il demande :

| Champ | Rôle |
|---|---|
| **Canal utilisé** | WhatsApp, appel téléphonique, e-mail direct, autre — obligatoire |
| **Note interne** (facultatif, 300 car.) | justificatif : « envoyé au 091… à 21:40 ». **Jamais envoyée au client** |

Ce que l'action fait, dans l'ordre :

1. passe la commande en **Livré** (`delivered`, `delivered_at`) et mémorise
   `delivery_channel` + `delivery_note` ;
2. **régénère le jeton de suivi** — l'ancien lien cesse de fonctionner, le nouveau part
   dans l'e-mail ;
3. envoie au client un e-mail **« Commande livrée »** : produit, date, canal, lien de
   suivi — **sans le code** (il l'a déjà reçu) ;
4. la page `/codes/commande` affiche désormais « Commande livrée via WhatsApp… » au lieu
   d'une page « Livré » vide.

Garde-fous : refus si la commande est déjà livrée, si elle contient déjà des codes
(utiliser « Renvoyer l'e-mail »), ou si une carte téléphonique n'est pas encore acceptée.
Le code n'est **jamais** stocké par ce chemin.

> Pourquoi ne pas saisir le code reçu par WhatsApp ? C'est possible et préférable quand
> on l'a encore : le client garde alors un code consultable sur `/codes/commande`. Le
> marquage « hors système » sert quand le code n'est plus disponible ou ne doit pas être
> dupliqué.

**Raccourcis depuis la zone « Cartes téléphoniques à vérifier »** (haut de page) : une
carte acceptée affiche deux boutons — **« Ouvrir la commande »** (déplie la bonne ligne
plus bas) et **« Code déjà envoyé (WhatsApp…) »** (ouvre directement le formulaire). La
ligne du tableau des commandes est elle-même entièrement cliquable ; le lien est aussi
partageable sous la forme `…/admin/digital/orders#commande-DGC-…` (ajouter `?hors=1`
pour ouvrir le formulaire).

---

## 5. Niveau 4 — SQL direct (admin indisponible, audit, incident)

> **Copier-coller :** dans certains éditeurs (Notion, Slack, messageries), `o.codes_cipher`
> devient un lien cliquable — `o.codes` est un vrai domaine — et la requête ne passe plus.
> Utiliser [`docs/sql/verifier-une-livraison.sql`](./sql/verifier-une-livraison.sql)
> (alias en majuscules, une requête par étape) ou coller en texte brut
> (`Ctrl+Shift+V`). Vider l'éditeur SQL avant de coller ne supprime **aucune donnée** :
> ces requêtes sont en lecture seule.

```sql
-- 1. Fiche complète d'une commande (carte téléphonique incluse)
select o.ref, o.status, o.fulfillment, o.kind,
       o.product_title, o.denomination_label, o.quantity, o.total_usd,
       o.created_at, o.delivered_at,
       (o.codes_cipher is not null) as codes_stockes,
       o.email_sent_at, o.email_provider_id, o.email_last_error,
       o.delivery_channel, o.delivery_note,
       o.attempts, o.last_error,
       o.reloadly_status, o.reloadly_transaction_id,
       p.ref as payment_ref, p.status as payment_status, p.payment_method,
       pc.status      as carte_statut,     -- pending | approved | rejected
       pc.reviewed_at as carte_verifiee_le,
       pc.review_note as carte_note
  from digital_orders o
  left join orders p on p.digital_order_id = o.id
  left join phone_card_payments pc on pc.order_ref = o.ref
 where upper(o.ref) = upper('DGC-XXXXXXXXXXXX');

-- 2. Payées non livrées depuis plus de 30 minutes (à traiter aujourd'hui)
select ref, status, product_title, total_usd, created_at, attempts, last_error
  from digital_orders
 where status in ('paid', 'manual')
   and created_at < now() - interval '30 minutes'
 order by created_at;

-- 3. Codes livrés mais e-mail jamais accepté (client non prévenu)
select ref, recipient_email, delivered_at, email_last_error
  from digital_orders
 where status = 'delivered'
   and email_sent_at is null
 order by delivered_at desc nulls last;

-- 4. « Livré » sans aucun enregistrement de code (hors recharges de jeu)
select ref, kind, product_title, delivered_at
  from digital_orders
 where status = 'delivered'
   and codes_cipher is null
   and kind <> 'game_topup';

-- 5. Cartes téléphoniques en attente de vérification manuelle
select ref, status, created_at from phone_card_payments
 where status <> 'approved' order by created_at;
```

Les codes sont **chiffrés** (`AES-256-GCM`) : une requête SQL ne les montre pas, et
c'est voulu. Sans `DIGITAL_CODES_SECRET` (ou `SESSION_SECRET` d'origine), ils sont
illisibles — d'où le `npm run codes:rotate` après tout changement de secret.

---

## 6. Niveau 5 — le fournisseur

- `reloadly_status` et `reloadly_transaction_id` = la commande existe-t-elle **chez le
  fournisseur** ? Un code en base sans transaction fournisseur est suspect.
- Vérifier le **solde marchand** et le plafond par commande (au-delà du plafond, la
  commande bascule volontairement en livraison manuelle).
- Vérifier le **statut IPN NOWPayments** : une commande restée `pending` malgré un
  paiement visible côté client signale un IPN non reçu (URL IPN, secret).

---

## 7. Arbre de décision

| Constat | Verdict | Action |
|---|---|---|
| `delivered` + codes + `email_sent_at` | livré | demander confirmation d'utilisation au client |
| `delivered` + codes + `email_last_error` | livré, client non prévenu | « Renvoyer l'e-mail », tester le canal (SPF/DKIM) |
| `delivered` + `codes_cipher` null + hors recharge | incohérent | livrer manuellement le code réel |
| `paid` / `manual` depuis > 30 min | non livré | acheter le code, livrer, prévenir si délai |
| `pending` | non payé | ne rien acheter ; vérifier l'IPN |
| `failed` | échec fournisseur | livrer à la main ou rembourser |
| `game_topup` + `delivered` | livré (sans code) | confirmer le crédit côté fournisseur |
| carte téléphonique non `approved` | en attente | accepter/refuser la carte dans l'admin |
| carte `approved` + commande `manual` sans code | **non livré** | acheter le code puis le saisir (§4 bis) |

---

## 8. Les pièges classiques

1. **Statut forcé** : `delivered` sans code enregistré **et sans canal** → le client ne
   voit rien. (Avec `delivery_channel` renseigné, c'est une livraison hors système
   assumée, pas une anomalie.)
2. **« Envoyé » ≠ « reçu »** : `email_sent_at` signifie *accepté par Resend/SMTP*.
   Domaine non vérifié, SPF/DKIM absents ou spam : l'e-mail est perdu après acceptation.
3. **Identifiant de message absent** : anciens envois SMTP sans accusé ; ce n'est pas
   une preuve d'échec, mais ce n'est pas non plus une preuve de remise.
4. **Clé de chiffrement changée** : `SESSION_SECRET` renouvelé sans
   `DIGITAL_CODES_SECRET` → codes présents mais illisibles (`npm run codes:rotate`).
5. **Mauvaise base** : `.env.local` en preview, ou requête sur la base de test.
6. **Référence mal saisie** : toujours en majuscules `DGC-…`, sinon introuvable.
7. **404 sur `/codes/commande`** : absence de jeton, pas absence de livraison.
8. **Recharge de jeu** : pas de code attendu — ne pas « corriger » ce cas.
9. **Carte téléphonique** : livraison verrouillée jusqu'à validation manuelle.

---

## 9. Routine recommandée

| Fréquence | Geste | Temps |
|---|---|---|
| À chaque vente | `npm run delivery:check -- <REF>` ou la ligne admin | 30 s |
| Chaque matin | `npm run delivery:check -- --audit --days=7` | 1 min |
| Chaque semaine | requêtes SQL 2 et 3 (commandes bloquées, e-mails en échec) | 5 min |
| Après incident | vérifier la clé de chiffrement et rejouer l'audit sur 30 jours | 15 min |

Le cron applicatif (`/api/cron/digital-orders`, `vercel.json`) relance les livraisons
payées ; **il ne remplace pas** ce contrôle humain : une commande peut être payée,
relancée et rester bloquée pour une raison métier (solde, plafond, produit non relié).

---

## 10. Références dans le code

- `src/lib/digital-orders.ts` — flux paiement → livraison → e-mail, suivi public.
- `src/lib/digital-order-core.ts` — statuts (`pending`, `paid`, `manual`, `delivered`,
  `failed`) et règles de réconciliation.
- `src/lib/digital-email-log.ts` — écriture du verdict e-mail sur la commande.
- `src/app/admin/(panel)/digital/orders/` — écran d'exploitation.
- `src/app/(site)/codes/commande/` — suivi client protégé par jeton.
- `scripts/check-delivery.mjs` — vérification en ligne de commande (cette fiche).
