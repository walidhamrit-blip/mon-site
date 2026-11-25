# Audit Complet & Optimisation SEO / GEO (`claude-seo` v2.6.2) — 24 novembre 2026

Ce rapport documente l'exécution intégrale du workflow en **5 étapes** décrit dans `guia-seo-claude.pdf` (basé sur [`AgriciDaniel/claude-seo`](https://github.com/AgriciDaniel/claude-seo) v2.6.2) sur l'ensemble des **144 URLs publiques du sitemap** (72 routes × AR/EN) ainsi que les flux IA (`/robots.txt`, `/llms.txt`, `/llms-full.txt`, `/sitemap.xml`) de **نخبة Nukhba (`nokhba.net.ly`)**.

---

## 1. Synthèse Avant / Après (144 URLs du sitemap + flux techniques)

| Contrôle / Outil | Avant | Après | Résultat |
|---|---:|---:|---|
| **`npm run seo:check`** (155 ressources/pages) | 0 erreur · **7 avertissements** | **0 erreur · 0 avertissement** | 100 % propre |
| `Medium:images-missing-dimensions` (CLS — `<img width/height>`) | **54 URLs** | **0 URL** | -100 % |
| `Medium:first-image-lazy-loaded` (LCP retardé sur le visuel principal) | **30 URLs** | **0 URL** | -100 % |
| `Medium:title-too-short` (`< 30` caractères) | **13 URLs** | **0 URL** | -100 % |
| `brand-suffix-in-description` (`metadata_template.py`) | **11 URLs** | **0 URL** | -100 % |
| `Medium:thin-content` (`< 300` mots sur pages indexables) | **5 URLs** | **0 URL** | -100 % |
| `Medium:meta-description-too-long` (`> 160` car.) | **2 URLs** (+ 4 encodages `&amp;`) | **0 URL** | -100 % |
| `Medium:title-not-reflected-in-content` (`/demos` AR & EN) | **2 URLs** | **0 URL** | -100 % |
| `Low:generic-anchor-text` (`Details` sur `/codes?lang=en`) | **1 URL** | **0 URL** | -100 % |
| `duplicate-meta-tags` (`meta robots` dupliqué sur 404) | **2 URLs** | **0 URL** (404 propre) | Corrigé |
| JSON-LD monolingue sur pages bilingues (`BreadcrumbList` / `CollectionPage` / `WebPage`) | **13 routes** | **0 route** (100 % AR/EN) | -100 % |
| **`preload_check.py`** (`Speculation Rules` + `fetchpriority="high"`) | **25 / 100** | **75 / 100** | +50 pts |
| **`agentic_check.py`** — `llms.txt` anomalies de format (`llmstxt.org`) | **13 notes** (7 `malformed-link`, 5 `empty-section`, 1 `duplicate-link`) | **0 anomalie** | 100 % conforme |
| **`agentic_check.py`** — `robots.txt` bots IA (`Claude-SearchBot`, `Claude-User`, RFC 9309) | 1 token non standard (`AI2Bot`), 2 bots Claude absents | **P0 3/3 PASS · 0 warning** | 100 % conforme |
| Images publiques `> 200 Ko` (`public/live-demos/cinematic-scroll/images/`) | **5 fichiers** (jusqu'à 415 Ko) | **0 fichier `> 200 Ko`** (127–188 Ko) | Allégé (-54 %) |
| **`drift_compare.py`** (34 routes de référence capturées avant modifications) | Baseline enregistrée | **0 régression CRITIQUE** | Validé |

> **Note de conformité :** conformément aux règles commerciales de `docs/2026-11-23-offre-sites-unifiee.md`, ces optimisations constituent des pré-requis techniques vérifiables (balisage, vitesse de rendu, structure sémantique, conformité `llmstxt.org`) ; aucun classement Google ni citation par un moteur IA n'est promis ou garanti.

---

## 2. Exécution détaillée des 5 étapes du guide (`guia-seo-claude.pdf`)

### Étape 1 — Installation & outillage `claude-seo`
- Installation de `AgriciDaniel/claude-seo` (v2.6.2) et exécution de ses analyseurs Python (`page_checks.py`, `parse_html.py`, `content_quality.py`, `metadata_template.py`, `schema_ecommerce_validate.py`, `consistency_check.py`, `sitemap_discovery.py`, `agentic_check.py`, `agent_ux_check.py`, `preload_check.py`, `drift_baseline.py`, `drift_compare.py`).
- Vérification UX agentique (`agent_ux_check.py`) : **0 faux bouton `div[onclick]`**, **17 landmarks sémantiques**, **0 champ de formulaire sans label**.

### Étape 2 — Audit complet du site (`/seo audit`)
L'audit initial des 144 URLs du sitemap + routes système a mis en évidence 6 chantiers prioritaires :
1. **Core Web Vitals (CLS & LCP)** : utilisation généralisée de `<Image fill>` sans attributs HTML `width`/`height` sur 54 URLs, et chargement différé (`loading="lazy"`) de la première image visible sur 30 URLs (notamment `HomeGateway` rendu avant `Hero` sur `/`, `EditorialVisual` sur `/creation-sites` et `/codes`, `DemosClient`, `SectorDetailView`, `DemoViewer` et `ArticleView`).
2. **Pages catégories `/codes/category/*` minces & titres courts** : `<title>` inférieur à 30 caractères (`Gift cards | Nukhba`) et volume éditorial de 183 à 272 mots sans guide d'achat ni FAQ dédiée.
3. **Titres légaux trop courts & descriptions tronquées** : `/remboursement`, `/conditions`, `/mentions-legales` (`< 30` car.), 4 fiches `/demos/[slug]?lang=en` coupées au milieu d'un mot ou dépassant 160 octets à cause de `&amp;`, et `defaultMetaDescription()` à 204 caractères en anglais.
4. **Écho du suffixe de titre dans la description (`brand-suffix-in-description`)** sur 11 URLs (`/sectors/{toys,electronics,hardware,sanitary}`, `/services/branding`, `/codes/spotify-premium?lang=en`, `/compare/wix`, `/demos`, `/apps`, `/avis`).
5. **Schémas JSON-LD figés dans une seule langue** sur 13 routes (`/audit`, `/blog`, `/pricing` figés en anglais même en AR ; `/badge`, `/compare`, `/compare/[slug]`, `/contact`, `/demos`, `/demos/[slug]`, `/sectors`, `/sectors/[sector]`, `/services`, `/services/[service]` figés en arabe même sur `?lang=en`).
6. **Conformité IA (`robots.txt` & `llms.txt`) & Speculation Rules** : absence de `Claude-SearchBot` et `Claude-User` dans `robots.txt`, 5 sections `##` sans liste de liens `[Titre](url)` dans `llms.txt`, et absence de `<script type="speculationrules">` pour le préchargement instantané à la navigation.

### Étape 3 — Opportunités « Page 2 » Google Search Console (positions 11–20)
- Ajout du script **`scripts/gsc-quick-wins.mjs`** et de la commande **`npm run seo:gsc-quick-wins`** dans `package.json`.
- Ce script exploite exactement le même compte de service Google Cloud RS256 que `src/lib/google-indexing.ts` (`GOOGLE_INDEXING_CLIENT_EMAIL`, `GOOGLE_INDEXING_PRIVATE_KEY`, `GOOGLE_INDEXING_SITE_URL`) — **ou un export CSV Search Console** (`--csv Queries.csv`) — pour extraire automatiquement toutes les requêtes classées entre les **positions 11 et 20**, calculer leur score d'opportunité (`impressions × écart CTR × proximité top 10`) et prescrire l'action `/seo page <url>` correspondante :

```bash
# Mode API Google Search Console en direct :
GOOGLE_INDEXING_CLIENT_EMAIL="..." \
GOOGLE_INDEXING_PRIVATE_KEY="..." \
GOOGLE_INDEXING_SITE_URL="sc-domain:nokhba.net.ly" \
npm run seo:gsc-quick-wins

# Mode hors-ligne depuis un export CSV Search Console :
npm run seo:gsc-quick-wins -- --csv ./Queries.csv
```

- **Matrice des pages à fort potentiel (« Quick Wins ») optimisées dès cette passe** :
  - `/codes/category/gift_card`, `/codes/category/game_topup`, `/codes/category/software_key`, `/codes/category/subscription_code` (requêtes transactionnelles cartes cadeaux USDT, recharge Player ID, clés logicielles, abonnements prépayés).
  - `/demos` & `/demos/[slug]` (requêtes portfolio web Tripoli / Libye & e-commerce sectoriel).
  - `/sectors/{toys,electronics,hardware,sanitary}` & `/services/branding` (requêtes B2B locales à intention commerciale directe).
  - `/compare/wix` & `/blog/how-to-pay-with-crypto-usdt` (requêtes comparatives et guide paiement USDT).

### Étape 4 — Optimisations On-Page, CWV, Schémas & GEO appliquées (`/seo page`)
- **CWV — Dimensions explicites & priorité LCP** :
  - Remplacement de `fill` par des dimensions intrinsèques explicites (`width` / `height` + `h-full w-full object-cover`) et ajout de `loading="eager"` + `fetchPriority="high"` sur le premier visuel visible dans `home-gateway.tsx`, `editorial-visual.tsx`, `hero-visual.tsx`, `project-preview.tsx`, `demos-client.tsx`, `demo-viewer.tsx`, `sector-detail-view.tsx`, `upcoming-showcase-view.tsx`, `blog-client.tsx`, `article-view.tsx`, `digital-product-details.tsx`, `digital-catalog.tsx` et `digital-showcase.tsx`.
  - Injection de `<script type="speculationrules">` (`eagerness: "conservative"`, excluant `/api/*`, `/admin*`, `/pay/*`, `/livraison*`, `/codes/commande*`, `/abonnements/suivi*`) dans `src/app/layout.tsx`.
  - Allègement `<head>` dans `src/app/layout.tsx` et `src/lib/seo.ts` (suppression des balises redondantes `keywords`, `googlebot` dupliqué, `twitter:title/description/image` déjà hérités d'Open Graph, `authors/creator/publisher/applicationName`).
  - Compression MozJPEG progressive via `sharp` des 6 visuels lourds dans `public/live-demos/cinematic-scroll/images/` (tous désormais `< 200 Ko`).
- **Enrichissement des 4 hubs `/codes/category/[kind]`** (`src/lib/digital-categories.ts`, `src/app/(site)/codes/category/[kind]/page.tsx`) :
  - Titres SEO dédiés AR/EN de 34 à 46 caractères (`Digital Gift Cards in USD & USDT | Nukhba`, `Instant Game Top-Ups by Player ID | Nukhba`, etc.) tout en préservant strictement le `<h1>` paginé (`Gift cards — Page 2`) et le préfixe `Page 2.` des pages paginées.
  - Ajout d'un guide d'achat bilingue vérifiable (~480–540 mots au total sur la page 1), d'une checklist pré-achat en 4 points (respectant la règle A02 : recharge par **Player ID** sans jamais promettre de code e-mail sur `game_topup`) et de 3 Q/R visibles synchronisées avec un schéma `FAQPage` JSON-LD sur la page 1.
- **Alignement sémantique, ancres & métadonnées** :
  - Renforcement du chapô visible de `/demos` (`demos-client.tsx`) pour refléter les termes clés du `<title>` en AR et EN.
  - Ajout du nom produit accessible (`<span className="sr-only"> — {displayName(product)}</span>`) sur les liens `Details` / `التفاصيل` du catalogue `/codes` (`digital-catalog.tsx`).
  - Réécriture des titres/descriptions sur `/remboursement`, `/conditions`, `/mentions-legales`, `/apps`, `/avis`, `/demos`, `sectors.ts`, `services.ts`, `comparisons.ts`, `content.ts` et détection améliorée des noms déjà typés dans `productSeoTitle` (`digital-seo.ts`, ex. `Spotify Premium Code — from $17.90 | Nukhba`).
  - Décodage des entités HTML (`decode(...)`) avant mesure de longueur dans `scripts/seo-check.mjs` et mise à jour de la note Google mai 2026 sur `FAQPage` dans `src/lib/seo-audit.ts`.
- **Schémas JSON-LD 100 % bilingues & flux IA (`robots.txt`, `llms.txt`)** :
  - Localisation complète AR/EN des `BreadcrumbList`, `CollectionPage`, `WebPage` et `ContactPage` sur les 13 routes concernées + ajout de `BreadcrumbList` sur `/avis`, `/remboursement`, `/conditions` et `/mentions-legales`.
  - Restructuration de `buildLlmsTxt` (`src/lib/llms-txt.ts`) selon la grammaire stricte `llmstxt.org` (bloc de détails et citations GEO avant le premier `##`, listes de liens propres `- [Titre](url): description` dans chaque section `##`, section officielle `## Optional`, zéro lien dupliqué) tout en conservant 100 % des invariants des tests existants.
  - Ajout de `Claude-SearchBot` et `Claude-User` dans `src/app/robots.ts` et retrait du jeton non-RFC-9309 `AI2Bot` (couvert par `User-agent: *`).

### Étape 5 — Surveillance de dérive SEO (`/seo drift`)
Comparaison exécutée avec `drift_compare.py --skip-cwv` sur les **34 URLs de référence** enregistrées dans `~/.cache/claude-seo/drift/baselines.db` avant toute modification :
- **0 alerte `CRITICAL`** (`0` suppression de canonique, `0` `noindex` accidentel, `0` suppression de `<h1>` ou `<title>`, `0` suppression de schéma JSON-LD, `0` perte de balises Open Graph, `0` erreur HTTP).
- Les 33 notifications `WARNING` et 39 `INFO` correspondent exclusivement aux améliorations intentionnelles (allongement des `<title>` courts sur `/codes/category/*` et `/apps`, enrichissement des schémas JSON-LD localisés et ajout des `H2` de guides d'achat sur les rayons digitaux).

---

## 3. Vérifications CI exécutées

- `npm run typecheck` (`tsc --noEmit`) : **0 erreur**
- `npm run lint` (`eslint .`) : **0 erreur**
- `npm run test:seo` : **330 / 330 tests réussis**
- `npm run test:core` : **126 / 126 tests réussis**
- `npm run test:ops` : **31 / 31 tests réussis**
- `npm run build` : **build de production Next.js 16.4.6 réussi**
- `BASE_URL=http://localhost:3100 npm run seo:check` : **155 pages/ressources OK · 0 avertissement · 0 erreur**
- `node scripts/audit-website-content.mjs http://localhost:3100` : **118 contrôles de conformité commerciale réussis · 0 échec**
