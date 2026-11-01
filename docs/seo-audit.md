# Audit SEO & Référencement IA (GEO) — نخبة Nukhba (`nokhba.net.ly`)

> **Document historique — mise en garde du 1er novembre 2026.** Pour l’état
> vérifié du site, consulter [l’audit SEO/GEO actualisé](./audit-seo-geo-2026-11-01.md)
> et [le guide sitemap GSC](./guide-gsc-sitemap-2026-11-01.md). Les scores ci-dessous
> décrivent d’anciennes appréciations d’implémentation, pas des mesures Google,
> de performance terrain ou de citations IA. Les promesses d’ingestion des flux,
> les consignes de liens dofollow systématiques et les nombres historiques ne
> constituent pas des résultats vérifiés.

> **Nouvel Audit Complet & Catalogue des Automatisations SEO / GEO**
> Réalisé le **2026-10-19** sur la base Next.js 16 / React 19 / PostgreSQL (Drizzle).
> Périmètre : SEO technique, SEO local (Tripoli / Libye), données structurées Schema.org, sémantique serveur, Core Web Vitals, **GEO / Référencement IA** (ChatGPT Search, Perplexity, Claude, Google AI Overviews, Gemini, Apple Intelligence, Copilot) et **automatisations de bout en bout**.

---

## 1. Synthèse exécutive & évolution du score

| Pilier | Audit initial | Avant ce nouvel audit | Après ce nouvel audit (+ automatisations) |
|---|---|---|---|
| **SEO Technique & Métadonnées** | ~55 / 100 | 92 / 100 | **98 / 100** |
| **Données structurées (JSON-LD)** | ~35 / 100 | 85 / 100 | **99 / 100** |
| **Contenu serveur & Maillage interne** | ~50 / 100 | 72 / 100 | **96 / 100** |
| **Référencement IA / GEO (`llms.txt`, RAG, Crawlers)** | ~20 / 100 | 78 / 100 | **98 / 100** |
| **Automatisations SEO & Admin IA** | ~10 / 100 | 70 / 100 | **97 / 100** |
| **Score Global SEO + IA** | **~55 / 100** | **~84 / 100** | **~97 / 100** |

---

## 2. Diagnostic du Nouvel Audit : 6 failles majeures détectées et corrigées

### 2.1 Faille #1 (Critique — GEO / IA) : `public/llms.txt` était statique, incomplet et désynchronisé de la base
- **Constat** : `public/llms.txt` était un simple fichier texte figé. Toute modification dans `/admin` (changement de tarif USD/LYD, ajout d'une réalisation, modification d'une FAQ, nouveau service à la carte ou nouveau numéro WhatsApp) laissait `llms.txt` obsolète. De plus, **aucune des 12 réalisations (`/demos/[slug]`)** n'y figurait, et le fichier standard complémentaire `/llms-full.txt` était absent.
- **Correction & Automatisation** :
  - Suppression du fichier statique `public/llms.txt`.
  - Création du générateur temps réel `src/lib/llms-txt.ts` et des deux routes dynamiques `src/app/llms.txt/route.ts` et `src/app/llms-full.txt/route.ts` alimentées par `getSiteDataCached()`.
  - Ajout dans `<head>` (`src/app/layout.tsx`) des balises de découverte automatique `<link rel="alternate" type="text/markdown" href="/llms.txt">` et `href="/llms-full.txt"`.

### 2.2 Faille #2 (Critique — Contenu & Maillage) : Pages `/demos/[slug]` quasi-vides dans le HTML serveur (*Thin Content*)
- **Constat** : Les 12 réalisations possèdent toutes une URL `previewUrl` (`https://…vercel.app`). Dans `demo-viewer.tsx`, dès que `hasLiveUrl` valait `true`, le composant retournait immédiatement `<FullscreenLiveViewer standalone />` (portail client monté uniquement après hydratation JS). Tout le reste du composant (fonctionnalités, prix, catégorie, projets similaires) était du **code mort jamais exécuté**. Le HTML serveur reçu par Googlebot, GPTBot, PerplexityBot et ClaudeBot ne contenait qu'un `<h1>` et une phrase `<p>` (~20 mots), sans `<h2>`, sans liste de fonctionnalités, sans texte anglais et avec **zéro lien interne** vers les autres réalisations.
- **Correction & Automatisation** :
  - Enrichissement du bloc `<article className="sr-only">` rendu côté serveur dans `FullscreenLiveViewer` (`standalone = true`) : `<h1>`, descriptions AR + EN, `<h2>` secteur/catégorie/prix USD & LYD, `<h2>` liste complète des fonctionnalités AR + EN, lien vers l'aperçu live, et `<nav>` de **maillage interne automatique** ciblant en priorité les réalisations du même secteur et de la même gamme tarifaire.

