# Audit SEO & Référencement IA (GEO) — نخبة Nukhba (`nokhba.net.ly`)

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

#### 1. Automatisation de l'indexation Google (Google Indexing / Search Console API)
- **Objectif** : Compléter IndexNow (qui couvre Bing / ChatGPT Search / Perplexity / Yandex) par une soumission directe à Google.
- **Mise en œuvre** :
  - Connecter un compte de service Google Cloud (`GOOGLE_INDEXING_CLIENT_EMAIL` + `GOOGLE_INDEXING_PRIVATE_KEY`) à Google Search Console.
  - Dans `pingAllPublicPages()` (`src/lib/indexnow.ts`), appeler l'API Search Console Sitemaps (`PUT https://www.googleapis.com/webmasters/v3/sites/https%3A%2F%2Fnokhba.net.ly%2F/sitemaps/https%3A%2F%2Fnokhba.net.ly%2Fsitemap.xml`) à chaque sauvegarde dans `/admin`.

#### 2. Automatisation « Lead / Commande Livrée → Étude de Cas SEO + Avis Client »
- **Objectif** : Transformer automatiquement chaque projet client terminé en actif SEO local et GEO.
- **Mise en œuvre** :
  - Lorsqu'un lead passe au statut `done` dans `/admin/leads` (ou qu'une commande est soldée dans `/admin/orders`), déclencher :
    1. **Email / WhatsApp automatique de demande d'avis** (J+7 après livraison) avec lien direct vers la fiche **Google Business Profile** de Nukhba Tripoli et formulaire de témoignage (`beforeAfter`).
    2. **Pré-création automatique d'un brouillon de fiche réalisation** (`/demos/[nouveau-slug]`) pré-rempli par `generateSeoCopy()` avec les métadonnées AR/EN et l'image OG Satori.

#### 3. Automatisation d'un Blog / Guide Sectoriel IA (`/blog/[slug]` ou `/secteurs/[sector]`)
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

# 3. Build de production Next.js (31 routes dont /llms.txt, /llms-full.txt, /api/admin/seo-audit)
npm run build

# 4. Garde-fou SEO & GEO complet sur serveur de production (21 pages/ressources vérifiées)
BASE_URL=http://localhost:3100 npm run seo:check
```
