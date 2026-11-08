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
3. déclare `https://<votre-site>/api/telegram/webhook` chez Telegram avec ce
   secret,
4. publie le menu des commandes (`/start`, `/codes`, `/commande`, …).

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
| `/start` | Message de bienvenue + menu (trilingue **ar / fr / en**) |
| Appuie sur **Catalogue** | Lien vers `/codes` |
| `/commande DGC-…` (ou colle la référence seule) | Statut, produit, montant, date, lien de suivi |
| Appuie sur **Offres** → *Oui* | Consentement marketing enregistré |
| `/stop` | Retrait du consentement (immédiat) |
| `/langue` | Change la langue du bot |
| « humain », « agent », « support » | Coordonnées WhatsApp/e-mail + **message transféré à l'équipe** |
| Toute autre question | Aide + message transféré à l'équipe |

Garde-fous :

- les **codes livrés ne passent jamais par Telegram** (ils restent dans
  l'e-mail et la page de suivi protégée par jeton) ;
- le bot ne renvoie que le statut public : jamais d'e-mail complet, de
  téléphone ni d'adresse crypto ;
- il ne répond que dans les **conversations privées** ; les groupes servent
  uniquement aux alertes internes.

### Lien à partager

`https://t.me/<bot>?start=site`

Le paramètre `start` est enregistré comme **source d'acquisition** :
`site`, `instagram-bio`, `carte-visite`… vous saurez d'où viennent les
abonnés. Le pied de page du site affiche automatiquement « Telegram ↗ » dès
que `TELEGRAM_BOT_USERNAME` est défini (lu côté serveur, sans préfixe
`NEXT_PUBLIC_` : Vercel avertit — à raison — dès qu'une variable publique
pourrait exposer un secret).

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
npm run test:telegram                        # tests du noyau (aucun réseau)
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

- **Authentification** : chaque POST sur `/api/telegram/webhook` exige
  l'en-tête `x-telegram-bot-api-secret-token` (comparaison à temps constant,
  chiffrée avant comparaison). Sans secret configuré, la route répond `503`
  — elle n'accepte jamais une mise à jour non authentifiée.
- **Toujours `200`** après authentification : évite les ré-envois Telegram
  en boucle et les messages doublés.
- **Jeton serveur uniquement** : `src/lib/telegram.ts` n'est jamais importé
  par un composant client (`npm run test:telegram` le vérifie).
- **Données minimisées** : pas de codes, pas d'e-mail complet, pas d'adresse
  crypto dans les réponses du bot.
- **Pas d'HTML injecté** : tout texte dynamique est échappé ; les campagnes
  partent en texte brut.

---

## 10. Fichiers concernés

| Fichier | Rôle |
|---|---|
| `src/lib/telegram-core.ts` | Fonctions pures : textes ar/en/fr, claviers, références, composition des campagnes |
| `src/lib/telegram.ts` | API Bot, abonnés, campagnes, webhook, alertes |
| `src/app/api/telegram/webhook/route.ts` | Réception des mises à jour Telegram |
| `src/app/api/telegram/webhook/route.ts` (GET) | Diagnostic `{configured, alerts}` |
| `src/app/admin/(panel)/telegram/` | Panneau d'administration + actions serveur |
| `src/db/schema.ts` | `telegram_subscribers`, `telegram_campaigns` |
| `scripts/telegram-setup.mjs` | Diagnostic / installation en ligne de commande |
| `scripts/telegram-bot.test.mjs` | Tests (aucun réseau) |
