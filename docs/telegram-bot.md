# Bot Telegram — connexion au site, commandes et marketing

> **En une phrase** : le bot Telegram est un **canal de plus** pour le site.
> Il prévient l'équipe à chaque demande ou paiement, il permet au client de
> suivre sa commande, et il envoie les campagnes marketing aux abonnés qui
> ont donné leur accord. Le site continue de fonctionner exactement pareil
> si Telegram est absent ou en panne.

Tout se pilote depuis **`/admin/telegram`** (menu *Contenus & Réglages →
Bot Telegram*).

---

## 1. Ce dont vous avez besoin

| Élément | Où le trouver | Obligatoire |
|---|---|---|
| **Jeton du bot** (`123456789:AA…`) | Telegram → `@BotFather` → `/newbot` | oui |
| **Chat id des alertes** | `getUpdates` (voir §2.3) ou le script fourni | recommandé |
| **URL publique du site** | `SITE_URL` sur Vercel (ex. `https://nokhba.net.ly`) | oui |

> ⚠️ Le jeton est un **mot de passe** : il donne le contrôle total du bot.
> Il vit uniquement dans les variables d'environnement du serveur. Ne le
> collez jamais dans un fichier du dépôt, dans un ticket, un message ou une
> capture d'écran.

---

## 2. Mise en route (3 minutes)

### 2.1 Créer le bot

1. Dans Telegram, ouvrez **@BotFather** → `/newbot`.
2. Donnez un nom (« Nukhba ») puis un identifiant terminé par `bot`
   (`nukhba_shop_bot`).
3. BotFather répond avec le **jeton**. Copiez-le.
4. Facultatif mais utile : `/setdescription`, `/setabouttext`, `/setuserpic`.

### 2.2 Coller le jeton sur Vercel

1. Vercel → votre projet → **Settings → Environment Variables**.
2. Ajoutez, pour l'environnement **Production** (et *Preview* si vous testez) :

   ```
   TELEGRAM_BOT_TOKEN       = 123456789:AA...
   TELEGRAM_ADMIN_CHAT_ID   = (voir 2.3)
   TELEGRAM_BOT_USERNAME    = nukhba_shop_bot   # jamais de préfixe NEXT_PUBLIC_
   ```

3. **Redeploy** (les variables ne sont lues qu'au démarrage d'une fonction).

En local : `cp .env.example .env.local`, remplissez, puis `npm run dev`.

### 2.3 Trouver le chat id des alertes

**Méthode simple** — envoyez n'importe quel message (ou `/start`) au bot,
puis lancez :

```bash
npm run telegram:check        # affiche le bot, les chat id détectés, le webhook
```

La sortie liste par exemple `chat id = 654321987 (Nukhba)`. Collez cette
valeur dans `TELEGRAM_ADMIN_CHAT_ID`.

