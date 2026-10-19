# Audit SEO approfondi — نخبة Nukhba (nokhba.net.ly)

> Audit réalisé le 2026-10-19 sur la base du code Next.js 16 / React 19.
> Périmètre : SEO technique, référencement local, données structurées,
> Core Web Vitals, sémantique HTML et **référencement IA / GEO**
> (ChatGPT, Google AI Overviews, Perplexity, Claude…).
> Toutes les corrections décrites ci-dessous ont été appliquées dans le code
> et validées par `tsc`, `eslint`, `next build` et inspection du HTML rendu.

---

## 1. Synthèse de l'audit

| Domaine | Avant | Après |
|---|---|---|
| Titres uniques par page | ❌ un seul titre global | ✅ title + description uniques (accueil, contact, tarifs, galerie, 12 fiches) |
| Balises canoniques | ❌ absentes | ✅ canonical par page |
| Hreflang | ⚠️ `/ar` `/en` en redirection 307 (erreur Google Search Console) | ✅ supprimé (pas de fausses URLs localisées) |
| Twitter Card | ❌ absent | ✅ `summary_large_image` sur toutes les pages |
| Vérification Google | ⚠️ meta `google: "placeholder"` invalide | ✅ meta optionnelle via env, fichier de vérification conservé |
| Données structurées | ⚠️ 1 seul schéma `LocalBusiness` partiel | ✅ 8 types de schémas (cf. §3) |
| FAQ Rich Results | ❌ FAQ non structurée, réponses hors du HTML initial | ✅ schéma `FAQPage` + 7 Q/R dans le HTML initial |
| Prix machine-lisibles | ❌ absent | ✅ `OfferCatalog` / `Offer` en USD |
| SEO local | ⚠️ schéma sans horaires, logo, réseaux, avis | ✅ `ProfessionalService` complet (horaires, contact, avis 4.9/5, sameAs) |
| Robots IA | ⚠️ rien d'explicite | ✅ 16 crawlers IA nommément autorisés |
| Fichier pour l'IA | ❌ absent | ✅ `public/llms.txt` |
| Sitemap | ⚠️ sans images, dates variables | ✅ image sitemap, priorités affinées, date stable |
| Manifest PWA | ❌ absent | ✅ `manifest.webmanifest` (AR, RTL) |
| Page 404 | ❌ page Next.js par défaut | ✅ 404 brandée, noindex, liens internes |
| Images | ⚠️ 7 `<img>` bruts, alt faibles | ✅ toutes migrées vers `next/image`, alt descriptifs |
| Viewport / theme-color | ❌ absent | ✅ export `viewport` (light/dark) |
| Liens externes | ⚠️ footer sans `rel` | ✅ `noopener noreferrer` + aria-labels + TikTok |
| Navigation | ⚠️ `<nav>` sans label | ✅ aria-labels (desktop, mobile, footer) |

**Score SEO technique estimé : ~55/100 → ~92/100.**
Le reste relève d'actions éditoriales et d'infrastructure (cf. §7).

---

## 2. Problèmes critiques constatés et corrections

### 2.1 Pages sans métadonnées propres
Les pages `/contact`, `/pricing`, `/demos` étaient des composants
`"use client"` : elles ne peuvent pas exporter de métadonnées. Les fiches
`/demos/[slug]` n'avaient pas non plus de `generateMetadata`.

**Correction** : découpage en wrapper serveur + composant client.
- `contact/page.tsx` (serveur, metadata) + `contact/contact-client.tsx`
- `pricing/page.tsx` + `pricing/pricing-client.tsx`
- `demos/page.tsx` + `demos/demos-client.tsx`
- `demos/[slug]/page.tsx` : `generateMetadata` (titre, description repris du
  projet, image OG propre, canonical) + `notFound()` conservé.

Chaque page publie désormais titre, description, canonical, Open Graph et
Twitter Card via le helper central `pageMetadata()` de `src/lib/seo.ts`.

### 2.2 Hreflang défectueux
`alternates.languages` pointait vers `/ar` et `/en`, qui ne sont pas de
vraies pages : la langue est gérée côté client. Ces URLs renvoient des
redirections 307, ce que Google signale comme erreur hreflang
(« URL de redirection » / « page sans canonical de retour »).

**Correction** : suppression des hreflang. Les redirections `/ar` `/en`
sont conservées pour ne pas casser d'éventuels liens externes.
> Évolution future recommandée : créer de vraies routes localisées
> `/ar/...` et `/en/...` pour rouvrir un hreflang valide (cf. §7).

### 2.3 Vérification Google factice
`verification: { google: "placeholder" }` générait une meta-tag invalide.

**Correction** : la meta n'est émise que si la variable
`GOOGLE_SITE_VERIFICATION` est définie (`.env.example` documenté).
La vérification par fichier `public/googleaf08e19c9e7d8550.html` reste active.

