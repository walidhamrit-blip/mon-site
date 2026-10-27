# Pages comparatives (/compare) — l'« annonce » SEO programmée

> Statut : **en production**. Le moteur est piloté par un seul fichier de
> données ; ajouter une comparaison publie automatiquement une page, une
> carte Open Graph, des schémas JSON-LD, des entrées de sitemap et de
> llms.txt, plus les liens internes.

## 1. Le principe

L'affiche « Google Ads $2 000/mois ✗ … / Free to start ✓ … » est une
**annonce comparative**. Sur le site, elle devient un cluster SEO complet :

| Élément | Où il est généré |
|---|---|
| Données éditoriales (points ✗/✓, critères, FAQ, prix) | `src/lib/comparisons.ts` |
| Page `/compare/[slug]` (serveur : metadata + JSON-LD) | `src/app/(site)/compare/[slug]/page.tsx` |
| Affichage bilingue de la page | `src/components/comparison-view.tsx` |
| Hub `/compare` (serveur : metadata + JSON-LD) | `src/app/(site)/compare/page.tsx` |
| Affichage bilingue du hub | `src/components/comparison-hub-view.tsx` |
| Bandeau « comparaisons » en haut de `/services` | `src/components/comparison-strip.tsx` |
| Libellés communs (arabe / anglais) | `src/lib/i18n.tsx` → `compareLabels` (`t.compare.*`) |
| Carte Open Graph 1200×630 (« l'annonce ») | `src/lib/og-image.tsx` → `buildComparisonOgImage()` |
| Schémas JSON-LD | `src/lib/comparisons.ts` (`comparisonServiceJsonLd`, `comparisonCriteriaJsonLd`, `comparisonFaqJsonLd`, `comparisonsCollectionJsonLd`) |
| Sitemap | `src/app/sitemap.ts` (`comparisonIds`) |
| `/llms.txt` + `/llms-full.txt` | `src/lib/llms-txt.ts` |
| Navigation & pied de page | `src/components/navbar.tsx`, `src/components/footer.tsx` |
| Garde-fous | `scripts/comparison-pages.test.mjs`, `scripts/seo-check.mjs` |

**Le site ne « programmat » pas une image : il programme la donnée.** La
carte de partage, le tableau comparatif, le schema et le texte de la page
sont tous dérivés du même objet `ComparisonSeo`.

## 2. Ajouter une comparaison

1. Ouvrir `src/lib/comparisons.ts` et ajouter une entrée dans
   `comparisons` :

```ts
"mon-alternative": {
  id: "mon-alternative",
  competitorAr: "اسم البديل",
  competitorEn: "The Alternative",
  themPriceLabel: "$900+/mo",
  themPriceAr: "تكلفة شهرية (نموذج شائع)",
  themPriceEn: "Typical monthly cost",
  usPriceLabelAr: "مجاناً للبدء",
  usPriceLabelEn: "Free to start",
  usPriceNoteAr: "استشارة مجانية، ثم موقع يُدفع مرة واحدة",
  usPriceNoteEn: "Free consultation, then a website you pay for once",
  titleAr: "… (20 à 80 caractères)",
  titleEn: "… (20 à 80 caractères)",
  descriptionAr: "… (50 à 180 caractères)",
  descriptionEn: "… (50 à 180 caractères)",
  h1Ar: "…", h1En: "…",
  subtitleAr: "…", subtitleEn: "…",
  answerAr: "… (≥ 120 caractères)", answerEn: "… (≥ 100 caractères)",
  keywordsAr: ["…", "…", "…"], keywordsEn: ["…", "…", "…"],
  themPoints: [{ textAr: "…", textEn: "…" } /* ≥ 4 */],
  usPoints:   [{ textAr: "…", textEn: "…" } /* ≥ 4 */],
  criteria: [
    {
      labelAr: "…", labelEn: "…",
      usAr: "…", usEn: "…",
      themAr: "…", themEn: "…",
      winner: "us" /* "us" | "them" | "tie" */,
    },
  ],
  chooseThemAr: ["…", "…"], chooseThemEn: ["…", "…"],
  chooseUsAr:   ["…", "…"], chooseUsEn:   ["…", "…"],
  faqs: [{ qAr: "…", qEn: "…", aAr: "…", aEn: "…" } /* ≥ 3 */],
  relatedServices: ["landing", "restyle"],
  related: ["google-ads", "seo-agency"],
  ctaAr: "…", ctaEn: "…",
},
```

2. Lancer les garde-fous :

```bash
npm run test:seo          # inclut scripts/comparison-pages.test.mjs
npm run build && npm run start
BASE_URL=http://localhost:3100 node scripts/seo-check.mjs
```

3. C'est tout : la page, l'image de partage, les schémas, le sitemap, les
   llms.txt et les liens internes sont déjà en place.

## 3. Règles éditoriales (non négociables)

- **Chiffres نخبة = prix publiés.** Le site affiche le prix lu dans la
  configuration vivante (`/admin → Réglages → Bourses` et `Services`), jamais
  un montant recopié en dur dans la comparaison.
- **Chiffres du concurrent = ordres de grandeur.** Ils sont toujours
  présentés comme « نمط تسعير شائع / typical pricing » : un budget
  publicitaire ou un abonnement varie selon le marché, la concurrence et les
  réglages. Aucune affirmation.assertive sur une société précise.
- **Honnêteté symétrique.** Chaque page comporte un bloc « متى تختار أي
  خيار » : les cas où l'alternative est le bon choix (offre urgente, petite
  mission ponctuelle, site existant qui a besoin de contenu). Une
  comparaison qui n'admet aucune limite n'est pas une comparaison.
