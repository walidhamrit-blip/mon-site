# نخبة Nukhba — Agence Web Premium Tripoli

Site vitrine haut de gamme construit avec Next.js 16 + Tailwind + Framer Motion.

## Installation
```bash
npm install
npm run dev # http://localhost:3000
```

## Configuration unique
Editez `src/lib/config.ts`:
- `siteConfig.pricing.plans` : prix, noms, options
- `theme.accent` : couleur d'accent (#C6A664 doré par défaut)
- `whatsapp` : numéro sans "+"
- `social` : liens Instagram/Facebook
- `email`, `phone`, `address`

## Thèmes du site (8 thèmes, clair + sombre)
`src/lib/themes.ts` contient le catalogue des thèmes. Chaque thème définit **sa palette claire ET sa palette sombre** : le mode clair/sombre reste donc un réglage totalement indépendant (un bouton dédié ☀/☾ dans la barre supérieure), et n'importe quel thème se voit dans les deux modes.

| Thème | ID | Ambiance |
|---|---|---|
| نخبة الذهبي — Nukhba Gold | `nukhba` | noir profond & doré (thème d'origine) |
| أزرق ملكي — Royal Blue | `royal` | confiance, agencies & services |
| زمردي أخضر — Emerald | `emerald` | clinics & produits naturels |
| خمري أنيق — Burgundy | `burgundy` | restaurants, mode & hôtellerie |
| فحمي مينيمال — Graphite | `graphite` | minimalisme haut de gamme |
| نحاسي دافئ — Copper | `copper` | cafés, restaurants & chaleur |
| تركوازي بحري — Ocean Teal | `teal` | cabinets médicaux & tourisme |
| بنفسجي نبيل — Violet | `violet` | tech, studios & marques créatives |

- Les palettes sont converties en CSS (`html[data-theme="x"]` / `html.dark[data-theme="x"]`) et injectées dans le `<head>` par `src/app/layout.tsx` (`themeCss()`).
- Un script inline (`THEME_BOOT_SCRIPT`) applique thème + mode **avant le premier rendu** : aucun clignotement de couleurs.
- Sélection : bouton palette dans la barre supérieure (desktop), liste dans le menu mobile, ou la section « ثيمات الموقع » de la page d'accueil.
- Le choix est mémorisé dans `localStorage` (`nukhba-palette` et `nukhba-mode`).
- `src/app/globals.css` conserve `:root` / `.dark` comme repli (thème par défaut) si le JavaScript est désactivé.

## Contenu modifiable
`src/lib/content.ts` : démos, secteurs, pourquoi nous, étapes, témoignages, FAQ
`src/lib/i18n.tsx` : traductions AR/EN

## Images
Remplacez les URLs Unsplash par vos images dans `content.ts` et sections. Placez mockups dans `public/images/` et référencez `/images/...`.

## Déploiement
- **Vercel** : `vercel --prod` — SSG automatique, 90+ Lighthouse. Ajoutez `nokhba.net.ly` dans Settings → Domains et configurez les DNS chez votre registrar.
- **VPS** : `npm run build` + `npm start` derrière Nginx + PM2. Ajoutez `DATABASE_URL` si vous activez formulaire DB.

## Mise en service — sortir du mode « dégradé »

Sans base de données ni clé NOWPayments, le site reste **consultable** mais
l'administration affiche « Base de données inaccessible » et la réservation à
1 $ répond `gateway_not_configured`. C'est le comportement attendu : rien
n'est cassé, les fonctionnalités attendent simplement leur configuration.

Un diagnostic automatique vérifie les quatre briques ci-dessous :

```bash
npm run doctor
```

Il lit `.env.local` puis `.env` (les variables déjà exportées dans le shell
restent prioritaires), ne révèle jamais un secret et se termine par un code
de sortie non nul s'il reste un point bloquant.

### Étape 1 — Base PostgreSQL (obligatoire)

1. Créez une base : **Neon** (offre gratuite), **Supabase**, **Vercel Postgres**
   ou un PostgreSQL auto-hébergé.
2. Copiez la chaîne de connexion (`postgresql://user:pass@host/db?sslmode=require`).
3. Renseignez-la :
   - en local : `cp .env.example .env.local` puis `DATABASE_URL=…` ;
   - sur Vercel : **Settings → Environment Variables → Production**.
4. C'est tout : les tables `leads`, `settings` et `orders` (avec `kind` et
   `demo_slug`) sont créées **automatiquement** au premier chargement —
   aucun `drizzle-kit push` nécessaire.