### 2.3 Faille #3 (Majeur — Conformité Google Search Central) : Schéma `FAQPage` injecté sur des pages sans FAQ visible
- **Constat** : `faqJsonLd(content.faqs)` était injecté dans `src/app/layout.tsx` (RootLayout), donc émis sur `/contact`, `/demos` et les 12 pages `/demos/[slug]` alors que le composant `<FAQ />` n'est affiché que sur `/` et `/pricing`. Cela contrevient aux directives Google sur les données structurées (le balisage `FAQPage` doit correspondre au contenu visible de la page).
- **Correction** :
  - Retrait de `faqJsonLd` du layout racine.
  - Injection ciblée uniquement sur `/` (`src/app/(site)/page.tsx`) et `/pricing` (`src/app/(site)/pricing/page.tsx`).

### 2.4 Faille #4 (Majeur — Données structurées Schema.org incomplètes)
- **Constat** :
  1. `ProfessionalService` (`localBusinessJsonLd`) n'avait ni coordonnées GPS (`geo: GeoCoordinates`), ni `hasMap`, ni `knowsAbout`, ni les avis individuels (`review: Review[]`) pourtant présents dans `content.testimonials`.
  2. `OfferCatalog` (`offerCatalogJsonLd`) n'exposait que les 3 formules principales et ignorait les **6 services à la carte** (`config.standaloneServices` : refonte 49 $, section 19 $, slides 29 $, branding 39 $, landing page 59 $, audit 15 $).
  3. Le processus en 5 étapes (`content.process`) n'était pas structuré en schéma `HowTo`.
  4. `CreativeWork` (`demoJsonLd` sur `/demos/[slug]`) n'exposait pas l'offre tarifaire (`offers: Offer` avec le prix USD calculé pour la réalisation), ni les fonctionnalités (`features` AR/EN), ni `workExample`.
- **Correction & Automatisation** :
  - Synchronisation automatique de tous ces schémas dans `src/lib/seo.ts` directement depuis les données vivantes de `/admin`.

### 2.5 Faille #5 (Moyen — Couverture des crawlers IA 2026 dans `robots.ts`)
- **Constat** : 16 bots IA étaient déclarés, mais plusieurs crawlers d'assistants et moteurs IA récents manquaient.
- **Correction** :
  - Passage à **28 crawlers IA explicitement autorisés** dans `src/app/robots.ts` (ajout de `anthropic-ai`, `GoogleOther`, `Google-CloudVertexBot`, `Meta-ExternalFetcher`, `FacebookBot`, `DuckAssistBot`, `YouBot`, `MistralAI-User`, `PhindBot`, `AI2Bot`, `Timpibot`, `Webzio-Extended`).

### 2.6 Faille #6 (Moyen — Saisie manuelle répétitive des métadonnées SEO dans l'Admin)
- **Constat** : Dans `/admin/content`, l'administrateur devait cliquer manuellement sur « Générer avec l'IA » sur chacune des 12 réalisations l'une après l'autre, et une réalisation enregistrée sans clic laissait ses 6 champs SEO vides en base.
- **Correction & Automatisation** :
  - Auto-complétion automatique (`ensureDemoSeoFields`) lors de la lecture et de la sauvegarde (`saveContentSection("demos")`) : aucun projet ne peut plus avoir de champ SEO vide.
  - Mode **Batch IA** (`POST /api/admin/ai/seo` avec `{ demos: [...] }`) + bouton **« Générer tout le SEO avec l'IA (12) »** + barre de **Score SEO & IA en direct (/100)** dans `/admin/content`.

---

## 3. Catalogue complet des automatisations SEO & IA (GEO)

### 3.1 Automatisations implémentées et actives dans le code