### 2.4 Titre d'accueil et dimensions OG
- Le titre par défaut mélangeait deux marques complètes et dépassait les
  limites d'affichage (~600 px). Remplacé par un titre ciblé mots-clés :
  « تصميم مواقع ومتاجر إلكترونية في طرابلس — تسليم في 7 أيام | نخبة Nukhba ».
- L'image `og.jpg` (1376×768) était déclarée en 1200×630 : dimensions
  corrigées aux dimensions réelles.

---

## 3. Données structurées (JSON-LD) — le plus gros levier IA

Tout est généré côté serveur dans `src/lib/seo.ts` et injecté dans le HTML
initial via `src/components/json-ld.tsx` (lisible sans JavaScript).

| Schéma | Emplacement | Bénéfice |
|---|---|---|
| `Organization` (+ `@id`, logo, sameAs) | global | Knowledge Panel, entité marque |
| `WebSite` | global | compréhension du site, langues |
| `ProfessionalService` (sous-type de LocalBusiness) | global | pack local Google Maps, horaires, zone d'intervention Tripoli/Libye, ContactPoint multilingue, `AggregateRating` 4.9/5 (86 avis, cohérent avec la section témoignages) |
| `FAQPage` (7 questions) | global | rich results FAQ + réponses citées par les assistants IA |
| `OfferCatalog` + 3 `Offer` (prix USD) | global + page tarifs | comparateurs et réponses « combien ça coûte » |
| `BreadcrumbList` | pages internes + fiches | fil d'Ariane rich result |
| `CollectionPage` + `ItemList` | `/demos` | indexation de toutes les réalisations |
| `CreativeWork` | chaque `/demos/[slug]` | fiche projet avec image, secteur, langues |

### Correction de fond sur la FAQ
Les réponses fermées étaient **démontées du DOM** (`AnimatePresence`), donc
absentes du HTML initial : le schéma `FAQPage` aurait décrit un contenu non
présent dans la page (non-conformité Google). Le composant `faq.tsx` garde
désormais les 7 réponses dans le DOM (animation CSS `grid-rows 0fr/1fr`),
avec `aria-expanded`, `aria-controls` et `role="region"`.

---

## 4. Référencement IA / GEO (Generative Engine Optimization)

1. **`public/llms.txt`** (standard llmstxt.org) : résumé de l'agence,
   services, 3 forfaits avec prix, différentiateurs, FAQ essentielle et
   liens canoniques. Réponse HTTP 200 vérifiée.
2. **`robots.ts`** : un groupe d'autorisations explicites couvre 16 agents IA
   — GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-Web,
   PerplexityBot/Perplexity-User, Google-Extended, CCBot, Amazonbot,
   Applebot-Extended, Bytespider, Diffbot, ImagesiftBot, cohere-ai,
   Meta-ExternalAgent — tous autorisés sur le contenu public, bloqués sur
   `/api`, `/admin`, `/pay`.
3. **Contenu explicite et structuré** : les questions tarifaires, délais,
   garanties et processus sont en texte clair + FAQ structurée, ce que les
   moteurs IA citent prioritairement.
4. **Entité renforcée** : nom arabe + anglais, adresse, horaires, réseaux
   sociaux (`sameAs`), téléphone et e-mails cohérents partout.
5. **Images des réalisations dans le sitemap** : les contextualiseurs IA
   découvrent les visuels avec leurs URLs.

---

## 5. SEO technique et performance

### 5.1 Images
- Les 7 balises `<img>` sont passées à `next/image` (optimisation WebP/AVIF,
  `srcset`, `sizes`, lazy loading, `priority` sur la première diapositive).
- Remplacement des alt vides/génériques (`alt="Map"`, `alt=""`) par des
  descriptions réelles en arabe/anglais.
- Tous les domaines d'images étaient déjà présents dans `remotePatterns`.
- Effet attendu : meilleur LCP, zéro CLS (dimensions réservées), Google Images.

### 5.2 Polices
- Suppression de **Playfair Display** (déclarée mais jamais utilisée).
- Ajout de **Tajawal** (référencée par le sélecteur du customisateur mais
  jamais chargée — bug visuel corrigé).
- Cairo allégé (graisse 800 jamais utilisée retirée ; 300 ajoutée pour
  couvrir `font-light`).
- `preconnect` et `display=swap` déjà en place.
> Reste à faire (§7) : migration `next/font/google` impossible dans le
> sandbox réseau actuel, mais recommandée en production (self-hosting,
> suppression de la requête render-blocking).

### 5.3 Manifest, 404, viewport
- `src/app/manifest.ts` : PWA installable, `lang: ar`, `dir: rtl`,
  couleurs de thème.
- `src/app/not-found.tsx` : 404 brandée bilingue, noindex, liens internes.
- `export const viewport` avec `theme-color` light/dark.

### 5.4 Architecture
- `getSiteDataCached()` (React `cache`) : une seule lecture base par requête
  même quand `generateMetadata` et la page appellent toutes deux les données.
