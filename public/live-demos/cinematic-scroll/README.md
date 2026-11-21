# Démo « Cinematic Scroll » — ALTITUDE

Démo technique autonome d'un site web **cinématique avec scroll piloté**,
dans le style des démos virales « Higgsfield + Claude / ChatGPT » — mais
réalisée **sans aucun service payant**.

## Ce qui la compose (tout est gratuit)

| Élément | Outil | Coût | Licence |
| --- | --- | --- | --- |
| Animations & scroll | GSAP 3.15 + ScrollTrigger + SplitText (locaux) | 0 $ | Gratuits pour usage commercial depuis GSAP 3.13 (Webflow) |
| Défilement fluide | Lenis 1.3 (local) | 0 $ | MIT |
| Visuels | Images générées par IA dans la session | 0 $ | Propres à ce projet |
| Hébergement | Tout fichier statique (Vercel/Netlify/GitHub Pages) | 0 $ | — |

## Structure

```
index.html          ← le site complet (HTML + CSS + JS inline)
favicon.svg
images/             ← 5 visuels IA (hero, intérieur, aérien, terrasse, pierre)
vendor/             ← gsap.min.js, ScrollTrigger.min.js, SplitText.min.js, lenis.min.js
```

Aucun CDN, aucune police externe : compatible avec la CSP stricte du site
(`script-src 'self'`, `font-src 'self'`).

## Effets inclus

- Préchargeur cinématique (compteur + révélation)
- Hero avec parallaxe liée au scroll et titres révélés ligne par ligne (masque)
- Manifeste épinglé : mots illuminés au fil du défilement
- Galerie horizontale épinglée avec parallaxe interne par carte
- Révélation « volet » (clip-path) + zoom contrôlé
- Chiffres animés, boutons magnétiques, curseur sur mesure
- Grain de film + vignette, barre de progression
- Respect de `prefers-reduced-motion` (version statique lisible)

## Prévisualisation locale

Servir ce dossier avec n'importe quel serveur statique, par ex. :

```bash
python3 -m http.server 8080 --directory public/live-demos/cinematic-scroll
```