Une fois connectée, l'édition admin (catégories, prix, réservation) est
persistée et `/admin/orders` affiche les commandes et réservations.

### Étape 2 — Accès admin

```bash
ADMIN_PASSWORD=votre-mot-de-passe-long   # obligatoire, /admin/login reste fermé sans lui
SESSION_SECRET=$(openssl rand -hex 32)   # recommandé (sinon signé avec ADMIN_PASSWORD)
```

### Étape 3 — Acompte de 1 $ via NOWPayments

1. Créez un compte sur **nowpayments.io**, confirmez l'e-mail.
2. **Settings → API keys** : générez une clé → `NOWPAYMENTS_API_KEY`.
3. **Settings → Crypto accounts** : ajoutez au moins une adresse de réception
   (BTC, USDT-TRC20…), sinon aucun paiement ne peut être crédité.
4. **Settings → IPN** : ajoutez
   `https://votre-domaine/api/payments/ipn` et copiez le secret →
   `NOWPAYMENTS_IPN_SECRET`.
5. `SITE_URL=https://votre-domaine` — sert aux retours succès/annulation et à
   l'IPN.
6. Pour tester sans argent réel : compte **sandbox** (`account-sandbox.nowpayments.io`)
   + `NOWPAYMENTS_SANDBOX=true`. Les deux environnements sont séparés : une
   clé sandbox avec `NOWPAYMENTS_SANDBOX` vide donne `403 · INVALID_API_KEY`.

### Étape 4 — Vérifier, puis déployer

```bash
npm run doctor                 # tout doit être ✓ (les ! sont facultatifs)
curl -s localhost:3000/api/health   # ok:true, database.connected:true, nowpayments.apiKeyValid:true
```

Sur Vercel, **après avoir ajouté ou modifié une variable, redéployez** :
les fonctions déjà déployées ne lisent pas les nouvelles valeurs.

Test de bout en bout de la réservation : ouvrez une fiche de démo →
« Réservez votre place — 1 $ » → renseignez un e-mail → la facture NOWPayments
doit s'ouvrir → après paiement, l'IPN passe la commande `RSV-…` en
`confirmed` et elle apparaît dans **Admin → Paiements & réservations**
(filtre « Réservations prioritaires »).

### Étape 5 — E-mails (facultatif)

Sans `RESEND_API_KEY` ni `SMTP_HOST`, les demandes et réservations restent
enregistrées en base mais aucune confirmation n'est envoyée. Voir la section
« Variables d'environnement (e-mails) ».

## Formulaire
La demande est enregistrée en base (table `leads`, visible dans `/admin`), transmise au webhook optionnel, et déclenche **deux e-mails** :

- **notification à l'agence** — tous les champs de la demande, un lien WhatsApp pré-rempli et l'accès direct à la demande dans l'administration (répondre à l'e-mail écrit au client) ;
- **accusé de réception client** — en arabe ou en anglais selon la langue du formulaire, avec le récapitulatif de la demande et les prochaines étapes.

Aucun fournisseur d'e-mail n'est obligatoire : sans configuration, le formulaire fonctionne exactement comme avant (la demande reste enregistrée et consultable dans `/admin`), et l'absence d'e-mail est signalée dans les journaux du serveur.

