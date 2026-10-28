# Production Vercel — guide d'exploitation

État de référence vérifié le **19/10/2026** (audit depuis l'agent Arena) :
projet Vercel `walid-website/mon-site`, domaine `nokhba.net.ly`,
commit de production `8b4e39e`, `/api/health` → `ok: true`.

Un second passage, **depuis le code uniquement**, a été ajouté le même jour
(§7). Conclusion nuancée : la chaîne fonctionnelle est cohérente et le site
déployé répond correctement, mais le code révèle des points à corriger —
notamment des dépendances à mettre à jour — avant de parler d'un état
« 100 % sans réserve ».

Les corrections de priorité 1 issues de cet audit ont ensuite été
implémentées dans la **PR #22** (§7.5). Tant que cette PR n'est pas fusionnée
sur `main`, la production `8b4e39e` continue d'exécuter l'ancien code.

Ce document est la fiche de référence pour garder la production en bon état :
qui fait quoi, chaque variable d'environnement, et comment vérifier.

---

## 1. La boucle de travail Arena → GitHub → Vercel

```
Agent Arena — code sur une branche arena/…
      ↓ Push + Pull Request GitHub
Vercel Preview — URL temporaire *.vercel.app pour tester (mobile, client…)
      ↓ Fusion de la PR sur main
Vercel Production — nokhba.net.ly mis à jour automatiquement
```

- **L'agent Arena peut** : modifier le code, ouvrir les PR, vérifier le
  statut du déploiement Vercel via GitHub (`gh pr checks`), corriger une
  erreur de build avant fusion, relire `/api/health` en production.
- **Le propriétaire seul peut** (tableau de bord vercel.com) : saisir les
  variables secrètes, gérer le domaine/DNS, cliquer « Redeploy », gérer
  les comptes Neon et NOWPayments.
- 🔒 Ne jamais coller un secret (mot de passe, clé API, token Vercel) dans
  une conversation, un commit ou une issue. `.gitignore` bloque déjà
  `.env` / `.env.*` (sauf `.env.example`, sans valeur réelle).
- 🔐 **Les Preview sont protégées** (Vercel Authentication, constaté le
  19/10/2026) : l'URL `*.vercel.app` demande une connexion Vercel. Connecté
  à votre compte, vous y accédez normalement. Pour montrer un aperçu à un
  client : tableau de bord Vercel → le déploiement → **Share** (lien de
  partage temporaire), ou régler Settings → Deployment Protection.
  La production `nokhba.net.ly` n'est pas concernée : elle est publique.

## 2. Variables d'environnement — une par une

Où : **Vercel → projet `mon-site` → Settings → Environment Variables**,
environnement **Production** coché.
⚠️ Après tout ajout/modification : **Deployments → ⋯ → Redeploy** — un
déploiement déjà en ligne ne relit jamais les nouvelles valeurs.

⚠️ **Ne recopiez pas les secrets de production dans Preview.** Le code lit
les mêmes noms de variables dans chaque environnement : une Preview munie
de la vraie `DATABASE_URL` et de la vraie clé NOWPayments écrirait dans la
base réelle et créerait de vraies factures. Pour tester en Preview :
base séparée + compte/clé sandbox + `NOWPAYMENTS_SANDBOX=true`, et ne pas
définir `SITE_URL` (sinon `src/lib/site-url.ts` envoie retours et IPN vers
le domaine configuré, donc potentiellement vers la production).

### Obligatoires

| Variable | Où l'obtenir | Remarques |
|---|---|---|
| `DATABASE_URL` | Neon / Supabase / Vercel Postgres → chaîne de connexion `postgresql://…?sslmode=require` | Tables `leads`, `settings`, `orders` créées automatiquement au premier chargement |
| `ADMIN_PASSWORD` | À inventer (gestionnaire de mots de passe) | ≥ 10 caractères. Sans elle, `/admin/login` affiche « Variable manquante » |
| `NOWPAYMENTS_API_KEY` | nowpayments.io → Settings → API keys | ⚠️ Clé **production** (`account.nowpayments.io`) ≠ clé **sandbox** — non interchangeables. Ne pas confondre avec le secret IPN |
| `NOWPAYMENTS_IPN_SECRET` | nowpayments.io → Settings → IPN | **Obligatoire en pratique** : secret distinct, utilisé pour signer les IPN. Déclarer aussi l'URL `https://nokhba.net.ly/api/payments/ipn` côté NOWPayments. Le repli du code sur la clé API ne suffit que si NOWPayments signe avec la même valeur |

Prérequis NOWPayments souvent oublié : **Settings → Crypto accounts** —
ajouter au moins une adresse de réception (BTC, USDT-TRC20…), sinon aucun
paiement ne peut être crédité.

### Recommandées

| Variable | Valeur |
|---|---|
| `SESSION_SECRET` | `openssl rand -hex 32` — distinct du mot de passe admin (sinon la session est signée avec `ADMIN_PASSWORD`) |
| `SITE_URL` | `https://nokhba.net.ly`, **Production uniquement**. Le code retombe sur l'origine de la requête puis sur l'URL de `src/lib/config.ts` ; la variable rend les retours/IPN déterministes |
| `NOWPAYMENTS_CURRENCY` | `usd` (valeur par défaut du code ; la LYD n'est pas supportée par NOWPayments) |

### Optionnelles

| Variable | Rôle |
|---|---|
| `NOWPAYMENTS_SANDBOX` | Vide/`false` en production réelle. `true` **uniquement** avec une clé sandbox (mélange = `403 INVALID_API_KEY`) |
| `NOWPAYMENTS_EMAIL` / `NOWPAYMENTS_PASSWORD` | Polling direct du statut d'un paiement uniquement |
| `NOWPAYMENTS_API_BASE` | Laisser vide (tests internes) |
| `RESEND_API_KEY` **ou** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE` | E-mails. Si les deux fournisseurs sont présents, le code choisit Resend. Sans fournisseur, demandes et commandes restent enregistrées mais aucun e-mail ne part |
| `EMAIL_FROM` | Expéditeur, ex. `Nukhba <no-reply@nokhba.net.ly>` — domaine à vérifier chez le fournisseur |
| `EMAIL_DOMAIN` | Domaine utilisé pour construire l'expéditeur par défaut si `EMAIL_FROM` est vide |
| `SMTP_TLS_REJECT_UNAUTHORIZED` | Laisser vide/`true` ; `false` désactive la vérification du certificat SMTP (relais auto-signé uniquement) |
| `LEAD_NOTIFICATION_EMAIL` | Destinataire prioritaire des notifications **leads et paiements**. Pour les paiements, si elle est absente, le code retombe sur l'e-mail public configuré du site, puis sur l'adresse extraite de `EMAIL_FROM` |
| `NEXT_PUBLIC_SITE_URL` | Repli lu par `src/lib/site-url.ts` ; préférer `SITE_URL` côté serveur |
| `WEBHOOK_URL` | Webhook sortant après enregistrement d'un lead |

### Fournisseur de codes digitaux — FazerCards

FazerCards remplace Reloadly pour les codes / cartes cadeaux / top-ups
(Reloadly exclut la Libye). Sans `FAZERCARDS_API_KEY`, la caisse digitale
répond « fournisseur non configuré » — elle ne vend rien, mais le site
fonctionne normalement.

| Variable | Valeur | Remarques |
|---|---|---|
| `FAZERCARDS_API_KEY` | hub revendeur `reseller.fazercards.com` → **Profile → API key** (`fc_…`) | 🔐 **Secret.** Serveur uniquement. Une seule clé, pas de sandbox séparé : elle engage le **vrai solde** |
| `FAZERCARDS_API_BASE` | `https://api.fzr.cards/api/v2` | Laisser la valeur par défaut |
| `FAZERCARDS_MAX_ORDER_USD` | `300` | Au-delà, la commande bascule en livraison manuelle (aucun débit automatique) |
| `FAZERCARDS_CATALOG_TTL_SECONDS` | `600` | Fraîcheur du catalogue en cache (prix / stock). `0` = cache désactivé |
| `FAZERCARDS_CATALOG_MAX_STALE_MINUTES` | `60` | Âge maximal d'un catalogue périmé encore servi si le fournisseur est en panne |
| `FAZERCARDS_CATALOG_MAX_CATEGORIES` | `80` | Catégories **détaillées** par famille et par synchro (1 appel HTTP chacune). Le reste n'est pas perdu : rotation + fusion (voir §2 bis) |
| `FAZERCARDS_CATALOG_PAGE_SIZE` | `100` | Taille d'une page de liste (maximum accepté par l'API) |
| `FAZERCARDS_CATALOG_MAX_PAGES` | `10` | Pages de liste lues par famille — 10 × 100 = jusqu'à 1000 catégories listées |
| `FAZERCARDS_CATALOG_TIME_BUDGET_MS` | `25000` | Budget de temps d'une synchro ; les détails restants sont reportés |
| `FAZERCARDS_CATALOG_MAX_PRODUCT_AGE_DAYS` | `7` | Âge maximal d'une fiche conservée par fusion (0 = illimité) |
| `FAZERCARDS_CATALOG_MAX_PRODUCTS` | `2000` | Taille maximale du catalogue fusionné |
| `FAZERCARDS_CATALOG_CONCURRENCY` | `6` | Requêtes simultanées vers l'API (1–12) |
| `FAZERCARDS_WEBHOOK_SECRET` | **ne pas créer** | Vercel refuse une valeur vide. Cette variable n'est utile que le jour où un webhook de statut est déclaré dans le hub revendeur. Absente, elle n'a aucun effet |

Le plafond `FAZERCARDS_MAX_ORDER_USD` est un **garde-fou de dépense** : il
se juge sur le montant payé par le client, pas sur le solde du compte.

### Qui sert le catalogue de `/codes`

Quand `FAZERCARDS_API_KEY` est présente, **c'est le catalogue FazerCards qui
est publié** sur `/codes` et `/codes/<slug>` (les fiches de la base, reliées
à Reloadly, ne servent plus que de repli). Conséquences :

- les pages produit ne sont plus pré-générées au build (`generateStaticParams`
  vide) : elles sont rendues à la demande puis rafraîchies par ISR (60 s) ;
- le build ne contacte **jamais** l'API fournisseur : le premier rendu
  déployé montre le repli base, puis l'ISR bascule sur le catalogue réel ;
- `GET /api/fazercards/catalog` renvoie le catalogue public servi depuis le
  cache (sans le coût d'achat) — utile pour vérifier rapidement les prix et
  les régions réellement proposés.

### Pourquoi le catalogue est persisté en base

Une synchronisation complète enchaîne **un appel HTTP par catégorie**
(~123 aujourd'hui). Dans le rendu d'une page, cela dépasse le temps
d'exécution d'une fonction serverless : la page expirait, retombait
silencieusement sur le catalogue historique, et les fiches produit
répondaient `500`.

Le catalogue synchronisé est donc stocké dans la table `settings`
(clé `fazercards:catalog`) :

- le **rendu** lit cette copie (`noSync`) — jamais de synchro, page rapide ;
- un **rafraîchissement post-réponse** (`after()`, Next 16) est planifié dès
  que la copie dépasse son TTL : l'utilisateur reçoit la page immédiatement,
  la synchro se fait après l'envoi ;
- le **cron** `/api/cron/fazercards-catalog` (une fois par jour,
  `maxDuration = 60`) sert de filet de sécurité. ⚠️ Le plan **Hobby** de
  Vercel refuse tout cron plus fréquent qu'une fois par jour et **fait
  échouer le déploiement** (`Hobby accounts are limited to daily cron jobs`) ;
  un `*/10` a déjà bloqué un déploiement de ce projet ;
- après un déploiement, la première synchro peut être forcée à la main :
  `curl -s https://nokhba.net.ly/api/fazercards/catalog?refresh=1 > /dev/null`.

Sans copie en base (premier déploiement), la vitrine sert le catalogue
historique jusqu'au premier passage du cron.

### 2 bis. Couverture du catalogue — pourquoi tout n'était pas visible

Constat du 28/10/2026 : la boutique s'arrêtait à « Apex Legends Mobile ».
Ni PlayStation, ni Steam, ni Xbox, ni Roblox, ni Google Play n'étaient
proposés, alors que le fournisseur les vend. Trois causes, corrigées :

1. **Curseur ignoré.** Les listes du fournisseur sont paginées
   (`meta.next_cursor`), mais seul `?limit=` était transmis : seule la
   première page de chaque famille était lue.
2. **Ordre alphabétique + plafond.** L'API renvoie ses catégories par ordre
   alphabétique et la synchro ne détaillait que les 40 premières : tout ce
   qui suivait « Apex » n'existait pas dans la boutique.
3. **Aucune reprise.** Le plafond était appliqué sans rotation ni fusion :
   les catégories hors plafond ne revenaient jamais.

Fonctionnement actuel :

- les listes sont lues **page par page** (`FAZERCARDS_CATALOG_MAX_PAGES`) ;
- les **marques prioritaires** (`PRIORITY_BRANDS` : PlayStation, Steam, Xbox,
  Roblox, Google Play, iTunes, Apple, Nintendo, Amazon, Netflix, Spotify…)
  passent **toujours** en premier, quel que soit le plafond ;
- le reste est couvert par une **fenêtre glissante** (rotation persistée en
  base) : chaque synchro détaille la tranche suivante ;
- le catalogue est **fusionné** avec la version précédente : une fiche sortie
  de la fenêtre reste en ligne avec son dernier prix connu, jusqu'à
  `FAZERCARDS_CATALOG_MAX_PRODUCT_AGE_DAYS` (7 j par défaut) ;
- un **budget de temps** arrête les appels de détail avant l'expiration de la
  fonction serverless ; le reste est reporté.

Deux corrections liées, visibles par le client :

- **Région des cartes cadeaux** : elle est portée par le nom de la catégorie
  (« PlayStation (US) »). Elle était forcée à `GLOBAL`, donc une carte
  australienne ou américaine s'affichait comme « mondiale » — premier motif
  de litige. Le filtre pays de `/codes` redevient utilisable.
- **Slugs uniques** : deux catégories de même nom en régions différentes
  (`fzr-gamekey-arc-raiders` en GLOBAL et en ROW) produisaient le même slug ;
  la seconde fiche était inaccessible et sa commande échouait après
  paiement. La région est désormais suffixée.

Vérification après déploiement : `GET /api/health` → bloc
`fazercards.catalog` expose maintenant `categories` (catégories listées par
famille) et `rotation` (position de la fenêtre), puis
`GET /api/fazercards/catalog?refresh=1` pour forcer une synchro immédiate.

### Mettre la clé FazerCards en production — ordre exact

1. **Fusionner la PR** qui contient l'intégration (sinon la clé ne sert à
   rien : le code déployé ne la lit pas).
2. Vercel → projet `mon-site` → **Settings → Environment Variables** →
   environnement **Production** → ajouter `FAZERCARDS_API_KEY` (et, si
   besoin, le plafond et le TTL). Cliquer **Save**.
3. **Deployments → ⋯ → Redeploy** du dernier déploiement de production.
   ⚠️ Un déploiement **déjà en ligne ne relit jamais** les nouvelles
   variables : sans cette étape, `fazercards.configured` reste `false`.
4. Ouvrir `https://nokhba.net.ly/api/health` et lire le bloc `fazercards` :

```json
{ "fazercards": {
    "configured": true,
    "credentialsValid": true,
    "apiBase": "https://api.fzr.cards/api/v2",
    "maxOrderUsd": 300,
    "catalog": { "cached": false, "products": 0, "ageMs": null,
                 "refreshing": false, "ttlMs": 600000, "maxStaleMs": 3600000 },
    "error": null } }
```

| Champ | Lecture |
|---|---|
| `configured:false` | Variable absente dans **Production**, ou déploiement non refait (étape 3) |
| `credentialsValid:false` | Clé refusée par FazerCards — voir `error` (401/403 : clé tronquée, révoquée, ou recopiée avec des guillemets). Le code tolère guillemets et espaces : le refus vient donc bien du fournisseur |
| `credentialsValid:null` | Fournisseur injoignable (réseau / panne) plutôt que clé invalide |
| `catalog.products:0` | Catalogue jamais chargé — normal tant que personne n'a ouvert la boutique ; devient non nul après le premier `GET` catalogue |

5. Contrôle du solde et de l'abonnement revendeur : **dans le hub
   FazerCards** (Wallet / Subscription), jamais sur `/api/health` — le
   solde n'est volontairement pas exposé sur une route publique.

🔐 Ne pas recopier la vraie clé FazerCards dans l'environnement
**Preview** : les Preview lisent les mêmes noms de variables et le même
compte fournisseur, donc elles engageraient le solde réel.

En local : `cp .env.example .env.local`, remplir, puis `npm run doctor`
(diagnostic complet, n'affiche jamais de secret).

## 3. Vérifier la production : `/api/health`

Ouvrir `https://nokhba.net.ly/api/health` — réponse attendue (valeurs
relevées le 19/10/2026) :

```json
{ "ok": true,
  "vercel": { "env": "production", "commit": "8b4e39e" },
  "database": { "urlConfigured": true, "connected": true, "error": null },
  "nowpayments": { "apiKeyConfigured": true, "apiKeyValid": true,
                   "ipnSecretConfigured": true, "sandbox": false,
                   "reachable": true, "error": null } }
```

Interprétation :

| Champ à `false` | Cause probable |
|---|---|
| `database.urlConfigured` | `DATABASE_URL` absente de l'environnement Production |
| `database.connected` | Base injoignable (chaîne, SSL, base en pause) — voir `database.error` |
| `nowpayments.apiKeyConfigured` | `NOWPAYMENTS_API_KEY` absente → l'ajouter puis **Redeploy** |
| `nowpayments.apiKeyValid` | Clé refusée : sandbox↔production croisés, secret IPN collé à la place, clé régénérée — voir `apiKeyError` |
| `nowpayments.reachable` | Sortie réseau vers NOWPayments bloquée |
| `vercel.commit` ≠ dernier commit `main` | Le déploiement de production n'est pas le dernier code |
| `fazercards.configured` | `FAZERCARDS_API_KEY` absente → l'ajouter puis **Redeploy** (voir §2) |
| `fazercards.credentialsValid` | Clé FazerCards refusée — voir `fazercards.error` |

Dans le code, `ok` vaut exactement
`database.connected && nowpayments.apiKeyValid === true`. C'est un bon
signal de création de facture, pas une preuve complète de bout en bout.

Ce que `/api/health` **ne prouve pas** :

- `ipnSecretConfigured:true` peut venir du repli sur `NOWPAYMENTS_API_KEY`
  (`nowPaymentsIpnSecret()`) : il ne prouve pas qu'un secret IPN distinct
  est défini ;
- `siteUrl` peut venir de `src/lib/config.ts` si `SITE_URL` est absente ;
- ni `ADMIN_PASSWORD`/`SESSION_SECRET`, ni le fournisseur d'e-mail, ni le
  destinataire des notifications, ni l'adresse de réception crypto ne sont
  exposés/testés ;
- la connexion `select 1` ne teste ni les tables ni une écriture réelle
  (les routes de commande appellent ensuite `ensureSchema()`).

## 4. Test de bout en bout (réservation 1 $)

Fiche d'une démo → « Réservez votre place — 1 $ » → e-mail → la facture
NOWPayments s'ouvre → après paiement, les statuts bruts
`confirming`/`confirmed`/`sending` restent **en attente** ; seuls
`finished`/`completed`, après contrôle du montant et de la devise, passent
la commande en **`paid`**, visible dans **Admin → Paiements &
réservations**. Le lien de retour `/pay/success?…&t=…` contient le jeton de
suivi du client : il ne doit pas être partagé publiquement.

## 5. Résultat de l'audit du 19/10/2026

> Tableau historique, relevé **avant** l'implémentation des corrections de
> la PR #22. L'état technique de la branche corrigée est au §7.5.

| Contrôle | Résultat |
|---|---|
| Déploiement production (Vercel ↔ GitHub) | ✅ `Deployment has completed` sur `8b4e39e` |
| `GET /api/health` | ✅ `ok: true` — paiements **réels** (`sandbox: false`, clé valide, HTTP 200) |
| `/admin/login` | ✅ Formulaire sans alerte « Variable manquante » → `ADMIN_PASSWORD` présent |
| `npm run build` (local, sans secrets) | ✅ 28 routes — le mode dégradé est géré proprement |
| `npm run typecheck` | ✅ Aucune erreur TypeScript |
| `npm run lint` | ⚠️ 5 erreurs + 8 avertissements (non bloquants, voir §6) |
| `npm audit --omit=dev` | 🔴 1 critique + 2 élevées via `next@16.2.6`/`postcss`/`sharp` ; correctif annoncé `next@16.4.2` (voir §7) |
| Smoke tests locaux sans secrets | ✅ `create`/`reserve` → 503 propre, IPN mal signé → 401, lead sans base → 500, `/admin` → redirection login |
| Fonctions pures paiement | ✅ Signature IPN triée acceptée/refusée correctement ; tranches 880/3 = 293,33 + 293,33 + 293,34 ; candidat `-R…` → bonne tranche |
| `.gitignore` / scan de motifs secrets | ✅ `.env*`, `.next`, `.vercel` ignorés ; aucun secret réel dans les fichiers suivis (placeholders uniquement) |

Non prouvables depuis le code ni depuis `/api/health` (à contrôler dans la
**liste des noms** de variables Vercel — jamais les valeurs) :
`SESSION_SECRET` distinct présent ?, `NOWPAYMENTS_IPN_SECRET` distinct
présent ?, `SITE_URL` explicitement défini ?, fournisseur e-mail et
`LEAD_NOTIFICATION_EMAIL` présents ?, adresse de réception crypto
configurée chez NOWPayments ?

## 6. Points de vigilance

1. **Latence base à froid** : `latencyMs` ≈ 1 200 ms mesuré sur requête à
   froid (réveil de la base + ouverture TLS). Normal au premier appel ;
   si cela persiste à chaud, rapprocher la région des fonctions Vercel
   (Settings → Functions) de la région de la base PostgreSQL.
2. **Lint — 5 erreurs `react-hooks/set-state-in-effect`** :
   `src/components/theme-provider.tsx`, `src/lib/i18n.tsx`,
   `src/components/live-site-frames.tsx` (×3). Ce sont les lectures
   `localStorage` au montage (thème, langue, état des cadres) — motif
   volontaire, sans effet sur la production (le build Vercel ne bloque
   pas dessus). Correctif propre = `useSyncExternalStore`, à faire dans
   une PR dédiée testée en Preview, car le système thème/langue est
   sensible (correctifs PR #19→#21).
3. **Lint — 8 avertissements** : 6 `<img>` à migrer vers `next/image`
   (LCP/bande passante), 1 police personnalisée, 1 `watch()` react-hook-form
   incompatible avec la mémoïsation du compilateur React.

## 7. Audit depuis le code (19/10/2026)

Portée : lecture du dépôt, inventaire exhaustif des `process.env`,
chaînes lead → base/e-mails et paiement → facture → IPN/polling → admin,
authentification, schéma/DDL, build, typecheck, lint, audit npm et smoke
tests locaux sans secrets. **Aucune valeur d'environnement de production
n'est visible dans le code** : le code dit comment une variable est lue,
jamais si elle est réellement présente sur Vercel.

### 7.1 Ce qui est correctement construit

- **Prix non falsifiables côté navigateur** : formules relues depuis la
  configuration serveur (`getSiteData()`), paiement flexible borné par
  `minUsd`/`maxUsd`, réservation au montant de configuration.
- **IPN** : corps brut lu avant JSON, signature HMAC-SHA512 sur objet trié
  (testée), rejet `401` avant toute écriture, `500` en cas d'erreur de
  traitement pour permettre un renvoi NOWPayments.
- **Admin** : layout protégé, chaque Server Action sensible appelle
  `requireAdmin()`, export CSV protégé aussi ; mot de passe comparé en
  temps constant, cookie `HttpOnly` + `Secure` en production, jeton HMAC
  avec expiration à 7 jours, limitation simple des tentatives.
- **Base** : le DDL de `ensureSchema()` couvre les colonnes du schéma
  Drizzle (`leads`, `settings`, `orders`) et leurs migrations incrémentales ;
  lectures publiques avec repli sur le contenu codé si la base tombe.
- **Leads/e-mails** : validation Zod, enregistrement avant webhook/e-mails,
  un échec d'envoi ne perd pas la demande ; modèles lead échappés en HTML.
- **Aucun secret suivi par Git** détecté par scan de motifs ; seules des
  valeurs locales/placeholders sont présentes.

### 7.2 Priorité 1 — à corriger avant de considérer le code « propre »

1. **Dépendances vulnérables.** `package.json` fixe `next@16.2.6` ;
   `npm audit --omit=dev` signale 1 vulnérabilité critique et 2 élevées
   (Next, PostCSS et Sharp transitifs), avec `next@16.4.2` comme correctif.
   Le dépôt n'utilise ni middleware/proxy, ni serveur custom, ni
   `next/og`, ni hébergement Windows, et son seul `next/image` est
   `unoptimized` — plusieurs avis sont donc moins directement exploitables
   ici — mais les Server Actions et le runtime Next sont bien présents.
   **Action : PR dédiée de mise à jour Next + `eslint-config-next`, puis
   build/typecheck/audit et test Preview.**
   **Statut PR #22 : corrigé — `next@16.4.2`, audit production à zéro (§7.5).**
2. **Suivi de commande public trop bavard.** `GET /api/payments/order/[ref]`
   ne demande aucune authentification et renvoie nom, e-mail, téléphone,
   adresse crypto et URLs de paiement de toutes les tranches. Or les
   références sont un timestamp + 4 caractères `Math.random()` base36
   (`NKH-…`, `RSV-…`) : la référence sert de jeton d'accès, avec une
   entropie faible. L'interface n'affiche ni le nom ni le téléphone ni
   l'adresse crypto. **Action : références cryptographiquement aléatoires
   plus longues, retirer/masquer les données personnelles, et idéalement
   un jeton de suivi séparé de la référence lisible.**
   **Statut PR #22 : corrigé pour les nouvelles commandes ; les anciennes
   restent consultables en mode minimisé, sans lien de paiement direct.**
3. **Machine à états IPN permissive.** L'IPN remplace toujours le statut
   par le dernier reçu : une notification tardive/désordonnée peut faire
   repasser une commande `paid` en `pending`/`failed` (le drapeau
   `wasPaid` ne protège que l'e-mail). Il ne compare ni
   `price_amount`/`price_currency`, ni `actually_paid` à la commande avant
   de passer en `paid`. Enfin `confirmed` est traité comme `paid` alors
   que le statut final de règlement est `finished`. **Action : transitions
   monotones/idempotentes, contrôle montant+devise sur les statuts payés,
   décision métier explicite pour `confirmed`.**
   **Statut PR #22 : corrigé — `confirmed` reste en attente, transitions et
   montants sont réconciliés côté IPN comme côté polling.**
4. **Notification e-mail de paiement fragile.** Le destinataire est
   `LEAD_NOTIFICATION_EMAIL`, sinon l'adresse extraite d'un `EMAIL_FROM`
   de forme `Nom <adresse>` uniquement. Si ces deux variables sont absentes
   — ou si `EMAIL_FROM` est une adresse simple — aucun e-mail de paiement
   ne part, sans repli sur l'e-mail du site (contrairement aux leads).
   Le HTML de cet e-mail n'échappe pas les champs client/commande.
   **Action : destinataire unifié (variable explicite → e-mail du site),
   extraction robuste, échappement HTML.**
   **Statut PR #22 : corrigé — repli sur l'e-mail du site, extraction d'une
   adresse simple ou `Nom <adresse>`, valeurs dynamiques échappées.**

### 7.3 Priorité 2 — durcissement et exactitude

- **Abus/DoS applicatif** : seule la réservation est limitée (8/10 min/IP,
  en mémoire par instance). `POST /api/payments/create` et `POST /api/lead`
  peuvent créer lignes/factures/e-mails sans limite applicative ; le
  webhook lead n'a pas de timeout. Les compteurs en mémoire ne sont pas
  globaux sur Vercel (une instance = un compteur), y compris pour le login.
- **Erreurs détaillées publiques** : les routes paiement renvoient le
  message brut base/NOWPayments au navigateur ; `/api/health` expose
  erreurs, base d'API, commit et URL de déploiement. Utile au diagnostic,
  à réduire une fois l'exploitation stabilisée.
- **Doublons d'e-mail possibles** : IPN et polling `/order/[ref]` peuvent
  constater le même passage à `paid` en parallèle et notifier deux fois ;
  aucun marqueur transactionnel « déjà notifié » n'existe. **Atténué dans la
  PR #22** : les deux chemins effectuent une mise à jour conditionnelle sur
  l'ancien statut, et seul celui qui revendique la transition envoie
  l'e-mail. Il n'existe toujours pas de file transactionnelle de relance si
  la requête gagnante échoue après l'écriture.
- **Relance de tranche** : `payExistingOrder` crée une nouvelle facture et
  efface l'ancien `paymentId` ; l'ancienne facture payée tardivement peut
  ensuite écraser le suivi ou créer un double règlement à traiter
  manuellement. **Atténué dans la PR #22** : le jeton est exigé pour les
  commandes protégées et une relance ne peut plus repasser une commande
  `paid` en `pending`. Deux factures réellement payées restent un cas de
  remboursement manuel.
- **Totaux admin filtrés** : `/admin/orders` calcule total encaissé et
  nombre de réservations sur les lignes filtrées (limite 500), alors que
  les libellés suggèrent des totaux globaux.
- **Polling client** : toute erreur HTTP (y compris 500 transitoire) est
  affichée « commande introuvable » et n'est jamais réinitialisée.
  **Corrigé dans la PR #22** : seul un `404` marque la commande introuvable,
  et une réponse valide réinitialise cet état.
- **Inventaire documentaire** : le code lit 23 variables applicatives ;
  `EMAIL_FROM`, `EMAIL_DOMAIN`, `SMTP_TLS_REJECT_UNAUTHORIZED` et
  `NEXT_PUBLIC_SITE_URL` manquaient dans `.env.example` (le README couvre
  les trois premières). `npm run doctor` ne contrôle ni ces variables, ni
  le destinataire réel des e-mails de paiement, ni la validité SMTP/Resend.
- **Aucun test automatisé** dans `package.json` : les seules barrières sont
  typecheck, lint (actuellement en échec) et build.

### 7.4 Verdict depuis le code

La logique métier principale est **cohérente et déployable** : prix
serveur, IPN signé, schéma auto-créé, admin protégé, replis propres.
En revanche, le code **ne permet pas d'affirmer** que `SESSION_SECRET`,
le secret IPN distinct, `SITE_URL`, les e-mails ou le wallet NOWPayments
sont configurés — seuls les noms dans Vercel/NOWPayments le confirment.
Les quatre points de priorité 1 sont traités par la PR #22 (§7.5), mais la
production n'en bénéficiera qu'après fusion sur `main` et redéploiement.
Le lint historique (thème/langue, voir §6) et plusieurs points de priorité 2
restent volontairement hors de cette PR.

### 7.5 Corrections implémentées dans la PR #22

**Dépendances**

- `next` et `eslint-config-next` passent à `^16.4.2` (versions installées
  vérifiées : `16.4.2`).
- `npm audit --omit=dev` : **0 vulnérabilité** dans l'arbre de production.
- `npm audit` complet : 10 vulnérabilités restantes (4 modérées, 6 élevées),
  toutes dans l'arbre de développement (`eslint-config-next`,
  `drizzle-kit`, `postcss` direct de build) ; elles ne font pas partie des
  dépendances de production signalées par `--omit=dev`.

**Suivi public des commandes**

- Nouvelles références `NKH-…`/`RSV-…` à **96 bits** d'aléa
  cryptographique (`randomBytes(12)`, hexadécimal), au lieu d'un timestamp
  plus quelques caractères `Math.random()`.
- Jeton de suivi séparé de **256 bits** par commande (un même jeton pour
  toutes les tranches d'un groupe). Seul son **SHA-256** est stocké dans
  `orders.tracking_token_hash` ; le jeton en clair n'apparaît que dans la
  réponse de création et dans les URLs de retour NOWPayments (`?t=…`).
- `GET /api/payments/order/[ref]` exige ce jeton pour les nouvelles
  commandes (en-tête `x-order-tracking-token`, Bearer ou `?t=`) et répond
  `404` sans lui, sans confirmer l'existence de la commande. La réponse ne
  contient plus nom, téléphone, e-mail complet, adresse crypto ni
  `paymentUrl` de la commande principale ; l'e-mail est masqué
  (`w***@example.com`). Les liens de paiement des tranches ne sont renvoyés
  qu'au porteur du jeton.
- Anciennes commandes (`tracking_token_hash` à `NULL`) : accès « legacy »
  conservé pour ne pas casser les liens déjà envoyés, mais avec la même
  réponse minimisée et `paymentUrl: null` sur les tranches. Le bouton de la
  page de suivi génère alors explicitement une nouvelle facture.
- La colonne est créée par le DDL de base et par un
  `ALTER TABLE … ADD COLUMN IF NOT EXISTS` idempotent dans
  `ensureSchema()` : aucune migration manuelle n'est requise au déploiement.

**Réconciliation IPN et polling**

- Seuls `finished` et `completed` valent `paid`. `confirmed`, `sending` et
  les autres états intermédiaires restent `pending`.
- Transitions monotones : `paid` est terminal sauf `refunded` explicite ;
  `failed`/`expired` ne reviennent pas seuls à `pending` ; un vrai
  `finished` validé peut en revanche faire passer `failed`/`expired` à
  `paid`. Les notifications périmées sont accusées (`200`) sans écraser
  l'état connu.
- Avant tout passage à `paid`, contrôle du montant facturé
  (`price_amount`, tolérance max(0,01 ; 0,1 %)), de la devise
  (`price_currency`) et, quand les montants crypto sont fournis, de
  `actually_paid ≥ 99 %` de `pay_amount`. En cas d'écart, le statut interne
  est conservé et l'anomalie est journalisée.
- IPN et polling partagent ces règles et revendiquent la transition par une
  mise à jour conditionnelle sur `(id, ancien statut)` : seule la requête
  gagnante envoie l'e-mail « paiement confirmé ». Une relance manuelle de
  tranche ne peut plus repasser une commande `paid` en `pending`.

**Notification e-mail de paiement**

- Destinataire : `LEAD_NOTIFICATION_EMAIL` → e-mail public du site
  (`config.email`) → adresse extraite de `EMAIL_FROM` (forme simple ou
  `Nom <adresse>`).
- Toutes les valeurs dynamiques du HTML (client, commande, montants, URL
  admin…) passent par `escapeHtml`.

**Validation de la branche (19/10/2026, sandbox sans secrets)**

| Contrôle | Résultat |
|---|---|
| `npm run typecheck` | ✅ |
| `npm run build` (Next 16.4.2) | ✅ 28 routes |
| `npm audit --omit=dev` | ✅ 0 vulnérabilité |
| `npm run lint` | ⚠️ Inchangé : 5 erreurs `set-state-in-effect` + 8 avertissements (§6) |
| Fonctions pures ciblées | ✅ Références/jetons (format, unicité, accès granted/legacy/denied), matrice de transitions, validation des montants, signature IPN valide/invalide |
| Smoke tests serveur compilé | ✅ `/` et `/pay/success?…&t=…` → 200 ; création sans clé → 503 ; IPN mal signé → 401 ; lecture sans base → 500 contrôlé |

Limites de cette validation : aucun paiement réel ni aucune écriture en
base de production n'ont été effectués depuis le sandbox, et la Preview
Vercel reste protégée par authentification. Le test final reste donc :
ouvrir la Preview de la PR connecté à Vercel, puis — après fusion —
effectuer le test de bout en bout du §4 sur la production.

## 8. Observabilité — Vercel Web Analytics & Speed Insights

Les deux mesures sont montées dans `src/app/(site)/layout.tsx` uniquement :
le panneau `/admin` (hors groupe `(site)`) n'envoie donc ni pages vues ni
Web Vitals. Aucune variable d'environnement n'est nécessaire.

| Mesure | Paquet | Ce qui est collecté |
|---|---|---|
| Web Analytics | `@vercel/analytics` | Pages vues, référents, pays, appareils |
| Speed Insights | `@vercel/speed-insights` | Core Web Vitals réels : LCP, INP, CLS, FCP, TTFB |

**Activation (une seule fois, propriétaire du projet)** : tableau de bord
Vercel → projet `mon-site` → onglet **Speed Insights** (puis **Analytics**)
→ **Enable**. Sans cette activation, les scripts se chargent mais les
requêtes restent sans effet : aucune donnée n'apparaît.

**Fonctionnement technique**

- En production sur Vercel, les scripts sont servis depuis l'origine du site
  (`/_vercel/speed-insights/script.js`, `/_vercel/insights/script.js`) : ils
  sont donc couverts par `script-src 'self'` de la CSP (`next.config.ts`).
- `connect-src` autorise `https://vitals.vercel-insights.com` (envoi direct
  des Web Vitals) ; `script-src` autorise `https://va.vercel-scripts.com`,
  utilisé seulement par les scripts de débogage en local (`next dev`).
- Le composant s'injecte après hydratation : il est normal de ne pas voir la
  balise `<script>` dans le HTML servi, mais dans le DOM (onglet Éléments).

**Vérifier sur une Preview ou en production**

1. Ouvrir le site, puis la console réseau : requête
   `/_vercel/speed-insights/script.js` en 200, puis des POST vers
   `/_vercel/speed-insights/vitals`.
2. Tableau de bord Vercel → **Speed Insights** : les premiers points
   apparaissent après quelques visites (délai de traitement possible).
3. Les bonnes notes locales (`npm run build` + Lighthouse) ne garantissent
   pas les Web Vitals terrain : Speed Insights mesure des visiteurs réels,
   réseau et appareils compris.

## Politique de prix et réseaux de paiement

Le catalogue FazerCards n'applique plus une marge unique de 8 % : celle-ci
ignorait les frais FIXES (réseau blockchain, retrait), qui dépassaient la
marge des petits articles — une vente à 0,81 $ se soldait par une perte.

Barème en vigueur (`src/lib/fazercards-pricing.ts`) :

| Coût fournisseur | Marge nette | Gain plancher |
| ---------------- | ----------- | ------------- |
| < 5 $            | 20 %        | 0,45 $        |
| 5 – 20 $         | 15 %        | 1,00 $        |
| 20 – 60 $        | 12 %        | 2,50 $        |
| ≥ 60 $           | 10 %        | —             |

`prix = max(coût / (1 − marge), coût + plancher, 1,50 $)`, arrondi au centime
supérieur : jamais de vente à perte, jamais de prix sous `MIN_RETAIL_USD`.

`MIN_RETAIL_USD = 1,50 $` est **aligné sur `MIN_CRYPTO_INVOICE_USD`** : un
prix public plus bas que le minimum de facture rendait le bouton « Acheter »
inopérant (`below_minimum`).

### Réseaux de paiement

Les frais de réseau sont fixes : sur un article à 1,50 $, un transfert ERC-20
ou Bitcoin peut manger toute la marge.

- **À laisser activés** : BEP-20, Solana, TON, Polygon, Arbitrum, Avalanche,
  Aptos, Optimism, Celo — en USDT **et** USDC sur ces chaînes.
- **À désactiver** : TRC-20, ERC-20, Bitcoin, Ethereum natif.

État vérifié en production (capture du dashboard) : USDT BEP-20, USDC BEP-20,
USDT/USDC Solana, USDT Polygon, USDT TON, USDT Arbitrum, USDT Optimism, USDT
Avalanche C, USDT Celo. Éteints : TRC-20, ERC-20, BTC, ETH, et les stablecoins
secondaires (DAI, FDUSD, PYUSD, TUSD, USDD).

La reconnaissance d'un ticker se fait par comparaison **exacte** de sa partie
réseau (`usdtop` → `op`), après retrait du préfixe de pièce : un fragment
court comme `op` ne peut pas capturer une pièce sans rapport (`opensea`).

⚠️ La liste réellement proposée au client se règle dans le **dashboard
NOWPayments → Coin settings**, PAS dans le code : notre facture ne fixe pas
`pay_currency`, c'est la page hébergée qui laisse choisir la pièce. Le code
fait trois choses : afficher les réseaux recommandés dans le tunnel d'achat
(`src/lib/payment-networks.ts`), détecter un paiement arrivé sur une chaîne
coûteuse (avertissement dans les logs de l'IPN, jamais un refus — le client a
payé), et verrouiller ces règles par des tests.

## Livraison d'une commande FazerCards : codes et recharges

Deux familles de produits, deux comportements — les confondre a produit un
incident réel (commande `ord-2492479`, Beyond: Two Souls) :

| Famille | Ce que renvoie le fournisseur | Livraison |
| ------- | ----------------------------- | --------- |
| `software_key`, `gift_card` | un ou plusieurs codes (`payload.keys[]`, `payload.codes[]`) | codes chiffrés + e-mail |
| `game_topup` | **aucun code** : le crédit part sur le compte du joueur | commande livrée + e-mail « recharge créditée » |

`src/lib/fazercards-extract.ts` :

- `extractFazercardsCodes(payload)` lit `codes`, `keys`, `cards`, `serials`,
  `vouchers`, `items`, puis les champs directs, puis un parcours profond de
  secours. Liste blanche de noms de champs : un statut ou une devise ne peut
  pas être pris pour un code.
- `classifyFazercardsDelivery({ kind, status, codes })` décide du sort :
  `codes` · `topup_completed` · `processing` · `failed`. Une recharge
  `completed` sans code est un **succès**, jamais une livraison manuelle.
- `redactFazercardsPayload(payload)` produit une version masquée pour les logs
  (structure conservée, codes jamais écrits en clair).

Clôture manuelle : l'admin dispose de « Recharge créditée (aucun code) », qui
passe la commande en `delivered` et envoie l'e-mail au client — sans exiger un
faux code, ce qui était le seul moyen auparavant.

Reprise d'une commande bloquée : « Relancer la livraison » relit la commande
chez le fournisseur et applique les règles ci-dessus (une transaction existante
n'est jamais repayée).

## Vérification de l'identifiant joueur (recharges)

Un identifiant d'un autre jeu crédite un inconnu et **rien ne peut être
annulé**. Trois garde-fous, dans cet ordre :

1. **Caisse** (`createFazercardsCheckout`) — `POST /topups/validate-id` de
   FazerCards est appelé **avant** la création de la facture. Réponse
   `valid: false` → refus `400 invalid_player_id`, aucun montant débité.
2. **Saisie** — le dialogue d'achat vérifie l'identifiant 700 ms après la
   frappe (`POST /api/fazercards/validate-id`) : pseudo affiché en vert,
   bouton d'achat bloqué et avertissement rouge si le compte n'existe pas.
3. **Livraison** (`deliverPaidFazercardsOrder`) — re-vérification juste avant
   l'achat fournisseur. Identifiant refusé → commande en `manual`, **aucun
   achat**.

Règle importante : un fournisseur muet (`checked: false`) ne bloque pas la
vente — sinon des jeux entiers deviendraient invendables — mais il ne laisse
plus passer en silence. La décision est centralisée dans `playerIdGate`
(`fazercards-player-id-core.ts`), utilisée par le tunnel **et** par la caisse
serveur :

| Réponse du fournisseur | Tunnel | Serveur |
| --- | --- | --- |
| `checked: true`, `valid: true` | pseudo affiché, achat autorisé | accepté |
| `checked: true`, `valid: false` | bouton bloqué | `400 invalid_player_id` |
| `checked: false` | case à cocher obligatoire | `400 player_id_unconfirmed` sans `idConfirmed: true` |

⚠️ Historique : avant ce correctif, `checked: false` ouvrait directement la page
de paiement — constaté en production sur « Game Top-Up — 8 Ball Pool » avec un
identifiant inventé. Le résultat du contrôle est désormais mémorisé sur la
commande (`reloadlyResponse.playerIdCheck`) et affiché dans l'admin
(« Contrôle identifiant » : vérifié / refusé / certifié par le client).

La fiche d'une recharge affiche aussi sa **plateforme** (famille déduite du
nom de la catégorie : Mobile, PC, PlayStation… sinon nom du jeu) et
l'**identifiant demandé** (`Player ID`, `account_id`…), pour qu'aucun client
ne confonde deux jeux.

## Reprise automatique des commandes bloquées

`GET /api/cron/digital-orders` (planifié par `vercel.json`, protégé par
`CRON_SECRET`) reprend les commandes restées en `pending` (webhook IPN perdu)
ou `paid` (fournisseur muet) alors que le paiement est confirmé.

Conditions (`src/lib/digital-resume-core.ts`) : paiement `paid`, statut
`pending`/`paid`, dernière activité > 15 min, < 6 tentatives, < 14 jours.
Au-delà, la commande passe en `manual` avec un motif explicite — jamais
d'achat silencieux, jamais de double débit (Idempotency-Key par commande).

Diagnostic sans achat : `GET /api/cron/digital-orders?dry=1` avec
`Authorization: Bearer $CRON_SECRET`. Sur un plan Vercel Hobby, le cron est
quotidien (`20 4 * * *`) ; sur Pro, resserrez à `*/15 * * * *` pour une
reprise toutes les 15 minutes.