- **Réponse directe (`answerAr`).** Chaque page ouvre avec un paragraphe
  « answer-first » réutilisable tel quel par Google et les assistants IA
  (cible `speakable` : `h1` + `#compare-answer`).
- **Bilingue et réactif à la langue du site.** Chaque champ existe en arabe
  et en anglais. L'affichage est un composant **client** : il suit le
  bouton de langue de la barre supérieure (et la langue par défaut définie
  dans `/admin`), sans rechargement — comme toutes les autres sections du
  site. Les libellés d'interface (boutons, titres de sections) sont
  centralisés dans `compareLabels` (`src/lib/i18n.tsx`), les contenus
  éditoriaux restent dans `src/lib/comparisons.ts`.
- **Point d'entrée depuis « Open services ».** Le bandeau
  `src/components/comparison-strip.tsx` s'affiche en haut de `/services` :
  c'est la page du visiteur qui cherche « quoi payer ? », donc le meilleur
  endroit pour proposer la comparaison avant la grille des prestations.

## 4. Garde-fous automatiques

`scripts/comparison-pages.test.mjs` (inclus dans `npm run test:seo`) échoue
si :

- un titre sort de la fenêtre 20–80 caractères ou une description de la
  fenêtre 50–180 (après résolution des jetons `{city}` / `{cityEn}`) ;
- deux comparaisons partagent le même titre ou la même description
  (cannibalisation) ;
- une comparaison a moins de 4 points, 4 critères, 3 FAQ ou 2 cas d'usage
  par camp ;
- un champ contient un jeton de marché non résolu ou un caractère hors
  alphabet latin/arabe (garde-fou anti-texte corrompu) ;
- une comparaison liée ou un service lié n'existe pas ;
- les schémas JSON-LD ne correspondent plus aux données.

`scripts/seo-check.mjs` (audit HTTP après build) contrôle en plus, sur les
pages `/compare/*` : une seule balise `<h1>`, canonical, Open Graph, carte
de partage, `Service` + `Offer`, `ItemList`, bloc `#compare-answer`,
présence dans `/llms.txt` et `/llms-full.txt`, et absence de `noindex`.

## 5. Impact SEO attendu

- **Pages de longue traîne** : « google ads vs website », « wix vs custom
  website », « seo retainer »… — requêtes de comparaison à forte intention
  commerciale, faible concurrence sur le marché arabe/libyen.
- **Cluster topical** : un hub + N pages se renforcent mutuellement (liens
  internes dans les deux sens : hub → page, page → hub, page → page liée).
- **GEO (référencement IA)** : réponse directe, FAQ balis `FAQPage`,
  `ItemList` des critères, `llms.txt` — les LLM peuvent citer la comparaison
  entière.
- **Partage social** : chaque page a sa carte 1200×630 générée à la volée,
  au format de l'affiche (rouge ✗ / vert ✓), donc partageable sur WhatsApp,
  Facebook et LinkedIn sans production graphique.