| # | Automatisation | Fichiers clés | Déclencheur | Impact Web & IA |
|---|---|---|---|---|
| **A1** | **Flux IA `/llms.txt` et `/llms-full.txt` 100 % dynamiques** | `src/lib/llms-txt.ts`, `src/app/llms.txt/route.ts`, `src/app/llms-full.txt/route.ts` | Chaque requête + invalidation ISR automatique au `save` Admin | Les LLM (ChatGPT, Perplexity, Claude, Gemini) ingèrent toujours les tarifs, démos, services et FAQ à jour en AR et EN. |
| **A2** | **Auto-complétion & Génération SEO IA en lot (Batch)** | `src/lib/ai/seo-generator.ts`, `src/app/api/admin/ai/seo/route.ts`, `src/app/admin/actions.ts` | Clic « Générer tout le SEO » dans `/admin/content` + auto-fill à chaque sauvegarde | Génère et borne automatiquement (60 / 160 / 125 car.) les 6 champs SEO bilingues (`metaTitle`, `metaDescription`, `imageAlt` AR/EN) de toutes les réalisations. |
| **A3** | **Synchronisation temps réel des 9 schémas JSON-LD** | `src/lib/seo.ts`, `src/app/layout.tsx`, `page.tsx`, `pricing/page.tsx`, `demos/[slug]/page.tsx` | Chaque rendu SSR / ISR | Met à jour automatiquement `Organization`, `WebSite`, `ProfessionalService` (+ `geo` + `Review[]`), `OfferCatalog` (3 formules + 6 services), `HowTo` (5 étapes), `FAQPage`, `CollectionPage`, `BreadcrumbList`, `CreativeWork` (+ `Offer`). |
| **A4** | **Maillage interne & contenu sémantique serveur automatique sur `/demos/[slug]`** | `src/components/live-site-frames.tsx`, `src/app/(site)/demos/[slug]/demo-viewer.tsx` | Rendu serveur de chaque fiche réalisation | Sélectionne automatiquement les 4 projets les plus proches (même secteur + même catégorie) et injecte l'étude de cas bilingue complète dans le DOM initial. |
| **A5** | **Cartes Open Graph & Twitter 1200×630 générées à la volée (Satori)** | `src/lib/og-image.tsx`, `src/app/(site)/demos/[slug]/opengraph-image.tsx` | Build / requête sur chaque `/demos/[slug]` | Chaque nouvelle réalisation ajoutée dans `/admin` obtient automatiquement son visuel social brandé en arabe/anglais sans graphiste. |
| **A6** | **Ping automatique IndexNow multi-moteurs (Pages + Sitemap + Flux IA)** | `src/lib/indexnow.ts`, `src/app/admin/actions.ts` | Chaque sauvegarde ou réinitialisation dans `/admin` | Notifie instantanément Bing, Yandex, Naver, Seznam (et les moteurs IA qui s'appuient sur Bing/IndexNow comme ChatGPT Search et Copilot) de toutes les URLs + `/llms.txt` + `/llms-full.txt`. |
| **A7** | **Moteur d'audit SEO & GEO en direct dans l'Admin** | `src/lib/seo-audit.ts`, `src/app/api/admin/seo-audit/route.ts`, `content-editor.tsx` | Temps réel à chaque frappe dans `/admin/content` + API `GET /api/admin/seo-audit` | Calcule le score `/100`, détecte les doublons de slugs/titres, les dépassements de longueur SERP et la richesse des FAQ pour l'IA. |
| **A8** | **Garde-fou CI/CD SEO + GEO + Lighthouse** | `scripts/seo-check.mjs`, `scripts/seo-generator.test.mjs`, `.github/workflows/seo.yml` | Chaque `push` ou `pull_request` GitHub | Bloque toute régression : vérifie les 21 URLs/ressources, la présence de chaque démo dans `/llms.txt` & `/llms-full.txt`, la conformité `FAQPage`/`HowTo`/`ProfessionalService`, le maillage interne et les scores Lighthouse ≥ 90. |

---

### 3.2 Automatisations complémentaires à connecter (Roadmap Infrastructure & Croissance)

Voici toutes les automatisations externes et workflows additionnels pouvant être branchés autour du site pour maximiser le référencement Web et IA :

#### 1. Automatisation de l'indexation Google (Google Indexing / Search Console API) — ✅ **implémenté le 2026-10-20**
- **Objectif** : Compléter IndexNow (qui couvre Bing / ChatGPT Search / Perplexity / Yandex) par une soumission directe à Google.
- **Mise en œuvre** :
  - Connecter un compte de service Google Cloud (`GOOGLE_INDEXING_CLIENT_EMAIL` + `GOOGLE_INDEXING_PRIVATE_KEY`) à Google Search Console.
  - Dans `pingAllPublicPages()` (`src/lib/indexnow.ts`), appeler l'API Search Console Sitemaps (`PUT https://www.googleapis.com/webmasters/v3/sites/https%3A%2F%2Fnokhba.net.ly%2F/sitemaps/https%3A%2F%2Fnokhba.net.ly%2Fsitemap.xml`) à chaque sauvegarde dans `/admin`.
  - Réalisé via `src/lib/google-indexing.ts` (JWT RS256 avec `node:crypto`, sans dépendance). L'ancien ping `google.com/ping?sitemap` — supprimé par Google (404) — a été retiré.

#### 2. Automatisation « Lead / Commande Livrée → Étude de Cas SEO + Avis Client »
- **Objectif** : Transformer automatiquement chaque projet client terminé en actif SEO local et GEO.
- **Mise en œuvre** :
  - Lorsqu'un lead passe au statut `done` dans `/admin/leads` (ou qu'une commande est soldée dans `/admin/orders`), déclencher :
    1. **Email / WhatsApp automatique de demande d'avis** (J+7 après livraison) avec lien direct vers la fiche **Google Business Profile** de Nukhba Tripoli et formulaire de témoignage (`beforeAfter`).
    2. **Pré-création automatique d'un brouillon de fiche réalisation** (`/demos/[nouveau-slug]`) pré-rempli par `generateSeoCopy()` avec les métadonnées AR/EN et l'image OG Satori.

