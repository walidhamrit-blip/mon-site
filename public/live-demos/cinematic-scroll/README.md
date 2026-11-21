# Démo « Cinematic Scroll » — My Clock (horlogerie & objets de luxe, FR/AR)

Démo **client** d'un site d'horlogerie et d'objets précieux avec **scroll
cinématique**, dans le style des démos virales « Higgsfield + Claude /
ChatGPT » — réalisée **sans aucun service payant**.

- **Ambiance** : palette bleu / blanc / noir avec **sélecteur clair ↔ sombre**
  (thème système détecté, choix mémorisé), grain fin, vignette douce
- **Bilingue** : français ⇄ arabe (RTL complet), sélecteur dans l'en-tête
- **Effets** : hero parallaxe, manifeste épinglé mot à mot, galerie
  horizontale épinglée, révélation clip-path, chiffres animés, boutons
  magnétiques, curseur sur mesure, `prefers-reduced-motion` respecté

## Ce qui la compose (tout est gratuit)

| Élément | Outil | Coût | Licence |
| --- | --- | --- | --- |
| Animations & scroll | GSAP 3.15 + ScrollTrigger + SplitText (locaux) | 0 $ | Gratuits pour usage commercial depuis GSAP 3.13 (Webflow) |
| Défilement fluide | Lenis 1.3 (local) | 0 $ | MIT |
| Police arabe | Cairo (auto-hébergée) | 0 $ | SIL OFL (voir `fonts/OFL-Cairo.txt`) |
| Visuels | 6 images générées par IA (montre bleue, montre or, bijoux argent, objets or, mouvement, hero) | 0 $ | Propres à ce projet |
| Hébergement | Tout fichier statique (Vercel/Netlify/GitHub Pages) | 0 $ | — |

## Structure

```
index.html          ← le site complet (HTML + CSS + JS inline, dictionnaire i18n)
favicon.svg
fonts/              ← Cairo variable (OFL)
images/             ← 6 visuels IA (watch-hero, watch-diver, watch-skeleton, watch-blue, watch-gold, silver, gold, movement)
vendor/             ← gsap.min.js, ScrollTrigger.min.js, SplitText.min.js, lenis.min.js
```

Aucun CDN, aucune police externe : compatible avec la CSP stricte du site
(`script-src 'self'`, `font-src 'self'`).

## Bilinguisme

Le dictionnaire `I18N` (en bas du fichier) porte chaque chaîne en `fr` et `ar`.
Le sélecteur enregistre la langue (`localStorage.mira-lang`) et recharge :
l'intro est alors sautée. Le passage en arabe bascule `dir="rtl"`, la galerie
horizontale s'inverse automatiquement, et les règles `letter-spacing` sont
neutralisées (l'interlettrage casse les liaisons arabes).

## Prévisualisation locale

```bash
python3 -m http.server 8080 --directory public/live-demos/cinematic-scroll
```
