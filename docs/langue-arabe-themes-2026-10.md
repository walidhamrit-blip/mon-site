# Langue arabe principale + sélecteur des 6 thèmes les plus appréciés

Passe de refonte appliquée en octobre 2026 sur le site **نخبة Nukhba**.

## 1. Analyse du site (état avant la passe)

| Brique | Constat |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19, Tailwind 4, Framer Motion |
| Structure | Groupe de routes `(site)` (navbar + footer + chatbot) et `(admin)` séparé |
| Bilinguisme | Système complet AR/EN (`src/lib/i18n.tsx`, ~1 000 lignes de libellés) + direction RTL gérée sur `<html>` |
| **Langue par défaut** | **`defaultLocale: "en"`** alors que tout l'écosystème du site est arabe-first : contenu (`content.ts`), FAQ, blog, JSON-LD, métadonnées, marché par défaut Tripoli (`ar-LY`) |
| Thèmes | 8 palettes (`nukhba`, `royal`, `emerald`, `burgundy`, `graphite`, `copper`, `teal`, `violet`), chacune en clair + sombre |
| **Sélecteur de thèmes** | Bouton palette **masqué avant `2xl`** dans la barre supérieure (invisible sur la plupart des écrans) ; aucune notion de popularité |
| PWA | `manifest.ts` figé en `lang: "en"`, `dir: "ltr"` |
| SEO | Solide (JSON-LD Organization/WebSite/ProfessionalService/FAQ, sitemap, llms.txt, OG/Twitter) mais titres EN pour `/`, `/pricing`, `/blog` |
| Mémorisation | Clés `-choice` uniquement (le défaut admin n’écrase jamais le choix du visiteur) |

### Problèmes retenus

1. **Incohérence de langue** : un visiteur arrivait en anglais (LTR) puis devait cliquer pour voir le site en arabe, alors que le contenu, les prix, les avis et le marché par défaut sont arabes.
2. **Manifest PWA** en anglais : une application installée s’ouvrait en LTR.
3. **Métadonnées** des trois pages les plus stratégiques (accueil, tarifs, blog) uniquement en anglais.
4. **Sélecteur de thèmes peu accessible** (≥ 2xl) et **catalogue trop large** : deux palettes (`burgundy`, `copper`) sortaient du cœur de métier « agence / corporate » et diluaient le choix.
5. **Aucune hiérarchie** dans les thèmes : impossible de savoir lesquels sont les plus demandés sur ce type de projet.

## 2. Ce qui a été fait

### 2.1 L’arabe devient la langue principale

- `src/lib/config.ts` → `appearance.defaultLocale: "ar"` ; `src/lib/validation.ts` aligné
  (défauts Zod), `src/lib/i18n.tsx` → `defaultLocale = "ar"`.
- Le HTML est rendu **dès la première requête** avec `<html lang="ar" dir="rtl">`.
- Nouveau module partagé **`src/lib/locale.ts`** : langues disponibles, clé
  `nukhba-locale-choice`, `dirOf()`, et `localeBootScript()` injecté dans le
  `<head>` — le choix explicite du visiteur est appliqué **avant le premier
  rendu** (aucun flash de sens de lecture ; les anciennes clés `nukhba-locale`
  sont nettoyées).
- Nouveau composant **`src/components/locale-switcher.tsx`** : sélecteur de langue
  (barre supérieure + menu mobile) où l’arabe est marqué « langue principale ».
  L’anglais reste intégralement servi en un clic.
- **`src/app/manifest.ts`** : `lang` / `dir` suivent la langue principale
  (arabe + RTL), nom et description en arabe.
- Métadonnées alignées sur `siteLocale(config)` : accueil, tarifs et blog ont
  désormais un titre + description arabes (repli anglais si `/admin` repasse le
  site en anglais), et le titre racine du layout est arabe-first.

### 2.2 Sélecteur des 6 thèmes les plus appréciés du métier

- `src/lib/themes.ts` : catalogue réduit à **6 palettes classées** (`rank`) selon
  la demande observée sur les sites d’agences, studios et e-commerce premium :

| Rang | Thème | Secteurs |
|---|---|---|
| 1 ★ | نخبة الذهبي — Nukhba Gold | agences, marques de luxe, hôtellerie haut de gamme |
| 2 | أزرق ملكي — Royal Blue | finance, SaaS, corporate |
| 3 | فحمي مينيمال — Graphite | studios, portfolios, design |
| 4 | زمردي أخضر — Emerald | santé, durabilité, e-commerce |
| 5 | بنفسجي نبيل — Violet | tech, IA, marques créatives |
| 6 | تركوازي بحري — Ocean Teal | produits numériques, voyage, cliniques |

- Chaque thème expose désormais son rang (`rank`), son statut signature
  (`featured`) et ses **secteurs de prédilection** (`usesAr` / `usesEn`).
- **Migration douce** : `RETIRED_THEMES` mappe les anciennes clés `burgundy` et
  `copper` vers le thème signature ; `resolveThemeId()` est utilisé par le
  provider **et** par le script inline, donc un choix mémorisé avant la mise à
  jour reste valide (aucune erreur, aucun thème « fantôme »).
- `src/components/theme-switcher.tsx` refondu :
  - `ThemeSwitcher` (barre supérieure) : panneau « الثيمات الستة الأكثر تفضيلاً »
    avec miniature clair + sombre, secteurs et pastille de classement ;
  - `ThemeGallery` (nouveau) : sélecteur large 1 / 2 / 3 colonnes utilisé dans la
    section « ثيمات جاهزة » de l’accueil, grandes miniatures clair/sombre ;
  - `ThemeList` (menu mobile) : les 6 thèmes avec leur rang.
- **Accessibilité du sélecteur** : il est maintenant visible dès `lg` dans la
  barre supérieure (au lieu de `2xl`) et toujours présent dans le menu mobile.
- Textes mis à jour dans `src/lib/i18n.tsx` et `src/lib/content.ts`
  (« 8 thèmes » → « 6 thèmes classés »), libellés admin
  (`Sélecteur des 6 thèmes (classés)`), grille admin en 3 colonnes,
  et `README.md`.

## 3. Vérifications

```bash
npx tsc --noEmit          # OK
npx eslint src            # 0 erreur (1 warning préexistant, react-hook-form)
npm run test:seo          # 159 tests OK
npm run test:global       # 34 tests OK
npm run test:subscriptions# 25 tests OK
npm run build             # build de production OK
```

Contrôles sur le serveur de développement :

- `/` répond `200` avec `<html lang="ar" dir="rtl">` ;
- 6 blocs `html[data-theme="…"]` générés (plus aucun `burgundy` / `copper`) ;
- `/manifest.webmanifest` → `"lang":"ar","dir":"rtl"` ;
- titre d’accueil : « تصميم مواقع ومتاجر إلكترونية في طرابلس — تسليم خلال 7 أيام
  ودفع بالعملات الرقمية » ;
- les 6 cartes du sélecteur affichent « الأكثر طلباً » (rang 1) puis
  « رقم 2…6 في المجال ».

## 4. Notes

- Le mode clair/sombre reste **indépendant** du thème : chaque palette existe
  dans les deux modes (bouton ☀/☾ dédié).
- Les palettes `burgundy` et `copper` peuvent être réintroduites sans casser
  l’existant : il suffit de les rajouter dans `THEMES` (le sélecteur s’adapte)
  et de vider `RETIRED_THEMES`.
- Aucune URL `/ar` ou `/en` n’est créée : le site conserve une seule URL
  canonique par page, la langue étant un réglage client mémorisé.