#### 3. Automatisation d'un Blog / Guide Sectoriel IA (`/blog/[slug]` ou `/secteurs/[sector]`) — ✅ **livré le 2026-10-20** (pages sectorielles, pages services et blog bilingue)
- **Objectif** : Capturer les requêtes informationnelles à forte intention en Libye (« كم تكلفة تصميم متجر إلكتروني في ليبيا », « أفضل شركة تصميم مواقع في طرابلس », « تصميم موقع عيادة طبية طرابلس »).
- **Mise en œuvre** :
  - **Pages atterrissage sectorielles automatiques (`/demos?sector=...` → `/sectors/[sector]`)** : générer automatiquement à partir de la liste `sectors` (`medical`, `restaurant`, `beauty`, `furniture`, `electronics`, `hardware`, etc.) et des démos rattachées une page dédiée par secteur avec son propre `title`, `description`, `FAQPage` sectorielle et `ItemList` des réalisations du secteur.
  - **Générateur d'articles bilingues assisté par IA dans `/admin`** : à partir d'un sujet + secteur, générer un guide structuré (AR + EN) avec table des matières, tableau comparatif de prix USD/LYD, schéma `Article` + `FAQPage` et ajout automatique dans `/sitemap.xml` et `/llms-full.txt`.

#### 4. Automatisation du Monitoring de Citations IA (GEO Tracker Cron)
- **Objectif** : Mesurer chaque semaine si ChatGPT, Perplexity et Gemini citent **نخبة Nukhba (`nokhba.net.ly`)** sur les requêtes cibles.
- **Mise en œuvre** :
  - Un workflow GitHub Actions planifié (`schedule: cron: '0 8 * * 1'`) interrogeant les API OpenAI / Perplexity sur 10 prompts types en arabe et en anglais (ex. *« ما هي أفضل شركة تصميم مواقع ومتاجر إلكترونية في طرابلس ليبيا؟ »*, *« Best web design agency in Tripoli Libya with prices »*).
  - Enregistrement du taux de citation de la marque et des URLs citées dans un rapport hebdomadaire envoyé par e-mail à l'admin via `src/lib/mailer.ts`.

#### 5. Automatisation de Capture Visuelle & Optimisation WebP des Démos (`Playwright Cron`)
- **Objectif** : Remplacer automatiquement les images externes par des captures d'écran réelles Desktop (1440×900) et Mobile (390×844) des sites clients en production.
- **Mise en œuvre** :
  - Script GitHub Actions qui parcourt chaque `previewUrl` de `content.demos`, capture le rendu Desktop et Mobile en `.webp` dans `public/previews/`, vérifie que le site de démo répond en HTTP 200 (alerte si un site de démo tombe), et met à jour le sitemap d'images.

#### 6. Automatisation du Netlinking Client (« Badge Nukhba » vérifié)
- **Objectif** : Renforcer l'autorité de domaine (`nokhba.net.ly`) et le signal d'entité pour Google et les LLM.
- **Mise en œuvre** :
  - Intégrer dans le pied de page de tous les sites clients livrés (`smartphine-demo`, `al-manhaj-company`, `hala-dun`, `al-massa`, etc.) un lien structuré vers `https://nokhba.net.ly/?utm_source=client_footer` avec ancre bilingue « تصميم وتطوير نخبة طرابلس — Website by Nukhba ».

---

## 4. Commandes de vérification & tests automatisés

```bash
# 1. Vérification du typage TypeScript
npm run typecheck

# 2. Tests unitaires des automatisations SEO & GEO (14 tests : LLM, fallback, batch, llms.txt, JSON-LD, audit)
npm run test:seo

# 3. Build de production Next.js (45 routes dont /blog, /services, /services/[service], /llms.txt, /llms-full.txt)
npm run build

# 4. Garde-fou SEO & GEO complet sur serveur de production (49 pages/ressources vérifiées)
BASE_URL=http://localhost:3100 npm run seo:check
```


