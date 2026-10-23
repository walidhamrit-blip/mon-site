# Aperçus légers de la page d’accueil

Le carrousel ne monte **aucune iframe**. Il utilise `ProjectPreview`, qui affiche une image et conserve une carte de projet lisible en cas d’échec réseau. Les huit projets restent accessibles par leur lien de visite.

- Premier couple ordinateur/téléphone : chargement prioritaire, environ 88 Ko de WebP au total (au lieu de deux pages complètes).
- Couple suivant uniquement : préchargement à faible priorité après 1,2 seconde, lorsque le carrousel défile et est visible. Désactivé avec `Save-Data` ou une connexion annoncée 2G.
- Galerie : image légère par défaut, site interactif monté uniquement après clic sur « Load interactive preview » ou ouverture plein écran.
- Images des sections inférieures : chargement différé et décodage asynchrone.
- Les captures sont servies directement depuis `public/previews`, sans service de captures externe ni proxy d’images au premier affichage.

## Provenance et limites

Captures initiales effectuées le 17 octobre 2026 à partir du rendu local des sources des projets, avec leurs ressources locales et leurs données de repli. Depuis la vague 3, elles sont **régénérées automatiquement** chaque semaine par `scripts/capture-previews.mjs` sur les URL de production des démos (voir « Captures automatiques » ci-dessous) : les fichiers publiés peuvent donc dater de la dernière exécution, et non du 17 octobre. Ce ne sont pas des captures garanties identiques aux données de production du jour.

| Fichiers | Source | Révision |
| --- | --- | --- |
| `al-manhaj-company-{desktop,mobile}.webp` | `walidhamrit-blip/Al-manhaj-company-` | `64cbfc066d339f666747388d10117c18edddf693` |
| `hala-perfumes-{desktop,mobile}.webp` | `walidhamrit-blip/hala` | `ce4b861b745ffe1d8f901d43fb4079837cc2e6f7` |
| `tripo-teck-visual.webp` | `public/images/hero1.jpg` de `walidhamrit-blip/M-ET-OUTILLAGE-MODELE-3` | `3efc49d5a37fb141e88fc2b9ffba554e0ff10244` |
| `myphone-visual-{desktop,mobile}.webp` | `public/images/hero-phone.jpg` et `public/images/phone.jpg` de `walidhamrit-blip/smartphine-demo` | `e9d8a3faf4077087bf697dabcebc6587e7056983` |

Les captures ordinateur sont rendues à 1440 × 900 puis réduites à 960 × 600 ; les captures mobiles sont rendues à 390 × 693. Compression WebP qualité 78. Le visuel Tripo-Teck est une photo du projet, **pas une capture**.

Les visuels MyPhone (démo smartphone) sont eux aussi des **photos du projet**, pas des captures : `hero-phone.jpg` recadré en 960 × 600 pour le cadre ordinateur, `phone.jpg` recadré au ratio 9/16 en 390 × 693 pour le cadre téléphone (environ 14 Ko chacun). Le site réel reste accessible en vue téléphone dans la visionneuse plein écran et dans la galerie.

Pour les projets sans capture locale, le visuel déjà enregistré dans la galerie est utilisé et identifié comme « Project visual » / « صورة من المشروع » dans le carrousel. Ces images restent dépendantes de leur hébergeur externe. Ne pas présenter ces photos comme des captures d’écran.

## Captures automatiques (Playwright + Sharp)

`scripts/capture-previews.mjs` remplace la fabrication manuelle des visuels :

1. il lit les démos (`src/lib/content.ts` en local, ou `<base>/api/public/demos` avec `--base`) ;
2. il vérifie que chaque `previewUrl` répond en HTTP 200 ;
3. il capture le rendu réel en 1440 × 900 (ordinateur) et 390 × 693 (téléphone), animations figées et bandeaux cookies masqués ;
4. il convertit en WebP qualité 78 (960 × 600 et 390 × 693) ;
5. il écrit `public/previews/<slug>-{desktop,mobile}.webp` et `public/previews/manifest.json` ;
6. il produit un rapport `reports/demo-previews-AAAA-MM-JJ.json` (synthèse, statut HTTP, erreurs).