### Variables d'environnement (e-mails)
| Variable | Effet |
| --- | --- |
| `RESEND_API_KEY` | Envoi via l'API Resend (appel REST, aucune dépendance supplémentaire) |
| `EMAIL_FROM` | Expéditeur — par défaut `Nukhba <no-reply@nokhba.net.ly>` (domaine à vérifier chez Resend) |
| `EMAIL_DOMAIN` | Domaine de l'expéditeur par défaut — `nokhba.net.ly` |
| `SMTP_HOST` | Serveur SMTP — utilisé à la place de Resend si défini |
| `SMTP_PORT` | Port SMTP — `587` par défaut |
| `SMTP_USER` / `SMTP_PASS` | Authentification SMTP |
| `SMTP_SECURE` | `true` pour une connexion SSL directe (port 465) |
| `SMTP_TLS_REJECT_UNAUTHORIZED` | `false` pour accepter un certificat auto-signé |
| `LEAD_NOTIFICATION_EMAIL` | Adresse qui reçoit les notifications — par défaut l'e-mail du site |

- Webhook: POST vers `https://formspree.io` ou Make/Zapier via `WEBHOOK_URL`
- UTM conservé via `window.location.search`

## Paiements crypto (NOWPayments)

Le site intègre NOWPayments : bouton « ادفع بالعملات الرقمية / Pay with crypto »
sur les cartes tarifaires, prix affichés en د.ل **et en USD**, paiement sur la
page hébergée NOWPayments, confirmation automatique par IPN (webhook) et suivi
dans `/admin/orders`.

### Paiement en totalité ou en tranches

Le dialogue de paiement propose trois modes, reflétés dans le prix affiché :

| Mode | Facturation |
| --- | --- |
| **Paiement total** | 100 % du prix USD en une fois |
| **2 tranches** | 50 % / 50 % (arrondi au centime, la dernière tranche absorbe le reste) |
| **3 tranches** | 33,3 % / 33,3 % / 33,4 % |

- La **première tranche est facturée immédiatement** ; les suivantes sont
  créées à l'avance en base (une commande par tranche, référence
  `NKH-XXXX-T2`, `NKH-XXXX-T3`) et restent à régler depuis la page de suivi
  `/pay/success?ref=NKH-XXXX`.
- Chaque tranche est un paiement NOWPayments distinct : l'IPN confirme chaque
  versement indépendamment, et l'e-mail « paiement confirmé » précise la
  tranche concernée.
- Le montant est toujours recalculé côté serveur à partir de `priceUsd` :
  le navigateur ne peut pas modifier le prix ni la répartition.
- L'admin `/admin/orders` affiche le badge « Tranche 2/3 » et le groupe de
  paiement associé.

### 1) Côté NOWPayments (une fois, dans votre tableau de bord)

1. Confirmez votre e-mail d'inscription.
2. **Settings → API keys** : créez une clé API (gardez-la secrète).
3. **Settings → Payouts / Crypto accounts** : ajoutez les adresses de
   réception (BTC, USDT-TRC20, ETH…) — sans wallet, aucun paiement ne peut
   être crédité.