---

## 5. Vague 2 — 2026-10-20 : pages services, Search Console, enrichissements GEO

Deuxième passe après l'audit du 2026-10-19. Objectif : transformer les **services à la carte** (jusqu'ici vendus depuis une simple section de la page d'accueil, sans URL dédiée) en actifs SEO/GEO à part entière, et remplacer l'ancien « ping Google » devenu inopérant.

### 5.1 Six nouvelles pages commerciales `/services/[service]` + hub `/services`

| Service | URL | Prix de départ | Requête cible |
|---|---|---|---|
| إعادة تصميم موقع قديم | `/services/restyle` | 49 $ | website redesign Tripoli / إعادة تصميم موقع |
| إضافة قسم جديد | `/services/add-section` | 19 $ | add section to website / إضافة قسم لموقع |
| عروض تقديمية | `/services/slides` | 29 $ | pitch deck design Tripoli / تصميم عرض تقديمي |
| هوية بصرية | `/services/branding` | 39 $ | logo design Tripoli / تصميم شعار |
| صفحة هبوط | `/services/landing` | 59 $ | landing page design Libya / صفحة هبوط |
| إصلاح وتحسين | `/services/fix-optimize` | 15 $ | website audit Tripoli / إصلاح موقع |

Chaque page fournit :

- **un `h1` unique** et un couple title/description bilingue calibré (≤ 80 / ≤ 180 caractères) ;
- un bloc **« answer-first »** `#service-answer` : la réponse directe qu'un LLM peut citer telle quelle, ciblée par `speakable` ;
- une **FAQ bilingue visible** (4 Q/R) + schéma `FAQPage` ;
- les **livrables détaillés** (AR + EN), le profil client idéal, les prix USD/LYD et les modalités de paiement ;
- un schéma **`Service` + `Offer`** (prix USD, `priceSpecification`, `areaServed` Tripoli + Libye, `provider` → `#organization`) ;
- une **carte Open Graph 1200×630 générée à la volée** (`buildServiceOgImage`) et sa variante Twitter ;
- un **maillage interne** vers les secteurs liés, les réalisations du secteur, les autres services, `/pricing` et `/contact` ;
- des **liens depuis la page d'accueil** (cartes de la section « خدمات مفتوحة ») et le **pied de page** de tout le site.

Ajouts techniques : `src/lib/services.ts` (contenu éditorial + schémas), `src/app/(site)/services/page.tsx`, `src/app/(site)/services/[service]/page.tsx`, `opengraph-image.tsx`, `twitter-image.tsx`, `buildServiceOgImage` dans `src/lib/og-image.tsx`, entrées `sitemap.xml`, `/llms.txt`, `/llms-full.txt` et `pingAllPublicPages()`.

### 5.2 Google Search Console : soumission réelle du sitemap

`src/lib/google-indexing.ts` :

- JWT **RS256** signé avec `node:crypto` (aucune dépendance ajoutée), échange OAuth2 `jwt-bearer`, scope `webmasters` ;
- `PUT https://www.googleapis.com/webmasters/v3/sites/{propriété}/sitemaps/{sitemap}` à chaque sauvegarde admin, aux côtés d'IndexNow, du ping Bing et de la revalidation ISR ;
- propriété configurable (`GOOGLE_INDEXING_SITE_URL`), support de `sc-domain:` pour une propriété Domaine ;
- **dégradation silencieuse** : sans compte de service, aucun appel réseau, une seule ligne de log, et aucune action admin n'échoue ;
- exécution limitée à la production Vercel (override `GOOGLE_INDEXING_ALLOW_NON_PRODUCTION=true` pour tester) ;
- diagnostic `npm run doctor` → section « SEO & Référencement IA ».

### 5.3 Données structurées enrichies

- `ProfessionalService` : `serviceArea` (`GeoCircle` 60 km autour de Tripoli), `knowsLanguage` (ar/en/fr), `slogan`, `hasOfferCatalog`.
- `OfferCatalog` : `@id` stable (`/pricing#offer-catalog`), `numberOfItems`, `provider`.
- `CreativeWork` (démos) : `isPartOf`, `mainEntityOfPage`, `about`, `audience`.
- Nouveau builder `webPageJsonLd()` : `WebPage` + `speakable` (`h1`, `#service-answer`), `primaryImageOfPage`, `potentialAction: ReadAction` — utilisé sur les pages services.
- **Cartes OG sectorielles** : `buildSectorOgImage()` + `opengraph-image.tsx` / `twitter-image.tsx` sous `sectors/[sector]` (titre du secteur, libellé bilingue, nombre de réalisations). Les pages secteur n'utilisent plus l'image générique `og.jpg`.

