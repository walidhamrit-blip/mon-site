# Aperçus légers de la page d’accueil

Le carrousel ne monte **aucune iframe**. Il utilise `ProjectPreview`, qui affiche une image et conserve une carte de projet lisible en cas d’échec réseau. Les huit projets restent accessibles par leur lien de visite.

- Premier couple ordinateur/téléphone : chargement prioritaire, environ 88 Ko de WebP au total (au lieu de deux pages complètes).
- Couple suivant uniquement : préchargement à faible priorité après 1,2 seconde, lorsque le carrousel défile et est visible. Désactivé avec `Save-Data` ou une connexion annoncée 2G.
- Galerie : image légère par défaut, site interactif monté uniquement après clic sur « Load interactive preview » ou ouverture plein écran.
- Images des sections inférieures : chargement différé et décodage asynchrone.
- Les captures sont servies directement depuis `public/previews`, sans service de captures externe ni proxy d’images au premier affichage.

## Provenance et limites

Captures effectuées le 17 octobre 2026 à partir du rendu local des sources des projets, avec leurs ressources locales et leurs données de repli. Ce ne sont pas des captures garanties identiques aux données de production du jour.

| Fichiers | Source | Révision |
| --- | --- | --- |
| `al-manhaj-company-{desktop,mobile}.webp` | `walidhamrit-blip/Al-manhaj-company-` | `64cbfc066d339f666747388d10117c18edddf693` |
| `hala-perfumes-{desktop,mobile}.webp` | `walidhamrit-blip/hala` | `ce4b861b745ffe1d8f901d43fb4079837cc2e6f7` |
| `tripo-teck-visual.webp` | `public/images/hero1.jpg` de `walidhamrit-blip/M-ET-OUTILLAGE-MODELE-3` | `3efc49d5a37fb141e88fc2b9ffba554e0ff10244` |

Les captures ordinateur sont rendues à 1440 × 900 puis réduites à 960 × 600 ; les captures mobiles sont rendues à 390 × 693. Compression WebP qualité 78. Le visuel Tripo-Teck est une photo du projet, **pas une capture**.

Pour les projets sans capture locale, le visuel déjà enregistré dans la galerie est utilisé et identifié comme « Project visual » / « صورة من المشروع » dans le carrousel. Ces images restent dépendantes de leur hébergeur externe. Ne pas présenter ces photos comme des captures d’écran.

## Mise à jour

Ajouter de vraies captures ordinateur/mobile compressées dans `public/previews`, puis compléter `src/lib/project-previews.ts`. L’association utilise l’URL exacte du projet (hors slash terminal), afin qu’une URL modifiée dans l’administration ne conserve pas silencieusement une ancienne capture sans rapport. Remplacer les noms de fichiers lors d’une mise à jour visuelle pour invalider le cache des navigateurs.

## Vérifications de non-régression

- Aucune iframe sur l’accueil tant que l’utilisateur ne demande pas une visite interactive.
- Les deux premières images du carrousel chargent même lorsque les domaines externes sont bloqués.
- Le défilement, les points de sélection et les boutons précédent/suivant ne créent aucune iframe.
- Le bouton de la galerie monte une seule iframe ; le plein écran reste disponible.
- Une image cassée conserve le titre du projet et son lien de visite.
- Vérifier également le rendu mobile, RTL/LTR et les préférences de réduction des animations.