4. **Settings → IPN** : ajoutez `https://nokhba.net.ly/api/payments/ipn`
   (l'URL est aussi envoyée à chaque paiement, ce double la fiabilité).
5. Si votre compte est en mode test, activez le sandbox (voir `NOWPAYMENTS_SANDBOX`).

### 2) Côté site (variables d'environnement)

| Variable | Effet |
| --- | --- |
| `NOWPAYMENTS_API_KEY` | **Requise** — clé API du marchand |
| `NOWPAYMENTS_IPN_SECRET` | Secret IPN — par défaut = clé API |
| `NOWPAYMENTS_EMAIL` / `NOWPAYMENTS_PASSWORD` | Optionnel — permet d'interroger le statut en direct (sinon : IPN seul) |
| `NOWPAYMENTS_SANDBOX` | `true` pour tester sur api-sandbox.nowpayments.io — environnements séparés et non interchangeables : clé sandbox ⇔ `true`, clé de production ⇔ vide/`false` (sinon `403 · INVALID_API_KEY`) |
| `NOWPAYMENTS_CURRENCY` | Devise de facturation — `usd` par défaut (la LYD n'est pas supportée par NOWPayments) |
| `SITE_URL` | URL publique pour les retours succès/annulation et l'IPN (variable serveur, non exposée au navigateur) |

### Notes

- Le site crée une **facture NOWPayments** (API `/invoice`) : c'est elle qui
  fournit la page de paiement hébergée (`invoice_url`) avec les retours
  `success_url` / `cancel_url`, et le client y choisit sa cryptomonnaie.
  Le `payment_id` est enregistré sur la commande dès le premier IPN, qui
  retrouve la commande par son `order_id` (référence `NKH-…`).
- Si le dialogue affiche « échec de création du paiement » à la validation :
  ouvrez `/api/health` — `nowpayments.apiKeyValid` teste la clé en réel
  (`GET /currencies`, sans créer de facture). `apiKeyValid:false` +
  `apiKeyError` donne le refus exact : vérifiez que la clé vient de
  Settings → API keys (et non du secret IPN) et qu'elle correspond à
  l'environnement visé (production ⇔ `NOWPAYMENTS_SANDBOX` vide/`false`,
  sandbox ⇔ `true`). `reachable:true` seul ne prouve rien : `GET /status`
  est public et ne contrôle pas la clé.
- Les prix s'affichent en د.ل mais sont facturés en USD : chaque formule a un
  `priceUsd` dans `src/lib/config.ts` (éditable aussi dans
  Admin → Configuration — laissé vide, la formule n'est plus payable en
  crypto). Ajustez-le selon votre taux de change.
- **Seul l'IPN (ou le statut `finished`/`confirmed`) confirme un paiement** —
  la redirection `success_url` n'est qu'une indication visuelle.
- La clé API ne quitte jamais le serveur : création du paiement, IPN et
  consultation du statut sont tous des appels serveur-à-serveur.
- Commandes visibles dans `/admin/orders` (nav « Paiements & réservations »)
  avec filtres par statut/type et détails (adresse, montant crypto, IPN brut).

## Classification des sites & réservation prioritaire (1 $)

Chaque site du portfolio est rattaché à une **catégorie** issue des formules
tarifaires (`vitrine` = catégorie 1, `vitrine-plus` = 2, `boutique` = 3…) et
affiche son **prix** sur les cartes de la galerie, la fiche du site et la
visionneuse plein écran.

- **Ordre des formules = numéro de catégorie** : réorganisez les formules dans
  Admin → Configuration → Tarifs pour changer la numérotation. Les noms et les
  prix USD/LYD de chaque catégorie s'y modifient aussi.
- **Par site** : Admin → Contenu → onglet « Démos » → bloc
  « Classification & prix du site ». On y choisit la formule, le numéro de
  catégorie et, si besoin, un **prix USD propre au projet** (vide = prix de la
  catégorie). Le récapitulatif (ex. `Catégorie 3 · Boutique · $880`) est
  affiché en direct.
- Les champs sont stockés avec la démo (`planId`, `categoryTier`, `priceUsd`)
  et restent compatibles avec les anciennes sauvegardes : la classification
  par défaut du code est reprise si elle manque.

### Réservation à 1 $ (acompte prioritaire)

Une offre « Réservez votre place » apparaît sur chaque site (galerie, fiche,
visionneuse plein écran) et permet de payer un **acompte de 1 $** via
NOWPayments pour prendre une place en avance dans le planning.

- Montant, équivalent LYD et activation : Admin → Configuration →
  **Réservation prioritaire** (1 $ / 6 د.ل par défaut).
- Le dialogue affiche la catégorie, le prix du projet et l'acompte, puis crée
  une commande `kind = reservation` (référence `RSV-…`) et une facture
  NOWPayments de 1 $.
- Confirmation par le même webhook IPN ; l'e-mail envoyé à l'agence précise
  qu'il s'agit d'une réservation et indique le site concerné (`demo_slug`).
- Admin → **Paiements crypto** : badge « Réservation », filtre
  « Réservations prioritaires », référence du site dans le détail.
- Si la passerelle n'est pas configurée, le dialogue propose un repli
  WhatsApp pré-rempli pour ne pas perdre la demande.
- Colonnes ajoutées automatiquement à la table `orders` : `kind`
  (`plan` | `reservation`) et `demo_slug`.

## SEO et référencement IA
- Métadonnées complètes par page (title, description, canonical, Open Graph
  ar_LY + alternate en_US, Twitter Card) générées via `src/lib/seo.ts`
- Données structurées JSON-LD servies dans le HTML initial : Organization,
  WebSite, ProfessionalService (SEO local, horaires, avis agrégé), FAQPage
  (7 Q/R), OfferCatalog (prix USD), BreadcrumbList, CollectionPage,
  CreativeWork pour chaque réalisation
- Aperçus des réalisations servis depuis `public/previews` (WebP desktop et
  mobile capturés par Playwright), déclarés dans le sitemap d'images et le
  JSON-LD ; API publique `GET /api/public/demos` pour les outils de capture
- `robots.ts` : accès public ouvert, `/api`, `/admin`, `/pay` fermés,
  crawlers IA explicitement autorisés (GPTBot, ClaudeBot, PerplexityBot,
  Google-Extended, CCBot…) ; `sitemap.ts` avec images des réalisations
- **Blog / guides** `/blog` et `/blog/[slug]` : 5 guides bilingues AR/EN
  (coût d'un site en Libye, choix d'une agence, lancement d'un e-commerce,
  visibilité ChatGPT/Google AI, site de clinique). Chaque article : réponse
  directe `#article-answer` (`speakable`), faits chiffrés, sections ancrées
  avec sommaire sticky, FAQ `FAQPage`, tableau tarifaire lu en direct depuis
  l'admin, schéma `BlogPosting` (dates + `wordCount`), carte OG dédiée et
  maillage vers services, secteurs et réalisations
- **Badge de netlinking client** `/badge` : page officielle avec extraits
  copiables (HTML, React/Next.js) et visuels SVG auto-hébergés
  (`public/badge/nukhba-badge{,-light}.svg`) à poser dans le pied de page de
  chaque site livré — lien dofollow vers `nokhba.net.ly`
  (`?utm_source=client_footer`, traçable). `npm run badge:audit` vérifie
  chaque site client (dofollow / nofollow / manquant / hors ligne) et alimente
  `public/badge/clients.json` ; workflow hebdomadaire + issue de suivi.
  Procédure : `docs/badge-netlinking.md`.
- `/llms.txt` et `/llms-full.txt` **dynamiques** (`src/lib/llms-txt.ts`) :
  résumé et base de connaissances bilingue régénérés par requête depuis la
  base admin, avec `ETag` pour la revalidation des crawlers IA
- **Pages services** `/services` et `/services/[service]` : une URL indexable
  par service à la carte (6 par défaut), avec réponse directe « answer-first »,
  FAQ bilingue, schéma `Service` + `Offer`, image Open Graph générée et
  maillage interne vers les secteurs et réalisations
- `manifest.ts` (PWA), `not-found.tsx` (404 noindex), pages de paiement noindex
- Les langues sont gérées côté client (pas d'URL /ar /en réelles) : aucun
  hreflang invalide n'est émis ; les redirections /ar et /en restent en place
- Vérification Google : fichier `public/googleaf….html` actif, ou meta-tag via
  la variable `GOOGLE_SITE_VERIFICATION`
- Détail complet de l'audit : `docs/seo-audit.md`
- Respect de `prefers-reduced-motion` via Framer Motion

### Automatisation SEO

- **Garde-fou local/CI** : `npm run seo:check` (`scripts/seo-check.mjs`) parcourt
  toutes les URLs du sitemap et vérifie title, description, canonical, h1 unique,
  JSON-LD parseable, absence de noindex accidentel et images sans `alt`. Code 1
  si erreur bloquante.
- **GitHub Actions** (`.github/workflows/seo.yml`) : à chaque PR/push, build →
  serveur → `seo:check` → Lighthouse (seuil SEO ≥ 90, bonnes pratiques ≥ 90,
  config `lighthouserc.json`).
- **OG images dynamiques** : `src/app/(site)/demos/[slug]/opengraph-image.tsx`
  génère une image de partage 1200×630 brandée par réalisation avec `next/og`
  (police Cairo TTF vendue dans `src/lib/fonts`, helper `src/lib/og-image.tsx`).
  Même principe pour chaque page service (`/services/[service]`) et chaque
  secteur (`/sectors/[sector]`, avec le nombre de réalisations du secteur).
- **IndexNow** : chaque sauvegarde admin (`src/app/admin/actions.ts`) notifie
  Bing/Yandex via `src/lib/indexnow.ts` (ping uniquement en production, tolérant
  aux pannes). Clé publique dans `public/<clé>.txt`, surcharge possible via
  `INDEXNOW_KEY`.
- **Google Search Console** : `src/lib/google-indexing.ts` soumet le sitemap à
  l'API officielle `sitemaps.submit` (le ping historique `google.com/ping` a été
  supprimé par Google). JWT RS256 signé avec `node:crypto`, sans dépendance.
  Activation : `GOOGLE_INDEXING_CLIENT_EMAIL` + `GOOGLE_INDEXING_PRIVATE_KEY`
  (+ éventuellement `GOOGLE_INDEXING_SITE_URL`, `sc-domain:` supporté). Sans
  configuration, l'appel est ignoré proprement — aucune sauvegarde admin
  n'échoue. `npm run doctor` affiche l'état de la configuration.
- **Pages services** : `/services` (hub) et `/services/{restyle, add-section,
  slides, branding, landing, fix-optimize}` — chaque page porte un `h1`, un
  résumé `speakable` (`#service-answer`), une FAQ `FAQPage`, un schéma `Service`
  + `Offer` synchronisé avec les tarifs admin, et une carte OG 1200×630.
- **Blog** : le contenu éditorial vit dans `src/lib/blog-articles.ts`
  (modèle dans `src/lib/blog.ts`) — ajouter un article suffit à le publier :
  page, sitemap, `/llms.txt`, `/llms-full.txt`, IndexNow, image OG et tests
  se mettent à jour automatiquement.
- **Captures d'aperçu** : `npm run previews:capture`
  (`scripts/capture-previews.mjs`) vérifie que chaque démo répond en HTTP 200,
  capture son rendu réel en ordinateur (1440×900 → 960×600) et téléphone
  (390×693), convertit en WebP q78 et met à jour
  `public/previews/manifest.json` — source unique du carrousel, du sitemap
  d'images et du JSON-LD `CreativeWork` (`image`, `screenshot`,
  `thumbnailUrl`), avec `?v=<empreinte>` pour invalider le cache sans renommer
  les fichiers. Une démo hors ligne conserve sa dernière capture (entrée
  `down`) au lieu de casser la page. Exécution hebdomadaire via
  `.github/workflows/demo-previews.yml` (lundi 07:00 UTC), pull request
  automatique si des visuels changent, issue `demo-preview` si un site client
  ne répond plus. `--dry-run`, `--force`, `--only=`, `--base=`, `--prune`,
  `--concurrency=`, `--max-age-days=` (codes de sortie 0/1/3/4 documentés dans
  `docs/preview-performance.md`).