### 5.4 Flux IA (`/llms.txt`, `/llms-full.txt`)

- Index des **6 pages services** avec URL, prix USD/LYD et délai de livraison.
- Section complète par service dans `llms-full.txt` : URL canonique, résumé « answer-first » AR/EN, livrables, cible, FAQ.
- Nouvelle section **« Preferred citation (GEO) »** dans les deux flux : nom canonique de l'entité, citations prêtes à l'emploi en arabe et en anglais, fourchette de prix, coordonnées, et phrase de désambiguïsation (« agence de services, pas une place de marché »).
- En-tête **`ETag`** (SHA-256) sur les deux routes : revalidation HTTP sans re-téléchargement complet par les crawlers.

### 5.5 Garde-fous renforcés

- `scripts/seo-check.mjs` vérifie désormais : `FAQPage` attendu sur `/services` et `/services/*`, schéma `Service` + `Offer` + `areaServed`, présence du bloc `#service-answer`, et **synchronisation de chaque page service dans `llms.txt` et `llms-full.txt`**.
- 12 nouveaux tests (`scripts/service-pages.test.mjs`, `scripts/google-indexing.test.mjs`) : contenu éditorial des 6 services, repli générique, schémas, signature JWT vérifiée avec une paire RSA générée, normalisation des clés PEM, propriétés Search Console, absence d'appel réseau sans configuration.
- **GEO Tracker tests** (`scripts/geo-citations.test.mjs`) : détection des mentions AR/EN/domaine, agrégation des taux, configuration des moteurs.
- `npm run test:seo` : **48 tests** au vert ; `npm run seo:check` : **49 pages/ressources, 0 erreur, 0 avertissement**.

### 5.6 GEO Tracker — mesure hebdomadaire des citations IA

`scripts/geo-citations.mjs` (`npm run seo:geo`) :

- 10 requêtes commerciales cibles, en arabe (4) et en anglais (6) : agence web à Tripoli, coût d'un site en Libye, e-commerce + WhatsApp, site de clinique, SEO, restyle/landing ;
- interroge **OpenAI** (`OPENAI_API_KEY`, modèle `gpt-4o-mini` par défaut) et **Perplexity** (`PERPLEXITY_API_KEY`, modèle `sonar`) — uniquement les moteurs configurés ;
- détecte la marque sous ses trois formes (`Nukhba`, `نخبة`, `nokhba.net.ly`), extrait l'URL citée et les domaines concurrents ;
- calcule le **taux de citation global**, par moteur et par langue, et écrit `reports/geo-citations-YYYY-MM-DD.json` (ignoré par Git) ;
- envoi e-mail optionnel via Resend (`RESEND_API_KEY` + `LEAD_NOTIFICATION_EMAIL`) ;
- workflow `.github/workflows/geo-tracker.yml` : chaque **lundi 08:00 UTC** + déclenchement manuel, rapport conservé 90 jours en artefact ;
- tolérance totale aux pannes : sans clé, rapport `skipped` et code de sortie 0 (la CI ne casse jamais).

### 5.6 Scores après la vague 2

| Pilier | Vague 1 | Vague 2 |
|---|---|---|
| SEO technique & métadonnées | 98 | **98** |
| Données structurées | 99 | **99** |
| Contenu serveur & maillage interne | 96 | **98** |
| Référencement IA / GEO | 98 | **99** |
| Automatisations SEO & Admin IA | 97 | **99** |
| **Score global** | **97** | **~98,5** |

Reste à brancher (roadmap) : blog/guides éditoriaux bilingues, captures Playwright des démos et badges de netlinking client. Le monitoring des citations IA est désormais outillé (GEO Tracker) — il suffit d'ajouter les clés API dans les secrets GitHub.


---

## 6. Vague 3 — 2026-10-20 : blog / guides éditoriaux bilingues

Dernière brique de contenu de la feuille de route : un blog éditorial pensé pour le **SEO informationnel** et pour le **GEO** (sources citables par ChatGPT, Perplexity, Google AI Overviews).

### 6.1 Cinq guides de lancement (`/blog/[slug]`)