**Pour un groupe** (toute l'équipe reçoit les alertes) : créez un groupe,
ajoutez-y le bot, écrivez un message dans le groupe, relancez
`npm run telegram:check` — l'id est négatif (`-100…`), c'est normal.

### 2.4 Installer le webhook

`/admin/telegram` → bouton **« Installer le webhook »**.

Ce bouton :
1. génère un secret aléatoire de 32 octets (aucun secret à inventer),
2. le stocke dans la table `settings` (clé `telegram_webhook_secret`),
3. déclare `https://<votre-site>/api/telegram-webhook` chez Telegram avec ce
   secret (l'ancienne adresse `/api/telegram/webhook` reste valable : les
   deux URLs pointent le même gestionnaire via une rewrite),
4. publie le menu des commandes (`/start`, `/shop`, `/codes`, …).

Équivalent en ligne de commande :

```bash
npm run telegram:check -- --webhook https://nokhba.net.ly
```

(Le script affiche le `TELEGRAM_WEBHOOK_SECRET` à recopier dans Vercel si
vous préférez gérer le secret par variable d'environnement.)

### 2.5 Vérifier

- `/admin/telegram` : les trois pastilles sont vertes (**Jeton**, **Chat des
  alertes**, **Webhook**).
- Bouton **« Envoyer un test »** → un message arrive dans Telegram.
- Envoyez `/start` au bot → il répond avec le menu.

---

## 3. Ce que le bot fait pour les clients

| Action du client | Réponse du bot |
|---|---|
| `/start` (première visite) | Bienvenue + **choix de la langue** : 🇬🇧 English / 🇱🇾 العربية |
| `/start` (déjà venu) | Menu dans la langue enregistrée |
| `/shop`, `/codes` ou bouton **🛒 Boutique** | Boutique inline : familles → produits (avec prix) → montants → **lien de paiement** |
| Appuie sur **Catalogue** | Lien vers `/codes` |
| `/commande DGC-…` (ou colle la référence seule) | Statut, produit, montant, date, lien de suivi |
| `/prevenir DGC-…` (ou « recevoir aussi le code sur Telegram ») | Consentement à recevoir **ce code** dans le chat ; envoi automatique à la livraison |
| Appuie sur **Offres** → *Oui* | Consentement marketing enregistré |
| `/stop` | Retrait du consentement (immédiat) |
| `/langue` | Change la langue du bot (bilingue 🇬🇧 / 🇱🇾) |
| « humain », « agent », « support » | Coordonnées WhatsApp/e-mail + **message transféré à l'équipe** |
| Toute autre question | Aide + message transféré à l'équipe |

### La boutique inline (`/shop`)

Navigation **dans le même message** (chaque clic appelle `editMessageText`,
rien ne s'empile) :

```
🛒 Boutique
  ├─ 🎁 Cartes cadeaux
  │     ↓
  │   Types de carte — « أمازون · Amazon (5) · ستيم · Steam (4)… »
  │     (marque dérivée du nom fournisseur : « Amazon (US) », « Amazon
  │      (FR) »… regroupés sous « Amazon » ; noms arabes à côté)
  │     ↓
  │   Régions — « أمازون أمريكا (3) · أمازون فرنسا (2)… » + « كل المناطق »
  │     + légende : « 🗺️ MENA = الشرق الأوسط وشمال إفريقيا — الخليج،
  │      مصر، الأردن، لبنان، المغرب العربي », « 🗺️ GLOBAL = عالمية »…
  │     ↓
  │   Produits de la marque/région — « à partir de $11.50 », 8 par page
  ├─ 🎮 Recharges de jeux (8)      ┐ liste plate
  ├─ 🔑 Clés logiciels (5)         │ (fournisseur → fiche web si
  └─ 📺 Codes d'abonnement (3)     ┘ champs acheteur)
        ↓
  Montants disponibles — « $10 · $11.50 » sur chaque bouton
        ↓
  Détails & quantité (➖/➕) → ✅ Acheter
        ↓
  ✅ Commande créée — DGC-…
     💳 Payer maintenant (facture crypto NOWPayments)
     💳 Payer par carte — LA MÊME commande bascule vers Visa/Mastercard
        (masqué sous le minimum carte du réglage admin)
     🏦 Other methods — Skrill / carte de recharge → fiche web
     📩 Recevoir le code dans ce chat (consentement explicite — la
        confirmation arrive dans un message séparé, la facture reste
        affichée et payable dans n'importe quel ordre)
```

Points clés :

- **Caisse identique au site (FazerCards)** : le bot vend exactement ce que
  la boutique web vend — mêmes fiches (fournisseur actif uniquement, les
  fiches de l'ancien fournisseur retiré sont exclues), prix recalculés côté
  serveur via `createFazercardsCheckout`, facture crypto NOWPayments.
- **E-mail de livraison exigé et modifiable** : à la première commande, le
  bot demande l'e-mail, le mémorise dès validation (même si un garde-fou
  bloque la facture), l'affiche sur l'écran du montant et permet de le
  changer en un clic (`✉️`). Jamais d'adresse inventée.
- **Plancher & plafond gérés avant l'e-mail** : si un petit montant unitaire
  (ex. `1 AED` à `1,18 $`) est sous le plancher crypto (`1,50 $`), la
  quantité initiale se cale automatiquement sur `×2` avec explication et
  bouton d'achat direct ; au-dessus du plafond automatique (`maxOrderUsd`),
  un bouton WhatsApp pré-rempli est proposé immédiatement.
- **Sortie propre en cas d'indisponibilité** : si le solde fournisseur ou la
  passerelle NOWPayments bloque, l'état `pending` est nettoyé (le client
  n'est jamais bloqué en mode saisie d'e-mail), et le message offre un
  bouton WhatsApp pré-rempli avec le produit exact + le lien vers la fiche
  web (autres moyens de paiement).
- **Diagnostic dans `/admin/telegram` + alerte admin** : les 25 derniers
  refus/incidents de caisse sont journalisés dans `/admin/telegram` avec la
  cause exacte (`below_minimum`, `above_limit`,
  `supplier_balance_insufficient`, `payment_gateway_error`…), et tout
  incident d'exploitation envoie une alerte immédiate sur `TELEGRAM_ADMIN_CHAT_ID`.
- **Identité Telegram sur la commande** : chaque commande créée depuis le
  bot enregistre le `chat_id` et le `@username` du client sur les tables
  `orders` et `digital_orders` (visibles dans `/admin/digital/orders`) —
  l'équipe sait à qui elle parle pour le suivi et la livraison.
- **Produits à champs acheteur** (recharges avec identifiant joueur…) :
  pas de vente « à l'aveugle » dans le chat — le bot renvoie vers la fiche
  web, où le formulaire complet et tous les moyens de paiement existent.
- **Anti-spam** : une facture NOWPayments par minute et par chat au maximum.

Garde-fous :

- les codes ne partent dans le chat **que si le client l'a demandé** pour
  cette commande précise (`/prevenir` ou bouton de la page de suivi). L'e-mail
  part dans tous les cas : Telegram est un canal de plus, jamais un
  remplacement. Un message contenant des codes est envoyé en texte brut
  (sans `parse_mode`), donc jamais altéré par le balisage ;
- le bot ne renvoie que le statut public : jamais d'e-mail complet, de
  téléphone ni d'adresse crypto ;
- il ne répond que dans les **conversations privées** ; les groupes servent
  uniquement aux alertes internes.

### La vitrine en images (Mini App `/tg`)

Une **Mini App Telegram** affiche le vrai catalogue du site sous forme de
vitrine visuelle : 4 familles illustrées (cartes cadeaux, recharges de jeux,
clés de jeux & logiciels, codes d'abonnement), filtres par marque, recherche,
grille de jaquettes avec prix « à partir de ». Elle suit la langue (`?lang=ar|en`,
arabe RTL par défaut) et le thème clair/sombre de Telegram.

- **Accès** : bouton « 🛍️ افتح المتجر / Open the store » en tête du menu
  principal, bouton « 🖼️ تصفّح المتجر بالصور » en tête de `/shop`, et le
  **bouton ☰ du champ de saisie** (« 🛍️ المتجر · Store »), publié via
  `setChatMenuButton` à chaque **Installer le webhook** du panneau admin.
- **Achat** : un produit ouvre sa fiche `/codes/<slug>` (avec
  `utm_source=telegram&utm_medium=mini_app`) : prix, champs joueur et
  paiement restent ceux du site — aucune logique de caisse dupliquée.
- **Prérequis** : `NEXT_PUBLIC_SITE_URL` en **HTTPS** (exigence Telegram).
  Sans HTTPS, les boutons Mini App ne sont simplement pas affichés.
- **Alternative manuelle** : @BotFather → `/mybots` → bot → *Bot Settings* →
  *Menu Button* → URL `https://nokhba.net.ly/tg`.
- Visuels des familles : `public/telegram-mini-app/*.webp`.

> **ar —** واجهة متجر مصوّرة داخل تيليجرام على الرابط `/tg`: الفئات بالصور،
> البحث، والعلامات التجارية. الضغط على منتج يفتح صفحته في الموقع لإتمام الدفع.
> تُفتح من زر « افتح المتجر » أو من زر القائمة ☰ بجانب خانة الكتابة.

### Lien à partager

`https://t.me/<bot>?start=site`

Le paramètre `start` est enregistré comme **source d'acquisition** :
`site`, `instagram-bio`, `carte-visite`… vous saurez d'où viennent les
abonnés. Le pied de page du site affiche automatiquement « Telegram ↗ » dès
que `TELEGRAM_BOT_USERNAME` est défini (lu côté serveur, sans préfixe
`NEXT_PUBLIC_` : Vercel avertit — à raison — dès qu'une variable publique
pourrait exposer un secret).

### « Continuer sur Telegram » depuis le site (un lien par rayon)

Dès que `TELEGRAM_BOT_USERNAME` est défini, le site affiche un raccourci vers la
**boutique du bot, ouverte directement sur le bon rayon** :

| Lien | Effet dans le bot |
|---|---|
| `t.me/<bot>?start=shop-ar` | boutique (racine), en arabe |
| `t.me/<bot>?start=shop-ar-gift_card` | rayon « بطاقات هدايا » |
| `t.me/<bot>?start=shop-en-software_key` | rayon « Game & software keys », en anglais |

- la langue de la page sert pour un nouvel arrivant (pas d'écran de langue) ;
  un client existant garde la langue qu'il a choisie ;
- emplacements : sous-menu « المنتجات الرقمية » (icône par rayon + bouton),
  bouton Telegram de l'en-tête boutique, bandeau et présentation du bot sur
  `/codes` (suit le filtre actif) et sur chaque `/codes/category/<kind>` ;
- mesure : événement Vercel `telegram_click` (`source` = emplacement,
  `kind` = rayon) ; côté bot, le `start` est enregistré comme source
  d'acquisition (`shop-ar-gift_card`…) ;
- code : `src/lib/telegram-links.ts` (liens, lecture du `start`),
  `src/components/telegram-shop-cta.tsx` (affichage),
  `openTelegramShopCategory` (`src/lib/telegram-shop.ts`).

---

## 4. Alertes de commandes (le côté « commandes »)

Aucune configuration supplémentaire : dès que `TELEGRAM_BOT_TOKEN` et
`TELEGRAM_ADMIN_CHAT_ID` sont présents, l'équipe reçoit en direct :

| Événement | Déclencheur dans le code | Contenu |
|---|---|---|
| Nouvelle demande / devis | `src/app/api/lead/route.ts` → `notifyTelegramLead` | Nom, téléphone, e-mail, besoin, budget, message, UTM |
| Paiement confirmé | `src/lib/order-emails.ts` → `notifyTelegramPayment` (web, abonnements **et** digital) | Référence, formule, montant USD + crypto, tranche, client |
| Campagne envoyée | journal `telegram_campaigns` | Nombre d'envois / échecs |

Chaque alerte contient un bouton direct vers **`/admin/orders`** ou
**`/admin/leads`** : vous traitez depuis le téléphone.

Principes :

- envoi **« au mieux »** (délai max 4 s) : une panne Telegram ne fait jamais
  échouer un formulaire, un paiement ni une livraison ;
- l'alerte part **avant** le test du destinataire e-mail : même sans
  `LEAD_NOTIFICATION_EMAIL`, vous êtes prévenu ;
- les messages d'un client qui écrit au bot sont **transférés** dans le chat
  d'administration avec son `chat id` — vous pouvez lui répondre depuis le
  site (`/admin/leads`) ou WhatsApp.

---

## 5. Marketing (campagnes)

1. Les clients deviennent abonnés en ouvrant le bot ; ils deviennent
   **opt-in** en appuyant sur **Offres & promos → Oui, recevoir les offres**.
2. `/admin/telegram` → **Nouvelle campagne** :
   - « Nom interne » = nom + slug UTM (`black-friday-2026`) ;
   - message libre (5–3000 caractères) ;
   - **Préparer** puis **Confirmer l'envoi** (double validation).
3. Le texte part avec une signature et un lien
   `/codes?utm_source=telegram&utm_medium=bot&utm_campaign=<slug>` : les
   ventes sont attribuées dans les rapports du site.

Détails techniques :

- envoi par lots de 20 avec 1,1 s de pause (limite Telegram ≈ 30 msg/s) ;
- plafond de 400 destinataires par envoi (durée max d'une fonction Vercel) ;
  relancez la campagne pour la suite si l'audience grandit ;
- un client qui a bloqué le bot est marqué `blocked` automatiquement et
  retiré des campagnes — plus jamais relancé ;
- chaque envoi est journalisé (audience, envoyés, échecs) dans
  `telegram_campaigns` et visible dans l'admin.

> **Conformité** : pas de consentement, pas de campagne. Le bot n'écrit
> jamais à quelqu'un qui n'a pas appuyé sur « Oui ». `/stop` est immédiat et
> définitif jusqu'au prochain opt-in.

---

## 6. Variables d'environnement

| Variable | Rôle |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Jeton BotFather. **Obligatoire** pour activer le bot. |
| `TELEGRAM_ADMIN_CHAT_ID` | Chat/groupe des alertes internes. |
| `TELEGRAM_WEBHOOK_SECRET` | Secret du webhook. Vide = généré et stocké en base. |
| `TELEGRAM_BOT_USERNAME` | @username du bot : lien dans l'admin (sans appel réseau) **et** « Telegram ↗ » dans le pied de page. Lu côté serveur. |

Sans `TELEGRAM_BOT_TOKEN`, **rien** n'est envoyé et rien n'est cassé : le
site se comporte comme avant.

---

## 7. Commandes utiles

```bash
npm run telegram:check                       # état : bot, chat ids, webhook
npm run telegram:check -- --webhook https://exemple.com   # installer
npm run telegram:check -- --commands         # publier le menu /start…
npm run telegram:check -- --delete-webhook   # tout débrancher
npm run test:telegram                        # tests noyau + boutique (aucun réseau)
```

---

## 8. Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| « TELEGRAM_BOT_TOKEN absent ou invalide » | variable non ajoutée ou jeton mal copié | recopier le jeton, **redéployer** |
| `/start` sans réponse | webhook non installé | `/admin/telegram` → Installer le webhook |
| Webhook « non installé » après clic | `SITE_URL` absent → URL de webhook locale | renseigner `SITE_URL` sur Vercel |
| `401 invalid_secret` dans les logs | secret régénéré côté admin | réinstaller le webhook (le secret est réémis) |
| `409 Conflict` avec `getUpdates` | un webhook est actif | c'est normal : `getUpdates` ne sert qu'avant le webhook |
| Aucune alerte à la vente | bot non ajouté au groupe | ajouter le bot au groupe, re-vérifier l'id négatif |
| Campagne à 0 destinataire | personne n'a accepté les offres | partager le lien, l'opt-in est volontaire |
| `429 Too Many Requests` | envoi trop rapide | le code limite déjà ; relancer plus tard |

Journal serveur : filtre `[telegram]` dans les logs Vercel.

---

## 9. Sécurité — ce qui est garanti

- **Authentification** : chaque POST sur `/api/telegram-webhook` exige
  l'en-tête `x-telegram-bot-api-secret-token` (comparaison à temps constant,
  chiffrée avant comparaison). Sans secret configuré, la route répond `503`
  — elle n'accepte jamais une mise à jour non authentifiée.
- **Toujours `200`** après authentification : évite les ré-envois Telegram
  en boucle et les messages doublés.
- **Jeton serveur uniquement** : `src/lib/telegram.ts` n'est jamais importé
  par un composant client (`npm run test:telegram` le vérifie).
- **Données minimisées** : pas d'e-mail complet, pas de téléphone, pas
  d'adresse crypto dans les réponses du bot. Les codes ne sont envoyés qu'aux
  chats ayant consenti pour la commande concernée, une seule fois
  (`telegram_order_watches.notified_at`), en texte brut.
- **Pas d'HTML injecté** : tout texte dynamique est échappé ; les campagnes
  partent en texte brut.

- **Mini App `/tg` isolée** : seule cette route autorise le SDK
  `https://telegram.org` (`script-src`) et l'intégration par
  `web.telegram.org` (`frame-ancestors`, sans `X-Frame-Options`). Le reste du
  site garde sa politique inchangée ; la page est `noindex`.

---

## 10. Fichiers concernés

| Fichier | Rôle |
|---|---|
| `src/lib/telegram-core.ts` | Fonctions pures : textes ar/en/fr, claviers, références, composition des campagnes |
| `src/lib/telegram-shop-core.ts` | Boutique inline (pur) : callback courts, vues familles/produits/montants/paiement, e-mail |
| `src/lib/telegram-shop.ts` | Boutique inline (serveur) : catalogue, état par chat, caisse, `editMessageText` |
| `src/lib/telegram.ts` | API Bot, abonnés, campagnes, webhook, alertes |
| `src/lib/telegram-delivery.ts` | Suivi de commande depuis le chat : consentement, envoi des codes, idempotence |
| `src/app/api/telegram/webhook/route.ts` | Réception des mises à jour Telegram (`/api/telegram-webhook` via rewrite) |
| `src/app/api/telegram/webhook/route.ts` (GET) | Diagnostic `{configured, alerts}` |
| `src/app/admin/(panel)/telegram/` | Panneau d'administration + actions serveur |
| `src/db/schema.ts` | `telegram_subscribers` (+ état boutique, e-mail caisse), `telegram_campaigns`, colonnes `telegram_chat_id` / `telegram_username` sur les commandes |
| `scripts/telegram-setup.mjs` | Diagnostic / installation en ligne de commande |
| `scripts/telegram-bot.test.mjs` | Tests du noyau (aucun réseau) |
| `scripts/telegram-shop.test.mjs` | Tests de la boutique inline (aucun réseau) |
| `src/lib/telegram-mini-app-core.ts` | Mini App (pur) : catalogue/catégories, filtres, CSP de `/tg` |
| `src/app/tg/` | Mini App Telegram (page serveur + composant client + styles) |
| `scripts/telegram-mini-app.test.mjs` | Tests Mini App : catalogue, CSP, boutons `web_app` |