- **GEO Tracker** : `npm run seo:geo` (`scripts/geo-citations.mjs`) interroge
  ChatGPT Search et Perplexity sur 10 requêtes commerciales AR/EN et mesure le
  taux de citation de la marque. Exécution hebdomadaire via
  `.github/workflows/geo-tracker.yml` (lundi 08:00 UTC), rapport JSON en
  artefact, e-mail optionnel via Resend. Sans clé API, rapport `skipped` sans
  échec du workflow.
- **Badge client** : `npm run badge:audit` (`scripts/badge-audit.mjs`) lit les
  démos (`--base=https://nokhba.net.ly` en CI), cherche le lien de crédit dans
  le HTML de chaque site client (racine, puis `/ar` et `/en`), distingue
  dofollow / nofollow / manquant / hors ligne, et n'écrit
  `public/badge/clients.json` que lorsqu'un statut change. Exécution
  hebdomadaire via `.github/workflows/badge-audit.yml` (lundi 07:30 UTC), avec
  ouverture/fermeture automatique d'une issue `badge-client` listant les sites
  à corriger. Aucune clé requise.
- Les fiches démos « live » exposent un h1 + une description `sr-only` dans le
  HTML initial (`standalone` de `FullscreenLiveViewer`) car le portail plein
  écran ne se monte qu'après hydratation.