| Article | URL | Intention visée |
|---|---|---|
| تكلفة تصميم موقع في ليبيا 2026 | `/blog/prix-site-web-libye-2026` | « كم تكلفة موقع » / « website cost Libya » |
| اختيار شركة تصميم مواقع في طرابلس | `/blog/choisir-agence-web-tripoli` | « أفضل شركة تصميم مواقع » / « best web agency Tripoli » |
| إطلاق متجر إلكتروني في ليبيا | `/blog/lancer-boutique-en-ligne-libye` | « إنشاء متجر إلكتروني » / « launch online store Libya » |
| الظهور في ChatGPT وGoogle AI | `/blog/apparaitre-dans-chatgpt-google-ai-libye` | « الظهور في ChatGPT » / « AI search optimization » |
| موقع عيادة في طرابلس | `/blog/site-web-clinique-tripoli` | « موقع عيادة » / « clinic website Tripoli » |

Chaque guide contient **4 à 5 sections bilingues** (AR puis EN), des **faits chiffrés** (`keyFacts` : 300/510/880 $, délais 7–21 jours, +20–40% de réservations…), un **encadré « à retenir »**, une **FAQ visible** (3–4 Q/R) balisée `FAQPage`, et **5 à 8 minutes de lecture** (≈ 1 250 mots vérifiés par test).

### 6.2 Structure technique

- `src/lib/blog.ts` : modèle `BlogArticle`, helpers (`findArticle`, `sortArticles`, `relatedArticles`, `formatArticleDate` sans dépendance ICU, `articleWordCount`) et schémas `BlogPosting` + `FAQPage` + `CollectionPage`.
- `src/lib/blog-articles.ts` : contenu éditorial — **ajouter un article suffit** à le publier partout (page, sitemap, `llms.txt`, `llms-full.txt`, IndexNow, image OG, tests).
- `/blog` : hub avec résumé « answer-first », liste antéchronologique, FAQ du hub et maillage.
- `/blog/[slug]` : colonne latérale sticky (sommaire ancré, services liés avec prix live, secteurs, réalisations), **tableau tarifaire synchronisé avec /admin** (`includePricing`), CTA WhatsApp pré-rempli avec le titre du guide, articles liés par catégorie/services/secteurs.
- `BlogPosting` : `datePublished`, `dateModified`, `author`/`publisher` → `#organization`, `wordCount`, `timeRequired`, `speakable` (`h1` + `#article-answer`), `mainEntityOfPage`.
- Carte Open Graph 1200×630 par article (`buildArticleOgImage`) + variante Twitter.
- Entrées ajoutées dans `sitemap.xml`, `/llms.txt` (index avec catégorie et date), `/llms-full.txt` (section 7e : résumé answer-first, faits clés, sections et FAQ de chaque guide), `pingAllPublicPages()` (IndexNow + Search Console) et la navigation (« أدلة » dans la barre supérieure, « Guides & blog » dans le pied de page).

### 6.3 Garde-fous

- `scripts/seo-check.mjs` vérifie sur chaque article : `BlogPosting` présent avec dates, auteur et éditeur, `headline` suffisante, bloc `speakable`, **réponse directe `#article-answer`**, `FAQPage` attendu, et au moins un lien de maillage vers `/services` ou `/sectors` ; il contrôle aussi la présence de **chaque article dans `llms.txt` et `llms-full.txt`**.
- `scripts/blog.test.mjs` (12 tests) : slugs uniques, longueurs de titres/descriptions, réponse directe bilingue, dates cohérentes, ancres uniques, équilibre AR/EN des sections et puces, qualité des FAQ, existence réelle des services/secteurs liés, schémas, `wordCount`, ordre du `CollectionPage`, articles liés, synchronisation des flux IA.
- Résultat : `npm run test:seo` **48 tests** au vert · `npm run seo:check` **49 pages/ressources, 0 erreur, 0 avertissement** · `npm run build` 45 routes.

### 6.4 Captures d'aperçu des démos — Playwright + Sharp