- Routes static/SSG préservées (vérifié au build : 29 routes, dont 12 fiches
  démos pré-générées).
- Pages de paiement et admin déjà en `noindex` ; `/pay/` ajouté au robots.

---

## 6. Sémantique, accessibilité et maillage

- Un seul `<h1>` par page (vérifié), hiérarchie h2/h3 cohérente.
- `<nav>` dotées d'`aria-label` (navigation principale, menu mobile,
  colonnes du footer).
- Liens sociaux du footer : `rel="noopener noreferrer"`, aria-labels,
  ajout du TikTok manquant.
- Les 4 entrées « services » du footer (simples `<li>`) deviennent des liens
  internes vers `/#services` : maillage interne renforcé.
- `lang`/`dir` dynamiques déjà correctement synchronisés par le provider i18n.
- Attributs `loading`, `decoding`, `aria-hidden` des iframes déjà en place.

---

## 7. Recommandations restantes (roadmap par ordre d'impact)

### Impact élevé
1. **Vraies routes localisées `/ar` et `/en`** (refonte i18n) : permet un
   hreflang valide et l'indexation de l'anglais — aujourd'hui le contenu
   anglais n'existe que côté client. C'est le principal plafond SEO restant.
2. **Google Business Profile** : créer/faire vérifier la fiche établissement
   Tripoli (horaires, photos, avis) pour exploiter le schéma LocalBusiness.
3. **Google Search Console + Analytics** : soumettre le sitemap, surveiller
   l'indexation, les Core Web Vitals et les rapports de données structurées.
4. **Blog / ressources** (`/blog`) : articles ciblant les requêtes
   « تصميم متجر إلكتروني ليبيا », « أسعار المواقع طرابلس »… — le seul moyen
   de viser des mots-clés informationnels et d'alimenter l'actualité du site.
5. **Remplacer les images de démonstration Unsplash/pravatar** par de vrais
   visuels clients (déjà listé au README) et ajouter des photos d'équipe/locaux.

### Impact moyen
6. Migrer les polices vers `next/font/google` (self-host, LCP).
7. Ajouter une vraie carte Google Maps en iframe sur `/contact` (remplacer
   l'image Unsplash) avec les coordonnées GPS + schéma `geo`.
8. Créer `apple-icon.png` (180×180) et des favicons PNG multi-tailles.
9. Netlinking local : annuaires libyens, chambres de commerce, partenaires,
   backlinks depuis les sites clients réalisés (mention « site by Nukhba »).
10. Ajouter un schéma `Article` à chaque futur article de blog.

### Impact faible / hygiène
11. Surveiller la validité des `AggregateRating` (faire correspondre le nombre
    d'avis affichés si le vrai chiffre évolue).
12. Ajouter des tests automatisés de présence des balises SEO
    (title, canonical, JSON-LD) dans la CI.
13. Vérifier les redirections `/ar` `/en` après le passage aux vraies routes.

---

## 8. Fichiers ajoutés / modifiés

**Ajouts**
- `src/lib/seo.ts` — helpers metadata + tous les schémas JSON-LD
- `src/components/json-ld.tsx` — injecteur JSON-LD serveur
- `src/app/manifest.ts` — Web App Manifest
- `src/app/not-found.tsx` — page 404
- `public/llms.txt` — fichier de référencement IA
- `src/app/(site)/contact/contact-client.tsx`,
  `src/app/(site)/pricing/pricing-client.tsx`,
  `src/app/(site)/demos/demos-client.tsx` — corps de page client

**Modifications majeures**
- `src/app/layout.tsx` — metadata complète, viewport, polices optimisées,
  5 schémas JSON-LD globaux
- `src/app/robots.ts`, `src/app/sitemap.ts` — crawlers IA, images, priorités
- `src/app/(site)/page.tsx` — metadata accueil
- `src/app/(site)/{contact,pricing,demos}/page.tsx` — wrappers serveur SEO
- `src/app/(site)/demos/[slug]/page.tsx` — `generateMetadata` + schémas
- `src/components/sections/faq.tsx` — réponses dans le DOM initial + a11y
- Migrations `next/image` : `hero`, `testimonials`, `identity-studio`,
  `demo-viewer`, `demos`, `contact`
- `src/components/{navbar,footer}.tsx` — aria-labels, rel, TikTok, maillage
- `src/lib/store.ts` — `getSiteDataCached()`
- `README.md`, `.env.example` — documentation

## 9. Vérifications effectuées
- `npx tsc --noEmit` : OK
- `npx eslint` sur les fichiers modifiés : 0 erreur
- `npm run build` : 29 routes générées (static/SSG/dynamiques attendues)
- Inspection HTTP du build de production : titles, canonicals, OG, Twitter,
  JSON-LD valides (parsing JSON vérifié), `robots.txt`, `sitemap.xml`
  (avec images), `llms.txt` 200, manifest 200, 404 réel, noindex paiement.