- **Champs SEO éditables par projet** : dans /admin → Contenu → Démos, chaque
  réalisation propose `metaTitle` (≤ 60) et `metaDescription` (≤ 160) avec
  compteurs en direct. Un champ vide retombe automatiquement sur le titre et la
  description du projet (validation Zod, typage `Demo`, fallback dans
  `generateMetadata`).

## A personnaliser avant mise en ligne
1. Prix réels dans config.ts
2. Numéro WhatsApp réel
3. Adresse/email/horaires
4. Images réelles (remplacer Unsplash)
5. Logos clients (bande de confiance)
6. Domaine officiel (`nokhba.net.ly`) dans `src/lib/config.ts` (`domain` et `url`), utilisé aussi pour les métadonnées SEO.
7. GA/Plausible ID
8. Favicon/OG image dans public/
9. Textes légaux si besoin
10. Fournisseur d'e-mail (`RESEND_API_KEY` ou `SMTP_HOST`) pour les demandes de devis

## Performance
- next/image lazy, SSG, CSS variables, pas de gros JS
- Lighthouse 90+ visé — testez avec `npm run build && npx serve out`
- **Vercel Speed Insights** (`@vercel/speed-insights`, monté dans `src/app/(site)/layout.tsx` avec Web Analytics) mesure les Core Web Vitals réels (LCP, INP, CLS) des visiteurs du site public — `/admin` n'est pas mesuré. À activer une fois dans le tableau de bord Vercel (onglet *Speed Insights* → *Enable*), cf. `docs/production-vercel.md` §8