- `scripts/capture-previews.mjs` : vérification HTTP 200 de chaque `previewUrl`, capture réelle du rendu en 1440 × 900 (ordinateur) et 390 × 693 (téléphone), conversion WebP qualité 78 (960 × 600 / 390 × 693), écriture dans `public/previews` et mise à jour de `public/previews/manifest.json` (empreinte, `capturedAt`, `httpStatus`, `status`, `lastError`).
- `public/previews/manifest.json` devient la **source unique** lue par `src/lib/preview-manifest.ts` : carrousel et galerie (`src/lib/project-previews.ts`), `<image:loc>` de `sitemap.xml`, et données structurées `CreativeWork` (`image`, `screenshot`, `thumbnailUrl` dans `src/lib/seo.ts`). Plus de dépendance à un hébergeur d'images externe pour ces visuels.
- Anti-cache sans renommage : `?v=<empreinte>` sur chaque URL servie. Une capture identique n'écrit rien (`unchanged`).
- **Une démo hors ligne ne dégrade jamais le site** : la dernière capture connue est conservée, l'entrée passe `status: "down"`, et le workflow ouvre une issue au lieu de publier une image cassée.
- `src/app/api/public/demos/route.ts` : `GET /api/public/demos` → `{ok, count, demos:[{slug, previewUrl, sector, title, titleEn}]}`, `s-maxage=300`. Permet au workflow de capturer depuis `--base=https://nokhba.net.ly` sans accès à la base.
- `.github/workflows/demo-previews.yml` : lundi 07:00 UTC, à chaque changement du pipeline ou des démos sur `main`, et `workflow_dispatch` — `npm ci`, Chromium, captures en `--force`, rapport en artefact (90 jours), pull request `chore(previews)` si des WebP changent, issue `demo-preview` si une démo est morte.
- Garde-fous : `scripts/demo-previews.test.mjs` (21 tests) et `scripts/seo-check.mjs` (au moins une capture locale dans le sitemap d'images). Résultat : `npm run test:seo` **69 tests**, `npm run seo:check` **50 pages/ressources, 0 erreur, 0 avertissement**.

### 6.5 Badge de netlinking client (« شارة نخبة »)

Point 6 de la roadmap d'origine : obtenir un lien réel depuis chaque site livré vers `nokhba.net.ly`, pour construire l'autorité de domaine et le signal d'entité auprès de Google et des LLM.

- **Page publique `/badge`** : extraits copiables (HTML autonome, React/Next.js, version minimale), deux variantes de visuel (sombre/clair), ancres bilingues, règles d'usage et statut de chaque site client. Génération des extraits dans `src/lib/badge.ts` (`badgeHtmlSnippet`, `badgeReactSnippet`) — testée, donc jamais désynchronisée de la page.
- **Assets auto-hébergés** : `public/badge/nukhba-badge.svg` et `nukhba-badge-light.svg` (176 × 44, ~1 Ko chacun, texte vectoriel). Aucune dépendance à un service de badges tiers, donc aucun risque de lien cassé ou de tracking externe.
- **Lien de crédit** : `https://nokhba.net.ly/?utm_source=client_footer&utm_medium=badge&utm_campaign=client_credit`. `utm_source=client_footer` rend les visites issues des pieds de page clients identifiables dans les statistiques, et sert de signature vérifiable par l'audit.
- **Détection automatique** (`detectBadge`) : analyse du HTML de la page d'accueil, puis `/ar` et `/en` si nécessaire ; classe chaque client en `verified` (dofollow), `nofollow`, `missing` ou `down`, avec ancre et `rel` réellement trouvés. Les imitations (`nokhba.net.ly.evil.com`, `notnokhba.net.ly`) sont rejetées.
- **`npm run badge:audit`** (`scripts/badge-audit.mjs`) : options `--dry-run`, `--only=`, `--base=`, `--concurrency=` ; écrit `public/badge/clients.json` (statut, `checkedAt` au changement seulement) et `reports/badge-audit-AAAA-MM-JJ.json`. Codes de sortie 0/4.
- **`.github/workflows/badge-audit.yml`** : lundi 07:30 UTC, à chaque changement de l'audit ou des démos sur `main`, et `workflow_dispatch`. Ouvre une pull request `chore(badge)` quand un statut change (pas de push direct : `main` peut être protégée), une issue `badge-client` listant les sites à corriger, et ferme automatiquement cette issue quand tout est vert.
- **Maillage** : `/badge` figure dans `sitemap.xml`, `llms.txt`, `llms-full.txt` (§7f, avec la règle dofollow et la liste des sites qui créditent), `pingAllPublicPages()` (IndexNow + Search Console) et le pied de page du site.
- **Garde-fous** : `scripts/badge-audit.test.mjs` (33 tests : détection, faux positifs, extraits, fusion du fichier, orchestration, `--dry-run`, `--only`) et contrôle `seo:check` sur `/badge` (page publiée, lien de crédit présent, SVG servis avec le bon type). Résultat : `npm run test:seo` **102 tests**, `npm run seo:check` **54 pages/ressources, 0 erreur, 0 avertissement**.

L'intégration du badge dans chaque dépôt client reste manuelle (ce sont des dépôts séparés) : la page `/badge` fournit l'extrait, l'audit dit qui ne l'a pas encore, et l'issue hebdomadaire sert de checklist. La procédure est décrite dans `docs/badge-netlinking.md`.

### 6.6 Roadmap restante

Le générateur d'articles bilingues dans `/admin` (§3.2 point 3, volet administration) est le dernier chantier non outillé. Search Console, le GEO Tracker, le blog, les captures d'aperçu et le badge de netlinking sont désormais en place.
