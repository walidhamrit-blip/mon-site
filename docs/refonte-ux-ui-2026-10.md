# Refonte UX/UI — audit et corrections

**Projet :** نخبة Nukhba (vitrine d'agence web, Tripoli — Libye)
**Date :** octobre 2026
**Périmètre :** vitrine publique arabe (RTL, principale) et anglaise (secondaire)
**Branche :** `arena/4a0dede4-mon-site` → PR [#48](https://github.com/walidhamrit-blip/mon-site/pull/48)

---

## 1. Méthode

1. **Audit** page par page (accueil, `/demos`, `/demos/[slug]`, `/services`, `/services/[slug]`,
   `/sectors`, `/sectors/[slug]`, `/pricing`, `/blog`, `/blog/[slug]`, `/apps`, `/products`,
   `/contact`, `/badge`) à 1440 px, 1280 px, 1152 px, 1024 px et 390 px, en clair et en sombre.
2. **Relevé des défauts** : débordements horizontaux, contrastes, hiérarchie typographique,
   densité, états vides, cohérence des prix, dépendances externes bloquantes.
3. **Correction** en s'appuyant sur un jeu de primitives CSS partagées plutôt que sur des
   valeurs codées en dur, pour que les futures pages restent cohérentes.
4. **Vérification** après chaque lot : `tsc --noEmit`, `eslint`, `npm run test:seo`, captures
   d'écran desktop/mobile, sonde de débordement (`scrollWidth` vs `clientWidth`).

---

## 2. Défauts constatés → corrections

| # | Défaut constaté | Correction |
| --- | --- | --- |
| 1 | Débordement horizontal de `/badge` (2265 px de contenu pour 1440 px de fenêtre) : le bloc de code élargissait sa colonne et poussait toute la page | Colonnes en `minmax(0, …)` + `min-w-0` sur la colonne et le `<pre>` ; le code défile dans son cadre |
| 2 | Barre de navigation incomplète entre 1024 et 1279 px (menu burger alors qu'il y avait la place) et grand vide central | Navigation complète dès `lg`, version compacte jusqu'à `xl`, sélecteur de thème masqué avant `xl` |
| 3 | Bandeau promo trop haut, repoussait le contenu, pas de fermeture persistante | Bandeau 44 px, fermable, hauteur publiée via `--promo-h` |
| 4 | Titre du hero trop long sur mobile, interligne serré, accroche peu lisible | `clamp()`, `text-balance`, interligne 1,06, accroche en `leading-8` |
| 5 | Effet « reflet doré » du hero : glyphes arabes doublés/déchirés pendant l'animation | Dégradé à arrêts progressifs, translation sur une plage réduite, animation ralentie, respect de `prefers-reduced-motion` |
| 6 | Zone vide sous le hero (parallaxe + bandeau de garanties qui se chevauchaient) | Parallaxe supprimée, hauteur du showcase stabilisée |
| 7 | Galerie `/demos` d'accueil : 8 cartes sur 12 affichaient un bloc gris vide hors ligne | Repli visuel **dessiné** (mini-fenêtre teintée à la couleur du projet, initiale, nom) ; les captures locales restent prioritaires |
| 8 | `/demos` : prix dupliqués et mal alignés, titres tronqués à mi-mot, catégorie à un seul site laissant deux colonnes vides | Prix + équivalent LYD alignés sous le nom, titres sur 2 lignes, carte **large** quand la catégorie ne contient qu'un site |
| 9 | Bandeau promo `-50 %` annoncé, mais prix remisé affiché nulle part | Composant `PromoPriceNote` : prix coupon affiché à côté du prix plein (cartes projet, galerie d'accueil, page projet), calculé par la **même fonction que le serveur de paiement** |
| 10 | `/blog` : hero à moitié vide, encadré « en bref » en pavé sous le titre, sous-titre anglais orphelin en bas de colonne | Hero en deux colonnes (titre + encadré d'entrée avec accès direct), sous-titre rattaché à son paragraphe |
| 11 | `/blog` : cartes d'articles peu lisibles (dates, catégories, temps de lecture en vrac) | Composant `ArticleCard` : étiquettes catégorie/date/durée alignées, extrait sur 3 lignes, lien d'action |
| 12 | `/apps` et `/products` : colonne de recherche isolée créant un vide sous le titre, visuels distants en échec → rectangle gris | Hero sur une colonne, barre recherche/compteur/CTA sur une ligne, visuel de repli coloré avec initiale |
| 13 | `/contact` : photo distante (Unsplash) + note de développement « remplacer par une iframe Google Maps » visible | Carte **dessinée en SVG** (îlots, voies, repère) + lien profond Google Maps ; note de dev supprimée |
| 14 | `/pricing` : bandeau de chips débordait à 390 px (392 px de contenu) | Chips en `inline-flex` + `max-w-full` + texte multiligne |
| 15 | Pied de page : import d'icônes de marque inexistantes dans `lucide-react` v1 (erreur de compilation), colonnes déséquilibrées | Monogrammes dessinés, bandeau d'appel à l'action, 4 colonnes |
| 16 | Aucune relance commerciale entre les avis et le formulaire de contact | Section d'appel à l'action au milieu de l'accueil (devis / WhatsApp) |
| 17 | Polices chargées depuis Google Fonts (requête tierce, RGPD, dépendance réseau) | Polices **auto-hébergées** (`public/fonts`, OFL), préchargement de Cairo, CSP resserrée |
| 18 | Numéro de téléphone du chatbot flottant chevauchant le bouton WhatsApp | Empilement vertical revu (chatbot au-dessus, WhatsApp en bas, marges de sécurité iOS) |

---

## 3. Système de design

Un jeu de primitives remplace les valeurs ad hoc. Toute nouvelle page doit les réutiliser.

| Primitive | Rôle |
| --- | --- |
| `.section` / `.section-tight` / `.section-muted` | rythme vertical homogène (`--section-y`) |
| `.section-eyebrow` / `.section-title` / `.section-lead` | en-têtes de section (taille fluide, `text-wrap: balance`) |
| `.card-surface` / `.card-interactive` | cartes : fond, bordure, rayon, ombre, survol |
| `.chip` / `.chip-accent` / `.scroll-x` | filtres, étiquettes, rangées défilantes |
| Jetons | `--radius-xs…pill`, `--shadow-xs…lg`, `--header-h`, `--promo-h`, `--ease-out-soft` |

Composant partagé `SectionHeading` (eyebrow / titre / accroche / note / colonne latérale)
utilisé par toutes les sections de l'accueil et les en-têtes de pages.

---

## 4. Contenu et cohérence commerciale

- **Grille tarifaire unique** : `config.pricing.plans` (300 $ / 510 $ / 880 $, équivalents LYD)
  alimente l'accueil, `/pricing`, `/demos` et les fiches projet — aucun prix saisi à la main.
- **Promotion** : `CURRENT_PROMO` (coupon `NUKHBA50`, −50 %) est la seule source ; le prix
  remisé affiché est calculé par `discountedAmount()`, la fonction utilisée par le serveur de
  paiement. Aucun écart possible entre l'affichage et le montant facturé.
- **Images** : les captures locales (`public/previews`) restent prioritaires ; à défaut, un
  visuel de repli est dessiné côté client — plus aucun cadre gris.

---

## 5. Performance et vie privée

- Polices auto-hébergées : Cairo (variable, sous-ensembles arabe + latin), IBM Plex Sans Arabic
  et Tajawal pour le studio d'identité. Préchargement de la police principale, `font-display: swap`,
  `unicode-range` pour ne télécharger que le sous-ensemble utile.
- CSP : suppression de `fonts.googleapis.com` (styles) et `fonts.gstatic.com` (polices).
- Aucune requête tierce bloquante au premier rendu.

---

## 6. Vérifications

| Contrôle | Résultat |
| --- | --- |
| `npx tsc --noEmit` | aucune erreur |
| `npx eslint src` | aucune erreur, aucun avertissement bloquant |
| `npm run test:seo` | 102 / 102 |
| `npm run build` | succès (toutes les routes prérendues) |
| 11 routes testées en HTTP | 200 |
| Débordement horizontal 1440 px / 390 px | aucun (13 pages) |
| Mode sombre | contrôlé sur accueil, galerie, tarifs |

---

## 7. Limites connues

- **`DATABASE_URL` absent** dans l'environnement de prévisualisation : le site sert le contenu
  par défaut (`[store] lecture des réglages impossible`, non bloquant). Les réglages enregistrés
  depuis `/admin` ne sont donc pas visibles ici.
- **Images éditoriales distantes** (Unsplash, Pexels, sites de démonstration `*.vercel.app`) :
  injoignables depuis le bac à sable. En production elles se chargent normalement ; les
  composants affichent désormais un repli propre en cas d'échec.
- **Non traité dans cette passe** : contenu éditorial arabe/anglais (textes métier), captures
  d'écran des projets (à régénérer avec `npm run previews:capture` depuis un réseau ouvert),
  tests d'accessibilité automatisés (axe) et mesure Lighthouse réelle.