## RTL parfait
- dir dynamique, icônes directionnelles, animations inversées via `dir` context

## Panneau d'administration
- **URL** : `/admin` (connexion) — interface en français, accès protégé par session signée (7 jours)
- **Variable obligatoire** : `ADMIN_PASSWORD` (Settings → Environment Variables sur Vercel). Optionnel : `SESSION_SECRET` (sinon la session est signée avec ADMIN_PASSWORD)
- **Modules** :
  - **Tableau de bord** — statistiques (total, nouveaux, en cours, traités), activité 14 jours, dernières demandes
  - **Demandes** — les formulaires du site sont enregistrés en base (table `leads`, créée automatiquement) : filtres, recherche, statuts, notes internes, contact WhatsApp/email, export CSV
  - **Configuration** — apparence (thème, mode, langue), coordonnées, réseaux sociaux, chiffres, tarifs/catégories, **paiement flexible**, **services à la carte** et réservation prioritaire éditables, visibles immédiatement sur le site
  - **Contenu & sections** — toutes les sections du site public : **accueil (Hero)**, **bandeau de services**, **Pourquoi nous**, **démos**, **processus**, **témoignages**, **FAQ**, ainsi que les **titres/sous-titres de chaque section**. Listes à réordonner, ajouter ou supprimer, avec bouton « Réinitialiser » par section
- Les réglages sont stockés dans la table `settings` ; par défaut le site utilise les valeurs de `src/lib/config.ts` et `src/lib/content.ts`
- Après chaque enregistrement, le site public est régénéré automatiquement (revalidation Next.js)
- **Optionnel** : `WEBHOOK_URL` — si définie, chaque demande du formulaire est aussi envoyée vers ce webhook (Formspree, Make, Zapier…)
- **Optionnel** : `RESEND_API_KEY` ou `SMTP_HOST` — si un fournisseur d'e-mail est défini, chaque nouvelle demande déclenche une notification à l'agence et un accusé de réception au client
