# Production Vercel — guide d'exploitation

État de référence vérifié le **19/10/2026** (audit depuis l'agent Arena) :
projet Vercel `walid-website/mon-site`, domaine `nokhba.net.ly`,
commit de production `8b4e39e`, `/api/health` → `ok: true`.

Un second passage, **depuis le code uniquement**, a été ajouté le même jour
(§7). Conclusion nuancée : la chaîne fonctionnelle est cohérente et le site
déployé répond correctement, mais le code révèle des points à corriger —
notamment des dépendances à mettre à jour — avant de parler d'un état
« 100 % sans réserve ».

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
| `LEAD_NOTIFICATION_EMAIL` | Destinataire des notifications **leads et paiements**. Pour les paiements, c'est le destinataire fiable ; voir l'écart signalé au §7 |
| `NEXT_PUBLIC_SITE_URL` | Repli lu par `src/lib/site-url.ts` ; préférer `SITE_URL` côté serveur |
| `WEBHOOK_URL` | Webhook sortant après enregistrement d'un lead |

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
NOWPayments s'ouvre → après paiement, l'IPN traduit le statut brut
(`confirmed`/`finished`) en statut interne **`paid`**, visible dans
**Admin → Paiements & réservations**.

## 5. Résultat de l'audit du 19/10/2026

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
2. **Suivi de commande public trop bavard.** `GET /api/payments/order/[ref]`
   ne demande aucune authentification et renvoie nom, e-mail, téléphone,
   adresse crypto et URLs de paiement de toutes les tranches. Or les
   références sont un timestamp + 4 caractères `Math.random()` base36
   (`NKH-…`, `RSV-…`) : la référence sert de jeton d'accès, avec une
   entropie faible. L'interface n'affiche ni le nom ni le téléphone ni
   l'adresse crypto. **Action : références cryptographiquement aléatoires
   plus longues, retirer/masquer les données personnelles, et idéalement
   un jeton de suivi séparé de la référence lisible.**
3. **Machine à états IPN permissive.** L'IPN remplace toujours le statut
   par le dernier reçu : une notification tardive/désordonnée peut faire
   repasser une commande `paid` en `pending`/`failed` (le drapeau
   `wasPaid` ne protège que l'e-mail). Il ne compare ni
   `price_amount`/`price_currency`, ni `actually_paid` à la commande avant
   de passer en `paid`. Enfin `confirmed` est traité comme `paid` alors
   que le statut final de règlement est `finished`. **Action : transitions
   monotones/idempotentes, contrôle montant+devise sur les statuts payés,
   décision métier explicite pour `confirmed`.**
4. **Notification e-mail de paiement fragile.** Le destinataire est
   `LEAD_NOTIFICATION_EMAIL`, sinon l'adresse extraite d'un `EMAIL_FROM`
   de forme `Nom <adresse>` uniquement. Si ces deux variables sont absentes
   — ou si `EMAIL_FROM` est une adresse simple — aucun e-mail de paiement
   ne part, sans repli sur l'e-mail du site (contrairement aux leads).
   Le HTML de cet e-mail n'échappe pas les champs client/commande.
   **Action : destinataire unifié (variable explicite → e-mail du site),
   extraction robuste, échappement HTML.**

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
  aucun marqueur transactionnel « déjà notifié » n'existe.
- **Relance de tranche** : `payExistingOrder` crée une nouvelle facture et
  efface l'ancien `paymentId` ; l'ancienne facture payée tardivement peut
  ensuite écraser le suivi ou créer un double règlement à traiter
  manuellement.
- **Totaux admin filtrés** : `/admin/orders` calcule total encaissé et
  nombre de réservations sur les lignes filtrées (limite 500), alors que
  les libellés suggèrent des totaux globaux.
- **Polling client** : toute erreur HTTP (y compris 500 transitoire) est
  affichée « commande introuvable » et n'est jamais réinitialisée.
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
Et l'état « production sans réserve » attend au minimum la mise à jour
de sécurité Next (priorité 1.1).