```bash
npm run previews:capture -- --dry-run          # plan, sans navigateur
npm run previews:capture -- --force            # tout recapturer
npm run previews:capture -- --only=hala-perfumes
npm run previews:capture -- --base=https://nokhba.net.ly
```

| Option | Effet |
| --- | --- |
| `--dry-run` | planifie sans réseau ni écriture (rapport tout de même écrit) |
| `--force` | ignore l’âge de la dernière capture et le test « inchangé » |
| `--prune` | retire du manifeste les projets disparus du contenu |
| `--only=slug1,slug2` | limite la capture à certaines démos |
| `--base=URL` | lit les démos depuis `<URL>/api/public/demos` (site en production) |
| `--concurrency=N` | captures parallèles (défaut 3) |
| `--max-age-days=N` | ne recapture pas une capture plus récente (défaut 7) |

Codes de sortie : `0` succès (même avec des démos hors ligne, signalées dans le rapport), `1` erreurs de capture sur des sites joignables, `3` Playwright/Sharp/navigateur absent, `4` aucune démo exploitable.

**Une démo hors ligne ne casse jamais le site** : sa dernière capture connue est conservée dans le manifeste, l’entrée passe `status: "down"` avec `httpStatus` et `lastError`, et le workflow ouvre une issue « Démos hors ligne » au lieu de publier une image cassée.

### Manifeste source unique

`public/previews/manifest.json` est lu au build par `src/lib/preview-manifest.ts` et alimente :

- le carrousel et la galerie (`getProjectPreview`) ;
- le sitemap d’images (`<image:loc>` des réalisations) ;
- les données structurées `CreativeWork` (`image`, `screenshot`, `thumbnailUrl`).

L’association se fait sur l’URL exacte du projet (hors slash terminal) : changer l’URL dans l’administration ne rattache jamais une ancienne capture sans rapport.

### Cache et anti-régression

- Les URL publiées portent `?v=<hash>` (`previewSrc`) : une nouvelle capture change d’empreinte et invalide immédiatement les caches navigateur/CDN. **Plus besoin de renommer les fichiers** — le nom reste stable dans Git.
- Une capture identique à la précédente n’écrit rien (`unchanged`) : pas de commit hebdomadaire de binaires inchangés.
- `npm run test:seo` (21 tests dédiés) couvre la normalisation d’URL, les slugs sûrs, la fusion du manifeste, la classification HTTP, les codes de sortie et le mode « inchangé ».

### Exécution planifiée

`.github/workflows/demo-previews.yml` : lundi 07:00 UTC, à chaque changement du pipeline ou de `src/lib/content.ts` sur `main`, et `workflow_dispatch` (avec `only` et `force`). Le déclencheur `push` garantit une première capture réelle dès le merge, sans dépendre d'un jeton autorisé à lancer un workflow. Le workflow installe Chromium (`npx playwright install --with-deps chromium`), lance la capture avec `--base=https://nokhba.net.ly`, publie le rapport en artefact, ouvre une pull request `chore(previews)` quand des WebP changent, et une issue `demo-preview` en cas de démo morte. Aucune clé n’est requise.

En local, Playwright n’a pas de navigateur installé par défaut : exécuter `npx playwright install chromium` (non versionné). Sans navigateur, le script sort en code 3 avec un message explicite ; `--dry-run` reste utilisable partout.

## Vérifications de non-régression

- Aucune iframe sur l’accueil tant que l’utilisateur ne demande pas une visite interactive.
- Les deux premières images du carrousel chargent même lorsque les domaines externes sont bloqués.
- Le défilement, les points de sélection et les boutons précédent/suivant ne créent aucune iframe.
- Le bouton de la galerie monte une seule iframe ; le plein écran reste disponible.
- Une image cassée conserve le titre du projet et son lien de visite.
- Vérifier également le rendu mobile, RTL/LTR et les préférences de réduction des animations.
- `npm run previews:capture -- --dry-run` doit annoncer les 12 démos sans toucher aux images.
- `npm run seo:check` vérifie que le sitemap publie au moins une capture locale `/previews/*.webp`.
